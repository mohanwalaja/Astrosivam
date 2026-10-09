import type { AppLanguage } from '../types';

export const SUPPORTED_REPORT_LANGUAGES = ['en', 'ta', 'hi'] as const satisfies readonly AppLanguage[];

/** Treat API/database values as untrusted even when their TypeScript type is a union. */
export function normalizeReportLanguage(value: unknown): AppLanguage {
  if (typeof value !== 'string') return 'en';
  const normalized = value.trim().toLowerCase();
  return (SUPPORTED_REPORT_LANGUAGES as readonly string[]).includes(normalized)
    ? normalized as AppLanguage
    : 'en';
}
