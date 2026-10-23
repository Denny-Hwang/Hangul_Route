import { DayLogSchema, mergeDayLog } from '@hangul-route/content-schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ACTIVITY_POINTS, DAILY_TIERS, DEFAULT_DAILY, DEFAULT_WEEKLY_DAYS, goalsInForce, pointsOn, ringOf, tierOf, withPoints } from '../points';

/*
 * F-CURR-002 section 7.4 (row CM-17): points from finished activities, kept per local day and install key in
 * `dayLog`, read as the sum over install keys; the daily goal in plain time words. The suite runs under TZ=UTC.
 */

describe('the points table (section 7.4)', () => {
  it('a quest or pack quest 3, Daily Review 3, Keep going 2, Try these again 2, a story 2, a word set 1', () => {
    expect(ACTIVITY_POINTS).toEqual({ quest: 3, packQuest: 3, dailyReview: 3, keepGoing: 2, tryAgain: 2, story: 2, wordSet: 1 });
  });

  it('the daily tiers are Light 3, Steady 6, Strong 10, Light by default; the weekly goal is 3 days by default', () => {
    expect(DAILY_TIERS.map((t) => [t.tier, t.points])).toEqual([
      ['light', 3],
      ['steady', 6],
      ['strong', 10],
    ]);
    expect(goalsInForce(undefined)).toEqual({ daily: DEFAULT_DAILY, weeklyDays: DEFAULT_WEEKLY_DAYS });
    expect([DEFAULT_DAILY, DEFAULT_WEEKLY_DAYS]).toEqual([3, 3]);
    expect(goalsInForce({ daily: 10, weeklyDays: 7, setAt: '2026-10-20T00:00:00.000Z' })).toEqual({ daily: 10, weeklyDays: 7 });
    expect([tierOf(3), tierOf(6), tierOf(10)]).toEqual(['light', 'steady', 'strong']);
    expect(tierOf(4 as 3)).toBe('light');
  });
});

describe('withPoints and pointsOn', () => {
  it('adds to this install key on the day; other keys and days are kept', () => {
    let log = withPoints(undefined, '2026-10-21', 'ik-a', 3);
    log = withPoints(log, '2026-10-21', 'ik-a', 2);
    log = withPoints(log, '2026-10-21', 'ik-b', 1);
    log = withPoints(log, '2026-10-20', 'ik-a', 1);
    expect(log).toEqual({ '2026-10-20': { 'ik-a': 1 }, '2026-10-21': { 'ik-a': 5, 'ik-b': 1 } });
    expect(pointsOn(log, '2026-10-21')).toBe(6);
    expect(pointsOn(log, '2026-10-22')).toBe(0);
    expect(pointsOn(undefined, '2026-10-22')).toBe(0);
  });

  it('a non-positive amount changes nothing (accuracy never removes points)', () => {
    const log = { '2026-10-21': { 'ik-a': 3 } };
    expect(withPoints(log, '2026-10-21', 'ik-a', 0)).toBe(log);
    expect(withPoints(log, '2026-10-21', 'ik-a', -3)).toBe(log);
    expect(withPoints(undefined, '2026-10-21', 'ik-a', 0)).toEqual({});
  });

  it('keeps the newest 70 days with points', () => {
    let log = {};
    for (let i = 0; i < 80; i += 1) log = withPoints(log, new Date(Date.UTC(2026, 6, 1) + i * 86_400_000).toISOString().slice(0, 10), 'ik-a', 1);
    expect(Object.keys(log)).toHaveLength(70);
    expect(Object.keys(log)[0]).toBe('2026-07-11');
  });

  it('a phone and a tablet on the same day add up after a sync, and re-syncing never counts a point twice (fast-check)', () => {
    const kinds = fc.array(fc.constantFrom(...(Object.keys(ACTIVITY_POINTS) as (keyof typeof ACTIVITY_POINTS)[])), { maxLength: 8 });
    fc.assert(
      fc.property(kinds, kinds, (phoneDone, tabletDone) => {
        const day = '2026-10-21';
        const phone = phoneDone.reduce((log, kind) => withPoints(log, day, 'ik-phone', ACTIVITY_POINTS[kind]), DayLogSchema.parse({}) ?? {});
        const tablet = tabletDone.reduce((log, kind) => withPoints(log, day, 'ik-tablet', ACTIVITY_POINTS[kind]), DayLogSchema.parse({}) ?? {});
        const merged = mergeDayLog(phone, tablet);
        const expected = [...phoneDone, ...tabletDone].reduce((sum, kind) => sum + ACTIVITY_POINTS[kind], 0);
        expect(pointsOn(merged, day)).toBe(expected);
        // Merging again (both ways, and with an older copy of the phone) changes nothing.
        expect(pointsOn(mergeDayLog(merged, phone), day)).toBe(expected);
        expect(pointsOn(mergeDayLog(tablet, merged), day)).toBe(expected);
        const older = phoneDone.slice(0, -1).reduce((log, kind) => withPoints(log, day, 'ik-phone', ACTIVITY_POINTS[kind]), {});
        expect(pointsOn(mergeDayLog(merged, older), day)).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });
});

describe('ringOf: a shape, never a number', () => {
  it('is empty, partly or met by today\'s points over the daily goal', () => {
    expect(ringOf(0, 3)).toEqual({ state: 'empty', fraction: 0 });
    expect(ringOf(2, 6)).toEqual({ state: 'partly', fraction: 2 / 6 });
    expect(ringOf(3, 3)).toEqual({ state: 'met', fraction: 1 });
    expect(ringOf(12, 10)).toEqual({ state: 'met', fraction: 1 });
    expect(ringOf(-1, 3)).toEqual({ state: 'empty', fraction: 0 });
  });
});
