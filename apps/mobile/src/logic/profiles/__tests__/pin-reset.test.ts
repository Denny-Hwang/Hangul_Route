import { describe, expect, it } from 'vitest';
import {
  ATTEMPT_WINDOW_MS,
  COOLDOWN_MS,
  INITIAL_ATTEMPT_STATE,
  MAX_ATTEMPTS,
  registerFailure,
  type AttemptState,
} from '../pin-hash';
import {
  PIN_RESET_WAIT_MS,
  attemptRescueCode,
  collectRescueCodes,
  resetWaitState,
  startResetWait,
} from '../pin-reset';

const NOW = 1_800_000_000_000;
const NEW_CODE = 'TIGER-MOON-RIVER-APPLE-482139';
const OLD_CODE = 'PANDA-LAKE-4821';

describe('collectRescueCodes', () => {
  it('returns the normalised stored codes of every learner, skipping empty ones', () => {
    const codes = collectRescueCodes({
      a: { rescueCode: NEW_CODE },
      b: { rescueCode: null },
      c: { rescueCode: OLD_CODE },
    });
    expect(codes).toEqual([NEW_CODE, OLD_CODE]);
  });

  it('is empty when no learner has a code', () => {
    expect(collectRescueCodes({})).toEqual([]);
    expect(collectRescueCodes({ a: { rescueCode: null } })).toEqual([]);
  });

  it('drops a stored value that is not a Rescue Code shape', () => {
    expect(collectRescueCodes({ a: { rescueCode: 'garbage' } })).toEqual([]);
  });

  it('normalises a stored code written in another case or separator', () => {
    expect(collectRescueCodes({ a: { rescueCode: 'tiger moon river apple 482139' } })).toEqual([NEW_CODE]);
  });
});

describe('attemptRescueCode', () => {
  const stored = [NEW_CODE, OLD_CODE];
  const input = (entry: string, state: AttemptState = INITIAL_ATTEMPT_STATE, codes = stored) => ({
    entry,
    storedCodes: codes,
    state,
    now: NOW,
  });

  it('accepts the exact code and resets the attempt state', () => {
    const result = attemptRescueCode(input(NEW_CODE, { failures: [NOW - 1000], lockedUntil: null }));
    expect(result).toEqual({ ok: true, state: INITIAL_ATTEMPT_STATE });
  });

  it('matches any of several stored codes (one per synced learner)', () => {
    expect(attemptRescueCode(input(OLD_CODE)).ok).toBe(true);
    expect(attemptRescueCode(input(NEW_CODE)).ok).toBe(true);
  });

  it('normalises the entry: any case, spaces or hyphens, digits glued or grouped', () => {
    for (const typed of [
      'tiger-moon-river-apple-482139',
      'Tiger Moon River Apple 482139',
      '  TIGER  MOON  RIVER  APPLE  482 139  ',
      'tiger-moon-river-apple482139',
    ]) {
      expect(attemptRescueCode(input(typed)).ok, typed).toBe(true);
    }
    expect(attemptRescueCode(input('panda lake 4821')).ok).toBe(true);
  });

  it('a wrong but well-formed code fails and counts one attempt', () => {
    const result = attemptRescueCode(input('TIGER-MOON-RIVER-APPLE-000000'));
    expect(result).toEqual({
      ok: false,
      reason: 'wrong-code',
      state: registerFailure(INITIAL_ATTEMPT_STATE, NOW),
    });
  });

  it('a malformed entry is not a guess and does not burn an attempt', () => {
    for (const typed of ['', '   ', 'hello', '1234', 'TIGER-MOON']) {
      expect(attemptRescueCode(input(typed))).toEqual({
        ok: false,
        reason: 'bad-format',
        state: INITIAL_ATTEMPT_STATE,
      });
    }
  });

  it('reports no-code when nothing is stored, without burning an attempt', () => {
    expect(attemptRescueCode(input(NEW_CODE, INITIAL_ATTEMPT_STATE, []))).toEqual({
      ok: false,
      reason: 'no-code',
      state: INITIAL_ATTEMPT_STATE,
    });
  });

  it('shares the PIN throttle: the same window and cooldown as account:pinAttempts', () => {
    let state: AttemptState = INITIAL_ATTEMPT_STATE;
    for (let i = 0; i < MAX_ATTEMPTS - 1; i += 1) {
      const r = attemptRescueCode(input('TIGER-MOON-RIVER-APPLE-000000', state));
      expect(r.ok).toBe(false);
      expect(r.state.lockedUntil).toBeNull();
      state = r.state;
    }
    const locking = attemptRescueCode(input('TIGER-MOON-RIVER-APPLE-000000', state));
    expect(locking.state).toEqual({ failures: [], lockedUntil: NOW + COOLDOWN_MS });
  });

  it('wrong PIN attempts already in the window count toward the rescue-code limit', () => {
    const afterPins: AttemptState = { failures: Array.from({ length: MAX_ATTEMPTS - 1 }, (_, i) => NOW - 2000 + i), lockedUntil: null };
    const r = attemptRescueCode(input('TIGER-MOON-RIVER-APPLE-000000', afterPins));
    expect(r.state.lockedUntil).toBe(NOW + COOLDOWN_MS);
  });

  it('failures older than the window have expired', () => {
    const stale: AttemptState = { failures: [NOW - ATTEMPT_WINDOW_MS - 1], lockedUntil: null };
    const r = attemptRescueCode(input('TIGER-MOON-RIVER-APPLE-000000', stale));
    expect(r.state.failures).toEqual([NOW]);
  });

  it('refuses everything during a cooldown, even the right code, and never reaches the comparison', () => {
    const locked: AttemptState = { failures: [], lockedUntil: NOW + 12_000 };
    expect(attemptRescueCode(input(NEW_CODE, locked))).toEqual({
      ok: false,
      reason: 'cooldown',
      state: locked,
      cooldownRemainingMs: 12_000,
    });
  });

  it('the cooldown ends at its boundary instant', () => {
    const lockedUntilNow: AttemptState = { failures: [], lockedUntil: NOW };
    expect(attemptRescueCode(input(NEW_CODE, lockedUntilNow)).ok).toBe(true);
  });
});

