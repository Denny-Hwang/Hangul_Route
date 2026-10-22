import { PIN_PAUSE_STEPS_MS, PIN_STRIKE_DECAY_MS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  ATTEMPT_WINDOW_MS,
  COOLDOWN_MS,
  INITIAL_ATTEMPT_STATE,
  MAX_ATTEMPTS,
  PIN_MAX_PAUSE_MS,
  PIN_ROUND_WINDOW_MS,
  attemptsRemaining,
  cooldownRemainingMs,
  createPinHash,
  isLocked,
  isValidPinFormat,
  effectiveStrikes,
  mergeAttemptStates,
  normalizeAttemptState,
  pauseMsFor,
  registerFailure,
  registerFlatFailure,
  registerMiss,
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

function failNTimes(n: number, startedAt = T0, stepMs = 100, schedule: 'steps' | 'flat' = 'steps'): AttemptState {
  let state = INITIAL_ATTEMPT_STATE;
  for (let i = 0; i < n; i += 1) {
    state = registerFailure(state, startedAt + i * stepMs, schedule);
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

  it('flat schedule (the kill switch off): failures older than the 60s window do not count toward a lockout', () => {
    // 4 failures, then one more after the whole earlier burst has aged out.
    let state = failNTimes(MAX_ATTEMPTS - 1, T0, 100, 'flat');
    const lastFailure = T0 + (MAX_ATTEMPTS - 2) * 100;
    const later = lastFailure + ATTEMPT_WINDOW_MS + 1;
    state = registerFailure(state, later, 'flat');
    expect(isLocked(state, later)).toBe(false);
    expect(attemptsRemaining(state, later, 'flat')).toBe(MAX_ATTEMPTS - 1);
  });

  it('flat schedule: ages failures out individually — the window slides, it does not reset', () => {
    // 4 failures spread 20s apart, then a 5th at 80s. A 5th failure would lock
    // out if the window reset — but the oldest two have aged past 60s, so only
    // three are live and entry stays open.
    let state = failNTimes(MAX_ATTEMPTS - 1, T0, 20_000, 'flat');
    const later = T0 + 4 * 20_000;
    state = registerFailure(state, later, 'flat');
    expect(isLocked(state, later)).toBe(false);
    expect(state.failures).toEqual([T0 + 40_000, T0 + 60_000, later]);
    expect(attemptsRemaining(state, later, 'flat')).toBe(2);
  });

  it('[OA] steps schedule: misses count for 24 hours, so a slow pace still ends a round', () => {
    let state = failNTimes(MAX_ATTEMPTS - 1, T0, 20_000);
    const later = T0 + 4 * 20_000;
    expect(attemptsRemaining(state, later)).toBe(1);
    state = registerFailure(state, later);
    expect(isLocked(state, later)).toBe(true);
    // A miss older than the 24-hour round window ages out.
    const old = failNTimes(MAX_ATTEMPTS - 1, T0, 100);
    const dayLater = T0 + PIN_ROUND_WINDOW_MS + 1_000;
    expect(attemptsRemaining(old, dayLater)).toBe(MAX_ATTEMPTS);
    expect(isLocked(registerFailure(old, dayLater), dayLater)).toBe(false);
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

// ---- [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.3, row OA-2 ----

/** One round of `MAX_ATTEMPTS` misses, 100 ms apart, starting at `at`; returns the state and when the round ended. */
function round(state: AttemptState, at: number, schedule: 'steps' | 'flat' = 'steps'): { state: AttemptState; end: number; step: number | null } {
  let s = state;
  let step: number | null = null;
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    const miss = registerMiss(s, at + i * 100, schedule);
    s = miss.state;
    step = miss.paused?.step ?? step;
  }
  return { state: s, end: at + (MAX_ATTEMPTS - 1) * 100, step };
}

describe('[OA] pause steps (OA-D7)', () => {
  it('the steps are 30 s, 1 min, 5 min, 15 min, then 60 min for every further round', () => {
    let state = INITIAL_ATTEMPT_STATE;
    let at = T0;
    const pauses: number[] = [];
    const steps: (number | null)[] = [];
    for (let r = 0; r < 7; r += 1) {
      const result = round(state, at);
      pauses.push(cooldownRemainingMs(result.state, result.end));
      steps.push(result.step);
      state = result.state;
      at = state.lockedUntil!;
    }
    expect(pauses).toEqual([30_000, 60_000, 300_000, 900_000, 3_600_000, 3_600_000, 3_600_000]);
    expect(steps).toEqual([1, 2, 3, 4, 5, 5, 5]);
    expect(state.strikes).toBe(7);
  });

  it('pauseMsFor reads the constants and clamps to the last step', () => {
    expect(pauseMsFor(0)).toBe(PIN_PAUSE_STEPS_MS[0]);
    expect(pauseMsFor(4)).toBe(PIN_PAUSE_STEPS_MS[4]);
    expect(pauseMsFor(40)).toBe(PIN_PAUSE_STEPS_MS[4]);
    expect(pauseMsFor(-1)).toBe(PIN_PAUSE_STEPS_MS[0]);
  });

  it('a miss that does not end a round starts no pause and records lastMissAt', () => {
    const miss = registerMiss(INITIAL_ATTEMPT_STATE, T0);
    expect(miss.paused).toBeNull();
    expect(miss.state).toEqual({ failures: [T0], lockedUntil: null, strikes: 0, lastMissAt: T0 });
  });

  it('the flat schedule (kill switch off) pauses 30 s every round and reports step 1', () => {
    let state = INITIAL_ATTEMPT_STATE;
    let at = T0;
    for (let r = 0; r < 4; r += 1) {
      const result = round(state, at, 'flat');
      expect(cooldownRemainingMs(result.state, result.end)).toBe(COOLDOWN_MS);
      expect(result.step).toBe(1);
      state = result.state;
      at = state.lockedUntil!;
    }
    // [OA] OA-2 review round 2: the pause of before counts no strikes, so nothing of the steps shows with it off.
    expect(state.strikes).toBe(0);
  });

  it('[OA] slow guessing (4 misses every 59 s) is paused like fast guessing: all 10,000 PINs take at least 30 days', () => {
    let state = INITIAL_ATTEMPT_STATE;
    let at = T0;
    for (let i = 0; i < 10_000; i += 1) {
      state = registerFailure(state, at);
      // Four misses in each 59 s, then wait for any pause that started.
      at = Math.max(at + (59_000 / 4), state.lockedUntil ?? 0);
    }
    const days = (at - T0) / (24 * 3_600_000);
    expect(days).toBeGreaterThanOrEqual(30);
    expect(days).toBeGreaterThanOrEqual(83);
  });

  it('worst case on the pad, computed from the constants: 2,000 rounds of 5 take about 83 days (at least 30)', () => {
    const rounds = 10_000 / MAX_ATTEMPTS;
    let total = 0;
    for (let k = 0; k < rounds; k += 1) total += pauseMsFor(k);
    const days = total / (24 * 3_600_000);
    expect(Math.round(total / 3_600_000)).toBe(1996);
    expect(days).toBeGreaterThanOrEqual(30);
    expect(Math.floor(days)).toBe(83);
  });

  it('the same worst case by running the state machine over all 10,000 PINs (no decay can start between rounds)', () => {
    let state = INITIAL_ATTEMPT_STATE;
    let at = T0;
    for (let i = 0; i < 10_000; i += 1) {
      state = registerFailure(state, at);
      at = state.lockedUntil ?? at;
    }
    expect(Math.floor((at - T0) / (24 * 3_600_000))).toBe(83);
    expect(state.strikes).toBe(2000);
  });
});

describe('[OA] strikes reset and decay', () => {
  const twoStrikes = (): AttemptState => {
    const first = round(INITIAL_ATTEMPT_STATE, T0);
    return round(first.state, first.state.lockedUntil!).state;
  };

  it('a correct PIN sets strikes to 0', async () => {
    const result = await verifyPin({ pin: '1234', storedHash: 'hashed:1234', state: { ...twoStrikes(), lockedUntil: null }, now: T0 + 999_999, hasher: fakeHasher });
    expect(result.state.strikes).toBe(0);
    expect(registerSuccess().strikes).toBe(0);
  });

  it('strikes fall by one per full 24 hours without a miss, never below 0, derived at each read', () => {
    const state = twoStrikes();
    const last = state.lastMissAt!;
    expect(effectiveStrikes(state, last + PIN_STRIKE_DECAY_MS - 1)).toBe(2);
    expect(effectiveStrikes(state, last + PIN_STRIKE_DECAY_MS)).toBe(1);
    expect(effectiveStrikes(state, last + PIN_STRIKE_DECAY_MS)).toBe(1);
    expect(effectiveStrikes(state, last + 2 * PIN_STRIKE_DECAY_MS + 5)).toBe(0);
    expect(effectiveStrikes(state, last + 9 * PIN_STRIKE_DECAY_MS)).toBe(0);
    expect(effectiveStrikes(INITIAL_ATTEMPT_STATE, T0)).toBe(0);
    expect(effectiveStrikes({ failures: [], lockedUntil: null, strikes: 3 }, T0)).toBe(3);
  });

  it('the next round after a decay starts from the decayed step', () => {
    const state = twoStrikes();
    const later = state.lastMissAt! + PIN_STRIKE_DECAY_MS + 1;
    const result = round(state, later);
    expect(cooldownRemainingMs(result.state, result.end)).toBe(PIN_PAUSE_STEPS_MS[1]);
    expect(result.state.strikes).toBe(2);
  });
});

describe('[OA] stored state: legacy and damaged values', () => {
  it('a legacy state without strikes reads as 0 strikes and keeps its pause', () => {
    const legacy = { failures: [T0 - 10, T0 - 20], lockedUntil: T0 + 5000 };
    expect(normalizeAttemptState(legacy)).toEqual({ failures: [T0 - 20, T0 - 10], lockedUntil: T0 + 5000, strikes: 0 });
    expect(effectiveStrikes(legacy, T0)).toBe(0);
    const next = registerMiss({ failures: [], lockedUntil: null }, T0);
    expect(next.state.strikes).toBe(0);
  });

  it('keeps strikes and lastMissAt; drops anything that is not an attempt state', () => {
    expect(normalizeAttemptState({ failures: [T0], lockedUntil: null, strikes: 3, lastMissAt: T0 })).toEqual({ failures: [T0], lockedUntil: null, strikes: 3, lastMissAt: T0 });
    for (const junk of [null, undefined, 'x', 42, []]) expect(normalizeAttemptState(junk)).toEqual(INITIAL_ATTEMPT_STATE);
    // [OA] OA-2 review round 2: a pause far in the future (a clock set back, a damaged record) is cut to the longest step.
    expect(normalizeAttemptState({ failures: [], lockedUntil: T0 + 365 * 24 * 3_600_000, strikes: 5 }, { now: T0, maxPauseMs: PIN_MAX_PAUSE_MS }).lockedUntil).toBe(
      T0 + PIN_MAX_PAUSE_MS,
    );
    expect(normalizeAttemptState({ failures: [], lockedUntil: T0 + 1000, strikes: 1 }, { now: T0, maxPauseMs: PIN_MAX_PAUSE_MS }).lockedUntil).toBe(T0 + 1000);
    expect(PIN_MAX_PAUSE_MS).toBe(PIN_PAUSE_STEPS_MS[PIN_PAUSE_STEPS_MS.length - 1]);
    expect(normalizeAttemptState({ failures: ['a', T0, Number.NaN], lockedUntil: 'soon', strikes: -2, lastMissAt: 'x' })).toEqual({ failures: [T0], lockedUntil: null, strikes: 0 });
    expect(normalizeAttemptState({ failures: 'no', lockedUntil: null, strikes: 1.5 })).toEqual({ failures: [], lockedUntil: null, strikes: 0 });
  });
});

describe('[OA] mergeAttemptStates (OA-D19)', () => {
  it('takes the later lockedUntil, the larger strikes and the later lastMissAt', () => {
    const a: AttemptState = { failures: [], lockedUntil: T0 + 60_000, strikes: 2, lastMissAt: T0 };
    const b: AttemptState = { failures: [], lockedUntil: T0 + 30_000, strikes: 3, lastMissAt: T0 - 5 };
    expect(mergeAttemptStates(a, b, T0)).toEqual({ failures: [], lockedUntil: T0 + 60_000, strikes: 3, lastMissAt: T0 });
    expect(mergeAttemptStates(b, a, T0)).toEqual(mergeAttemptStates(a, b, T0));
  });

  it('unions the misses of two tabs: 3 here and 1 there, then one more miss, is the 5th and pauses', () => {
    const here: AttemptState = { failures: [T0, T0 + 10, T0 + 20], lockedUntil: null, strikes: 0, lastMissAt: T0 + 20 };
    const there: AttemptState = { failures: [T0 + 5, T0 + 15], lockedUntil: null, strikes: 0, lastMissAt: T0 + 15 };
    const merged = mergeAttemptStates(here, there, T0);
    expect(merged.failures).toEqual([T0, T0 + 5, T0 + 10, T0 + 15, T0 + 20]);
    expect(merged.lockedUntil).toBeNull();
    expect(registerMiss(mergeAttemptStates(here, { ...there, failures: [T0 + 5] }, T0), T0 + 30).paused).toEqual({ step: 1, ms: 30_000 });
  });

  it('drops misses up to the start of the merged pause (that round is spent)', () => {
    const paused: AttemptState = { failures: [], lockedUntil: T0 + 30_000, strikes: 1, lastMissAt: T0 };
    const stale: AttemptState = { failures: [T0 - 30, T0 - 20], lockedUntil: null, strikes: 0, lastMissAt: T0 - 20 };
    expect(mergeAttemptStates(stale, paused, T0)).toEqual(paused);
  });

  it('keeps every miss when the paused state is legacy (no lastMissAt) or nobody is paused', () => {
    const legacy: AttemptState = { failures: [], lockedUntil: T0 + 30_000 };
    const other: AttemptState = { failures: [T0 - 1], lockedUntil: null };
    expect(mergeAttemptStates(legacy, other, T0)).toEqual({ failures: [T0 - 1], lockedUntil: T0 + 30_000, strikes: 0 });
    expect(mergeAttemptStates(INITIAL_ATTEMPT_STATE, INITIAL_ATTEMPT_STATE, T0)).toEqual(INITIAL_ATTEMPT_STATE);
  });

  it('applies the 24-hour decay before it compares strikes, so a stale copy never brings decayed strikes back (OQ-23)', () => {
    const now = T0 + 3 * PIN_STRIKE_DECAY_MS;
    const stale: AttemptState = { failures: [], lockedUntil: null, strikes: 4, lastMissAt: T0 };
    const fresh: AttemptState = { failures: [now], lockedUntil: null, strikes: 1, lastMissAt: now };
    const merged = mergeAttemptStates(stale, fresh, now);
    expect(effectiveStrikes(merged, now)).toBe(1);
    expect(merged).toEqual({ failures: [now], lockedUntil: null, strikes: 1, lastMissAt: now });
    expect(mergeAttemptStates(fresh, stale, now)).toEqual(merged);
  });

  it('never takes a decay step twice: two old copies keep their decayed count now and decay on from there', () => {
    const now = T0 + 3 * PIN_STRIKE_DECAY_MS;
    const old: AttemptState = { failures: [], lockedUntil: null, strikes: 4, lastMissAt: T0 };
    const merged = mergeAttemptStates(old, old, now);
    expect(merged).toEqual(old);
    expect(effectiveStrikes(merged, now)).toBe(1);
    expect(effectiveStrikes(mergeAttemptStates(old, INITIAL_ATTEMPT_STATE, now), now)).toBe(1);
    expect(effectiveStrikes(merged, now + PIN_STRIKE_DECAY_MS)).toBe(0);
  });

  it('an older bundle that wrote a state without strikes does not lose the step', () => {
    const ours: AttemptState = { failures: [], lockedUntil: null, strikes: 4, lastMissAt: T0 };
    const olderTab = { failures: [T0 + 10], lockedUntil: null };
    const merged = mergeAttemptStates(normalizeAttemptState(olderTab), ours, T0);
    expect(merged.strikes).toBe(4);
    expect(merged.failures).toEqual([T0 + 10]);
  });
});

describe('[OA] verifyPin reports the pause it starts', () => {
  it('names the step on the miss that starts a pause, under either schedule', async () => {
    const four = failNTimes(MAX_ATTEMPTS - 1);
    const at = T0 + 1000;
    const steps = await verifyPin({ pin: '9999', storedHash: 'hashed:1234', state: four, now: at, hasher: fakeHasher });
    expect(steps.paused).toEqual({ step: 1, ms: 30_000 });
    const flat = await verifyPin({ pin: '9999', storedHash: 'hashed:1234', state: { ...four, strikes: 3 }, now: at, hasher: fakeHasher, schedule: 'flat' });
    expect(flat.paused).toEqual({ step: 1, ms: COOLDOWN_MS });
    const third = await verifyPin({ pin: '9999', storedHash: 'hashed:1234', state: { ...four, strikes: 2 }, now: at, hasher: fakeHasher });
    expect(third.paused).toEqual({ step: 3, ms: 300_000 });
    const plain = await verifyPin({ pin: '9999', storedHash: 'hashed:1234', state: INITIAL_ATTEMPT_STATE, now: at, hasher: fakeHasher });
    expect(plain.paused).toBeUndefined();
  });
});

describe('[OA] registerFlatFailure: a throttle with its own window and a flat pause', () => {
  const throttle = { max: 3, windowMs: 1000, pauseMs: 5000 };
  it('pauses on the max-th miss inside the window, never grows, and ages misses out', () => {
    let s = INITIAL_ATTEMPT_STATE;
    s = registerFlatFailure(s, T0, throttle);
    s = registerFlatFailure(s, T0 + 10, throttle);
    expect(s).toEqual({ failures: [T0, T0 + 10], lockedUntil: null, strikes: 0, lastMissAt: T0 + 10 });
    s = registerFlatFailure(s, T0 + 20, throttle);
    expect(s).toEqual({ failures: [], lockedUntil: T0 + 5020, strikes: 0, lastMissAt: T0 + 20 });
    const aged = registerFlatFailure({ failures: [T0 - 1000], lockedUntil: null }, T0, throttle);
    expect(aged.failures).toEqual([T0]);
  });
});
