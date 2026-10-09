import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { db, type PendingRegistration } from '../db/store.js';
import { sendRegistrationOtpEmail } from '../services/emailService.js';
import {
  createSignedToken,
  getAppSecretKey,
  verifySignedToken,
  verifyGoogleLogin,
  verifyFacebookLogin,
  cleanDisplayName,
  providerFallbackName
} from '../security/tokens.js';
import { resolveClientIp } from '../security/clientIp.js';
import { createRateLimiter, createAttemptTracker } from '../security/rateLimit.js';
import { hasValidBirthDetails } from '../services/birthDetails.js';

export const authRouter = Router();

// Rate limiting for login & sensitive endpoints.
//
// The counters live in Redis when REDIS_URL is configured so every instance of
// the API shares one lockout state; without it the in-process tracker is used
// (correct for a single instance) — see RATE_LIMITING_AND_PAYMENT_RECOVERY.md.
const MAX_LOGIN_RATE_LIMIT_KEYS = 20_000;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;

const loginAttemptTracker = createAttemptTracker({
  namespace: 'astrosivam:login',
  maxFailures: MAX_LOGIN_FAILURES,
  failureWindowMs: LOGIN_FAILURE_WINDOW_MS,
  blockMs: LOGIN_FAILURE_WINDOW_MS,
  maxKeys: MAX_LOGIN_RATE_LIMIT_KEYS
});
const registrationRateLimiter = createRateLimiter({ maxKeys: MAX_LOGIN_RATE_LIMIT_KEYS, namespace: 'astrosivam:register' });
const registrationEmailRateLimiter = createRateLimiter({ maxKeys: MAX_LOGIN_RATE_LIMIT_KEYS, namespace: 'astrosivam:register-email' });
const verificationAttemptRateLimiter = createRateLimiter({ maxKeys: MAX_LOGIN_RATE_LIMIT_KEYS, namespace: 'astrosivam:verify-email' });
const verificationResendRateLimiter = createRateLimiter({ maxKeys: MAX_LOGIN_RATE_LIMIT_KEYS, namespace: 'astrosivam:resend-email' });

const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;
const EMAIL_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_EMAIL_OTP_ATTEMPTS = 5;
const MAX_EMAIL_OTP_RESENDS = 3;

function registrationOtpHash(email: string, otp: string): string {
  return createHmac('sha256', getAppSecretKey())
    .update(JSON.stringify(['registration-otp', email.toLowerCase().trim(), otp]))
    .digest('hex');
}

function matchesRegistrationOtp(email: string, otp: string, expectedHex: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(registrationOtpHash(email, otp), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function emailLimitKey(action: string, email: string): string {
  const emailDigest = createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
  return `${action}:email:${emailDigest}`;
}

async function enforceAuthFlowLimits(
  res: Response,
  checks: Array<{ limiter: ReturnType<typeof createRateLimiter>; key: string; maxHits: number; windowMs: number; message: string }>
): Promise<boolean> {
  for (const check of checks) {
    const result = await check.limiter.consume(check.key, check.maxHits, check.windowMs);
    if (!result.allowed) {
      const retryAfter = Math.max(1, result.retryAfterSeconds || 60);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ success: false, message: check.message, retryAfterSeconds: retryAfter });
      return false;
    }
  }
  return true;
}

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remainingSeconds?: number }> {
  return loginAttemptTracker.check(ip);
}

async function recordFailedAttempt(ip: string): Promise<void> {
  return loginAttemptTracker.recordFailure(ip);
}

async function recordSuccessfulAttempt(ip: string): Promise<void> {
  return loginAttemptTracker.recordSuccess(ip);
}

function getClientIp(req: Request): string {
  // Hardened: forwarding headers are only trusted when the direct peer is a
  // proxy we run behind (private network / Cloudflare edge). See clientIp.ts.
  return resolveClientIp(req);
}

// Extracts signed bearer tokens only from headers; URLs and request bodies are
// intentionally not token channels because query strings are routinely logged.
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7).trim();

  const xAuth = req.headers['x-authorization'];
  if (typeof xAuth === 'string' && xAuth.trim()) {
    return (xAuth.startsWith('Bearer ') ? xAuth.substring(7) : xAuth).trim();
  }

  const xToken = req.headers['x-auth-token'];
  if (typeof xToken === 'string' && xToken.trim()) return xToken.trim();

  return null;
}

