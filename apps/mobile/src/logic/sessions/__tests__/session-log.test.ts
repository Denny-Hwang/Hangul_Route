import type { SessionLog } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  LEARNING_SESSION_PREFIX,
  SESSION_COUNT_CAP_S,
  TIME_ONLY_SESSION_PREFIX,
  countedSeconds,
  countsForStreak,
  elapsedSeconds,
  keepsRun,
  lastStreakDay,
  newSessionId,
  practiceTotals,
  streakSessionDates,
} from '../session-log';

/**
 * F-REPORT-001 section 3.3.2 (RP-3b): the session log rules the store and the
 * report share. A time-only session (story, stand-alone game, level check;
 * OD-19) is told apart by its id, so no streak reader ever counts it, and a
 * session's counted seconds never pass the 60-minute cap.
 */

function session(id: string, startedAt: string, extra: Partial<SessionLog> = {}): SessionLog {
  return { id, profileId: 'p1', startedAt, episodesTouched: [], ...extra };
}

describe('logic/sessions/session-log (F-REPORT-001 section 3.3.2)', () => {
  it('caps a session at 60 minutes', () => {
    expect(SESSION_COUNT_CAP_S).toBe(3600);
  });

  it('names a streak session as today and a time-only session with its own prefix', () => {
    const at = '2026-10-12T09:00:00.000Z';
    expect(newSessionId(at, 'quest', [])).toBe(`session:${at}`);
    expect(newSessionId(at, 'time', [])).toBe(`${TIME_ONLY_SESSION_PREFIX}${at}`);
    expect(TIME_ONLY_SESSION_PREFIX).toBe('session:time:');
  });

  it('names a learning session (story, word set; F-CURR-002 OD-14) under the time-only prefix, so older readers keep it time only', () => {
    const at = '2026-10-12T09:00:00.000Z';
    expect(LEARNING_SESSION_PREFIX).toBe('session:time:learn:');
    expect(newSessionId(at, 'learn', [])).toBe(`session:time:learn:${at}`);
    expect(newSessionId(at, 'learn', [session(`session:time:learn:${at}`, at)])).toBe(`session:time:learn:${at}:2`);
    expect(countsForStreak(session(newSessionId(at, 'learn', []), at))).toBe(false);
  });

  it('keeps the local-day run for quest and learning sessions only (F-CURR-002 OD-14)', () => {
    const at = '2026-10-12T09:00:00.000Z';
    expect(keepsRun(session(`session:${at}`, at))).toBe(true);
    expect(keepsRun(session(`session:time:learn:${at}`, at))).toBe(true);
    expect(keepsRun(session(`session:time:${at}`, at))).toBe(false);
    expect(keepsRun(session('legacy-1', at))).toBe(true);
  });

  it('never reuses an id already in the log', () => {
    const at = '2026-10-12T09:00:00.000Z';
    const taken = [session(`session:${at}`, at), session(`session:${at}:2`, at)];
    expect(newSessionId(at, 'quest', taken)).toBe(`session:${at}:3`);
    expect(newSessionId(at, 'time', taken)).toBe(`session:time:${at}`);
  });

  it('counts only sessions without the time-only prefix toward the streak', () => {
    expect(countsForStreak(session('session:2026-10-12T09:00:00.000Z', '2026-10-12T09:00:00.000Z'))).toBe(true);
    expect(countsForStreak(session('session:time:2026-10-12T09:00:00.000Z', '2026-10-12T09:00:00.000Z'))).toBe(false);
    // any other id, from an older build or a restore, still counts as it did
    expect(countsForStreak(session('legacy-1', '2026-10-12T09:00:00.000Z'))).toBe(true);
  });

  it('lists the start times of streak sessions only, in log order', () => {
    const log = [
      session('session:a', '2026-10-10T09:00:00.000Z'),
      session('session:time:b', '2026-10-11T09:00:00.000Z'),
      session('session:c', '2026-10-12T09:00:00.000Z'),
    ];
    expect(streakSessionDates(log)).toEqual(['2026-10-10T09:00:00.000Z', '2026-10-12T09:00:00.000Z']);
    expect(streakSessionDates([])).toEqual([]);
  });

  it('finds the UTC day of the last streak session, skipping time-only ones', () => {
    const log = [session('session:a', '2026-10-10T23:00:00.000Z'), session('session:time:b', '2026-10-12T09:00:00.000Z')];
    expect(lastStreakDay(log)).toBe('2026-10-10');
    expect(lastStreakDay([session('session:time:b', '2026-10-12T09:00:00.000Z')])).toBeUndefined();
    expect(lastStreakDay([])).toBeUndefined();
  });

  it('measures elapsed whole seconds, never below 0 nor above the cap', () => {
    expect(elapsedSeconds('2026-10-12T09:00:00.000Z', '2026-10-12T09:01:30.400Z')).toBe(90);
    expect(elapsedSeconds('2026-10-12T09:00:00.000Z', '2026-10-12T08:00:00.000Z')).toBe(0);
    expect(elapsedSeconds('2026-10-12T09:00:00.000Z', '2026-10-12T12:00:00.000Z')).toBe(SESSION_COUNT_CAP_S);
    expect(elapsedSeconds('not a time', '2026-10-12T12:00:00.000Z')).toBe(0);
  });

  it('counts a session no longer than the cap, and an open or orphaned one as 0', () => {
    expect(countedSeconds(session('a', '2026-10-12T09:00:00.000Z', { durationSeconds: 125 }))).toBe(125);
    expect(countedSeconds(session('a', '2026-10-12T09:00:00.000Z', { durationSeconds: 7200 }))).toBe(SESSION_COUNT_CAP_S);
    expect(countedSeconds(session('a', '2026-10-12T09:00:00.000Z'))).toBe(0);
    expect(countedSeconds(session('a', '2026-10-12T09:00:00.000Z', { durationSeconds: -5 }))).toBe(0);
    expect(countedSeconds(session('a', '2026-10-12T09:00:00.000Z', { durationSeconds: Number.NaN }))).toBe(0);
  });

  it('practiceTotals: the grown-up stats count quest sessions only and capped minutes for all sessions', () => {
    const totals = practiceTotals([
      session('session:2026-10-12T09:00:00.000Z', '2026-10-12T09:00:00.000Z', { durationSeconds: 600 }),
      session('session:2026-10-12T10:00:00.000Z', '2026-10-12T10:00:00.000Z', { durationSeconds: 3 * 3600 }),
      session(`${TIME_ONLY_SESSION_PREFIX}2026-10-12T11:00:00.000Z`, '2026-10-12T11:00:00.000Z', { durationSeconds: 300 }),
      session(`${TIME_ONLY_SESSION_PREFIX}2026-10-12T12:00:00.000Z`, '2026-10-12T12:00:00.000Z'),
    ]);
    expect(totals).toEqual({ sessions: 2, minutes: 75 });
    expect(practiceTotals([])).toEqual({ sessions: 0, minutes: 0 });
  });
});
