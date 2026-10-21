/**
 * Parent PIN policy — F-PROF-001 §3.1, §3.5.
 *
 * Pure logic. The hash primitive is injected (`PinHasher`) so this module is
 * testable without native crypto, and so the primitive can be swapped without
 * touching attempt/cooldown behaviour. The shipped implementation lives in
 * `src/platform/crypto.ts` (see spec §9.2 for why not bcrypt-js).
 */

import { PIN_PAUSE_STEPS_MS, PIN_STRIKE_DECAY_MS } from '@hangul-route/content-schema';

export const PIN_LENGTH = 4;
/** Wrong attempts tolerated inside ATTEMPT_WINDOW_MS before a cooldown. */
export const MAX_ATTEMPTS = 5;
export const ATTEMPT_WINDOW_MS = 60_000;
/** The flat pause of the `flat` schedule (the kill switch's value), and the first step of `PIN_PAUSE_STEPS_MS`. */
export const COOLDOWN_MS = 30_000;

export interface PinHasher {
  hash(pin: string): Promise<string>;
  verify(pin: string, stored: string): Promise<boolean>;
}

/**
 * Serializable so the store can persist it: a child who force-quits the app
 * must not clear an active cooldown.
 *
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.3 (OA-D7): `strikes` counts the pauses so far (0 when absent, as
 * in a state an older bundle wrote) and `lastMissAt` is the last miss (absent when none). Each round of
 * `MAX_ATTEMPTS` misses within `ATTEMPT_WINDOW_MS` starts the pause `PIN_PAUSE_STEPS_MS[min(strikes, 4)]`.
 */
export interface AttemptState {
  /** Epoch ms of recent failures, oldest first, pruned to the window. */
  failures: number[];
  /** Epoch ms until which entry is refused, or null. */
  lockedUntil: number | null;
  /** [OA] Pauses so far, before the 24-hour decay is applied (`effectiveStrikes`). Absent reads as 0. */
  strikes?: number;
  /** [OA] Epoch ms of the last miss; the decay counts from here. */
  lastMissAt?: number;
}

export const INITIAL_ATTEMPT_STATE: AttemptState = { failures: [], lockedUntil: null, strikes: 0 };

/**
 * [OA] Which pause a round of misses starts: `steps` is OA-D7 (30 s, 1 min, 5 min, 15 min, then 60 min), `flat` is
 * the pause before it (`COOLDOWN_MS` every time), kept for the `EXPO_PUBLIC_PIN_PAUSE_STEPS` kill switch.
 */
export type PauseSchedule = 'steps' | 'flat';

export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * [OA] A stored attempt state, read leniently: an older bundle's state without `strikes` reads as 0 strikes, and a
 * value that is not an attempt state at all reads as the initial state (a damaged record never blocks the pad
 * for good, and never shortens a pause it can still read).
 */
export function normalizeAttemptState(raw: unknown): AttemptState {
  if (typeof raw !== 'object' || raw === null) return INITIAL_ATTEMPT_STATE;
  const r = raw as Record<string, unknown>;
  const failures = Array.isArray(r.failures) ? r.failures.filter(isTime).sort((a, b) => a - b) : [];
  const lockedUntil = isTime(r.lockedUntil) ? r.lockedUntil : null;
  const strikes = typeof r.strikes === 'number' && Number.isInteger(r.strikes) && r.strikes > 0 ? r.strikes : 0;
  return { failures, lockedUntil, strikes, ...(isTime(r.lastMissAt) ? { lastMissAt: r.lastMissAt } : {}) };
}

/**
 * [OA] Strikes after the decay (OQ-23): one step back per full `PIN_STRIKE_DECAY_MS` since the last miss. Derived at
 * every read and never written back, so reading twice never takes two steps; the next miss counts from this value.
 */
export function effectiveStrikes(state: AttemptState, now: number): number {
  const strikes = state.strikes ?? 0;
  if (strikes === 0 || state.lastMissAt === undefined) return strikes;
  const quiet = now - state.lastMissAt;
  if (quiet < PIN_STRIKE_DECAY_MS) return strikes;
  return Math.max(0, strikes - Math.floor(quiet / PIN_STRIKE_DECAY_MS));
}

/** [OA] The pause the next round starts under `schedule`, given the strikes so far. */
export function pauseMsFor(strikes: number, schedule: PauseSchedule = 'steps'): number {
  if (schedule === 'flat') return COOLDOWN_MS;
  return PIN_PAUSE_STEPS_MS[Math.min(Math.max(0, strikes), PIN_PAUSE_STEPS_MS.length - 1)]!;
}

export function cooldownRemainingMs(state: AttemptState, now: number): number {
  if (state.lockedUntil === null) return 0;
  return Math.max(0, state.lockedUntil - now);
}

export function isLocked(state: AttemptState, now: number): boolean {
  return cooldownRemainingMs(state, now) > 0;
}

/** Attempts left before the next failure triggers a cooldown. */
export function attemptsRemaining(state: AttemptState, now: number): number {
  if (isLocked(state, now)) return 0;
  return Math.max(0, MAX_ATTEMPTS - prune(state.failures, now).length);
}

function prune(failures: number[], now: number, windowMs = ATTEMPT_WINDOW_MS): number[] {
  return failures.filter((t) => now - t < windowMs);
}

/** [OA] A miss and what it started: `paused` names the step (1 to 5) and length when this miss began a pause. */
export interface MissResult {
  state: AttemptState;
  paused: { step: number; ms: number } | null;
}

