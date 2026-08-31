import { describe, expect, it } from 'vitest';
import {
  ATTEMPT_WINDOW_MS,
  COOLDOWN_MS,
  INITIAL_ATTEMPT_STATE,
  MAX_ATTEMPTS,
  attemptsRemaining,
  cooldownRemainingMs,
  createPinHash,
  isLocked,
  isValidPinFormat,
  registerFailure,
  registerSuccess,
  verifyPin,
  type AttemptState,
  type PinHasher,
} from '../pin-hash';

/** Deterministic stand-in for the expo-crypto hasher (spec §9.2). */
const fakeHasher: PinHasher = {
  hash: async (pin) => `hashed:${pin}`,
  verify: async (pin, stored) => stored === `hashed:${pin}`,
};

const T0 = 1_700_000_000_000;

function failNTimes(n: number, startedAt = T0, stepMs = 100): AttemptState {
  let state = INITIAL_ATTEMPT_STATE;
  for (let i = 0; i < n; i += 1) {
    state = registerFailure(state, startedAt + i * stepMs);
  }
  return state;
}

describe('isValidPinFormat', () => {
  it('accepts exactly 4 digits', () => {
    expect(isValidPinFormat('1234')).toBe(true);
    expect(isValidPinFormat('0000')).toBe(true);
  });

  it('rejects wrong length and non-digits', () => {
    expect(isValidPinFormat('123')).toBe(false);
    expect(isValidPinFormat('12345')).toBe(false);
    expect(isValidPinFormat('12a4')).toBe(false);
    expect(isValidPinFormat('')).toBe(false);
  });
});

describe('attempt/cooldown state machine', () => {
  it('a fresh state is unlocked with a full attempt budget', () => {
    expect(isLocked(INITIAL_ATTEMPT_STATE, T0)).toBe(false);
    expect(attemptsRemaining(INITIAL_ATTEMPT_STATE, T0)).toBe(MAX_ATTEMPTS);
  });

  it('counts down attempts as failures accumulate', () => {
    const state = failNTimes(2);
    expect(attemptsRemaining(state, T0 + 200)).toBe(MAX_ATTEMPTS - 2);
    expect(isLocked(state, T0 + 200)).toBe(false);
  });

  it('locks for 30s on the 5th failure inside the 60s window', () => {
    const state = failNTimes(MAX_ATTEMPTS);
    const at = T0 + (MAX_ATTEMPTS - 1) * 100;
    expect(isLocked(state, at)).toBe(true);
    expect(cooldownRemainingMs(state, at)).toBe(COOLDOWN_MS);
    expect(attemptsRemaining(state, at)).toBe(0);
  });

  it('cooldown expires exactly at its deadline', () => {
    const state = failNTimes(MAX_ATTEMPTS);
    const lockedAt = T0 + (MAX_ATTEMPTS - 1) * 100;
    expect(isLocked(state, lockedAt + COOLDOWN_MS - 1)).toBe(true);
    expect(isLocked(state, lockedAt + COOLDOWN_MS)).toBe(false);
    expect(cooldownRemainingMs(state, lockedAt + COOLDOWN_MS)).toBe(0);
  });

  it('failures older than the 60s window do not count toward a lockout', () => {
    // 4 failures, then one more after the whole earlier burst has aged out.
    let state = failNTimes(MAX_ATTEMPTS - 1);
    const lastFailure = T0 + (MAX_ATTEMPTS - 2) * 100;
    const later = lastFailure + ATTEMPT_WINDOW_MS + 1;
    state = registerFailure(state, later);
    expect(isLocked(state, later)).toBe(false);
    expect(attemptsRemaining(state, later)).toBe(MAX_ATTEMPTS - 1);
  });

  it('ages failures out individually — the window slides, it does not reset', () => {
    // 4 failures spread 20s apart, then a 5th at 80s. A 5th failure would lock
    // out if the window reset — but the oldest two have aged past 60s, so only
    // three are live and entry stays open.
    let state = failNTimes(MAX_ATTEMPTS - 1, T0, 20_000);
    const later = T0 + 4 * 20_000;
    state = registerFailure(state, later);
    expect(isLocked(state, later)).toBe(false);
    expect(state.failures).toEqual([T0 + 40_000, T0 + 60_000, later]);
    expect(attemptsRemaining(state, later)).toBe(2);
  });

  it('registerSuccess clears failures and any cooldown', () => {
    expect(registerSuccess()).toEqual(INITIAL_ATTEMPT_STATE);
  });
});

describe('verifyPin', () => {
  const storedHash = 'hashed:1234';

  it('accepts the correct PIN and resets the attempt state', async () => {
    const result = await verifyPin({
      pin: '1234',
      storedHash,
      state: failNTimes(2),
      now: T0 + 500,
      hasher: fakeHasher,
    });
    expect(result.ok).toBe(true);
    expect(result.state).toEqual(INITIAL_ATTEMPT_STATE);
  });

  it('rejects a wrong PIN and burns one attempt', async () => {
    const result = await verifyPin({
      pin: '9999',
      storedHash,
      state: INITIAL_ATTEMPT_STATE,
      now: T0,
      hasher: fakeHasher,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('wrong-pin');
    expect(attemptsRemaining(result.state, T0)).toBe(MAX_ATTEMPTS - 1);
  });

  it('refuses while locked and reports the remaining cooldown', async () => {
    const state = failNTimes(MAX_ATTEMPTS);
    const at = T0 + (MAX_ATTEMPTS - 1) * 100;
    const result = await verifyPin({ pin: '1234', storedHash, state, now: at, hasher: fakeHasher });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('cooldown');
    expect(result.cooldownRemainingMs).toBe(COOLDOWN_MS);
  });

  it('never consults the hasher while locked (even for the right PIN)', async () => {
    let calls = 0;
    const counting: PinHasher = {
      hash: fakeHasher.hash,
      verify: async (pin, stored) => {
        calls += 1;
        return fakeHasher.verify(pin, stored);
      },
    };
    const state = failNTimes(MAX_ATTEMPTS);
    await verifyPin({
      pin: '1234',
      storedHash,
      state,
      now: T0 + (MAX_ATTEMPTS - 1) * 100,
      hasher: counting,
    });
    expect(calls).toBe(0);
  });

  it('malformed input does not burn an attempt', async () => {
    const result = await verifyPin({
      pin: '12',
      storedHash,
      state: INITIAL_ATTEMPT_STATE,
      now: T0,
      hasher: fakeHasher,
    });
    expect(result.reason).toBe('bad-format');
    expect(attemptsRemaining(result.state, T0)).toBe(MAX_ATTEMPTS);
  });

  it('reports no-pin-set when the device has no parent PIN yet', async () => {
    const result = await verifyPin({
      pin: '1234',
      storedHash: null,
      state: INITIAL_ATTEMPT_STATE,
      now: T0,
      hasher: fakeHasher,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-pin-set');
  });
});

describe('createPinHash', () => {
  it('round-trips through the hasher', async () => {
    const hash = await createPinHash('4321', fakeHasher);
    expect(await fakeHasher.verify('4321', hash)).toBe(true);
    expect(await fakeHasher.verify('1234', hash)).toBe(false);
  });

  it('refuses to hash a malformed PIN', async () => {
    await expect(createPinHash('abc', fakeHasher)).rejects.toThrow(/exactly 4 digits/);
  });
});