/**
 * Resolves the authenticated user from a SIGNED bearer token.
 *
 * SECURITY: the token signature and expiry are verified before the database is
 * touched, and the user must already exist. Previously this function decoded
 * any unsigned base64 payload AND auto-created an account for unknown e-mails,
 * which allowed a full admin takeover with a hand-crafted token.
 */
export function getAuthenticatedUser(req: Request) {
  const payload = verifySignedToken(extractBearerToken(req));
  if (!payload) return null;

  // The immutable user ID is the token subject. Never fall back to email: if
  // an old account is deleted and its address reused, a stale token must not
  // authenticate the new account.
  if (typeof payload.id !== 'string' || !payload.id) return null;
  return db.findUserById(payload.id) || null;
}

export function requireAuth(req: Request, res: Response, next: () => void) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
    return;
  }
  (req as any).user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: () => void) {
  const user = getAuthenticatedUser(req);
  if (!user || user.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Admin privileges required.' });
    return;
  }
  (req as any).user = user;
  next();
}

function createToken(user: { id: string; email: string; role: string }) {
  return createSignedToken(user);
}

// POST /api/auth/register
// A local account is not created or authenticated until its mailbox is verified.
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = await checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      const retryAfter = Math.max(1, rateCheck.remainingSeconds || 60);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ success: false, message: `Too many attempts. Please retry in ${retryAfter} seconds.` });
      return;
    }

    const registrationCheck = await registrationRateLimiter.consume(`register:${clientIp}`, 5, 10 * 60_000);
    if (!registrationCheck.allowed) {
      const retryAfter = Math.max(1, registrationCheck.retryAfterSeconds || 60);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        success: false,
        message: `Too many account creation requests. Please retry in ${retryAfter} seconds.`,
        retryAfterSeconds: retryAfter
      });
      return;
    }

    const { name, email, mobile, password, country, birthProfile } = req.body || {};
    if (typeof email !== 'string' || typeof name !== 'string' || typeof mobile !== 'string' || typeof password !== 'string') {
      res.status(400).json({ success: false, message: 'Name, email, mobile number and password must be valid text values.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = cleanDisplayName(name.replace(/[<>]/g, '')) || providerFallbackName(cleanEmail);
    const cleanMobile = mobile.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254 || !cleanName || cleanName.length > 120 || cleanMobile.length > 40) {
      res.status(400).json({ success: false, message: 'Please provide a valid email, name and mobile number.' });
      return;
    }
    if (!password.trim() || Buffer.byteLength(password, 'utf8') > 72 || password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be 6 or more characters and no longer than 72 UTF-8 bytes.' });
      return;
    }

    const emailRegistrationCheck = await registrationEmailRateLimiter.consume(
      emailLimitKey('register', cleanEmail), 3, 15 * 60_000
    );
    if (!emailRegistrationCheck.allowed) {
      const retryAfter = Math.max(1, emailRegistrationCheck.retryAfterSeconds || 60);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ success: false, message: `Too many verification requests for this email. Retry in ${retryAfter} seconds.`, retryAfterSeconds: retryAfter });
      return;
    }

    if (db.findUserByEmail(cleanEmail)) {
      res.status(409).json({ success: false, message: 'An account with this email already exists. Please log in.' });
      return;
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const previousPending = db.findPendingRegistrationByEmail(cleanEmail);
    const previousSentAt = previousPending ? Date.parse(previousPending.lastSentAt) : NaN;
    if (previousPending && Number.isFinite(previousSentAt) && now - previousSentAt < EMAIL_OTP_RESEND_COOLDOWN_MS) {
      const retryAfter = Math.max(1, Math.ceil((EMAIL_OTP_RESEND_COOLDOWN_MS - (now - previousSentAt)) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ success: false, message: `Please wait ${retryAfter} seconds before requesting another verification code.`, retryAfterSeconds: retryAfter });
      return;
    }

    const cleanCountry = typeof country === 'string' && country.trim() ? country.trim().slice(0, 100) : 'Fiji';
    const cleanBirthProfile = birthProfile && typeof birthProfile === 'object' && !Array.isArray(birthProfile)
      ? birthProfile
      : undefined;
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const pending: PendingRegistration = {
      email: cleanEmail,
      name: cleanName,
      mobile: cleanMobile,
      passwordHash: bcrypt.hashSync(password, 10),
      country: cleanCountry,
      ...(cleanBirthProfile ? { birthProfile: cleanBirthProfile } : {}),
      otpHash: registrationOtpHash(cleanEmail, otp),
      createdAt: previousPending?.createdAt || nowIso,
      expiresAt: new Date(now + EMAIL_OTP_TTL_MS).toISOString(),
      lastSentAt: nowIso,
      failedAttempts: 0,
      resendCount: 0
    };

    // Persist the HMAC (never the code itself) before sending so a delivered
    // code is usable immediately. Restore the previous pending state if SMTP
    // rejects the message.
    db.savePendingRegistration(pending);
    const emailSent = await sendRegistrationOtpEmail(cleanEmail, cleanName, otp);
    if (!emailSent) {
      if (previousPending) db.savePendingRegistration(previousPending);
      else db.deletePendingRegistration(cleanEmail);
      res.status(503).json({ success: false, message: 'The verification email could not be sent. Please try again shortly.' });
      return;
    }

    res.status(201).json({
      success: true,
      status: 'otp_required',
      requiresOtp: true,
      email: cleanEmail,
      message: `We've sent a 6-digit verification code to ${cleanEmail}. Enter it to activate your account.`
    });
  } catch (error: any) {
    console.error('ASTRO SIVAM: registration request failed.', error?.name || 'Error');
    res.status(500).json({ success: false, message: 'Registration could not be completed. Please try again later.' });
  }
});

