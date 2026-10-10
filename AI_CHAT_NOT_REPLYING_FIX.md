# Source-based astrologer chat: diagnosis and setup

The customer chat is local-only. It does not require an API key, call an external AI/chat service, or use an AI agent to write replies. The reply path rebuilds an eligible customer's chart from their order, then combines local report readings, curated astrology rules, remedies, and safety/refusal rules. PHP performs the matching and response assembly.

## Check a deployed site

Sign in as an administrator and use **Admin Portal → Setup → Check Source-Based Astrologer**, or request:

```text
/api/ai_astrologer.php?action=diagnose
```

The endpoint is admin-only. It checks PHP `mbstring`, local rules/remedy/source files, and the source-catalogue counts. It ignores any legacy `ping` parameter and makes no outbound network request. If the chat cannot answer, check the diagnostic's blocking items and ensure the `knowledge/` directory was deployed to the website root.

## What the source library contains

The registry currently has 224 catalogue records and 13 excluded records. Of those 224, 11 are marked `content-read`; 144 are metadata-verified, 67 are linked-but-not-opened, one is catalogue-verified, and one is marked dead. The catalogue is bibliographic metadata and links—not 224 searchable full-text books. Replies are based on the specific reviewed rule and remedy files, eligible chart/report readings, and references attached to those rules; the catalogue is not treated as an indexed book corpus.

## Deploy the local files

The deployment should copy `knowledge/` into the document root. `deploy_cpanel.sh` copies it during SSH deployment; otherwise upload it by hand.

The minimum runtime needs include PHP `mbstring` and valid local JSON files under `knowledge/ai-astrologer/`. No curl/model provider, API key, model name, or provider URL is required for this chat.

## Verify in this checkout

The regular tests include static reply-path, source, safety, and access checks. To execute the PHP reply path when PHP is not installed locally, the repository also has a PHP-WASM probe:

```sh
npm install --no-save @php-wasm/node @php-wasm/universal
node scripts/php-ai-provider-check.mjs tests/fixtures/php-ai-probes/knowledge-base-mode.php
```

The test does not contact any external service. On the actual host, use the admin diagnostic above to verify deployed files and PHP capabilities.
