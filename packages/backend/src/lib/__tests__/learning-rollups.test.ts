import { TELEMETRY_EVENT_NAMES } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryDb } from '../../db';
import type { RollupRow } from '../../db';
import {
  MAX_ROLLUP_ROWS_PER_EVENT,
  MIN_GROUP_EVENTS,
  ONCE_A_DAY_ROLLUP_NAMES,
  OTHER_DIM,
  ROLLUP_BUDGET_METRIC,
  ROLLUP_CLIENT_CELLS_PER_HOUR,
  ROLLUP_CLIENT_DAILY_EVENTS,
  ROLLUP_EVENT_NAMES,
  ROLLUP_GLOBAL_ROWS_PER_DAY,
  ROLLUP_ISOLATE_CELLS_PER_DAY,
  ROLLUP_MAX_CLIENT_KEYS,
  ROLLUP_ONCE_A_DAY_MAX_AGE_MS,
  ROLLUP_READ_LIMIT,
  cappedDays,
  learningRollupsEnabled,
  minutesBucket,
  rateBucket,
  readRollups,
  rollUpEvent,
  rollupBudget,
  rollupClientKey,
  rollupKeysFor,
  suppressSmallGroups,
} from '../learning-rollups';

/**
 * F-CURR-002 section 11.2 (row CM-70a): which rows an event adds 1 to. Codes and counts only,
 * at most MAX_ROLLUP_ROWS_PER_EVENT rows per event, nothing for a name off the allowlist, and a
 * reader that hides any cell with fewer than 20 events on a day.
 */
const DAY = '2026-10-21';
const AT = `${DAY}T12:00:00.000Z`;

/** Every lag bucket, every kind, every experiment: the widest `memory.daily` a device can send. */
const FULL_MEMORY_DAILY = {
  hist: ['sym', 'syl', 'lex', 'pat', 'exc', 'rea'].flatMap((kind) =>
    ['recognize', 'read', 'produce'].flatMap((rung) => ['0-1', '2-3', '4-7', '8-14', '15-30', '31+'].map((lag) => ({ kind, rung, lag, right: 4, wrong: 1 }))),
  ),
  lapses: 3,
  calib: Array.from({ length: 10 }, () => ({ right: 1, wrong: 1 })),
  items: 120,
  newHeld: 4,
  minutes: 14,
  durableWeekBucket: '10-19',
  dueVolumeBucket: '20-29',
  arms: { E1: 'a', E2: 'b', E3: 'a', E4: 'b' },
};

const SAMPLES: Record<(typeof ROLLUP_EVENT_NAMES)[number], Record<string, unknown>> = {
  'memory.daily': FULL_MEMORY_DAILY,
  'items.seeded': { countBucket: '500-999', spreadDaysBucket: '31+' },
  'session.end': { durationSeconds: 754, streakDays: 3, questLeft: 1, leftAtKind: 'listen-pick', afterWrongStreak: 2 },
  'review.complete': { kind: 'daily', stageKey: 'stage1', symbolsCorrect: 4, wordsCorrect: 3, retries: 1, stars: 2 },
  'goal.met': { points: 7, target: 6 },
  'week.goal_met': { days: 5, target: 5 },
  'mastery.level_up': { cellId: 'episode:stage2-life', level: 2 },
  'stage.card_opened': { stage: 'stage3' },
  'testout.finished': { cellId: 'episode:stage3-crafts', passed: true, items: 10, firstTryCorrect: 9 },
  'quest.adapt': { questId: 'quest:stage3-life-q2', dir: 'compact' },
  'pack.opened': { packId: 'pack:numbers-time' },
  'pack.level_complete': { packId: 'pack:numbers-time', stage: 'stage2' },
  'exp.exposure': { experimentId: 'E3', arm: 'b' },
};

const CODE = /^[A-Za-z0-9:._+-]{0,64}$/;

describe('rollup allowlist', () => {
  it('is the names of section 11.2, each on the shared list', () => {
    expect([...ROLLUP_EVENT_NAMES]).toEqual([
      'memory.daily',
      'items.seeded',
      'session.end',
      'review.complete',
      'goal.met',
      'week.goal_met',
      'mastery.level_up',
      'stage.card_opened',
      'testout.finished',
      'quest.adapt',
      'pack.opened',
      'pack.level_complete',
      'exp.exposure',
    ]);
    for (const name of ROLLUP_EVENT_NAMES) expect(TELEMETRY_EVENT_NAMES).toContain(name);
  });

  it('ignores every name off the allowlist, whatever its payload', () => {
    const off = TELEMETRY_EVENT_NAMES.filter((n) => !(ROLLUP_EVENT_NAMES as readonly string[]).includes(n));
    expect(off.length).toBeGreaterThan(50);
    for (const name of off) expect(rollupKeysFor(name, { ...SAMPLES['session.end'], ...SAMPLES['goal.met'] })).toEqual([]);
    expect(rollupKeysFor('not.a.name', SAMPLES['goal.met'])).toEqual([]);
  });

  it('adds nothing for a missing or malformed payload', () => {
    for (const name of ROLLUP_EVENT_NAMES) {
      expect(rollupKeysFor(name, undefined)).toEqual([]);
      expect(rollupKeysFor(name, { profileId: 'learner:abc', deviceId: 'dev-1', text: 'hello' })).toEqual([]);
    }
  });
});

