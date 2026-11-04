import { addDays } from '@hangul-route/content-schema';
import { weekMondayOf as schemaMonday } from '@hangul-route/content-schema/week-drops';
import { describe, expect, it } from 'vitest';
import { WEEK_DROP_WEEKS } from '../../../content/__generated__/week-drops-index';
import { weekMondayOf as goalsMonday } from '../../goals/week';
import { localDay } from '../../vocab/progress';
import { dropWeekFor, dropWeekOf } from '../calendar';

/*
 * The calendar key of "This week in Korea" (F-CURR-002 §5.7 and §14, row CM-48): the ISO week on the learner's local day,
 * Monday to Sunday, as `steadyWeeks`. The suite runs under TZ=UTC; each fixed-clock case turns an instant into the local
 * day the way a device in that zone names it (the goals' time-zone tests do the same), then asks which drop it shows.
 */

function zoned(timeZone: string): (iso: string) => string {
  const format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return (iso) => {
    const parts = Object.fromEntries(format.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
}
const dropAt = (zone: string, iso: string): string | null => dropWeekFor(WEEK_DROP_WEEKS, zoned(zone)(iso));

describe('dropWeekOf: the Monday of the ISO week', () => {
  it("agrees with the goals' week and the schema's on every day of three years, and every key is a Monday", () => {
    for (let day = '2026-01-01'; day < '2029-01-01'; day = addDays(day, 1)) {
      const monday = dropWeekOf(day);
      expect(monday).toBe(goalsMonday(day));
      expect(monday).toBe(schemaMonday(day));
      expect(new Date(`${monday}T00:00:00Z`).getUTCDay()).toBe(1);
    }
  });
});

describe('dropWeekFor: the drop a device shows offline, from the bundled weeks and its own calendar', () => {
  it('ships the first 13 weeks from 26 October 2026, and shows each on every day from its Monday to its Sunday', () => {
    expect(WEEK_DROP_WEEKS).toHaveLength(13);
    expect(WEEK_DROP_WEEKS[0]).toBe('2026-10-26');
    for (const week of WEEK_DROP_WEEKS) for (let i = 0; i < 7; i += 1) expect(dropWeekFor(WEEK_DROP_WEEKS, addDays(week, i))).toBe(week);
  });

  it('shows nothing before the first week or after the last one (the next batch ships later)', () => {
    expect(dropWeekFor(WEEK_DROP_WEEKS, '2026-10-25')).toBeNull();
    expect(dropWeekFor(WEEK_DROP_WEEKS, '2027-01-25')).toBeNull();
    expect(dropWeekFor([], '2026-10-30')).toBeNull();
  });

  it('today, 30 October 2026, shows the week of 26 October (Frost Falls)', () => {
    expect(dropWeekFor(WEEK_DROP_WEEKS, '2026-10-30')).toBe('2026-10-26');
  });
});

describe('fixed clocks in four time zones (the suite runs under TZ=UTC)', () => {
  it('runs under TZ=UTC, so localDay is the UTC day here', () => {
    expect(localDay(new Date('2026-11-01T23:30:00.000Z'))).toBe('2026-11-01');
  });

  it('UTC+14 (Pacific/Kiritimati): Sunday 1 November at 10:30 UTC is already Monday there, the next drop', () => {
    expect(dropAt('Pacific/Kiritimati', '2026-11-01T09:30:00.000Z')).toBe('2026-10-26');
    expect(dropAt('Pacific/Kiritimati', '2026-11-01T10:30:00.000Z')).toBe('2026-11-02');
  });

  it('UTC-12 (Etc/GMT+12): Monday 2 November at 11:00 UTC is still Sunday there, the drop before', () => {
    expect(dropAt('Etc/GMT+12', '2026-11-02T11:00:00.000Z')).toBe('2026-10-26');
    expect(dropAt('Etc/GMT+12', '2026-11-02T12:30:00.000Z')).toBe('2026-11-02');
  });

  it('Asia/Seoul: Monday 08:00 is Sunday 23:00 UTC, and the new week has begun', () => {
    expect(dropAt('Asia/Seoul', '2026-11-08T14:59:00.000Z')).toBe('2026-11-02');
    expect(dropAt('Asia/Seoul', '2026-11-08T23:00:00.000Z')).toBe('2026-11-09');
  });

  it('America/Los_Angeles across the end of daylight saving (1 November 2026): the week turns at local midnight both sides', () => {
    // Sunday 1 November: 01:30 PDT happens, then clocks go back; the day stays Sunday until local midnight (08:00 UTC, PST).
    expect(dropAt('America/Los_Angeles', '2026-11-01T08:30:00.000Z')).toBe('2026-10-26');
    expect(dropAt('America/Los_Angeles', '2026-11-02T07:59:00.000Z')).toBe('2026-10-26');
    expect(dropAt('America/Los_Angeles', '2026-11-02T08:00:00.000Z')).toBe('2026-11-02');
    // A week earlier, still on daylight time, local midnight is 07:00 UTC.
    expect(dropAt('America/Los_Angeles', '2026-10-26T06:59:00.000Z')).toBeNull();
    expect(dropAt('America/Los_Angeles', '2026-10-26T07:00:00.000Z')).toBe('2026-10-26');
  });

  it('the turn of the year: 2026 has 53 ISO weeks, and 3 January 2027 is still the week of 28 December', () => {
    expect(dropAt('Asia/Seoul', '2027-01-03T12:00:00.000Z')).toBe('2026-12-28');
    expect(dropAt('Asia/Seoul', '2027-01-03T15:00:00.000Z')).toBe('2027-01-04');
  });
});
