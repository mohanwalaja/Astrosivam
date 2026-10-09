import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { db } from '../server/db/store.js';
import { verifyGoogleLogin } from '../server/security/tokens.js';
import { getMailTransporter, sendContactInquiryEmail, sendOrderApprovalEmail } from '../server/services/emailService.js';
import { hasConfiguredSecret, omitBlankSecretUpdates, redactSettingsSecrets } from '../server/security/settingsSecrets.js';
import { FixedWindowRateLimiter } from '../server/security/rateLimit.js';
import { ADMIN_ACTION_LIMITS, enforceAdminActionLimit } from '../server/routes/admin.js';

const pass = (name: string) => console.log(`  [PASS] ${name}`);

async function run() {
  console.log('--- SECURITY & EMAIL DELIVERY REGRESSIONS ---');

  const clientBootstrap = readFileSync(path.join(process.cwd(), 'src/main.tsx'), 'utf8');
  assert.doesNotMatch(clientBootstrap, /securityProtection|initSecurityProtection/);
  pass('Application startup leaves copy, context-menu, print, and keyboard controls to the browser');

  const serverBootstrap = readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
  const publicBodyParserIndex = serverBootstrap.indexOf("app.use(express.json({ limit: BODY_LIMIT }));");
  assert.ok(serverBootstrap.includes("const BODY_LIMIT = process.env.API_BODY_LIMIT || '8mb';"));
  assert.ok(serverBootstrap.includes("app.post('/api/admin/orders/:id/stage-doc', requireAdmin, parseStagedDocJson);"));
  assert.ok(serverBootstrap.indexOf('requireAdmin, parseStagedDocJson') < publicBodyParserIndex);
  const servicesRoutes = readFileSync(path.join(process.cwd(), 'server/routes/services.ts'), 'utf8');
  assert.ok(servicesRoutes.includes("servicesRouter.get('/orders/:id/pdf', requireAuth"));
  assert.ok(servicesRoutes.includes("servicesRouter.get('/orders/:id/invoice-pdf', requireAuth"));
  assert.ok(servicesRoutes.includes('order.userId !== user.id && user.role !== \'admin\''));
  pass('Official report downloads remain authenticated and restricted to the order owner or an admin');
  assert.ok(servicesRoutes.includes("`contact:${clientIp}`, 4, 10 * 60_000"));
  assert.ok(servicesRoutes.includes("enforcePaymentRateLimit(req, res, user.id, 'create')"));
  assert.ok(servicesRoutes.includes("enforcePaymentRateLimit(req, res, user.id, 'verify')"));
  const serverRateLimit = readFileSync(path.join(process.cwd(), 'server/security/rateLimit.ts'), 'utf8');
  const authRoutes = readFileSync(path.join(process.cwd(), 'server/routes/auth.ts'), 'utf8');
  assert.ok(authRoutes.includes('const MAX_LOGIN_RATE_LIMIT_KEYS = 20_000;'));
  assert.ok(authRoutes.includes('registrationRateLimiter.consume(`register:${clientIp}`, 5, 10 * 60_000)'));
  assert.ok(authRoutes.includes('createAttemptTracker('));
  assert.ok(serverRateLimit.includes('REDIS_URL'));
  const phpServicesRoutes = readFileSync(path.join(process.cwd(), 'api/services/index.php'), 'utf8');
  const phpRateLimiter = readFileSync(path.join(process.cwd(), 'api/rate_limit.php'), 'utf8');
  const phpClientIp = readFileSync(path.join(process.cwd(), 'api/client_ip.php'), 'utf8');
  const phpDb = readFileSync(path.join(process.cwd(), 'api/db.php'), 'utf8');
  assert.ok(phpDb.includes("function_exists('getClientIpAddress')"));
  assert.ok(phpServicesRoutes.includes('function astro_enforce_contact_rate_limit($pdo)'));
  assert.ok(phpServicesRoutes.includes('astro_rate_limit_enforce('));
  assert.ok(phpServicesRoutes.includes('astro_enforce_contact_rate_limit($pdo);'));
  assert.ok(phpRateLimiter.includes("header('Retry-After: ' . $retryAfter)"));
  assert.ok(phpRateLimiter.includes('astro_rate_limit_decision(') && phpRateLimiter.includes('), 429);'));
  assert.ok(phpRateLimiter.includes("hash_hmac('sha256'") && phpRateLimiter.includes('api_rate_limits'));
  assert.ok(phpClientIp.includes('function getClientIpAddress()') && phpClientIp.includes('astro_is_trusted_proxy_ip'));
  const phpConfig = readFileSync(path.join(process.cwd(), 'api/config.php'), 'utf8');
  assert.ok(phpConfig.includes("require_once __DIR__ . '/client_ip.php';"));
  const adminRoutes = readFileSync(path.join(process.cwd(), 'server/routes/admin.ts'), 'utf8');
  assert.ok(adminRoutes.includes('ADMIN_ACTION_LIMITS') && adminRoutes.includes('enforceAdminActionLimit('));
  assert.ok(adminRoutes.includes("'testMail'") && adminRoutes.includes("admin-${action}:${adminId}"));
  assert.ok(adminRoutes.includes("action: keyof typeof ADMIN_ACTION_LIMITS"));
  // Privileged audit entries must record where the action came from, otherwise
  // a CDN/proxy hop or a missing argument leaves the trail unforensic.
  const auditCalls = [...adminRoutes.matchAll(/db\.logAudit\(/g)];
  assert.ok(auditCalls.length >= 10);
  const auditWithoutIp = auditCalls.filter(match => {
    const window = adminRoutes.slice(match.index, match.index + 1200);
    const end = window.indexOf('\n  );');
    const segment = end === -1 ? window : window.slice(0, end);
    return !segment.includes('resolveClientIp') && !segment.includes('clientIp');
  });
  assert.equal(auditWithoutIp.length, 0, `${auditWithoutIp.length} admin audit entry(ies) omit the client IP`);
  db.logAudit('adm_audit_test', 'Audit Test', 'admin', 'AUDIT_IP_TEST', 'Verifies the IP is persisted.', '203.0.113.7');
  assert.equal(db.getAuditLogs()[0].ip, '203.0.113.7');
  pass('Every admin audit entry records the resolved client IP');

  const phpAdminRoutes = readFileSync(path.join(process.cwd(), 'api/admin/index.php'), 'utf8');
  assert.ok(phpAdminRoutes.includes('function astro_admin_action_limit($pdo, $admin, $action)'));
  assert.ok(phpAdminRoutes.includes("astro_admin_action_limit($pdo, $admin, 'delivery')"));
  assert.ok(phpAdminRoutes.includes("astro_admin_action_limit($pdo, $admin, 'test-mail')"));
  assert.ok(phpAdminRoutes.includes("astro_admin_action_limit($pdo, $admin, 'provider')"));
  // 4 legacy delivery routes + the 3 per-report multi-person routes
  // (result/send, resend, send-all) all enforce the same per-admin limiter.
  assert.ok((phpAdminRoutes.match(/astro_admin_action_limit\(\$pdo, \$admin, 'delivery'\)/g) || []).length === 6);
  const phpAuthRoutes = readFileSync(path.join(process.cwd(), 'api/auth/index.php'), 'utf8');
  assert.ok(phpAuthRoutes.includes("require_once __DIR__ . '/../rate_limit.php';"));
  assert.ok(phpAuthRoutes.includes("astro_rate_limit_enforce(\n        $pdo,\n        'login-pair',"));
  assert.ok(phpAuthRoutes.includes("'login-ip'") && phpAuthRoutes.includes("astro_rate_limit_clear($pdo, 'login-pair'"));
  assert.ok(phpAuthRoutes.includes("'register-ip'"));
  assert.ok(!phpAuthRoutes.includes('Database error during authentication: '));
  pass('Large staged-PDF requests require admin authentication; Node and PHP contact submissions are rate-limited');

  // Admin actions that mail customers or burn provider quota are limited per
  // administrator, so a valid (or leaked) admin token cannot spam.
  const fakeRes = () => {
    const res: any = {
      statusCode: 200,
      body: undefined as any,
      headers: {} as Record<string, string>,
      setHeader(key: string, value: string) { res.headers[key.toLowerCase()] = value; },
      status(code: number) { res.statusCode = code; return res; },
      json(payload: any) { res.body = payload; return res; }
    };
    return res;
  };
  const adminId = 'adm_action_limit_test';
  for (let i = 0; i < ADMIN_ACTION_LIMITS.delivery.limit; i += 1) {
    assert.equal(await enforceAdminActionLimit(fakeRes(), adminId, 'delivery', 'limited'), true);
  }
  const throttled = fakeRes();
  assert.equal(await enforceAdminActionLimit(throttled, adminId, 'delivery', 'limited'), false);
  assert.equal(throttled.statusCode, 429);
  assert.equal(throttled.body.message, 'limited');
  assert.ok(Number(throttled.body.retryAfterSeconds) > 0);
  assert.ok(Number(throttled.headers['retry-after']) > 0);
  // Buckets are independent: a busy delivery window must not block test mail.
  assert.equal(await enforceAdminActionLimit(fakeRes(), adminId, 'testMail', 'limited'), true);
  assert.equal(await enforceAdminActionLimit(fakeRes(), 'adm_action_limit_other', 'delivery', 'limited'), true);
  pass('Admin delivery actions are rate-limited per administrator with Retry-After');

  const limiter = new FixedWindowRateLimiter(2);
  assert.equal((await limiter.consume('contact:192.0.2.1', 2, 1_000, 10_000)).allowed, true);
  assert.equal((await limiter.consume('contact:192.0.2.1', 2, 1_000, 10_100)).allowed, true);
  const limited = await limiter.consume('contact:192.0.2.1', 2, 1_000, 10_200);
  assert.equal(limited.allowed, false);
  assert.ok((limited.retryAfterSeconds || 0) > 0);
  assert.equal((await limiter.consume('contact:192.0.2.1', 2, 1_000, 11_001)).allowed, true);
  pass('Fixed-window limiter enforces per-key quotas, retry times, and window reset');

  assert.equal(hasConfiguredSecret('astro_sivam_paypal_secret_key'), false);
  assert.equal(hasConfiguredSecret('a-real-random-secret-value'), true);
  const configuredSecrets = {
    paypalSecret: 'paypal-secret-value',
    facebookAppSecret: 'facebook-secret-value',
    emailSettings: { smtpPassword: 'smtp-password-value' },
    chatAlertSettings: {
      whatsapp: { accessToken: 'whatsapp-token-value', webhookUrl: 'https://example.test/webhook?key=private' },
      viber: { authToken: 'viber-token-value', webhookUrl: 'https://example.test/viber?key=private' }
    }
  };
  const safeSettings = redactSettingsSecrets(configuredSecrets);
  assert.equal(safeSettings.paypalSecret, '');
  assert.equal(safeSettings.paypalSecretConfigured, true);
  assert.equal(safeSettings.facebookAppSecret, '');
  assert.equal(safeSettings.emailSettings.smtpPassword, '');
  assert.equal(safeSettings.chatAlertSettings.whatsapp.accessToken, '');
  assert.equal(safeSettings.chatAlertSettings.whatsapp.webhookUrl, '');
  assert.equal(safeSettings.chatAlertSettings.viber.authToken, '');
  assert.equal(safeSettings.chatAlertSettings.viber.webhookUrl, '');
  assert.doesNotMatch(JSON.stringify(safeSettings), /paypal-secret-value|facebook-secret-value|smtp-password-value|whatsapp-token-value|viber-token-value|private/);
  pass('Admin settings responses redact payment, OAuth, email, and chat-alert secrets while exposing configured flags');

  const retainedUpdates = omitBlankSecretUpdates({
    paypalSecret: '',
    indiaGpayKeySecret: '••••••••••••',
    emailSettings: { smtpPassword: '' },
    chatAlertSettings: { whatsapp: { accessToken: '', webhookUrl: '' }, viber: { authToken: '' } }
  } as any);
  assert.equal('paypalSecret' in retainedUpdates, false);
  assert.equal('indiaGpayKeySecret' in retainedUpdates, false);
  assert.equal('smtpPassword' in retainedUpdates.emailSettings, false);
  assert.equal('accessToken' in retainedUpdates.chatAlertSettings.whatsapp, false);
  assert.equal('webhookUrl' in retainedUpdates.chatAlertSettings.whatsapp, false);
  assert.equal('authToken' in retainedUpdates.chatAlertSettings.viber, false);
  pass('Blank or masked admin credentials preserve saved values instead of clearing or overwriting them');

  const originalSettings = structuredClone(db.getSettings());
  try {
    db.updateSettings({
      paypalSecret: 'export-paypal-secret',
      facebookAppSecret: 'export-facebook-secret',
      emailSettings: { ...originalSettings.emailSettings, smtpPassword: 'export-smtp-password' },
      chatAlertSettings: {
        ...originalSettings.chatAlertSettings,
        whatsapp: { ...originalSettings.chatAlertSettings.whatsapp, accessToken: 'export-whatsapp-token' },
        viber: { ...originalSettings.chatAlertSettings.viber, authToken: 'export-viber-token' }
      }
    }, { id: 'test', name: 'Export test' });
    const exportedSettings = db.exportDatabase('settings');
    const exportedDatabase = db.exportDatabase();
    for (const exported of [exportedSettings, exportedDatabase]) {
      assert.doesNotMatch(JSON.stringify(exported), /export-paypal-secret|export-facebook-secret|export-smtp-password|export-whatsapp-token|export-viber-token/);
    }
    pass('Settings-only and full database exports redact reusable payment, OAuth, SMTP, and chat credentials');
  } finally {
    db.updateSettings(originalSettings, { id: 'test', name: 'Export test cleanup' });
  }

  const originalFetch = globalThis.fetch;
  const expectedClientId = 'astrosivam-test-client.apps.googleusercontent.com';
  let mockResponse: Record<string, unknown> = {};
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => mockResponse
  } as Response)) as typeof fetch;

  try {
    mockResponse = {
      aud: expectedClientId,
      email: 'devotee@example.test',
      email_verified: 'true',
      sub: 'google-subject',
      name: 'Audit Devotee'
    };
    const verified = await verifyGoogleLogin('test-id-token', undefined, expectedClientId);
    assert.equal(verified?.email, 'devotee@example.test');
    pass('Google ID token requires and accepts the configured audience and verified email');

    mockResponse = {
      aud: 'another-application.apps.googleusercontent.com',
      email: 'devotee@example.test',
      email_verified: 'true'
    };
    assert.equal(await verifyGoogleLogin('wrong-audience-token', undefined, expectedClientId), null);
    pass('Google ID token for another application is rejected');

    mockResponse = {
      aud: expectedClientId,
      email: 'devotee@example.test'
    };
    assert.equal(await verifyGoogleLogin('unverified-token', undefined, expectedClientId), null);
    pass('Google identity with missing email_verified is rejected');

    mockResponse = {
      aud: expectedClientId,
      azp: 'different-authorized-party.apps.googleusercontent.com',
      email: 'devotee@example.test',
      email_verified: true
    };
    assert.equal(await verifyGoogleLogin('wrong-authorized-party-token', undefined, expectedClientId), null);
    pass('Google token with a mismatched authorized party is rejected');

    const responses = [
      { issued_to: expectedClientId, expires_in: 300 },
      { email: 'access@example.test', email_verified: true, sub: 'access-subject', name: 'Access User' }
    ];
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => responses.shift()
    } as Response)) as typeof fetch;
    const accessIdentity = await verifyGoogleLogin(undefined, 'test-access-token', expectedClientId);
    assert.equal(accessIdentity?.email, 'access@example.test');
    pass('Google access token audience is checked before verified userinfo is accepted');

    const envNames = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE'] as const;
    const oldEnv = Object.fromEntries(envNames.map(key => [key, process.env[key]]));
    for (const key of envNames) delete process.env[key];
    const originalEmailSettings = structuredClone(db.getSettings().emailSettings);

    try {
      const noSmtpConfig = {
        ...originalEmailSettings,
        smtpHost: '',
        smtpUsername: '',
        smtpPassword: '',
        status: 'NOT_CONFIGURED' as const
      };
      db.updateSettings({ emailSettings: noSmtpConfig }, { id: 'test', name: 'Email test' });
      assert.equal(getMailTransporter(noSmtpConfig), null);
      pass('SMTP transport is not created when real credentials are absent');

      const savedInquiry = db.addContactMessage({
        name: 'Audit Visitor',
        email: 'visitor@example.test',
        subject: 'Contact delivery check',
        message: 'This should be retained even without mail transport.'
      });
      const contactDispatch = await sendContactInquiryEmail(savedInquiry);
      assert.equal(contactDispatch.success, false);
      assert.equal(savedInquiry.autoEmailDispatched, false);
      assert.equal(savedInquiry.dispatchedTo, '');
      assert.ok(db.getContactMessages().some(message => message.id === savedInquiry.id));
      pass('Contact inquiries are retained in the admin inbox and never marked as emailed when SMTP is unavailable');

      const maskedPasswordConfig = {
        ...noSmtpConfig,
        smtpHost: 'smtp.example.test',
        smtpUsername: 'test-user',
        smtpPassword: '••••••••••••••••'
      };
      assert.equal(getMailTransporter(maskedPasswordConfig), null);
      pass('A masked SMTP password cannot be treated as a real credential');

      const order = {
        userName: 'Audit Devotee',
        userEmail: 'devotee@example.test',
        orderNumber: 'EMAIL-AUDIT-1',
        serviceType: 'BIRTH_JATHAGAM',
        language: 'en',
        currency: 'FJD',
        amount: 10,
        paymentMethod: 'CARD',
        paymentReference: ''
      } as any;
      const dispatch = await sendOrderApprovalEmail(
        order,
        Buffer.from('%PDF-report'),
        'report.pdf',
        Buffer.from('%PDF-invoice'),
        'invoice.pdf'
      );
      assert.equal(dispatch.success, false);
      assert.equal(dispatch.sentAt, undefined);
      assert.equal(dispatch.messageId, undefined);
      assert.match(dispatch.message, /SMTP is not configured/);
      pass('Unconfigured SMTP returns a failed dispatch and no fabricated sent timestamp/message ID');
    } finally {
      db.updateSettings({ emailSettings: originalEmailSettings }, { id: 'test', name: 'Email test cleanup' });
      for (const key of envNames) {
        const value = oldEnv[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
