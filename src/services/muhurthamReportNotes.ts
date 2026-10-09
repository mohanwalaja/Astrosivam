import rulesData from '../lib/muhurtham/rules.json';
import notesData from '../../api/astrology/muhurtham_report_notes.json';
import type { AppLanguage } from '../types';
import type { MuhurthamScanResult } from './muhurthamHtmlBuilder';

export interface MuhurthamReportNotes {
  title: string;
  /** Heading + body of the "what was checked" paragraph (always non-empty). */
  checksHeading: string;
  checksText: string;
  weekdayHeading: string;
  weekdayText: string;
  selectionHeading: string;
  summaryText: string;
  selectionText: string;
  /** One-line page-1 explanation of the ♥ personally-favourable date mark. */
  personalMarkNote: string;
}

/** Explanation only: never changes the scan, grades or recommended dates. */
export function buildMuhurthamReportNotes(
  result: MuhurthamScanResult,
  lang: AppLanguage = 'en'
): MuhurthamReportNotes {
  const copy = notesData[lang] || notesData.en;
  const eventKey = result.eventKey || 'wedding';
  const event: any = (rulesData.events as Record<string, unknown>)[eventKey] || rulesData.events.wedding;
  const months = Array.isArray(result.months) && result.months.length
    ? result.months
    : [result.prevMonth, result.chosenMonth, result.nextMonth].filter(Boolean);
  const counts = { total: 0, recommended: 0, best: 0, good: 0, fair: 0, avoid: 0 };
  for (const month of months) {
    for (const day of month?.days || []) {
      counts.total++;
      const grade = String(day.grade || '').toLowerCase() as 'best' | 'good' | 'fair' | 'avoid';
      if (['best', 'good', 'fair', 'avoid'].includes(grade)) counts[grade]++;
    }
  }
  counts.recommended = counts.best + counts.good;
  const summaryText = copy.summary.replace(/\{(\w+)\}/g, (_, key: keyof typeof counts) => String(counts[key]));
  const excludedWeekdays = (event.avoidWeekdays || [])
    .map((index: number) => copy.weekdays[index]).filter(Boolean).join(', ');
  const monthNames = copy.monthNames as Record<string, string>;
  const excludedMonths = (event.avoidMonths || [])
    .map((key: string) => monthNames[key] || key).join(', ');
  const additionalRules = [
    excludedMonths && copy.seasonRule.replace('{months}', excludedMonths),
    (eventKey === 'wedding' || eventKey === 'engagement' || event.requireGuruSukraClean) && copy.combustionRule,
    (result.dob || result.persons?.length) && copy.personalRule
  ].filter(Boolean);

  return {
    title: copy.title,
    // A heading is never emitted without a body: if a deployment ships the
    // translations without the checks copy, the English text is used instead.
    checksHeading: String(copy.checksHeading || notesData.en.checksHeading || ''),
    checksText: String(copy.checksText || notesData.en.checksText || ''),
    weekdayHeading: copy.weekdayHeading,
    weekdayText: excludedWeekdays
      ? copy.weekdayRule.replace('{weekdays}', excludedWeekdays)
      : copy.weekdayNone,
    selectionHeading: copy.selectionHeading,
    summaryText,
    selectionText: [copy.selectionRule, ...additionalRules].join(' '),
    personalMarkNote: String(copy.personalMarkNote || notesData.en.personalMarkNote || '')
  };
}