describe('rows per event', () => {
  it('maps each sample onto its documented cells', () => {
    expect(rollupKeysFor('items.seeded', SAMPLES['items.seeded'])).toEqual([
      { metric: 'items.seeded.count', dim: '', bucket: '500-999' },
      { metric: 'items.seeded.spreadDays', dim: '', bucket: '31+' },
    ]);
    expect(rollupKeysFor('session.end', SAMPLES['session.end'])).toEqual([
      { metric: 'session.end.minutes', dim: '', bucket: '12' },
      { metric: 'session.end.questLeft', dim: '', bucket: '1' },
      { metric: 'session.end.questLeft', dim: 'listen-pick', bucket: '1' },
      { metric: 'session.end.leftAfterWrongStreak', dim: '', bucket: '2' },
    ]);
    expect(rollupKeysFor('review.complete', SAMPLES['review.complete'])).toEqual([{ metric: 'review.complete.stars', dim: 'daily', bucket: '2' }]);
    expect(rollupKeysFor('goal.met', SAMPLES['goal.met'])).toEqual([{ metric: 'goal.met', dim: '', bucket: '6' }]);
    expect(rollupKeysFor('week.goal_met', SAMPLES['week.goal_met'])).toEqual([{ metric: 'week.goal_met', dim: '', bucket: '5' }]);
    expect(rollupKeysFor('mastery.level_up', SAMPLES['mastery.level_up'])).toEqual([{ metric: 'mastery.level_up', dim: 'episode:stage2-life', bucket: '2' }]);
    expect(rollupKeysFor('stage.card_opened', SAMPLES['stage.card_opened'])).toEqual([{ metric: 'stage.card_opened', dim: 'stage3', bucket: '' }]);
    expect(rollupKeysFor('testout.finished', SAMPLES['testout.finished'])).toEqual([
      { metric: 'testout.finished.passed', dim: 'episode:stage3-crafts', bucket: '1' },
      { metric: 'testout.finished.accuracy', dim: 'episode:stage3-crafts', bucket: '90-92' },
    ]);
    expect(rollupKeysFor('quest.adapt', SAMPLES['quest.adapt'])).toEqual([{ metric: 'quest.adapt', dim: 'quest:stage3-life-q2', bucket: 'compact' }]);
    // No pack ships on the Worker yet (row CM-50b registers them), so every pack counts under `other`.
    expect(rollupKeysFor('pack.opened', SAMPLES['pack.opened'])).toEqual([{ metric: 'pack.opened', dim: OTHER_DIM, bucket: '' }]);
    expect(rollupKeysFor('pack.level_complete', SAMPLES['pack.level_complete'])).toEqual([{ metric: 'pack.level_complete', dim: OTHER_DIM, bucket: 'stage2' }]);
    expect(rollupKeysFor('exp.exposure', SAMPLES['exp.exposure'])).toEqual([{ metric: 'exp.exposure', dim: 'E3:b', bucket: '' }]);
  });

  it('memory.daily: north star (overall and per arm), due volume, items newly held, minutes, and recall per lag bucket', () => {
    const keys = rollupKeysFor('memory.daily', {
      ...FULL_MEMORY_DAILY,
      hist: [
        { kind: 'lex', rung: 'read', lag: '4-7', right: 3, wrong: 1 },
        { kind: 'syl', rung: 'recognize', lag: '4-7', right: 5, wrong: 1 },
        { kind: 'sym', rung: 'read', lag: '8-14', right: 0, wrong: 0 },
        { kind: 'sym', rung: 'produce', lag: '31+', right: 1, wrong: 3 },
      ],
      arms: { E2: 'b' },
    });
    expect(keys).toEqual([
      { metric: 'memory.daily.durableWeek', dim: '', bucket: '10-19' },
      { metric: 'memory.daily.durableWeek', dim: 'E2:b', bucket: '10-19' },
      { metric: 'memory.daily.dueVolume', dim: '', bucket: '20-29' },
      // G3: 4 items newly held in 14 study minutes
      { metric: 'memory.daily.newHeld', dim: '', bucket: '3-4' },
      { metric: 'memory.daily.minutes', dim: '', bucket: '10-14' },
      // 8 right of 10 at 4-7 days; 8-14 had no answers, so no cell; 1 of 4 at 31+
      { metric: 'memory.daily.recallLag', dim: '4-7', bucket: '80-89' },
      { metric: 'memory.daily.recallLag', dim: '31+', bucket: '0-49' },
    ]);
  });

  it(`never touches more than ${MAX_ROLLUP_ROWS_PER_EVENT} rows, even for the widest payload`, () => {
    for (const [name, payload] of Object.entries(SAMPLES)) {
      const keys = rollupKeysFor(name, payload);
      expect(keys.length, name).toBeGreaterThan(0);
      expect(keys.length, name).toBeLessThanOrEqual(MAX_ROLLUP_ROWS_PER_EVENT);
    }
    // 4 (north star, due volume, newly held, minutes) + 4 arms + 6 lags
    expect(rollupKeysFor('memory.daily', FULL_MEMORY_DAILY)).toHaveLength(14);
    expect(MAX_ROLLUP_ROWS_PER_EVENT).toBe(14);
  });

  it('holds codes only: every metric, dim and bucket is a short code', () => {
    for (const [name, payload] of Object.entries(SAMPLES)) {
      for (const k of rollupKeysFor(name, payload)) {
        expect(k.metric.startsWith(name)).toBe(true);
        expect(k.dim).toMatch(CODE);
        expect(k.bucket).toMatch(CODE);
      }
    }
  });

  it('closed sets: a bucket code off the shared edges adds nothing, so a caller cannot create rows at will', () => {
    // Row CM-12 made each bucket field an enum of its shared codes (Worker first), so a forged code fails the whole payload.
    expect(rollupKeysFor('memory.daily', { ...FULL_MEMORY_DAILY, hist: [], arms: {}, durableWeekBucket: '12345', dueVolumeBucket: '7-8' })).toEqual([]);
    expect(rollupKeysFor('memory.daily', { ...FULL_MEMORY_DAILY, hist: [], arms: {}, durableWeekBucket: '37' })).toEqual([]);
    expect(rollupKeysFor('items.seeded', { countBucket: '501-998', spreadDaysBucket: '9' })).toEqual([]);
    expect(rollupKeysFor('items.seeded', { countBucket: '20-49', spreadDaysBucket: '9' })).toEqual([]);
    expect(rollupKeysFor('items.seeded', { countBucket: '20-49', spreadDaysBucket: '8-14' })).toEqual([
      { metric: 'items.seeded.count', dim: '', bucket: '20-49' },
      { metric: 'items.seeded.spreadDays', dim: '', bucket: '8-14' },
    ]);
    // Raw counts are bucketed on the Worker: many different values land in a few cells.
    const buckets = new Set<string>();
    for (let n = 0; n < 2000; n += 7)
      for (const k of rollupKeysFor('memory.daily', { ...FULL_MEMORY_DAILY, hist: [], arms: {}, newHeld: n, minutes: n % 1441 })) buckets.add(`${k.metric}|${k.bucket}`);
    expect(buckets.size).toBeLessThanOrEqual(2 + 15 + 13);
  });

  it('closed sets: an unknown quest or pack slug is stored as `other`, never as sent', () => {
    expect(rollupKeysFor('quest.adapt', { questId: 'quest:jane-doe-secret', dir: 'scaffold' })).toEqual([{ metric: 'quest.adapt', dim: OTHER_DIM, bucket: 'scaffold' }]);
    expect(rollupKeysFor('pack.opened', { packId: 'pack:jane-doe' })).toEqual([{ metric: 'pack.opened', dim: OTHER_DIM, bucket: '' }]);
    expect(rollupKeysFor('mastery.level_up', { cellId: 'episode:pack-jane-doe-s2', level: 1 })).toEqual([{ metric: 'mastery.level_up', dim: OTHER_DIM, bucket: '1' }]);
    const dims = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      for (const k of rollupKeysFor('quest.adapt', { questId: `quest:made-up-${i}`, dir: 'compact' })) dims.add(k.dim);
      for (const k of rollupKeysFor('pack.level_complete', { packId: `pack:made-up-${i}`, stage: 'stage1' })) dims.add(k.dim);
    }
    expect([...dims]).toEqual([OTHER_DIM]);
  });

  it('session.end: an older client adds only its minutes; a value off its codes is left out', () => {
    expect(rollupKeysFor('session.end', { durationSeconds: 59, streakDays: 0 })).toEqual([{ metric: 'session.end.minutes', dim: '', bucket: '0' }]);
    expect(rollupKeysFor('session.end', { durationSeconds: 1800, streakDays: 0, questLeft: 0, afterWrongStreak: 2 })).toEqual([
      { metric: 'session.end.minutes', dim: '', bucket: '30-59' },
      { metric: 'session.end.questLeft', dim: '', bucket: '0' },
    ]);
    expect(rollupKeysFor('session.end', { durationSeconds: -4, questLeft: 'yes', leftAtKind: 'learner typed this', afterWrongStreak: 9 })).toEqual([]);
    expect(rollupKeysFor('session.end', { durationSeconds: 1.5, questLeft: 1, leftAtKind: 'not-a-kind' })).toEqual([{ metric: 'session.end.questLeft', dim: '', bucket: '1' }]);
    expect(rollupKeysFor('session.end', { questLeft: 1, leftAtKind: 'order-it' })).toEqual([
      { metric: 'session.end.questLeft', dim: '', bucket: '1' },
      { metric: 'session.end.questLeft', dim: 'order-it', bucket: '1' },
    ]);
  });

  it('session.end: a game kind is written only for a quit, so its rate has the reporting sessions as denominator', () => {
    // a session that did not end inside a quest adds to the '' total only, even if it names a kind
    expect(rollupKeysFor('session.end', { durationSeconds: 300, streakDays: 1, questLeft: 0, leftAtKind: 'order-it', afterWrongStreak: 1 })).toEqual([
      { metric: 'session.end.minutes', dim: '', bucket: '5' },
      { metric: 'session.end.questLeft', dim: '', bucket: '0' },
    ]);
    // 80 sessions report: 60 finish, 20 quit (15 at order-it, 5 at listen-pick)
    const counts = new Map<string, number>();
    const send = (n: number, payload: Record<string, unknown>) => {
      for (let i = 0; i < n; i++) for (const k of rollupKeysFor('session.end', payload)) counts.set(`${k.metric}|${k.dim}|${k.bucket}`, (counts.get(`${k.metric}|${k.dim}|${k.bucket}`) ?? 0) + 1);
    };
    send(60, { durationSeconds: 600, streakDays: 1, questLeft: 0, leftAtKind: 'order-it' });
    send(15, { durationSeconds: 120, streakDays: 1, questLeft: 1, leftAtKind: 'order-it' });
    send(5, { durationSeconds: 120, streakDays: 1, questLeft: 1, leftAtKind: 'listen-pick' });
    const den = (counts.get('session.end.questLeft||0') ?? 0) + (counts.get('session.end.questLeft||1') ?? 0);
    expect(den).toBe(80);
    expect(counts.has('session.end.questLeft|order-it|0')).toBe(false);
    expect((counts.get('session.end.questLeft|order-it|1') ?? 0) / den).toBe(15 / 80);
    expect((counts.get('session.end.questLeft|listen-pick|1') ?? 0) / den).toBe(5 / 80);
  });

  it('review.complete needs a known kind and a star count from 0 to 3', () => {
    expect(rollupKeysFor('review.complete', { kind: 'feedback', stars: 3 })).toEqual([{ metric: 'review.complete.stars', dim: 'feedback', bucket: '3' }]);
    expect(rollupKeysFor('review.complete', { kind: 'secret', stars: 3 })).toEqual([]);
    expect(rollupKeysFor('review.complete', { kind: 'daily', stars: 4 })).toEqual([]);
    expect(rollupKeysFor('review.complete', { kind: 'daily', stars: '2' })).toEqual([]);
  });

  it('testout.finished with no items adds only the pass cell', () => {
    expect(rollupKeysFor('testout.finished', { cellId: 'episode:stage4-rites', passed: false, items: 0, firstTryCorrect: 0 })).toEqual([
      { metric: 'testout.finished.passed', dim: 'episode:stage4-rites', bucket: '0' },
    ]);
  });

  it('an F-CURR-002 name with a smuggled key adds nothing (its strict schema fails)', () => {
    expect(rollupKeysFor('goal.met', { ...SAMPLES['goal.met'], profileId: 'learner:abc' })).toEqual([]);
    expect(rollupKeysFor('exp.exposure', { ...SAMPLES['exp.exposure'], installKey: 'k-1' })).toEqual([]);
  });
});

