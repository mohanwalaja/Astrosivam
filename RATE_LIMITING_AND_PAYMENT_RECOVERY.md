# ASTRO SIVAM — PHP rate limiting, payment recovery & delivery budgets

Operational reference for the BigRock/cPanel deployment. The live application is a static React frontend plus the PHP/MySQL API in `api/`; it does not require a Node.js server. Node/npm are used only by developers and CI to build the frontend and run TypeScript tests.

---

## 1. Rate limiting and abuse controls

### 1.1 PHP API limits

All fixed-window counters are enforced by `api/rate_limit.php` and stored in the MySQL `api_rate_limits` table.

| Action | Limit | Counter key |
| --- | --- | --- |
| Login | 5 attempts / 15 min per account+IP; 25 / 15 min per IP | `login-pair`, `login-ip` |
| Registration | 5 / 10 min per IP; 3 / 15 min per email | `register-ip`, `register-email` |
| Email-code verification | 10 / 15 min per IP; 5 / 15 min per email | `otp-verify-ip`, `otp-verify-email` |
| Email-code resend | 5 / hour per IP; 3 / hour per email | `otp-resend-ip`, `otp-resend-email` |
| Payment-session creation | 8 / 10 min per user; 20 / 10 min per IP | `payment-create-user`, `payment-create-ip` |
| Payment verification | 20 / 10 min per user; 40 / 10 min per IP | `payment-verify-user`, `payment-verify-ip` |
| Astrology calculator preview | 20 / min per IP | `calculate-preview-ip` |
| Contact form | 4 / 10 min per IP | `contact-ip` |
| Admin approval / resend delivery | 30 / 10 min per admin | `admin-action-delivery` |
| Admin test email | 5 / 10 min per admin | `admin-action-test-mail` |
| Admin payment reconciliation | 10 / 10 min per admin | `admin-action-provider` |

A successful password login clears the account+IP counter; a legitimate user is not locked out by their own correct sign-in. Admin actions that send email or call payment-provider APIs are limited per administrator, rather than per IP.

### 1.2 Storage and failure behavior

* Each counter identifier is stored as an HMAC-SHA256 key using `APP_SECRET_KEY`; raw IP addresses and email addresses are not stored in the rate-limit table.
* The table is created automatically with `CREATE TABLE IF NOT EXISTS`; expired rows are pruned opportunistically. No separate migration command is needed for this table.
* Exceeding a limit returns HTTP `429`, a `Retry-After` header, and `retryAfterSeconds` in the JSON response.
* If the database-backed limiter cannot run, the request fails closed with HTTP `503`; the API does not silently disable brute-force protection.
* `APP_SECRET_KEY` must be configured and kept private. See Step 5b of the [BigRock cPanel deployment guide](BIGROCK_CPANEL_DEPLOYMENT_GUIDE.md).

### 1.3 Additional order guard and client IP handling

Order placement also rejects a non-admin IP with **three or more outstanding unpaid checkout groups** (HTTP `429`). A family order counts as one group, not one entry per chart. Captured, verified-manual, and no-charge orders do not count against this guard. This is a pending-order limit, not a time-window rate limit.

`api/client_ip.php` trusts `CF-Connecting-IP`, `X-Forwarded-For`, or `X-Real-IP` only when `REMOTE_ADDR` is a trusted proxy (loopback/private proxy ranges or a published Cloudflare edge range). Otherwise it uses the direct peer address, preventing clients from spoofing a fresh IP on each request. The same resolved IP is used by IP-based rate limits, the free-beta claim, pending-order guard, and IP-ban checks.

---

## 2. Payment recovery

A checkout is complete only after the PHP API verifies the payment. If a customer closes the browser after the provider captures funds, the intent can remain `CREATED`. Two recovery paths are available.

### 2.1 Signed provider webhooks

`api/payment_webhook.php` handles:

* `GET /api/payment/webhook/health` — readiness probe; reports whether checkout and webhook verification are configured without returning secret values.
* `POST /api/payment/webhook/razorpay` — accepts supported captured-payment events.
* `POST /api/payment/webhook/paypal` — verifies PayPal events through PayPal's verification API.

Razorpay signatures are HMAC-SHA256 over the raw request body using `RAZORPAY_WEBHOOK_SECRET`. PayPal verification uses `PAYPAL_WEBHOOK_ID`. Missing verification configuration returns `503` so the provider can retry; an invalid signature is rejected and cannot change payment state.

Before capture, the API checks the paid amount and currency against the stored payment intent. Webhook event IDs are deduplicated and outcomes are recorded in the MySQL `payment_webhook_events` table. Accepted, ignored, or already-recorded events receive a successful response so the provider stops retrying.

### 2.2 Admin reconciliation

For payments whose browser callback or webhook was missed, an authenticated administrator can use:

* `GET /api/admin/payments/recovery?minutes=5..1440` to list stale intents and recent webhook events. The default threshold is 30 minutes; the response is capped at 100 stale intents and 50 recent events.
* `POST /api/admin/payments/reconcile` with `{ "intentId": "…" }` to check one intent, or `{ "sweep": true, "minutes": 30 }` to reconcile a batch. Sweeps inspect at most 25 stale intents and are limited to 10 requests per admin per 10 minutes.

The PHP API re-queries the provider and captures only a payment whose amount and currency match the stored intent. Provider credentials can be supplied through the hosting environment or the Admin payment settings; masked placeholder values are not treated as credentials.

---

## 3. Attachment delivery budget

Family report bundles can contain several PDFs plus an invoice. `api/mailer.php` enforces a per-message limit measured in MIME-encoded bytes (base64 expands binary attachments by roughly one third).

* Default: **18 MiB** encoded. Configure with `FAMILY_EMAIL_MAX_ATTACHMENT_MB` (1–200); `FAMILY_EMAIL_MAX_ATTACHMENT_BYTES` (512 KiB–200 MiB) is also supported. Invalid or out-of-range values fall back to the default.
* A family bundle is split into multiple emails only when needed; each continuation is labelled `(Part N of M)`.
* A single attachment that exceeds the whole per-message budget is isolated and reported to the administrator, but the mailer refuses to send an over-budget message. Re-render or compress that attachment before retrying.
* If any part fails, the delivery is reported as unsuccessful and the order/group remains available for retry; a family group is not marked `COMPLETED` until all parts are accepted.

Implementation: `api/mailer.php`, `api/admin/order_items.php`, and `api/admin/family_approval.php`.

---

## 4. Verification and deployment checks

From a development checkout:

```bash
npm run lint       # TypeScript type check
npm test           # TypeScript regression suites run with Node.js tooling
npm run test:php   # PHP suites for the deployed API
npm run build:zip  # static frontend + PHP deployment archive
```

CI runs the TypeScript/Node tooling tests, PHP tests and parity checks separately. `npm run build:zip` rejects executable `.cjs` bundles and excludes source maps; the deployable archive contains static frontend files, the PHP API, and operator documentation. No Node.js process, server bundle, or Node runtime dependency is required on BigRock.

Quick production checks:

* `GET /api/payment/webhook/health` returns provider `checkout` and `webhookVerification` readiness booleans.
* In a controlled test account, repeated invalid logins should eventually return HTTP `429` with `Retry-After`; a correct login clears the account+IP counter.
* `GET /api/admin/payments/recovery` (with an admin session) lists stale intents and recent webhook events.
