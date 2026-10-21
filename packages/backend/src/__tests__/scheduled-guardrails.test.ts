import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { D1Db, type Db, type RemoteConfigRow } from '../db';
import type { D1Like, D1PreparedLike } from '../db/d1';
import { scheduled } from '../index';
import { GUARDRAIL_METRICS, MAX_GUARDRAIL_LOWERS } from '../lib/guardrail-evaluator';
import { ROLLUP_BUDGET_METRIC, rollupKeysFor } from '../lib/learning-rollups';
import { NOTE_PURGE_LIMIT, SCHEDULED_PURGE_ROUNDS } from '../lib/note-retention';
import { testDb as db } from './helpers/db';
import { openSqliteD1 } from './helpers/sqlite';

/**
 * The guardrail evaluator inside the Worker's daily Cron Trigger (F-CURR-002 section 12.3, row CM-70b), on the
 * backend the suites run against (memory, or the real migrations with HR_TEST_DB=sqlite), and on D1 with every
 * statement counted. The rules themselves are `lib/__tests__/guardrail-evaluator.test.ts`.
 */
const NOW = Date.parse('2026-10-21T11:17:00.000Z');
const KIND = 'match-shape';
const ramp = (over: Partial<RemoteConfigRow> = {}): RemoteConfigRow => ({ flag: 'dailyReview', on: true, pct: 50, updatedAt: '2026-10-10T09:00:00.000Z', reason: 'owner ramp 50', ...over });

/** `n` quest sessions on `day`, `quits` of them left mid-quest on KIND, rolled up as POST /api/telemetry does. */
async function sessions(target: Db, day: string, n: number, quits: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await target.addRollups(day, rollupKeysFor('session.end', i < quits ? { questLeft: 1, leftAtKind: KIND } : { questLeft: 0 }));
  }
}

const BEFORE_DAYS = ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'];
const AFTER_DAYS = ['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20'];

/** A before cohort at 20% quits and an after cohort at `afterQuits` of 100 a day, 500 quest sessions each. */
async function cohorts(target: Db, afterQuits: number): Promise<void> {
  for (const day of BEFORE_DAYS) await sessions(target, day, 100, 20);
  for (const day of AFTER_DAYS) await sessions(target, day, 100, afterQuits);
}

async function breach(target: Db, flags: readonly RemoteConfigRow[] = [ramp()]): Promise<void> {
  for (const flag of flags) await target.putRemoteConfig(flag);
  await cohorts(target, 40);
}

const REASON = `guardrail 2026-10-21 base 2026-10-10 pct 50->10: quitRate:${KIND} 20.0%->40.0%`;

/** A D1 binding over the real migrations that counts every statement prepared. */
function countingD1(): { raw: ReturnType<typeof openSqliteD1>; own: D1Db; binding: D1Like; prepared: () => number } {
  const raw = openSqliteD1();
  let prepared = 0;
  const binding: D1Like = {
    prepare(sql: string): D1PreparedLike {
      prepared += 1;
      return raw.prepare(sql);
    },
    batch: (statements) => raw.batch(statements),
  };
  return { raw, own: new D1Db(raw), binding, prepared: () => prepared };
}

