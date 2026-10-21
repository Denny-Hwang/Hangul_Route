import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { D1Db, type Db, type RemoteConfigRow } from '../db';
import type { D1Like, D1PreparedLike } from '../db/d1';
import { scheduled } from '../index';
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

/** 20 quest sessions on KIND on `day`, `quits` of them left mid-quest, as POST /api/telemetry rolls them up. */
async function sessions(target: Db, day: string, quits: number): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    const left = i < quits ? '1' : '0';
    await target.addRollups(day, [
      { metric: 'session.end.questLeft', dim: '', bucket: left },
      { metric: 'session.end.questLeft', dim: KIND, bucket: left },
    ]);
  }
}

/** A before cohort at 10% quits (2026-10-05) and an after cohort at 40% (2026-10-20). */
async function breach(target: Db): Promise<void> {
  await target.putRemoteConfig(ramp());
  await sessions(target, '2026-10-05', 2);
  await sessions(target, '2026-10-20', 8);
}

const REASON = `guardrail 2026-10-21 pct 50->10: quitRate:${KIND} 10.0%->40.0%`;

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
    await sessions(db, '2026-10-05', 2);
    await sessions(db, '2026-10-20', 2);
    await scheduled({ scheduledTime: NOW }, {});
    expect(await db.remoteConfig()).toEqual([ramp()]);
  });

  it('an evaluator error still lets the purge run, then fails the run', async () => {
    const boom = new Error('remote_config unreadable');
    vi.spyOn(db, 'remoteConfig').mockRejectedValue(boom);
    const purge = vi.spyOn(db, 'purgeRateHits');
    await expect(scheduled({ scheduledTime: NOW }, {})).rejects.toBe(boom);
    expect(purge).toHaveBeenCalled();
  });
});

describe('scheduled · guardrail evaluator on D1', () => {
  it('lowers through the conditional UPDATE and stays under the 50 statements a Free-plan invocation allows', async () => {
    const raw = openSqliteD1();
    const own = new D1Db(raw);
    await breach(own);
    let prepared = 0;
    const binding: D1Like = {
      prepare(sql: string): D1PreparedLike {
        prepared += 1;
        return raw.prepare(sql);
      },
      batch: (statements) => raw.batch(statements),
    };
    await scheduled({ scheduledTime: NOW }, { DB: binding });
    // the purge's 36 at most, then remote_config, learning_rollups and one UPDATE
    expect(prepared).toBeLessThanOrEqual(36 + 3);
    expect(await own.remoteConfig()).toEqual([{ flag: 'dailyReview', on: true, pct: 10, updatedAt: new Date(NOW).toISOString(), reason: REASON }]);
    raw.close();
  });

  it('the UPDATE never raises pct, never matches a row that changed, and never touches on', async () => {
    const raw = openSqliteD1();
    const own = new D1Db(raw);
    await own.putRemoteConfig(ramp({ on: false, pct: 10 }));
    const at = new Date(NOW).toISOString();
    expect(await own.lowerRemoteConfigPct('dailyReview', 10, 50, at, 'x')).toBe(false);
    expect(await own.lowerRemoteConfigPct('dailyReview', 10, 10, at, 'x')).toBe(false);
    expect(await own.lowerRemoteConfigPct('dailyReview', 50, 10, at, 'x')).toBe(false);
    expect(await own.lowerRemoteConfigPct('goals', 50, 10, at, 'x')).toBe(false);
    expect(await own.remoteConfig()).toEqual([ramp({ on: false, pct: 10 })]);
    expect(await own.lowerRemoteConfigPct('dailyReview', 10, 0, at, 'guardrail')).toBe(true);
    expect(await own.remoteConfig()).toEqual([{ flag: 'dailyReview', on: false, pct: 0, updatedAt: at, reason: 'guardrail' }]);
    raw.close();
  });
});
