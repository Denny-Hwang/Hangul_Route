import { TELEMETRY_EVENT_NAMES } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryDb } from '../../db';
import {
  MAX_ROLLUP_ROWS_PER_EVENT,
  MIN_GROUP_EVENTS,
  ROLLUP_CLIENT_LIMIT,
  ROLLUP_EVENT_NAMES,
  minutesBucket,
  rateBucket,
  readRollups,
  rollUpEvent,
  rollupKeysFor,
  rollupLimiter,
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
    expect(rollupKeysFor('pack.opened', SAMPLES['pack.opened'])).toEqual([{ metric: 'pack.opened', dim: 'pack:numbers-time', bucket: '' }]);
    expect(rollupKeysFor('pack.level_complete', SAMPLES['pack.level_complete'])).toEqual([{ metric: 'pack.level_complete', dim: 'pack:numbers-time', bucket: 'stage2' }]);
    expect(rollupKeysFor('exp.exposure', SAMPLES['exp.exposure'])).toEqual([{ metric: 'exp.exposure', dim: 'E3:b', bucket: '' }]);
  });

  it('memory.daily: north star, due volume, recall per lag bucket and the north star per arm', () => {
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
      { metric: 'memory.daily.dueVolume', dim: '', bucket: '20-29' },
      // 8 right of 10 at 4-7 days; 8-14 had no answers, so no cell; 1 of 4 at 31+
      { metric: 'memory.daily.recallLag', dim: '4-7', bucket: '80-89' },
      { metric: 'memory.daily.recallLag', dim: '31+', bucket: '0-49' },
      { metric: 'memory.daily.durableWeekByArm', dim: 'E2:b', bucket: '10-19' },
    ]);
  });

  it(`never touches more than ${MAX_ROLLUP_ROWS_PER_EVENT} rows, even for the widest payload`, () => {
    for (const [name, payload] of Object.entries(SAMPLES)) {
      const keys = rollupKeysFor(name, payload);
      expect(keys.length, name).toBeGreaterThan(0);
      expect(keys.length, name).toBeLessThanOrEqual(MAX_ROLLUP_ROWS_PER_EVENT);
    }
    expect(rollupKeysFor('memory.daily', FULL_MEMORY_DAILY)).toHaveLength(12);
    expect(MAX_ROLLUP_ROWS_PER_EVENT).toBe(12);
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

describe('rollUpEvent', () => {
  let db: MemoryDb;
  beforeEach(async () => {
    db = new MemoryDb();
    rollupLimiter.reset();
  });

  it('adds 1 per cell on the UTC day of ingest and answers the rows touched', async () => {
    expect(await rollUpEvent(() => db, { name: 'goal.met', payload: SAMPLES['goal.met'], receivedAt: AT }, 'ip-1')).toBe(1);
    expect(await rollUpEvent(() => db, { name: 'goal.met', payload: SAMPLES['goal.met'], receivedAt: '2026-10-21T23:59:59.999Z' }, 'ip-1')).toBe(1);
    expect(await rollUpEvent(() => db, { name: 'goal.met', payload: SAMPLES['goal.met'], receivedAt: '2026-10-22T00:00:00.000Z' }, 'ip-1')).toBe(1);
    expect(await db.rollupRows('2026-10-01', '2026-10-31')).toEqual([
      { day: DAY, metric: 'goal.met', dim: '', bucket: '6', events: 2 },
      { day: '2026-10-22', metric: 'goal.met', dim: '', bucket: '6', events: 1 },
    ]);
  });

  it('writes nothing for a name off the allowlist and never asks for the Db', async () => {
    const never = () => {
      throw new Error('Db asked for');
    };
    expect(await rollUpEvent(never, { name: 'quest.start', payload: { questId: 'quest:stage1-letters-q1' }, receivedAt: AT }, 'ip-1')).toBe(0);
  });

  it('a failing write (no table yet, no binding) is swallowed: the event is never failed by its rollup', async () => {
    const broken = {
      addRollups: () => Promise.reject(new Error('no such table: learning_rollups')),
    } as unknown as MemoryDb;
    expect(await rollUpEvent(() => broken, { name: 'goal.met', payload: SAMPLES['goal.met'], receivedAt: AT }, 'ip-1')).toBe(0);
    expect(
      await rollUpEvent(
        () => {
          throw new Error('db_not_configured');
        },
        { name: 'goal.met', payload: SAMPLES['goal.met'], receivedAt: AT },
        'ip-1',
      ),
    ).toBe(0);
  });

  it(`stops rolling up a client after ${ROLLUP_CLIENT_LIMIT} events an hour, so one caller cannot spend the D1 write quota`, async () => {
    for (let i = 0; i < ROLLUP_CLIENT_LIMIT; i += 1) await rollUpEvent(() => db, { name: 'goal.met', payload: SAMPLES['goal.met'], receivedAt: AT }, 'ip-busy');
    expect(await rollUpEvent(() => db, { name: 'goal.met', payload: SAMPLES['goal.met'], receivedAt: AT }, 'ip-busy')).toBe(0);
    expect(await rollUpEvent(() => db, { name: 'goal.met', payload: SAMPLES['goal.met'], receivedAt: AT }, 'ip-other')).toBe(1);
    expect(await db.rollupRows(DAY, DAY)).toEqual([{ day: DAY, metric: 'goal.met', dim: '', bucket: '6', events: ROLLUP_CLIENT_LIMIT + 1 }]);
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

  it('filters by metric and refuses a day that is not YYYY-MM-DD', async () => {
    await add(DAY, 'goal.met', '', '3', 20);
    await add(DAY, 'week.goal_met', '', '5', 20);
    expect(await readRollups(db, { fromDay: DAY, toDay: DAY, metric: 'week.goal_met' })).toEqual([{ day: DAY, metric: 'week.goal_met', dim: '', bucket: '5', events: 20 }]);
    await expect(readRollups(db, { fromDay: '21/10/2026', toDay: DAY })).rejects.toThrow(RangeError);
    await expect(readRollups(db, { fromDay: DAY, toDay: "2026-10-21' OR 1=1" })).rejects.toThrow(RangeError);
  });
});
