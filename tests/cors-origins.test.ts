/**
 * ASTRO SIVAM — API browser-origin allow-list.
 *
 * The API is credentialed, so any origin that passes this check can call it
 * with the visitor's bearer token. These tests pin the two properties that
 * matter: production trusts only the configured exact hosts, and the developer
 * convenience wildcards never leak into production.
 *
 * Regression guard for the 6 Oct 2026 change that added bare
 * `*.run.app` / `*.googleusercontent.com` rules WITHOUT an isDev gate — anyone
 * can own a `*.run.app` hostname, so in production that was effectively
 * `Access-Control-Allow-Origin: *` with credentials.
 */
import assert from 'node:assert/strict';
import {
  isOriginAllowed,
  parseAllowedOrigins,
  describeOriginPolicy,
  DEFAULT_ALLOWED_ORIGINS
} from '../server/security/corsOrigins.js';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  [PASS] ${name}`);
}

const prod = (allowedOrigins: string[] = DEFAULT_ALLOWED_ORIGINS) => ({
  allowedOrigins,
  isDev: false
});
const dev = (allowedOrigins: string[] = DEFAULT_ALLOWED_ORIGINS) => ({
  allowedOrigins,
  isDev: true
});

console.log('--- API CORS ORIGIN ALLOW-LIST ---');

check('The production site origins are accepted in production', () => {
  assert.equal(isOriginAllowed('https://astrosivam.com', prod()), true);
  assert.equal(isOriginAllowed('https://www.astrosivam.com', prod()), true);
});

check('A request with no Origin header is allowed (same-origin / server-to-server)', () => {
  assert.equal(isOriginAllowed(undefined, prod()), true);
  assert.equal(isOriginAllowed('', prod()), true);
  assert.equal(isOriginAllowed(null, prod()), true);
});

check('An unrelated website is refused in production', () => {
  assert.equal(isOriginAllowed('https://evil.test', prod()), false);
  assert.equal(isOriginAllowed('http://astrosivam.com.evil.test', prod()), false);
});

check('Cloud Run and Google preview wildcards are REFUSED in production', () => {
  // The whole point of the fix: these must not be trusted by suffix.
  assert.equal(isOriginAllowed('https://anything.run.app', prod()), false);
  assert.equal(isOriginAllowed('https://astrosivam-abc123.run.app', prod()), false);
  assert.equal(isOriginAllowed('https://attacker-owned.run.app', prod()), false);
  assert.equal(isOriginAllowed('https://foo.googleusercontent.com', prod()), false);
});

check('localhost and sandbox previews are refused in production', () => {
  assert.equal(isOriginAllowed('http://localhost:3000', prod()), false);
  assert.equal(isOriginAllowed('https://abc123.e2b.app', prod()), false);
});

check('A Cloud Run host reaches the API by being listed in ALLOWED_ORIGINS', () => {
  const origins = parseAllowedOrigins(
    'https://astrosivam.com,https://astrosivam-abc123.run.app'
  );
  assert.equal(isOriginAllowed('https://astrosivam-abc123.run.app', prod(origins)), true);
  // ...and only that exact host, not every sibling on the same suffix.
  assert.equal(isOriginAllowed('https://attacker-owned.run.app', prod(origins)), false);
});

check('Development still accepts localhost, sandbox and Google preview hosts', () => {
  assert.equal(isOriginAllowed('http://localhost:5173', dev()), true);
  assert.equal(isOriginAllowed('http://127.0.0.1:3000', dev()), true);
  assert.equal(isOriginAllowed('https://abc123.e2b.app', dev()), true);
  assert.equal(isOriginAllowed('https://astrosivam-abc123.run.app', dev()), true);
  assert.equal(isOriginAllowed('https://preview.googleusercontent.com', dev()), true);
});

check('Development wildcards are anchored — no suffix smuggling', () => {
  assert.equal(isOriginAllowed('https://foo.run.app.evil.test', dev()), false);
  assert.equal(isOriginAllowed('https://run.app.evil.test', dev()), false);
  assert.equal(isOriginAllowed('https://abc.e2b.app.evil.test', dev()), false);
  assert.equal(isOriginAllowed('https://evil.test/#.run.app', dev()), false);
});

check('parseAllowedOrigins trims, drops blanks and strips trailing slashes', () => {
  assert.deepEqual(
    parseAllowedOrigins(' https://a.test/ , ,https://b.test '),
    ['https://a.test', 'https://b.test']
  );
});

check('parseAllowedOrigins falls back to the defaults when unset or empty', () => {
  assert.deepEqual(parseAllowedOrigins(undefined), DEFAULT_ALLOWED_ORIGINS);
  assert.deepEqual(parseAllowedOrigins(''), DEFAULT_ALLOWED_ORIGINS);
  assert.deepEqual(parseAllowedOrigins('   '), DEFAULT_ALLOWED_ORIGINS);
  assert.deepEqual(parseAllowedOrigins(' , , '), DEFAULT_ALLOWED_ORIGINS);
});

check('Production without ALLOWED_ORIGINS warns once at startup', () => {
  const warning = describeOriginPolicy(DEFAULT_ALLOWED_ORIGINS, false, undefined);
  assert.ok(warning && warning.includes('ALLOWED_ORIGINS'));
  // No noise when it is configured, and none in development.
  assert.equal(describeOriginPolicy(DEFAULT_ALLOWED_ORIGINS, false, 'https://a.test'), null);
  assert.equal(describeOriginPolicy(DEFAULT_ALLOWED_ORIGINS, true, undefined), null);
});

console.log(`\nCORS origin allow-list passed (${passed} checks).`);
