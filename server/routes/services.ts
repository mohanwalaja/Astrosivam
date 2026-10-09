import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db, Order } from '../db/store.js';
import { requireAuth, getAuthenticatedUser } from './auth.js';
import { computeOrderReportResult } from '../astrology/orderReportResult.js';
import { RAHU_NODE_TYPE } from '../astrology/astronomy.js';
import {
  generateHoroscopePdf,
  generateWeddingMatchPdf,
  generateBabyNamingPdf,
  generateMuhurthamPdf,
  generateInvoicePdf,
  generateFamilyInvoicePdf
} from '../astrology/pdfGenerator.js';
import { sendContactInquiryEmail, sendOrderApprovalEmail, sendFamilyOrderApprovalEmail } from '../services/emailService.js';
import { clearStagedDocs, decodePdfPayload, loadStagedDocs, stageDoc, StagedDocInput } from '../services/stagedDocs.js';
import { sendChatOrderAlerts } from '../services/chatAlertService.js';
import { resolveClientIp } from '../security/clientIp.js';
import { routeParam } from './params.js';
import { hasConfiguredSecret } from '../security/settingsSecrets.js';
import { createRateLimiter } from '../security/rateLimit.js';
import { normalizeReportLanguage } from '../../src/services/reportLanguage.js';
import { getServicePrices, resolveOrderCurrency } from '../../src/services/pricing.js';
import { normalizePaymentMethod } from '../services/paymentMethods.js';
import { MAX_FAMILY_ORDER_ITEMS } from '../../src/services/familyOrderLimits.js';
import {
  MULTI_PERSON_MAX_ITEMS,
  MULTI_PERSON_MAX_PEOPLE,
  validateMultiPersonRequest
} from '../services/multiPersonOrders.js';
import { hasValidBirthDetails } from '../services/birthDetails.js';

export const servicesRouter = Router();
// Shared when REDIS_URL is configured; in-process otherwise.
const publicServiceRateLimiter = createRateLimiter({ namespace: 'astrosivam:services' });

function rejectRateLimit(res: Response, retryAfterSeconds: number | undefined, message: string): void {
  const retry = Math.max(1, retryAfterSeconds || 60);
  res.setHeader('Retry-After', String(retry));
  res.status(429).json({ success: false, message, retryAfterSeconds: retry });
}

async function enforcePaymentRateLimit(req: Request, res: Response, userId: string, operation: 'create' | 'verify'): Promise<boolean> {
  const clientIp = resolveClientIp(req);
  const perUser = await publicServiceRateLimiter.consume(`payment-${operation}:user:${userId}`, operation === 'create' ? 8 : 20, 10 * 60_000);
  const perIp = await publicServiceRateLimiter.consume(`payment-${operation}:ip:${clientIp}`, operation === 'create' ? 20 : 40, 10 * 60_000);
  if (!perUser.allowed || !perIp.allowed) {
    rejectRateLimit(
      res,
      Math.max(perUser.retryAfterSeconds || 0, perIp.retryAfterSeconds || 0),
      'Too many payment requests. Please retry after the rate limit expires.'
    );
    return false;
  }
  return true;
}

// Anonymous, privacy-limited client error reporting. Never include request payloads or user data.
servicesRouter.post('/client-error', async (req: Request, res: Response) => {
  const rate = await publicServiceRateLimiter.consume(`client-error:${resolveClientIp(req)}`, 20, 60_000);
  if (!rate.allowed) {
    rejectRateLimit(res, rate.retryAfterSeconds, 'Too many error reports. Please retry shortly.');
    return;
  }
  const message = typeof req.body?.message === 'string' ? req.body.message.slice(0, 500) : 'Request failed';
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.slice(0, 250) : 'unknown';
  const status = Number(req.body?.status) || undefined;
  db.addClientError({ message, endpoint, status });
  res.json({ success: true });
});

// GET /api/services/settings (Public view of settings & pricing)
servicesRouter.get('/settings', (req: Request, res: Response) => {
  const settings: any = { ...db.getPublicSettings() };
  // FREE BETA RULE — exactly ONE free report per IP address: tell this client
  // whether its free chart is still unused, so the family tray can price the
  // FIRST chart free and every additional chart at full price.
  settings.betaFreeChartAvailable =
    settings?.serviceMode === 'FREE_BETA' && db.getBetaIpOrderCount(resolveClientIp(req)) < 1;
  res.json({
    success: true,
    settings
  });
});

// GET /api/services/team (Public view of active Astrology Team members)
servicesRouter.get('/team', (_req: Request, res: Response) => {
  const team = db.getTeamMembers(true);
  res.json({ success: true, count: team.length, team });
});

// GET /api/services/profile (Get authenticated customer's saved birth profile)
servicesRouter.get('/profile', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const profile = db.getBirthProfile(user.id);
  res.json({
    success: true,
    profile: profile || null
  });
});

// POST /api/services/profile (Save/update customer birth profile)
servicesRouter.post('/profile', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { name, dob, tob, birthPlace, country, latitude, longitude, timezoneOffsetHours, gender } = req.body;

    if (!name || !hasValidBirthDetails({ dob, tob, birthPlace, latitude, longitude, timezoneOffsetHours })) {
      res.status(400).json({ success: false, message: 'Name, a valid past date of birth, a valid 24-hour birth time, and a verified birth place with coordinates and time zone are required.' });
      return;
    }

    if (!hasValidLocation({ latitude, longitude, timezoneOffsetHours })) {
      res.status(400).json({
        success: false,
        message: 'Birth place coordinates/timezone are missing. Please select the birth place from the location search, map, or GPS so it is geocoded correctly.'
      });
      return;
    }

    db.saveBirthProfile({
      userId: user.id,
      name: name.trim(),
      dob,
      tob,
      birthPlace: birthPlace.trim(),
      country: typeof country === 'string' ? country.trim() : '',
      latitude: Number(latitude),
      longitude: Number(longitude),
      timezoneOffsetHours: Number(timezoneOffsetHours),
      gender: gender || 'M',
      updatedAt: new Date().toISOString()
    });

    // The name the devotee saves in their website profile is their real name:
    // mirror it onto the account so the welcome message, navbar and dashboard
    // all show the edited name — and never a stale one.
    db.updateUserName(user.id, name.trim());

    res.json({
      success: true,
      message: 'Birth profile saved successfully for automatic reuse across all ASTRO SIVAM services!',
      profile: db.getBirthProfile(user.id)
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to save birth profile' });
  }
});

// POST /api/services/calculate-preview (Compute astrology on backend securely)
servicesRouter.post('/calculate-preview', async (req: Request, res: Response) => {
  const rate = await publicServiceRateLimiter.consume(`calculate-preview:${resolveClientIp(req)}`, 20, 60_000);
  if (!rate.allowed) {
    rejectRateLimit(res, rate.retryAfterSeconds, 'Too many calculation requests. Please retry shortly.');
    return;
  }

  try {
    const { serviceType, payload } = req.body;

    if (!serviceType || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      res.status(400).json({ success: false, message: 'Service type and payload required.' });
      return;
    }
    if (!['BIRTH_JATHAGAM', 'MARRIAGE_COMPATIBILITY', 'BABY_NAMING', 'MUHURTHAM'].includes(serviceType)) {
      res.status(400).json({ success: false, message: `Unknown service type: ${serviceType}` });
      return;
    }
    if (serviceType === 'MUHURTHAM') {
      if (!hasValidBirthDetails(payload)) {
        res.status(400).json({ success: false, message: 'A valid birth date, 24-hour birth time and verified birth place with coordinates are required for Janma Nakshatra and Rasi.' });
        return;
      }
      if (!hasValidMuhurthamLocation(payload)) {
        res.status(400).json({ success: false, message: 'Please select a separate Muhurtham location with coordinates and a time zone for local dates and times.' });
        return;
      }
    }

    try {
      // Use the same saved-input dispatcher as official reports. It validates
      // both marriage partners (including legacy flat payloads) and regenerates
      // Muhurtham scans when their saved context is stale.
      const result = computeOrderReportResult({
        serviceType,
        inputPayload: payload,
        userName: payload.name || payload.devoteeName || 'User'
      } as unknown as Order);
      if (!result) {
        res.status(400).json({ success: false, message: `Unknown service type: ${serviceType}` });
        return;
      }
      // The Node engine always uses the osculating (true) lunar node; declare it
      // like the PHP API does (ASTRO_RAHU_NODE_TYPE) so reports can show which
      // Rahu/Ketu convention produced the chart.
      res.json({ success: true, nodeType: RAHU_NODE_TYPE, result });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'The report could not be calculated from these saved inputs.'
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Calculation error' });
  }
});

// Online payment sessions are deliberately provider-specific and fail closed.
const SUPPORTED_ONLINE_METHODS = new Set(['GPAY', 'UPI', 'PAYPAL']);
const ONLINE_SESSION_TTL_MINUTES = 15;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function timingSafeHexEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function configuredSecret(value: unknown): value is string {
  return hasConfiguredSecret(value);
}

async function getPayPalAccessToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!tokenRes.ok) throw new Error(`PayPal authentication failed (${tokenRes.status}).`);
  const tokenData: any = await tokenRes.json();
  if (!tokenData?.access_token) throw new Error('PayPal did not return an access token.');
  return tokenData.access_token;
}

function extractPayPalCapture(orderData: any): any | null {
  for (const unit of orderData?.purchase_units || []) {
    for (const capture of unit?.payments?.captures || []) {
      if (capture?.status === 'COMPLETED') return capture;
    }
  }
  return null;
}

function hasValidLocation(input: any): boolean {
  if (!input || typeof input !== 'object') return false;
  const isNumeric = (value: any) => (typeof value === 'number' || typeof value === 'string') &&
    !(typeof value === 'string' && value.trim() === '') && Number.isFinite(Number(value));
  if (!isNumeric(input.latitude) || !isNumeric(input.longitude) || !isNumeric(input.timezoneOffsetHours)) return false;
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  const offset = Number(input.timezoneOffsetHours);
  return latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180 &&
    offset >= -14 && offset <= 14;
}

function hasValidMuhurthamLocation(input: any): boolean {
  return Boolean(typeof input?.muhurthamPlace === 'string' && input.muhurthamPlace.trim()) &&
    hasValidLocation({
      latitude: input?.muhurthamLatitude,
      longitude: input?.muhurthamLongitude,
      timezoneOffsetHours: input?.muhurthamTimezoneOffsetHours
    });
}

