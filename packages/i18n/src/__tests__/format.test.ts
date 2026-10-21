import { afterEach, describe, expect, it, vi } from 'vitest';
import { compareNames, describeRelativeDay, formatDate, formatMinorAmount, formatNumber, formatUsd } from '../format';

afterEach(() => {
  vi.unstubAllGlobals();
});

const words = { today: 'today', yesterday: 'yesterday', notYet: 'not yet' };
// Noon, local time, so the calendar day is the same in every time zone.
const sep3 = new Date(2026, 8, 3, 12, 0, 0);

describe('formatDate: Intl path', () => {
  it('en', () => {
    expect(formatDate('en', sep3, 'monthDay')).toBe('Sep 3');
    expect(formatDate('en', sep3, 'monthDayYear')).toBe('Sep 3, 2026');
    expect(formatDate('en', sep3, 'weekday')).toBe('Thu');
  });

  it('es and ko produce a localised string containing the day', () => {
    for (const locale of ['es', 'ko'] as const) {
      for (const kind of ['monthDay', 'monthDayYear'] as const) {
        expect(formatDate(locale, sep3, kind)).toContain('3');
      }
      expect(formatDate(locale, sep3, 'weekday').length).toBeGreaterThan(0);
    }
    expect(formatDate('ko', sep3, 'monthDay')).toContain('9');
    expect(formatDate('ko', sep3, 'monthDayYear')).toContain('2026');
  });

  it('accepts ISO strings and epoch milliseconds, and a UTC option', () => {
    const iso = '2026-09-03T23:30:00.000Z';
    expect(formatDate('en', iso, 'monthDayYear', { utc: true })).toBe('Sep 3, 2026');
    expect(formatDate('en', Date.parse(iso), 'monthDay', { utc: true })).toBe('Sep 3');
    expect(formatDate('en', new Date(iso), 'weekday', { utc: true })).toBe('Thu');
  });

  it('monthYear names a whole month (a report window, F-REPORT-001 RP-7a1)', () => {
    expect(formatDate('en', sep3, 'monthYear')).toBe('September 2026');
    expect(formatDate('en', '2026-10-01T00:00:00.000Z', 'monthYear', { utc: true })).toBe('October 2026');
    expect(formatDate('es', sep3, 'monthYear')).toContain('2026');
    expect(formatDate('ko', sep3, 'monthYear')).toContain('9');
    expect(formatDate('ko', sep3, 'monthYear')).toContain('2026');
  });

  it('monthShort names a month alone, short (the report growth axis, F-REPORT-001 RP-7b)', () => {
    expect(formatDate('en', sep3, 'monthShort')).toBe('Sep');
    expect(formatDate('en', '2026-10-01T00:00:00.000Z', 'monthShort', { utc: true })).toBe('Oct');
    expect(formatDate('es', sep3, 'monthShort')).toMatch(/^sept?/);
    expect(formatDate('ko', sep3, 'monthShort')).toBe('9월');
    expect(formatDate('en', 'not a date', 'monthShort')).toBe('');
  });

  it('weekdayLong names the whole weekday (the report calendar sentence, F-REPORT-001 RP-7a1)', () => {
    expect(formatDate('en', sep3, 'weekdayLong')).toBe('Thursday');
    expect(formatDate('en', '2026-09-03T23:30:00.000Z', 'weekdayLong', { utc: true })).toBe('Thursday');
    expect(formatDate('es', sep3, 'weekdayLong')).toBe('jueves');
    expect(formatDate('ko', sep3, 'weekdayLong')).toBe('목요일');
    expect(formatDate('en', 'not a date', 'weekdayLong')).toBe('');
  });

  it('returns an empty string for an invalid date (never throws)', () => {
    expect(formatDate('en', 'not a date', 'monthYear')).toBe('');
    expect(formatDate('en', 'not a date', 'monthDay')).toBe('');
    expect(formatDate('ko', new Date(NaN), 'weekday')).toBe('');
  });
});