// POST /api/auth/register/verify
// The password is checked again to bind activation to the registration the
// user initiated; possession of a forwarded OTP alone cannot activate another
// person's pending credentials.
authRouter.post('/register/verify', async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(otp) || !password || Buffer.byteLength(password, 'utf8') > 72) {
      res.status(400).json({ success: false, message: 'Email, password and the 6-digit verification code are required.' });
      return;
    }

    const limited = await enforceAuthFlowLimits(res, [
      { limiter: verificationAttemptRateLimiter, key: `verify:ip:${clientIp}`, maxHits: 10, windowMs: 15 * 60_000, message: 'Too many verification attempts from this network. Please try again later.' },
      { limiter: verificationAttemptRateLimiter, key: emailLimitKey('verify', email), maxHits: 5, windowMs: 15 * 60_000, message: 'Too many verification attempts for this email. Request a new code and try again later.' }
    ]);
    if (!limited) return;

    const pending = db.findPendingRegistrationByEmail(email);
    if (!pending) {
      res.status(404).json({ success: false, message: 'No pending registration found for this email.' });
      return;
    }
    if (Date.parse(pending.expiresAt) <= Date.now()) {
      res.status(410).json({ success: false, message: 'This verification code has expired. Request a new code.' });
      return;
    }
    if (pending.failedAttempts >= MAX_EMAIL_OTP_ATTEMPTS) {
      res.status(429).json({ success: false, message: 'Too many incorrect attempts. Request a new verification code.' });
      return;
    }

    let passwordMatches = false;
    try {
      passwordMatches = bcrypt.compareSync(password, pending.passwordHash);
    } catch {
      passwordMatches = false;
    }
    const codeMatches = matchesRegistrationOtp(email, otp, pending.otpHash);
    if (!passwordMatches || !codeMatches) {
      const failedAttempts = pending.failedAttempts + 1;
      db.updatePendingRegistration(email, { failedAttempts });
      res.status(failedAttempts >= MAX_EMAIL_OTP_ATTEMPTS ? 429 : 401).json({
        success: false,
        message: failedAttempts >= MAX_EMAIL_OTP_ATTEMPTS
          ? 'Too many incorrect attempts. Request a new verification code.'
          : 'The verification code or registration password is incorrect.'
      });
      return;
    }

    // A social sign-up or another concurrent registration may have claimed the
    // same email while this code was pending. Never silently link or replace it.
    if (db.findUserByEmail(email)) {
      db.deletePendingRegistration(email);
      res.status(409).json({ success: false, message: 'An account with this email already exists. Sign in using that account.' });
      return;
    }

    const user = db.createUser({
      name: pending.name,
      email: pending.email,
      mobile: pending.mobile,
      passwordHash: pending.passwordHash,
      role: 'customer',
      country: pending.country,
      authProvider: 'local',
      emailVerifiedAt: new Date().toISOString()
    });

    const birthProfile = pending.birthProfile;
    if (hasValidBirthDetails(birthProfile)) {
      db.saveBirthProfile({
        userId: user.id,
        name: typeof birthProfile.name === 'string' && birthProfile.name.trim() ? birthProfile.name.trim() : user.name,
        dob: String(birthProfile.dob),
        tob: String(birthProfile.tob),
        birthPlace: String(birthProfile.birthPlace).trim(),
        country: typeof birthProfile.country === 'string' ? birthProfile.country.trim() : '',
        latitude: Number(birthProfile.latitude),
        longitude: Number(birthProfile.longitude),
        timezoneOffsetHours: Number(birthProfile.timezoneOffsetHours),
        gender: birthProfile.gender === 'F' ? 'F' : 'M',
        updatedAt: new Date().toISOString()
      });
    }

    db.deletePendingRegistration(email);
    await recordSuccessfulAttempt(clientIp);
    db.updateUserLastLogin(user.id);
    const displayName = db.healDisplayNames(user.id);
    const token = createToken(user);
    const savedBirthProfile = db.getBirthProfile(user.id);
    res.json({
      success: true,
      status: 'success',
      message: `Welcome, ${displayName}! Your email is verified and your account is active.`,
      token,
      user: { id: user.id, name: displayName, email: user.email, mobile: user.mobile, role: user.role, country: user.country },
      birthProfile: savedBirthProfile || null
    });
  } catch (error: any) {
    console.error('ASTRO SIVAM: email verification failed.', error?.name || 'Error');
    res.status(500).json({ success: false, message: 'Email verification could not be completed. Please try again later.' });
  }
});

