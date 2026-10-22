import { TELEMETRY_DAILY_KEEP_DAYS, TELEMETRY_EVENT_NAMES } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryDb, type Db } from '../../db';
import { GUEST_PAYLOAD_RULES, OA_PAYLOAD_RULES } from '../server-events';
import {
  ONBOARDING_STARTED_DIM_KEYS,
  TELEMETRY_DAILY_PURGE_LIMIT,
  TELEMETRY_DAILY_WINDOW_MS,
  TELEMETRY_DAILY_WRITES_PER_DAY,
  TELEMETRY_DAILY_WRITES_PER_MIN,
  countTelemetryDaily,
  dailyDims,
  flushTelemetryDaily,
  holdDailyCount,
  isDailyCountedName,
  purgeTelemetryDailyStep,
  resetTelemetryDailyBudgetForTests,
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
  it('counts the section 15 names, session.start, [GU] the guest.* names and onboarding.started, nothing else', () => {
    const counted = TELEMETRY_EVENT_NAMES.filter(isDailyCountedName);
    expect([...counted].sort()).toEqual(['session.start', 'onboarding.started', ...Object.keys(OA_PAYLOAD_RULES), ...Object.keys(GUEST_PAYLOAD_RULES)].sort());
    for (const name of ['guest.started', 'guest.first_letter', 'guest.quest_done', 'guest.left', 'guest.saved', 'guest.expired', 'onboarding.started']) expect(isDailyCountedName(name), name).toBe(true);
    expect(isDailyCountedName('guest.peeked')).toBe(false);
    expect(isDailyCountedName('onboarding.consent_given')).toBe(false);
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

  it('[GU] onboarding.started keeps only boolean firstRun and fromGuest as dims', () => {
    expect(ONBOARDING_STARTED_DIM_KEYS).toEqual(['firstRun', 'fromGuest']);
    expect(dailyDims('onboarding.started', { level: '8-9', firstRun: true, hasEmail: false, fromGuest: true })).toBe('{"firstRun":true,"fromGuest":true}');
    expect(dailyDims('onboarding.started', { fromGuest: false, hasEmail: true, firstRun: false, level: '15+' })).toBe('{"firstRun":false,"fromGuest":false}');
    // An older client sends no fromGuest; a non-boolean value is never a dim.
    expect(dailyDims('onboarding.started', { level: '8-9', firstRun: true, hasEmail: false })).toBe('{"firstRun":true}');
    expect(dailyDims('onboarding.started', { firstRun: 'profile:a', fromGuest: 1, name: 'Mina' })).toBe('');
    expect(dailyDims('onboarding.started', undefined)).toBe('');
  });

  it('[GU] a guest.* count keeps the payload the rules kept', () => {
    expect(dailyDims('guest.saved', { via: 'results', gated: false, consent: 'new' })).toBe('{"consent":"new","gated":false,"via":"results"}');
    expect(dailyDims('guest.started', { via: 'site', resumed: false })).toBe('{"resumed":false,"via":"site"}');
  });
});

describe('utcDay', () => {
  it('is the UTC date of the time', () => {
    expect(utcDay('2026-10-21T23:59:59.999Z')).toBe('2026-10-21');
    expect(utcDay('2026-10-22T00:00:00.000Z')).toBe('2026-10-22');
  });
});

describe('countTelemetryDaily', () => {
  const event = { name: 'who.picked', payload: { kind: 'learner' }, at: '2026-10-21T08:00:00.000Z' };
  const MIN = TELEMETRY_DAILY_WINDOW_MS;

  it('writes each count through at once, by day, name and dims', async () => {
    expect(TELEMETRY_DAILY_WINDOW_MS).toBe(60_000);
    const db = new MemoryDb();
    const add = vi.spyOn(db, 'addTelemetryDaily');
    expect(await countTelemetryDaily(() => db, undefined, event, NOW)).toBe(1);
    expect(await countTelemetryDaily(() => db, undefined, event, NOW + 1_000)).toBe(1);
    expect(await countTelemetryDaily(() => db, undefined, { ...event, payload: { kind: 'add' } }, NOW + 2_000)).toBe(1);
    expect(await countTelemetryDaily(() => db, undefined, { name: 'session.start', payload: { a: 1 }, at: event.at }, NOW + 3_000)).toBe(1);
    expect(add).toHaveBeenCalledTimes(4);
    expect(await db.telemetryDailyOf('2026-10-21')).toEqual([
      { day: '2026-10-21', name: 'session.start', dims: '', n: 1 },
      { day: '2026-10-21', name: 'who.picked', dims: '{"kind":"add"}', n: 1 },
      { day: '2026-10-21', name: 'who.picked', dims: '{"kind":"learner"}', n: 2 },
    ]);
    // Nothing held: a flush asks nothing of the Db.
    expect(await flushTelemetryDaily(() => db, NOW + 10 * MIN)).toBe(0);
    expect(add).toHaveBeenCalledTimes(4);
  });

  it('a short burst in a fresh isolate that then ends loses nothing: who.shown and the who.picked after it both land', async () => {
    const db = new MemoryDb();
    await countTelemetryDaily(() => db, undefined, { name: 'who.shown', payload: { trigger: 'launch' }, at: event.at }, NOW);
    await countTelemetryDaily(() => db, undefined, { name: 'who.picked', payload: { kind: 'learner' }, at: event.at }, NOW + 2_000);
    // No later request: the isolate is evicted here. Everything it counted is already written.
    expect(await db.telemetryDailyOf('2026-10-21')).toEqual([
      { day: '2026-10-21', name: 'who.picked', dims: '{"kind":"learner"}', n: 1 },
      { day: '2026-10-21', name: 'who.shown', dims: '{"trigger":"launch"}', n: 1 },
    ]);
    resetTelemetryDailyBudgetForTests();
    expect(await flushTelemetryDaily(() => db, NOW + 3_000)).toBe(0);
  });

  it('counts nothing when off, for a name that is not counted, or for a new row past the 600 held', async () => {
    expect(TELEMETRY_DAILY_WRITES_PER_MIN).toBe(600);
    expect(holdDailyCount({ TELEMETRY_DAILY: 'disabled' }, event)).toBe(false);
    expect(holdDailyCount(undefined, { ...event, name: 'quest.complete' })).toBe(false);
    for (let i = 0; i < TELEMETRY_DAILY_WRITES_PER_MIN; i += 1) expect(holdDailyCount(undefined, { ...event, payload: { i } })).toBe(true);
    expect(holdDailyCount(undefined, event)).toBe(false);
    // A held row still adds, at no write cost.
    expect(holdDailyCount(undefined, { ...event, payload: { i: 7 } })).toBe(true);
    const db = new MemoryDb();
    expect(await flushTelemetryDaily(() => db, NOW)).toBe(600);
    const rows = await db.telemetryDailyOf('2026-10-21');
    expect(rows).toHaveLength(600);
    expect(rows.find((r) => r.dims === '{"i":7}')?.n).toBe(2);
    expect(rows.some((r) => r.dims === '{"kind":"learner"}')).toBe(false);
  });

  it('past the minute window\'s 600 rows, counts are held and summed, and written when the next window opens', async () => {
    const db = new MemoryDb();
    const add = vi.spyOn(db, 'addTelemetryDaily');
    for (let i = 0; i < TELEMETRY_DAILY_WRITES_PER_MIN; i += 1) await countTelemetryDaily(() => db, undefined, { ...event, payload: { i } }, NOW + i);
    expect(add).toHaveBeenCalledTimes(TELEMETRY_DAILY_WRITES_PER_MIN);
    // The window is spent: these are held (the second adds to the first), and nothing is asked of the Db.
    expect(await countTelemetryDaily(() => db, undefined, { ...event, payload: { held: 1 } }, NOW + 1_000)).toBe(0);
    expect(await countTelemetryDaily(() => db, undefined, { ...event, payload: { held: 1 } }, NOW + 2_000)).toBe(0);
    expect(await countTelemetryDaily(() => db, undefined, { ...event, payload: { held: 2 } }, NOW + MIN - 1)).toBe(0);
    expect(add).toHaveBeenCalledTimes(TELEMETRY_DAILY_WRITES_PER_MIN);
    // The next window: the held rows and the new count go in one write.
    expect(await countTelemetryDaily(() => db, undefined, event, NOW + MIN)).toBe(3);
    expect(add).toHaveBeenCalledTimes(TELEMETRY_DAILY_WRITES_PER_MIN + 1);
    const rows = await db.telemetryDailyOf('2026-10-21');
    expect(rows.find((r) => r.dims === '{"held":1}')?.n).toBe(2);
    expect(rows.find((r) => r.dims === '{"held":2}')?.n).toBe(1);
    expect(rows.find((r) => r.dims === '{"kind":"learner"}')?.n).toBe(1);
  });

  it('a flood of 10,000 events with new dims writes at most 600 rows a minute and 5,000 a UTC day', async () => {
    expect(TELEMETRY_DAILY_WRITES_PER_DAY).toBe(5_000);
    const db = new MemoryDb();
    const add = vi.spyOn(db, 'addTelemetryDaily');
    const writtenAt: Array<[number, number]> = [];
    let clock = 0;
    add.mockImplementation(async (rows) => {
      writtenAt.push([clock, rows.length]);
      await MemoryDb.prototype.addTelemetryDaily.call(db, rows);
    });
    // 10,000 events over 10 minutes, then one event a minute for an hour: 10,060 rows were asked for.
    for (let i = 0; i < 10_000; i += 1) {
      clock = NOW + Math.floor(i * (10 * MIN / 10_000));
      await countTelemetryDaily(() => db, undefined, { ...event, payload: { i } }, clock);
    }
    for (let m = 10; m < 70; m += 1) {
      clock = NOW + m * MIN;
      await countTelemetryDaily(() => db, undefined, { ...event, payload: { m } }, clock);
    }
    const total = writtenAt.reduce((a, [, n]) => a + n, 0);
    expect(total).toBe(TELEMETRY_DAILY_WRITES_PER_DAY);
    // Each one-minute window (opened by the first write a minute or more after the last window opened) holds at
    // most 600 written rows, and the flood spends the day's budget in about nine windows, not at once.
    const windows: number[] = [];
    let opened = Number.NEGATIVE_INFINITY;
    for (const [t, n] of writtenAt) {
      if (t - opened >= MIN) {
        opened = t;
        windows.push(0);
      }
      windows[windows.length - 1] += n;
    }
    expect(Math.max(...windows)).toBeLessThanOrEqual(TELEMETRY_DAILY_WRITES_PER_MIN);
    expect(windows.length).toBeGreaterThanOrEqual(Math.ceil(TELEMETRY_DAILY_WRITES_PER_DAY / TELEMETRY_DAILY_WRITES_PER_MIN));
    // Held counts wait for the next UTC day's budget and keep their own day.
    const tomorrow = Date.parse('2026-10-22T00:00:30.000Z');
    expect(await flushTelemetryDaily(() => db, tomorrow)).toBe(600);
    expect((await db.telemetryDailyOf('2026-10-21')).length).toBe(TELEMETRY_DAILY_WRITES_PER_DAY + 600);
    expect(await db.telemetryDailyOf('2026-10-22')).toEqual([]);
  });

  it('off holds nothing, writes nothing and never asks for the Db', async () => {
    let asked = 0;
    const db = (): Db => {
      asked += 1;
      return new MemoryDb();
    };
    expect(await countTelemetryDaily(db, { TELEMETRY_DAILY: 'disabled' }, event, NOW)).toBe(0);
    expect(asked).toBe(0);
    expect(await flushTelemetryDaily(db, NOW + MIN)).toBe(0);
    expect(asked).toBe(0);
  });

  it('never throws: a missing Db or a failed write answers 0 and drops what it took (never retried)', async () => {
    const missing = (): Db => {
      throw new Error('db_not_configured');
    };
    expect(await countTelemetryDaily(missing, undefined, event, NOW)).toBe(0);
    const failing = new MemoryDb();
    const add = vi.spyOn(failing, 'addTelemetryDaily').mockRejectedValue(new Error('no such table: telemetry_daily'));
    expect(await countTelemetryDaily(() => failing, undefined, event, NOW + MIN)).toBe(0);
    expect(add).toHaveBeenCalledTimes(1);
    expect(await flushTelemetryDaily(() => failing, NOW + 2 * MIN)).toBe(0);
    expect(add).toHaveBeenCalledTimes(1);
  });
});

describe('purgeTelemetryDailyStep', () => {
  it('removes days older than 400 days, at most 200 a step', async () => {
    expect(TELEMETRY_DAILY_KEEP_DAYS).toBe(400);
    expect(TELEMETRY_DAILY_PURGE_LIMIT).toBe(200);
    const db = new MemoryDb();
    const now = new Date('2026-10-21T11:17:00.000Z');
    // 2026-10-21 minus 400 days is 2025-09-16: that day stays, the day before goes.
    await db.addTelemetryDaily([{ day: '2025-09-16', name: 'who.shown', dims: '', n: 1 }]);
    await db.addTelemetryDaily([{ day: '2025-09-15', name: 'who.shown', dims: '', n: 1 }]);
    await db.addTelemetryDaily([{ day: '2026-10-21', name: 'who.shown', dims: '', n: 1 }]);
    expect(await purgeTelemetryDailyStep(db, now)).toBe(1);
    expect(await db.telemetryDailyOf('2025-09-16')).toHaveLength(1);
    expect(await db.telemetryDailyOf('2025-09-15')).toEqual([]);
    for (let i = 0; i < 250; i += 1) await db.addTelemetryDaily([{ day: '2024-01-01', name: 'who.picked', dims: `{"n":${i}}`, n: 1 }]);
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
