# AI Astrologer — knowledge-base mode (no API key needed)

**Problem:** the chat refused every question with *"The AI Astrologer model is not
configured on this server yet. Set the AI_ASTROLOGER_API_KEY…"*. The owner has no
API key and wants the chat to reply **only from our own sources**.

**Now:** with no key, the chat answers in **knowledge-base mode**. No outside AI
service is called. Every reply is built from:

| Source | What it gives the reply |
|---|---|
| The customer's own report (`AstroEngine` rebuilt from the saved order inputs) | The same per-area reading as their PDF — career, marriage, health, wealth, education, property, travel, current period — in en / ta / hi |
| `knowledge/ai-astrologer/rules/life-areas.json` | The curated classical rules that actually fire on that chart, with practical steps and Tamil source ids |
| `knowledge/ai-astrologer/rules/remedies.json` | Remedies per graha (day, prayer, charity, temple), or the universal ones |
| Fixed refusal routes + `guardrails.json` | Legal, investment, medicine, lifespan, curse and price questions get the safe answer and the "Talk to our astrologer" offer |

Every reply still goes through the same output guard (`AstroAiProvider::checkReply`)
as AI replies. A health answer always ends with "please see a qualified doctor".
A question the sources do not cover gets an honest "I could not find this" and
offers the human astrologer instead of guessing.

## How a question is answered

1. A refusal route matches → fixed safe answer + handoff.
2. A greeting → greeting + list of topics.
3. A life area is chosen by **whole-word** matching on the card phrases plus
   everyday words (`job`, `wedding`, `abroad`, `வேலை`, `शादी`…).
   - **Chat opened from a report** (chart attached): *"Mohan, here is what your
     horoscope shows for Career & Profession:"* + the report's reading, the
     classical rules that fired, the practical steps, and for "when" questions
     the running Dasha/Bhukti and its end date.
   - **No chart:** how Tamil astrology reads that area, plus how to get a
     personal reading (open the chat from a completed report in My Dashboard).
4. Remedy words or a planet name → remedies registry.
5. Nothing matches → honest no-match + handoff.

## Also fixed: the chart never reached the rules

`astro_ai_chart_facts()` read keys the engine never returns (`lagnaSign`,
`planetHouses`, `currentDasha`…), so every chart arrived empty, in both modes.
It now maps `AstroEngine::calculateHoroscope()`'s real output (`planetPositions`,
`lagnaRasi`, `dasha`, `saniTransit`, `sevvaiDosha`, `summary`) into the rule
vocabulary.

## With a key (optional)

Admin Portal → **AI Astrologer** still accepts a key for AI-written replies. If
the model call fails (bad key, no credit, outage) the endpoint logs the error
and answers from the knowledge base, so the customer is never left without a
reply.

The only setup problem that still stops the chat is a missing `knowledge/`
directory. The endpoint then returns `AI_NOT_CONFIGURED` and names it.

## Verify

```
npm install --no-save @php-wasm/node @php-wasm/universal
node scripts/php-ai-provider-check.mjs tests/fixtures/php-ai-probes/knowledge-base-mode.php --emit /tmp/kb.json
node node_modules/tsx/dist/cli.mjs tests/ai-astrologer-php-runtime.test.ts
```

The probe builds a real chart with the engine, maps it with the endpoint's own
`astro_ai_chart_facts()`, and asks 24 questions in all three languages with no
key set.