describe('formatDate: fallback tables (no Intl, or Intl throws)', () => {
  const noIntl = (): void => {
    vi.stubGlobal('Intl', undefined);
  };
  const throwingIntl = (): void => {
    class Boom {
      constructor() {
        throw new RangeError('unsupported');
      }
    }
    vi.stubGlobal('Intl', { DateTimeFormat: Boom, NumberFormat: Boom });
  };

  for (const [name, install] of [
    ['Intl missing', noIntl],
    ['Intl throws', throwingIntl],
  ] as const) {
    it(`en (${name})`, () => {
      install();
      expect(formatDate('en', sep3, 'monthDay')).toBe('Sep 3');
      expect(formatDate('en', sep3, 'monthDayYear')).toBe('Sep 3, 2026');
      expect(formatDate('en', sep3, 'weekdayLong')).toBe('Thursday');
      expect(formatDate('en', sep3, 'weekday')).toBe('Thu');
      expect(formatDate('en', sep3, 'monthYear')).toBe('Sep 2026');
      expect(formatDate('en', sep3, 'monthShort')).toBe('Sep');
    });

    it(`es (${name})`, () => {
      install();
      expect(formatDate('es', sep3, 'monthDay')).toBe('3 sep');
      expect(formatDate('es', sep3, 'monthDayYear')).toBe('3 sep 2026');
      expect(formatDate('es', sep3, 'weekdayLong')).toBe('jueves');
      expect(formatDate('es', sep3, 'weekday')).toBe('jue');
      expect(formatDate('es', sep3, 'monthYear')).toBe('sep 2026');
      expect(formatDate('es', sep3, 'monthShort')).toBe('sep');
    });

    it(`ko (${name})`, () => {
      install();
      expect(formatDate('ko', sep3, 'monthDay')).toBe('9월 3일');
      expect(formatDate('ko', sep3, 'monthDayYear')).toBe('2026년 9월 3일');
      expect(formatDate('ko', sep3, 'weekdayLong')).toBe('목요일');
      expect(formatDate('ko', sep3, 'weekday')).toBe('목');
      expect(formatDate('ko', sep3, 'monthYear')).toBe('2026년 9월');
      expect(formatDate('ko', sep3, 'monthShort')).toBe('9월');
    });
  }

  it('the fallback honours the UTC option', () => {
    noIntl();
    const lateUtc = '2026-01-31T23:59:00.000Z';
    expect(formatDate('en', lateUtc, 'monthDay', { utc: true })).toBe('Jan 31');
    expect(formatDate('en', lateUtc, 'weekday', { utc: true })).toBe('Sat');
    expect(formatDate('en', lateUtc, 'weekdayLong', { utc: true })).toBe('Saturday');
    expect(formatDate('en', lateUtc, 'monthDayYear', { utc: true })).toBe('Jan 31, 2026');
    expect(formatDate('en', '2026-12-31T23:59:00.000Z', 'monthYear', { utc: true })).toBe('Dec 2026');
  });

  it('the fallback returns an empty string for an invalid date', () => {
    noIntl();
    expect(formatDate('en', 'nope', 'monthDay')).toBe('');
  });
});

describe('formatNumber', () => {
  it('uses Intl grouping', () => {
    expect(formatNumber('en', 1234567)).toBe('1,234,567');
    expect(formatNumber('en', 0.5)).toBe('0.5');
    expect(formatNumber('ko', 1000)).toBe('1,000');
    expect(formatNumber('es', 1000)).toMatch(/^1[,.\s ]?000$/);
  });

  it('falls back to grouped digits when Intl is missing or throws', () => {
    vi.stubGlobal('Intl', undefined);
    expect(formatNumber('en', 1234567)).toBe('1,234,567');
    expect(formatNumber('es', 999)).toBe('999');
    expect(formatNumber('ko', -1234.5)).toBe('-1,234.5');
    expect(formatNumber('en', NaN)).toBe('NaN');
    expect(formatNumber('en', Infinity)).toBe('Infinity');
    expect(formatNumber('en', 1e21)).toBe('1e+21');
    class Boom {
      constructor() {
        throw new RangeError('unsupported');
      }
    }
    vi.stubGlobal('Intl', { NumberFormat: Boom });
    expect(formatNumber('en', 2500)).toBe('2,500');
  });
});

