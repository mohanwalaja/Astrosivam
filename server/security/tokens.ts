/**
 * ASTRO SIVAM - Signed bearer tokens & server-side social login verification
 * (Node/Express backend — mirrors the hardening already applied to /api/config.php)
 *
 * SECURITY MODEL
 *  - Every bearer token is "<base64url(payload)>.<hex hmac-sha256>".
 *  - Unsigned / tampered / expired tokens are ALWAYS rejected.
 *  - Google & Facebook identities are resolved from the provider's own
 *    endpoints; a client-supplied `email` is never trusted.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

let cachedSecret: string | null = null;

/**
 * Resolve the HMAC signing key.
 *  1) APP_SECRET_KEY env var (>= 32 chars) — the recommended production path.
 *  2) Otherwise generate a random 64-hex key once and persist it to
 *     data/app_secret_key.txt (git-ignored) so restarts keep sessions valid.
 *  3) If the file cannot be written, keep a random in-memory key. Sessions are
 *     invalidated on restart, but a guessable key is never used.
 */
export function getAppSecretKey(): string {
  if (cachedSecret) return cachedSecret;

  const envKey = process.env.APP_SECRET_KEY;
  if (typeof envKey === 'string' && envKey.trim().length >= 32) {
    cachedSecret = envKey.trim();
    return cachedSecret;
  }

  const configuredDataDir = process.env.ASTROSIVAM_DATA_DIR?.trim();
  const keyDir = configuredDataDir
    ? path.resolve(configuredDataDir)
    : path.resolve(process.cwd(), 'data');
  const keyFile = path.join(keyDir, 'app_secret_key.txt');

  try {
    if (fs.existsSync(keyFile)) {
      const stored = fs.readFileSync(keyFile, 'utf-8').trim();
      if (stored.length >= 32) {
        cachedSecret = stored;
        return cachedSecret;
      }
    }
  } catch {
    /* fall through to generation */
  }

  const generated = crypto.randomBytes(32).toString('hex');
  try {
    if (!fs.existsSync(keyDir)) fs.mkdirSync(keyDir, { recursive: true });
    fs.writeFileSync(keyFile, generated, { mode: 0o600 });
  } catch {
    console.error(
      'ASTRO SIVAM SECURITY WARNING: APP_SECRET_KEY is not set and the generated key could not be persisted. ' +
        'Sessions will be invalidated on restart. Set APP_SECRET_KEY to a long random string.'
    );
  }
  cachedSecret = generated;
  return cachedSecret;
}

function b64urlEncode(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64url');
}

function b64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf-8');
}

function sign(payloadB64: string): string {
  return crypto.createHmac('sha256', getAppSecretKey()).update(payloadB64).digest('hex');
}

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export function createSignedToken(user: { id: string; email: string; role: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS
  };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Verifies signature + expiry. Returns the payload, or null when the token is
 * missing, unsigned, tampered with, or expired.
 *
 * NOTE: unsigned base64 payloads are NEVER accepted. The previous
 * implementation decoded any base64 JSON blob, which let anyone mint an
 * `{"role":"admin"}` token and take over the whole admin portal.
 */
export function verifySignedToken(token: string | null | undefined): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;

  const lastDot = token.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === token.length - 1) return null;

  const payloadB64 = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);

  const expected = sign(payloadB64);
  const sigBuf = Buffer.from(signature, 'utf-8');
  const expBuf = Buffer.from(expected, 'utf-8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  let payload: any;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64));
  } catch {
    return null;
  }

  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.id !== 'string' || !payload.id || typeof payload.email !== 'string' || !payload.email) return null;
  if (typeof payload.role !== 'string' || !payload.role) return null;
  if (!Number.isFinite(Number(payload.iat)) || !Number.isFinite(Number(payload.exp))) return null;
  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.exp) <= now || Number(payload.iat) > now + 60) return null;

  return payload as TokenPayload;
}

/* ------------------------------------------------------------------ */
/* Display-name helpers                                                */
/* ------------------------------------------------------------------ */

/**
 * Strips legacy provider tags from a person's name so the site always shows
 * the plain, actual name — e.g. "Ramesh Chand (Google)" -> "Ramesh Chand".
 */
export function cleanDisplayName(name?: string | null): string {
  let value = String(name ?? '').trim();
  if (!value) return '';
  // "(Google)", "[FB]", "(Facebook account)" style suffixes
  value = value.replace(/\s*[([{]\s*(google|facebook|fb)(\s+(account|user|login))?\s*[)\]}]\s*$/gi, '');
  // "- Google", "— Facebook", "| fb" style suffixes
  value = value.replace(/\s*[-–—|·]\s*(google|facebook|fb)\s*$/gi, '');
  // "via Google" style suffixes
  value = value.replace(/\s+via\s+(google|facebook|fb)\s*$/gi, '');
  // Any leftover trailing separators from the strips above
  value = value.replace(/[\s\-–—|·.,]+$/, '');
  return value.trim();
}

/** True when a stored name is empty or just a provider placeholder ("Google User"). */
export function isPlaceholderDisplayName(name?: string | null): boolean {
  const value = cleanDisplayName(name);
  return value === '' || /^(google|facebook|fb)(\s*(user|customer|member|account))?$/i.test(value);
}

