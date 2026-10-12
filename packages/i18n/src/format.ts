import { LOCALE_META, type UiLocale } from './locales';

/**
 * Formatters (F-I18N-001 §3.1). They wrap `Intl` and NEVER throw: where `Intl` is
 * missing, or the runtime rejects the locale, they fall back to small built-in
 * tables (Hermes `Intl` coverage is unverified, §10). The `Intl` tag is the
 * locale's `speechLang`.
 */

export type DateKind = 'weekday' | 'monthDay' | 'monthDayYear' | 'monthYear' | 'weekdayLong';
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

const WEEKDAYS_LONG: Record<UiLocale, readonly string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  ko: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
};

const MONTHS: Record<UiLocale, readonly string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  ko: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
};

const PATTERNS: Record<
  UiLocale,
  {
    monthDay: (month: string, day: number) => string;
    monthDayYear: (month: string, day: number, year: number) => string;
    monthYear: (month: string, year: number) => string;
  }
> = {
  en: {
    monthDay: (m, d) => `${m} ${d}`,
    monthDayYear: (m, d, y) => `${m} ${d}, ${y}`,
    monthYear: (m, y) => `${m} ${y}`,
  },
  es: {
    monthDay: (m, d) => `${d} ${m}`,
    monthDayYear: (m, d, y) => `${d} ${m} ${y}`,
    monthYear: (m, y) => `${m} ${y}`,
  },
  ko: {
    monthDay: (m, d) => `${m} ${d}일`,
    monthDayYear: (m, d, y) => `${y}년 ${m} ${d}일`,
    monthYear: (m, y) => `${y}년 ${m}`,
  },
};

const DATE_OPTIONS: Record<DateKind, Intl.DateTimeFormatOptions> = {
  weekday: { weekday: 'short' },
  monthDay: { month: 'short', day: 'numeric' },
  monthDayYear: { month: 'short', day: 'numeric', year: 'numeric' },
  monthYear: { month: 'long', year: 'numeric' },
  weekdayLong: { weekday: 'long' },
};

function fallbackDate(locale: UiLocale, date: Date, kind: DateKind, utc: boolean): string {
  const weekday = utc ? date.getUTCDay() : date.getDay();
  if (kind === 'weekday') return WEEKDAYS[locale][weekday]!;
  if (kind === 'weekdayLong') return WEEKDAYS_LONG[locale][weekday]!;
  const month = MONTHS[locale][utc ? date.getUTCMonth() : date.getMonth()]!;
  const day = utc ? date.getUTCDate() : date.getDate();
  const year = utc ? date.getUTCFullYear() : date.getFullYear();
  if (kind === 'monthDay') return PATTERNS[locale].monthDay(month, day);
  if (kind === 'monthYear') return PATTERNS[locale].monthYear(month, year);
  return PATTERNS[locale].monthDayYear(month, day, year);
}

/**
 * A short date in the locale: `weekday` ("Thu"), `monthDay` ("Sep 3"), `monthDayYear` ("Sep 3, 2026") or a whole month,
 * `monthYear` ("September 2026"; "Sep 2026" from the fallback table), or a whole weekday, `weekdayLong` ("Thursday",
 * for a sentence that lists days). Empty string for an invalid date.
 */
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
  return `${parts[1]}${parts[2]!.replace(/\B(?=(\d{3})+$)/g, ',')}${parts[3] ?? ''}`;
}

export function formatNumber(locale: UiLocale, n: number): string {
  try {
    return new Intl.NumberFormat(LOCALE_META[locale].speechLang).format(n);
  } catch {
    return groupDigits(String(n));
  }
}

export interface FormatUsdOptions {
  /** Always show cents ("$150.00"): for a computed amount such as a discounted price. */
  cents?: boolean;
}

/**
 * US dollars (payments are not live and the currency does not change, D5): "$153",
 * "$15.30"; with `cents`, always two digits ("$150.00").
 */
export function formatUsd(locale: UiLocale, amount: number, options: FormatUsdOptions = {}): string {
  const digits = options.cents === true || !Number.isInteger(amount) ? 2 : 0;
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

/**
 * Stripe's zero-decimal currencies: their minor unit is the whole unit
 * (https://docs.stripe.com/currencies#zero-decimal).
 */
const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);

/** Stripe's three-decimal currencies (https://docs.stripe.com/currencies#three-decimal). */
const THREE_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

/**
 * The digits of Stripe's minor unit for a currency. Stripe's own table, not
 * `Intl`'s CLDR digits, which differ for some codes (HUF, ISK, COP and others
 * read 0 in CLDR but are two-decimal in Stripe's API).
 */
function stripeMinorDigits(code: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  return THREE_DECIMAL_CURRENCIES.has(code) ? 3 : 2;
}

/**
 * An amount in a currency's minor unit, as Stripe stores it (F-BILL-002 section
 * 4.10): cents for `usd` (1530 → "$15.30"), whole units for zero-decimal
 * currencies (`krw` 20000 → "₩20,000"), thousandths for three-decimal ones
 * (`kwd` 1234 → "KWD 1.234"). The digits follow Stripe's minor unit, never a
 * fixed `/ 100`. `currency` is an ISO 4217 code in any case. Without `Intl`,
 * or for a code it rejects: "15.30 EUR" ("$15.30" for US dollars).
 */
export function formatMinorAmount(locale: UiLocale, amountMinor: number, currency: string): string {
  const code = currency.toUpperCase();
  const digits = stripeMinorDigits(code);
  const amount = amountMinor / 10 ** digits;
  try {
    return new Intl.NumberFormat(LOCALE_META[locale].speechLang, { style: 'currency', currency: code, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
  } catch {
    const text = groupDigits(Math.abs(amount).toFixed(digits));
    const sign = amountMinor < 0 ? '-' : '';
    return code === 'USD' ? `${sign}$${text}` : `${sign}${text} ${code}`;
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