describe('buckets', () => {
  it('rate buckets put the edges of G1 (80%) and G4 (70-92%) on bucket boundaries', () => {
    expect([0, 49, 50, 59, 60, 69, 70, 79, 80, 89, 90, 92, 93, 100].map((pct) => rateBucket(pct, 100))).toEqual([
      '0-49',
      '0-49',
      '50-59',
      '50-59',
      '60-69',
      '60-69',
      '70-79',
      '70-79',
      '80-89',
      '80-89',
      '90-92',
      '90-92',
      '93-100',
      '93-100',
    ]);
  });

  it('minutes: one bucket a minute below 30, then 30-59 and 60+', () => {
    expect([0, 59, 60, 1799, 1800, 3599, 3600, 86_400].map(minutesBucket)).toEqual(['0', '0', '1', '29', '30-59', '30-59', '60+', '60+']);
  });
});

describe('kill switch', () => {
  it('is on when unset, empty or enabled, and off for any other value', () => {
    expect(learningRollupsEnabled(undefined)).toBe(true);
    expect(learningRollupsEnabled({})).toBe(true);
    expect(learningRollupsEnabled({ LEARNING_ROLLUPS: '' })).toBe(true);
    expect(learningRollupsEnabled({ LEARNING_ROLLUPS: 'enabled' })).toBe(true);
    expect(learningRollupsEnabled({ LEARNING_ROLLUPS: 'disabled' })).toBe(false);
    expect(learningRollupsEnabled({ LEARNING_ROLLUPS: 'off' })).toBe(false);
  });
});