// POST /api/auth/register/resend
// Response text is deliberately generic for unknown addresses to avoid account
// enumeration. Resend is bounded per IP, per email, and per pending registration.
authRouter.post('/register/resend', async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, message: 'A valid email address is required.' });
      return;
    }

    const limited = await enforceAuthFlowLimits(res, [
      { limiter: verificationResendRateLimiter, key: `resend:ip:${clientIp}`, maxHits: 5, windowMs: 60 * 60_000, message: 'Too many verification-code requests from this network. Please try again later.' },
      { limiter: verificationResendRateLimiter, key: emailLimitKey('resend', email), maxHits: 3, windowMs: 60 * 60_000, message: 'Too many verification-code requests for this email. Please try again later.' }
    ]);
    if (!limited) return;

    const pending = db.findPendingRegistrationByEmail(email);
    const genericMessage = 'If an unverified registration exists for this email, a new code will be sent.';
    if (!pending || db.findUserByEmail(email)) {
      res.json({ success: true, message: genericMessage });
      return;
    }

    const now = Date.now();
    const lastSentAt = Date.parse(pending.lastSentAt);
    if (Number.isFinite(lastSentAt) && now - lastSentAt < EMAIL_OTP_RESEND_COOLDOWN_MS) {
      const retryAfter = Math.max(1, Math.ceil((EMAIL_OTP_RESEND_COOLDOWN_MS - (now - lastSentAt)) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ success: false, message: `Please wait ${retryAfter} seconds before requesting another code.`, retryAfterSeconds: retryAfter });
      return;
    }
    if (pending.resendCount >= MAX_EMAIL_OTP_RESENDS) {
      res.status(429).json({ success: false, message: 'The resend limit for this registration was reached. Please start registration again later.' });
      return;
    }

    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const updated = db.updatePendingRegistration(email, {
      otpHash: registrationOtpHash(email, otp),
      expiresAt: new Date(now + EMAIL_OTP_TTL_MS).toISOString(),
      lastSentAt: new Date(now).toISOString(),
      failedAttempts: 0,
      resendCount: pending.resendCount + 1
    });
    if (!updated) {
      res.json({ success: true, message: genericMessage });
      return;
    }

    const emailSent = await sendRegistrationOtpEmail(email, pending.name, otp);
    if (!emailSent) {
      db.savePendingRegistration(pending);
      res.status(503).json({ success: false, message: 'The verification email could not be sent. Please try again shortly.' });
      return;
    }
    res.json({ success: true, message: `A new verification code has been sent to ${email}.` });
  } catch (error: any) {
    console.error('ASTRO SIVAM: verification-code resend failed.', error?.name || 'Error');
    res.status(503).json({ success: false, message: 'The verification email could not be sent. Please try again shortly.' });
  }
});