describe('formatUsd', () => {
  it('whole amounts have no cents; others always two digits', () => {
    expect(formatUsd('en', 153)).toBe('$153');
    expect(formatUsd('en', 15.3)).toBe('$15.30');
    expect(formatUsd('en', 0)).toBe('$0');
    expect(formatUsd('en', 1234.5)).toBe('$1,234.50');
  });

  it('cents: always two digits, for a computed amount such as a discounted price', () => {
    expect(formatUsd('en', 150, { cents: true })).toBe('$150.00');
    expect(formatUsd('en', 0, { cents: true })).toBe('$0.00');
    expect(formatUsd('en', 12.24, { cents: true })).toBe('$12.24');
    expect(formatUsd('en', 122.4, { cents: true })).toBe('$122.40');
    expect(formatUsd('en', 1234.5, { cents: false })).toBe('$1,234.50');
    expect(formatUsd('en', 153, {})).toBe('$153');
  });

  it('cents survive the fallback too', () => {
    vi.stubGlobal('Intl', undefined);
    expect(formatUsd('en', 150, { cents: true })).toBe('$150.00');
    expect(formatUsd('es', 1234, { cents: true })).toBe('$1,234.00');
    expect(formatUsd('en', 153)).toBe('$153');
  });

  it("takes the fraction digits from Stripe's minor units, not from Intl's CLDR data", () => {
    // Intl reports 0 digits for these; Stripe stores them two-decimal.
    expect(formatMinorAmount('en', 500000, 'huf')).toMatch(/^HUF\s5,000\.00$/);
    expect(formatMinorAmount('en', 150000, 'isk')).toMatch(/^ISK\s1,500\.00$/);
    expect(formatMinorAmount('en', 5000000, 'cop')).toMatch(/^COP\s50,000\.00$/);
    // Stripe's three-decimal currencies.
    expect(formatMinorAmount('en', 1234, 'kwd')).toMatch(/^KWD\s1\.234$/);
    // Any other well-formed code Intl accepts is two-decimal.
    expect(formatMinorAmount('en', 1234, 'xyz')).toContain('12.34');
  });

  it('is localised for es and ko and always mentions the amount', () => {
    expect(formatUsd('es', 15.3)).toContain('15');
    expect(formatUsd('ko', 153)).toContain('153');
  });

  it('falls back to a $ string when Intl is missing or throws', () => {
    vi.stubGlobal('Intl', undefined);
    expect(formatUsd('en', 153)).toBe('$153');
    expect(formatUsd('es', 15.3)).toBe('$15.30');
    expect(formatUsd('ko', 1234.5)).toBe('$1,234.50');
    expect(formatUsd('en', -2)).toBe('-$2');
    expect(formatUsd('en', NaN)).toBe('$NaN');
    class Boom {
      constructor() {
        throw new RangeError('unsupported');
      }
    }
    vi.stubGlobal('Intl', { NumberFormat: Boom });
    expect(formatUsd('en', 15.3)).toBe('$15.30');
  });
});

describe('formatMinorAmount (F-BILL-002 receipts: Stripe minor units)', () => {
  it('uses the currency own fraction digits, never a fixed / 100', () => {
    expect(formatMinorAmount('en', 1530, 'usd')).toBe('$15.30');
    expect(formatMinorAmount('en', 15300, 'USD')).toBe('$153.00');
    expect(formatMinorAmount('en', 0, 'usd')).toBe('$0.00');
    expect(formatMinorAmount('en', 20000, 'krw')).toBe('₩20,000');
    expect(formatMinorAmount('en', 1500, 'jpy')).toBe('¥1,500');
    expect(formatMinorAmount('en', 1250, 'eur')).toBe('€12.50');
  });

  it('is localised for es and ko and always mentions the amount', () => {
    expect(formatMinorAmount('es', 1530, 'usd')).toMatch(/15[.,]30/);
    expect(formatMinorAmount('ko', 20000, 'krw')).toContain('20,000');
  });

  it('falls back to the number and the code when Intl is missing, or rejects the code', () => {
    expect(formatMinorAmount('en', 1234, 'u$d')).toBe('12.34 U$D');
    vi.stubGlobal('Intl', undefined);
    expect(formatMinorAmount('en', 1530, 'usd')).toBe('$15.30');
    expect(formatMinorAmount('en', 123456, 'eur')).toBe('1,234.56 EUR');
    expect(formatMinorAmount('es', 20000, 'krw')).toBe('20,000 KRW');
    expect(formatMinorAmount('en', -500, 'usd')).toBe('-$5.00');
    expect(formatMinorAmount('en', -500, 'gbp')).toBe('-5.00 GBP');
    expect(formatMinorAmount('en', 500000, 'huf')).toBe('5,000.00 HUF');
    expect(formatMinorAmount('en', 1234, 'kwd')).toBe('1.234 KWD');
  });
});