beforeEach(async () => {
  await db.reset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('scheduled · guardrail evaluator (CM-70b)', () => {
  it('lowers a breached ramp one step with its reason, and a second run the same day changes nothing', async () => {
    await breach(db);
    const waitUntil = vi.fn();
    await scheduled({ scheduledTime: NOW }, {}, { waitUntil });
    expect(waitUntil).toHaveBeenCalledTimes(1);
    const lowered = [{ flag: 'dailyReview', on: true, pct: 10, updatedAt: new Date(NOW).toISOString(), reason: REASON }];
    expect(await db.remoteConfig()).toEqual(lowered);
    await scheduled({ scheduledTime: NOW + 3_600_000 }, {});
    expect(await db.remoteConfig()).toEqual(lowered);
  });

  it('leaves a healthy ramp as it is', async () => {
    await db.putRemoteConfig(ramp());
    await cohorts(db, 20);
    await scheduled({ scheduledTime: NOW }, {});
    expect(await db.remoteConfig()).toEqual([ramp()]);
  });

  it('logs one guardrail.run line of codes and counts for Workers Logs', async () => {
    await breach(db, [ramp(), ramp({ flag: 'goals', updatedAt: '2026-09-01T00:00:00.000Z' })]);
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await scheduled({ scheduledTime: NOW }, {});
    expect(info).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toEqual({
      event: 'guardrail.run',
      day: '2026-10-21',
      ramping: 2,
      lowered: [{ flag: 'dailyReview', from: 50, to: 10 }],
      kept: [],
      skipped: [{ flag: 'goals', why: 'stale-step' }],
      deferred: [],
    });
  });

  it('runs the retention purge first, so the evaluator never holds it up', async () => {
    await breach(db);
    const order: string[] = [];
    const purge = db.purgeRateHits.bind(db);
    vi.spyOn(db, 'purgeRateHits').mockImplementation(async (...args) => {
      order.push('purge');
      return purge(...args);
    });
    const read = db.remoteConfig.bind(db);
    vi.spyOn(db, 'remoteConfig').mockImplementation(async () => {
      order.push('evaluator');
      return read();
    });
    await scheduled({ scheduledTime: NOW }, {});
    expect(order[0]).toBe('purge');
    expect(order.at(-1)).toBe('evaluator');
  });

  it('an evaluator error still lets the purge run, then fails the run', async () => {
    const boom = new Error('remote_config unreadable');
    vi.spyOn(db, 'remoteConfig').mockRejectedValue(boom);
    const purge = vi.spyOn(db, 'purgeRateHits');
    await expect(scheduled({ scheduledTime: NOW }, {})).rejects.toBe(boom);
    expect(purge).toHaveBeenCalled();
  });

  it('a purge error still lets the evaluator run, then fails the run with the purge error', async () => {
    await breach(db);
    const boom = new Error('purge failed');
    vi.spyOn(db, 'purgeRateHits').mockRejectedValue(boom);
    await expect(scheduled({ scheduledTime: NOW }, {})).rejects.toBe(boom);
    expect((await db.remoteConfig())[0]?.pct).toBe(10);
  });
});

describe('scheduled · guardrail evaluator on D1', () => {
  it('lowers through the conditional UPDATE and stays under the 50 statements a Free-plan invocation allows', async () => {
    const { raw, own, binding, prepared } = countingD1();
    await breach(own);
    await scheduled({ scheduledTime: NOW }, { DB: binding });
    // the purge's 36 at most, then remote_config, learning_rollups and one UPDATE
    expect(prepared()).toBeLessThanOrEqual(36 + 3);
    expect(await own.remoteConfig()).toEqual([{ flag: 'dailyReview', on: true, pct: 10, updatedAt: new Date(NOW).toISOString(), reason: REASON }]);
    raw.close();
  });

  it(`worst case: the purge at its 5 rounds and ${MAX_GUARDRAIL_LOWERS + 2} breached ramps prepare at most 46 statements`, async () => {
    const { raw, own, binding, prepared } = countingD1();
    const names = Array.from({ length: MAX_GUARDRAIL_LOWERS + 2 }, (_, i) => `flag${String.fromCharCode(97 + i)}`);
    await breach(
      own,
      names.map((flag) => ramp({ flag })),
    );
    // dead rate counters for 5 full rounds of 200
    await own.addRateHits(Array.from({ length: SCHEDULED_PURGE_ROUNDS * NOTE_PURGE_LIMIT + 100 }, (_, i) => ({ key: `note:acct:k${i}`, at: '2026-09-01T00:00:00.000Z' })));
    await scheduled({ scheduledTime: NOW }, { DB: binding });
    expect(prepared()).toBe(36 + 1 + 1 + MAX_GUARDRAIL_LOWERS);
    expect(prepared()).toBeLessThanOrEqual(46);
    expect((await own.remoteConfig()).filter((r) => r.pct === 10)).toHaveLength(MAX_GUARDRAIL_LOWERS);
    raw.close();
  });

  it('reads only the guardrail metrics', async () => {
    const { raw, own } = countingD1();
    await own.addRollups('2026-10-15', [
      { metric: 'session.end.minutes', dim: '', bucket: '5' },
      { metric: 'mastery.level_up', dim: 'cell:letters-1', bucket: '2' },
    ]);
    await own.reserveRollupCells('2026-10-15', ROLLUP_BUDGET_METRIC, 500);
    expect((await own.rollupRowsOf('2026-10-01', '2026-10-20', GUARDRAIL_METRICS, 10)).map((r) => r.metric).sort()).toEqual([ROLLUP_BUDGET_METRIC, 'session.end.minutes']);
    expect(await own.rollupRowsOf('2026-10-01', '2026-10-20', [], 10)).toEqual([]);
    expect(await own.rollupRowsOf('2026-10-01', '2026-10-20', GUARDRAIL_METRICS, 1)).toHaveLength(1);
    raw.close();
  });

  it('the UPDATE never raises pct, never matches a row that changed in any way, and never touches on', async () => {
    const { raw, own } = countingD1();
    const step = '2026-10-10T09:00:00.000Z';
    await own.putRemoteConfig(ramp({ pct: 10 }));
    await own.putRemoteConfig(ramp({ flag: 'goals', on: false, pct: 10 }));
    const at = new Date(NOW).toISOString();
    expect(await own.lowerRemoteConfigPct('dailyReview', 10, step, 50, at, 'x')).toBe(false);
    expect(await own.lowerRemoteConfigPct('dailyReview', 10, step, 10, at, 'x')).toBe(false);
    expect(await own.lowerRemoteConfigPct('dailyReview', 50, step, 10, at, 'x')).toBe(false);
    expect(await own.lowerRemoteConfigPct('dailyReview', 10, '2026-10-11T00:00:00.000Z', 0, at, 'x')).toBe(false);
    expect(await own.lowerRemoteConfigPct('goals', 10, step, 0, at, 'x')).toBe(false);
    expect(await own.lowerRemoteConfigPct('missing', 50, step, 10, at, 'x')).toBe(false);
    expect(await own.remoteConfig()).toEqual([ramp({ pct: 10 }), ramp({ flag: 'goals', on: false, pct: 10 })]);
    expect(await own.lowerRemoteConfigPct('dailyReview', 10, step, 0, at, 'guardrail')).toBe(true);
    expect((await own.remoteConfig())[0]).toEqual({ flag: 'dailyReview', on: true, pct: 0, updatedAt: at, reason: 'guardrail' });
    raw.close();
  });

  it('lowers a fractional console value (25.5, served as 25) instead of deferring it every day', async () => {
    const { raw, own, binding } = countingD1();
    await breach(own, []);
    await raw.prepare('INSERT INTO remote_config (flag, "on", pct, updated_at, reason) VALUES (?, 1, 25.5, ?, ?)').bind('dailyReview', '2026-10-10T09:00:00.000Z', 'owner ramp').run();
    expect((await own.remoteConfig())[0]?.pct).toBe(25);
    await scheduled({ scheduledTime: NOW }, { DB: binding });
    expect((await own.remoteConfig())[0]).toMatchObject({ pct: 10, reason: expect.stringContaining('pct 25->10') });
    raw.close();
  });
});
