import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Like } from '../db/d1';
import app from '../index';
import { MIN_GROUP_EVENTS, ROLLUP_BUDGET_METRIC, readRollups, rollupBudget } from '../lib/learning-rollups';
import { D1Db } from '../db';
import { store } from '../store';
import { openSqliteD1 } from './helpers/sqlite';

/**
 * POST /api/telemetry into `learning_rollups` (F-CURR-002 section 11.2, row CM-70a), against the
 * real migrations through the SQLite shim as the D1 binding. The event is validated and logged as
 * before; a name on the allowlist also adds 1 to its cells on the UTC day of ingest. The table
 * holds codes and counts only: no profile id, install key, device id or free text.
 */
const NOW = new Date('2026-10-21T12:00:00.000Z');
const DAY = '2026-10-21';
const PROFILE = 'learner:7f3c9a1e-profile';
const DEVICE = 'device:41b2-install';

type Sqlite = D1Like & { close: () => void };
let d1: Sqlite;

type Ctx = { waitUntil: (p: Promise<unknown>) => void; passThroughOnException: () => void; props: unknown };
async function post(body: unknown, headers: Record<string, string> = {}, env: Record<string, unknown> = { DB: d1 }, ctx?: Ctx) {
  const res = await app.request('/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }, env, ctx);
  return res.status;
}

/** One caller address per profile, as many homes are (the once-a-day cap is per address). */
const ip = (who: string) => ({ 'cf-connecting-ip': `ip-${who}` });

/** Every rollup row but the budget counter (asserted on its own). */
async function table(): Promise<Array<Record<string, unknown>>> {
  return (await d1.prepare('SELECT * FROM learning_rollups WHERE metric != ? ORDER BY day, metric, dim, bucket').bind(ROLLUP_BUDGET_METRIC).all<Record<string, unknown>>()).results;
}

const MEMORY_DAILY = {
  hist: [
    { kind: 'lex', rung: 'read', lag: '4-7', right: 4, wrong: 1 },
    { kind: 'syl', rung: 'recognize', lag: '8-14', right: 9, wrong: 1 },
  ],
  lapses: 1,
  items: 15,
  newHeld: 2,
  minutes: 11,
  durableWeekBucket: '5-9',
  dueVolumeBucket: '10-19',
  arms: { E2: 'b' },
};

beforeEach(() => {
  d1 = openSqliteD1();
  store.reset();
  rollupBudget.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  d1.close();
});

describe('POST /api/telemetry · learning_rollups', () => {
  it('stores no id: the columns are day, metric, dim, bucket and events, and no value is the profile, install or device id', async () => {
    const headers = { 'x-install-key': 'ik-123', 'x-device-id': DEVICE, 'cf-connecting-ip': '203.0.113.9' };
    expect(await post({ name: 'memory.daily', profileId: PROFILE, payload: MEMORY_DAILY, at: NOW.toISOString() }, headers)).toBe(201);
    expect(
      await post({ name: 'session.end', profileId: PROFILE, payload: { durationSeconds: 300, streakDays: 2, questLeft: 1, leftAtKind: 'order-it', afterWrongStreak: 1, deviceId: DEVICE, note: 'free text' } }, headers),
    ).toBe(201);
    const rows = await table();
    expect(rows).toEqual([
      { day: DAY, metric: 'memory.daily.dueVolume', dim: '', bucket: '10-19', events: 1 },
      { day: DAY, metric: 'memory.daily.durableWeek', dim: '', bucket: '5-9', events: 1 },
      { day: DAY, metric: 'memory.daily.durableWeek', dim: 'E2:b', bucket: '5-9', events: 1 },
      { day: DAY, metric: 'memory.daily.minutes', dim: '', bucket: '10-14', events: 1 },
      { day: DAY, metric: 'memory.daily.newHeld', dim: '', bucket: '2', events: 1 },
      { day: DAY, metric: 'memory.daily.recallLag', dim: '4-7', bucket: '80-89', events: 1 },
      { day: DAY, metric: 'memory.daily.recallLag', dim: '8-14', bucket: '90-92', events: 1 },
      { day: DAY, metric: 'session.end.leftAfterWrongStreak', dim: '', bucket: '1', events: 1 },
      { day: DAY, metric: 'session.end.minutes', dim: '', bucket: '5', events: 1 },
      { day: DAY, metric: 'session.end.questLeft', dim: '', bucket: '1', events: 1 },
      { day: DAY, metric: 'session.end.questLeft', dim: 'order-it', bucket: '1', events: 1 },
    ]);
    // The only other row is the budget counter: codes and a count.
    expect((await d1.prepare('SELECT * FROM learning_rollups WHERE metric = ?').bind(ROLLUP_BUDGET_METRIC).all()).results).toEqual([{ day: DAY, metric: ROLLUP_BUDGET_METRIC, dim: '', bucket: '', events: 500 }]);
    const columns = (await d1.prepare("SELECT name FROM pragma_table_info('learning_rollups') ORDER BY cid").all<{ name: string }>()).results.map((r) => r.name);
    expect(columns).toEqual(['day', 'metric', 'dim', 'bucket', 'events']);
    const values = JSON.stringify(rows);
    for (const secret of [PROFILE, '7f3c9a1e', DEVICE, 'ik-123', '203.0.113.9', 'free text', 'learner:', 'device:']) expect(values).not.toContain(secret);
  });

  it('counts profile-days: 25 profiles sending their once-a-day memory.daily make 25 events in each cell', async () => {
    for (let i = 0; i < 25; i += 1) expect(await post({ name: 'memory.daily', profileId: `learner:p${i}`, payload: MEMORY_DAILY })).toBe(201);
    const rows = await table();
    expect(rows).toHaveLength(7);
    for (const row of rows) expect(row.events).toBe(25);
    expect(await readRollups(new D1Db(d1), { fromDay: DAY, toDay: DAY, metric: 'memory.daily.durableWeek' })).toEqual([
      { day: DAY, metric: 'memory.daily.durableWeek', dim: '', bucket: '5-9', events: 25 },
      { day: DAY, metric: 'memory.daily.durableWeek', dim: 'E2:b', bucket: '5-9', events: 25 },
    ]);
  });

  it('keys by the UTC day of ingest, not the client clock: an offline-queued event counts on the day it arrives', async () => {
    expect(await post({ name: 'goal.met', profileId: PROFILE, payload: { points: 3, target: 3 }, at: '2026-10-19T08:00:00.000Z' })).toBe(201);
    vi.setSystemTime(new Date('2026-10-22T00:00:01.000Z'));
    expect(await post({ name: 'goal.met', profileId: PROFILE, payload: { points: 3, target: 3 }, at: '2026-10-21T23:59:00.000Z' })).toBe(201);
    expect((await table()).map((r) => [r.day, r.events])).toEqual([
      [DAY, 1],
      ['2026-10-22', 1],
    ]);
  });

  it('suppresses small groups when read: 19 profile-days are hidden, 20 are shown', async () => {
    for (let i = 0; i < MIN_GROUP_EVENTS - 1; i += 1) await post({ name: 'week.goal_met', profileId: `learner:w${i}`, payload: { days: 3, target: 3 } }, ip(`w${i}`));
    for (let i = 0; i < MIN_GROUP_EVENTS; i += 1) await post({ name: 'week.goal_met', profileId: `learner:x${i}`, payload: { days: 5, target: 5 } }, ip(`x${i}`));
    for (let i = 0; i < MIN_GROUP_EVENTS + 5; i += 1) await post({ name: 'week.goal_met', profileId: `learner:y${i}`, payload: { days: 7, target: 7 } }, ip(`y${i}`));
    // Target 3 (19) is hidden, and with it the smallest visible target (5, 20 events), so 3 cannot be derived from a total.
    expect(await readRollups(new D1Db(d1), { fromDay: DAY, toDay: DAY, metric: 'week.goal_met' })).toEqual([{ day: DAY, metric: 'week.goal_met', dim: '', bucket: '7', events: 25 }]);
    for (let i = 0; i < MIN_GROUP_EVENTS; i += 1) await post({ name: 'goal.met', profileId: `learner:g${i}`, payload: { points: 6, target: 6 } }, ip(`g${i}`));
    expect(await readRollups(new D1Db(d1), { fromDay: DAY, toDay: DAY, metric: 'goal.met' })).toEqual([{ day: DAY, metric: 'goal.met', dim: '', bucket: '6', events: 20 }]);
  });

  it('ignores names off the allowlist, refused names and payloads that do not fit; the event is still logged', async () => {
    expect(await post({ name: 'quest.start', profileId: PROFILE, payload: { questId: 'quest:stage1-letters-q1' } })).toBe(201);
    expect(await post({ name: 'goal.set', profileId: PROFILE, payload: { daily: 3, weeklyDays: 3 } })).toBe(201);
    expect(await post({ name: 'goal.met', profileId: PROFILE, payload: { points: 3, target: 3, profileId: PROFILE } })).toBe(201);
    expect(await post({ name: 'not.a.name', profileId: PROFILE, payload: { target: 3 } })).toBe(422);
    expect(await post({ name: 'billing.checkout_completed', payload: { planKey: 'family' } })).toBe(422);
    expect(await table()).toEqual([]);
    expect(store.events.map((e) => e.name)).toEqual(['quest.start', 'goal.set', 'goal.met']);
  });

  it('a Worker running before migration 0014 still accepts the event', async () => {
    const before = openSqliteD1({ before: '0014_learning_rollups.sql' });
    expect(await post({ name: 'goal.met', profileId: PROFILE, payload: { points: 3, target: 3 } }, {}, { DB: before })).toBe(201);
    expect(store.events).toHaveLength(1);
    before.close();
  });

  it('kill switch: LEARNING_ROLLUPS=disabled writes no row, also for names shipped clients already send; unset or enabled writes', async () => {
    const shipped = { name: 'session.end', profileId: PROFILE, payload: { durationSeconds: 300, streakDays: 2 } };
    expect(await post(shipped, {}, { DB: d1, LEARNING_ROLLUPS: 'disabled' })).toBe(201);
    expect(await post({ name: 'review.complete', profileId: PROFILE, payload: { kind: 'daily', stars: 3 } }, {}, { DB: d1, LEARNING_ROLLUPS: 'disabled' })).toBe(201);
    expect(await table()).toEqual([]);
    expect(store.events).toHaveLength(2);
    expect(await post(shipped, {}, { DB: d1, LEARNING_ROLLUPS: 'enabled' })).toBe(201);
    expect(await post({ name: 'review.complete', profileId: PROFILE, payload: { kind: 'daily', stars: 3 } }, {}, { DB: d1 })).toBe(201);
    expect((await table()).map((r) => r.metric)).toEqual(['review.complete.stars', 'session.end.minutes']);
  });

  it('on the Worker the rollup runs after the answer (waitUntil), so a slow D1 write never delays the 201', async () => {
    const pending: Array<Promise<unknown>> = [];
    const ctx: Ctx = { waitUntil: (p) => pending.push(p), passThroughOnException: () => undefined, props: {} };
    expect(await post({ name: 'goal.met', profileId: PROFILE, payload: { points: 3, target: 3 } }, {}, { DB: d1 }, ctx)).toBe(201);
    expect(pending).toHaveLength(1);
    await Promise.all(pending);
    expect((await table()).map((r) => [r.metric, r.events])).toEqual([['goal.met', 1]]);
  });

  it('a production Worker with no D1 binding still accepts the event (the rollup is skipped, never a 503)', async () => {
    expect(await post({ name: 'goal.met', profileId: PROFILE, payload: { points: 3, target: 3 } }, {}, { ENVIRONMENT: 'production' })).toBe(201);
    expect(store.events).toHaveLength(1);
  });
});
