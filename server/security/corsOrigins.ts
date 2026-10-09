/**
 * ASTRO SIVAM — browser origin allow-list for the API.
 *
 * WHY THIS EXISTS: the API is credentialed (`cors({ credentials: true })`), so
 * every origin that passes this check can call it with the visitor's bearer
 * token attached. An over-broad rule here is not a CORS nicety — it is an
 * account-takeover surface.
 *
 * THE RULE: production trusts ONLY the exact hosts in `ALLOWED_ORIGINS`.
 * Convenience wildcards (localhost, sandbox previews, Google Cloud preview
 * hosts) exist so developers do not have to maintain an env var while hacking,
 * and they are therefore gated on NODE_ENV !== 'production'.
 *
 * Wildcard suffixes like `*.run.app` MUST stay development-only: anyone can
 * deploy to Cloud Run and own a `*.run.app` hostname within minutes, so in
 * production such a rule is equivalent to `Access-Control-Allow-Origin: *`
 * with credentials. To reach the API from a real Cloud Run / preview
 * deployment, add that exact host to ALLOWED_ORIGINS instead:
 *
 *   ALLOWED_ORIGINS="https://astrosivam.com,https://astrosivam-abc123.run.app"
 */

/** Hosts trusted when no ALLOWED_ORIGINS is configured. */
export const DEFAULT_ALLOWED_ORIGINS = [
  'https://astrosivam.com',
  'https://www.astrosivam.com'
];

/**
 * Development-only convenience patterns. Each must be anchored at both ends so
 * a suffix cannot be smuggled in via a longer hostname
 * (e.g. `https://foo.run.app.evil.test`).
 */
const DEV_ORIGIN_PATTERNS: RegExp[] = [
  // Local development.
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  // Arena / e2b sandbox preview.
  /^https:\/\/[\w-]+\.e2b\.app$/,
  // Google Cloud Run and Google-hosted previews.
  /^https:\/\/[\w-]+(\.[\w-]+)*\.run\.app$/,
  /^https:\/\/[\w-]+(\.[\w-]+)*\.googleusercontent\.com$/
];

/** Parse the comma-separated ALLOWED_ORIGINS env var into exact origins. */
export function parseAllowedOrigins(raw: string | undefined | null): string[] {
  const value = (raw ?? '').trim();
  if (!value) return [...DEFAULT_ALLOWED_ORIGINS];
  const parsed = value
    .split(',')
    .map(o => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [...DEFAULT_ALLOWED_ORIGINS];
}

export interface OriginCheckOptions {
  /** Exact origins that are always trusted. */
  allowedOrigins: string[];
  /** When false, only `allowedOrigins` are accepted. */
  isDev: boolean;
}

/**
 * Decide whether a browser Origin may call the API.
 *
 * A missing origin (same-origin navigation, curl, server-to-server) is allowed:
 * those requests are not subject to the browser's cross-origin rules, and the
 * route-level auth middleware remains responsible for authorising them.
 */
export function isOriginAllowed(
  origin: string | undefined | null,
  { allowedOrigins, isDev }: OriginCheckOptions
): boolean {
  if (!origin) return true;

  const candidate = origin.trim().replace(/\/+$/, '');
  if (allowedOrigins.includes(candidate)) return true;

  if (isDev && DEV_ORIGIN_PATTERNS.some(pattern => pattern.test(candidate))) {
    return true;
  }

  return false;
}

/**
 * Boot-time sanity line. Running in production on the built-in defaults is
 * usually a misconfiguration (for example a Cloud Run service that never had
 * ALLOWED_ORIGINS set), and it fails as an opaque CORS error in the browser.
 * Say so once at startup instead.
 */
export function describeOriginPolicy(
  allowedOrigins: string[],
  isDev: boolean,
  rawEnv: string | undefined | null
): string | null {
  if (isDev) return null;
  if ((rawEnv ?? '').trim()) return null;
  return (
    '[CORS] ALLOWED_ORIGINS is not set; falling back to ' +
    `${allowedOrigins.join(', ')}. Browser requests from any other host ` +
    '(including *.run.app preview deployments) will be refused. Set ' +
    'ALLOWED_ORIGINS to the exact origins that must reach this API.'
  );
}
