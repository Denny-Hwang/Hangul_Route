import { CURR_TELEMETRY_PAYLOADS, mergeGoals, type InboxPlan, type ProgressSnapshot } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  readJsonStrict: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, JSON.parse(JSON.stringify(v)));
  }),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
}));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('expo-crypto', () => ({ randomUUID: vi.fn(() => 'abcdef01-2345-6789-abcd-ef0123456789') }));
vi.mock('../../platform/app-visibility', () => ({ subscribeAppVisibility: vi.fn(() => () => undefined), isAppVisible: () => true }));
vi.mock('../../platform/sync-api', () => ({ apiBaseUrl: () => null }));
// The chunk's screens need the render lane; here the entry loads the chunk's logic only.
vi.mock('../../screens/goals/goals-chunk', async () => ({ ...(await import('../goals')), GOALS_CHUNK: 'goals-chunk:goals' }));

import { emitGoalEvent } from '../../logic/goals/goal-events';
import { noteServerTime, resetGoalClockForTests } from '../../platform/goal-clock';
import { track } from '../../platform/telemetry';
import { loadGoalsChunk, recordActivityPointsLater, takeGoalMomentLater } from '../goals-entry';
import { DEFAULTS_SET_AT, MOMENT_FRESH_MS, checkSteadyWeeks, planDaysFor, recordActivityPoints, resetGoalsForTests, saveGoals, takeGoalMoment } from '../goals';
import { PLANS_KEY, usePlanStore } from '../plan-store';
import { useProgressStore } from '../progress-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../remote-config-store';

/*
 * The goals store (F-CURR-002 section 7.4, row CM-17): one points API, the steady-weeks latch after each
 * activity, merge and goal save, the telemetry of section 11.3 parsed before it is sent, the `goals` switch, and
 * the wrong-clock cap of section 13. The suite runs under TZ=UTC.
 */

const P = 'profile:suni';
const KEY = 'ik-abcdef0123456789';

function blank(over: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return { profileId: P, updatedAt: '2026-10-19T00:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, questDoneAt: {}, ...over };
}
function goalsOn(on: boolean): void {
  useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { goals: { on, pct: on ? 100 : 0 } } } });
}
function seed(snap: ProgressSnapshot): void {
  useProgressStore.setState({ byProfile: { [P]: snap }, hydratedFor: new Set([P]), pendingFor: new Set(), pendingVocabEvents: {}, openSession: null });
}
const snap = (): ProgressSnapshot => useProgressStore.getState().byProfile[P] as ProgressSnapshot;
const sent = (name: string) => vi.mocked(track).mock.calls.map(([e]) => e).filter((e) => e.name === name);
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}
const at = (iso: string) => new Date(iso);
/** A self-route (F-PLAN-002) of `days` a week whose week starts on Monday 2026-10-19. */
function selfRoute(days: number): NonNullable<ProgressSnapshot['selfRoute']> {
  return {
    id: 'route:mine',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    archivedAt: null,
    meta: { weeks: [{ index: 1, startDate: '2026-10-19' }], params: { sessionsPerWeek: days } },
    items: [],
  } as unknown as NonNullable<ProgressSnapshot['selfRoute']>;
}

