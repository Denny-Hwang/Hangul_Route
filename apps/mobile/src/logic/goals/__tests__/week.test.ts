import type { ProgressSnapshot, SessionLog } from '@hangul-route/content-schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { shownStreak } from '../../streak';
import { learnedDays, learnedInWeek, restDaysBefore, weekDaysOf, weekDots, weekMondayOf } from '../week';

/*
 * The week strip's days (F-CURR-002 section 7.4, OD-6, row CM-17; design/wireframes/home/goal-ring-weekly-dots.md
 * "Rest-day rule"). The suite runs under TZ=UTC; days are local day keys.
 */

// 2026-10-19 is a Monday.
const W1 = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];
const [MON, TUE, WED, THU, FRI, SAT, SUN] = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
const MON2 = '2026-10-26';

const set = (...days: string[]) => new Set(days);
const states = (learned: Set<string>, today: string) => weekDots(learned, today).map((d) => d.state);

let seq = 0;
function quest(localDay: string): SessionLog {
  seq += 1;
  return { id: `session:${localDay}T09:00:00.000Z:${seq}`, profileId: 'p1', startedAt: `${localDay}T09:00:00.000Z`, episodesTouched: [], localDay };
}
function snapshot(over: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return { profileId: 'p1', updatedAt: '2026-10-21T00:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, ...over };
}

describe('the ISO week on local days, Monday to Sunday in every locale', () => {
  it('weekMondayOf names the Monday of the week of any day, across months and years', () => {
    for (const day of [MON, TUE, WED, THU, FRI, SAT, SUN]) expect(weekMondayOf(day)).toBe(MON);
    expect(weekMondayOf(MON2)).toBe(MON2);
    expect(weekMondayOf('2027-01-01')).toBe('2026-12-28');
    expect(weekMondayOf('2026-03-01')).toBe('2026-02-23');
    expect(weekDaysOf(MON)).toEqual([MON, TUE, WED, THU, FRI, SAT, SUN]);
  });
});

describe('learnedDays: days with points in dayLog or a session that keeps the run', () => {
  it('reads both, never a day with 0 points, a game-only day or a key that is not a day', () => {
    const snap = snapshot({
      sessions: [quest(MON), { id: 'session:time:x', profileId: 'p1', startedAt: `${TUE}T09:00:00.000Z`, episodesTouched: [], localDay: TUE }],
      dayLog: { [WED]: { 'ik-a': 2 }, [THU]: { 'ik-a': 0 }, 'not-a-day': { 'ik-a': 3 } },
    });
    expect([...learnedDays(snap)].sort()).toEqual([MON, WED]);
    expect(learnedDays(undefined).size).toBe(0);
  });
});

describe('the rest-day rule', () => {
  it('first day, no history: every dot plain but today', () => {
    expect(states(set(), WED)).toEqual(['plain', 'plain', 'today', 'plain', 'plain', 'plain', 'plain']);
  });

  it('days before the first finished activity are never rest days', () => {
    expect(states(set(WED), FRI)).toEqual(['plain', 'plain', 'learned', 'rest', 'today', 'plain', 'plain']);
  });

  it('today is never a rest day, and a learned today shows learned', () => {
    expect(states(set(MON), TUE)).toEqual(['learned', 'today', 'plain', 'plain', 'plain', 'plain', 'plain']);
    expect(states(set(MON, TUE), TUE)).toEqual(['learned', 'learned', 'plain', 'plain', 'plain', 'plain', 'plain']);
  });

  it('A2: Monday learned, Tuesday and Wednesday rest, Thursday the third quiet day ends the run; the crescents stay', () => {
    expect(states(set(MON), FRI)).toEqual(['learned', 'rest', 'rest', 'plain', 'today', 'plain', 'plain']);
    // The streak line agrees: the run has ended (CM-4 shows nothing, so Home says Start a new run).
    expect(shownStreak(snapshot({ sessions: [quest(MON)] }), FRI)).toBe(0);
    expect(shownStreak(snapshot({ sessions: [quest(MON)] }), THU)).toBe(1);
  });

  it('rest days apart: Monday rest, Wednesday rest and a quiet Friday end the run on Friday', () => {
    const learned = set(W1[6] as string, TUE, THU);
    expect(states(learned, SAT)).toEqual(['rest', 'learned', 'rest', 'learned', 'plain', 'today', 'plain']);
    expect(shownStreak(snapshot({ sessions: [...learned].map(quest) }), SAT)).toBe(0);
    expect(shownStreak(snapshot({ sessions: [...learned].map(quest) }), FRI)).toBe(3);
  });

  it('quiet days after a run ended stay plain until the next learned day starts a new run, which counts its own rest days', () => {
    const learned = set(W1[0] as string, MON, SAT);
    // Last week: Monday learned, Tuesday and Wednesday rest, Thursday ends it; nothing until this Monday.
    expect(restDaysBefore(learned, MON2)).toEqual(set(W1[1] as string, W1[2] as string, TUE, WED, SUN));
    expect(states(learned, SUN)).toEqual(['learned', 'rest', 'rest', 'plain', 'plain', 'learned', 'today']);
    // Saturday's run goes on through Sunday, as the streak number says.
    expect(shownStreak(snapshot({ sessions: [...learned].map(quest) }), MON2)).toBe(1);
  });

  it('a gap across a week boundary uses each week\'s own 2', () => {
    // Friday learned; Saturday, Sunday rest (this week's 2), Monday, Tuesday rest (next week's 2), Wednesday learned.
    const learned = set(FRI, '2026-10-28');
    const next = weekDots(learned, '2026-10-29').map((d) => d.state);
    expect(next).toEqual(['rest', 'rest', 'learned', 'today', 'plain', 'plain', 'plain']);
    expect(restDaysBefore(learned, '2026-10-26')).toEqual(set(SAT, SUN));
    expect(states(learned, SUN)).toEqual(['plain', 'plain', 'plain', 'plain', 'learned', 'rest', 'today']);
    expect(shownStreak(snapshot({ sessions: [quest(FRI), quest('2026-10-28')] }), '2026-10-29')).toBe(2);
  });

  it('a rest day never changes the streak number: rest days bridge the run and add nothing', () => {
    const sessions = [quest(MON), quest(THU)];
    expect(states(set(MON, THU), FRI)).toEqual(['learned', 'rest', 'rest', 'learned', 'today', 'plain', 'plain']);
    expect(shownStreak(snapshot({ sessions }), FRI)).toBe(2);
  });

  it('a day later than today (a wrong clock) is never drawn as learned', () => {
    expect(states(set(MON, SUN), WED)).toEqual(['learned', 'rest', 'today', 'plain', 'plain', 'plain', 'plain']);
  });

  it('the dots never depend on the UI locale: the same days give the same dots and one week key', () => {
    const learned = set(MON, WED);
    expect(weekDots(learned, FRI)).toEqual(weekDots(new Set([WED, MON]), FRI));
    expect(weekMondayOf(FRI)).toBe(MON);
  });
});

describe('learnedInWeek', () => {
  it('counts the week\'s learned days up to today', () => {
    expect(learnedInWeek(set(MON, WED, FRI, MON2), MON, THU)).toBe(2);
    expect(learnedInWeek(set(MON, WED, FRI, MON2), MON, SUN)).toBe(3);
  });
});

describe('the dots and the streak number agree (fast-check)', () => {
  it('a run Home shows is bridged by rest dots up to today; an ended run has a plain day after its last learned day', () => {
    const offsets = fc.uniqueArray(fc.integer({ min: 0, max: 27 }), { maxLength: 14 });
    fc.assert(
      fc.property(offsets, fc.integer({ min: 1, max: 30 }), (picked, todayAt) => {
        const day = (n: number) => new Date(Date.UTC(2026, 9, 5) + n * 86_400_000).toISOString().slice(0, 10);
        const today = day(todayAt);
        const learned = new Set(picked.map(day).filter((d) => d < today));
        const last = [...learned].sort().pop();
        if (last === undefined) return;
        const rest = restDaysBefore(learned, today);
        const gap: string[] = [];
        for (let n = 0; n < 40; n += 1) {
          const d = day(n);
          if (d > last && d < today) gap.push(d);
        }
        const shown = shownStreak(snapshot({ sessions: [...learned].map(quest) }), today);
        expect(restDaysBefore(learned, today, shown > 0)).toEqual(shown > 0 ? new Set([...rest, ...gap]) : rest);
        if (shown > 0) expect(gap.every((d) => rest.has(d)), `${[...learned]} ${today}`).toBe(true);
        else expect(gap.some((d) => !rest.has(d)), `${[...learned]} ${today}`).toBe(true);
      }),
      { numRuns: 400 },
    );
  });
});