describe('resetWaitState (24 hour wait, L9)', () => {
  const REQUESTED = new Date(NOW).toISOString();
  const READY_AT = NOW + PIN_RESET_WAIT_MS;

  it('waits exactly 24 hours', () => {
    expect(PIN_RESET_WAIT_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('is idle without a request', () => {
    expect(resetWaitState(null, NOW)).toEqual({ status: 'idle' });
  });

  it('is idle for an unreadable timestamp rather than blocking or unlocking', () => {
    expect(resetWaitState('not a date', NOW)).toEqual({ status: 'idle' });
  });

  it('is waiting right after the request', () => {
    expect(resetWaitState(REQUESTED, NOW)).toEqual({ status: 'waiting', readyAt: READY_AT, remainingMs: PIN_RESET_WAIT_MS });
  });

  it('is waiting one millisecond before the boundary', () => {
    expect(resetWaitState(REQUESTED, READY_AT - 1)).toEqual({ status: 'waiting', readyAt: READY_AT, remainingMs: 1 });
  });

  it('is ready at the boundary instant and after', () => {
    expect(resetWaitState(REQUESTED, READY_AT)).toEqual({ status: 'ready', readyAt: READY_AT });
    expect(resetWaitState(REQUESTED, READY_AT + 60_000)).toEqual({ status: 'ready', readyAt: READY_AT });
  });
});

describe('startResetWait', () => {
  it('stamps now when no request is pending', () => {
    expect(startResetWait(null, NOW)).toBe(new Date(NOW).toISOString());
  });

  it('keeps the original stamp when a request is already pending, so tapping again cannot extend the wait', () => {
    const first = new Date(NOW - 3_600_000).toISOString();
    expect(startResetWait(first, NOW)).toBe(first);
  });

  it('keeps the original stamp when the wait is already over', () => {
    const old = new Date(NOW - PIN_RESET_WAIT_MS - 1).toISOString();
    expect(startResetWait(old, NOW)).toBe(old);
  });

  it('replaces an unreadable stamp', () => {
    expect(startResetWait('garbage', NOW)).toBe(new Date(NOW).toISOString());
  });
});