// POST /api/services/payment/create-session
servicesRouter.post('/payment/create-session', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!(await enforcePaymentRateLimit(req, res, user.id, 'create'))) return;
    const { paymentMethod, amount, currency, description } = req.body || {};
    const method = normalizePaymentMethod(paymentMethod);
    const numAmount = roundMoney(Number(amount));
    const settings: any = db.getSettings();

    if (!SUPPORTED_ONLINE_METHODS.has(method)) {
      res.status(400).json({ success: false, message: 'This payment provider has no verified online integration. Use manual payment instead.' });
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0 || numAmount > 1_000_000) {
      res.status(400).json({ success: false, message: 'A valid payment amount is required to start an online payment session.' });
      return;
    }

    const randSuffix = crypto.randomBytes(12).toString('hex').toUpperCase();
    const requestedDescription = typeof description === 'string' ? description.slice(0, 180) : 'ASTRO SIVAM Vedic Astrology Report';

    if (method === 'GPAY' || method === 'UPI') {
      const provider = String(settings.indiaGpayOnlineProvider || '').toLowerCase();
      const keyId = String(settings.indiaGpayKeyId || '').trim();
      const keySecret = String(settings.indiaGpayKeySecret || '').trim();
      if (settings.indiaGpayPaymentMode !== 'online' || provider !== 'razorpay' || !keyId.startsWith('rzp_') || !configuredSecret(keySecret)) {
        res.status(503).json({ success: false, message: 'Verified UPI checkout is not configured. Please use the manual receipt option.' });
        return;
      }
      if (currency !== 'INR') {
        res.status(400).json({ success: false, message: 'Google Pay / UPI online checkout must be paid in INR.' });
        return;
      }

      const gatewayReceipt = `ASTRO-${Date.now().toString(36).toUpperCase()}-${randSuffix.slice(0, 8)}`;
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: Math.round(numAmount * 100), currency: 'INR', receipt: gatewayReceipt })
      });
      if (!rzpRes.ok) {
        res.status(502).json({ success: false, message: 'The UPI gateway could not create a payment order. No payment session was created.' });
        return;
      }
      const rzpData: any = await rzpRes.json();
      if (!rzpData?.id) {
        res.status(502).json({ success: false, message: 'The UPI gateway returned no payment order. Please use manual payment.' });
        return;
      }

      const intent = db.createPaymentIntent({
        userId: user.id,
        paymentMethod: 'GPAY',
        provider: 'razorpay',
        amount: numAmount,
        currency: 'INR',
        gatewayOrderId: rzpData.id,
        expiresInMinutes: ONLINE_SESSION_TTL_MINUTES
      });
      res.json({
        success: true,
        session: {
          sessionId: intent.id,
          paymentIntentId: intent.id,
          paymentMethod: 'GPAY',
          mode: 'online',
          provider: 'razorpay',
          environment: settings.indiaGpayEnvironment || 'sandbox',
          amount: numAmount,
          currency: 'INR',
          gatewayOrderId: rzpData.id,
          keyId,
          merchantId: settings.indiaGpayMerchantId || undefined,
          merchantName: settings.indiaGpayName || 'ASTRO SIVAM',
          upiId: settings.indiaGpayUpiId || undefined,
          upiUri: undefined,
          description: requestedDescription
        }
      });
      return;
    }

    const clientId = String(settings.paypalClientId || '').trim();
    const clientSecret = String(settings.paypalSecret || settings.paypalClientSecret || '').trim();
    const env = String(settings.paypalMode || 'sandbox').toLowerCase();
    if (settings.paypalPaymentMode !== 'online' || !clientId || !configuredSecret(clientSecret)) {
      res.status(503).json({ success: false, message: 'Verified PayPal checkout is not configured. Please use the manual receipt option.' });
      return;
    }
    if (currency !== 'USD') {
      res.status(400).json({ success: false, message: 'PayPal / Card online checkout must be paid in USD.' });
      return;
    }

    const baseUrl = env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    const accessToken = await getPayPalAccessToken(baseUrl, clientId, clientSecret);
    const localReference = `ASTRO-${Date.now().toString(36).toUpperCase()}-${randSuffix.slice(0, 8)}`;
    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: localReference,
          description: requestedDescription,
          amount: { currency_code: 'USD', value: numAmount.toFixed(2) }
        }]
      })
    });
    if (!orderRes.ok) {
      res.status(502).json({ success: false, message: 'PayPal could not create a payment order. No payment session was created.' });
      return;
    }
    const orderData: any = await orderRes.json();
    const gatewayOrderId = String(orderData?.id || '');
    const approvalUrl = (orderData?.links || []).find((link: any) => link.rel === 'approve')?.href;
    if (!gatewayOrderId || !approvalUrl) {
      res.status(502).json({ success: false, message: 'PayPal returned an incomplete payment order. Please use manual payment.' });
      return;
    }

    const intent = db.createPaymentIntent({
      userId: user.id,
      paymentMethod: 'PAYPAL',
      provider: 'paypal_rest',
      amount: numAmount,
      currency: 'USD',
      gatewayOrderId,
      expiresInMinutes: ONLINE_SESSION_TTL_MINUTES
    });
    res.json({
      success: true,
      session: {
        sessionId: intent.id,
        paymentIntentId: intent.id,
        paymentMethod: 'PAYPAL',
        mode: 'online',
        provider: 'paypal_rest',
        environment: env,
        amount: numAmount,
        currency: 'USD',
        gatewayOrderId,
        clientId,
        paypalEmail: settings.paypalEmail || undefined,
        businessName: settings.paypalBusinessName || 'ASTRO SIVAM GLOBAL SERVICES',
        approvalUrl,
        description: requestedDescription
      }
    });
  } catch (error: any) {
    res.status(502).json({ success: false, message: error.message || 'The payment provider could not initialize a verified session.' });
  }
});

