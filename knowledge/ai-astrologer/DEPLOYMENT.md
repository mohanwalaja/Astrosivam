# ASTRO SIVAM source-based astrologer — BigRock cPanel deployment

The current customer reply path is local-only: it uses the chart engine, report readings, curated rule/remedy JSON, and safety rules. **No API key, model name, provider URL, or external AI/chat service is required or used.**

These steps are written for cPanel File Manager and phpMyAdmin, including use from a phone.

## Before you start

Have these ready:

- cPanel login for the ASTRO SIVAM hosting account
- The built frontend files (`dist/`)
- The repository's API files and complete `knowledge/` directory

## Step 1 — Deploy the files

In cPanel File Manager, upload or replace the files under `public_html`. At minimum, the deployed tree must include:

```text
api/ai_astrologer.php
api/astrology/ai_astrologer_offline.php
api/astrology/ai_astrologer_provider.php
api/migrations/007_ai_astrologer_chat.sql
knowledge/ai-astrologer/rules/
knowledge/ai-astrologer/sources.json
```

Upload the rebuilt frontend (`dist/`) as usual. The `knowledge/` folder belongs beside `api/` in the document root, not inside it. `deploy_cpanel.sh` copies it during SSH deployment; otherwise upload it by hand.

## Step 2 — Ensure the database tables exist

The endpoint can create the chat tables on first use. To install them explicitly:

1. Open **phpMyAdmin** from cPanel and select the application database.
2. Open the SQL tab.
3. Paste the contents of `api/migrations/007_ai_astrologer_chat.sql` and run it.

The migration creates `ai_chat_sessions`, `ai_chat_messages`, and `ai_chat_handoffs`; it is safe to run more than once.

## Step 3 — Check PHP and local knowledge files

The required runtime includes PHP `mbstring` for Tamil/Hindi text handling. Sign in as an administrator, then use **Admin Portal → Setup → Check Source-Based Astrologer**, or open:

```text
/api/ai_astrologer.php?action=diagnose
```

The check is admin-only. It reports the local PHP/knowledge-file checks and source registry counts. It does not make any outbound network request, even if an old API key is still saved in hosting settings. Resolve any blocking item, most commonly a missing `knowledge/` directory or missing `mbstring`.

## Step 4 — Test the chat

Sign in as a customer with a completed report and open the astrologer chat from the report/dashboard. Try questions that exercise reviewed routes:

1. A supported chart area such as career or marriage — it should use the customer's own report/chart when available.
2. A health question — the reply must direct the customer to a qualified doctor.
3. A question asking for a guaranteed outcome, lifespan prediction, or investment decision — it should follow the relevant safety/refusal route.
4. A topic not covered by the local rules — the chat should be honest about its limits and offer a human handoff rather than inventing an answer.

A server setup error should be diagnosed with the admin check; no key or provider connection is part of the fix.

## Source-library limitation

The source registry contains 224 catalogue records, not 224 searchable full-text books. Only 11 records are marked `content-read`; most are metadata or links. Customer answers use the specific reviewed local rules/remedies and their eligible references. The catalogue is not treated as a full-text search index.

## Chat data

- `ai_chat_messages` stores chat messages and timestamps under the existing application retention policy.
- The PDF upload flow verifies a report but does not store the uploaded PDF as a knowledge source.
- `ai_chat_handoffs` stores messages referred to a human administrator.
