import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, Clock, Sparkles, X, Check, AlertCircle } from 'lucide-react';
import {
  MONTH_LONG_NAMES,
  MONTH_SHORT_NAMES,
  WEEKDAY_LABELS,
  daysInMonth,
  describeDobProblem,
  describeTobProblem,
  formatDobInputWhileTyping,
  formatReadableDob,
  formatReadableTob,
  formatTobInputWhileTyping,
  isValidBirthDate,
  isoToDisplayDob,
  parseFlexibleDob,
  parseFlexibleTob,
  parseTobInputWhileTyping,
  splitIsoDate,
  splitTob24,
  todayIsoDate,
  toIsoDate,
  type TobPeriod
} from '../../utils/dateTimeInput';
import { isValidBirthTime, isValidIsoBirthDate } from '../../utils/birthDetails';
import { formatUtcOffset, type BirthTimeZoneResolution } from '../../lib/timezone';

/* ══════════════════════════════════════════════════════════════════════════
 * Ultra-Modern Mobile-Proof Birth Date & Birth Time Fields
 * 
 * Provides:
 *   1. Direct auto-formatting masked text typing (DD/MM/YYYY and HH:MM)
 *   2. Interactive touch-optimized Sheet Modal with custom Calendar & Clock
 *   3. Modern Quick Dropdowns for 100% phone compatibility
 * ══════════════════════════════════════════════════════════════════════════ */

export type FieldTheme = 'light' | 'dark';
export type FieldSize = 'md' | 'sm';

interface ThemeTokens {
  label: string;
  requiredMark: string;
  input: string;
  iconBadge: string;
  iconButton: string;
  chip: string;
  chipActive: string;
  hint: string;
  ok: string;
  warn: string;
  select: string;
  option: string;
  link: string;
  sheetBackdrop: string;
  sheetPanel: string;
  sheetBorder: string;
  sheetHeader: string;
  sheetTitle: string;
  sheetSubtle: string;
  sheetCell: string;
  sheetCellActive: string;
  sheetFooter: string;
  sheetPrimary: string;
  sheetGhost: string;
  sheetInput: string;
  sectionLabel: string;
  inputRow: string;
  fieldBox: string;
  segment: string;
}

const TOKENS: Record<FieldTheme, ThemeTokens> = {
  dark: {
    label: 'block text-xs font-bold uppercase tracking-wider text-slate-300',
    requiredMark: 'text-rose-400',
    input:
      'w-full bg-transparent text-white font-semibold placeholder:text-slate-500 outline-none transition touch-manipulation',
    iconBadge:
      'flex shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20 shadow-xs',
    iconButton:
      'flex shrink-0 items-center justify-center rounded-xl bg-slate-800 text-amber-400 border border-slate-700 hover:bg-amber-400 hover:text-slate-950 active:scale-95 transition-all shadow-xs touch-manipulation cursor-pointer',
    chip:
      'rounded-xl border border-slate-700 bg-slate-800/80 font-bold text-slate-300 transition hover:bg-slate-700 hover:text-white touch-manipulation cursor-pointer',
    chipActive:
      'rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 font-black text-slate-950 shadow-md shadow-amber-500/20 touch-manipulation cursor-pointer',
    hint: 'text-[11px] leading-4 text-slate-400 font-medium',
    ok: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/70 shadow-xs',
    warn: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/70 shadow-xs',
    select:
      'w-full rounded-xl border border-slate-700 bg-slate-900 text-white font-medium outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 touch-manipulation cursor-pointer',
    option: 'bg-slate-900 text-white',
    link: 'text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors touch-manipulation cursor-pointer flex items-center gap-1',
    sheetBackdrop: 'bg-slate-950/80 backdrop-blur-md',
    sheetPanel: 'bg-slate-900 text-white border-slate-800 shadow-2xl',
    sheetBorder: 'border-slate-800',
    sheetHeader: 'border-slate-800 bg-slate-950/80',
    sheetTitle: 'text-white font-black tracking-wide',
    sheetSubtle: 'text-slate-400',
    sheetCell: 'bg-slate-800/80 text-slate-100 hover:bg-amber-400 hover:text-slate-950 active:scale-95 transition-all rounded-xl font-bold',
    sheetCellActive: 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/30 rounded-xl',
    sheetFooter: 'border-slate-800 bg-slate-950/80',
    sheetPrimary: 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black hover:from-amber-300 hover:to-amber-400 active:scale-95 shadow-md shadow-amber-500/20 rounded-xl',
    sheetGhost: 'border border-slate-700 text-slate-200 hover:bg-white/10 active:scale-95 rounded-xl',
    sheetInput:
      'rounded-xl border border-slate-700 bg-black/40 text-white font-bold outline-none focus:border-amber-400 touch-manipulation',
    sectionLabel: 'text-[11px] font-bold uppercase tracking-wider text-amber-400',
    inputRow:
      'flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-1.5 shadow-inner transition-all duration-200 hover:border-amber-500/50 focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-400/15',
    fieldBox:
      'flex min-w-0 flex-1 items-center rounded-xl border border-slate-700/70 bg-black/30 px-1.5 transition-colors focus-within:border-amber-400/70',
    segment: 'flex shrink-0 items-center rounded-xl border border-slate-700/70 bg-slate-800/70 p-0.5'
  },
  light: {
    label: 'block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300',
    requiredMark: 'text-rose-500',
    input:
      'w-full bg-transparent text-slate-900 dark:text-white font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition touch-manipulation',
    iconBadge:
      'flex shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs',
    iconButton:
      'flex shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-slate-300 dark:border-slate-700 hover:bg-amber-500 hover:text-slate-950 active:scale-95 transition-all shadow-xs touch-manipulation cursor-pointer',
    chip:
      'rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 font-bold text-slate-700 dark:text-slate-300 transition hover:bg-slate-200 dark:hover:bg-slate-700 touch-manipulation cursor-pointer',
    chipActive:
      'rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 font-black text-slate-950 shadow-md shadow-amber-500/20 touch-manipulation cursor-pointer',
    hint: 'text-[11px] leading-4 text-slate-500 dark:text-slate-400 font-medium',
    ok: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 shadow-xs',
    warn: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70 shadow-xs',
    select:
      'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium outline-none transition focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 touch-manipulation cursor-pointer',
    option: 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white',
    link:
      'text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition-colors touch-manipulation cursor-pointer flex items-center gap-1',
    sheetBackdrop: 'bg-slate-950/70 backdrop-blur-md',
    sheetPanel: 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800 shadow-2xl',
    sheetBorder: 'border-slate-200 dark:border-slate-800',
    sheetHeader: 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80',
    sheetTitle: 'text-slate-900 dark:text-white font-black tracking-wide',
    sheetSubtle: 'text-slate-500 dark:text-slate-400',
    sheetCell: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-amber-400 hover:text-slate-950 active:scale-95 transition-all rounded-xl font-bold',
    sheetCellActive: 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/30 rounded-xl',
    sheetFooter: 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80',
    sheetPrimary: 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black hover:from-amber-300 hover:to-amber-400 active:scale-95 shadow-md shadow-amber-500/20 rounded-xl',
    sheetGhost: 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 rounded-xl',
    sheetInput:
      'rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold outline-none focus:border-amber-500 touch-manipulation',
    sectionLabel: 'text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400',
    inputRow:
      'flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-300 bg-white p-1.5 shadow-xs transition-all duration-200 hover:border-amber-500/60 focus-within:border-amber-500 focus-within:ring-4 focus-within:ring-amber-500/15 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:border-amber-500/50 dark:focus-within:border-amber-400 dark:focus-within:ring-amber-400/15',
    fieldBox:
      'flex min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50/80 px-1.5 transition-colors focus-within:border-amber-500/70 dark:border-slate-700/70 dark:bg-black/30 dark:focus-within:border-amber-400/70',
    segment: 'flex shrink-0 items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700/70 dark:bg-slate-800/70'
  }
};