beforeEach(async () => {
  mem.clear();
  vi.mocked(track).mockClear();
  resetRemoteConfigForTests();
  resetGoalClockForTests();
  resetGoalsForTests();
  // The learner's cached plans are read (none): the goals wait for them otherwise.
  usePlanStore.setState({ byLearner: { [P]: [] } });
  goalsOn(true);
  seed(blank());
  // The goals module reads its clock and install key once at import.
  await settle();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('recordActivityPoints', () => {
  it('with goals off writes nothing and sends nothing; stored goals and dayLog stay', () => {
    goalsOn(false);
    const stored = blank({ goals: { daily: 6, weeklyDays: 5, setAt: '2026-10-01T00:00:00.000Z' }, dayLog: { '2026-10-20': { [KEY]: 3 } } });
    seed(stored);
    expect(recordActivityPoints(P, 'quest', at('2026-10-21T09:00:00.000Z'))).toBeNull();
    saveGoals(P, { daily: 10, weeklyDays: 7 });
    checkSteadyWeeks(P);
    expect(snap()).toBe(stored);
    expect(track).not.toHaveBeenCalled();
  });

  it('records the table\'s points on the local day under this install key; Light is met by one quest, once a day', () => {
    const first = recordActivityPoints(P, 'quest', at('2026-10-21T09:00:00.000Z'));
    expect(snap().dayLog).toEqual({ '2026-10-21': { [KEY]: 3 } });
    expect(first).toEqual({ dayMet: true, weekMet: null });
    expect(sent('goal.met').map((e) => e.payload)).toEqual([{ points: 3, target: 3 }]);
    const second = recordActivityPoints(P, 'story', at('2026-10-21T10:00:00.000Z'));
    expect(second).toEqual({ dayMet: false, weekMet: null });
    expect(snap().dayLog).toEqual({ '2026-10-21': { [KEY]: 5 } });
    expect(sent('goal.met')).toHaveLength(1);
    // Every payload parses, and none carries the install key.
    for (const call of vi.mocked(track).mock.calls) {
      const event = call[0];
      expect(CURR_TELEMETRY_PAYLOADS[event.name as 'goal.met'].safeParse(event.payload).success).toBe(true);
      expect(JSON.stringify(event)).not.toContain(KEY);
    }
  });

  it('adds to points another device synced, and the sum reaches the goal', () => {
    seed(blank({ goals: { daily: 6, weeklyDays: 3, setAt: '2026-10-01T00:00:00.000Z' }, dayLog: { '2026-10-21': { 'ik-tablet0000000000': 4 } } }));
    expect(recordActivityPoints(P, 'wordSet', at('2026-10-21T09:00:00.000Z'))?.dayMet).toBe(false);
    expect(recordActivityPoints(P, 'wordSet', at('2026-10-21T09:05:00.000Z'))?.dayMet).toBe(true);
    expect(sent('goal.met').map((e) => e.payload)).toEqual([{ points: 6, target: 6 }]);
  });

  it('latches the week on its third learned day: week.goal_met and the banner\'s count', () => {
    seed(blank({ dayLog: { '2026-10-19': { [KEY]: 3 }, '2026-10-20': { [KEY]: 3 } }, steadyWeeks: { '2026-10-12': '2026-10-15T09:00:00.000Z' } }));
    const moment = recordActivityPoints(P, 'dailyReview', at('2026-10-21T09:00:00.000Z'));
    expect(moment).toEqual({ dayMet: true, weekMet: 2 });
    expect(snap().steadyWeeks).toEqual({ '2026-10-12': '2026-10-15T09:00:00.000Z', '2026-10-19': '2026-10-21T09:00:00.000Z' });
    expect(sent('week.goal_met').map((e) => e.payload)).toEqual([{ days: 3, target: 3 }]);
    // Once: the next activity of the week sends nothing more.
    recordActivityPoints(P, 'keepGoing', at('2026-10-22T09:00:00.000Z'));
    expect(sent('week.goal_met')).toHaveLength(1);
  });

  it('before the saved copy is read, the write waits for it (never a write built on a blank record)', async () => {
    mem.set(`progress:${P}`, blank({ dayLog: { '2026-10-21': { [KEY]: 3 } } }));
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set(), pendingVocabEvents: {}, openSession: null });
    expect(recordActivityPoints(P, 'quest', at('2026-10-21T10:00:00.000Z'))).toBeNull();
    await settle();
    expect(snap().dayLog).toEqual({ '2026-10-21': { [KEY]: 6 } });
  });
});

