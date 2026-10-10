# Free Beta First Report — AI Astrologer Chat Access

> Fix date: 2026-10-10

## The problem

During the Free Beta, a customer's first order is created with
`service_mode = 'FREE_BETA'` (amount 0). After the admin approved such an
order from the admin panel, the customer received the report email and the
invoice, but the **AI Astrologer chat stayed locked** for that customer.

Root cause: the approval flow (`api/admin/approve_order.php`) correctly marks
free orders as delivered — `status = 'COMPLETED'`, `payment_confirmed = 1`,
`email_status = 'SENT'`, `email_sent_at = NOW()` — but the AI Astrologer
entitlement gate explicitly excluded every `FREE_BETA` order:

* `astro_ai_chat_entitlement()` in `api/ai_astrologer.php` —
  `AND service_mode <> 'FREE_BETA'` (twice: the entitlement lookup and the
  delivered-count lookup)
* the `session` action's report-binding query in the same file
* the "Ask about this report" shortcut in `src/pages/CustomerDashboard.tsx`
  (`order.serviceMode !== 'FREE_BETA'`)

So a delivered free first report could never open the chat, even though the
customer had received the report the chat would discuss.

## The fix

A delivered free-beta first report now qualifies for the AI Astrologer chat
**exactly like a paid order**:

* All three `service_mode <> 'FREE_BETA'` exclusions are removed from
  `api/ai_astrologer.php`. Every other protection is unchanged: the order
  still must belong to the signed-in user, be `COMPLETED`/`PROCESSING`, have
  `payment_confirmed = 1`, no refund, `email_status = 'SENT'` and a real
  `email_sent_at`, and the **7-day chat window still starts at
  `email_sent_at`** and expires the same way. A new delivered order still
  starts a fresh window.
* `CustomerDashboard.tsx` shows the "Ask about this report" button on
  delivered free orders too. The floating launcher
  (`AiAstrologerLauncher.tsx`) follows the server entitlement, so it appears
  automatically once the PHP fix is deployed.
* The generic refusal copy (en/ta/hi) no longer says "paid report", since a
  free report also qualifies.
* `tests/ai-astrologer-access.test.ts` now asserts the opposite contract:
  the entitlement must NOT exclude `FREE_BETA`, and the dashboard shortcut
  must not hide on free orders.

## Verifying after deployment

1. Sign in with the customer account (not admin), open the dashboard —
   "Ask about this report" appears on the delivered free order, and the
   floating "Ask AI Astrologer" launcher appears site-wide.
2. `POST /api/ai_astrologer.php?action=usage` returns the daily allowance
   instead of the 403 refusal.
3. After 7 days from the report email the window still expires as before.

No database migration is needed.