// POST /api/services/payment/verify-session
servicesRouter.post('/payment/verify-session', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!(await enforcePaymentRateLimit(req, res, user.id, 'verify'))) return;
    const { sessionId, paymentIntentId, paymentMethod, gatewayOrderId, gatewayPaymentId, gatewaySignature, payerAccount } = req.body || {};
    const method = normalizePaymentMethod(paymentMethod);
    const cleanSessionId = typeof paymentIntentId === 'string' && paymentIntentId.trim()
      ? paymentIntentId.trim()
      : (typeof sessionId === 'string' ? sessionId.trim() : '');
    const cleanOrderId = typeof gatewayOrderId === 'string' ? gatewayOrderId.trim() : '';
    const cleanPaymentId = typeof gatewayPaymentId === 'string' ? gatewayPaymentId.trim() : '';
    const cleanSignature = typeof gatewaySignature === 'string' ? gatewaySignature.trim() : '';
    const settings: any = db.getSettings();

    if (!cleanSessionId || !cleanOrderId || !cleanPaymentId || !SUPPORTED_ONLINE_METHODS.has(method)) {
      res.status(400).json({ success: false, verified: false, message: 'A complete provider payment proof is required.' });
      return;
    }
    const intent = db.getPaymentIntentForUser(cleanSessionId, user.id);
    if (!intent || intent.paymentMethod !== (method === 'UPI' ? 'GPAY' : method) || intent.gatewayOrderId !== cleanOrderId) {
      res.status(404).json({ success: false, verified: false, message: 'Payment session is invalid, expired, or does not belong to this account.' });
      return;
    }
    if (intent.status === 'EXPIRED') {
      res.status(410).json({ success: false, verified: false, message: 'Payment session has expired. Start a new checkout.' });
      return;
    }
    if (intent.status === 'FAILED') {
      res.status(400).json({ success: false, verified: false, message: 'Payment session is no longer valid.' });
      return;
    }
    if (intent.status === 'CONSUMED') {
      res.status(409).json({ success: false, verified: false, message: 'This payment session has already been used.' });
      return;
    }

    let verifiedGatewayPaymentId = cleanPaymentId;
    if (method === 'GPAY' || method === 'UPI') {
      const keyId = String(settings.indiaGpayKeyId || '').trim();
      const keySecret = String(settings.indiaGpayKeySecret || '').trim();
      if (intent.provider !== 'razorpay' || !keyId.startsWith('rzp_') || !configuredSecret(keySecret) || !cleanSignature) {
        res.status(400).json({ success: false, verified: false, message: 'Razorpay payment signature is required.' });
        return;
      }
      const expectedSignature = crypto.createHmac('sha256', keySecret).update(`${cleanOrderId}|${cleanPaymentId}`).digest('hex');
      if (!timingSafeHexEqual(expectedSignature, cleanSignature)) {
        res.status(400).json({ success: false, verified: false, message: 'Online payment signature verification failed.' });
        return;
      }
      const paymentRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(cleanPaymentId)}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` }
      });
      if (!paymentRes.ok) {
        res.status(502).json({ success: false, verified: false, message: 'Razorpay payment status could not be confirmed.' });
        return;
      }
      const paymentData: any = await paymentRes.json();
      if (paymentData.order_id !== cleanOrderId || paymentData.status !== 'captured' || paymentData.captured !== true ||
          Number(paymentData.amount) !== Math.round(intent.amount * 100) || paymentData.currency !== intent.currency) {
        res.status(400).json({ success: false, verified: false, message: 'Razorpay payment does not match this order amount or currency.' });
        return;
      }
    } else {
      const clientId = String(settings.paypalClientId || '').trim();
      const clientSecret = String(settings.paypalSecret || settings.paypalClientSecret || '').trim();
      const env = String(settings.paypalMode || 'sandbox').toLowerCase();
      if (intent.provider !== 'paypal_rest' || !clientId || !configuredSecret(clientSecret)) {
        res.status(503).json({ success: false, verified: false, message: 'PayPal server verification is not configured.' });
        return;
      }
      const baseUrl = env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
      const accessToken = await getPayPalAccessToken(baseUrl, clientId, clientSecret);
      const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(cleanOrderId)}/capture`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `capture-${intent.id}`
        },
        body: '{}'
      });
      let orderData: any;
      if (captureRes.ok) {
        orderData = await captureRes.json();
      } else {
        const lookupRes = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(cleanOrderId)}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!lookupRes.ok) {
          res.status(502).json({ success: false, verified: false, message: 'PayPal capture status could not be confirmed.' });
          return;
        }
        orderData = await lookupRes.json();
      }
      const capture = extractPayPalCapture(orderData);
      const purchase = orderData?.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
      if (!capture || capture.status !== 'COMPLETED' || !purchase || purchase.currency_code !== intent.currency ||
          Number(purchase.value).toFixed(2) !== intent.amount.toFixed(2)) {
        res.status(400).json({ success: false, verified: false, message: 'PayPal payment is not captured for the expected amount and currency.' });
        return;
      }
      verifiedGatewayPaymentId = String(capture.id || cleanPaymentId);
    }

    const prefix = method === 'GPAY' || method === 'UPI' ? 'GPAY' : 'PAYPAL';
    const paymentReference = `${prefix}-ONL-${verifiedGatewayPaymentId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const captured = db.capturePaymentIntent({
      id: intent.id,
      userId: user.id,
      gatewayOrderId: cleanOrderId,
      gatewayPaymentId: verifiedGatewayPaymentId,
      paymentReference,
      payerAccount: typeof payerAccount === 'string' ? payerAccount.slice(0, 191) : undefined
    });
    if (!captured) {
      res.status(409).json({ success: false, verified: false, message: 'Payment was already consumed or could not be recorded safely.' });
      return;
    }

    res.json({
      success: true,
      verified: true,
      paymentMethod: prefix,
      sessionId: intent.id,
      paymentIntentId: intent.id,
      gatewayOrderId: cleanOrderId,
      paymentReference,
      verifiedAt: captured.updatedAt,
      message: `Online ${prefix === 'GPAY' ? 'Google Pay / UPI' : 'PayPal'} payment captured and verified.`
    });
  } catch (error: any) {
    res.status(502).json({ success: false, verified: false, message: error.message || 'Online payment verification failed.' });
  }
});

// POST /api/services/order (Submit an order)
servicesRouter.post('/order', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isAdmin = user.role === 'admin';
    const { serviceType, language, country, billingCountry, currency, paymentMethod, paymentReference, paymentIntentId: submittedPaymentIntentId, inputPayload, saveAsProfile } = req.body;
    // Only the persisted, authenticated role grants no-charge ordering.
    // Ignore saved/stale payment data for admins; never bind or consume it.
    const cleanPaymentReference = !isAdmin && typeof paymentReference === 'string' ? paymentReference.trim() : '';
    const paymentIntentId = isAdmin ? undefined : submittedPaymentIntentId;
    const normalizedPaymentMethod = isAdmin ? 'NONE' : normalizePaymentMethod(paymentMethod || 'NONE');

    if (!serviceType || !inputPayload) {
      res.status(400).json({ success: false, message: 'Service type and input details are required.' });
      return;
    }
    if (!['NONE', 'MPAISA', 'MYCASH', 'PAYPAL', 'GPAY', 'UPI', 'CARD'].includes(normalizedPaymentMethod)) {
      res.status(400).json({ success: false, message: 'Unsupported payment method.' });
      return;
    }

    // Validate that birth coordinates/timezone were actually captured (not left undefined),
    // so we never silently fall back to Fiji defaults for a non-Fiji birth place.
    /**
     * A Subha Muhurtham line requires the birth place (for Janma Nakshatra / Rasi)
     * and a separate residence / ceremony location (for local calendar dates and
     * times). A browser scan can be sent at order time, but approval rebuilds it
     * from these locations.
     */
    const hasMuhurthamScan = (p: any) =>
      (Array.isArray(p?.muhurthamScan?.months) && p.muhurthamScan.months.length > 0) ||
      (Array.isArray(p?.months) && p.months.length > 0);

    if (serviceType === 'BIRTH_JATHAGAM' || serviceType === 'BABY_NAMING') {
      if (!hasValidBirthDetails(inputPayload)) {
        res.status(400).json({
          success: false,
          message: 'A valid past birth date, 24-hour birth time, birth place, coordinates and time zone are required. Please verify the birth details and select the place from search, map or GPS.'
        });
        return;
      }
    } else if (serviceType === 'MARRIAGE_COMPATIBILITY') {
      if (!hasValidBirthDetails(inputPayload.bride) || !hasValidBirthDetails(inputPayload.groom)) {
        res.status(400).json({
          success: false,
          message: 'Both bride and groom need valid past birth dates, 24-hour birth times, birth places, coordinates and time zones. Please verify both sets of birth details.'
        });
        return;
      }
    }
    else if (serviceType === 'MUHURTHAM') {
      if (!hasValidBirthDetails(inputPayload)) {
        res.status(400).json({
          success: false,
          message: 'The Subha Muhurtham report needs a valid past birth date, 24-hour birth time, and verified birth place with coordinates.'
        });
        return;
      }
      if (!hasValidMuhurthamLocation(inputPayload)) {
        res.status(400).json({
          success: false,
          message: 'Please select the Muhurtham location (where you live or where the function will take place) with coordinates and a time zone.'
        });
        return;
      }
      if (!hasMuhurthamScan(inputPayload) && !inputPayload.selectedMonth) {
        res.status(400).json({ success: false, message: 'Please select the report month so the six-month Muhurtham calendar can be calculated.' });
        return;
      }
    }

    const settings = db.getSettings();
    // Hardened: forwarding headers are only trusted when the direct peer is a
    // proxy we run behind (private network / Cloudflare edge). See clientIp.ts.
    const clientIp = resolveClientIp(req);

    // 1. IP BLACKLIST CHECK: Block banned IPs from placing any orders
    if (!isAdmin && db.isIpBanned(clientIp)) {
      res.status(403).json({
        success: false,
        message: `ACCESS RESTRICTED: Your IP address (${clientIp}) has been blocked due to policy violations (repeated fake orders / spam). Please contact admin@astrosivam.com if you believe this is an error.`,
        isBanned: true
      });
      return;
    }

    // 2. UNVERIFIED CHECKOUT LIMIT: Max 3 open manual/unverified checkouts per IP.
    // A family group counts once; captured/no-charge orders don't block paid reorders.
    const pendingOrdersCount = db.countPendingOrdersByIp(clientIp);
    if (!isAdmin && pendingOrdersCount >= 3) {
      res.status(429).json({
        success: false,
        message: `PENDING ORDERS LIMIT: You currently have ${pendingOrdersCount} unpaid checkout groups awaiting payment verification. Please wait for them to be verified or contact admin before creating additional orders.`,
        pendingCount: pendingOrdersCount
      });
      return;
    }

    // 3. FREE BETA HANDLING — exactly ONE free report per IP address.
    // The FIRST order from an IP is free; once that free chart is used, every
    // following order (single or family) is a normal paid order. No rejection —
    // the order simply becomes a paid order requiring payment + reference.
    const isFreeBetaMode = settings.serviceMode === 'FREE_BETA';
    const freeChartAvailable = !isAdmin && isFreeBetaMode && db.getBetaIpOrderCount(clientIp) < 1;
    const isFreeOrder = isAdmin || freeChartAvailable;
    const expectedCurrency = resolveOrderCurrency({
      paymentMethod: normalizedPaymentMethod,
      billingCountry: billingCountry || user.country,
      country: country || user.country,
      currency
    });
    const expectedAmount = isFreeOrder ? 0 : getServicePrices(settings, serviceType)[expectedCurrency];
    let capturedPaymentIntent: ReturnType<typeof db.getPaymentIntentByReference>;
    let paymentStatus: 'NOT_REQUIRED' | 'CAPTURED' | 'PENDING_ADMIN' = isFreeOrder ? 'NOT_REQUIRED' : 'PENDING_ADMIN';

    if (isFreeOrder && paymentIntentId) {
      res.status(400).json({ success: false, message: 'A free order cannot be bound to a paid payment intent.' });
      return;
    }
    if (!isFreeOrder && currency && currency !== expectedCurrency) {
      res.status(400).json({ success: false, message: 'Payment currency does not match the selected payment method.' });
      return;
    }

    // 4. PAYMENT INTENT / MANUAL REFERENCE VALIDATION (paid orders only).
    // A server-captured intent is accepted only for this user, order amount,
    // and currency. A manual receipt remains pending administrator review.
    if (!isFreeOrder && (paymentIntentId || cleanPaymentReference)) {
      capturedPaymentIntent = paymentIntentId
        ? db.getPaymentIntentForUser(paymentIntentId, user.id)
        : db.getPaymentIntentByReference(cleanPaymentReference, user.id);
      if (capturedPaymentIntent) {
        if (cleanPaymentReference && capturedPaymentIntent.paymentReference !== cleanPaymentReference) {
          res.status(400).json({ success: false, message: 'Payment intent and payment reference do not match.' });
          return;
        }
        const intentMethod = capturedPaymentIntent.paymentMethod === 'GPAY' && normalizedPaymentMethod === 'UPI' ? 'UPI' : capturedPaymentIntent.paymentMethod;
        if (intentMethod !== normalizedPaymentMethod || capturedPaymentIntent.status !== 'CAPTURED' || capturedPaymentIntent.amount !== Number(expectedAmount.toFixed(2)) || capturedPaymentIntent.currency !== expectedCurrency) {
          res.status(400).json({ success: false, message: 'The captured payment does not match this order method, amount, or currency.' });
          return;
        }
        paymentStatus = 'CAPTURED';
      }
    }
    if (!isFreeOrder && paymentIntentId && (!capturedPaymentIntent || capturedPaymentIntent.id !== paymentIntentId)) {
      res.status(400).json({ success: false, message: 'The payment intent is invalid, expired, or has not been captured.' });
      return;
    }

    // 5. FAKE & DUPLICATE PAYMENT REFERENCE VALIDATION (paid orders only —
    // under FREE_BETA only the first report of this IP is free).
    if (!isFreeOrder) {
      if (normalizedPaymentMethod === 'NONE') {
        res.status(400).json({
          success: false,
          message: 'PAYMENT REQUIRED: The 1 free beta report for this connection has already been used (1 free report per customer during the Free Beta). Please select a payment method and enter your transaction reference to place this paid order.'
        });
        return;
      }

      const cleanRef = cleanPaymentReference;

      if (!cleanRef) {
        res.status(400).json({
          success: false,
          message: 'Payment reference number / transaction ID is required to place a paid order.'
        });
        return;
      }

      const lowerRef = cleanRef.toLowerCase();
      const isRepeatedChar = /^(.)\1+$/.test(cleanRef);
      const isBlacklistedPattern = [
        '123456', '12345678', '1234567890', '000000', '111111', '999999',
        'test', 'tester', 'fake', 'none', 'nil', 'asdf', 'sample', 'payment',
        'reference', 'upi', 'gpay', 'mpaisa', 'mycash', '000000000000', '111111111111'
      ].includes(lowerRef);

      if (cleanRef.length < 6 || isRepeatedChar || isBlacklistedPattern) {
        res.status(400).json({
          success: false,
          message: 'INVALID TRANSACTION ID: Please enter a genuine, unique bank/UPI/M-PAiSA transaction reference number. Random or placeholder numbers are strictly prohibited.'
        });
        return;
      }

      if (db.isPaymentReferenceDuplicate(cleanRef)) {
        res.status(400).json({
          success: false,
          message: `DUPLICATE TRANSACTION ID: The payment reference "${cleanRef}" has already been submitted for another order. Each order must have a distinct payment receipt reference.`
        });
        return;
      }
    }

    // Optionally update user's saved profile if requested or if none exists
    if (saveAsProfile && (serviceType === 'BIRTH_JATHAGAM' || serviceType === 'MARRIAGE_COMPATIBILITY')) {
      const p = serviceType === 'BIRTH_JATHAGAM' ? inputPayload : inputPayload.bride || inputPayload;
      if (p.dob && p.tob && p.birthPlace) {
        db.saveBirthProfile({
          userId: user.id,
          name: p.name || user.name,
          dob: p.dob,
          tob: p.tob,
          birthPlace: p.birthPlace,
          country: typeof p.country === 'string' ? p.country.trim() : '',
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
          timezoneOffsetHours: Number(p.timezoneOffsetHours),
          gender: p.gender || 'M',
          updatedAt: new Date().toISOString()
        });
      }
    }

    const order = db.createOrder({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userMobile: user.mobile,
      serviceType,
      language: normalizeReportLanguage(language),
      country: country || user.country || 'Fiji',
      billingCountry: billingCountry || user.country || 'Fiji',
      paymentMethod: normalizedPaymentMethod as any,
      currency: expectedCurrency,
      paymentReference: cleanPaymentReference || undefined,
      paymentIntentId: capturedPaymentIntent?.id,
      paymentStatus,
      inputPayload,
      ipAddress: clientIp,
      forceFree: isAdmin
    });

    if (capturedPaymentIntent) {
      const consumed = db.consumePaymentIntent(capturedPaymentIntent.id, user.id, order.id, expectedAmount, expectedCurrency);
      if (!consumed) {
        db.updateOrder(order.id, { status: 'REJECTED', adminNotes: 'Payment intent could not be consumed safely.' });
        res.status(409).json({ success: false, message: 'Payment could not be bound to this order. No report will be delivered.' });
        return;
      }
    }

    // Best-effort WhatsApp/Viber order-confirmation alert (never blocks the response).
    sendChatOrderAlerts('order_confirmed', [order]).catch(() => {});

    res.status(201).json({
      success: true,
      message: isAdmin
        ? 'Admin order placed at no charge. It is currently pending Admin verification and approval.'
        : order.serviceMode === 'FREE_BETA'
          ? 'Order placed successfully in FREE BETA! It is currently pending Admin verification and approval.'
          : 'Paid order placed! Once payment is verified by Admin, your report and PDF certificate will be generated and emailed.',
      order
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to place order' });
  }
});

/**
 * MULTI-PERSON CHECKOUT (mirror of `astro_create_multi_person_order()` in PHP).
 *
 * `people[]` -> ONE order row holding up to 6 people + their reports. Every
 * price, the free-beta report and the grand total are computed here, from the
 * server price list; a client total is never trusted.
 */
function handleMultiPersonOrder(req: Request, res: Response, user: any, isAdmin: boolean): void {
  const body = req.body || {};
  const settings = db.getSettings();
  const clientIp = resolveClientIp(req);

  // ---- 1. Structure: 1..6 people, at most 24 reports -----------------------
  const validation = validateMultiPersonRequest(body.people);
  if (!validation.ok) {
    res.status(400).json({ success: false, message: validation.message });
    return;
  }
  const items = validation.items;
  if (items.length > MULTI_PERSON_MAX_ITEMS) {
    res.status(400).json({
      success: false,
      message: `A multi-person order can contain at most ${MULTI_PERSON_MAX_ITEMS} reports.`
    });
    return;
  }

  // ---- 2. Payment method ---------------------------------------------------
  const cleanPaymentReference = !isAdmin && typeof body.paymentReference === 'string' ? body.paymentReference.trim() : '';
  const paymentIntentId = isAdmin ? undefined : body.paymentIntentId;
  const normalizedPaymentMethod = isAdmin ? 'NONE' : normalizePaymentMethod(body.paymentMethod || 'NONE');
  if (!['NONE', 'MPAISA', 'MYCASH', 'PAYPAL', 'GPAY', 'UPI', 'CARD'].includes(normalizedPaymentMethod)) {
    res.status(400).json({ success: false, message: 'Unsupported payment method.' });
    return;
  }

  // ---- 3. Access guards (banned IP + open unpaid checkouts) ----------------
  if (!isAdmin && db.isIpBanned(clientIp)) {
    res.status(403).json({
      success: false,
      message: `ACCESS RESTRICTED: Your IP address (${clientIp}) has been blocked due to policy violations.`,
      isBanned: true
    });
    return;
  }
  const pendingOrdersCount = db.countPendingOrdersByIp(clientIp);
  if (!isAdmin && pendingOrdersCount >= 3) {
    res.status(429).json({
      success: false,
      message: `PENDING ORDERS LIMIT: You currently have ${pendingOrdersCount} unpaid checkout groups awaiting payment verification. Please wait for them to be verified or contact admin before creating additional orders.`,
      pendingCount: pendingOrdersCount
    });
    return;
  }

  // ---- 4. Server-side pricing: FREE BETA frees exactly the FIRST report ----
  const isFreeBetaMode = settings.serviceMode === 'FREE_BETA';
  const freeChartAvailable = !isAdmin && isFreeBetaMode && db.getBetaIpOrderCount(clientIp) < 1;
  const expectedCurrency = resolveOrderCurrency({
    paymentMethod: normalizedPaymentMethod,
    billingCountry: body.billingCountry || user.country,
    country: body.billingCountry || user.country,
    currency: body.currency
  });
  const expectedAmount = isAdmin
    ? 0
    : items.reduce((sum: number, item: any, index: number) => {
        const free = freeChartAvailable && index === 0;
        return sum + (free ? 0 : getServicePrices(settings, item.serviceCode)[expectedCurrency]);
      }, 0);
  const chargeableCount = isAdmin ? 0 : Math.max(0, items.length - (freeChartAvailable ? 1 : 0));

  let capturedPaymentIntent: ReturnType<typeof db.getPaymentIntentByReference>;
  let paymentStatus: 'NOT_REQUIRED' | 'CAPTURED' | 'PENDING_ADMIN' = chargeableCount === 0 ? 'NOT_REQUIRED' : 'PENDING_ADMIN';

  if (chargeableCount === 0 && paymentIntentId) {
    res.status(400).json({ success: false, message: 'A no-charge order cannot be bound to a paid payment intent.' });
    return;
  }
  if (chargeableCount > 0 && body.currency && body.currency !== expectedCurrency) {
    res.status(400).json({ success: false, message: 'Payment currency does not match the selected payment method.' });
    return;
  }
  if (chargeableCount > 0 && (paymentIntentId || cleanPaymentReference)) {
    capturedPaymentIntent = paymentIntentId
      ? db.getPaymentIntentForUser(paymentIntentId, user.id)
      : db.getPaymentIntentByReference(cleanPaymentReference, user.id);
    if (capturedPaymentIntent) {
      if (cleanPaymentReference && capturedPaymentIntent.paymentReference !== cleanPaymentReference) {
        res.status(400).json({ success: false, message: 'Payment intent and payment reference do not match.' });
        return;
      }
      const intentMethod = capturedPaymentIntent.paymentMethod === 'GPAY' && normalizedPaymentMethod === 'UPI' ? 'UPI' : capturedPaymentIntent.paymentMethod;
      if (intentMethod !== normalizedPaymentMethod || capturedPaymentIntent.status !== 'CAPTURED' || capturedPaymentIntent.amount !== Number(expectedAmount.toFixed(2)) || capturedPaymentIntent.currency !== expectedCurrency) {
        res.status(400).json({ success: false, message: 'The captured payment does not match this order method, amount, or currency.' });
        return;
      }
      paymentStatus = 'CAPTURED';
    }
  }
  if (chargeableCount > 0 && paymentIntentId && (!capturedPaymentIntent || capturedPaymentIntent.id !== paymentIntentId)) {
    res.status(400).json({ success: false, message: 'The payment intent is invalid, expired, or has not been captured.' });
    return;
  }

  if (chargeableCount > 0) {
    if (normalizedPaymentMethod === 'NONE') {
      res.status(400).json({
        success: false,
        message: `PAYMENT REQUIRED: ${chargeableCount} of ${items.length} reports are chargeable (only the first report is free during the Free Beta). Please select a payment method.`
      });
      return;
    }
    if (!cleanPaymentReference) {
      res.status(400).json({ success: false, message: 'Payment reference number / transaction ID is required to place a paid order.' });
      return;
    }
    const lowerRef = cleanPaymentReference.toLowerCase();
    const isRepeatedChar = /^(.)\1+$/.test(cleanPaymentReference);
    const isBlacklistedPattern = [
      '123456', '12345678', '1234567890', '000000', '111111', '999999',
      'test', 'tester', 'fake', 'none', 'nil', 'asdf', 'sample', 'payment',
      'reference', 'upi', 'gpay', 'mpaisa', 'mycash', '000000000000', '111111111111'
    ].includes(lowerRef);
    if (cleanPaymentReference.length < 6 || isRepeatedChar || isBlacklistedPattern) {
      res.status(400).json({
        success: false,
        message: 'INVALID TRANSACTION ID: Please enter a genuine bank/UPI/M-PAiSA transaction reference number.'
      });
      return;
    }
    if (db.isPaymentReferenceDuplicate(cleanPaymentReference)) {
      res.status(400).json({
        success: false,
        message: `DUPLICATE TRANSACTION ID: The payment reference "${cleanPaymentReference}" has already been submitted for another order.`
      });
      return;
    }
  }

  // ---- 5. ONE order row + N people + M items, in one write ------------------
  const created = db.createMultiPersonOrder({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userMobile: user.mobile,
    items,
    billingCountry: body.billingCountry || body.country || user.country || 'Fiji',
    paymentMethod: normalizedPaymentMethod as any,
    currency: expectedCurrency,
    paymentReference: cleanPaymentReference || undefined,
    paymentIntentId: capturedPaymentIntent?.id,
    paymentStatus,
    ipAddress: clientIp,
    forceFree: isAdmin
  });

  if (capturedPaymentIntent) {
    const consumed = db.consumePaymentIntent(capturedPaymentIntent.id, user.id, created.order.id, expectedAmount, expectedCurrency);
    if (!consumed) {
      db.updateOrder(created.order.id, { status: 'REJECTED', adminNotes: 'Payment intent could not be consumed safely.' });
      res.status(409).json({ success: false, message: 'Payment could not be bound to this order. No report will be delivered.' });
      return;
    }
  }

  sendChatOrderAlerts('order_confirmed', [created.order]).catch(() => {});

  const freeCharts = isAdmin ? created.items.length : (freeChartAvailable ? 1 : 0);
  const paidCharts = Math.max(0, created.items.length - freeCharts);
  let message: string;
  if (isAdmin) {
    message = `Admin order (${created.items.length} report${created.items.length === 1 ? '' : 's'} for ${created.persons.length} ${created.persons.length === 1 ? 'person' : 'people'}) placed successfully at no charge.`;
  } else if (paidCharts === 0) {
    message = `Order placed successfully in FREE BETA! Your first report is free (1 free report per customer). Awaiting Admin verification.`;
  } else if (freeCharts === 1) {
    message = `Order submitted! The first report is FREE (Free Beta — 1 free report per customer); the remaining ${paidCharts} report${paidCharts === 1 ? '' : 's'} total ${created.totalAmount.toFixed(2)} ${expectedCurrency}. Payment will be verified by Admin.`;
  } else {
    message = `Order submitted! The free beta report for this connection has already been used, so all ${created.items.length} reports are charged. Payment will be verified by Admin.`;
  }

  res.status(201).json({
    success: true,
    message,
    order: created.order,
    orders: [created.order],
    people: created.persons,
    items: created.items,
    peopleCount: created.persons.length,
    itemCount: created.items.length,
    currency: expectedCurrency,
    totalAmount: created.totalAmount,
    freeCharts,
    paidCharts
  });
}

// POST /api/services/multi-order (Submit a batch family order with single checkout)
servicesRouter.post('/multi-order', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isAdmin = user.role === 'admin';

    // MULTI-PERSON CHECKOUT: a `people[]` body creates ONE order holding up to
    // 6 people and their reports. The legacy `items[]` tray keeps its own path.
    if (Array.isArray(req.body?.people) && req.body.people.length > 0) {
      handleMultiPersonOrder(req, res, user, isAdmin);
      return;
    }

    const { items, paymentMethod, paymentReference, paymentIntentId: submittedPaymentIntentId, country, billingCountry, currency } = req.body;
    // Only the persisted, authenticated role grants no-charge ordering.
    // Ignore saved/stale payment data for admins; never bind or consume it.
    const cleanPaymentReference = !isAdmin && typeof paymentReference === 'string' ? paymentReference.trim() : '';
    const paymentIntentId = isAdmin ? undefined : submittedPaymentIntentId;
    const normalizedPaymentMethod = isAdmin ? 'NONE' : normalizePaymentMethod(paymentMethod || 'NONE');

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'At least one service chart item is required in the family tray.' });
      return;
    }
    if (items.length > MAX_FAMILY_ORDER_ITEMS) {
      res.status(400).json({
        success: false,
        message: `A family order can contain at most ${MAX_FAMILY_ORDER_ITEMS} reports.`
      });
      return;
    }
    if (!['NONE', 'MPAISA', 'MYCASH', 'PAYPAL', 'GPAY', 'UPI', 'CARD'].includes(normalizedPaymentMethod)) {
      res.status(400).json({ success: false, message: 'Unsupported payment method.' });
      return;
    }

    /**
     * A Subha Muhurtham line requires the birth place (for Janma Nakshatra / Rasi)
     * and a separate residence / ceremony location (for local calendar dates and
     * times). A browser scan can be sent at order time, but approval rebuilds it
     * from these locations.
     */
    const hasMuhurthamScan = (p: any) =>
      (Array.isArray(p?.muhurthamScan?.months) && p.muhurthamScan.months.length > 0) ||
      (Array.isArray(p?.months) && p.months.length > 0);

    // Validate every item before pricing or creating any row.
    const supportedServiceTypes = ['BIRTH_JATHAGAM', 'MARRIAGE_COMPATIBILITY', 'BABY_NAMING', 'MUHURTHAM'];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it || typeof it !== 'object' || Array.isArray(it) ||
          !supportedServiceTypes.includes(it.serviceType) ||
          !it.inputPayload || typeof it.inputPayload !== 'object' || Array.isArray(it.inputPayload)) {
        res.status(400).json({ success: false, message: `Item #${i + 1} has invalid or missing service details.` });
        return;
      }
      if (it.serviceType === 'BIRTH_JATHAGAM' || it.serviceType === 'BABY_NAMING') {
        if (!hasValidBirthDetails(it.inputPayload)) {
          res.status(400).json({
            success: false,
            message: `Item #${i + 1} (${it.inputPayload.name || it.inputPayload.babyName || 'User'}) needs a valid past birth date, 24-hour birth time, birth place, coordinates and time zone.`
          });
          return;
        }
      } else if (it.serviceType === 'MARRIAGE_COMPATIBILITY') {
        if (!hasValidBirthDetails(it.inputPayload.bride) || !hasValidBirthDetails(it.inputPayload.groom)) {
          res.status(400).json({
            success: false,
            message: `Item #${i + 1} (Marriage Matching) needs valid birth dates, 24-hour birth times, birth places, coordinates and time zones for both bride and groom.`
          });
          return;
        }
      }
      else if (it.serviceType === 'MUHURTHAM') {
        if (!hasValidBirthDetails(it.inputPayload)) {
          res.status(400).json({
            success: false,
            message: `Item #${i + 1} (Subha Muhurtham) is missing the birth date, time or birth place. Please re-add that member from the Subha Muhurtham page.`
          });
          return;
        }
        if (!hasValidMuhurthamLocation(it.inputPayload)) {
          res.status(400).json({
            success: false,
            message: `Item #${i + 1} (Subha Muhurtham) is missing the Muhurtham location. Please re-add that member and select where the function will happen or where they currently live.`
          });
          return;
        }
        if (!hasMuhurthamScan(it.inputPayload) && !it.inputPayload.selectedMonth) {
          res.status(400).json({ success: false, message: `Item #${i + 1} (Subha Muhurtham) is missing its report month.` });
          return;
        }
      }
    }

    const settings = db.getSettings();
    // Hardened: forwarding headers are only trusted when the direct peer is a
    // proxy we run behind (private network / Cloudflare edge). See clientIp.ts.
    const clientIp = resolveClientIp(req);

    // 1. IP BLACKLIST CHECK
    if (!isAdmin && db.isIpBanned(clientIp)) {
      res.status(403).json({
        success: false,
        message: `ACCESS RESTRICTED: Your IP address (${clientIp}) has been blocked due to policy violations.`,
        isBanned: true
      });
      return;
    }

    // 2. UNVERIFIED CHECKOUT LIMIT: Max 3 open manual/unverified checkouts per IP.
    // A family group counts once; captured/no-charge orders don't block paid reorders.
    const pendingOrdersCount = db.countPendingOrdersByIp(clientIp);
    if (!isAdmin && pendingOrdersCount >= 3) {
      res.status(429).json({
        success: false,
        message: `PENDING ORDERS LIMIT: You currently have ${pendingOrdersCount} unpaid checkout groups awaiting payment verification. Please wait for them to be verified or contact admin before creating additional orders.`,
        pendingCount: pendingOrdersCount
      });
      return;
    }

    // 3. PAYMENT & FREE BETA HANDLING
    // FREE BETA RULE — exactly ONE free report per IP address:
    //   * This IP still has its free chart  -> the FIRST chart of the family
    //     order is FREE, every additional family member pays the normal price.
    //   * The free chart was already used   -> the whole bundle is a paid order.
    // There is no rejection: later orders from the same IP simply become paid
    // orders, exactly like the single-order endpoint.
    const isFreeBetaMode = settings.serviceMode === 'FREE_BETA';
    const freeChartAvailable = !isAdmin && isFreeBetaMode && db.getBetaIpOrderCount(clientIp) < 1;
    // Customer formula remains the same; admins use the separate no-charge path.
    const paidChartCount = Math.max(0, items.length - (freeChartAvailable ? 1 : 0));
    const chargeableChartCount = isAdmin ? 0 : paidChartCount;
    const expectedCurrency = resolveOrderCurrency({
      paymentMethod: normalizedPaymentMethod,
      billingCountry: billingCountry || user.country,
      country: billingCountry || user.country,
      currency
    });
    const expectedAmount = isAdmin ? 0 : items.reduce((sum: number, item: any, index: number) => {
      const free = freeChartAvailable && index === 0;
      return sum + (free ? 0 : getServicePrices(settings, item.serviceType)[expectedCurrency]);
    }, 0);
    let capturedPaymentIntent: ReturnType<typeof db.getPaymentIntentByReference>;
    let paymentStatus: 'NOT_REQUIRED' | 'CAPTURED' | 'PENDING_ADMIN' = chargeableChartCount === 0 ? 'NOT_REQUIRED' : 'PENDING_ADMIN';

    if (chargeableChartCount === 0 && paymentIntentId) {
      res.status(400).json({ success: false, message: 'A no-charge family order cannot be bound to a paid payment intent.' });
      return;
    }
    if (chargeableChartCount > 0 && currency && currency !== expectedCurrency) {
      res.status(400).json({ success: false, message: 'Payment currency does not match the selected payment method.' });
      return;
    }
    if (chargeableChartCount > 0 && (paymentIntentId || cleanPaymentReference)) {
      capturedPaymentIntent = paymentIntentId
        ? db.getPaymentIntentForUser(paymentIntentId, user.id)
        : db.getPaymentIntentByReference(cleanPaymentReference, user.id);
      if (capturedPaymentIntent) {
        if (cleanPaymentReference && capturedPaymentIntent.paymentReference !== cleanPaymentReference) {
          res.status(400).json({ success: false, message: 'Payment intent and payment reference do not match.' });
          return;
        }
        const intentMethod = capturedPaymentIntent.paymentMethod === 'GPAY' && normalizedPaymentMethod === 'UPI' ? 'UPI' : capturedPaymentIntent.paymentMethod;
        if (intentMethod !== normalizedPaymentMethod || capturedPaymentIntent.status !== 'CAPTURED' || capturedPaymentIntent.amount !== Number(expectedAmount.toFixed(2)) || capturedPaymentIntent.currency !== expectedCurrency) {
          res.status(400).json({ success: false, message: 'The captured payment does not match this family order method, amount, or currency.' });
          return;
        }
        paymentStatus = 'CAPTURED';
      }
    }
    if (chargeableChartCount > 0 && paymentIntentId && (!capturedPaymentIntent || capturedPaymentIntent.id !== paymentIntentId)) {
      res.status(400).json({ success: false, message: 'The payment intent is invalid, expired, or has not been captured.' });
      return;
    }

    // FAKE & DUPLICATE PAYMENT REFERENCE VALIDATION (paid charts only — under
    // FREE_BETA only the FIRST chart of the bundle is free, the rest of the
    // family pays for their reports).
    if (chargeableChartCount > 0) {
      if (normalizedPaymentMethod === 'NONE') {
        res.status(400).json({
          success: false,
          message: `PAYMENT REQUIRED: ${paidChartCount} of ${items.length} charts in this family order are chargeable (only the first report is free during the Free Beta). Please select a payment method to place the order.`
        });
        return;
      }

      const cleanRef = cleanPaymentReference;
      if (!cleanRef) {
        res.status(400).json({
          success: false,
          message: 'Payment reference number / transaction ID is required to place a paid order.'
        });
        return;
      }

      const lowerRef = cleanRef.toLowerCase();
      const isRepeatedChar = /^(.)\1+$/.test(cleanRef);
      const isBlacklistedPattern = [
        '123456', '12345678', '1234567890', '000000', '111111', '999999',
        'test', 'tester', 'fake', 'none', 'nil', 'asdf', 'sample', 'payment',
        'reference', 'upi', 'gpay', 'mpaisa', 'mycash', '000000000000', '111111111111'
      ].includes(lowerRef);

      if (cleanRef.length < 6 || isRepeatedChar || isBlacklistedPattern) {
        res.status(400).json({
          success: false,
          message: 'INVALID TRANSACTION ID: Please enter a genuine bank/UPI/M-PAiSA transaction reference number.'
        });
        return;
      }

      if (db.isPaymentReferenceDuplicate(cleanRef)) {
        res.status(400).json({
          success: false,
          message: `DUPLICATE TRANSACTION ID: The payment reference "${cleanRef}" has already been submitted for another order.`
        });
        return;
      }
    }

    const createdOrders = db.createMultiOrder({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userMobile: user.mobile,
      items: items.map((it: any) => ({
        serviceType: it.serviceType,
        language: normalizeReportLanguage(it.language),
        country: typeof it.country === 'string' ? it.country.trim() : '',
        inputPayload: it.inputPayload
      })),
      billingCountry: billingCountry || country || user.country || 'Fiji',
      paymentMethod: normalizedPaymentMethod as any,
      currency: expectedCurrency,
      paymentReference: cleanPaymentReference || undefined,
      paymentIntentId: capturedPaymentIntent?.id,
      paymentStatus,
      ipAddress: clientIp,
      forceFree: isAdmin
    });

    if (capturedPaymentIntent && createdOrders.length > 0) {
      const consumed = db.consumePaymentIntent(capturedPaymentIntent.id, user.id, createdOrders[0].id, expectedAmount, expectedCurrency);
      if (!consumed) {
        createdOrders.forEach(order => db.updateOrder(order.id, { status: 'REJECTED', adminNotes: 'Payment intent could not be consumed safely.' }));
        res.status(409).json({ success: false, message: 'Payment could not be bound to this family order. No report will be delivered.' });
        return;
      }
    }

    // Best-effort WhatsApp/Viber order-confirmation alert for the family bundle.
    if (createdOrders.length > 0) {
      sendChatOrderAlerts('order_confirmed', createdOrders).catch(() => {});
    }

    const hasPaidItems = createdOrders.some(o => o.amount > 0);
    const hasFreeItems = createdOrders.some(o => o.serviceMode === 'FREE_BETA');
    const totalAmount = createdOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

    let message: string;
    if (isAdmin) {
      message = `Admin family order (${createdOrders.length} chart${createdOrders.length === 1 ? '' : 's'}) placed successfully at no charge. Awaiting Admin verification.`;
    } else if (!hasPaidItems) {
      message = `Family order (${createdOrders.length} chart) placed successfully in FREE BETA! Your first report is free (1 free report per customer). Awaiting Admin verification.`;
    } else if (hasFreeItems) {
      message = `Family bundle (${createdOrders.length} charts) submitted! Chart 1 is FREE (Free Beta — 1 free report per customer); the remaining ${paidChartCount} charts total ${totalAmount.toFixed(2)} ${createdOrders[0]?.currency}. Payment will be verified by Admin.`;
    } else {
      message = `Family bundle (${createdOrders.length} charts) submitted! The free beta report for this connection has already been used, so all charts are charged. Payment will be verified by Admin.`;
    }

    res.status(201).json({
      success: true,
      message,
      orders: createdOrders,
      groupId: createdOrders[0]?.groupId,
      currency: createdOrders[0]?.currency,
      totalAmount,
      freeCharts: isAdmin ? createdOrders.length : hasFreeItems ? 1 : 0,
      paidCharts: chargeableChartCount
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to place multi-order' });
  }
});