const SIZE_PADDING: Record<FieldSize, string> = {
  md: 'py-3.5 px-3 text-base sm:text-sm',
  sm: 'py-2.5 px-2.5 text-base sm:text-xs'
};

const CURRENT_YEAR = new Date().getFullYear();
const HOURS_12 = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const MINUTE_STEPS = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));
const DAYS_31 = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'));
const MINUTES_60 = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

/* ─────────────────────────── shared sheet chrome ─────────────────────────── */

interface SheetShellProps {
  title: string;
  subtitle?: string;
  theme: FieldTheme;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const SheetShell: React.FC<SheetShellProps> = ({ title, subtitle, theme, onClose, children, footer }) => {
  const tokens = TOKENS[theme];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9990] flex items-end justify-center sm:items-center ${tokens.sheetBackdrop}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:max-w-md sm:rounded-3xl ${tokens.sheetPanel} ${tokens.sheetBorder} animate-in fade-in zoom-in-95 duration-200`}
        onClick={event => event.stopPropagation()}
      >
        <div className={`flex items-start justify-between gap-3 border-b px-5 py-3.5 ${tokens.sheetHeader}`}>
          <div>
            <h3 className={`text-base font-black tracking-wide ${tokens.sheetTitle}`}>{title}</h3>
            {subtitle && <p className={`mt-0.5 text-[11px] leading-4 ${tokens.sheetSubtle}`}>{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close picker"
            className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl transition active:scale-95 ${tokens.sheetGhost}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>

        {footer && (
          <div className={`flex items-center gap-2 border-t px-5 py-3.5 ${tokens.sheetFooter}`}>{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
};

/* ─────────────────────────────── calendar sheet ─────────────────────────── */

interface CalendarSheetProps {
  iso: string;
  theme: FieldTheme;
  minIso?: string;
  maxIso?: string;
  title?: string;
  onConfirm: (iso: string) => void;
  onClose: () => void;
}

const CalendarSheet: React.FC<CalendarSheetProps> = ({
  iso,
  theme,
  minIso = '1900-01-01',
  maxIso,
  title = 'Select Date of Birth',
  onConfirm,
  onClose
}) => {
  const tokens = TOKENS[theme];
  const effectiveMinIso = minIso || '1900-01-01';
  const effectiveMaxIso = maxIso || todayIsoDate();
  const initialIso = iso && iso >= effectiveMinIso && iso <= effectiveMaxIso ? iso : effectiveMaxIso;
  const initialParts = splitIsoDate(initialIso);
  const [selectedYear, setSelectedYear] = useState<number>(Number(initialParts.year) || CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState<number>(Number(initialParts.month) || 1);
  const [selectedDay, setSelectedDay] = useState<number>(Number(initialParts.day) || 1);

  const minParts = splitIsoDate(effectiveMinIso);
  const maxParts = splitIsoDate(effectiveMaxIso);
  const minYear = Number(minParts.year) || 1900;
  const maxYear = Number(maxParts.year) || CURRENT_YEAR;
  const minMonth = Number(minParts.month) || 1;
  const maxMonth = Number(maxParts.month) || 12;

  const totalDays = useMemo(
    () => daysInMonth(selectedYear, selectedMonth),
    [selectedYear, selectedMonth]
  );

  const dayBoundsForMonth = (year: number, month: number) => ({
    minDay: year === minYear && month === minMonth ? Number(minParts.day) || 1 : 1,
    maxDay: year === maxYear && month === maxMonth
      ? Number(maxParts.day) || daysInMonth(year, month)
      : daysInMonth(year, month)
  });
  const clampDayToRange = (year: number, month: number, day: number) => {
    const bounds = dayBoundsForMonth(year, month);
    return Math.max(bounds.minDay, Math.min(day, bounds.maxDay));
  };
  const isDateInRange = (year: number, month: number, day: number): boolean => {
    const candidate = toIsoDate(year, month, day);
    return candidate >= effectiveMinIso && candidate <= effectiveMaxIso && isValidBirthDate(year, month, day);
  };
  const canGoPrevious = selectedYear > minYear || (selectedYear === minYear && selectedMonth > minMonth);
  const canGoNext = selectedYear < maxYear || (selectedYear === maxYear && selectedMonth < maxMonth);

  const firstWeekday = useMemo(() => {
    const date = new Date(Date.UTC(selectedYear, selectedMonth - 1, 1));
    return date.getUTCDay();
  }, [selectedYear, selectedMonth]);

  const years: number[] = useMemo(() => {
    const list: number[] = [];
    for (let year = maxYear; year >= minYear; year--) list.push(year);
    return list;
  }, [minYear, maxYear]);

  const handleMonthChange = (offset: number) => {
    const next = new Date(Date.UTC(selectedYear, selectedMonth - 1 + offset, 1));
    const nextYear = next.getUTCFullYear();
    const nextMonth = next.getUTCMonth() + 1;
    const monthStart = toIsoDate(nextYear, nextMonth, 1);
    const minMonthStart = toIsoDate(minYear, minMonth, 1);
    const maxMonthStart = toIsoDate(maxYear, maxMonth, 1);
    if (monthStart < minMonthStart || monthStart > maxMonthStart) return;
    setSelectedYear(nextYear);
    setSelectedMonth(nextMonth);
    setSelectedDay(day => clampDayToRange(nextYear, nextMonth, day));
  };

  const handleConfirm = () => {
    const clampedDay = Math.min(selectedDay, totalDays);
    if (!isDateInRange(selectedYear, selectedMonth, clampedDay)) return;
    const resultIso = toIsoDate(selectedYear, selectedMonth, clampedDay);
    onConfirm(resultIso);
    onClose();
  };

  const currentSelectionIso = toIsoDate(selectedYear, selectedMonth, Math.min(selectedDay, totalDays));

  return (
    <SheetShell
      title={title}
      subtitle={formatReadableDob(currentSelectionIso)}
      theme={theme}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              const today = todayIsoDate();
              const targetIso = today < effectiveMinIso
                ? effectiveMinIso
                : today > effectiveMaxIso ? effectiveMaxIso : today;
              const targetParts = splitIsoDate(targetIso);
              setSelectedYear(Number(targetParts.year));
              setSelectedMonth(Number(targetParts.month));
              setSelectedDay(Number(targetParts.day));
            }}
            className={`cursor-pointer px-3 py-2 text-xs font-bold ${tokens.link}`}
          >
            Today
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`cursor-pointer px-4 py-2 text-xs font-bold ${tokens.sheetGhost}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={`cursor-pointer px-5 py-2 text-xs font-bold ${tokens.sheetPrimary}`}
            >
              Set Date
            </button>
          </div>
        </div>
      }
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => handleMonthChange(-1)}
          aria-label="Previous month"
          disabled={!canGoPrevious}
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${tokens.sheetGhost}`}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <select
            aria-label="Month"
            value={selectedMonth}
            onChange={event => {
              const nextMonth = Number(event.target.value);
              setSelectedMonth(nextMonth);
              setSelectedDay(day => clampDayToRange(selectedYear, nextMonth, day));
            }}
            className={`cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-bold ${tokens.select}`}
          >
            {MONTH_SHORT_NAMES.map((name, index) => {
              const monthNumber = index + 1;
              const disabled =
                (selectedYear === minYear && monthNumber < minMonth) ||
                (selectedYear === maxYear && monthNumber > maxMonth);
              return (
                <option key={name} value={monthNumber} disabled={disabled} className={tokens.option}>
                  {name}
                </option>
              );
            })}
          </select>

          <select
            aria-label="Year"
            value={selectedYear}
            onChange={event => {
              const nextYear = Number(event.target.value);
              let nextMonth = selectedMonth;
              if (nextYear === minYear && nextMonth < minMonth) nextMonth = minMonth;
              if (nextYear === maxYear && nextMonth > maxMonth) nextMonth = maxMonth;
              setSelectedYear(nextYear);
              setSelectedMonth(nextMonth);
              setSelectedDay(day => clampDayToRange(nextYear, nextMonth, day));
            }}
            className={`cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-bold ${tokens.select}`}
          >
            {years.map(year => (
              <option key={year} value={year} className={tokens.option}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => handleMonthChange(1)}
          aria-label="Next month"
          disabled={!canGoNext}
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${tokens.sheetGhost}`}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((day, idx) => (
          <span key={idx} className="text-[11px] font-bold text-slate-400">
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }).map((_, index) => (
          <span key={`pad-${index}`} className="h-9 w-full" />
        ))}
        {Array.from({ length: totalDays }).map((_, index) => {
          const dayNumber = index + 1;
          const isSelected = dayNumber === selectedDay;
          const isAllowed = isDateInRange(selectedYear, selectedMonth, dayNumber);
          return (
            <button
              key={dayNumber}
              type="button"
              onClick={() => setSelectedDay(dayNumber)}
              disabled={!isAllowed}
              aria-pressed={isSelected}
              className={`flex h-9 w-full items-center justify-center rounded-xl text-xs font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 ${
                isSelected ? tokens.sheetCellActive : tokens.sheetCell
              }`}
            >
              {dayNumber}
            </button>
          );
        })}
      </div>
    </SheetShell>
  );
};