describe('a wrong device clock (section 13): every write is capped at the last server time seen', () => {
  it('a device clock in 2099 writes the server\'s day, and a far-future day it wrote before is dropped', () => {
    seed(blank({ dayLog: { '2099-01-01': { [KEY]: 3 } }, streakLocal: { run: 1, lastDay: '2099-01-01' }, goals: { daily: 3, weeklyDays: 3, setAt: '2099-01-01T00:00:00.000Z' } }));
    noteServerTime('2026-10-22T12:00:00.000Z', at('2099-01-01T00:00:00.000Z'));
    recordActivityPoints(P, 'quest', at('2099-01-01T01:00:00.000Z'));
    expect(snap().dayLog).toEqual({ '2026-10-22': { [KEY]: 3 } });
    expect(snap().streakLocal).toBeUndefined();
    expect(snap().goals?.setAt).toBe('2026-10-22T13:00:00.000Z');
    saveGoals(P, { daily: 6, weeklyDays: 5 }, { deviceNow: at('2099-01-01T02:00:00.000Z') });
    expect(snap().goals).toEqual({ daily: 6, weeklyDays: 5, setAt: '2026-10-22T14:00:00.000Z' });
  });

  it('the latch check on Home open brings a far-future value back to now too', () => {
    seed(blank({ dayLog: { '2099-01-01': { [KEY]: 3 } }, steadyWeeks: { '2098-12-29': '2099-01-01T00:00:00.000Z' } }));
    noteServerTime('2026-10-22T12:00:00.000Z', at('2026-10-22T12:00:00.000Z'));
    checkSteadyWeeks(P, at('2026-10-22T12:00:00.000Z'));
    expect(snap().dayLog).toEqual({});
    expect(snap().steadyWeeks ?? {}).toEqual({});
  });

  it("a session's local day (CM-4) takes the cap only while goals is on; off, the device clock as CM-4 shipped", () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at('2099-01-01T01:00:00.000Z'));
    noteServerTime('2026-10-22T12:00:00.000Z', at('2099-01-01T00:00:00.000Z'));
    const store = useProgressStore.getState();
    const on = store.beginSession(P, { owner: 'test', streak: false, keepsRun: true });
    expect(snap().sessions.at(-1)?.localDay).toBe('2026-10-22');
    if (on) store.endSession(P, on);
    goalsOn(false);
    seed(blank());
    useProgressStore.getState().beginSession(P, { owner: 'test', streak: false, keepsRun: true });
    expect(snap().sessions.at(-1)?.localDay).toBe('2099-01-01');
  });

  it('a right clock is used as it is', () => {
    noteServerTime('2026-10-22T12:00:00.000Z', at('2026-10-22T12:00:05.000Z'));
    recordActivityPoints(P, 'quest', at('2026-10-22T11:59:00.000Z'));
    expect(Object.keys(snap().dayLog ?? {})).toEqual(['2026-10-22']);
    noteServerTime('not a time');
  });
});

describe('saveGoals', () => {
  it('saves the choice with setAt, sends goal.set once per change, and quiet sends none', () => {
    saveGoals(P, { daily: 6, weeklyDays: 5 }, { deviceNow: at('2026-10-21T09:00:00.000Z') });
    expect(snap().goals).toEqual({ daily: 6, weeklyDays: 5, setAt: '2026-10-21T09:00:00.000Z' });
    expect(sent('goal.set').map((e) => e.payload)).toEqual([{ daily: 6, weeklyDays: 5 }]);
    const held = snap();
    saveGoals(P, { daily: 6, weeklyDays: 5 }, { deviceNow: at('2026-10-21T10:00:00.000Z') });
    expect(snap()).toBe(held);
    expect(sent('goal.set')).toHaveLength(1);
    seed(blank());
    saveGoals(P, { daily: 3, weeklyDays: 3 }, { quiet: true, deviceNow: at('2026-10-21T09:00:00.000Z') });
    expect(snap().goals).toEqual({ daily: 3, weeklyDays: 3, setAt: DEFAULTS_SET_AT });
    expect(sent('goal.set')).toHaveLength(1);
  });

  it('lowering the weekly days to the days already learned latches the week at once', () => {
    seed(blank({ goals: { daily: 3, weeklyDays: 5, setAt: '2026-10-01T00:00:00.000Z' }, dayLog: { '2026-10-19': { [KEY]: 3 }, '2026-10-20': { [KEY]: 3 }, '2026-10-21': { [KEY]: 3 } } }));
    checkSteadyWeeks(P, at('2026-10-21T12:00:00.000Z'));
    expect(snap().steadyWeeks).toBeUndefined();
    saveGoals(P, { daily: 3, weeklyDays: 3 }, { deviceNow: at('2026-10-21T12:00:00.000Z') });
    expect(Object.keys(snap().steadyWeeks ?? {})).toEqual(['2026-10-19']);
    expect(sent('week.goal_met').map((e) => e.payload)).toEqual([{ days: 3, target: 3 }]);
  });
});

