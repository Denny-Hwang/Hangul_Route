import { ProgressSnapshotSchema, type ProgressSnapshot, type SessionLog, type StreakLocal } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { streakSessionDates } from '../sessions/session-log';
import { REST_DAYS_PER_WEEK, computeStreak, learnedOn, learningDays, sessionDay, shownStreak, streakFields, streakOf, streakState, withLocalStreak, type CarriedRun } from '../streak';
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

const state = (sessions: SessionLog[], today: string, carried: (CarriedRun | undefined)[] = [], best: (number | undefined)[] = []) =>
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

describe('learnedOn: the day Home\'s tip reads, as the run does', () => {
  it('is any learning activity on the local day: a story-only day counts, a game alone does not', () => {
    expect(learnedOn([learn(WED)], WED)).toBe(true);
    expect(learnedOn([timeOnly(WED)], WED)).toBe(false);
    // a Seoul morning quest: the UTC day before, the local day of the run
    expect(learnedOn([quest(THU, '2026-10-21T23:00:00.000Z')], THU)).toBe(true);
    expect(learnedOn([quest(THU, '2026-10-21T23:00:00.000Z')], WED)).toBe(false);
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
    // Tue and Thu rest
    const sessions = [quest(MON), quest(WED)];
    expect(state(sessions, FRI).shown).toBe(2);
    // Fri is the third: the run has ended. Home waits for the next learning day; it never shows a shorter stretch.
    expect(state(sessions, SAT)).toEqual({ shown: 0, local: { run: 2, lastDay: WED }, best: 2 });
    expect(state(sessions, SUN).shown).toBe(0);
    // learning on Sat starts from the longest stretch that holds then: Wed to Sat (Thu and Fri rest)
    expect(state([...sessions, quest(SAT)], SAT).shown).toBe(2);
  });

  it('never steps down to a smaller number on a day without learning (section 7.7)', () => {
    // 49 days of learning to Mon 19 October, Tue rests, Wed learns, then nothing
    const daily = Array.from({ length: 49 }, (_, i) => quest(new Date(Date.UTC(2026, 8, 1) + i * 86_400_000).toISOString().slice(0, 10)));
    const sessions = [...daily, quest(WED)];
    expect(state(sessions, THU).shown).toBe(50);
    expect(state(sessions, FRI).shown).toBe(50);
    expect(state(sessions, SAT).shown).toBe(0);
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

  it('a carried run goes on past its last day only within its week\'s 2 rest days (OD-6)', () => {
    // Mon and Tue have no known learning day, so the run of 12 may have rested on both: Thu resting too is a third
    expect(state([quest(WED), quest(FRI)], FRI, [{ run: 12, lastDay: WED }]).local).toEqual({ run: 2, lastDay: FRI });
    // with Mon and Tue learned, Thu is the first rest day of the week, and the run goes on
    expect(state([quest(MON), quest(TUE), quest(WED), quest(FRI)], FRI, [{ run: 12, lastDay: WED }]).local).toEqual({ run: 13, lastDay: FRI });
    // the old streakDays counted days in a row, so it used no rest day before its last day
    expect(state([quest(WED), quest(FRI)], FRI, [{ run: 12, lastDay: WED, consecutive: true }]).local).toEqual({ run: 13, lastDay: FRI });
    // a learning day right after it adds no rest day, so the run goes on whatever the week held before
    expect(state([quest(WED), quest(THU)], THU, [{ run: 12, lastDay: WED }]).local).toEqual({ run: 13, lastDay: THU });
  });

  it('the run still open today drops a carried run whose week is over, and shows nothing once the stretch ends', () => {
    const consecutive = { run: 12, lastDay: WED, consecutive: true };
    expect(state([quest(WED)], FRI, [consecutive]).shown).toBe(12);
    expect(state([quest(WED)], SAT, [consecutive]).shown).toBe(12);
    expect(state([quest(WED)], SUN, [consecutive]).shown).toBe(0);
  });

  it('a stored run longer than the sessions behind it ends, never steps down to the sessions\' stretch (section 7.7)', () => {
    // Mon and Tue have no known learning day, so the run of 50 may have rested on both: Thu resting is a third
    const snap = snapshot({ sessions: [quest(WED)], streakLocal: { run: 50, lastDay: WED } });
    expect([WED, THU, FRI, SAT].map((day) => shownStreak(snap, day))).toEqual([50, 50, 0, 0]);
    expect(state(snap.sessions, FRI, [{ run: 50, lastDay: WED }])).toEqual({ shown: 0, local: { run: 50, lastDay: WED }, best: 50 });
  });

  it('a record not yet switched over never steps down to its old streakDays', () => {
    // Quests Mon, Wed, Thu and Fri: the old streak counted 3 days in a row, the local run is 4 with Tue resting
    const snap = snapshot({ streakDays: 3, sessions: [quest(MON), quest(WED), quest(THU), quest(FRI)] });
    // Sat rests (2 in the week), Sun rests (3): the run has ended, and the old 3 is not shown in its place
    expect([FRI, SAT, SUN, MON2].map((day) => shownStreak(snap, day))).toEqual([4, 4, 4, 0]);
  });

  it('a stored run longer than its sessions: the next day is never smaller unless it is 0 (300 seeds)', () => {
    let rng = 7;
    const next = () => ((rng = (rng * 48271) % 2147483647) / 2147483647);
    const dayAt = (n: number) => new Date(Date.UTC(2026, 9, 1) + n * 86_400_000).toISOString().slice(0, 10);
    for (let seed = 1; seed <= 300; seed += 1) {
      const days = Array.from({ length: 21 }, (_, n) => n).filter(() => next() < 0.5).map(dayAt);
      if (days.length === 0) continue;
      const lastDay = days[days.length - 1] as string;
      const snap = snapshot({ sessions: days.map((d) => quest(d)), streakLocal: { run: days.length + 1 + Math.floor(next() * 40), lastDay } });
      for (let n = 20; n < 30; n += 1) {
        const today = shownStreak(snap, dayAt(n));
        const tomorrow = shownStreak(snap, dayAt(n + 1));
        expect(tomorrow === 0 || tomorrow >= today, `seed ${seed} ${dayAt(n + 1)}: ${today} then ${tomorrow}`).toBe(true);
      }
    }
  });

  it('reads no day more than 2 days after today: a clock set forward, then back', () => {
    const sessions = [quest(MON), quest(TUE), quest('2026-11-20')];
    // the session from the wrong clock is not read, and neither is a run carried on a day that far ahead
    expect(state(sessions, TUE, [{ run: 30, lastDay: '2026-11-20' }])).toEqual({ shown: 2, local: { run: 2, lastDay: TUE }, best: 2 });
    // so the run ends on time instead of staying open until that day
    expect(state(sessions, SUN).shown).toBe(0);
    // a device in UTC+14 can be 2 days ahead of one in UTC-12: that day is read
    expect(state([quest(MON), quest(WED)], MON).local).toEqual({ run: 2, lastDay: WED });
  });
});

describe('streakState through the device path (each learning day writes streakLocal, which the next read carries)', () => {
  /** The record a device holds after learning on `days` in order, writing the run on each one, as beginSession does. */
  function device(days: readonly string[]): ProgressSnapshot {
    let snap = snapshot();
    for (const day of days) snap = withLocalStreak({ ...snap, sessions: [...snap.sessions, quest(day)] }, day);
    return snap;
  }
  const dayAt = (n: number): string => new Date(Date.UTC(2026, 9, 19) + n * 86_400_000).toISOString().slice(0, 10);

  it.each([
    ['Tue rests', [MON, WED], WED, 2],
    ['Tue and Wed rest', [MON, THU], THU, 2],
    ['Tue and Thu rest, apart', [MON, WED, FRI], FRI, 3],
    ['a third rest day ends the stretch before it', [MON, FRI], FRI, 1],
    ['Tue, Thu and Sat rest', [MON, WED, FRI, SUN], SUN, 3],
    ['across the Monday line', [FRI, WED2], WED2, 2],
    ['Mon and Wed, then Fri', [MON, WED], FRI, 2],
    ['Mon and Wed, then Sat: the run has ended', [MON, WED], SAT, 0],
  ] as const)('%s: the same as the rule with nothing carried', (_name, days, today, shown) => {
    const snap = device(days);
    expect(shownStreak(snap, today)).toBe(shown);
    expect(shownStreak(snap, today)).toBe(state(snap.sessions, today).shown);
    expect(snap.streakLocal).toEqual(state(snap.sessions, days[days.length - 1] as string).local);
  });

  it('Mon, Thu and Sun every week for 6 weeks: 4 rest days a week end the run each week, so it never grows', () => {
    const days = Array.from({ length: 6 }, (_, w) => [0, 3, 6].map((d) => dayAt(w * 7 + d))).flat();
    const snap = device(days);
    // Thu and Sun hold Fri and Sat; Mon carries them on; Thu adds Tue and Wed, a fourth: the stretch restarts there
    expect(snap.streakLocal).toEqual({ run: 2, lastDay: dayAt(5 * 7 + 6) });
    expect(snap.streakLocal).toEqual(state(snap.sessions, dayAt(5 * 7 + 6)).local);
    for (let n = 1; n <= days.length; n += 1) {
      const part = device(days.slice(0, n));
      expect(part.streakLocal?.run, days[n - 1]).toBeLessThanOrEqual(4);
    }
  });

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

  it('with no new learning day, the number on the next day is never smaller unless it is 0 (200 seeded histories)', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const next = rng(seed);
      const odds = 0.3 + next() * 0.6;
      const days = Array.from({ length: 42 }, (_, n) => n).filter(() => next() < odds).map(dayAt);
      if (days.length === 0) continue;
      const snap = device(days);
      const last = days.length - 1;
      // the device path equals the rule with nothing carried
      expect(snap.streakLocal, `seed ${seed}`).toEqual(state(snap.sessions, days[last] as string).local);
      const from = 42 - 1 - Math.floor(next() * 3);
      for (let n = Math.max(from, 0); n < 42 + 8; n += 1) {
        const today = shownStreak(snap, dayAt(n));
        const tomorrow = shownStreak(snap, dayAt(n + 1));
        if (dayAt(n) < (days[last] as string)) continue;
        expect(tomorrow === 0 || tomorrow >= today, `seed ${seed} day ${dayAt(n + 1)}: ${today} then ${tomorrow}`).toBe(true);
      }
    }
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
    // with a session id from before OD-19 (no `session:` prefix), which every reader counts as a quest session
    'before placements': snapshot({
      streakDays: 3,
      sessions: [
        { id: 'legacy-1', profileId: 'p1', startedAt: '2026-10-18T09:00:00.000Z', episodesTouched: [] },
        quest(undefined, `${MON}T09:00:00.000Z`),
        quest(undefined, `${TUE}T09:00:00.000Z`),
        quest(undefined, `${WED}T09:00:00.000Z`),
      ],
    }),
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
    // the legacy-id Sunday session joins the run: 4 days in a row, above the old 3
    ['before placements', { run: 4, lastDay: WED }, 4, 4],
    ['before questDoneAt', { run: 7, lastDay: WED }, 7, 7],
    ['before vocab', { run: 5, lastDay: '2026-09-01' }, 5, 0],
    ['current', { run: 2, lastDay: WED }, 9, 2],
  ] as const)('%s: streakLocal starts at max(old streakDays, the local run), streakBest at the larger of that and any earlier best', (name, local, best, shown) => {
    // read as the app reads a stored record: through the snapshot schema
    const before = ProgressSnapshotSchema.parse(shapes[name]) as ProgressSnapshot;
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
    expect(streakOf([{ ...after, streakDays: 40 }], after.sessions, WED).local).toEqual({ run: 4, lastDay: WED });
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
  const pickOf = (next: () => number) => <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)] as T;

  /** Sessions of one copy: some of the shared ones and its own, on the days up to `today`. */
  function sessionsOf(next: () => number, shared: SessionLog[], today: string): SessionLog[] {
    const pick = pickOf(next);
    const days = DAYS.filter((d) => d <= today);
    const own: SessionLog[] = Array.from({ length: Math.floor(next() * 10) }, () => {
      const day = pick(days);
      const kind = next();
      const s = kind < 0.4 ? quest(day) : kind < 0.75 ? learn(day) : timeOnly(day);
      return next() < 0.3 ? { ...s, localDay: undefined } : s;
    });
    return [...shared.filter((s) => s.localDay === undefined || s.localDay <= today).filter(() => next() < 0.7), ...own];
  }

  /** A copy with arbitrary stored runs: the merge rules must hold for any input. */
  function anyCopy(next: () => number, shared: SessionLog[], today: string): ProgressSnapshot {
    const pick = pickOf(next);
    return snapshot({
      sessions: sessionsOf(next, shared, today),
      streakDays: Math.floor(next() * 6),
      ...(next() < 0.6 ? { streakLocal: { run: 1 + Math.floor(next() * 20), lastDay: pick(DAYS) } } : {}),
      ...(next() < 0.5 ? { streakBest: Math.floor(next() * 25) } : {}),
    });
  }

  /**
   * A copy as a build writes it: an older build's streakDays from its own sessions (no streakLocal), or a new
   * build's streakLocal written on its last learning day.
   */
  function realCopy(next: () => number, shared: SessionLog[], today: string): ProgressSnapshot {
    const sessions = sessionsOf(next, shared, today);
    const days = learningDays(sessions);
    const lastDay = days[days.length - 1] ?? today;
    const older = snapshot({ sessions, streakDays: computeStreak(streakSessionDates(sessions), new Date(`${lastDay}T12:00:00.000Z`)) });
    return next() < 0.5 ? older : withLocalStreak(older, lastDay);
  }

  const fields = (s: ProgressSnapshot, today: string) => ({ streakLocal: s.streakLocal, streakBest: s.streakBest, shown: shownStreak(s, today) });

  /**
   * Whether a copy's stored run has a learning session behind it, as every build writes it: streakLocal is written
   * on a learning day the copy holds, and the session log is never trimmed. A run without one (only made up here)
   * counts its day as a learning day while it is read, which the merged record, holding one run, cannot keep.
   */
  const grounded = (s: ProgressSnapshot) => s.streakLocal === undefined || learningDays(s.sessions).includes(s.streakLocal.lastDay);

  it('gives the same streakLocal and streakBest in either order, and merging the result again changes nothing (1000 seeds)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 1000; seed += 1) {
      const next = rng(seed);
      const shared = Array.from({ length: 6 }, () => quest(DAYS[Math.floor(next() * DAYS.length)] as string));
      const today = DAYS[20 + Math.floor(next() * 8)] as string;
      const a = anyCopy(next, shared, today);
      const b = anyCopy(next, shared, today);
      const opts = { now: new Date(`${today}T12:00:00.000Z`), today };
      const ab = mergeSnapshots(a, b, opts);
      const ba = mergeSnapshots(b, a, opts);
      // for any input
      expect(fields(ab, today), `seed ${seed}`).toEqual(fields(ba, today));
      expect(fields(mergeSnapshots(ab, ab, opts), today), `seed ${seed}`).toEqual(fields(ab, today));
      // merging one side in again changes nothing, for the copies the builds write
      if (!grounded(a) || !grounded(b)) continue;
      checked += 1;
      expect(fields(mergeSnapshots(ab, b, opts), today), `seed ${seed}`).toEqual(fields(ab, today));
      expect(fields(mergeSnapshots(ab, a, opts), today), `seed ${seed}`).toEqual(fields(ab, today));
    }
    expect(checked).toBeGreaterThan(250);
  });

  /**
   * A device's copy, learning on `days` in order: a new build writes streakLocal on each learning day (as
   * beginSession does); an older build writes only streakDays, and its sessions carry no localDay.
   */
  function deviceCopy(next: () => number, days: readonly string[], older: boolean): ProgressSnapshot {
    let snap = snapshot();
    for (const day of days) {
      const kind = next();
      const made = kind < 0.5 ? quest(day) : kind < 0.85 ? learn(day) : timeOnly(day);
      const session = older ? { ...made, localDay: undefined } : made;
      const sessions = [...snap.sessions, session];
      snap = { ...snap, sessions, streakDays: computeStreak(streakSessionDates(sessions), new Date(`${day}T12:00:00.000Z`)) };
      if (!older) snap = withLocalStreak(snap, day);
    }
    return snap;
  }

  /** Two devices of one learner: days both hold (synced earlier), and days each learned on its own since. */
  function twoDevices(seed: number) {
    const next = rng(seed);
    const span = 21 + Math.floor(next() * 21);
    const sharedEnd = Math.floor(next() * span);
    const odds = 0.3 + next() * 0.6;
    const dayOf = (n: number) => new Date(Date.UTC(2026, 9, 1) + n * 86_400_000).toISOString().slice(0, 10);
    const shared = Array.from({ length: sharedEnd }, (_, n) => n).filter(() => next() < odds).map(dayOf);
    const from = Math.max(0, sharedEnd - 7);
    const own = () => Array.from({ length: span - from }, (_, n) => n + from).filter(() => next() < odds * 0.6).map(dayOf);
    const aOlder = next() < 0.3;
    const bOlder = next() < 0.4;
    const a = deviceCopy(next, [...new Set([...shared, ...own()])].sort(), aOlder);
    const b = deviceCopy(next, [...new Set([...shared, ...own()])].sort(), bOlder);
    const todays = Array.from({ length: 9 }, (_, i) => dayOf(span - 3 + i)).filter((t) => [a, b].every((x) => learningDays(x.sessions).every((d) => d <= t)));
    return { copies: [{ snap: a, older: aOlder }, { snap: b, older: bOlder }] as const, todays, dayOf };
  }

  it('a sync with an older build never lowers the number a new build showed, and the merged record never steps down (300 seeds of two devices)', () => {
    let olderPairs = 0;
    for (let seed = 1; seed <= 300; seed += 1) {
      const { copies, todays } = twoDevices(seed);
      const [a, b] = copies;
      for (const today of todays) {
        const merged = mergeSnapshots(a.snap, b.snap, { now: new Date(`${today}T12:00:00.000Z`), today });
        const shown = shownStreak(merged, today);
        for (const [mine, theirs] of [[a, b], [b, a]] as const) {
          if (!theirs.older) continue;
          olderPairs += 1;
          // strictly: no exception for an older build
          expect(shown, `seed ${seed} ${today}`).toBeGreaterThanOrEqual(shownStreak(mine.snap, today));
        }
        // the record the merge writes reads as the merge did, and never steps down on a day without learning
        expect(shownStreak(withLocalStreak(merged, today), today), `seed ${seed} ${today}`).toBe(shown);
        const tomorrow = shownStreak(merged, new Date(Date.parse(`${today}T12:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10));
        expect(tomorrow === 0 || tomorrow >= shown, `seed ${seed} ${today}: ${shown} then ${tomorrow}`).toBe(true);
      }
    }
    expect(olderPairs).toBeGreaterThan(500);
  });

  it('between two new builds the number drops only where another copy already ended that run (section 7.4), never to a smaller run (300 seeds)', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const { copies, todays } = twoDevices(seed);
      const [a, b] = copies;
      if (a.older || b.older) continue;
      for (const today of todays) {
        const merged = mergeSnapshots(a.snap, b.snap, { now: new Date(`${today}T12:00:00.000Z`), today });
        expect(merged, `seed ${seed}`).toEqual(mergeSnapshots(b.snap, a.snap, { now: new Date(`${today}T12:00:00.000Z`), today }));
        const shown = shownStreak(merged, today);
        for (const [mine, theirs] of [[a, b], [b, a]] as const) {
          if (shown >= shownStreak(mine.snap, today)) continue;
          // The other copy holds a run on the same last day that it already shows as ended: it knew a learning day
          // earlier in that week, so a third rest day falls in it. The merged record holds that run (the stored
          // run never goes down in a merge, here or in the Worker), so it shows the run has ended, as that copy does.
          expect(shown, `seed ${seed} ${today}`).toBe(0);
          expect(shownStreak(theirs.snap, today), `seed ${seed} ${today}`).toBe(0);
          expect(theirs.snap.streakLocal?.lastDay, `seed ${seed} ${today}`).toBe(merged.streakLocal?.lastDay);
        }
      }
    }
  });

  it('another copy\'s earlier day in the same week never ends the run this device shows (the reviewed case)', () => {
    // This device learned on Wed only; Thu and Fri rest: a run of 1 on Sat. The other device learned on Mon, so the
    // merged days hold Tue, Thu and Fri as rests, a third in one week, yet this device's own run (Wed, then Thu and
    // Fri) still goes on: the merge keeps it, and so does the record it writes. Learning on Sat makes it 2.
    const mine = withLocalStreak(snapshot({ sessions: [quest(WED)] }), WED);
    for (const theirs of [withLocalStreak(snapshot({ sessions: [quest(MON)] }), MON), snapshot({ sessions: [quest(undefined, `${MON}T09:00:00.000Z`)], streakDays: 1 })]) {
      expect(shownStreak(mine, SAT)).toBe(1);
      const merged = mergeSnapshots(mine, theirs, { now: new Date(`${SAT}T12:00:00.000Z`), today: SAT });
      expect(shownStreak(merged, SAT)).toBe(1);
      expect(merged.streakLocal).toEqual({ run: 1, lastDay: WED });
      expect(merged.streakBest).toBe(2);
      expect(withLocalStreak(merged, SAT)).toBe(merged);
      expect(shownStreak(merged, SUN)).toBe(0);
      expect(shownStreak({ ...merged, sessions: [...merged.sessions, quest(SAT)] }, SAT)).toBe(2);
    }
  });

  it('the one case where a sync ends a run: another new build already ended that same run (section 7.4)', () => {
    // The other device learned on Mon and Wed, showed 2 on Thu and nothing from Fri: Tue, Thu and Fri are three rests
    // in one week. It holds {2, Wed}. This device knew only Wed and shows 1 on Sat. The stored run never goes down in a
    // merge (later day, then the higher run: the Worker's rule too), so the merged record holds {2, Wed}, which has
    // ended, and shows nothing. It never shows a smaller run, and the next learning day counts from Wed again.
    const mine = withLocalStreak(snapshot({ sessions: [quest(WED)] }), WED);
    const monday = withLocalStreak(snapshot({ sessions: [quest(MON)] }), MON);
    const theirs = withLocalStreak({ ...monday, sessions: [...monday.sessions, quest(WED)] }, WED);
    expect(theirs.streakLocal).toEqual({ run: 2, lastDay: WED });
    expect(shownStreak(theirs, THU)).toBe(2);
    expect(shownStreak(theirs, SAT)).toBe(0);
    expect(shownStreak(mine, SAT)).toBe(1);
    const merged = mergeSnapshots(mine, theirs, { now: new Date(`${SAT}T12:00:00.000Z`), today: SAT });
    expect(merged.streakLocal).toEqual({ run: 2, lastDay: WED });
    expect(shownStreak(merged, SAT)).toBe(0);
    expect(mergeSnapshots(merged, mine, { now: new Date(`${SAT}T12:00:00.000Z`), today: SAT }).streakLocal).toEqual({ run: 2, lastDay: WED });
    expect(shownStreak({ ...merged, sessions: [...merged.sessions, quest(SAT)] }, SAT)).toBe(2);
  });
});
