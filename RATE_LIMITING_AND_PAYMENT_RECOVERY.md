# ASTRO SIVAM — Rate limiting, payment recovery & delivery budgets

Operational reference for the hardening work. Two deployments run the same
policy: the **Node/Express server** (`server/`, used for local/preview and any
Node hosting) and the **PHP/MySQL API** (`api/`, the cPanel/BigRock production
stack). Where a control exists in both, the limits are identical.

---

## 1. Rate limiting

### 1.1 What is limited

| Action | Limit | Key | Stack |
| --- | --- | --- | --- |
| Login | 5 attempts / 15 min **per account+IP**, 25 / 15 min per IP | `login-pair`, `login-ip` (PHP) · `astrosivam:login` (Node) | both |
| Registration | 5 / 10 min per IP | `register-ip` · `astrosivam:register` | both |
| Payment session create | 8 / 10 min per user, 20 / 10 min per IP | `payment-create-user/-ip` · `astrosivam:services` | both |
| Payment verify | 20 / 10 min per user, 40 / 10 min per IP | `payment-verify-user/-ip` | both |
| Unverified order placement | 3 outstanding checkout groups per IP; family charts count as one; provider-captured/no-charge orders are excluded | `orders.ip_address` · Node order store | both |
| Calculator preview | 20 / min per IP | `calculate-preview-ip` | both |
| Contact form | 4 / 10 min per IP | `contact-ip` | both |
| Client error reports (Node) | 20 / min per IP | `client-error` | Node |
| Admin delivery (approve / resend email) | 30 / 10 min per admin | `admin-action-delivery` · `astrosivam:admin-actions` | both |
| Admin SMTP test mail (arbitrary recipient) | 5 / 10 min per admin | `admin-action-test-mail` | both |
| Admin payment reconciliation sweep | 10 / 10 min per admin | `admin-action-provider` | both |

A login **clears** the account+IP counter as soon as the password is correct, so
a legitimate user is never locked out by their own sign-ins; the network-wide
counter simply expires with its window. Admin actions are limited per
administrator rather than per IP, because a valid (or leaked) admin token must
not be usable as a bulk-mail or provider-quota weapon.

### 1.2 Node (Express)

* Implementation: `server/security/rateLimit.ts` — a RESP client for Redis, a
  fixed-window limiter and an attempt tracker, no external dependency.
* Set `REDIS_URL=redis://…` (or `rediss://`) to share counters across instances;
  without it an in-process limiter is used, which is correct for a single
  instance but lets two instances allow 2× the traffic.
* `RATE_LIMIT_BACKEND=memory` forces the in-process limiter even when
  `REDIS_URL` is set (useful when debugging).
* `REDIS_COMMAND_TIMEOUT_MS` (default 2000) bounds each Redis command; a slow
  Redis is treated as an outage rather than stalling every request.
* `RATE_LIMIT_FAIL_MODE=closed` makes an outage refuse the request instead of
  falling back to the local limiter (default `open` deliberately keeps traffic
  flowing — a Redis outage must not take the whole site down).
* Keys are namespaced (`astrosivam:login:…`) so one Redis database can be shared.

### 1.3 PHP (cPanel)

* Implementation: `api/rate_limit.php` (decisions + enforcement) and
  `api/client_ip.php` (spoof-resistant client IP).
* Counters live in the self-healing `api_rate_limits` table, keyed by an
  HMAC-SHA256 of the identifier with `APP_SECRET_KEY` — no raw IP address or
  email is ever stored, and the table cannot be used to enumerate visitors.
  Stale rows are pruned opportunistically.
* A counter above its allowance returns `429` with `Retry-After` and a
  `retryAfterSeconds` field. A database failure returns `503` (fail closed)
  rather than letting a brute-force window open.
* The migration runs itself (`CREATE TABLE IF NOT EXISTS`) because shared
  hosting often cannot run migrations; no manual step is required.
* Setting the variables such a deployment needs (`APP_SECRET_KEY`, payment
  credentials, `CONTACT_INQUIRY_TO`, `FAMILY_EMAIL_MAX_ATTACHMENT_MB`, …) on
  cPanel is documented in the deployment guide, Step 5b, including a
  create-and-delete presence check that never prints secret values.

### 1.4 Client IP resolution (both stacks)