// GET /api/services/my-orders (Retrieve customer's orders)
servicesRouter.get('/my-orders', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  // Multi-person orders: attach the people and their reports so the customer
  // dashboard can show "N people / M reports" for the order.
  const orders = db.attachOrderChildren(db.getUserOrders(user.id));
  res.json({ success: true, orders });
});

// GET /api/services/orders/:id (Retrieve specific order details)
servicesRouter.get('/orders/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const order = db.getOrderById(routeParam(req.params.id));

  if (!order) {
    res.status(404).json({ success: false, message: 'Order not found.' });
    return;
  }

  // Ensure only the owner or an admin can access
  if (order.userId !== user.id && user.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Access denied.' });
    return;
  }

  res.json({ success: true, order });
});

// POST /api/services/orders/:id/cancel (Customer requests cancellation & refund prior to admin approval)
servicesRouter.post('/orders/:id/cancel', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { reason } = req.body;
    const order = db.getOrderById(routeParam(req.params.id));

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }

    if (order.userId !== user.id && user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Access denied.' });
      return;
    }

    // Policy Rule: Pre-approval = refundable (48h processing); Post-approval = non-refundable
    if (order.status === 'APPROVED' || order.status === 'PROCESSING' || order.status === 'COMPLETED') {
      res.status(400).json({
        success: false,
        message: 'According to ASTRO SIVAM Policy, once an order has been approved by Admin and prepared by the Astrology Team, it is non-refundable.'
      });
      return;
    }

    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      res.status(400).json({
        success: false,
        message: `Order is already ${order.status.toLowerCase()}.`
      });
      return;
    }

    const cancellationReason = reason?.trim() || 'Requested by customer prior to admin approval';

    // Family bundles: cancellations are per-member so a FREE_BETA chart (amount 0)
    // stays NONE while paid members (e.g. ₹499) become REQUESTED. Cancelling
    // via any member cancels the whole non-final group to keep bundle state consistent.
    const targets: typeof order[] = order.groupId
      ? db.getOrdersByGroupId(order.groupId).filter(o => o.userId === user.id || user.role === 'admin')
      : [order];

    if (order.groupId && targets.length === 0) {
      res.status(403).json({ success: false, message: 'Access denied to family bundle.' });
      return;
    }

    // Validate all targets are cancellable before mutating
    for (const t of targets) {
      if (t.status === 'APPROVED' || t.status === 'PROCESSING' || t.status === 'COMPLETED') {
        res.status(400).json({
          success: false,
          message: `Order ${t.orderNumber} is already ${t.status.toLowerCase()} and cannot be cancelled per refund policy.`
        });
        return;
      }
      if (t.status === 'CANCELLED' || t.status === 'REFUNDED') {
        res.status(400).json({
          success: false,
          message: `Order ${t.orderNumber} is already ${t.status.toLowerCase()}.`
        });
        return;
      }
    }

    const nowIso = new Date().toISOString();
    let lastUpdated = order;
    let paidCount = 0;
    let freeCount = 0;
    for (const t of targets) {
      const isPaidMember = t.serviceMode !== 'FREE_BETA' && Number(t.amount) > 0;
      if (isPaidMember) paidCount++; else freeCount++;
      lastUpdated = db.updateOrder(t.id, {
        status: 'CANCELLED',
        refundStatus: isPaidMember ? 'REQUESTED' : 'NONE',
        refundReason: cancellationReason,
        refundRequestedAt: nowIso
      }, { id: user.id, name: user.name, role: user.role });
    }

    const isPaidPrimary = order.serviceMode !== 'FREE_BETA' && Number(order.amount) > 0;
    db.logAudit(
      user.id,
      user.name,
      user.role,
      'ORDER_CANCELLED',
      `Order ${order.orderNumber}${order.groupId ? ` (family ${order.groupId} — ${targets.length} member(s): ${paidCount} paid, ${freeCount} free)` : ''} cancelled prior to approval. Reason: ${cancellationReason}. ${paidCount ? `Full refund for ${paidCount} paid order(s) queued.` : ''}`
    );

    if (targets.length > 1) {
      res.json({
        success: true,
        message: paidCount
          ? `Family bundle ${order.groupId} cancelled (${paidCount} paid, ${freeCount} free). A full refund for the ${paidCount} paid report(s) will be processed within 48 hours.`
          : `Family bundle ${order.groupId} cancelled. Free reports require no refund.`,
        order: lastUpdated,
        groupId: order.groupId,
        cancelledCount: targets.length,
        paidRefunds: paidCount,
        freeCancels: freeCount
      });
      return;
    }

    res.json({
      success: true,
      message: isPaidPrimary
        ? `Your order ${order.orderNumber} has been cancelled. A full refund of ${order.currency} $${order.amount} will be processed within 48 hours to your original payment method.`
        : `Your order ${order.orderNumber} has been cancelled successfully.`,
      order: lastUpdated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to cancel order' });
  }
});

