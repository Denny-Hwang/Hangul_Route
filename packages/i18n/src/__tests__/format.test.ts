import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeRelativeDay, formatDate, formatNumber, formatUsd } from '../format';

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

  it('returns an empty string for an invalid date (never throws)', () => {
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
      expect(formatDate('en', sep3, 'weekday')).toBe('Thu');
    });

    it(`es (${name})`, () => {
      install();
      expect(formatDate('es', sep3, 'monthDay')).toBe('3 sep');
      expect(formatDate('es', sep3, 'monthDayYear')).toBe('3 sep 2026');
      expect(formatDate('es', sep3, 'weekday')).toBe('jue');
    });

    it(`ko (${name})`, () => {
      install();
      expect(formatDate('ko', sep3, 'monthDay')).toBe('9월 3일');
      expect(formatDate('ko', sep3, 'monthDayYear')).toBe('2026년 9월 3일');
      expect(formatDate('ko', sep3, 'weekday')).toBe('목');
    });
  }

  it('the fallback honours the UTC option', () => {
    noIntl();
    const lateUtc = '2026-01-31T23:59:00.000Z';
    expect(formatDate('en', lateUtc, 'monthDay', { utc: true })).toBe('Jan 31');
    expect(formatDate('en', lateUtc, 'weekday', { utc: true })).toBe('Sat');
    expect(formatDate('en', lateUtc, 'monthDayYear', { utc: true })).toBe('Jan 31, 2026');
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