`X-Forwarded-For`, `CF-Connecting-IP` and `X-Real-IP` are attacker-controlled
when the app is reachable directly, so they are honoured **only** when the
direct peer (`REMOTE_ADDR` / `req.ip`) is a proxy we run behind — loopback,
RFC1918/CGNAT, or a published Cloudflare edge range. Otherwise the TCP peer is
used. This is what makes the per-IP limits, the FREE-BETA one-free-report rule
and IP bans meaningful. Node: `server/security/clientIp.ts`. PHP:
`api/client_ip.php`.

---

## 2. Payment recovery

A checkout is only finished when the **browser** calls
`payment/verify-session`. If the customer closes the tab, the provider has the
money while the intent stays `CREATED`. Two independent recovery paths exist:

1. **Signed provider webhooks**
   * Node: `POST /api/payment/webhook/razorpay`, `POST /api/payment/webhook/paypal`
     (`server/routes/paymentWebhooks.ts`); PHP: `api/payment_webhook.php`
     (routed from `/api/payment/...`).
   * Razorpay: `X-Razorpay-Signature` = HMAC-SHA256 of the **raw** body
     (`RAZORPAY_WEBHOOK_SECRET`), verified with a timing-safe comparison.
   * PayPal: verified through PayPal's own verify API
     (`PAYPAL_WEBHOOK_ID`); a missing configuration answers `503` so PayPal
     retries instead of the event being silently dropped.
   * Amount and currency are re-checked against the stored intent — a webhook
     can never change what an order costs. Tampered signature → `400`;
     mismatch → `MISMATCH` and nothing is captured.
   * Events are deduplicated (event-id header, else
     `eventType:paymentId|orderId|payloadDigest`) and recorded in
     `payment_webhook_events` (Node store) / `payment_webhook_events` (MySQL).
   * Health: `GET /api/payment/webhook/health`.
2. **Admin reconciliation** — for providers/hosts without webhooks configured:
   * `GET /api/admin/payments/recovery?minutes=5..1440` lists stale intents and
     the most recent webhook events.
   * `POST /api/admin/payments/reconcile` with `{intentId}` or
     `{sweep:true, minutes}` captures verified payments via the provider API
     (`reconcileIntent` / `astro_payment_reconcile_intent`).

Provider credentials (Node and PHP) resolve environment variables **before**
stored settings, and masked placeholders (`••••`, `change-me`) are never treated
as credentials.

---

## 3. Attachment delivery budget

Family bundles are several ~2 MB PDFs plus the invoice, which mail providers
reject as one message. Both stacks therefore enforce a per-message budget in
**MIME-encoded** bytes (base64 inflates binary data by ~4/3):

* Default 18 MB encoded; configure with `FAMILY_EMAIL_MAX_ATTACHMENT_MB`
  (1–200, preferred) or `FAMILY_EMAIL_MAX_ATTACHMENT_BYTES` (512 KB–200 MB).
  An invalid value falls back to the default.
* A bundle larger than the budget is delivered as several emails labelled
  `(Part N of M)`; a single document larger than the whole budget ships alone
  and is reported back to the admin (`oversizeFiles`).
* Partial delivery is reported as **failure** (`success:false`, HTTP 503): the
  order stays `APPROVED`/`PROCESSING` and can be retried, and the family group
  is only marked `COMPLETED` once every part is accepted.
* Implementation: `server/services/attachmentBatching.ts` +
  `server/services/emailService.ts`, `api/mailer.php` +
  `api/admin/family_approval.php`.

---

## 4. Verifying a deployment

```bash
npm test          # Node suites: payments, delivery, auth, rate limiting, source guards
npm run lint      # TypeScript (includes server/**)
npm run test:php  # PHP suites: reports, payments/webhooks, mailer guards, rate limiting
```

CI runs all of the above (`.github/workflows/tests.yml`) plus `php -l` over
every PHP file; `.github/workflows/build.yml` publishes `dist.zip` to the
`latest` release for cPanel upload.

Quick production smoke checks:

* `GET /api/payment/webhook/health` → both providers report
  `webhookVerification` as expected.
* Sign in with a wrong password six times → the sixth answer is `429` with
  `Retry-After`; the correct password still works after the window (Node: the
  counter is cleared by a success).
* `GET /api/admin/payments/recovery` → lists stale intents and recent events.
