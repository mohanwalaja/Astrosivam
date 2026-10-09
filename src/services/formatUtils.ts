/**
 * Shared display formatting helpers for ASTRO SIVAM reports (HTML + PDF).
 */

/**
 * Joins a birth place with its country WITHOUT repeating the country when the
 * place string already ends with it. Geocoded place names normally include the
 * country already, which produced labels such as
 * "Tiruchirappalli, Tamil Nadu, India, India".
 */
export function formatBirthPlace(birthPlace?: string | null, country?: string | null): string {
  const place = (birthPlace || '').trim().replace(/[,\s]+$/, '');
  const land = (country || '').trim().replace(/[,\s]+$/, '');

  if (!place) return land;
  if (!land) return place;

  // Skip the country when the last segment already names it, either exactly
  // ("Madurai, India") or as a word inside it ("Suva, Fiji Islands" + "Fiji").
  const tail = place
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .pop() || '';

  const landWord = land.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\b${landWord}\\b`, 'i').test(tail)) return place;

  return `${place}, ${land}`;

}

/**
 * Render-quality verdict returned by the family (group order) approve / resend
 * endpoints.
 *
 * The admin panel renders every report in the browser at live-preview quality
 * and uploads it before the email is dispatched. When a document never reaches
 * the server, that member falls back to the server-side renderer, which is
 * visibly lower quality - the operator must be told instead of discovering it
 * from a customer complaint.
 */
export function describeFamilyRenderQuality(res?: {
  renderQuality?: 'PREVIEW_EXACT' | 'MIXED' | 'SERVER_RENDER';
  serverRenderedReports?: number;
  serverRenderedOrderNumbers?: string[];
} | null): string {
  if (!res || !res.renderQuality) return '';
  if (res.renderQuality === 'PREVIEW_EXACT') {
    return ' Every report was delivered in live-preview (high-resolution) quality.';
  }
  const fallbacks = res.serverRenderedReports ?? 0;
  const numbers = (res.serverRenderedOrderNumbers || []).join(', ');
  return ` ⚠️ ${fallbacks} report(s)${numbers ? ` (${numbers})` : ''} were rendered server-side at lower quality - ` +
    'their preview PDF did not reach the server. Send the email again to retry.';
}

/**
 * THE date-of-birth format used in every report PDF: `DD/MM/YYYY`
 * (e.g. "27/07/1990"). Accepts the stored ISO `YYYY-MM-DD` (optionally with a
 * time suffix), `YYYY/MM/DD`, or an already day-first `DD-MM-YYYY` /
 * `DD.MM.YYYY` / `DD/MM/YYYY` value. Anything unrecognised is returned as-is.
 */
export function formatBirthDate(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const pad = (part: string) => part.padStart(2, '0');
  const isoMatch = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[T\s])/.exec(raw);
  if (isoMatch) return `${pad(isoMatch[3])}/${pad(isoMatch[2])}/${isoMatch[1]}`;
  const dayFirst = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(raw);
  if (dayFirst) return `${pad(dayFirst[1])}/${pad(dayFirst[2])}/${dayFirst[3]}`;
  return raw;
}