describe('the store\'s events: a finished word set and every merge', () => {
  it('a word set earns its point through the entry; a moment it reached waits for its Results screen while fresh', async () => {
    await loadGoalsChunk();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at('2026-10-21T09:00:00.000Z'));
    seed(blank({ dayLog: { '2026-10-21': { [KEY]: 2 } } }));
    emitGoalEvent({ type: 'activity', profileId: P, kind: 'wordSet' });
    await settle();
    expect(snap().dayLog).toEqual({ '2026-10-21': { [KEY]: 3 } });
    expect(takeGoalMoment(P)).toEqual({ dayMet: true, weekMet: null });
    expect(takeGoalMoment(P)).toBeNull();
    // A moment that waited too long belongs to another screen's finish.
    seed(blank({ dayLog: { '2026-10-22': { [KEY]: 2 } } }));
    vi.setSystemTime(at('2026-10-22T09:00:00.000Z'));
    emitGoalEvent({ type: 'activity', profileId: P, kind: 'wordSet' });
    await settle();
    expect(takeGoalMoment(P, Date.now() + MOMENT_FRESH_MS)).toBeNull();
    // A word set that reached nothing leaves no moment.
    emitGoalEvent({ type: 'activity', profileId: P, kind: 'wordSet' });
    await settle();
    expect(await takeGoalMomentLater(P)).toBeNull();
    // With goals off the entry loads nothing and answers null.
    goalsOn(false);
    expect(await recordActivityPointsLater(P, 'quest')).toBeNull();
    expect(await takeGoalMomentLater(P)).toBeNull();
    emitGoalEvent({ type: 'activity', profileId: P, kind: 'wordSet' });
    await settle();
    expect(snap().dayLog).toEqual({ '2026-10-22': { [KEY]: 4 } });
  });

  it('recordActivityPointsLater resolves with the moment for the Results banner', async () => {
    expect(await recordActivityPointsLater(P, 'quest', at('2026-10-21T09:00:00.000Z'))).toEqual({ dayMet: true, weekMet: null });
  });

  it('a sync that brings another device\'s days latches the week, with no banner', async () => {
    await loadGoalsChunk();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at('2026-10-22T09:00:00.000Z'));
    useProgressStore.getState().replaceSnapshot(P, blank({ dayLog: { '2026-10-19': { [KEY]: 3 }, '2026-10-20': { 'ik-tablet0000000000': 3 }, '2026-10-21': { [KEY]: 1 } } }));
    await settle();
    expect(Object.keys(snap().steadyWeeks ?? {})).toEqual(['2026-10-19']);
    expect(sent('week.goal_met')).toHaveLength(1);
    expect(takeGoalMoment(P)).toBeNull();
  });
});

describe('the weekly days in force come from a weekly plan when one is on', () => {
  it('a plan of 2 days a week latches on the second learned day and sends week.goal_met with the plan\'s target', () => {
    seed(blank({ selfRoute: selfRoute(2), dayLog: { '2026-10-19': { [KEY]: 3 } } }));
    const moment = recordActivityPoints(P, 'quest', at('2026-10-20T09:00:00.000Z'));
    expect(moment?.weekMet).toBe(1);
    expect(sent('week.goal_met').map((e) => e.payload)).toEqual([{ days: 2, target: 2 }]);
    expect(CURR_TELEMETRY_PAYLOADS['week.goal_met'].safeParse({ days: 4, target: 4 }).success).toBe(true);
  });

  it('a class plan of 5 days not read yet: the latch waits for it and never latches the week against 3 days', async () => {
    const plan = {
      id: 'plan:class-a',
      spaceId: 'space:class-a',
      spaceKind: 'class',
      spaceName: 'Class A',
      title: 'Week plan',
      items: [],
      publishedAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      meta: { weeks: [{ index: 1, startDate: '2026-10-19' }], params: { sessionsPerWeek: 5 } },
    } as unknown as InboxPlan;
    mem.set(PLANS_KEY(P), [plan]);
    usePlanStore.setState({ byLearner: {} });
    seed(blank({ dayLog: { '2026-10-19': { [KEY]: 3 }, '2026-10-20': { [KEY]: 3 }, '2026-10-21': { [KEY]: 3 } } }));
    checkSteadyWeeks(P, at('2026-10-21T12:00:00.000Z'));
    expect(snap().steadyWeeks).toBeUndefined();
    await settle();
    expect(usePlanStore.getState().byLearner[P]).toHaveLength(1);
    expect(snap().steadyWeeks).toBeUndefined();
    expect(sent('week.goal_met')).toEqual([]);
    expect(planDaysFor(P, snap(), at('2026-10-21T12:00:00.000Z'))).toBe(5);
  });
});

