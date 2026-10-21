import type { ProgressSnapshot, SessionLog, StreakLocal } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { REST_DAYS_PER_WEEK, learningDays, sessionDay, shownStreak, streakFields, streakOf, streakState, withLocalStreak } from '../streak';
import { mergeSnapshots } from '../sync/merge';

/**
 * F-CURR-002 sections 4.8 and 7.4 (row CM-4; OD-14, OD-6): the streak on the
 * learner's local day, kept by any learning activity, with 2 rest days a
 * local week, `streakLocal` and `streakBest`, the no-drop switch-over, and a
 * sync that never lowers the number Home shows. The suite runs under TZ=UTC;
 * the time-zone cases name their zone and their fixed clock.
 */

// 2026-10-19 is a Monday.
const MON = '2026-10-19';
const TUE = '2026-10-20';
const WED = '2026-10-21';
const THU = '2026-10-22';
const FRI = '2026-10-23';
const SAT = '2026-10-24';
const SUN = '2026-10-25';
const MON2 = '2026-10-26';
const TUE2 = '2026-10-27';
const WED2 = '2026-10-28';

let seq = 0;
function quest(localDay: string | undefined, startedAt = `${localDay ?? '2026-10-01'}T09:00:00.000Z`): SessionLog {
  seq += 1;
  return { id: `session:${startedAt}:${seq}`, profileId: 'p1', startedAt, episodesTouched: [], ...(localDay ? { localDay } : {}) };
}
function learn(localDay: string, startedAt = `${localDay}T09:00:00.000Z`): SessionLog {
  seq += 1;
  return { id: `session:time:learn:${startedAt}:${seq}`, profileId: 'p1', startedAt, episodesTouched: [], localDay };
}
function timeOnly(localDay: string, startedAt = `${localDay}T09:00:00.000Z`): SessionLog {
  seq += 1;
  return { id: `session:time:${startedAt}:${seq}`, profileId: 'p1', startedAt, episodesTouched: [], localDay };
}

const state = (sessions: SessionLog[], today: string, carried: (StreakLocal | undefined)[] = [], best: (number | undefined)[] = []) =>
  streakState({ sessions, carried, best }, today);

