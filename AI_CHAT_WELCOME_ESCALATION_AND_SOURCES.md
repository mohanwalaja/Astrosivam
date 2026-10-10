# Astrologer chat: welcome, access and human handoff

## Welcome and report context

When a customer opens the chat from an eligible delivered report, the server returns the bound report/order label and the frontend can name it in the greeting. The reply engine rebuilds chart facts from the customer's own saved order inputs; it does not trust a chart supplied by the browser.

The chat's customer-facing description should stay accurate: it answers supported chart/report questions using reviewed ASTRO SIVAM rules and references. It does not promise general order-support answers or open-ended AI responses.

## Local-only replies

Replies use local chart calculations, report readings, curated life-area rules and remedies, and safety/refusal rules. No external AI service or API key is involved. The 224-record source registry is a catalogue with many metadata/link entries, not a 224-book full-text search index. The active answer path uses reviewed local rules and their permitted citations; an unmatched question should be acknowledged and may be handed to a human rather than guessed.

## Complaints and human handoff

`astro_ai_escalation_reason()` checks English, Tamil, and Hindi complaint terms such as refund, missing/wrong report, overcharge, and fraud. A detected complaint is recorded in `ai_chat_handoffs`; the customer receives a confirmation. Other safety/refusal routes offer a human handoff where appropriate, and a customer can explicitly send a handoff through the existing action.

Administrators can review/update the queue through the admin handoff routes. A failed queue insert is logged and does not replace the local customer reply.

## Verify and deploy

Relevant contracts live in `tests/ai-astrologer-access.test.ts`, `tests/ai-astrologer-failure-path.test.ts`, and the local reply-path tests. Deploy `api/`, the rebuilt frontend, and the complete `knowledge/` directory beside `api/`. An administrator can run **Admin Portal → Setup → Check Source-Based Astrologer**; the diagnostic makes no network request.