// GET /api/services/orders/:id/pdf (Download official ASTRO SIVAM PDF)
servicesRouter.get('/orders/:id/pdf', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const order = db.getOrderById(routeParam(req.params.id));

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }

    if (order.userId !== user.id && user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Access denied.' });
      return;
    }

    if (order.status !== 'COMPLETED') {
      res.status(400).json({
        success: false,
        message: `Report is not yet completed. Current order status: ${order.status}`
      });
      return;
    }
    // Rebuild every official download from the order's saved service inputs;
    // calculatedResult is a cache and must never override verified details.
    const calculatedResult = computeOrderReportResult(order);
    if (!calculatedResult) {
      res.status(400).json({
        success: false,
        message: `Report is not yet completed. Current order status: ${order.status}`
      });
      return;
    }
    db.updateOrder(order.id, { calculatedResult });

    let pdfBuffer: Buffer;
    let fileName = `ASTRO_SIVAM_${order.orderNumber}.pdf`;

    if (order.serviceType === 'BIRTH_JATHAGAM') {
      pdfBuffer = generateHoroscopePdf(calculatedResult as any, order.language);
      const nameForFile = (calculatedResult as any)?.devoteeName || order.userName || 'User';
      fileName = `ASTRO_SIVAM_Horoscope_${nameForFile.replace(/\s+/g, '_')}_${order.language}.pdf`;
    } else if (order.serviceType === 'MARRIAGE_COMPATIBILITY') {
      pdfBuffer = generateWeddingMatchPdf(calculatedResult as any, order.language);
      fileName = `ASTRO_SIVAM_Matchmaking_${order.orderNumber}_${order.language}.pdf`;
    } else if (order.serviceType === 'BABY_NAMING') {
      pdfBuffer = generateBabyNamingPdf(calculatedResult as any, order.language);
      const babyNameForFile = (calculatedResult as any)?.babyName || 'Baby';
      fileName = `ASTRO_SIVAM_BabyNaming_${babyNameForFile.replace(/\s+/g, '_')}_${order.language}.pdf`;
    } else if (order.serviceType === 'MUHURTHAM') {
      pdfBuffer = generateMuhurthamPdf(calculatedResult as any, order.language);
      fileName = `ASTRO_SIVAM_Muhurtham_${order.orderNumber}_${order.language}.pdf`;
    } else {
      res.status(400).json({ success: false, message: 'Unsupported service PDF' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'PDF generation failed' });
  }
});