/** The local day of an instant in an IANA zone, the way a device there names it. */
function zoned(timeZone: string): (iso: string) => string {
  const format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return (iso) => {
    const parts = Object.fromEntries(format.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
}

function snapshot(over: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return { profileId: 'p1', updatedAt: '2026-10-21T00:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, ...over };
}

describe('sessionDay and learningDays', () => {
  it('counts a session on its localDay, else on the UTC day it started', () => {
    expect(sessionDay({ startedAt: '2026-10-21T23:30:00.000Z', localDay: THU })).toBe(THU);
    expect(sessionDay({ startedAt: '2026-10-21T23:30:00.000Z' })).toBe(WED);
    // an unreadable localDay falls back too, and an unreadable start has no day
    expect(sessionDay({ startedAt: '2026-10-21T23:30:00.000Z', localDay: '2026-02-30' })).toBe(WED);
    expect(sessionDay({ startedAt: 'garbage' })).toBeUndefined();
    // a record read back unvalidated may hold anything
    expect(sessionDay({ startedAt: 42 as unknown as string })).toBeUndefined();
  });

  it('lists the days of quest and learning sessions, ascending, once each, never a game or a level check', () => {
    const days = learningDays([quest(WED), learn(MON), quest(MON), timeOnly(TUE), learn(THU), quest(undefined, 'nope')]);
    expect(days).toEqual([MON, WED, THU]);
  });
});

describe('streakState: the run on local days (OD-14)', () => {
  it('is empty before any learning day, and keeps an earlier best', () => {
    expect(state([], WED)).toEqual({ shown: 0, local: undefined, best: undefined });
    expect(state([timeOnly(WED)], WED)).toEqual({ shown: 0, local: undefined, best: undefined });
    expect(state([], WED, [], [7])).toEqual({ shown: 0, local: undefined, best: 7 });
  });

  it('counts learning days in a row, and today without learning yet keeps the run', () => {
    const sessions = [quest(MON), learn(TUE), quest(WED)];
    expect(state(sessions, WED)).toEqual({ shown: 3, local: { run: 3, lastDay: WED }, best: 3 });
    expect(state(sessions, THU).shown).toBe(3);
  });

  it('any learning activity keeps it: a quest, a story or a word set; a game or a level check does not', () => {
    const sessions = [quest(MON), learn(TUE), learn(WED), timeOnly(THU)];
    expect(state(sessions, THU).local).toEqual({ run: 3, lastDay: WED });
  });
});

describe('streakState: rest days (OD-6)', () => {
  it('grants up to 2 a local week: they keep the run and add nothing', () => {
    expect(REST_DAYS_PER_WEEK).toBe(2);
    // Tue rests
    expect(state([quest(MON), quest(WED)], WED).shown).toBe(2);
    // Tue and Wed rest
    expect(state([quest(MON), quest(THU)], THU).shown).toBe(2);
    // Tue and Thu rest, apart
    expect(state([quest(MON), quest(WED), quest(FRI)], FRI).shown).toBe(3);
  });

  it('a third rest day in one week ends the stretch before it', () => {
    // Tue, Wed and Thu rest: the run starts again on Fri
    const sessions = [quest(MON), quest(FRI)];
    expect(state(sessions, FRI)).toEqual({ shown: 1, local: { run: 1, lastDay: FRI }, best: 1 });
    // Tue, Thu and Sat rest: the longest stretch that holds is Wed to Sun
    const spread = [quest(MON), quest(WED), quest(FRI), quest(SUN)];
    expect(state(spread, SUN).local).toEqual({ run: 3, lastDay: SUN });
  });

  it('counts each week on its own across the Monday line', () => {
    // Sat and Sun rest in the first week, Mon and Tue in the next: 4 days, 2 a week
    expect(state([quest(FRI), quest(WED2)], WED2).shown).toBe(2);
    // a fifth day in a row can never rest
    expect(state([quest(THU), quest(WED2)], WED2).shown).toBe(1);
  });

  it('the days since the last learning day rest too, until a week is over, and then the run has ended', () => {
    const sessions = [quest(SUN), quest(MON2)];
    // Tue2 rests
    expect(state(sessions, WED2).shown).toBe(2);
    // Tue2 and Wed2 rest
    expect(state(sessions, '2026-10-29').shown).toBe(2);
    // a third: the run has ended, and the record keeps it and its best
    expect(state(sessions, '2026-10-30')).toEqual({ shown: 0, local: { run: 2, lastDay: MON2 }, best: 2 });
  });

  it('rest days before the last learning day count against the same week', () => {
    // Tue rested; Thu and Fri would be the second and third
    const sessions = [quest(MON), quest(WED)];
    expect(state(sessions, FRI).shown).toBe(2);
    // the stretch gives up Mon to keep Wed open: still a run, of 1
    expect(state(sessions, SAT).shown).toBe(1);
    expect(state(sessions, SUN).shown).toBe(0);
  });

  it('never ends a run on an unreadable today, and a day another device already reached still counts', () => {
    expect(state([quest(MON), quest(TUE)], 'not-a-day').shown).toBe(2);
    // a device in UTC+14 is a day ahead: its day counts, and today is never a rest day
    expect(state([quest(MON), quest(WED)], TUE).shown).toBe(2);
  });

  it('keeps the best run ever, also once a later run is shorter', () => {
    const sessions = [quest(MON), quest(TUE), quest(WED), quest(MON2)];
    expect(state(sessions, MON2)).toEqual({ shown: 1, local: { run: 1, lastDay: MON2 }, best: 3 });
  });
});

describe('streakState: carried runs', () => {
  it('a carried run is a floor for the stretch that holds its last day, plus the learning days after it', () => {
    const sessions = [quest(TUE), quest(WED), quest(THU)];
    expect(state(sessions, THU, [{ run: 12, lastDay: WED }])).toEqual({ shown: 13, local: { run: 13, lastDay: THU }, best: 13 });
  });

  it('a carried run of a stretch that ended lifts only the best', () => {
    const sessions = [quest(TUE), quest(WED)];
    expect(state(sessions, WED, [{ run: 12, lastDay: '2026-10-01' }])).toEqual({ shown: 2, local: { run: 2, lastDay: WED }, best: 12 });
  });

  it('ignores a carried run that is empty or unreadable, and a best that is not a whole number', () => {
    const bad = [{ run: 0, lastDay: WED }, { run: 3, lastDay: '2026-13-01' }, { run: 1.5, lastDay: WED }] as StreakLocal[];
    expect(state([quest(WED)], WED, bad, [-1, 2.5, undefined])).toEqual({ shown: 1, local: { run: 1, lastDay: WED }, best: 1 });
  });

  it('the carried day is a learning day even with no session behind it', () => {
    expect(state([], THU, [{ run: 5, lastDay: WED }])).toEqual({ shown: 5, local: { run: 5, lastDay: WED }, best: 5 });
  });
});

describe('fixed clocks in four time zones (the suite runs under TZ=UTC)', () => {
  /** A learner in `zone` who learns at each instant; Home reads on `now`. */
  function run(zone: string, instants: string[], now: string) {
    const day = zoned(zone);
    const sessions = instants.map((at) => quest(day(at), at));
    return { days: sessions.map((s) => s.localDay), ...state(sessions, day(now)) };
  }

  it('UTC+14 (Pacific/Kiritimati): two sessions on one UTC day are two local days', () => {
    const r = run('Pacific/Kiritimati', ['2026-10-20T09:00:00.000Z', '2026-10-20T11:00:00.000Z'], '2026-10-20T12:00:00.000Z');
    expect(r.days).toEqual(['2026-10-20', '2026-10-21']);
    expect(r.shown).toBe(2);
  });

  it('UTC-12 (Etc/GMT+12): late evening and just after midnight are two local days', () => {
    const r = run('Etc/GMT+12', ['2026-10-21T11:00:00.000Z', '2026-10-21T13:00:00.000Z'], '2026-10-21T14:00:00.000Z');
    expect(r.days).toEqual(['2026-10-20', '2026-10-21']);
    expect(r.shown).toBe(2);
  });

  it('Asia/Seoul: a learner every morning at 08:00 keeps one run, though each session is on the UTC day before', () => {
    const r = run('Asia/Seoul', ['2026-10-19T23:00:00.000Z', '2026-10-20T23:00:00.000Z', '2026-10-21T23:00:00.000Z'], '2026-10-22T01:00:00.000Z');
    expect(r.days).toEqual(['2026-10-20', '2026-10-21', '2026-10-22']);
    expect(r.shown).toBe(3);
  });

  it('America/Los_Angeles across the end of daylight time (1 November 2026, a 25-hour day)', () => {
    // 23:30 PDT on 31 October, 00:30 PDT and 23:30 PST on 1 November, 23:30 PST on 2 November
    const r = run(
      'America/Los_Angeles',
      ['2026-11-01T06:30:00.000Z', '2026-11-01T07:30:00.000Z', '2026-11-02T07:30:00.000Z', '2026-11-03T07:30:00.000Z'],
      '2026-11-03T08:00:00.000Z',
    );
    expect(r.days).toEqual(['2026-10-31', '2026-11-01', '2026-11-01', '2026-11-02']);
    expect(r.shown).toBe(3);
  });

  it('America/Los_Angeles across the start of daylight time (8 March 2026, a 23-hour day)', () => {
    // 23:30 PST on 7 March, 23:30 PDT on 8 March, rest on 9 March, 08:00 PDT on 10 March
    const r = run('America/Los_Angeles', ['2026-03-08T07:30:00.000Z', '2026-03-09T06:30:00.000Z', '2026-03-10T15:00:00.000Z'], '2026-03-10T16:00:00.000Z');
    expect(r.days).toEqual(['2026-03-07', '2026-03-08', '2026-03-10']);
    expect(r.shown).toBe(3);
  });
});

describe('the switch-over from five historical snapshot shapes (section 4.8 step 8)', () => {
  const placements: ProgressSnapshot['placements'] = [];
  const shapes: Record<string, ProgressSnapshot> = {
    empty: snapshot(),
    'before placements': snapshot({ streakDays: 3, sessions: [quest(undefined, `${MON}T09:00:00.000Z`), quest(undefined, `${TUE}T09:00:00.000Z`), quest(undefined, `${WED}T09:00:00.000Z`)] }),
    'before questDoneAt': snapshot({ placements, streakDays: 7, sessions: [quest(undefined, `${TUE}T09:00:00.000Z`), quest(undefined, `${WED}T09:00:00.000Z`)] }),
    'before vocab': snapshot({ placements, questDoneAt: {}, streakDays: 5, sessions: [quest(undefined, '2026-09-01T09:00:00.000Z')] }),
    current: snapshot({
      placements,
      questDoneAt: {},
      stageDoneAt: {},
      vocab: { v: 1, items: [], topics: [] },
      streakDays: 1,
      streakBest: 9,
      // Mon quest, Tue story (time only before this build), Wed quest: the old UTC rule broke at Tue
      sessions: [quest(undefined, `${MON}T09:00:00.000Z`), { ...timeOnly(TUE), localDay: undefined }, quest(undefined, `${WED}T09:00:00.000Z`)],
    }),
  };

  it('an empty record gains nothing', () => {
    const empty = shapes.empty as ProgressSnapshot;
    expect(withLocalStreak(empty, WED)).toBe(empty);
  });

  it.each([
    ['before placements', { run: 3, lastDay: WED }, 3, 3],
    ['before questDoneAt', { run: 7, lastDay: WED }, 7, 7],
    ['before vocab', { run: 5, lastDay: '2026-09-01' }, 5, 0],
    ['current', { run: 2, lastDay: WED }, 9, 2],
  ] as const)('%s: streakLocal starts at max(old streakDays, the local run), streakBest at the larger of that and any earlier best', (name, local, best, shown) => {
    const before = shapes[name] as ProgressSnapshot;
    const after = withLocalStreak(before, WED);
    expect(after.streakLocal).toEqual(local);
    expect(after.streakBest).toBe(best);
    // the old number is still written for older builds, and Home shows the switched number
    expect(after.streakDays).toBe(before.streakDays);
    expect(shownStreak(before, WED)).toBe(shown);
    expect(shownStreak(after, WED)).toBe(shown);
    // once switched, it runs once: the same record again changes nothing
    expect(withLocalStreak(after, WED)).toBe(after);
  });

  it('an unreadable old streakDays carries nothing', () => {
    const odd = snapshot({ streakDays: Number.NaN, sessions: [quest(WED)] });
    expect(withLocalStreak(odd, WED).streakLocal).toEqual({ run: 1, lastDay: WED });
  });

  it('once switched, the old streakDays is no longer carried', () => {
    const after = withLocalStreak(shapes['before placements'] as ProgressSnapshot, WED);
    expect(streakOf([{ ...after, streakDays: 40 }], after.sessions, WED).local).toEqual({ run: 3, lastDay: WED });
  });

  it('a backup restore of an older file switches over in the merge, never below either copy', () => {
    const device = withLocalStreak(snapshot({ streakDays: 2, sessions: [quest(TUE), quest(WED)] }), WED);
    const file = shapes['before questDoneAt'] as ProgressSnapshot;
    const merged = mergeSnapshots(device, file, { now: new Date(`${WED}T12:00:00.000Z`), today: WED });
    expect(merged.streakLocal?.run).toBeGreaterThanOrEqual(device.streakLocal?.run ?? 0);
    expect(shownStreak(merged, WED)).toBeGreaterThanOrEqual(shownStreak(device, WED));
  });

  it('keeps the field shape the schema reads', () => {
    expect(streakFields({ shown: 0, local: undefined, best: undefined })).toEqual({});
    expect(streakFields({ shown: 1, local: { run: 1, lastDay: WED }, best: 1 })).toEqual({ streakLocal: { run: 1, lastDay: WED }, streakBest: 1 });
  });
});

describe('sync: an older build never lowers the number Home shows', () => {
  const now = new Date('2026-10-22T03:00:00.000Z');
  const seoul = zoned('Asia/Seoul');
  const today = seoul(now.toISOString());

  /** A Seoul learner's new-build copy: sessions at 08:00 local (the UTC day before), switched over at 12. */
  function newBuild(): ProgressSnapshot {
    const sessions = ['2026-10-19T23:00:00.000Z', '2026-10-20T23:00:00.000Z', '2026-10-21T23:00:00.000Z'].map((at) => quest(seoul(at), at));
    return snapshot({ profileId: 'p1', sessions, streakDays: 1, streakLocal: { run: 12, lastDay: today }, streakBest: 12 });
  }

  /** What an older build uploads: the same sessions without localDay, no new keys, its own streakDays and one more session. */
  function olderBuild(from: ProgressSnapshot, preserved: boolean): ProgressSnapshot {
    const { streakLocal, streakBest, ...rest } = from;
    const sessions = [...from.sessions.map(({ localDay: _dropped, ...s }) => s), quest(undefined, '2026-10-22T02:00:00.000Z')];
    // The Worker keeps the stored keys an older build leaves out (CM-3b); `preserved: false` is the worst case.
    return { ...rest, sessions, streakDays: 1, ...(preserved ? { streakLocal, streakBest } : {}) };
  }

  it.each([true, false])('with the Worker preserve rule %s, in either merge order', (preserved) => {
    const mine = newBuild();
    const theirs = olderBuild(mine, preserved);
    const before = shownStreak(mine, today);
    expect(before).toBe(12);
    for (const merged of [mergeSnapshots(mine, theirs, { now, today }), mergeSnapshots(theirs, mine, { now, today })]) {
      expect(shownStreak(merged, today)).toBeGreaterThanOrEqual(before);
      expect(merged.streakBest).toBeGreaterThanOrEqual(12);
      // the localDay the older build dropped comes back from this copy
      expect(merged.sessions.filter((s) => s.localDay !== undefined)).toHaveLength(3);
      // and the old number is still written
      expect(merged.streakDays).toBeTypeOf('number');
    }
  });

  it('two new builds with different runs: the stored run never goes below either', () => {
    const a = snapshot({ sessions: [quest(TUE), quest(WED)], streakLocal: { run: 31, lastDay: WED }, streakBest: 31 });
    const b = snapshot({ sessions: [quest(THU)], streakLocal: { run: 2, lastDay: THU }, streakBest: 4 });
    const merged = mergeSnapshots(a, b, { now: new Date(`${THU}T12:00:00.000Z`), today: THU });
    expect(merged.streakLocal).toEqual({ run: 32, lastDay: THU });
    expect(merged.streakBest).toBe(32);
    expect(shownStreak(merged, THU)).toBe(32);
  });

  it('days the other device adds never lower the number, even when they change where the stretch starts', () => {
    // This device: Wed, Fri, Sun (Thu and Sat rest). The other device adds Mon: Tue, Thu and Sat would be three rests.
    const mine = withLocalStreak(snapshot({ sessions: [quest(WED), quest(FRI), quest(SUN)] }), SUN);
    const theirs = snapshot({ sessions: [quest(MON)] });
    expect(shownStreak(mine, SUN)).toBe(3);
    const merged = mergeSnapshots(mine, theirs, { now: new Date(`${SUN}T12:00:00.000Z`), today: SUN });
    expect(shownStreak(merged, SUN)).toBeGreaterThanOrEqual(3);
  });

  it('the merge defaults today to the device day of its clock', () => {
    const a = snapshot({ sessions: [quest(TUE), quest(WED)] });
    const merged = mergeSnapshots(a, snapshot(), { now: new Date(`${WED}T12:00:00.000Z`) });
    expect(merged.streakLocal).toEqual({ run: 2, lastDay: WED });
  });
});

describe('sync: the streak merge is commutative and idempotent', () => {
  /** mulberry32: a seeded generator, so a failure names its case. */
  function rng(seed: number): () => number {
    let t = seed >>> 0;
    return () => {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  const DAYS = Array.from({ length: 28 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);

  function copy(next: () => number, shared: SessionLog[]): ProgressSnapshot {
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)] as T;
    const own: SessionLog[] = Array.from({ length: Math.floor(next() * 10) }, () => {
      const day = pick(DAYS);
      const kind = next();
      const s = kind < 0.4 ? quest(day) : kind < 0.75 ? learn(day) : timeOnly(day);
      return next() < 0.3 ? { ...s, localDay: undefined } : s;
    });
    const sessions = [...shared.filter(() => next() < 0.7), ...own];
    return snapshot({
      sessions,
      streakDays: Math.floor(next() * 6),
      ...(next() < 0.6 ? { streakLocal: { run: 1 + Math.floor(next() * 20), lastDay: pick(DAYS) } } : {}),
      ...(next() < 0.5 ? { streakBest: Math.floor(next() * 25) } : {}),
    });
  }

  it('gives the same streakLocal and streakBest in either order, and merging the result again changes nothing', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const next = rng(seed);
      const shared = Array.from({ length: 6 }, () => quest(DAYS[Math.floor(next() * DAYS.length)] as string));
      const a = copy(next, shared);
      const b = copy(next, shared);
      const today = DAYS[20 + Math.floor(next() * 8)] as string;
      const opts = { now: new Date(`${today}T12:00:00.000Z`), today };
      const ab = mergeSnapshots(a, b, opts);
      const ba = mergeSnapshots(b, a, opts);
      const fields = (s: ProgressSnapshot) => ({ streakLocal: s.streakLocal, streakBest: s.streakBest, shown: shownStreak(s, today) });
      expect(fields(ab), `seed ${seed}`).toEqual(fields(ba));
      const again = mergeSnapshots(ab, ab, opts);
      expect(fields(again), `seed ${seed}`).toEqual(fields(ab));
      // and a merge never shows less than either copy did
      expect(shownStreak(ab, today), `seed ${seed}`).toBeGreaterThanOrEqual(Math.max(shownStreak(a, today), shownStreak(b, today)));
    }
  });
});
