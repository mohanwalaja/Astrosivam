# AI Astrologer chat not replying — cause, fix and how to check it

**Symptom reported:** the AI Astrologer answers nothing. Every question shows the
typing indicator and then, eventually, the single line *"Please give me a moment,
I am checking again."* Retrying does not help.

That one line is the whole problem: it is the wording the chat uses for **every**
failure, so a missing API key, a missing knowledge directory, a blocked outbound
connection and a slow model are indistinguishable in the chat window. Nothing on
screen says which one it is, so there is nothing to act on.

## The 30-second check

Sign in as an **administrator** and open:

```
/api/ai_astrologer.php?action=diagnose&ping=1
```

or use **Admin Portal → Setup → "Check AI Astrologer"**, which prints the same
result into the diagnostics console.

It walks the reply path in order and names the first thing that is wrong:

| Check | What a failure means |
|---|---|
| `curl` | The PHP curl extension is not loaded; no model call is possible. |
| `mbstring` | Tamil/Hindi text handling would fail. |
| `apiKey` | PHP cannot see a key. The detail says whether it found one in the environment or in the admin settings, and shows its last four characters. `placeholder-only` means a copied `.env.example` value is being used. |
| `kb-prompt`, `kb-lifeAreas`, `kb-guardrails` | The `knowledge/` directory is not in the document root. This makes **every** question fail, because `systemPrompt()` throws. |
| `systemPrompt` | The prompt file is present but has no extractable ```text block. |
| `modelPing` | The live call. Reports the HTTP status and latency, or the curl error. |

The response also summarises the last 50 assistant rows — a run of `FAILED` rows
with one identical `error_message` is a configuration problem, not a slow model.

## What was actually wrong, and what changed

### 1. The reason was thrown away at the client

`AiAstrologerPanel.tsx` used the server's own message only for 403 and 429. Every
other error — including the 503 that says *"the model is not configured, set
AI_ASTROLOGER_API_KEY"* — was replaced by `RETRY_TEXT`. The most informative
message in the system was the one being discarded.

**Fix:** a configuration failure (`AI_NOT_CONFIGURED`) now shows the server's
message; only genuinely transient failures get the retry wording.

### 2. One failed reply froze the panel

On failure the panel set `phase` to `'failed'` and only the small "Retry" link
reset it. Meanwhile `send()` returns early unless `phase === 'idle'`, and the
send button is disabled unless `phase === 'idle'`. So after the first failure the
chat accepted nothing: Enter did nothing and the button stayed greyed out. That
is the "does not reply to **any** question" behaviour — the later questions were
never sent at all.

**Fix:** the phase returns to `idle` after every failure, and the error bar's
Retry now resends the unanswered question (removing the bubble that got no
reply) instead of only clearing the message.

### 3. The key was readable only through `getenv()`

`AstroAiProvider::config()` called `getenv('AI_ASTROLOGER_API_KEY')` and nothing
else. On cPanel under LiteSpeed/PHP-FPM a value set with `SetEnv` in `.htaccess`
lands in `$_SERVER`, not in the process environment, so `getenv()` returns
`false` and the endpoint reports itself unconfigured while the owner is looking
at a key they did set. (The rest of the site kept working because the live
`api/config.php` holds hardcoded database credentials, so a broken `getenv()`
was invisible.)

**Fix:** the key is resolved from `getenv()`, then `$_SERVER`, then `$_ENV`, and
it can also be stored in `system_settings.general_settings.aiAstrologerSettings`
— the same place payment and chat-alert credentials live — with the environment
winning when it holds a real value. A placeholder (`your_api_key_here`,
`••••`, `***`) is treated as unset rather than attempted.

### 4. `deploy_cpanel.sh` did not copy the knowledge base

`.cpanel.yml` copies `knowledge/` to the document root; the SSH deployment
script did not. Without it `systemPrompt()` throws for every question, which is
exactly this symptom. The two deploy paths now agree, and the script warns when
the directory is missing from the checkout.

### 5. A guard retry could outlast the browser

Two generation attempts at 25s each is 50s, but the client aborts at 30s
(`ASK_TIMEOUT_MS`). The browser gave up first, the customer saw a network error,
and the server kept producing an answer nobody would receive. The budget is now
split — 20s for the first call, 8s for the retry — so the worst case is 28s.

## Verifying the generation layer locally

There is no `php` binary in the build sandbox, but the provider runs for real
under the wasm PHP runtime against the committed knowledge base:

```
npm install --no-save @php-wasm/node @php-wasm/universal
node scripts/php-ai-provider-check.mjs tests/fixtures/php-ai-probes/reply-path.php
```

That executes `config()`, `configSource()`, `diagnostics()`, `retrieve()`,
`systemPrompt()`, `checkReply()`, `toBubbles()` and the full `answer()` path. It
cannot reach a live model, so the curl round trip is still verified on the server
with `ping=1`.