// GET /api/services/orders/:id/invoice-pdf (Download official ASTRO SIVAM Tax Invoice & Receipt PDF)
servicesRouter.get('/orders/:id/invoice-pdf', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const order = db.getOrderById(routeParam(req.params.id));

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }

    if (order.userId !== user.id && user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Access denied.' });
      return;
    }

    const invoiceBuffer = generateInvoicePdf(order);
    const fileName = `ASTRO_SIVAM_Invoice_${order.orderNumber}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', invoiceBuffer.length);
    res.send(invoiceBuffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Invoice PDF generation failed' });
  }
});

// GET /api/services/family-orders/:groupId/invoice-pdf (Download official Family Tax Invoice PDF)
servicesRouter.get('/family-orders/:groupId/invoice-pdf', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const groupId = routeParam(req.params.groupId);
    const orders = db.getOrdersByGroupId(groupId);

    if (!orders || orders.length === 0) {
      res.status(404).json({ success: false, message: 'Family order group not found.' });
      return;
    }

    if (orders[0].userId !== user.id && user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Access denied.' });
      return;
    }

    const invoiceBuffer = generateFamilyInvoicePdf(orders);
    const fileName = `ASTRO_SIVAM_Family_Invoice_${groupId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', invoiceBuffer.length);
    res.send(invoiceBuffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Family invoice PDF generation failed' });
  }
});