const goal = (receivedAt = AT) => ({ name: 'goal.met', payload: SAMPLES['goal.met'], receivedAt });
const session = (receivedAt = AT) => ({ name: 'session.end', payload: SAMPLES['session.end'], receivedAt });
const memory = (receivedAt = AT) => ({ name: 'memory.daily', payload: FULL_MEMORY_DAILY, receivedAt });
/** The rows of a day without the budget counter. */
async function cells(db: MemoryDb, day = DAY): Promise<RollupRow[]> {
  return (await db.rollupRows(day, day, undefined, 10_000)).filter((r) => r.metric !== ROLLUP_BUDGET_METRIC);
}

describe('rollUpEvent', () => {
  let db: MemoryDb;
  beforeEach(() => {
    db = new MemoryDb();
    rollupBudget.reset();
  });

  it('adds 1 per cell on the UTC day of ingest and answers the rows touched', async () => {
    expect(await rollUpEvent(() => db, goal(), 'ip-1')).toBe(1);
    expect(await rollUpEvent(() => db, goal('2026-10-21T23:59:59.999Z'), 'ip-1')).toBe(1);
    expect(await rollUpEvent(() => db, goal('2026-10-22T00:00:00.000Z'), 'ip-1')).toBe(1);
    expect([...(await cells(db)), ...(await cells(db, '2026-10-22'))]).toEqual([
      { day: DAY, metric: 'goal.met', dim: '', bucket: '6', events: 2 },
      { day: '2026-10-22', metric: 'goal.met', dim: '', bucket: '6', events: 1 },
    ]);
  });

  it('counts the rows actually written in the counter: each event adds its cells plus the counter row', async () => {
    for (let i = 0; i < 30; i += 1) await rollUpEvent(() => db, memory(), `ip-${i}`);
    expect(await db.rollupRows(DAY, DAY, ROLLUP_BUDGET_METRIC, 10)).toEqual([{ day: DAY, metric: ROLLUP_BUDGET_METRIC, dim: '', bucket: '', events: 30 * (MAX_ROLLUP_ROWS_PER_EVENT + 1) }]);
    await rollUpEvent(() => db, goal(), 'ip-x');
    expect((await db.rollupRows(DAY, DAY, ROLLUP_BUDGET_METRIC, 10))[0]?.events).toBe(30 * (MAX_ROLLUP_ROWS_PER_EVENT + 1) + 2);
  });

  it('isolate churn does not spend the day: 100 fresh isolates sending one goal.met each write 100 cells and count 200 rows', async () => {
    let written = 0;
    for (let i = 0; i < 100; i += 1) {
      rollupBudget.reset(); // a cold start: a fresh isolate holds no budget state
      written += await rollUpEvent(() => db, goal(), `ip-${i}`);
    }
    expect(written).toBe(100);
    expect((await db.rollupRows(DAY, DAY, ROLLUP_BUDGET_METRIC, 10))[0]?.events).toBe(200);
  });

  it(`with isolates starting and stopping all day, writes reach ${ROLLUP_GLOBAL_ROWS_PER_DAY} rows and stop just past it`, async () => {
    let rows = 0;
    let stopped = false;
    for (let i = 0; i < 10_000 && !stopped; i += 1) {
      if (i % 7 === 0) rollupBudget.reset();
      const n = await rollUpEvent(() => db, session(), `ip-${i % 5000}`);
      if (n === 0) stopped = true;
      rows += n === 0 ? 0 : n + 1;
    }
    expect(stopped).toBe(true);
    const counter = (await db.rollupRows(DAY, DAY, ROLLUP_BUDGET_METRIC, 10))[0]?.events ?? 0;
    expect(counter).toBe(rows);
    expect(counter).toBeGreaterThanOrEqual(ROLLUP_GLOBAL_ROWS_PER_DAY);
    expect(counter).toBeLessThan(ROLLUP_GLOBAL_ROWS_PER_DAY + 5);
    // A fresh isolate reads the spent counter first (a read, not a write) and writes nothing.
    rollupBudget.reset();
    expect(await rollUpEvent(() => db, session(), 'ip-fresh')).toBe(0);
    expect((await db.rollupRows(DAY, DAY, ROLLUP_BUDGET_METRIC, 10))[0]?.events).toBe(counter);
  });

  it('writes nothing for a name off the allowlist and never asks for the Db', async () => {
    const never = () => {
      throw new Error('Db asked for');
    };
    expect(await rollUpEvent(never, { name: 'quest.start', payload: { questId: 'quest:stage1-letters-q1' }, receivedAt: AT }, 'ip-1')).toBe(0);
  });

  it('a failing write (no table yet, no binding) is swallowed: the event is never failed by its rollup', async () => {
    const broken = {
      rollupRows: () => Promise.resolve([]),
      addRollups: () => Promise.reject(new Error('no such table: learning_rollups')),
    } as unknown as MemoryDb;
    expect(await rollUpEvent(() => broken, goal(), 'ip-1')).toBe(0);
    const noTable = { rollupRows: () => Promise.reject(new Error('no such table: learning_rollups')) } as unknown as MemoryDb;
    rollupBudget.reset();
    expect(await rollUpEvent(() => noTable, goal(), 'ip-2')).toBe(0);
    // The failed counter read is not kept: once the table is there, the next event of the day writes.
    expect(await rollUpEvent(() => db, goal(), 'ip-2b')).toBe(1);
    expect(
      await rollUpEvent(
        () => {
          throw new Error('db_not_configured');
        },
        goal(),
        'ip-3',
      ),
    ).toBe(0);
  });

  it('any other error, even while working out the cells, answers 0 and never rejects', async () => {
    const hostile = {
      get durationSeconds(): number {
        throw new Error('payload getter');
      },
    };
    await expect(rollUpEvent(() => db, { name: 'session.end', payload: hostile, receivedAt: AT }, 'ip-1')).resolves.toBe(0);
  });

  it('a late offline flush of a once-a-day name adds no rows; a recent one and any other name still count', async () => {
    const old = new Date(Date.parse(AT) - ROLLUP_ONCE_A_DAY_MAX_AGE_MS - 1000).toISOString();
    const recent = new Date(Date.parse(AT) - ROLLUP_ONCE_A_DAY_MAX_AGE_MS + 60_000).toISOString();
    expect(await rollUpEvent(() => db, { ...goal(), at: old }, 'ip-1')).toBe(0);
    expect(await rollUpEvent(() => db, { ...memory(), at: '2026-10-18T09:00:00.000Z' }, 'ip-1')).toBe(0);
    expect(await rollUpEvent(() => db, { ...goal(), at: recent }, 'ip-2')).toBe(1);
    expect(await rollUpEvent(() => db, { ...session(), at: old }, 'ip-1')).toBe(4);
    expect((await cells(db)).find((r) => r.metric === 'goal.met')?.events).toBe(1);
  });

  it(`caps a client at ${ROLLUP_CLIENT_CELLS_PER_HOUR} cells an hour (cells, not events); the next hour it may write again`, async () => {
    // session.end touches 4 cells
    let written = 0;
    for (let i = 0; i < ROLLUP_CLIENT_CELLS_PER_HOUR; i += 1) written += await rollUpEvent(() => db, session(), 'ip-busy');
    expect(written).toBe(ROLLUP_CLIENT_CELLS_PER_HOUR);
    expect(await rollUpEvent(() => db, session(), 'ip-busy')).toBe(0);
    expect(await rollUpEvent(() => db, session(), 'ip-other')).toBe(4);
    expect(await rollUpEvent(() => db, session('2026-10-21T13:00:00.000Z'), 'ip-busy')).toBe(4);
    const minutes = (await cells(db)).find((r) => r.metric === 'session.end.minutes');
    expect(minutes?.events).toBe(ROLLUP_CLIENT_CELLS_PER_HOUR / 4 + 2);
  });

  it(`caps each once-a-day name at ${ROLLUP_CLIENT_DAILY_EVENTS} events a client a UTC day (a school behind one address fits)`, async () => {
    expect(ONCE_A_DAY_ROLLUP_NAMES).toEqual(['memory.daily', 'items.seeded', 'goal.met', 'week.goal_met']);
    for (let i = 0; i < ROLLUP_CLIENT_DAILY_EVENTS; i += 1) expect(await rollUpEvent(() => db, goal(`${DAY}T0${i % 10}:00:00.000Z`), 'school')).toBe(1);
    expect(await rollUpEvent(() => db, goal(`${DAY}T20:00:00.000Z`), 'school')).toBe(0);
    // another once-a-day name and a many-a-day name are counted on their own
    expect(await rollUpEvent(() => db, { name: 'week.goal_met', payload: SAMPLES['week.goal_met'], receivedAt: `${DAY}T20:00:00.000Z` }, 'school')).toBe(1);
    expect(await rollUpEvent(() => db, session(`${DAY}T20:00:00.000Z`), 'school')).toBe(4);
    expect(await rollUpEvent(() => db, goal('2026-10-22T00:00:01.000Z'), 'school')).toBe(1);
  });

  it(`caps the isolate at ${ROLLUP_ISOLATE_CELLS_PER_DAY} cells a UTC day, whatever the client keys`, async () => {
    let written = 0;
    for (let i = 0; written < ROLLUP_ISOLATE_CELLS_PER_DAY; i += 1) {
      const n = await rollUpEvent(() => db, session(), `ip-${i % 9000}`);
      expect(n).toBe(4);
      written += n;
    }
    expect(written).toBe(ROLLUP_ISOLATE_CELLS_PER_DAY);
    expect(await rollUpEvent(() => db, session(), 'ip-new')).toBe(0);
    expect(await rollUpEvent(() => db, session('2026-10-22T00:00:00.000Z'), 'ip-new')).toBe(4);
  });

  it(`tracks at most ${ROLLUP_MAX_CLIENT_KEYS} client keys an hour, so memory stays bounded`, async () => {
    // A Db with room to spare, so only the key limit is under test.
    const roomy = { rollupRows: () => Promise.resolve([]), addRollups: () => Promise.resolve(0) } as unknown as MemoryDb;
    for (let i = 0; i < ROLLUP_MAX_CLIENT_KEYS; i += 1) await rollUpEvent(() => roomy, { name: 'exp.exposure', payload: SAMPLES['exp.exposure'], receivedAt: AT }, `ip-${i}`);
    expect(await rollUpEvent(() => roomy, goal(), 'ip-late')).toBe(0);
    expect(await rollUpEvent(() => roomy, goal(), 'ip-0')).toBe(1);
    expect(await rollUpEvent(() => roomy, goal('2026-10-21T13:00:00.000Z'), 'ip-late')).toBe(1);
  });

  it('keys an IPv6 caller by its /64, so rotating addresses inside one network shares one budget', async () => {
    expect(rollupClientKey('203.0.113.9')).toBe('203.0.113.9');
    expect(rollupClientKey('2001:0db8:0001:0002:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64');
    expect(rollupClientKey('2001:db8:1:2::1')).toBe('2001:db8:1:2::/64');
    expect(rollupClientKey('2001:DB8::1')).toBe('2001:db8:0:0::/64');
    expect(rollupClientKey('::1')).toBe('0:0:0:0::/64');
    expect(rollupClientKey('fe80::')).toBe('fe80:0:0:0::/64');
    expect(rollupClientKey('::ffff:192.0.2.1')).toBe('::ffff:192.0.2.1');
    expect(rollupClientKey('anonymous')).toBe('anonymous');
    for (let i = 0; i < ROLLUP_CLIENT_DAILY_EVENTS; i += 1) expect(await rollUpEvent(() => db, goal(), `2001:db8:1:2::${(i + 1).toString(16)}`)).toBe(1);
    expect(await rollUpEvent(() => db, goal(), '2001:db8:1:2:ffff::9')).toBe(0);
    expect(await rollUpEvent(() => db, goal(), '2001:db8:1:3::1')).toBe(1);
  });

  it(`stops every isolate once the day's counter reaches ${ROLLUP_GLOBAL_ROWS_PER_DAY} rows (its share of the D1 guardrail of section 3.3)`, async () => {
    // Other isolates already wrote all but 10 rows of the day's budget.
    const filler = Array.from({ length: ROLLUP_GLOBAL_ROWS_PER_DAY - 11 }, (_, i) => ({ metric: 'filler', dim: '', bucket: String(i) }));
    expect(await db.addRollups(DAY, filler, ROLLUP_BUDGET_METRIC)).toBe(ROLLUP_GLOBAL_ROWS_PER_DAY - 10);
    let written = 0;
    for (let i = 0; i < 200; i += 1) written += await rollUpEvent(() => db, session(), `ip-${i}`);
    // Two sessions (5 rows each) fit; the second reaches the cap.
    expect(written).toBe(8);
    expect((await db.rollupRows(DAY, DAY, ROLLUP_BUDGET_METRIC, 10))[0]?.events).toBe(ROLLUP_GLOBAL_ROWS_PER_DAY);
    // Once the cap is seen, the isolate never asks the Db again that day.
    const spy = { rollupRows: () => Promise.reject(new Error('asked again')), addRollups: () => Promise.reject(new Error('wrote')) } as unknown as MemoryDb;
    expect(await rollUpEvent(() => spy, session(), 'ip-y')).toBe(0);
    expect(await rollUpEvent(() => db, session('2026-10-22T00:00:00.000Z'), 'ip-x')).toBe(4);
    expect(cappedDays(await db.rollupRows(DAY, '2026-10-22', ROLLUP_BUDGET_METRIC, 10))).toEqual([DAY]);
  });

  it('an event of a day the isolate has left never reads or writes for that day, and the new day reads its counter once', async () => {
    let release: (rows: RollupRow[]) => void = () => undefined;
    let reads = 0;
    const slow = {
      rollupRows: () => {
        reads += 1;
        return new Promise<RollupRow[]>((r) => (release = r));
      },
      addRollups: () => Promise.reject(new Error('wrote for a day the isolate left')),
    } as unknown as MemoryDb;
    const stale = rollUpEvent(() => slow, goal(), 'ip-1');
    await Promise.resolve();
    expect(reads).toBe(1);
    const counted = { reads: 0 };
    const next = {
      rollupRows: (...args: Parameters<MemoryDb['rollupRows']>) => {
        counted.reads += 1;
        return db.rollupRows(...args);
      },
      addRollups: (...args: Parameters<MemoryDb['addRollups']>) => db.addRollups(...args),
    } as unknown as MemoryDb;
    const a = rollUpEvent(() => next, goal('2026-10-22T00:00:00.000Z'), 'ip-1');
    const b = rollUpEvent(() => next, goal('2026-10-22T00:00:01.000Z'), 'ip-2');
    release([]);
    expect(await Promise.all([stale, a, b])).toEqual([0, 1, 1]);
    expect(reads).toBe(1);
    expect(counted.reads).toBe(1);
    expect(await cells(db)).toEqual([]);
    expect((await db.rollupRows('2026-10-22', '2026-10-22', ROLLUP_BUDGET_METRIC, 10))[0]?.events).toBe(4);
  });
});

describe('readRollups: small groups are hidden', () => {
  let db: MemoryDb;
  beforeEach(() => {
    db = new MemoryDb();
  });

  async function add(day: string, metric: string, dim: string, bucket: string, times: number) {
    for (let i = 0; i < times; i += 1) await db.addRollups(day, [{ metric, dim, bucket }]);
  }

  it(`hides any cell with fewer than ${MIN_GROUP_EVENTS} events on its day, and shows ${MIN_GROUP_EVENTS} or more`, async () => {
    expect(MIN_GROUP_EVENTS).toBe(20);
    await add(DAY, 'goal.met', '', '3', 19);
    await add(DAY, 'goal.met', '', '6', 20);
    await add(DAY, 'goal.met', '', '10', 1);
    await add('2026-10-20', 'goal.met', '', '3', 25);
    expect(await readRollups(db, { fromDay: '2026-10-20', toDay: DAY })).toEqual([
      { day: '2026-10-20', metric: 'goal.met', dim: '', bucket: '3', events: 25 },
      { day: DAY, metric: 'goal.met', dim: '', bucket: '6', events: 20 },
    ]);
  });

  it('applies suppression per day: 10 a day for 3 days is still hidden', async () => {
    for (const day of ['2026-10-19', '2026-10-20', DAY]) await add(day, 'stage.card_opened', 'stage2', '', 10);
    expect(await readRollups(db, { fromDay: '2026-10-19', toDay: DAY })).toEqual([]);
  });

  it('complementary suppression: a hidden game kind cannot be worked out as the total minus the visible kinds', async () => {
    await add(DAY, 'session.end.questLeft', '', '1', 100);
    await add(DAY, 'session.end.questLeft', 'order-it', '1', 60);
    await add(DAY, 'session.end.questLeft', 'listen-pick', '1', 35);
    await add(DAY, 'session.end.questLeft', 'tile-match', '1', 5);
    const rows = await readRollups(db, { fromDay: DAY, toDay: DAY });
    // tile-match (5) is hidden, and so is the smallest visible kind (listen-pick), so neither can be derived
    expect(rows.map((r) => `${r.dim}:${r.events}`)).toEqual([':100', 'order-it:60']);
  });

  it('complementary suppression: arms are grouped by experiment, with the overall total', async () => {
    await add(DAY, 'memory.daily.durableWeek', '', '5-9', 60);
    await add(DAY, 'memory.daily.durableWeek', 'E1:a', '5-9', 50);
    await add(DAY, 'memory.daily.durableWeek', 'E1:b', '5-9', 10);
    await add(DAY, 'memory.daily.durableWeek', 'E2:a', '5-9', 30);
    await add(DAY, 'memory.daily.durableWeek', 'E2:b', '5-9', 30);
    const rows = suppressSmallGroups(await db.rollupRows(DAY, DAY, undefined, 100));
    // E1:b is hidden, so E1:a goes too; E2 is untouched. The total stays: the two E1 arms sum to it, but not each.
    expect(rows.map((r) => r.dim)).toEqual(['', 'E2:a', 'E2:b']);
  });

  it('complementary suppression across buckets: one hidden bucket takes the smallest visible bucket with it', async () => {
    // durableWeek's buckets sum to the memory.daily events of the day, which dueVolume also gives
    await add(DAY, 'memory.daily.durableWeek', '', '0', 40);
    await add(DAY, 'memory.daily.durableWeek', '', '1', 25);
    await add(DAY, 'memory.daily.durableWeek', '', '2', 3);
    await add(DAY, 'memory.daily.dueVolume', '', '10-19', 68);
    const rows = await readRollups(db, { fromDay: DAY, toDay: DAY });
    expect(rows.map((r) => `${r.metric}:${r.bucket}`)).toEqual(['memory.daily.dueVolume:10-19', 'memory.daily.durableWeek:0']);
  });

  it('counts events, not profiles, for names a profile sends many times: 20 sessions of one profile show', async () => {
    // Documented: only ONCE_A_DAY_ROLLUP_NAMES count profile-days; readers label the rest as events.
    rollupBudget.reset();
    for (let i = 0; i < 20; i += 1) await rollUpEvent(() => db, session(), 'one-profile-device');
    const rows = await readRollups(db, { fromDay: DAY, toDay: DAY, metric: 'session.end.minutes' });
    expect(rows).toEqual([{ day: DAY, metric: 'session.end.minutes', dim: '', bucket: '12', events: 20 }]);
    expect(ONCE_A_DAY_ROLLUP_NAMES).not.toContain('session.end');
  });

  it('filters by metric and refuses a day that is not YYYY-MM-DD', async () => {
    await add(DAY, 'goal.met', '', '3', 20);
    await add(DAY, 'week.goal_met', '', '5', 20);
    expect(await readRollups(db, { fromDay: DAY, toDay: DAY, metric: 'week.goal_met' })).toEqual([{ day: DAY, metric: 'week.goal_met', dim: '', bucket: '5', events: 20 }]);
    await expect(readRollups(db, { fromDay: '21/10/2026', toDay: DAY })).rejects.toThrow(RangeError);
    await expect(readRollups(db, { fromDay: DAY, toDay: "2026-10-21' OR 1=1" })).rejects.toThrow(RangeError);
  });

  it(`refuses a read of more than ${ROLLUP_READ_LIMIT} rows instead of suppressing a partial day`, async () => {
    const wide = {
      rollupRows: (_f: string, _t: string, _m: string | undefined, limit: number) => Promise.resolve(Array.from({ length: limit }, () => ({ day: DAY, metric: 'm', dim: '', bucket: '', events: 30 }))),
    } as unknown as MemoryDb;
    await expect(readRollups(wide, { fromDay: DAY, toDay: DAY })).rejects.toThrow(/too many rollup rows/);
  });
});