/* ──────────────────────────────── clock sheet ───────────────────────────── */

interface ClockSheetProps {
  tob24: string;
  theme: FieldTheme;
  title?: string;
  onConfirm: (tob24: string, period: TobPeriod) => void;
  onClose: () => void;
}

const ClockSheet: React.FC<ClockSheetProps> = ({
  tob24,
  theme,
  title = 'Select Exact Birth Time',
  onConfirm,
  onClose
}) => {
  const tokens = TOKENS[theme];
  const minuteInputId = `clock-minute-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const initial = splitTob24(tob24 || '12:00');
  const [hour12, setHour12] = useState(initial.hour12);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState<TobPeriod>(initial.period);

  const handleConfirm = () => {
    let hour = Number(hour12) % 12;
    if (period === 'PM') hour += 12;
    const hourString = String(hour).padStart(2, '0');
    const minuteString = String(Number(minute) || 0).padStart(2, '0');
    onConfirm(`${hourString}:${minuteString}`, period);
    onClose();
  };

  const preview12 = `${hour12}:${minute} ${period}`;

  return (
    <SheetShell
      title={title}
      subtitle={preview12}
      theme={theme}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setHour12('12');
              setMinute('00');
              setPeriod('PM');
            }}
            className={`cursor-pointer px-3 py-2 text-xs font-bold ${tokens.link}`}
          >
            Noon (12:00 PM)
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`cursor-pointer px-4 py-2 text-xs font-bold ${tokens.sheetGhost}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={`cursor-pointer px-5 py-2 text-xs font-bold ${tokens.sheetPrimary}`}
            >
              Set Time
            </button>
          </div>
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(['AM', 'PM'] as TobPeriod[]).map(option => (
          <button
            key={option}
            type="button"
            onClick={() => setPeriod(option)}
            className={`rounded-xl px-3 py-3 text-sm transition font-bold ${period === option ? tokens.chipActive : tokens.chip}`}
          >
            {option}
            <span className="ml-1 text-[10px] font-semibold opacity-70">
              {option === 'AM' ? '(morning)' : '(evening)'}
            </span>
          </button>
        ))}
      </div>

      <p className={`mb-2 ${tokens.sectionLabel}`}>Hour</p>
      <div className="mb-4 grid grid-cols-4 gap-2">
        {HOURS_12.map(hour => (
          <button
            key={hour}
            type="button"
            onClick={() => setHour12(hour)}
            className={`cursor-pointer rounded-xl px-2 py-3 text-sm font-bold transition ${
              hour === hour12 ? tokens.sheetCellActive : tokens.sheetCell
            }`}
          >
            {hour}
          </button>
        ))}
      </div>

      <p className={`mb-2 ${tokens.sectionLabel}`}>Minute</p>
      <div className="grid grid-cols-4 gap-2">
        {MINUTE_STEPS.map(value => (
          <button
            key={value}
            type="button"
            onClick={() => setMinute(value)}
            className={`cursor-pointer rounded-xl px-2 py-3 text-sm font-bold transition ${
              value === minute ? tokens.sheetCellActive : tokens.sheetCell
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <label className={`text-[11px] font-bold uppercase ${tokens.sheetSubtle}`} htmlFor={minuteInputId}>
          Exact minute
        </label>
        <input
          id={minuteInputId}
          type="text"
          inputMode="numeric"
          value={minute}
          onChange={event => {
            const digits = event.target.value.replace(/\D/g, '').slice(0, 2);
            if (!digits) {
              setMinute('00');
              return;
            }
            setMinute(String(Math.min(59, Number(digits))).padStart(2, '0'));
          }}
          className={`w-20 px-3 py-2.5 text-center text-sm font-bold outline-none ${tokens.sheetInput}`}
        />
        <span className={`text-[11px] ${tokens.sheetSubtle}`}>00 – 59</span>
      </div>
    </SheetShell>
  );
};

/* ──────────────────────────────── date field ────────────────────────────── */

export interface BirthDateFieldProps {
  /** 'YYYY-MM-DD' */
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  required?: boolean;
  theme?: FieldTheme;
  size?: FieldSize;
  id?: string;
  minIso?: string;
  maxIso?: string;
  className?: string;
  helpText?: string;
  onTextChange?: (text: string) => void;
}

export const BirthDateField: React.FC<BirthDateFieldProps> = ({
  value,
  onChange,
  label = 'Date of Birth',
  required = true,
  theme = 'light',
  size = 'md',
  id,
  minIso,
  maxIso,
  className = '',
  helpText,
  onTextChange
}) => {
  const tokens = TOKENS[theme];
  const generatedId = useId();
  const fieldId = id || `dob-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const effectiveMinIso = minIso || '1900-01-01';
  const effectiveMaxIso = maxIso || todayIsoDate();
  const minParts = splitIsoDate(effectiveMinIso);
  const maxParts = splitIsoDate(effectiveMaxIso);
  const minYear = Number(minParts.year) || 1900;
  const maxYear = Number(maxParts.year) || CURRENT_YEAR;
  const minMonth = Number(minParts.month) || 1;
  const maxMonth = Number(maxParts.month) || 12;
  const yearOptions: string[] = useMemo(() => {
    const years: string[] = [];
    for (let year = maxYear; year >= minYear; year--) years.push(String(year));
    return years;
  }, [minYear, maxYear]);

  const initialParts = splitIsoDate(value || '');
  const [text, setText] = useState(() => (value ? isoToDisplayDob(value) : ''));
  const [day, setDay] = useState(initialParts.day);
  const [month, setMonth] = useState(initialParts.month);
  const [year, setYear] = useState(initialParts.year);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quickSelect, setQuickSelect] = useState(false);
  const [textActive, setTextActive] = useState(false);
  const lastEmitted = useRef<string>(value || '');

  useEffect(() => {
    if ((value || '') === lastEmitted.current) return;
    lastEmitted.current = value || '';
    const nextParts = splitIsoDate(value || '');
    setDay(nextParts.day);
    setMonth(nextParts.month);
    setYear(nextParts.year);
    setText(value ? isoToDisplayDob(value) : '');
  }, [value]);

  const emit = (iso: string, nextText: string) => {
    lastEmitted.current = iso;
    setText(nextText);
    onChange(iso);
    if (onTextChange) onTextChange(nextText);
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDobInputWhileTyping(event.target.value);
    const iso = parseFlexibleDob(formatted, false) || parseFlexibleDob(event.target.value, false);
    if (iso) {
      const nextParts = splitIsoDate(iso);
      setDay(nextParts.day);
      setMonth(nextParts.month);
      setYear(nextParts.year);
    } else {
      setDay('');
      setMonth('');
      setYear('');
    }
    emit(iso, formatted);
  };

  const handleBlur = () => {
    const iso = parseFlexibleDob(text, true);
    if (iso) emit(iso, isoToDisplayDob(iso));
  };

  const handleSelectChange = (nextDay: string, nextMonth: string, nextYear: string) => {
    setDay(nextDay);
    setMonth(nextMonth);
    setYear(nextYear);
    const draft = [nextDay, nextMonth, nextYear].filter(Boolean).join('/');
    if (nextDay && nextMonth && nextYear) {
      const yearNumber = Number(nextYear);
      const monthNumber = Number(nextMonth);
      const dayNumber = Number(nextDay);
      const iso = toIsoDate(yearNumber, monthNumber, dayNumber);
      const allowed = isValidBirthDate(yearNumber, monthNumber, dayNumber) && iso >= effectiveMinIso && iso <= effectiveMaxIso;
      emit(allowed ? iso : '', allowed ? isoToDisplayDob(iso) : draft);
    } else {
      emit('', draft);
    }
  };

  const validValue = isValidIsoBirthDate(value);
  const problem = validValue ? '' : describeDobProblem(value ? isoToDisplayDob(value) : text);

  return (
    <div className={className}>
      {/* Top Label & Quick Toggle */}
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={fieldId} className={tokens.label}>
          {label} {required && <span className={tokens.requiredMark}>*</span>}
        </label>
        <button
          type="button"
          onClick={() => setQuickSelect(open => !open)}
          className={tokens.link}
        >
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>{quickSelect ? 'Hide dropdowns' : 'Quick select ▾'}</span>
        </button>
      </div>

      {/* Compact single-row picker: tap the field to type, or open the calendar */}
      <div className={tokens.inputRow}>
        <div className={`${tokens.iconBadge} h-9 w-9 shrink-0`}>
          <Calendar className="h-4 w-4" />
        </div>

        <label
          htmlFor={fieldId}
          className={`${tokens.fieldBox} cursor-text py-1.5`}
        >
          <input
            id={fieldId}
            type="text"
            inputMode="numeric"
            autoComplete="bday"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            required={required}
            placeholder="DD/MM/YYYY"
            value={text}
            onChange={handleTextChange}
            onFocus={() => setTextActive(true)}
            onBlur={() => {
              setTextActive(false);
              handleBlur();
            }}
            className={`${tokens.input} min-w-0 flex-1 px-2 py-1 text-base sm:text-sm ${
              textActive ? '' : 'sr-only'
            }`}
            aria-describedby={`${fieldId}-hint`}
            aria-invalid={Boolean(text && !validValue)}
          />
          {!textActive && (
            <span
              aria-hidden="true"
              className={`ml-auto shrink-0 px-0.5 text-[13px] font-bold tabular-nums ${
                validValue ? 'text-amber-600 dark:text-amber-300' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {validValue ? isoToDisplayDob(value) : 'DD/MM/YYYY'}
            </span>
          )}
        </label>

        <button
          type="button"
          aria-label={`Open calendar for ${label}`}
          title="Open Interactive Calendar"
          onClick={() => setSheetOpen(true)}
          className={`${tokens.iconButton} h-9 shrink-0 gap-1 px-2.5 text-xs font-bold xl:px-3`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Pick</span>
        </button>
      </div>

      {/* Live Helper & Validation Footnote */}
      <div className="mt-1.5 min-h-[20px]">
        {validValue ? (
          <span id={`${fieldId}-hint`} className={tokens.ok} aria-live="polite">
            <span className="sm:hidden">✓ {formatReadableDob(value)}</span>
            <span className="hidden sm:inline">✓ {formatReadableDob(value)} ({value})</span>
          </span>
        ) : problem ? (
          <span id={`${fieldId}-hint`} className={tokens.warn}>
            <span>⚠ {problem}</span>
          </span>
        ) : (
          <span id={`${fieldId}-hint`} className={tokens.hint}>
            {helpText || 'Type DD/MM/YYYY or tap Pick'}
          </span>
        )}
      </div>

      {/* Quick Select Dropdowns Drop-in */}
      {quickSelect && (
        <div className="mt-2.5 grid grid-cols-3 gap-2 p-3 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl animate-in fade-in zoom-in-95 duration-200 shadow-sm">
          <select
            aria-label={`${label} day`}
            value={day}
            onChange={event => handleSelectChange(event.target.value, month, year)}
            className={`${tokens.select} py-2.5 px-2 text-xs`}
          >
            <option value="" className={tokens.option}>Day</option>
            {DAYS_31.map(option => {
              const dateIso = year && month ? toIsoDate(Number(year), Number(month), Number(option)) : '';
              const dayUnavailable = Boolean(year && month) && (
                !isValidBirthDate(Number(year), Number(month), Number(option)) ||
                dateIso < effectiveMinIso || dateIso > effectiveMaxIso
              );
              return (
                <option key={option} value={option} disabled={dayUnavailable} className={tokens.option}>{option}</option>
              );
            })}
          </select>
          <select
            aria-label={`${label} month`}
            value={month}
            onChange={event => handleSelectChange(day, event.target.value, year)}
            className={`${tokens.select} py-2.5 px-2 text-xs`}
          >
            <option value="" className={tokens.option}>Month</option>
            {MONTH_SHORT_NAMES.map((monthName, index) => {
              const monthNumber = index + 1;
              const monthValue = String(monthNumber).padStart(2, '0');
              const monthUnavailable = Boolean(year) && (
                (Number(year) === minYear && monthNumber < minMonth) ||
                (Number(year) === maxYear && monthNumber > maxMonth)
              );
              return (
                <option key={monthValue} value={monthValue} disabled={monthUnavailable} className={tokens.option}>
                  {monthValue} · {monthName}
                </option>
              );
            })}
          </select>
          <select
            aria-label={`${label} year`}
            value={year}
            onChange={event => handleSelectChange(day, month, event.target.value)}
            className={`${tokens.select} py-2.5 px-2 text-xs`}
          >
            <option value="" className={tokens.option}>Year</option>
            {yearOptions.map(option => (
              <option key={option} value={option} className={tokens.option}>{option}</option>
            ))}
          </select>
        </div>
      )}

      {sheetOpen && (
        <CalendarSheet
          iso={value || ''}
          theme={theme}
          minIso={effectiveMinIso}
          maxIso={effectiveMaxIso}
          title={`Select ${label}`}
          onConfirm={iso => {
            const nextParts = splitIsoDate(iso);
            setDay(nextParts.day);
            setMonth(nextParts.month);
            setYear(nextParts.year);
            emit(iso, iso ? isoToDisplayDob(iso) : '');
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
};

/* ──────────────────────────────── time field ────────────────────────────── */

export interface BirthTimeFieldProps {
  /** 'HH:MM' in 24-hour format */
  value: string;
  onChange: (tob24: string) => void;
  label?: string;
  required?: boolean;
  theme?: FieldTheme;
  size?: FieldSize;
  id?: string;
  className?: string;
  helpText?: string;
  allowUnknownTime?: boolean;
  unknownTimeLabel?: string;
  onTextChange?: (text: string) => void;
  onPeriodChange?: (period: TobPeriod) => void;
}

export const BirthTimeField: React.FC<BirthTimeFieldProps> = ({
  value,
  onChange,
  label = 'Exact Birth Time',
  required = true,
  theme = 'light',
  size = 'md',
  id,
  className = '',
  helpText,
  allowUnknownTime = true,
  unknownTimeLabel = "Don't know? Use 12:00 PM",
  onTextChange,
  onPeriodChange
}) => {
  const tokens = TOKENS[theme];
  const generatedId = useId();
  const fieldId = id || `tob-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const initial = splitTob24(value || '');
  const [text, setText] = useState(() => (value ? `${initial.hour12}:${initial.minute}` : ''));
  const [period, setPeriod] = useState<TobPeriod>(value ? initial.period : 'AM');
  const [hour12, setHour12] = useState(initial.hour12);
  const [minute, setMinute] = useState(initial.minute);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quickSelect, setQuickSelect] = useState(false);
  const [textActive, setTextActive] = useState(false);
  const lastEmitted = useRef<string>(value || '');

  useEffect(() => {
    if ((value || '') === lastEmitted.current) return;
    lastEmitted.current = value || '';
    const next = splitTob24(value || '');
    setPeriod(value ? next.period : 'AM');
    setHour12(next.hour12);
    setMinute(next.minute);
    setText(value ? `${next.hour12}:${next.minute}` : '');
  }, [value]);

  const emit = (tob24: string, nextText: string, nextPeriod: TobPeriod) => {
    lastEmitted.current = tob24;
    setText(nextText);
    setPeriod(nextPeriod);
    const split = splitTob24(tob24);
    setHour12(split.hour12);
    setMinute(split.minute);
    onChange(tob24);
    if (onTextChange) onTextChange(nextText);
    if (onPeriodChange) onPeriodChange(nextPeriod);
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const formatted = formatTobInputWhileTyping(raw);
    // Preserve an explicit AM/PM suffix when a visitor types or pastes one;
    // otherwise use the visible segmented AM/PM control as the default.
    const parsed = parseTobInputWhileTyping(raw, period);
    if (parsed) {
      emit(parsed.tob24, parsed.display12, parsed.period);
    } else {
      lastEmitted.current = '';
      setText(formatted);
      onChange('');
      if (onTextChange) onTextChange(formatted);
    }
  };

  const handleBlur = () => {
    const parsed = parseFlexibleTob(text, period, { allowHourOnly: true });
    if (parsed) emit(parsed.tob24, parsed.display12, parsed.period);
  };

  const handlePeriodChange = (nextPeriod: TobPeriod) => {
    const parsed = parseFlexibleTob(text || value, nextPeriod, {
      allowHourOnly: true,
      force12HourWithPeriod: true
    });
    if (parsed) {
      emit(parsed.tob24, parsed.display12, nextPeriod);
    } else {
      setPeriod(nextPeriod);
    }
  };

  const handleSelectChange = (nextHour: string, nextMinute: string, nextPeriod: TobPeriod) => {
    setHour12(nextHour);
    setMinute(nextMinute);
    const parsed = parseFlexibleTob(`${nextHour}:${nextMinute}`, nextPeriod, {
      allowHourOnly: true,
      force12HourWithPeriod: true
    });
    if (parsed) emit(parsed.tob24, parsed.display12, parsed.period);
  };

  const validValue = isValidBirthTime(value);
  const problem = validValue ? '' : describeTobProblem(text || value);

  return (
    <div className={className}>
      {/* Top Label & Quick Action */}
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <label htmlFor={fieldId} className={tokens.label}>
          {label} {required && <span className={tokens.requiredMark}>*</span>}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {allowUnknownTime && !value && (
            <button
              type="button"
              onClick={() => emit('12:00', '12:00', 'PM')}
              className={`${tokens.link} whitespace-nowrap`}
              title="Set to 12:00 PM standard noon fallback"
            >
              <span>{unknownTimeLabel}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setQuickSelect(open => !open)}
            className={`${tokens.link} whitespace-nowrap`}
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>{quickSelect ? 'Hide dropdowns' : 'Quick select ▾'}</span>
          </button>
        </div>
      </div>

      {/* Compact single-row picker: tap the field to type, or open the clock */}
      <div className={tokens.inputRow}>
        <div className={`${tokens.iconBadge} h-9 w-9 shrink-0`}>
          <Clock className="h-4 w-4" />
        </div>

        <label htmlFor={fieldId} className={`${tokens.fieldBox} cursor-text py-1.5`}>
          <input
            id={fieldId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            required={required}
            placeholder="HH:MM"
            value={text}
            onChange={handleTextChange}
            onFocus={() => setTextActive(true)}
            onBlur={() => {
              setTextActive(false);
              handleBlur();
            }}
            className={`${tokens.input} min-w-0 flex-1 px-2 py-1 text-base sm:text-sm ${textActive ? '' : 'sr-only'}`}
            aria-describedby={`${fieldId}-hint`}
            aria-invalid={Boolean(text && !validValue)}
          />
          {!textActive && (
            <span
              aria-hidden="true"
              className={`ml-auto shrink-0 px-0.5 text-[13px] font-bold tabular-nums ${
                validValue ? 'text-amber-600 dark:text-amber-300' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {validValue ? `${splitTob24(value).hour12}:${splitTob24(value).minute}` : text || 'HH:MM'}
            </span>
          )}
        </label>

        {/* Compact AM / PM switch (outside the label so it never steals focus) */}
        <span className={`${tokens.segment} shrink-0 gap-0.5 p-0.5`}>
          {(['AM', 'PM'] as TobPeriod[]).map(option => (
            <button
              key={option}
              type="button"
              aria-pressed={period === option}
              aria-label={option === 'AM' ? 'Morning (AM)' : 'Evening (PM)'}
              onClick={() => handlePeriodChange(option)}
              className={`cursor-pointer rounded-lg px-1.5 py-0.5 text-[10px] font-black transition-all ${
                period === option
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              {option}
            </button>
          ))}
        </span>

        <button
          type="button"
          aria-label={`Open clock for ${label}`}
          title="Open Interactive Clock"
          onClick={() => setSheetOpen(true)}
          className={`${tokens.iconButton} h-9 shrink-0 gap-1 px-2.5 text-xs font-bold xl:px-3`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Pick</span>
        </button>
      </div>

      {/* Live Helper & Validation Footnote */}
      <div className="mt-1.5 min-h-[20px]">
        {validValue ? (
          <span id={`${fieldId}-hint`} className={tokens.ok} aria-live="polite">
            <span className="sm:hidden">✓ {formatReadableTob(value)}</span>
            <span className="hidden sm:inline">✓ {formatReadableTob(value)} (24-hr: {value})</span>
          </span>
        ) : problem ? (
          <span id={`${fieldId}-hint`} className={tokens.warn}>
            <span>⚠ {problem}</span>
          </span>
        ) : (
          <span id={`${fieldId}-hint`} className={tokens.hint}>
            {helpText || 'Type digits (e.g. 0930), select AM/PM, or tap Pick'}
          </span>
        )}
      </div>

      {/* Quick Select Dropdowns */}
      {quickSelect && (
        <div className="mt-2.5 grid grid-cols-2 gap-2 p-3 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl animate-in fade-in zoom-in-95 duration-200 shadow-sm">
          <select
            aria-label={`${label} hour`}
            value={hour12}
            onChange={event => handleSelectChange(event.target.value, minute, period)}
            className={`${tokens.select} py-2.5 px-2 text-xs`}
          >
            {HOURS_12.map(option => (
              <option key={option} value={option} className={tokens.option}>{option} hr</option>
            ))}
          </select>
          <select
            aria-label={`${label} minute`}
            value={minute}
            onChange={event => handleSelectChange(hour12, event.target.value, period)}
            className={`${tokens.select} py-2.5 px-2 text-xs`}
          >
            {MINUTES_60.map(option => (
              <option key={option} value={option} className={tokens.option}>{option} min</option>
            ))}
          </select>
        </div>
      )}

      {sheetOpen && (
        <ClockSheet
          tob24={value || '12:00'}
          theme={theme}
          title={`Select ${label}`}
          onConfirm={(tob24, nextPeriod) => {
            const split = splitTob24(tob24);
            emit(tob24, `${split.hour12}:${split.minute}`, nextPeriod);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
};

/* ─────────────────────────────── month field ────────────────────────────── */

export interface MonthFieldProps {
  /** 'YYYY-MM' */
  value: string;
  onChange: (monthValue: string) => void;
  label?: string;
  required?: boolean;
  theme?: FieldTheme;
  size?: FieldSize;
  id?: string;
  min?: string;
  max?: string;
  className?: string;
  helpText?: string;
}

export const MonthField: React.FC<MonthFieldProps> = ({
  value,
  onChange,
  label = 'Selected month',
  required = true,
  theme = 'light',
  size = 'md',
  id,
  min,
  max,
  className = '',
  helpText
}) => {
  const tokens = TOKENS[theme];
  const generatedId = useId();
  const fieldId = id || `month-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const now = new Date();
  const currentMonthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const effectiveMin = min || '1900-01';
  const effectiveMax = max || `${CURRENT_YEAR + 2}-12`;

  const [yearPart, monthPart] = (value || currentMonthValue).split('-');
  const activeYear = Number(yearPart) || now.getFullYear();
  const activeMonth = Number(monthPart) || now.getMonth() + 1;

  const minYear = Number(effectiveMin.slice(0, 4));
  const maxYear = Number(effectiveMax.slice(0, 4));
  const minMonth = Number(effectiveMin.slice(5, 7));
  const maxMonth = Number(effectiveMax.slice(5, 7));

  const years: number[] = [];
  for (let year = minYear; year <= maxYear; year++) years.push(year);

  const emit = (year: number, month: number) => {
    onChange(`${year}-${String(month).padStart(2, '0')}`);
  };

  const monthDisabled = (month: number): boolean => {
    if (activeYear === minYear && month < minMonth) return true;
    if (activeYear === maxYear && month > maxMonth) return true;
    return false;
  };

  return (
    <div className={className}>
      <label htmlFor={fieldId} className={`mb-1.5 ${tokens.label}`}>
        {label} {required && <span className={tokens.requiredMark}>*</span>}
      </label>

      <div className="grid grid-cols-2 gap-2">
        <select
          id={fieldId}
          aria-label={`${label} month`}
          value={activeMonth}
          onChange={event => emit(activeYear, Number(event.target.value))}
          className={`${tokens.select} ${SIZE_PADDING[size]}`}
        >
          {MONTH_LONG_NAMES.map((monthName, index) => {
            const monthNumber = index + 1;
            return (
              <option
                key={monthName}
                value={monthNumber}
                disabled={monthDisabled(monthNumber)}
                className={tokens.option}
              >
                {monthName}
              </option>
            );
          })}
        </select>
        <select
          aria-label={`${label} year`}
          value={activeYear}
          onChange={event => {
            const nextYear = Number(event.target.value);
            let nextMonth = activeMonth;
            if (nextYear === minYear && nextMonth < minMonth) nextMonth = minMonth;
            if (nextYear === maxYear && nextMonth > maxMonth) nextMonth = maxMonth;
            emit(nextYear, nextMonth);
          }}
          className={`${tokens.select} ${SIZE_PADDING[size]}`}
        >
          {years.map(year => (
            <option key={year} value={year} className={tokens.option}>{year}</option>
          ))}
        </select>
      </div>

      <p className={`mt-1.5 ${value ? tokens.ok : tokens.hint}`}>
        {value
          ? `✓ ${MONTH_LONG_NAMES[activeMonth - 1]} ${activeYear} (${value})`
          : helpText || 'Choose the month and year the report should start from.'}
      </p>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Birth time-zone notice                                             */
/* ------------------------------------------------------------------ */

export interface BirthTimeZoneNoticeProps {
  /** Result of resolveLocationTimezone()/resolveBirthTimeZone() for the current form values. */
  resolution?: BirthTimeZoneResolution | null;
  /** Canonical YYYY-MM-DD birth date (used for the "on this date" wording). */
  date?: string;
  /** Canonical 24-hour HH:MM birth time. */
  time?: string;
  theme?: FieldTheme;
  className?: string;
}

/**
 * Shows which IANA zone and historical UTC offset will be used for the birth
 * chart, and warns before submission when the entered wall-clock time falls in
 * a daylight-saving gap or overlap (the API rejects those rather than guess).
 * Renders nothing until a birth place has been selected.
 */
export const BirthTimeZoneNotice: React.FC<BirthTimeZoneNoticeProps> = ({
  resolution,
  date,
  time,
  theme = 'light',
  className = ''
}) => {
  const tokens = TOKENS[theme];
  if (!resolution) return null;

  const zoneLabel = resolution.timeZoneId ? resolution.timeZoneId.replace(/_/g, ' ') : null;
  const offsetLabel = formatUtcOffset(resolution.timezoneOffsetHours);

  if (resolution.problem) {
    return (
      <div className={`${tokens.warn} w-full items-start whitespace-normal text-left ${className}`} role="alert" aria-live="polite">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-black">Daylight-saving check:</span> {resolution.problem}
        </span>
      </div>
    );
  }

  if (!zoneLabel) {
    return (
      <p className={`${tokens.hint} ${className}`}>
        No regional time-zone rules were found for this place; the chart will use a fixed {offsetLabel} offset.
        Please double-check it against the birth record.
      </p>
    );
  }

  if (!resolution.evaluated) {
    return (
      <p className={`${tokens.hint} ${className}`}>
        Birth time zone: <span className="font-bold">{zoneLabel}</span>. The exact standard/daylight-saving offset is
        applied once the date and time are complete.
      </p>
    );
  }

  const when = date && time ? ` on ${date} at ${time}` : date ? ` on ${date}` : '';
  return (
    <p className={`${tokens.hint} ${className}`} aria-live="polite">
      <Check className="mr-1 inline h-3 w-3 align-[-2px] text-emerald-500" aria-hidden="true" />
      Birth time zone: <span className="font-bold">{zoneLabel}</span> · {offsetLabel}{when}
      {resolution.daylightSaving ? ' (daylight-saving time was in force)' : ''}
      {resolution.offsetAdjusted
        ? ` — corrected from ${formatUtcOffset(resolution.fallbackOffsetHours)} using the historical rules for this place.`
        : '.'}
    </p>
  );
};

// Aliases for backwards compatibility
export const DateOfBirthField = BirthDateField;
export const TimeOfBirthField = BirthTimeField;