/**
 * [OA] Section 8.3: the miss is recorded; on the `MAX_ATTEMPTS`th miss inside the window a pause starts of
 * `pauseMsFor(strikes)` and `strikes` grows by one (the decayed count is the base). `step` is the pause's place in
 * `PIN_PAUSE_STEPS_MS` (1 to 5; always 1 under the `flat` schedule), the `pin.paused` payload.
 */
export function registerMiss(state: AttemptState, now: number, schedule: PauseSchedule = 'steps'): MissResult {
  const strikes = effectiveStrikes(state, now);
  const failures = [...prune(state.failures, now), now];
  if (failures.length >= MAX_ATTEMPTS) {
    // The pause starts; the window is consumed so the next round starts clean.
    const ms = pauseMsFor(strikes, schedule);
    const step = schedule === 'flat' ? 1 : Math.min(strikes, PIN_PAUSE_STEPS_MS.length - 1) + 1;
    return { state: { failures: [], lockedUntil: now + ms, strikes: strikes + 1, lastMissAt: now }, paused: { step, ms } };
  }
  return { state: { failures, lockedUntil: null, strikes, lastMissAt: now }, paused: null };
}

export function registerFailure(state: AttemptState, now: number, schedule: PauseSchedule = 'steps'): AttemptState {
  return registerMiss(state, now, schedule).state;
}

/** A correct PIN, face or fingerprint, or a completed reset: no misses, no pause, `strikes` back to 0. */
export function registerSuccess(): AttemptState {
  return INITIAL_ATTEMPT_STATE;
}

/**
 * [OA] OA-D19: two attempt states (two tabs, or this tab and storage) merged so that neither loses a miss or
 * shortens a pause: the later `lockedUntil`, the larger `strikes`, the later `lastMissAt` and the union of the
 * misses. Misses at or before the start of the merged pause (the paused state's `lastMissAt`, the miss that
 * started it) are dropped, as that round is spent. Order does not matter, and merging a state with itself is it.
 */
export function mergeAttemptStates(a: AttemptState, b: AttemptState): AttemptState {
  const lockedUntil =
    a.lockedUntil === null ? b.lockedUntil : b.lockedUntil === null ? a.lockedUntil : Math.max(a.lockedUntil, b.lockedUntil);
  const owner = lockedUntil === null ? null : a.lockedUntil === lockedUntil ? a : b;
  const pauseStart = owner?.lastMissAt;
  const failures = [...new Set([...a.failures, ...b.failures])]
    .filter((t) => pauseStart === undefined || t > pauseStart)
    .sort((x, y) => x - y);
  const strikes = Math.max(a.strikes ?? 0, b.strikes ?? 0);
  const last = [a.lastMissAt, b.lastMissAt].filter((t): t is number => t !== undefined);
  return { failures, lockedUntil, strikes, ...(last.length > 0 ? { lastMissAt: Math.max(...last) } : {}) };
}

/**
 * [OA] A throttle with a flat pause (the Rescue Code's own counter, section 8.3): `max` misses within `windowMs`
 * start `pauseMs`. `strikes` is not used.
 */
export interface FlatThrottle {
  max: number;
  windowMs: number;
  pauseMs: number;
}

export function registerFlatFailure(state: AttemptState, now: number, throttle: FlatThrottle): AttemptState {
  const failures = [...prune(state.failures, now, throttle.windowMs), now];
  if (failures.length >= throttle.max) return { failures: [], lockedUntil: now + throttle.pauseMs, strikes: 0, lastMissAt: now };
  return { failures, lockedUntil: null, strikes: 0, lastMissAt: now };
}

export type PinFailureReason = 'cooldown' | 'bad-format' | 'no-pin-set' | 'wrong-pin';

export interface PinVerifyResult {
  ok: boolean;
  /** Attempt state to persist after this call. */
  state: AttemptState;
  reason?: PinFailureReason;
  /** Present when reason === 'cooldown'. */
  cooldownRemainingMs?: number;
  /** [OA] Present when this miss started a pause: its step (1 to 5), for `pin.paused`. */
  paused?: { step: number; ms: number };
}

export interface PinVerifyInput {
  pin: string;
  storedHash: string | null;
  state: AttemptState;
  now: number;
  hasher: PinHasher;
  /** [OA] The pause schedule (`EXPO_PUBLIC_PIN_PAUSE_STEPS`); `steps` when absent. */
  schedule?: PauseSchedule;
}

/**
 * Verify an entered PIN, applying the cooldown gate first so a locked-out
 * attempt never reaches the hasher.
 */
export async function verifyPin({
  pin,
  storedHash,
  state,
  now,
  hasher,
  schedule = 'steps',
}: PinVerifyInput): Promise<PinVerifyResult> {
  if (isLocked(state, now)) {
    return {
      ok: false,
      state,
      reason: 'cooldown',
      cooldownRemainingMs: cooldownRemainingMs(state, now),
    };
  }
  if (!isValidPinFormat(pin)) {
    // Malformed input is not a guess — it must not burn an attempt.
    return { ok: false, state, reason: 'bad-format' };
  }
  if (storedHash === null) {
    return { ok: false, state, reason: 'no-pin-set' };
  }
  if (await hasher.verify(pin, storedHash)) {
    return { ok: true, state: registerSuccess() };
  }
  const miss = registerMiss(state, now, schedule);
  return { ok: false, state: miss.state, reason: 'wrong-pin', ...(miss.paused === null ? {} : { paused: miss.paused }) };
}

/** Hash a new PIN for storage. Rejects malformed input before hashing. */
export async function createPinHash(pin: string, hasher: PinHasher): Promise<string> {
  if (!isValidPinFormat(pin)) {
    throw new Error(`PIN must be exactly ${PIN_LENGTH} digits`);
  }
  return hasher.hash(pin);
}
