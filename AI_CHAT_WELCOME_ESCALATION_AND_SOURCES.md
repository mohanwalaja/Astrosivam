# AI Astrologer — Welcome Greeting, Order Answers, Complaint Escalation, Multi-Source Search

> Change date: 2026-10-10

## What this adds

### 1. Delivered-order welcome greeting
When a paid customer (order approved + report emailed) opens the AI Astrologer
chat, the greeting now names their delivered report:

- `session` returns `deliveredAt` alongside `orderNumber` / `serviceType`
  (`api/ai_astrologer.php`).
- `AiAstrologerPanel.tsx` greets with the service title and order number in
  en/ta/hi, e.g. *"Hello — thank you for your order. Your Birth Jathagam
  report (#ASTRO-1234) has been delivered to your email. Ask me anything
  about your chart or your order."* Admins and report-less sessions keep the
  general greeting.

### 2. The AI can answer questions about the customer's own order
- `astro_ai_order_details_text()` flattens the bound order row (number,
  service, amount paid, payment status, placed date, delivery date, status)
  into a new `{{ORDER_DETAILS}}` prompt placeholder.
- The system prompt tells the model to answer order/delivery/invoice
  questions **only** from those facts, and keeps the no-pricing rule for
  anything that is not the customer's own receipt.

### 3. Complaints are forwarded to the admin panel automatically
- `astro_ai_escalation_reason()` screens every question with trilingual
  complaint keywords (en/ta/hi: complaint, refund, wrong/missing report,
  overcharge, fraud, புகார், ரீஃபண்ட், शिकायत, …).
- A detected complaint inserts a `NEW` row into `ai_chat_handoffs` (the table
  already had a full queue lifecycle) and the customer sees a confirmation
  bubble in their language. Non-complaint handoffs (health, declined topics)
  still only *offer* the astrologer — they are queued when the customer
  accepts, so the queue is never flooded.
- New admin routes in `api/admin/index.php`:
  `GET /api/admin/ai-handoffs` (list, NEW first) and
  `POST /api/admin/ai-handoffs` (`{id, status, adminNotes}` with
  NEW/ACKNOWLEDGED/RESOLVED, audited via `logAudit`).
- Admin portal gains an **AI Chat Escalations** tab (new-count badge,
  customer contact, language, reason, order number, notes, Acknowledge /
  Mark Resolved).

### 4. Unmatched astrology questions consult multiple sources first
When no life-area card matches directly, `AstroAiProvider::consultMoreSources()`
consults, in order:
1. every life-area card with a loose phrase match (not just the best one),
2. the remedies registry on planet names mentioned in the question,
3. the customer's own chart period (already in the prompt).

Found material is injected with a `Consulted: …` source line. If nothing truly
applies, the model is told to say so honestly and offer the astrologer handoff
— no invented sources. Everything stays inside the curated knowledge base;
there is no external web search.

## Guarding tests
`tests/ai-astrologer-access.test.ts` now checks the trilingual complaint
detector, the queue insert, the admin routes and `deliveredAt`;
`tests/ai-astrologer-provider.test.ts` pins `consultMoreSources` and the
`ORDER_DETAILS` fill. The existing placeholder-parity tests cover the prompt
side. Full `npm test` suite passes.

## Deployment
Standard deploy: upload `api/*` (incl. `api/astrology/ai_astrologer_provider.php`
and `api/admin/index.php`), the rebuilt `dist/*`, and `knowledge/` (the Git
cPanel deploy handles the last one). **No database migration** — the
`ai_chat_handoffs` table already exists from migration 007; the admin route
bootstraps it on fresh databases.
