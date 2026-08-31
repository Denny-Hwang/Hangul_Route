/**
 * Parent PIN policy — F-PROF-001 §3.1, §3.5.
 *
 * Pure logic. The hash primitive is injected (`PinHasher`) so this module is
 * testable without native crypto, and so the primitive can be swapped without
 * touching attempt/cooldown behaviour. The shipped implementation lives in
 * `src/platform/crypto.ts` (see spec §9.2 for why not bcrypt-js).
 */

export const PIN_LENGTH = 4;
/** Wrong attempts tolerated inside ATTEMPT_WINDOW_MS before a cooldown. */
export const MAX_ATTEMPTS = 5;
export const ATTEMPT_WINDOW_MS = 60_000;
export const COOLDOWN_MS = 30_000;

export interface PinHasher {
  hash(pin: string): Promise<string>;
  verify(pin: string, stored: string): Promise<boolean>;
}

/**
 * Serializable so the store can persist it: a child who force-quits the app
 * must not clear an active cooldown.
 */
export interface AttemptState {
  /** Epoch ms of recent failures, oldest first, pruned to the window. */
  failures: number[];
  /** Epoch ms until which entry is refused, or null. */
  lockedUntil: number | null;
}

export const INITIAL_ATTEMPT_STATE: AttemptState = { failures: [], lockedUntil: null };

export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
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

function prune(failures: number[], now: number): number[] {
  return failures.filter((t) => now - t < ATTEMPT_WINDOW_MS);
}

export function registerFailure(state: AttemptState, now: number): AttemptState {
  const failures = [...prune(state.failures, now), now];
  if (failures.length >= MAX_ATTEMPTS) {
    // Cooldown starts; the window is consumed so the next round starts clean.
    return { failures: [], lockedUntil: now + COOLDOWN_MS };
  }
  return { failures, lockedUntil: null };
}

export function registerSuccess(): AttemptState {
  return INITIAL_ATTEMPT_STATE;
}

export type PinFailureReason = 'cooldown' | 'bad-format' | 'no-pin-set' | 'wrong-pin';

export interface PinVerifyResult {
  ok: boolean;
  /** Attempt state to persist after this call. */
  state: AttemptState;
  reason?: PinFailureReason;
  /** Present when reason === 'cooldown'. */
  cooldownRemainingMs?: number;
}

export interface PinVerifyInput {
  pin: string;
  storedHash: string | null;
  state: AttemptState;
  now: number;
  hasher: PinHasher;
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
  return { ok: false, state: registerFailure(state, now), reason: 'wrong-pin' };
}

/** Hash a new PIN for storage. Rejects malformed input before hashing. */
export async function createPinHash(pin: string, hasher: PinHasher): Promise<string> {
  if (!isValidPinFormat(pin)) {
    throw new Error(`PIN must be exactly ${PIN_LENGTH} digits`);
  }
  return hasher.hash(pin);
}
