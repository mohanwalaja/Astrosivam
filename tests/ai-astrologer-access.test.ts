/**
 * ASTRO SIVAM AI Astrologer — Part 4: access control, rate limit and history.
 *
 * PHP cannot be executed in this sandbox, so this test verifies the PHP by
 * reading it: that both gates run before any action, that the paid check is the
 * strict one, that the migration is idempotent and its columns really exist, and
 * that no AI credential appears anywhere the browser can reach.
 *
 * This is a static contract test, not a runtime test. It cannot prove the PHP
 * runs — only that it does not contradict the schema or the brief.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sliceText, assertNonEmptySet } from './helpers/sourceSlice';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const endpoint = read('api/ai_astrologer.php');
const migration = read('api/migrations/007_ai_astrologer_chat.sql');
const schema = read('api/schema.sql');
const panel = read('src/components/ai-astrologer/AiAstrologerPanel.tsx');
const client = read('src/services/aiAstrologerApi.ts');
const dashboard = read('src/pages/CustomerDashboard.tsx');
const launcher = read('src/components/ai-astrologer/AiAstrologerLauncher.tsx');
const app = read('src/App.tsx');
const navbar = read('src/components/layout/Navbar.tsx');
const footer = read('src/components/layout/Footer.tsx');


/**
 * PHP source with comments removed. Structural assertions must run against
 * code, not prose: an explanatory comment that mentions a function name would
 * otherwise be mistaken for a call to it.
 */
/** PHP source with comments removed, string contents intact. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*#(?!\[).*/gm, '');
}

/**
 * As code(), plus string contents blanked. Only for the call scan: "... not
 * wired yet (Part 5)." must not be read as a call to yet(). Kept separate
 * because blanking strings would destroy assertions like 'status' => 'FAILED'.
 */
function codeNoStrings(src: string): string {
  return code(src)
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    throw err;
  }
}

/* ------------------------------------------------------------------ */

check('the paid-order gate is strict for customers and admins bypass it by database role', () => {
  assert.match(endpoint, /function astro_ai_is_admin/);
  assert.match(endpoint, /function astro_ai_require_paid_order/);
  const adminRole = sliceText(endpoint, 'function astro_ai_is_admin', 'function astro_ai_require_paid_order', 'admin role check');
  assert.match(adminRole, /\$user\['role'\]/);
  assert.match(adminRole, /=== 'admin'/);

  const gate = sliceText(
    endpoint, 'function astro_ai_require_paid_order', 'function astro_ai_chat_entitlement', 'requirePaidOrder body'
  );
  assert.match(gate, /if \(astro_ai_is_admin\(\$user\)\)\s*\{\s*return \$user;/,
    'admins must bypass customer purchase and report-expiry checks');
  assert.match(gate, /403\)/, 'customers without entitlement must receive 403');
  assert.match(gate, /message_ta/);
  assert.match(gate, /message_hi/);

  const entitlement = sliceText(
    endpoint, 'function astro_ai_chat_entitlement', 'function astro_ai_entitlement_copy', 'customer entitlement body'
  );
  assert.match(entitlement, /NO_PAID_ORDER/, 'customers must receive a distinct refusal code');
  assert.match(entitlement, /payment_confirmed\s*=\s*1/, 'customers must require confirmed payment');
  assert.doesNotMatch(entitlement, /FREE_BETA/,
    'free-beta first reports must qualify for chat exactly like paid orders');
  assert.match(entitlement, /status IN \('COMPLETED', 'PROCESSING'\)/, 'must restrict to real statuses');
  assert.match(entitlement, /refund_status/, 'a refunded order must not qualify');
  assert.match(entitlement, /email_status = 'SENT'/, 'chat access must wait for successful email delivery');
  assert.match(entitlement, /email_sent_at IS NOT NULL/);
  assert.match(entitlement, /user_id = :uid/, 'must be scoped to the customer');
  assert.match(entitlement, /CHAT_WINDOW_EXPIRED/, 'customer chat must still expire by report window');
});

