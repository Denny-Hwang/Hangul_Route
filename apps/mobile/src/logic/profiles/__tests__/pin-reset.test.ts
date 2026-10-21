import { getMessages } from '@hangul-route/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  formatReadyAt,
  resetWaitState,
  rescueFailureMessage,
  startResetWait,
  waitCardView,
} from '../pin-reset';

const m = getMessages('en').caregiver.pin;
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

describe('rescueFailureMessage: calm lines for the Forgot PIN code field', () => {
  const fail = (reason: 'cooldown' | 'bad-format' | 'no-code' | 'wrong-code', cooldownRemainingMs?: number) =>
    ({ ok: false as const, state: INITIAL_ATTEMPT_STATE, reason, cooldownRemainingMs });

  it('names the next step for each failure', () => {
    expect(rescueFailureMessage(fail('wrong-code'), m)).toBe("That isn't the code saved on this device. Check it and try again.");
    expect(rescueFailureMessage(fail('bad-format'), m)).toContain('TIGER-MOON-RIVER-APPLE-482139');
    expect(rescueFailureMessage(fail('no-code'), m)).toBe('No rescue code is saved on this device. Use the 24-hour wait instead.');
  });

  it('counts the cooldown down in whole seconds, rounding up', () => {
    expect(rescueFailureMessage(fail('cooldown', 12_000), m)).toBe("Let's take a short break. Try again in 12s.");
    expect(rescueFailureMessage(fail('cooldown', 11_001), m)).toBe("Let's take a short break. Try again in 12s.");
    expect(rescueFailureMessage(fail('cooldown'), m)).toBe("Let's take a short break. Try again in 0s.");
  });

  it('never uses shaming or banned words', () => {
    for (const r of ['wrong-code', 'bad-format', 'no-code', 'cooldown'] as const) {
      expect(rescueFailureMessage(fail(r, 5000), m)).not.toMatch(/\b(wrong|failed|missed|overdue|incomplete|error)\b/i);
    }
  });
});

describe('waitCardView: the 24-hour wait card', () => {
  const format = (ms: number): string => `T${ms - NOW}`;
  const READY_AT = NOW + PIN_RESET_WAIT_MS;

  it('idle: offers to start, explains the old PIN keeps working', () => {
    expect(waitCardView({ status: 'idle' }, format, m)).toEqual({
      caption: 'Your PIN keeps working meanwhile. After 24 hours you can set a new one.',
      buttonLabel: 'Start the wait',
      buttonDisabled: false,
    });
  });

  it('waiting: shows when the new PIN can be set, button disabled', () => {
    expect(waitCardView({ status: 'waiting', readyAt: READY_AT, remainingMs: 5 }, format, m)).toEqual({
      caption: `You can set a new PIN after T${PIN_RESET_WAIT_MS}.`,
      buttonLabel: 'Wait started',
      buttonDisabled: true,
    });
  });

  it('ready: the same button reads "Set a new PIN" and is live', () => {
    expect(waitCardView({ status: 'ready', readyAt: READY_AT }, format, m)).toEqual({
      caption: 'The 24 hours are up.',
      buttonLabel: 'Set a new PIN',
      buttonDisabled: false,
    });
  });
});

describe('rescueFailureMessage and waitCardView take their words from the message subtree', () => {
  it('uses the subtree it is given', () => {
    const other = { ...m, cooldown: (s: number) => `Pausa ${s}`, reset: { ...m.reset, failure: { ...m.reset.failure, noCode: 'Sin codigo.' } } };
    const fail = (reason: 'cooldown' | 'no-code', cooldownRemainingMs?: number) =>
      ({ ok: false as const, state: INITIAL_ATTEMPT_STATE, reason, cooldownRemainingMs });
    expect(rescueFailureMessage(fail('no-code'), other)).toBe('Sin codigo.');
    expect(rescueFailureMessage(fail('cooldown', 3000), other)).toBe('Pausa 3');
  });
});

describe('formatReadyAt: the end of the wait as a local date and time in the UI locale', () => {
  afterEach(() => vi.restoreAllMocks());
  const READY = new Date(2026, 9, 11, 16, 30).getTime();

  it('reads like "Oct 11, 2026, 4:30 PM" in English', () => {
    expect(formatReadyAt('en', READY)).toMatch(/^Oct 11, 2026, 4:30\sPM$/);
  });

  it('follows the locale', () => {
    expect(formatReadyAt('ko', READY)).toContain('2026');
    expect(formatReadyAt('es', READY)).toContain('2026');
  });

  it('never throws: falls back to the formatter table when toLocaleString does', () => {
    vi.spyOn(Date.prototype, 'toLocaleString').mockImplementation(() => {
      throw new RangeError('no locale data');
    });
    expect(formatReadyAt('en', READY)).toBe('Oct 11, 2026, 16:30');
  });
});