// POST /api/auth/login (Customer Only)
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = await checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', String(Math.max(1, rateCheck.remainingSeconds || 60)));
      res.status(429).json({
        success: false,
        message: `Too many failed attempts. Login is temporarily blocked for security. Please try again in ${rateCheck.remainingSeconds} seconds.`
      });
      return;
    }

    let { email, password } = req.body;
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    let user = db.findUserByEmail(cleanEmail);
    if (!user) {
      await recordFailedAttempt(clientIp);
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    // Social accounts have no password login — they must use their provider.
    const provider = (user as any).authProvider || 'local';
    if (provider !== 'local') {
      await recordFailedAttempt(clientIp);
      res.status(401).json({
        success: false,
        message:
          provider === 'google'
            ? 'This account was created with Google Sign-In. Please use \"Continue with Google\" to sign in.'
            : provider === 'facebook'
              ? 'This account was created with Facebook Login. Please use Facebook to sign in.'
              : 'This account does not use a password. Please sign in with its original provider.'
      });
      return;
    }

    // Verify bcrypt password
    let isMatch = false;
    try {
      isMatch = bcrypt.compareSync(password, user.passwordHash);
    } catch (e) {
      isMatch = false;
    }

    if (!isMatch) {
      await recordFailedAttempt(clientIp);
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    if ((user.authProvider || 'local') === 'local' && !user.emailVerifiedAt) {
      res.status(403).json({
        success: false,
        status: 'email_verification_required',
        email: user.email,
        message: 'This local account must verify its email before signing in. Request a fresh registration verification code or contact support.'
      });
      return;
    }

    await recordSuccessfulAttempt(clientIp);
    db.updateUserLastLogin(user.id);

    // Keep every screen on the name saved in the website profile (never a
    // stale or Google/Facebook-derived one).
    const displayName = user.role === 'customer' ? db.healDisplayNames(user.id) : cleanDisplayName(user.name);
    db.logAudit(user.id, displayName, user.role, 'CUSTOMER_LOGIN', `Customer logged in from IP: ${clientIp}`);

    const token = createToken(user);
    const birthProfile = db.getBirthProfile(user.id);

    res.json({
      success: true,
      message: `Welcome back, ${displayName}!`,
      token,
      user: {
        id: user.id,
        name: displayName,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        country: user.country
      },
      birthProfile: birthProfile || null
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Login failed' });
  }
});

// POST /api/auth/admin-login (Admin Portal Only)
authRouter.post('/admin-login', async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = await checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', String(Math.max(1, rateCheck.remainingSeconds || 60)));
      res.status(429).json({
        success: false,
        message: `Too many administrative login attempts. Access blocked for ${rateCheck.remainingSeconds} seconds.`
      });
      return;
    }

    let { email, password } = req.body;
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      res.status(400).json({ success: false, message: 'Admin email and password are required.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = db.findUserByEmail(cleanEmail);

    if (!user) {
      await recordFailedAttempt(clientIp);
      res.status(401).json({ success: false, message: 'Invalid administrative credentials.' });
      return;
    }

    const adminProvider = (user as any).authProvider || 'local';
    if (adminProvider !== 'local') {
      await recordFailedAttempt(clientIp);
      res.status(401).json({ success: false, message: 'Invalid administrative credentials.' });
      return;
    }

    // Verify bcrypt password
    let isMatch = false;
    try {
      isMatch = bcrypt.compareSync(password, user.passwordHash);
    } catch (e) {
      isMatch = false;
    }

    if (!isMatch) {
      await recordFailedAttempt(clientIp);
      res.status(401).json({ success: false, message: 'Invalid administrative credentials.' });
      return;
    }

    // Administrator access is assigned only by explicit trusted provisioning.
    // A password match or an allow-listed email must never elevate a customer.
    if (user.role !== 'admin') {
      await recordFailedAttempt(clientIp);
      res.status(403).json({
        success: false,
        message: 'Access Denied: This portal is strictly restricted to ASTRO SIVAM administrators.'
      });
      return;
    }

    await recordSuccessfulAttempt(clientIp);
    db.updateUserLastLogin(user.id);
    db.logAudit(user.id, user.name, user.role, 'ADMIN_LOGIN', `Admin logged in to Admin Portal from IP: ${clientIp}`);

    const token = createToken(user);

    res.json({
      success: true,
      message: `Welcome back, ${user.name}! Admin session authenticated.`,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Admin login failed' });
  }
});

// Social-provider sign-in does not supply birth data; never invent a profile.

// POST /api/auth/facebook
// SECURITY: requires a Facebook access token. The id/email/name are read from
// the Graph API, never from the request body.
authRouter.post('/facebook', async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = await checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', String(Math.max(1, rateCheck.remainingSeconds || 60)));
      res.status(429).json({
        success: false,
        message: `Too many attempts. Please try again in ${rateCheck.remainingSeconds} seconds.`
      });
      return;
    }

    const { accessToken, access_token } = req.body || {};
    const settings = db.getSettings();
    if (settings.facebookLoginEnabled === false) {
      res.status(403).json({ success: false, message: 'Facebook sign-in is currently disabled.' });
      return;
    }
    const identity = await verifyFacebookLogin(
      accessToken || access_token,
      settings.facebookAppId,
      settings.facebookAppSecret
    );

    if (!identity) {
      await recordFailedAttempt(clientIp);
      res.status(401).json({
        success: false,
        message: 'Facebook sign-in could not be verified. Please try signing in with Facebook again.'
      });
      return;
    }

    const facebookSubject = String(identity.id || '').trim();
    if (!facebookSubject) {
      await recordFailedAttempt(clientIp);
      res.status(401).json({ success: false, message: 'Facebook did not provide a stable verified account identifier.' });
      return;
    }
    const cleanEmail = identity.email || `fb_${facebookSubject}@astrosivam.user`;
    const cleanName = cleanDisplayName(identity.name) || providerFallbackName(cleanEmail);
    let user = db.findUserByProviderSubject('facebook', facebookSubject);
    const emailAccount = db.findUserByEmail(cleanEmail);

    if (user && emailAccount && emailAccount.id !== user.id) {
      await recordFailedAttempt(clientIp);
      res.status(409).json({ success: false, message: 'This Facebook identity conflicts with an existing account. Automatic account linking is disabled; sign in using the existing account.' });
      return;
    }
    if (!user && emailAccount) {
      await recordFailedAttempt(clientIp);
      res.status(emailAccount.role === 'admin' ? 403 : 409).json({
        success: false,
        message: emailAccount.role === 'admin'
          ? 'Administrator accounts must use the dedicated admin sign-in.'
          : 'This email already belongs to an account. Automatic social account linking is disabled; sign in using the existing account.'
      });
      return;
    }
    if (user?.role === 'admin') {
      await recordFailedAttempt(clientIp);
      res.status(403).json({ success: false, message: 'Administrator accounts must use the dedicated admin sign-in.' });
      return;
    }

    if (!user) {
      user = db.createUser({
        name: cleanName,
        email: cleanEmail,
        mobile: '',
        passwordHash: bcrypt.hashSync(randomBytes(32).toString('hex'), 10),
        role: 'customer',
        country: 'Fiji',
        authProvider: 'facebook',
        providerSubject: facebookSubject,
        emailVerifiedAt: new Date().toISOString()
      });
    }

    await recordSuccessfulAttempt(clientIp);
    db.updateUserLastLogin(user.id);

    // The name the devotee saved on the website always wins; the Facebook
    // account name only seeds brand-new accounts (above). Never overwrite it.
    const displayName = db.healDisplayNames(user.id);
    db.logAudit(user.id, displayName, user.role, 'CUSTOMER_FACEBOOK_LOGIN', `Customer logged in via verified Facebook account (FB ID: ${identity.id})`);

    const token = createToken(user);
    const birthProfile = db.getBirthProfile(user.id);

    res.json({
      success: true,
      message: `Welcome, ${displayName}!`,
      token,
      user: {
        id: user.id,
        name: displayName,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        country: user.country
      },
      birthProfile: birthProfile || null
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Facebook authentication failed' });
  }
});

// POST /api/auth/google
// SECURITY: requires a Google ID token (`credential`) or OAuth2 `accessToken`.
// The e-mail is resolved from Google's own endpoints. Accepting a
// client-supplied e-mail previously let anyone sign in as any user, including
// admin@astrosivam.com.
authRouter.post('/google', async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = await checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', String(Math.max(1, rateCheck.remainingSeconds || 60)));
      res.status(429).json({
        success: false,
        message: `Too many attempts. Please try again in ${rateCheck.remainingSeconds} seconds.`
      });
      return;
    }

    const { credential, accessToken, access_token } = req.body || {};
    if (!credential && !accessToken && !access_token) {
      res.status(400).json({
        success: false,
        message: 'A verified Google credential is required. Please use the "Continue with Google" button.'
      });
      return;
    }

    const settings = db.getSettings();
    if (settings.googleLoginEnabled === false) {
      res.status(403).json({ success: false, message: 'Google sign-in is currently disabled.' });
      return;
    }
    const identity = await verifyGoogleLogin(credential, accessToken || access_token, settings.googleClientId);

    if (!identity) {
      await recordFailedAttempt(clientIp);
      res.status(401).json({
        success: false,
        message: 'Google sign-in could not be verified. Please try signing in with Google again.'
      });
      return;
    }

    const googleSubject = String(identity.sub || '').trim();
    if (!googleSubject) {
      await recordFailedAttempt(clientIp);
      res.status(401).json({ success: false, message: 'Google did not provide a stable verified account identifier.' });
      return;
    }
    const cleanEmail = identity.email;
    // Plain name only — provider tags like "(Google)" are stripped, and a
    // missing provider name falls back to the e-mail local part.
    const cleanName = cleanDisplayName(identity.name) || providerFallbackName(cleanEmail);

    let user = db.findUserByProviderSubject('google', googleSubject);
    const emailAccount = db.findUserByEmail(cleanEmail);

    if (user && emailAccount && emailAccount.id !== user.id) {
      await recordFailedAttempt(clientIp);
      res.status(409).json({ success: false, message: 'This Google identity conflicts with an existing account. Automatic account linking is disabled; sign in using the existing account.' });
      return;
    }
    if (!user && emailAccount) {
      await recordFailedAttempt(clientIp);
      res.status(emailAccount.role === 'admin' ? 403 : 409).json({
        success: false,
        message: emailAccount.role === 'admin'
          ? 'Administrator accounts must use the dedicated admin sign-in.'
          : 'This email already belongs to an account. Automatic social account linking is disabled; sign in using the existing account.'
      });
      return;
    }
    if (user?.role === 'admin') {
      await recordFailedAttempt(clientIp);
      res.status(403).json({ success: false, message: 'Administrator accounts must use the dedicated admin sign-in.' });
      return;
    }

    if (!user) {
      user = db.createUser({
        name: cleanName,
        email: cleanEmail,
        mobile: '',
        passwordHash: bcrypt.hashSync(randomBytes(32).toString('hex'), 10),
        role: 'customer',
        country: 'Fiji',
        authProvider: 'google',
        providerSubject: googleSubject,
        emailVerifiedAt: new Date().toISOString()
      });
    }

    await recordSuccessfulAttempt(clientIp);
    db.updateUserLastLogin(user.id);

    // The name the devotee saved on the website always wins; the Google
    // account name only seeds brand-new accounts (above). Never overwrite it.
    const displayName = db.healDisplayNames(user.id);
    db.logAudit(user.id, displayName, user.role, 'CUSTOMER_GOOGLE_LOGIN', `Customer logged in via verified Google account (${user.email})`);

    const token = createToken(user);
    const birthProfile = db.getBirthProfile(user.id);

    res.json({
      success: true,
      message: `Welcome, ${displayName}!`,
      token,
      user: {
        id: user.id,
        name: displayName,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        country: user.country
      },
      birthProfile: birthProfile || null
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Google authentication failed' });
  }
});

// GET /api/auth/me
authRouter.get('/me', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }
  // Always present the name saved in the website profile.
  const displayName = user.role === 'customer' ? db.healDisplayNames(user.id) : cleanDisplayName(user.name) || user.name;
  const birthProfile = db.getBirthProfile(user.id);
  res.json({
    success: true,
    user: {
      id: user.id,
      name: displayName,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      country: user.country
    },
    birthProfile: birthProfile || null
  });
});