check('BOTH gates run before any action is dispatched', () => {
  const dispatch = endpoint.indexOf('switch ($action)');
  const gateCall = endpoint.indexOf('$user = astro_ai_gate($pdo)');
  assert.ok(gateCall > 0, 'the combined gate is never called');
  assert.ok(gateCall < dispatch, 'the gate must run before the action switch, not inside a branch');

  const combined = sliceText(
    endpoint, 'function astro_ai_gate', 'function astro_ai_daily_limit', 'combined gate body'
  );
  assert.match(combined, /requireAuth\(\$pdo\)/, 'gate 1 missing');
  assert.match(combined, /astro_ai_require_paid_order\(\$pdo, \$user\)/, 'gate 2 missing');

  // No action handler may skip the gate by taking the user from the request.
  for (const handler of ['session', 'history', 'ask', 'upload', 'handoff', 'usage']) {
    assert.ok(
      !new RegExp(`case '${handler}':[\\s\\S]{0,200}getAuthUser`).test(endpoint),
      `the "${handler}" action re-derives auth instead of using the gate`
    );
  }
});

check('the daily question limit uses the existing rate limiter', () => {
  assert.match(endpoint, /astro_rate_limit_enforce\(/);
  assert.match(endpoint, /AI_ASTROLOGER_RATE_BUCKET/);
  assert.match(endpoint, /86400/, 'the window must be one day');
  assert.match(endpoint, /astro_env_int\('AI_ASTROLOGER_DAILY_LIMIT'/, 'the limit must be configurable');

  // astro_rate_limit_enforce() already counts the request (enforce -> hit ->
  // upsert). A second bump would charge two questions for one answer.
  const askBody = code(sliceText(
    endpoint, 'function astro_ai_action_ask', 'function astro_ai_action_upload', 'ask handler body'
  ));
  // The negative assertion below is only meaningful if the slice has content, so
  // pin that first: an empty slice would make "!bump" pass for no reason.
  assert.ok(askBody.length > 400, 'the ask handler slice looks truncated');
  assert.ok(!/astro_rate_limit_bump\(/.test(askBody), 'the ask handler double-counts the question');
  // Customers are counted; authenticated admins are deliberately unlimited.
  assert.match(askBody, /\$isAdmin = astro_ai_is_admin\(\$user\)/);
  assert.match(askBody, /if\s*\(!\$isAdmin\)/);
  assert.match(askBody, /astro_rate_limit_enforce\(\s*\$pdo,\s*AI_ASTROLOGER_RATE_BUCKET/);
  assert.match(askBody, /'remainingToday'\s*=>\s*\$isAdmin\s*\?\s*null/);
});

check('the usage counter accounts for window expiry', () => {
  const usage = sliceText(
    endpoint, 'function astro_ai_usage_count', 'function astro_ai_action_usage', 'usage counter body'
  );
  assert.match(usage, /windowStartedAt/, 'astro_rate_limit_fetch() ignores expiry, so the caller must handle it');
  assert.match(usage, /time\(\) - AI_ASTROLOGER_WINDOW_SECONDS/);
});

check('admin usage is reported as unlimited instead of showing the customer quota', () => {
  const usage = sliceText(
    endpoint, 'function astro_ai_action_usage', '/* ================================================================== */', 'usage handler body'
  );
  assert.match(usage, /if \(astro_ai_is_admin\(\$user\)\)/);
  assert.match(usage, /'limit'\s*=>\s*null/);
  assert.match(usage, /'remaining'\s*=>\s*null/);
  assert.match(usage, /'unlimited'\s*=>\s*true/);
});

check('the migration is idempotent and creates all three tables', () => {
  const tables = [...migration.matchAll(/CREATE TABLE IF NOT EXISTS `(\w+)`/g)].map((m) => m[1]);
  assert.deepEqual(tables, ['ai_chat_sessions', 'ai_chat_messages', 'ai_chat_handoffs']);
  // no bare CREATE TABLE, or a re-run would error out
  assert.ok(!/CREATE TABLE (?!IF NOT EXISTS)/.test(migration), 'a CREATE TABLE without IF NOT EXISTS is not re-runnable');
  assert.match(migration, /ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/g);
});

check('runtime schema bootstrap strips SQL comments before splitting on semicolons', () => {
  const splitter = sliceText(
    endpoint, 'function astro_ai_migration_statements', 'function astro_ai_ensure_tables', 'migration statement splitter'
  );
  const stripCommentsAt = splitter.indexOf('preg_replace');
  const splitStatementsAt = splitter.indexOf("explode(';', $sql)");
  assert.ok(stripCommentsAt >= 0 && splitStatementsAt > stripCommentsAt,
    'full-line comments must be stripped before splitting; the migration documentation contains semicolons');
  const ensureTables = sliceText(
    endpoint, 'function astro_ai_ensure_tables', 'function astro_ai_new_session_id', 'schema bootstrap'
  );
  assert.match(ensureTables, /foreach \(astro_ai_migration_statements\(\$sql\) as \$statement\)/,
    'table setup must use the tested splitter');

  // Exercise the migration through the same two parsing steps. If a future
  // comment adds a semicolon, it must not break a CREATE TABLE statement.
  const executableSql = migration.replace(/^[ \t]*--.*$/gm, '');
  const statements = executableSql.split(';').map((s) => s.trim()).filter(Boolean);
  const createdTables = statements.map((s) => s.match(/^CREATE TABLE IF NOT EXISTS `(\w+)`/)?.[1]);
  assert.deepEqual(createdTables, ['ai_chat_sessions', 'ai_chat_messages', 'ai_chat_handoffs']);
  assert.match(endpoint, /\$pdo->exec\(\$statement\)/);
});

check('every message is stored with a timestamp and a status', () => {
  assert.match(migration, /`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP/);
  assert.match(migration, /`role` ENUM\('customer', 'assistant', 'system', 'handoff'\)/);
  assert.match(migration, /`status` ENUM\('SAVED', 'SENT', 'FAILED', 'RETRIED'\)/);
  assert.match(migration, /`attempt` TINYINT/);
  // a failed send is a row, not a silent gap
  assert.match(endpoint, /'status' => 'FAILED'/);
});

check('the column types match api/schema.sql, not a tidied-up INT', () => {
  // orders.id, orders.user_id and users.id are VARCHAR(64). A join against INT
  // would silently match nothing.
  assert.match(schema, /`id` VARCHAR\(64\) NOT NULL PRIMARY KEY/);
  assert.match(schema, /`user_id` VARCHAR\(64\) NOT NULL/);
  assert.match(migration, /`user_id` VARCHAR\(64\) NOT NULL/);
  assert.match(migration, /`order_id` VARCHAR\(64\) NULL/);
  assert.match(migration, /`order_number` VARCHAR\(32\) NULL/);
  assert.match(schema, /`order_number` VARCHAR\(32\) NOT NULL UNIQUE/);
});

check('every table and column the endpoint touches actually exists', () => {
  const all = schema + migration;
  const defined = new Set([...all.matchAll(/CREATE TABLE IF NOT EXISTS `?(\w+)`?/g)].map((m) => m[1]));
  const columns = new Set([...all.matchAll(/`(\w+)` (?:VARCHAR|INT|BIGINT|TINYINT|DATETIME|TEXT|MEDIUMTEXT|LONGTEXT|ENUM|DECIMAL)/g)].map((m) => m[1]));

  const usedTables = new Set([...endpoint.matchAll(/(?:FROM|INTO|UPDATE)\s+(\w+)/g)].map((m) => m[1]));
  for (const t of usedTables) {
    assert.ok(defined.has(t), `endpoint queries undefined table "${t}"`);
  }

  for (const c of ['payment_confirmed', 'refund_status', 'service_type', 'order_number', 'message_count', 'last_message_at']) {
    assert.ok(columns.has(c), `endpoint uses undefined column "${c}"`);
    assert.ok(endpoint.includes(c));
  }
});

check('the endpoint only calls functions that exist somewhere in api/', () => {
  // Catches the class of bug that a missing require_once causes on shared
  // hosting: a fatal error on the first request.
  const required = [...endpoint.matchAll(/require_once __DIR__ \. '([^']+)'/g)].map((m) => m[1]);
  const loaded = ['api/ai_astrologer.php', ...required.map((r) => path.posix.join('api', r.replace(/^\//, '')))];
  const available = new Set<string>();
  for (const f of loaded) {
    if (!fs.existsSync(path.join(root, f))) {
      assert.fail(`endpoint requires a file that does not exist: ${f}`);
    }
    // Nested requires must resolve too. A broken path inside a required file
    // (say api/astrology/ requiring '/config.php' instead of '/../config.php')
    // fatals the endpoint with an empty HTTP 500 exactly like a broken
    // top-level require would, so it belongs to the same class of bug.
    // Column-0 requires only: indented ones are guarded runtime includes
    // (e.g. engine.php's optional vendor/autoload.php behind is_file()).
    for (const m of read(f).matchAll(/^require(?:_once)? __DIR__ \. '([^']+)'/gm)) {
      const nested = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]));
      assert.ok(
        fs.existsSync(path.join(root, nested)),
        `${f} requires a file that does not exist: ${nested}`
      );
    }
    for (const m of read(f).matchAll(/function\s+([a-z_][a-z0-9_]*)\s*\(/g)) available.add(m[1]);
  }

  const builtins = new Set(`if foreach for while switch catch function return use array_map array_filter
    define strtotime ceil gmdate time error_log is_numeric file_get_contents json_decode is_file
    array_reverse array_slice implode explode trim basename pathinfo strtolower strtoupper mb_strlen mb_substr
    mb_strpos microtime round max min is_string is_array is_uploaded_file file_get_contents json_decode
    random_bytes bin2hex header error_log time date count in_array isset empty class_exists file_exists
    is_readable strpos substr array_keys array_values intval number_format htmlspecialchars http_response_code
    exit dirname preg_split preg_replace str_replace file`.split(/\s+/));

  const called = new Set([...codeNoStrings(endpoint).matchAll(/(?<![->:\w$])([a-z_][a-z0-9_]*)\s*\(/g)].map((m) => m[1]));
  const tableNames = /^(ai_chat_\w+|orders|users|api_rate_limits)$/;
  const missing = [...called].filter(
    (f) => !available.has(f) && !builtins.has(f) && !tableNames.test(f)
  );
  assert.deepEqual(missing, [], `endpoint calls undefined functions: ${missing.join(', ')}`);
});

check('getDbConnection comes from db.php, which config.php does NOT include', () => {
  assert.ok(!/require.*db\.php/.test(read('api/config.php')), 'if config.php starts including db.php this check is obsolete');
  assert.match(endpoint, /require_once __DIR__ \. '\/db\.php'/, 'the endpoint must require db.php itself');
});

check('no AI credential is reachable from the browser', () => {
  for (const [name, src] of [['panel', panel], ['client', client], ['dashboard', dashboard]] as const) {
    assert.ok(
      !/sk-[A-Za-z0-9]{16,}|api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{16,}|AI_ASTROLOGER_API_KEY/.test(src),
      `${name} appears to contain a credential`
    );
    assert.ok(!/process\.env\./.test(src), `${name} reads an environment variable in the browser`);
  }
  // The client must talk to our PHP only, never to a model provider directly.
  assert.ok(!/api\.openai\.com|generativelanguage\.googleapis\.com|api\.anthropic\.com/.test(client));
  assert.match(client, /ai_astrologer\.php/);
});

check('the chat header always names the AI Astrologer and never a person', () => {
  assert.match(panel, /ASTRO SIVAM AI Astrologer/);
  assert.match(panel, /const DISCLAIMER: Record<ChatLanguage, string>/);
  assert.match(panel, /not a substitute for medical, legal or financial advice/);
  // trilingual disclaimer, status text and handoff label
  for (const token of ['DISCLAIMER', 'STATUS', 'GREETING', 'RETRY_TEXT', 'HANDOFF_LABEL']) {
    const block = sliceText(panel, `const ${token}`, 'interface Props', `${token} block`);
    for (const key of ['en:', 'ta:', 'hi:']) {
      assert.ok(block.includes(key), `${token} is missing a ${key} entry`);
    }
  }
});

check('the 12-second cap is enforced and the real response time counts', () => {
  assert.match(panel, /hardCap: 12000/);
  // every timer that delays a bubble must be clamped against the cap
  const bubbleLoop = sliceText(
    panel, 'bubbles.forEach', 'setRemaining(reply.remainingToday)', 'bubble timing loop'
  );
  assert.match(bubbleLoop, /TIMING\.hardCap/, 'bubble timing is not clamped to the cap');
  assert.match(panel, /statusMin: 2000/);
  assert.match(panel, /statusMax: 4000/);
});

check('the old floating-chat position now hosts the email-gated AI Astrologer for customers and admins', () => {
  assert.match(app, /<AiAstrologerLauncher \/>/);
  assert.match(launcher, /fixed bottom-5 right-5/);
  assert.match(launcher, /Ask AI Astrologer/);
  assert.match(launcher, /aiAstrologer\.usage\(\)/,
    'customer visibility must be confirmed by the server entitlement');
  assert.match(launcher, /if \(isAdmin\)/,
    'admins must always see the launcher when signed in');
  assert.match(launcher, /window\.setInterval/,
    'delivery entitlement should refresh while the customer has the site open');
  assert.match(launcher, /<AiAstrologerPanel/);
  assert.match(panel, /Administrator access · no daily limit/);
  assert.match(dashboard, /Ask about this report/);
  assert.match(dashboard, /order\.emailSentAt/,
    'the report-specific dashboard action must wait for email delivery');
  assert.match(dashboard, /status === 'COMPLETED' && order\.hasPdf && order\.emailStatus === 'SENT'/);
  assert.doesNotMatch(dashboard, /serviceMode !== 'FREE_BETA'/,
    'the dashboard chat shortcut must also appear on delivered free-beta first reports');
  assert.match(panel, /\[customerId, orderId\]/);
  const session = sliceText(
    endpoint, 'function astro_ai_action_session', 'function astro_ai_action_history', 'session handler'
  );
  assert.match(session, /astro_ai_chat_entitlement/,
    'the floating customer chat should automatically bind to the delivered report');
});

check('the old canned live-chat widget and its entry points are completely removed', () => {
  assert.equal(fs.existsSync(path.join(root, 'src/components/common/LiveChatWidget.tsx')), false);
  for (const source of [app, navbar, footer]) {
    assert.doesNotMatch(source, /LiveChatWidget|app:open-live-chat|astrosivam-live-chat-launcher|Live Chat/);
  }
});

check('a generation failure is recorded, not swallowed, and costs nothing', () => {
  // Part 5 replaced the throwing stub with the real provider, so what matters now
  // is that a failure still produces a FAILED row and the friendly retry text.
  const ask = code(sliceText(
    endpoint, 'function astro_ai_action_ask', 'function astro_ai_action_upload', 'ask handler body'
  ));
  assert.match(ask, /catch \(Throwable \$e\)/);
  assert.match(ask, /'status' => 'FAILED'/);
  assert.match(ask, /error_message/);
  assert.match(ask, /GENERATION_FAILED/);
  assert.match(ask, /Please give me a moment, I am checking again\./);
  // the question was stored BEFORE the slow work, so a failure cannot lose it
  const savedAt = ask.indexOf('$questionId = astro_ai_save_message');
  const tryAt = ask.indexOf('try {');
  assert.ok(savedAt > 0 && tryAt > 0 && savedAt < tryAt,
    'the question must be persisted before generation starts, so a failure cannot lose it');
  // and the endpoint delegates to the provider rather than calling a model itself
  assert.match(code(endpoint), /AstroAiProvider::answer\(/);
  assert.ok(!/curl_init/.test(code(endpoint)), 'the endpoint must not call a model directly');
});

console.log(`\n[OK] ai-astrologer access control: ${passed} checks passed`);