// POST /api/services/contact (Public inquiry form; saved even if SMTP is unavailable)
servicesRouter.post('/contact', async (req: Request, res: Response) => {
  const clientIp = resolveClientIp(req);
  const rate = await publicServiceRateLimiter.consume(`contact:${clientIp}`, 4, 10 * 60_000);
  if (!rate.allowed) {
    rejectRateLimit(res, rate.retryAfterSeconds, 'Too many contact messages. Please wait before submitting another.');
    return;
  }

  try {
    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!name || !email || !message) {
      res.status(400).json({ success: false, message: 'Name, email, and message content are required.' });
      return;
    }
    if (name.length > 160 || email.length > 254 || subject.length > 200 || message.length > 10000) {
      res.status(400).json({ success: false, message: 'Please keep your name under 160 characters, subject under 200, and message under 10,000.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
      return;
    }

    const newMsg = db.addContactMessage({
      name,
      email,
      subject: subject || 'Customer Support / Astrological Inquiry',
      message,
      ip: clientIp
    });

    let delivery = { success: false, recipient: '' };
    try {
      delivery = await sendContactInquiryEmail(newMsg);
    } catch {
      // The message is already safely in the Admin Inbox; do not discard it or
      // imply the email notification succeeded if the transport itself fails.
      delivery = { success: false, recipient: '' };
    }
    if (delivery.success && delivery.recipient) {
      try {
        db.markContactMessageEmailDispatched(newMsg.id, delivery.recipient);
      } catch (error: any) {
        console.warn(`[Contact] SMTP accepted inquiry ${newMsg.id}, but its delivery status could not be persisted (${error?.name || 'storage error'}).`);
      }
    }

    res.json({
      success: true,
      emailDispatched: delivery.success,
      message: delivery.success
        ? 'Your message was saved and accepted by our administrator email system. Final inbox delivery is handled by the mail provider.'
        : 'Your message was safely saved in the ASTRO SIVAM admin inbox. Email notification is unavailable right now, but our team can review it in the portal.',
      messageId: newMsg.id
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to save message' });
  }
});

// POST /api/services/export-preview-pdf (Direct instant export of calculated preview results to official PDF).
//
// SECURITY: previously unauthenticated. Any visitor could mint an "official"
// ASTRO SIVAM PDF from arbitrary chart JSON, which is a brand-abuse /
// forged-report vector and an unauthenticated CPU-heavy DoS surface. Now
// requires a signed bearer token (same channel as the rest of the API).
servicesRouter.post('/export-preview-pdf', requireAuth, (req: Request, res: Response) => {
  try {
    const { serviceType, result, language = 'en' } = req.body;

    if (!serviceType || !result) {
      res.status(400).json({ success: false, message: 'Service type and calculated result are required.' });
      return;
    }

    let pdfBuffer: Buffer;
    let fileName = `ASTRO_SIVAM_${serviceType}_Report.pdf`;

    if (serviceType === 'BIRTH_JATHAGAM') {
      pdfBuffer = generateHoroscopePdf(result, language);
      const nameForFile = result.devoteeName || 'User';
      fileName = `ASTRO_SIVAM_Horoscope_${nameForFile.replace(/\s+/g, '_')}_${language}.pdf`;
    } else if (serviceType === 'MARRIAGE_COMPATIBILITY') {
      pdfBuffer = generateWeddingMatchPdf(result, language);
      fileName = `ASTRO_SIVAM_Matchmaking_${language}.pdf`;
    } else if (serviceType === 'BABY_NAMING') {
      pdfBuffer = generateBabyNamingPdf(result, language);
      const babyNameForFile = result.babyName || 'Baby';
      fileName = `ASTRO_SIVAM_BabyNaming_${babyNameForFile.replace(/\s+/g, '_')}_${language}.pdf`;
    } else if (serviceType === 'MUHURTHAM') {
      pdfBuffer = generateMuhurthamPdf(result, language);
      fileName = `ASTRO_SIVAM_Muhurtham_${language}.pdf`;
    } else {
      res.status(400).json({ success: false, message: `Unsupported service type: ${serviceType}` });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'PDF export failed' });
  }
});

interface CustomerResendReport {
  orderId: string;
  orderNumber: string;
  fileName: string;
  buffer: Buffer;
}

interface CustomerResendDocs {
  reports: CustomerResendReport[];
  invoice: Buffer | null;
  invoiceFileName: string;
}

function safeResendFileName(value: unknown, fallback: string): string {
  const name = String(value || fallback)
    .replace(/[\/\\\0-\x1f]/g, '_')
    .replace(/[^A-Za-z0-9_.() -]/g, '_')
    .slice(0, 150);
  return /\.pdf$/i.test(name) ? name : `${name || fallback}.pdf`;
}

/** Resolve only browser-rendered, structurally valid PDFs for a customer resend. */
function resolveCustomerResendDocs(body: any, scope: string): CustomerResendDocs {
  const reports: CustomerResendReport[] = [];
  const inlineReports = Array.isArray(body?.reportPdfs) ? body.reportPdfs : [];
  for (const item of inlineReports) {
    if (!item || typeof item !== 'object') continue;
    const buffer = decodePdfPayload(item.pdfBase64 ?? item.pdf_base64);
    if (!buffer) continue;
    reports.push({
      orderId: String(item.orderId ?? item.order_id ?? ''),
      orderNumber: String(item.orderNumber ?? item.order_number ?? ''),
      fileName: safeResendFileName(item.fileName ?? item.file_name, 'ASTRO_SIVAM_Report.pdf'),
      buffer
    });
  }

  const singleReport = decodePdfPayload(body?.reportPdfBase64 ?? body?.report_pdf_base64);
  if (singleReport) {
    reports.push({
      orderId: String(body?.orderId ?? body?.order_id ?? ''),
      orderNumber: String(body?.orderNumber ?? body?.order_number ?? ''),
      fileName: safeResendFileName(body?.reportFileName ?? body?.fileName, 'ASTRO_SIVAM_Report.pdf'),
      buffer: singleReport
    });
  }

  const staged = loadStagedDocs(scope);
  for (const report of staged.reports) {
    const alreadyProvided = reports.some(item =>
      (report.orderId && item.orderId === report.orderId) ||
      (report.orderNumber && item.orderNumber === report.orderNumber)
    );
    if (!alreadyProvided) {
      reports.push({
        orderId: report.orderId,
        orderNumber: report.orderNumber,
        fileName: safeResendFileName(report.fileName, 'ASTRO_SIVAM_Report.pdf'),
        buffer: report.content
      });
    }
  }

  const inlineInvoice = decodePdfPayload(body?.invoicePdfBase64 ?? body?.invoice_pdf_base64);
  const invoice = inlineInvoice || staged.invoice?.content || null;
  const invoiceName = staged.invoice?.fileName || body?.invoiceFileName;
  const invoiceFileName = invoiceName ? safeResendFileName(invoiceName, 'ASTRO_SIVAM_Invoice.pdf') : '';
  return { reports, invoice, invoiceFileName };
}

function pickCustomerResendReport(
  docs: CustomerResendDocs,
  order: Order,
  allowAnonymous = false
): { buffer: Buffer; fileName: string } | null {
  if (allowAnonymous) {
    const anonymous = docs.reports.find(item => !item.orderId && !item.orderNumber);
    if (anonymous) return { buffer: anonymous.buffer, fileName: anonymous.fileName };
  }
  for (const item of docs.reports) {
    if (item.orderId && item.orderId === order.id) return { buffer: item.buffer, fileName: item.fileName };
    if (item.orderNumber && item.orderNumber === order.orderNumber) return { buffer: item.buffer, fileName: item.fileName };
  }
  return null;
}

function customerCanAccessOrder(user: any, order: Order): boolean {
  return user?.role === 'admin' || order.userId === user?.id;
}

function customerCanAccessGroup(user: any, groupOrders: Order[]): boolean {
  return groupOrders.length > 0 && groupOrders.every(order => customerCanAccessOrder(user, order));
}

function customerOrderStageScope(order: Order): string {
  return order.groupId || `order_${order.id}`;
}

/** Customer-owned staging endpoints used only for completed-order resends. */
servicesRouter.post('/orders/:id/stage-doc', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const order = db.getOrderById(routeParam(req.params.id));
  if (!order) {
    res.status(404).json({ success: false, message: 'Order not found.' });
    return;
  }
  if (!customerCanAccessOrder(user, order)) {
    res.status(403).json({ success: false, message: 'Access denied.' });
    return;
  }
  if (order.groupId) {
    res.status(400).json({ success: false, message: 'Use the family staging endpoint for a grouped order.' });
    return;
  }
  if ((order.status || '').toUpperCase() !== 'COMPLETED') {
    res.status(409).json({ success: false, message: 'Documents can only be staged for a completed-order resend.' });
    return;
  }

  const body = { ...(req.body || {}) } as StagedDocInput;
  const kind = String(body.kind || 'report').toLowerCase();
  if (kind !== 'invoice') {
    body.kind = 'report';
    body.orderId = order.id;
    body.orderNumber = order.orderNumber;
  }
  const result = stageDoc(customerOrderStageScope(order), body);
  res.status(result.success ? 200 : 400).json({ ...result, scope: customerOrderStageScope(order) });
});

servicesRouter.delete('/orders/:id/stage-doc', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const order = db.getOrderById(routeParam(req.params.id));
  if (!order) {
    res.status(404).json({ success: false, message: 'Order not found.' });
    return;
  }
  if (!customerCanAccessOrder(user, order)) {
    res.status(403).json({ success: false, message: 'Access denied.' });
    return;
  }
  clearStagedDocs(customerOrderStageScope(order));
  res.json({ success: true, message: 'Staged documents cleared.' });
});

