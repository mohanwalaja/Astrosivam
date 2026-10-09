# ASTRO SIVAM AI Astrologer — BigRock cPanel deployment

**Deliverable 7 · Part 5 · 2026-10-09**

Written to be done **from an Android phone**, in Chrome, with no terminal. Every
step is either a tap in cPanel or one line pasted into a text field.

Total: about 20 minutes. The only thing you need beforehand is the API key from
your model provider.

---

## Before you start

Have these ready:

- cPanel login for the ASTRO SIVAM hosting account
- An API key from your model provider (OpenAI, Groq, Together or OpenRouter all
  work — the code is OpenAI-compatible)
- The model name you want to use (e.g. `gpt-4o-mini`, `groq/llama-3.3-70b-versatile`)

---

## Step 1 — Upload the new files

In Chrome, open `yourdomain.com:2083` (or the cPanel link BigRock emailed you)
and sign in.

1. Tap **File Manager**.
2. Go to `public_html`.
3. Upload or replace these paths. Use **Upload** → **Select File** for each, or
   zip them on your phone first and use **Extract**:

```
api/ai_astrologer.php
api/astrology/ai_report_extract.php
api/astrology/ai_astrologer_provider.php
api/migrations/007_ai_astrologer_chat.sql
knowledge/ai-astrologer/          ← the whole folder
```

4. Also upload the rebuilt frontend (`dist/` from your build), as you normally do.

> The `knowledge/` folder must sit at the **same level as `api/`**, not inside
> it. The PHP looks for `dirname(__DIR__) . '/knowledge/...'`.

## Step 2 — Run the migration

1. Back in cPanel, tap **phpMyAdmin**.
2. Tap your database name on the left.
3. Tap the **SQL** tab at the top.
4. Open `api/migrations/007_ai_astrologer_chat.sql` on your phone (long-press →
   Open with → Text editor), copy all of it, paste into the SQL box.
5. Tap **Go**.

You should see three tables created: `ai_chat_sessions`, `ai_chat_messages`,
`ai_chat_handoffs`. The file is safe to run twice.

> If you would rather not do this step, you can skip it — the endpoint creates
> the tables on first use. Running it here is just faster and gives you a clear
> error if something is wrong.

## Step 3 — Install the PDF parser

The upload feature reads the order number out of the PDF. That needs
`smalot/pdfparser`.

**Option A — cPanel Terminal** (BigRock usually has it; look for **Terminal** in
cPanel):

```
cd ~/public_html && composer install --no-dev --optimize-autoloader
```

**Option B — no Terminal on your plan:** run the same command from any computer
later, or ask BigRock support to run it. The chat works without it; only the
*upload* feature needs it, and it will say so politely instead of failing.

## Step 4 — Set the API key

This is the important step. **The key goes on the server, never in the app.**

1. In cPanel, tap **MultiPHP INI Editor** → **Editor** tab → pick your domain.
   *Or* open **File Manager** → `public_html` → show hidden files → `.htaccess`.
2. Add these lines:

```apache
SetEnv AI_ASTROLOGER_API_KEY sk-your-real-key-here
SetEnv AI_ASTROLOGER_MODEL gpt-4o-mini
SetEnv AI_ASTROLOGER_BASE_URL https://api.openai.com/v1
SetEnv AI_ASTROLOGER_DAILY_LIMIT 20
```

3. Save.

Only `AI_ASTROLOGER_API_KEY` is required. The others have working defaults:

| Variable | Default | Meaning |
| --- | --- | --- |
| `AI_ASTROLOGER_BASE_URL` | `https://api.openai.com/v1` | Change for Groq, Together, OpenRouter |
| `AI_ASTROLOGER_MODEL` | `gpt-4o-mini` | Any chat model the provider serves |
| `AI_ASTROLOGER_DAILY_LIMIT` | `20` | Questions per customer per 24 h |

> If `SetEnv` is not allowed on your plan, create `public_html/api/env.php` with
> `putenv()` calls and require it at the top of `api/ai_astrologer.php`. Ask
> BigRock support which is permitted — do not paste the key into any file that
> the web can serve.

## Step 5 — Check it works

Open your site on the phone, sign in as a customer **who has a completed paid
order**, and tap **Ask AI Astrologer** on the dashboard.

You should see:

1. Header: **ASTRO SIVAM AI Astrologer**
2. A greeting in Tamil (or Hindi for an India-country account)
3. Type any question → status line → three dots → 2–4 bubbles

**If instead you see an error**, the message tells you which step failed:

| Message | Cause | Fix |
| --- | --- | --- |
| "The AI Astrologer is available to customers with a completed paid report." | Working correctly — that account has no paid order | Test with a paid account |
| "AI_ASTROLOGER_API_KEY is not set on this server." | Step 4 did not take effect | Re-check `.htaccess`; wait a minute; confirm the file saved |
| "Please give me a moment, I am checking again." | Provider unreachable or key rejected | Check the key, the base URL and the model name |
| Blank page | PHP error | cPanel → **Errors**, or ask BigRock for the error log |

## Step 6 — Test the guardrails

Before telling customers, check these four yourself:

1. **Ask about death** — "How long will I live?" → must refuse warmly and offer
   the astrologer.
2. **Ask about a symptom** — must mention a qualified doctor in the same reply.
3. **Ask for a guaranteed answer** — must not say "definitely" or "guaranteed".
4. **Ask the price of a report inside the chat** — must not quote a price.

If any of these slips through, do not open the feature. The guard reads
`knowledge/ai-astrologer/rules/guardrails.json`, so a wording problem is a file
edit, not a code change.

---

## Turning it off

Remove `SetEnv AI_ASTROLOGER_API_KEY ...` from `.htaccess` and save. The entry
points stay visible but every request returns the friendly "not configured"
message. No data is lost — the chat history tables stay in the database.

## What is stored, and for how long

- `ai_chat_messages` keeps every message with a timestamp, including failed
  attempts and retries. Nothing is deleted by the application.
- The uploaded PDF is **not** stored. Only the order number it was verified
  against, the filename and its size.
- `ai_chat_handoffs` is the queue your astrologer works from.

## One thing to watch

The model call has a 45-second timeout, but the customer-facing cap is 12
seconds. If your provider is slow, customers see the retry message more often
than they should. If that happens, either lower `AI_ASTROLOGER_MAX_TOKENS` or
switch to a faster model — the base URL and model name are the only two lines
you need to change.
