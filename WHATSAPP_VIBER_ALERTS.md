# WhatsApp & Viber Order Alerts — Setup Guide

> **Historical note (October 2026):** This file records work from before the Node.js application server was removed. Production is now a static React frontend plus the PHP API in `api/`; Node.js remains build/test tooling only. Any `server/` paths and Node-server behaviors below describe the retired implementation, not the current deployment.


ASTRO SIVAM can notify customers on **WhatsApp** and **Viber** at the two most
important points of the order lifecycle:

| Event | When it fires | Recipient |
|---|---|---|
| **Order Confirmed** | Immediately after a customer places an order (single order or family bundle) | The customer's mobile number |
| **Order Complete** | When Admin approves the order and the Report + Tax Invoice PDFs are emailed (status becomes `COMPLETED`) | The customer's mobile number |

Email delivery (report + invoice PDFs) is unchanged — chat alerts are an
*additional* notification. Alerts are **best-effort**: if a chat gateway is
unreachable, order placement/approval continues unaffected and the failure is
written to the PHP error log and the audit log (`CHAT_ALERT_SENT`).

---

## 1. Where to configure

Log in to the **Admin Portal** and open **“WhatsApp & Viber Alerts”**
(next to *Email & SMTP*).

Everything is stored in `system_settings.general_settings.chatAlertSettings`
(PHP/cPanel) or `SystemSettings.chatAlertSettings` (Node/AI Studio server).
No database migration is needed.

The panel has four sections:

1. **Alert Rules** — master switch + per-event switches
2. **WhatsApp Channel** — Meta Cloud API or a gateway webhook
3. **Viber Channel** — Viber Bot (official PA) or a business-messages webhook
4. **Message Templates + Send Test** — wording and a diagnostic sender

---

## 2. WhatsApp setup (Meta WhatsApp Cloud API)

Proactive alerts require an **approved utility template** (Meta policy: a
business can only send free-form text inside the 24-hour customer-care window).

1. Go to [developers.facebook.com](https://developers.facebook.com/) →
   **My Apps** → create/use a **Business** app → add the **WhatsApp** product.
2. In the WhatsApp → **API Setup** (or *Configuration*) page copy:
   - **Phone Number ID** (the sender number's ID)
   - A **permanent access token** — create a *System User* in
     [business.facebook.com → Business Settings → System Users](https://business.facebook.com/),
     give it the WhatsApp asset, and generate a token that never expires.
3. In **WhatsApp Manager → Message Templates** create a *Utility* template for
   order updates (e.g. name it `order_update`, language `en`) with a body like:

   ```
   Namaste {{1}}, your order {{2}} for {{3}} ({{4}}) is now {{5}}.
   - ASTRO SIVAM
   ```

   The integration sends body variables in this fixed order:
   `{{1}}` customer name, `{{2}}` order number, `{{3}}` service name,
   `{{4}}` amount, `{{5}}` status.
4. In the admin panel fill in:
   - Provider: **Meta WhatsApp Cloud API (direct)**
   - Phone Number ID, Access Token, API version (e.g. `v21.0`)
   - Message Type: **Approved Template** + the template name and language
   - Tick **Enable WhatsApp alerts** → **Save** → **Send Test**

> Alternative: if you use a gateway (WATI, AiSensy, Interakt, Gupshup, …) or
> a BSP, pick **Gateway Webhook** and enter the provider's send-URL. Your
> endpoint receives `POST { channel, event, to, message, vars }`.

### Environment-variable alternative (Node server / PHP)

```
WHATSAPP_PHONE_NUMBER_ID=1234567890123456
WHATSAPP_ACCESS_TOKEN=EAAG...
WHATSAPP_TEMPLATE_NAME=order_update
```

---

## 3. Viber setup (Viber Bot / Official PA)

1. Create a bot at [partners.viber.com](https://partners.viber.com/) →
   **Create a Bot Account**. Copy the **Auth Token**.
2. In the admin panel:
   - Provider: **Viber Bot / Official PA (direct)**
   - Auth Token + Sender Name (e.g. `ASTRO SIVAM`)
   - Tick **Enable Viber alerts** → **Save** → **Send Test**

**Important:** the direct Viber Bot API delivers to users who have
*interacted (subscribed) with your bot* (e.g. they pressed *Start* once).
To proactively message **any** customer by phone number, use a Viber Business
Messages partner (Infobip, MessageBird, Bird, …) and select
**Business Messages Webhook** instead — the payload is the same generic
`{ channel, event, to, message, vars }` JSON.

### Environment-variable alternative

```
VIBER_AUTH_TOKEN=4d7...
VIBER_SENDER_NAME=ASTRO SIVAM
```

---

## 4. Message templates & placeholders

Both events have a configurable message. Supported placeholders:

| Placeholder | Example |
|---|---|
| `{customer_name}` | Ramesh Kumar |
| `{order_number}` | ORD-A1B2C3 |
| `{service_name}` | Birth Jathagam (Horoscope Reading) |
| `{amount}` | FJD 35.00 |
| `{status}` | PENDING / COMPLETED |
| `{customer_email}` | ramesh@example.com |
| `{payment_method}` | MPAISA |
| `{site_name}` | ASTRO SIVAM |

Family bundles are collapsed into one alert per customer using the group's
first order number plus “(+N more charts)” and the combined amount.

---

## 5. Phone numbers

Alerts go to the `user_mobile` saved on the order. Numbers are normalized to
E.164 automatically:

- `+679 777 1234` → `+6797771234`
- Local `777 1234` with country **Fiji** → `+6797771234`
- Local `09876543210` with country **India** → `+919876543210`

Country codes are mapped for all supported billing countries; numbers that are
already international are used as-is. If a profile has no mobile number, the
alert is skipped quietly (logged).

---

## 6. Which files carry the integration

| Layer | File |
|---|---|
| PHP engine (cPanel) | `api/chat_alerts.php` |
| Node/Bun engine (AI Studio) | `server/services/chatAlertService.ts` |
| Order placed hooks | `api/services/index.php`, `server/routes/services.ts` |
| Order completed hooks | `api/admin/approve_order.php`, `api/admin/family_approval.php`, `api/admin/orders.php`, `api/admin/index.php`, `server/routes/admin.ts` |
| Settings + test endpoint | `api/admin/index.php` (`admin/testing/chat-alert`), `server/routes/admin.ts` (`/testing/chat-alert`) |
| Admin UI | `src/components/admin/ChatAlertConfigPanel.tsx` |

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| Test says *“WhatsApp Phone Number ID / Access Token missing”* | Fill both fields (or set the env vars) and save. |
| WhatsApp error `(#131030) Recipient phone number not in allowed list` | Add the test number as a recipient in WhatsApp Manager → API Setup, or wait for the template to be approved and use a real customer number. |
| WhatsApp error `(#132000) Template ... does not exist` | The template name/language must match an *approved* template in WhatsApp Manager. |
| Viber returns status `12` / `receiver not found` | The number has not subscribed to your bot — message the bot first, or use the Business Messages webhook provider. |
| Nothing is sent at all | Check **Alert Rules** master switch + the per-event switch, and that the channel is ticked. Failures appear in `CHAT_ALERT_SENT` audit entries and the PHP error log. |
