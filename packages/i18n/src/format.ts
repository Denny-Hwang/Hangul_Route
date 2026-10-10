import { LOCALE_META, type UiLocale } from './locales';

/**
 * Formatters (F-I18N-001 §3.1). They wrap `Intl` and NEVER throw: where `Intl` is
 * missing, or the runtime rejects the locale, they fall back to small built-in
 * tables (Hermes `Intl` coverage is unverified, §10). The `Intl` tag is the
 * locale's `speechLang`.
 */

export type DateKind = 'weekday' | 'monthDay' | 'monthDayYear';
export type DateInput = Date | string | number;

export interface FormatDateOptions {
  /** Read the calendar day in UTC (stored timestamps such as billing dates) instead of local time. */
  utc?: boolean;
}

const WEEKDAYS: Record<UiLocale, readonly string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  ko: ['일', '월', '화', '수', '목', '금', '토'],
};

const MONTHS: Record<UiLocale, readonly string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  ko: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
};

const PATTERNS: Record<
  UiLocale,
  { monthDay: (month: string, day: number) => string; monthDayYear: (month: string, day: number, year: number) => string }
> = {
  en: {
    monthDay: (m, d) => `${m} ${d}`,
    monthDayYear: (m, d, y) => `${m} ${d}, ${y}`,
  },
  es: {
    monthDay: (m, d) => `${d} ${m}`,
    monthDayYear: (m, d, y) => `${d} ${m} ${y}`,
  },
  ko: {
    monthDay: (m, d) => `${m} ${d}일`,
    monthDayYear: (m, d, y) => `${y}년 ${m} ${d}일`,
  },
};

const DATE_OPTIONS: Record<DateKind, Intl.DateTimeFormatOptions> = {
  weekday: { weekday: 'short' },
  monthDay: { month: 'short', day: 'numeric' },
  monthDayYear: { month: 'short', day: 'numeric', year: 'numeric' },
};

function fallbackDate(locale: UiLocale, date: Date, kind: DateKind, utc: boolean): string {
  const weekday = utc ? date.getUTCDay() : date.getDay();
  if (kind === 'weekday') return WEEKDAYS[locale][weekday];
  const month = MONTHS[locale][utc ? date.getUTCMonth() : date.getMonth()];
  const day = utc ? date.getUTCDate() : date.getDate();
  if (kind === 'monthDay') return PATTERNS[locale].monthDay(month, day);
  return PATTERNS[locale].monthDayYear(month, day, utc ? date.getUTCFullYear() : date.getFullYear());
}

/** A short date in the locale: `weekday` ("Thu"), `monthDay` ("Sep 3") or `monthDayYear` ("Sep 3, 2026"). Empty string for an invalid date. */
export function formatDate(locale: UiLocale, value: DateInput, kind: DateKind, options: FormatDateOptions = {}): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const utc = options.utc === true;
  try {
    const intlOptions = utc ? { ...DATE_OPTIONS[kind], timeZone: 'UTC' } : DATE_OPTIONS[kind];
    return new Intl.DateTimeFormat(LOCALE_META[locale].speechLang, intlOptions).format(date);
  } catch {
    return fallbackDate(locale, date, kind, utc);
  }
}

/** Digit grouping with commas for plain decimal strings; anything else (NaN, exponent form) is returned as is. */
function groupDigits(text: string): string {
  const parts = /^(-?)(\d+)(\.\d+)?$/.exec(text);
  if (parts === null) return text;
  return `${parts[1]}${parts[2].replace(/\B(?=(\d{3})+$)/g, ',')}${parts[3] ?? ''}`;
}

export function formatNumber(locale: UiLocale, n: number): string {
  try {
    return new Intl.NumberFormat(LOCALE_META[locale].speechLang).format(n);
  } catch {
    return groupDigits(String(n));
  }
}

/** US dollars (payments are not live and the currency does not change, D5): "$153", "$15.30". */
export function formatUsd(locale: UiLocale, amount: number): string {
  const digits = Number.isInteger(amount) ? 0 : 2;
  try {
    return new Intl.NumberFormat(LOCALE_META[locale].speechLang, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: digits,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount < 0 ? '-' : ''}$${groupDigits(Math.abs(amount).toFixed(digits))}`;
  }
}

export interface RelativeDayWords {
  today: string;
  yesterday: string;
  notYet: string;
}

const DAY_MS = 86_400_000;

/**
 * "today" / "yesterday" / a weekday inside the last week / "Sep 3" beyond /
 * "not yet" without a readable date. The words come from the messages
 * (`getMessages(locale).common.time`) so each locale says them its own way.
 */
export function describeRelativeDay(
  locale: UiLocale,
  words: RelativeDayWords,
  iso: string | null | undefined,
  now: Date,
): string {
  if (!iso) return words.notYet;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return words.notYet;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  const days = Math.round((startOfToday - startOfThen) / DAY_MS);
  if (days <= 0) return words.today;
  if (days === 1) return words.yesterday;
  return formatDate(locale, then, days < 7 ? 'weekday' : 'monthDay');
}