servicesRouter.post('/family-orders/:groupId/stage-doc', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const groupId = routeParam(req.params.groupId);
  const groupOrders = db.getOrdersByGroupId(groupId);
  if (!customerCanAccessGroup(user, groupOrders)) {
    res.status(404).json({ success: false, message: 'Family order group not found.' });
    return;
  }
  if (groupOrders.some(order => (order.status || '').toUpperCase() !== 'COMPLETED')) {
    res.status(409).json({ success: false, message: 'Documents can only be staged for a completed-family resend.' });
    return;
  }

  const body = { ...(req.body || {}) } as StagedDocInput;
  const kind = String(body.kind || 'report').toLowerCase();
  if (kind !== 'invoice') {
    const requestedId = String(body.orderId ?? body.order_id ?? '');
    const requestedNumber = String(body.orderNumber ?? body.order_number ?? '');
    const member = groupOrders.find(order =>
      (requestedId && order.id === requestedId) || (requestedNumber && order.orderNumber === requestedNumber)
    );
    if (!member) {
      res.status(403).json({ success: false, message: 'The staged report does not belong to this family order.' });
      return;
    }
    body.kind = 'report';
    body.orderId = member.id;
    body.orderNumber = member.orderNumber;
  }
  const result = stageDoc(groupId, body);
  res.status(result.success ? 200 : 400).json({ ...result, scope: groupId });
});

servicesRouter.delete('/family-orders/:groupId/stage-doc', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const groupId = routeParam(req.params.groupId);
  const groupOrders = db.getOrdersByGroupId(groupId);
  if (!customerCanAccessGroup(user, groupOrders)) {
    res.status(404).json({ success: false, message: 'Family order group not found.' });
    return;
  }
  clearStagedDocs(groupId);
  res.json({ success: true, message: 'Staged documents cleared.' });
});

// POST /api/services/orders/:id/request-resend-email (Devotee requests a preview-PDF resend or updates delivery email)
servicesRouter.post('/orders/:id/request-resend-email', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const order = db.getOrderById(routeParam(req.params.id));
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }
    if (!customerCanAccessOrder(user, order)) {
      res.status(403).json({ success: false, message: 'Access denied.' });
      return;
    }

    const body = req.body || {};
    const targetEmail = body.targetEmail;
    let emailToUse = order.userEmail;
    if (targetEmail && typeof targetEmail === 'string' && targetEmail.trim()) {
      const cleanEmail = targetEmail.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
        return;
      }
      const orderEmailLower = String(order.userEmail || '').toLowerCase().trim();
      const accountEmailLower = String((user as any).email || '').toLowerCase().trim();
      if (cleanEmail !== orderEmailLower && cleanEmail !== accountEmailLower) {
        res.status(403).json({
          success: false,
          message: 'New delivery address must be the order email or your account email. Contact support for other changes.'
        });
        return;
      }
      emailToUse = cleanEmail;
      if (emailToUse !== order.userEmail) {
        db.updateOrder(order.id, { userEmail: emailToUse }, { id: user.id, name: user.name, role: user.role });
        order.userEmail = emailToUse;
      }
    }

    if ((order.status || '').toUpperCase() !== 'COMPLETED') {
      res.json({
        success: true,
        message: `Delivery email address successfully updated to ${emailToUse}. Your report and tax invoice will be emailed after approval.`
      });
      return;
    }

    if (order.groupId) {
      const groupOrders = db.getOrdersByGroupId(order.groupId);
      if (!customerCanAccessGroup(user, groupOrders)) {
        res.status(403).json({ success: false, message: 'Access denied to one or more family orders.' });
        return;
      }
      if (groupOrders.some(member => (member.status || '').toUpperCase() !== 'COMPLETED')) {
        res.status(409).json({ success: false, message: 'The full family bundle is not completed and cannot be resent yet.' });
        return;
      }

      const docs = resolveCustomerResendDocs(body, order.groupId);
      const reports: Array<{ order: Order; pdfBuffer: Buffer; fileName: string }> = [];
      const missing: string[] = [];
      for (const member of groupOrders) {
        const report = pickCustomerResendReport(docs, member);
        if (!report) {
          missing.push(member.orderNumber);
          continue;
        }
        reports.push({ order: member, pdfBuffer: report.buffer, fileName: report.fileName });
      }
      if (missing.length > 0 || !docs.invoice) {
        res.status(422).json({
          success: false,
          message: `Preview-quality family resend is incomplete: ${groupOrders.length - missing.length}/${groupOrders.length} reports and ${docs.invoice ? '1' : '0'}/1 invoice reached the server.${missing.length ? ` Missing reports: ${missing.join(', ')}.` : ''} No email was sent; render and upload the complete package.`
        });
        return;
      }

      const dispatchResult = await sendFamilyOrderApprovalEmail(
        groupOrders,
        reports,
        docs.invoice,
        docs.invoiceFileName || `ASTRO_SIVAM_Family_Tax_Invoice_${order.groupId}.pdf`,
        emailToUse
      );
      for (const groupOrder of groupOrders) {
        db.updateOrder(groupOrder.id, {
          emailStatus: dispatchResult.success ? 'SENT' : 'FAILED',
          emailDeliveryAttempts: (groupOrder.emailDeliveryAttempts || 0) + 1,
          emailLastStatusMessage: dispatchResult.message,
          ...(dispatchResult.sentAt ? { emailSentAt: dispatchResult.sentAt } : {})
        }, { id: user.id, name: user.name, role: user.role });
      }
      if (!dispatchResult.success) {
        db.logAudit(user.id, user.name, user.role, 'CUSTOMER_EMAIL_RESEND_FAILED',
          `Preview-quality resend failed for Family Order [${order.groupId}]. ${dispatchResult.message}`);
        res.status(503).json({ success: false, message: dispatchResult.message, emailPartCount: dispatchResult.partCount || 1 });
        return;
      }

      clearStagedDocs(order.groupId);
      db.logAudit(
        user.id,
        user.name,
        user.role,
        'CUSTOMER_EMAIL_RESEND_REQUESTED',
        `User requested preview-quality resend for Family Order [${order.groupId}] to ${emailToUse} in ${dispatchResult.partCount || 1} email part(s).`
      );
      res.json({
        success: true,
        message: `All ${reports.length} preview-quality reports and the consolidated family invoice were re-sent to ${emailToUse} in ${dispatchResult.partCount || 1} email(s).`,
        renderQuality: 'PREVIEW_EXACT',
        invoiceQuality: 'PREVIEW_EXACT',
        emailPartCount: dispatchResult.partCount || 1
      });
      return;
    }

    const docs = resolveCustomerResendDocs(body, customerOrderStageScope(order));
    const report = pickCustomerResendReport(docs, order, true);
    if (!report || !docs.invoice) {
      const missing = [!report ? 'report' : '', !docs.invoice ? 'invoice' : ''].filter(Boolean).join(' and ');
      res.status(422).json({
        success: false,
        message: `Preview-quality ${missing} PDF did not reach the server. No email was sent; render and upload both documents before retrying.`
      });
      return;
    }

    const dispatchResult = await sendOrderApprovalEmail(
      { ...order, userEmail: emailToUse },
      report.buffer,
      report.fileName || `ASTRO_SIVAM_Report_${order.orderNumber}.pdf`,
      docs.invoice,
      docs.invoiceFileName || `ASTRO_SIVAM_Invoice_${order.orderNumber}.pdf`
    );
    db.updateOrder(order.id, {
      emailStatus: dispatchResult.success ? 'SENT' : 'FAILED',
      emailDeliveryAttempts: (order.emailDeliveryAttempts || 0) + 1,
      emailLastStatusMessage: dispatchResult.message,
      ...(dispatchResult.sentAt ? { emailSentAt: dispatchResult.sentAt } : {})
    }, { id: user.id, name: user.name, role: user.role });
    if (!dispatchResult.success) {
      db.logAudit(user.id, user.name, user.role, 'CUSTOMER_EMAIL_RESEND_FAILED',
        `Preview-quality resend failed for Order #${order.orderNumber}. ${dispatchResult.message}`);
      res.status(503).json({ success: false, message: dispatchResult.message });
      return;
    }

    clearStagedDocs(customerOrderStageScope(order));
    db.logAudit(
      user.id,
      user.name,
      user.role,
      'CUSTOMER_EMAIL_RESEND_REQUESTED',
      `User requested preview-quality resend for Order #${order.orderNumber} to ${emailToUse}.`
    );
    res.json({
      success: true,
      message: `Preview-quality report and tax invoice have been re-sent to ${emailToUse}.`,
      renderQuality: 'PREVIEW_EXACT',
      invoiceQuality: 'PREVIEW_EXACT',
      emailPartCount: 1
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to resend preview-quality email' });
  }
});