/**
 * Builds a human fallback name from the e-mail (mohanwalaja@gmail.com ->
 * "Mohanwalaja") so a missing provider name never renders as "Google User".
 */
export function providerFallbackName(email?: string | null): string {
  const local = String(email ?? '').split('@')[0].trim();
  const words = local.replace(/[._\-+0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const parts = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return parts.length ? parts.join(' ') : 'User';
}

/**
 * Resolves the one true display name for a customer: the name the devotee
 * saved in their website profile is authoritative, then the account name,
 * then a friendly fallback. Never overwrites a saved name with the
 * Google/Facebook account name.
 */
export function resolveDisplayName(
  accountName?: string | null,
  profileName?: string | null,
  email?: string | null
): string {
  const bpName = cleanDisplayName(profileName);
  if (bpName && !isPlaceholderDisplayName(profileName)) return bpName;
  const accName = cleanDisplayName(accountName);
  if (accName && !isPlaceholderDisplayName(accountName)) return accName;
  return providerFallbackName(email);
}

/* ------------------------------------------------------------------ */
/* Social login verification (identity always comes from the provider) */
/* ------------------------------------------------------------------ */

async function httpGetJson(url: string, timeoutMs = 8000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface VerifiedGoogleIdentity {
  sub: string | null;
  email: string;
  name: string;
}

/**
 * Verifies a Google sign-in server-side. Accepts a GSI ID token
 * (`credential`, a signed JWT) or an OAuth2 access token. The e-mail is read
 * from Google's response only — a client-supplied e-mail is ignored, because
 * trusting it allowed anyone to sign in as admin@astrosivam.com.
 *
 * A configured client ID is mandatory. Both audience and verified e-mail
 * checks apply to ID tokens and access-token userinfo flows.
 */
export async function verifyGoogleLogin(
  credential?: string,
  accessToken?: string,
  configuredClientId?: string
): Promise<VerifiedGoogleIdentity | null> {
  const expectedAudience = (configuredClientId || process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!expectedAudience) return null;

  const audienceMatches = (info: any) => {
    const audience = info?.aud ?? info?.issued_to ?? info?.audience;
    const matches = Array.isArray(audience)
      ? audience.includes(expectedAudience)
      : String(audience || '') === expectedAudience;
    return matches && (!info?.azp || String(info.azp) === expectedAudience);
  };
  const hasVerifiedEmail = (value: unknown) => value === true || value === 'true';

  if (credential) {
    const info = await httpGetJson(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential)
    );
    if (info && info.email && audienceMatches(info) && hasVerifiedEmail(info.email_verified)) {
      return {
        sub: info.sub || null,
        email: String(info.email).toLowerCase().trim(),
        name: cleanDisplayName(info.name)
      };
    }
    // No local JWT decode fallback: the signature cannot be checked without
    // Google's public keys, and an unsigned fallback allows login forgery.
  }

  if (accessToken) {
    const tokenInfo = await httpGetJson(
      'https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(accessToken)
    );
    if (!tokenInfo || !audienceMatches(tokenInfo)) return null;
    const info = await httpGetJson(
      'https://www.googleapis.com/oauth2/v3/userinfo?access_token=' + encodeURIComponent(accessToken)
    );
    if (info && info.email && hasVerifiedEmail(info.email_verified)) {
      return {
        sub: info.sub || null,
        email: String(info.email).toLowerCase().trim(),
        name: cleanDisplayName(info.name)
      };
    }
  }

  return null;
}

export interface VerifiedFacebookIdentity {
  id: string;
  email: string | null;
  name: string;
}

/**
 * Verifies that a Facebook user token is valid for this application's own
 * App ID before resolving the identity. This rejects tokens minted for some
 * unrelated app, even if Graph API /me would otherwise return a real person.
 */
export async function verifyFacebookLogin(
  accessToken?: string,
  configuredAppId?: string,
  configuredAppSecret?: string
): Promise<VerifiedFacebookIdentity | null> {
  const appId = String(configuredAppId || process.env.FACEBOOK_APP_ID || '').trim();
  const appSecret = String(configuredAppSecret || process.env.FACEBOOK_APP_SECRET || '').trim();
  if (!accessToken || !appId || !appSecret || appSecret.includes('•')) return null;

  const debugInfo = await httpGetJson(
    'https://graph.facebook.com/debug_token?input_token=' + encodeURIComponent(accessToken) +
      '&access_token=' + encodeURIComponent(`${appId}|${appSecret}`)
  );
  const tokenData = debugInfo?.data;
  if (!tokenData || tokenData.is_valid !== true || String(tokenData.app_id || '') !== appId || !tokenData.user_id) return null;
  if (Number(tokenData.expires_at) > 0 && Number(tokenData.expires_at) <= Math.floor(Date.now() / 1000)) return null;

  const appSecretProof = crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');
  const info = await httpGetJson(
    'https://graph.facebook.com/me?fields=id,name,email&access_token=' + encodeURIComponent(accessToken) +
      '&appsecret_proof=' + encodeURIComponent(appSecretProof)
  );
  if (!info?.id || String(info.id) !== String(tokenData.user_id)) return null;
  return {
    id: String(info.id),
    email: info.email ? String(info.email).toLowerCase().trim() : null,
    name: cleanDisplayName(info.name)
  };
}
