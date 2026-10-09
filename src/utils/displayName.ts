/**
 * ASTRO SIVAM — display name helpers.
 *
 * A user must always see their plain, actual name — never a name with a
 * provider tag like "(Google)" attached, and never a stale/placeholder name
 * such as "Ramesh Chand" or "Google User" after they renamed themselves in
 * their website profile.
 *
 * The name saved in the website profile (birth profile "User full name") is the
 * authoritative display name; the Google/Facebook account name only seeds
 * brand-new accounts and must never overwrite it.
 */

/** Strips legacy provider tags: "Ramesh Chand (Google)" -> "Ramesh Chand". */
export const cleanDisplayName = (name?: string | null): string => {
  let value = String(name ?? '').trim();
  if (!value) return '';
  // "(Google)", "[FB]", "(Facebook account)" style suffixes
  value = value.replace(/\s*[([{]\s*(google|facebook|fb)(\s+(account|user|login))?\s*[)\]}]\s*$/gi, '');
  // "- Google", "— Facebook", "| fb" style suffixes
  value = value.replace(/\s*[-–—|·]\s*(google|facebook|fb)\s*$/gi, '');
  // "via Google" style suffixes
  value = value.replace(/\s+via\s+(google|facebook|fb)\s*$/gi, '');
  // Any leftover trailing separators from the strips above
  value = value.replace(/[\s\-–—|·.,]+$/, '');
  return value.trim();
};

/** True when a stored name is empty or just a provider placeholder ("Google User"). */
export const isPlaceholderDisplayName = (name?: string | null): boolean => {
  const value = cleanDisplayName(name);
  return value === '' || /^(google|facebook|fb)(\s*(user|customer|member|account))?$/i.test(value);
};

/**
 * Builds a human fallback name from the e-mail (mohanwalaja@gmail.com ->
 * "Mohanwalaja") so a missing provider name never renders as "Google User".
 */
export const providerFallbackName = (email?: string | null): string => {
  const local = String(email ?? '').split('@')[0].trim();
  const words = local.replace(/[._\-+0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const parts = words.map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '')).filter(Boolean);
  return parts.length ? parts.join(' ') : 'User';
};

/**
 * Resolves the one true display name: the name saved in the website profile
 * (birth profile) is authoritative, then the account name, then a friendly
 * e-mail-derived fallback.
 */
export const resolveDisplayName = (
  profileName?: string | null,
  accountName?: string | null,
  email?: string | null
): string => {
  if (!isPlaceholderDisplayName(profileName) && cleanDisplayName(profileName)) return cleanDisplayName(profileName);
  if (!isPlaceholderDisplayName(accountName) && cleanDisplayName(accountName)) return cleanDisplayName(accountName);
  return providerFallbackName(email);
};
