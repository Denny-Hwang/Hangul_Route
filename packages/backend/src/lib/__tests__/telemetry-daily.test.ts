import { TELEMETRY_DAILY_KEEP_DAYS, TELEMETRY_EVENT_NAMES } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryDb, type Db } from '../../db';
import { OA_PAYLOAD_RULES } from '../server-events';
import {
  TELEMETRY_DAILY_PURGE_LIMIT,
  TELEMETRY_DAILY_WRITES_PER_MIN,
  countTelemetryDaily,
  dailyDims,
  isDailyCountedName,
  purgeTelemetryDailyStep,
  resetTelemetryDailyBudgetForTests,
  takeDailyWrite,
  telemetryDailyEnabled,
  utcDay,
} from '../telemetry-daily';

/**
 * [OA] Anonymous daily counters (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 15.1): who is counted, the dims, the
 * switch, the per-isolate budget, the best-effort write and the 400-day purge step.
 */
const NOW = Date.parse('2026-10-21T12:00:30.000Z');

beforeEach(() => resetTelemetryDailyBudgetForTests());

describe('telemetryDailyEnabled', () => {
  it('is on unless the Worker variable names another value', () => {
    expect(telemetryDailyEnabled(undefined)).toBe(true);
    expect(telemetryDailyEnabled({})).toBe(true);
    expect(telemetryDailyEnabled({ TELEMETRY_DAILY: '' })).toBe(true);
    expect(telemetryDailyEnabled({ TELEMETRY_DAILY: 'enabled' })).toBe(true);
    for (const off of ['disabled', 'off', 'false', 'Enabled']) expect(telemetryDailyEnabled({ TELEMETRY_DAILY: off }), off).toBe(false);
  });
});

describe('isDailyCountedName', () => {
  it('counts the section 15 names and session.start, nothing else', () => {
    const counted = TELEMETRY_EVENT_NAMES.filter(isDailyCountedName);
    expect([...counted].sort()).toEqual(['session.start', ...Object.keys(OA_PAYLOAD_RULES)].sort());
    expect(isDailyCountedName('constructor')).toBe(false);
    expect(isDailyCountedName('quest.complete')).toBe(false);
  });
});

describe('dailyDims', () => {
  it('is canonical JSON with sorted keys, or empty', () => {
    expect(dailyDims('who.shown', { trigger: 'launch', anyLocked: false, grownUps: 1 })).toBe('{"anyLocked":false,"grownUps":1,"trigger":"launch"}');
    expect(dailyDims('who.shown', { grownUps: 1, trigger: 'launch', anyLocked: false })).toBe(dailyDims('who.shown', { trigger: 'launch', anyLocked: false, grownUps: 1 }));
    expect(dailyDims('who.picked', undefined)).toBe('');
    expect(dailyDims('who.picked', {})).toBe('');
    expect(dailyDims('session.start', { source: 'pwa' })).toBe('');
  });
});

describe('utcDay', () => {
  it('is the UTC date of the time', () => {
    expect(utcDay('2026-10-21T23:59:59.999Z')).toBe('2026-10-21');
    expect(utcDay('2026-10-22T00:00:00.000Z')).toBe('2026-10-22');
  });
});

describe('takeDailyWrite (per-isolate budget)', () => {
  it('allows TELEMETRY_DAILY_WRITES_PER_MIN writes per wall-clock minute, then none until the next minute', () => {
    expect(TELEMETRY_DAILY_WRITES_PER_MIN).toBe(600);
    for (let i = 0; i < 600; i += 1) expect(takeDailyWrite(NOW)).toBe(true);
    expect(takeDailyWrite(NOW)).toBe(false);
    expect(takeDailyWrite(NOW + 29_000)).toBe(false);
    expect(takeDailyWrite(NOW + 30_000)).toBe(true);
  });
});