describe('describeRelativeDay', () => {
  const now = new Date(2026, 8, 10, 15, 0, 0); // Thu Sep 10, local

  it('never: no value or an unreadable one', () => {
    expect(describeRelativeDay('en', words, null, now)).toBe('not yet');
    expect(describeRelativeDay('en', words, undefined, now)).toBe('not yet');
    expect(describeRelativeDay('en', words, '', now)).toBe('not yet');
    expect(describeRelativeDay('en', words, 'garbage', now)).toBe('not yet');
  });

  it('today (including a future timestamp) and yesterday', () => {
    expect(describeRelativeDay('en', words, new Date(2026, 8, 10, 1, 0, 0).toISOString(), now)).toBe('today');
    expect(describeRelativeDay('en', words, new Date(2026, 8, 11, 9, 0, 0).toISOString(), now)).toBe('today');
    expect(describeRelativeDay('en', words, new Date(2026, 8, 9, 23, 0, 0).toISOString(), now)).toBe('yesterday');
  });

  it('weekday name within the last week', () => {
    expect(describeRelativeDay('en', words, new Date(2026, 8, 8, 12).toISOString(), now)).toBe('Tue');
    expect(describeRelativeDay('en', words, new Date(2026, 8, 4, 12).toISOString(), now)).toBe('Fri');
    expect(describeRelativeDay('ko', words, new Date(2026, 8, 8, 12).toISOString(), now).length).toBeGreaterThan(0);
  });

  it('month and day from a week on', () => {
    expect(describeRelativeDay('en', words, new Date(2026, 8, 3, 12).toISOString(), now)).toBe('Sep 3');
    expect(describeRelativeDay('en', words, new Date(2026, 7, 20, 12).toISOString(), now)).toBe('Aug 20');
  });

  it('uses the message words of the locale it is given', () => {
    const es = { today: 'hoy', yesterday: 'ayer', notYet: 'todavía no' };
    expect(describeRelativeDay('es', es, null, now)).toBe('todavía no');
    expect(describeRelativeDay('es', es, new Date(2026, 8, 9, 12).toISOString(), now)).toBe('ayer');
  });
});

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D17 (row OA-4a): the chooser orders 13 or more learners by name.
describe('compareNames', () => {
  it('ignores case and accents, and reads digits as numbers', () => {
    const cmp = compareNames('en');
    expect(['Zoe', 'ana', 'Émile', 'Student 10', 'Student 9'].sort(cmp)).toEqual(['ana', 'Émile', 'Student 9', 'Student 10', 'Zoe']);
    expect(cmp('ana', 'Ana')).toBe(0);
  });

  it('Spanish puts ñ after n; Korean follows the Hangul order', () => {
    expect(['Ñoño', 'Oscar', 'Nora'].sort(compareNames('es'))).toEqual(['Nora', 'Ñoño', 'Oscar']);
    expect(['다은', '가온', '나래'].sort(compareNames('ko'))).toEqual(['가온', '나래', '다은']);
  });

  it('a runtime without Intl.Collator compares by code point', () => {
    vi.stubGlobal('Intl', { ...Intl, Collator: () => { throw new Error('no data'); } });
    const cmp = compareNames('en');
    expect(['b', 'a', 'a'].sort(cmp)).toEqual(['a', 'a', 'b']);
    expect(cmp('b', 'a')).toBe(1);
  });
});