describe('Not now keeps the defaults without beating a real choice', () => {
  it('stores the defaults with the earliest setAt and sends nothing; a choice from another device wins either merge order', () => {
    saveGoals(P, { daily: 3, weeklyDays: 3 }, { quiet: true, deviceNow: at('2026-10-21T09:00:00.000Z') });
    const notNow = snap().goals;
    expect(notNow).toEqual({ daily: 3, weeklyDays: 3, setAt: DEFAULTS_SET_AT });
    expect(sent('goal.set')).toEqual([]);
    const tablet = { daily: 10 as const, weeklyDays: 5 as const, setAt: '2026-10-20T09:00:00.000Z' };
    expect(mergeGoals(notNow, tablet)).toEqual(tablet);
    expect(mergeGoals(tablet, notNow)).toEqual(tablet);
    // A real choice on this device later is stamped now and sends goal.set.
    saveGoals(P, { daily: 6, weeklyDays: 3 }, { deviceNow: at('2026-10-21T10:00:00.000Z') });
    expect(snap().goals).toEqual({ daily: 6, weeklyDays: 3, setAt: '2026-10-21T10:00:00.000Z' });
    expect(sent('goal.set').map((e) => e.payload)).toEqual([{ daily: 6, weeklyDays: 3 }]);
  });
});

describe('the store path under a zoned clock (TZ set for the test, the suite runs under TZ=UTC)', () => {
  const zones: Array<[string, string, string]> = [
    // [zone, instant, the local day the point lands on]
    ['Pacific/Kiritimati', '2026-10-21T11:00:00.000Z', '2026-10-22'],
    ['Etc/GMT+12', '2026-10-21T11:00:00.000Z', '2026-10-20'],
    ['Asia/Seoul', '2026-10-21T15:30:00.000Z', '2026-10-22'],
    ['America/Los_Angeles', '2026-10-21T05:00:00.000Z', '2026-10-20'],
    // The night the clocks go back (2026-11-01): 01:30 comes twice, both on the 1st.
    ['America/Los_Angeles', '2026-11-01T09:30:00.000Z', '2026-11-01'],
  ];
  const held = process.env.TZ;
  afterEach(() => {
    process.env.TZ = held;
  });
  it.each(zones)('%s at %s writes dayLog on %s', (zone, instant, local) => {
    process.env.TZ = zone;
    recordActivityPoints(P, 'quest', at(instant));
    expect(Object.keys(snap().dayLog ?? {})).toEqual([local]);
  });
});

describe('planDaysFor', () => {
  it('is null without a plan; an active self-route sets the weekly days in force', () => {
    expect(planDaysFor(P, blank())).toBeNull();
    const route = {
      id: 'route:mine',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      archivedAt: null,
      meta: { weeks: [{ index: 1, startDate: '2026-10-19' }], params: { sessionsPerWeek: 4 } },
      items: [],
    } as unknown as NonNullable<ProgressSnapshot['selfRoute']>;
    expect(planDaysFor(P, blank({ selfRoute: route }), at('2026-10-21T09:00:00.000Z'))).toBe(4);
    expect(planDaysFor(P, blank({ selfRoute: route }), at('2026-11-21T09:00:00.000Z'))).toBeNull();
  });
});