describe('countTelemetryDaily', () => {
  const event = { name: 'who.picked', payload: { kind: 'learner' }, at: '2026-10-21T08:00:00.000Z' };

  it('adds one per counted event, by day, name and dims', async () => {
    const db = new MemoryDb();
    expect(await countTelemetryDaily(() => db, undefined, event, NOW)).toBe(true);
    expect(await countTelemetryDaily(() => db, undefined, event, NOW)).toBe(true);
    expect(await countTelemetryDaily(() => db, undefined, { ...event, payload: { kind: 'add' } }, NOW)).toBe(true);
    expect(await countTelemetryDaily(() => db, undefined, { name: 'session.start', payload: { a: 1 }, at: event.at }, NOW)).toBe(true);
    expect(await db.telemetryDailyOf('2026-10-21')).toEqual([
      { day: '2026-10-21', name: 'session.start', dims: '', n: 1 },
      { day: '2026-10-21', name: 'who.picked', dims: '{"kind":"add"}', n: 1 },
      { day: '2026-10-21', name: 'who.picked', dims: '{"kind":"learner"}', n: 2 },
    ]);
  });

  it('adds nothing when off, for a name that is not counted, or past the budget', async () => {
    const db = new MemoryDb();
    expect(await countTelemetryDaily(() => db, { TELEMETRY_DAILY: 'disabled' }, event, NOW)).toBe(false);
    expect(await countTelemetryDaily(() => db, undefined, { ...event, name: 'quest.complete' }, NOW)).toBe(false);
    for (let i = 0; i < TELEMETRY_DAILY_WRITES_PER_MIN; i += 1) takeDailyWrite(NOW);
    expect(await countTelemetryDaily(() => db, undefined, event, NOW)).toBe(false);
    expect(await db.telemetryDailyOf('2026-10-21')).toEqual([]);
  });

  it('off reads nothing, not even the Db', async () => {
    let asked = 0;
    const db = (): Db => {
      asked += 1;
      return new MemoryDb();
    };
    await countTelemetryDaily(db, { TELEMETRY_DAILY: 'disabled' }, event, NOW);
    expect(asked).toBe(0);
  });

  it('never throws: a missing Db or a failed write answers false', async () => {
    const missing = (): Db => {
      throw new Error('db_not_configured');
    };
    expect(await countTelemetryDaily(missing, undefined, event, NOW)).toBe(false);
    const failing = new MemoryDb();
    failing.addTelemetryDaily = async () => {
      throw new Error('no such table: telemetry_daily');
    };
    expect(await countTelemetryDaily(() => failing, undefined, event, NOW)).toBe(false);
  });
});

describe('purgeTelemetryDailyStep', () => {
  it('removes days older than 400 days, at most 200 a step', async () => {
    expect(TELEMETRY_DAILY_KEEP_DAYS).toBe(400);
    expect(TELEMETRY_DAILY_PURGE_LIMIT).toBe(200);
    const db = new MemoryDb();
    const now = new Date('2026-10-21T11:17:00.000Z');
    // 2026-10-21 minus 400 days is 2025-09-16: that day stays, the day before goes.
    await db.addTelemetryDaily('2025-09-16', 'who.shown', '');
    await db.addTelemetryDaily('2025-09-15', 'who.shown', '');
    await db.addTelemetryDaily('2026-10-21', 'who.shown', '');
    expect(await purgeTelemetryDailyStep(db, now)).toBe(1);
    expect(await db.telemetryDailyOf('2025-09-16')).toHaveLength(1);
    expect(await db.telemetryDailyOf('2025-09-15')).toEqual([]);
    for (let i = 0; i < 250; i += 1) await db.addTelemetryDaily('2024-01-01', 'who.picked', `{"n":${i}}`);
    expect(await purgeTelemetryDailyStep(db, now)).toBe(200);
    expect(await purgeTelemetryDailyStep(db, now)).toBe(50);
    expect(await purgeTelemetryDailyStep(db, now)).toBe(0);
  });

  it('a failure removes nothing and never throws', async () => {
    const db = new MemoryDb();
    db.purgeTelemetryDaily = async () => {
      throw new Error('no such table: telemetry_daily');
    };
    expect(await purgeTelemetryDailyStep(db, new Date())).toBe(0);
  });
});
