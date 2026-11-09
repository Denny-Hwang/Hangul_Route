import { AccountTrustSchema, GROWN_UP_FRESH_PIN_MS, type AccountTrust } from '@hangul-route/content-schema';
import type { NativeGateState } from './gate-state';

/**
 * F-AUTH-004 sections 7.2 and 7.3 (row NS-2; CS-N2, CS-N3, CS-N11): what `AccountGate` shows for an account screen.
 * Pure: the gate state (`nativeGateState`), whether a Clerk session exists, the trust record and the proof times come
 * in; row NS-4 wires it into `AccountGate`, which decides on mount, on every focus and on every return to `active`.
 *
 * | Gate state       | Signed in | Trust                  | Result                                                   |
 * | `unknown`        | any       | any                    | locked `unknown`: Try again, Back; no account call       |
 * | `nopin`          | any       | any                    | `needs_pin`: the Grown-up area destination (PIN setup)   |
 * | `open`           | no        | -                      | the sign-in screen                                       |
 * | `open`           | yes       | -                      | the use's home (the session is this run's, ND-9)         |
 * | `pin`, epoch `0` | any       | -                      | locked `epoch_zero`: Back                                |
 * | `pin`            | no        | any                    | the sign-in screen                                       |
 * | `pin`            | yes       | absent                 | locked `no_trust`: Sign in again                         |
 * | `pin`            | yes       | another epoch          | locked `pin_changed`: Sign in again                      |
 * | `pin`            | yes       | this epoch             | the use's home                                           |
 *
 * - **Re-trust** (7.3, R-1): when this run's sign-in used only an email code after a PIN change, the trust was not
 *   written; the absent or other-epoch rows then read `retrust_password` ("Sign in with your password to use it").
 * - **Freshness** (ND-5): on `pin`, the sign-in screen and the home, entered from outside the account routes, need a
 *   PIN typed on the pad, or a native sign-in, within `GROWN_UP_FRESH_PIN_MS`; otherwise `verify_pin` (the PIN
 *   screen in verify mode, without the face or fingerprint button). An open 15-minute session is not a proof, and a
 *   face or fingerprint never sets `lastPinTypedAt` (CS-N11). On `open` there is no PIN to ask.
 * - A trust record that could not be read or does not parse is no trust (CS-N3).
 */

export type AccountLockCause = 'unknown' | 'needs_pin' | 'epoch_zero' | 'no_trust' | 'pin_changed' | 'retrust_password';

export type AccountLock =
  | { kind: 'home' }
  | { kind: 'sign_in' }
  | { kind: 'verify_pin' }
  | { kind: 'needs_pin'; cause: 'needs_pin' }
  | { kind: 'locked'; cause: Exclude<AccountLockCause, 'needs_pin'>; action: 'try_again' | 'back' | 'sign_in_again' };

export interface AccountLockInput {
  gate: NativeGateState;
  /** A Clerk session exists (on a device that is not `pin`, only this run's memory session can). */
  signedIn: boolean;
  /** `hr:grownup:trust` read exactly and parsed (`trustOf`); null when absent, unreadable or damaged. */
  trust: AccountTrust | null;
  /** This run's sign-in used only an email code after a PIN change, so it did not write the trust (7.3). */
  retrustPending: boolean;
  /** `freshProof(...)`: a typed PIN or a native sign-in within `GROWN_UP_FRESH_PIN_MS`. */
  fresh: boolean;
  /** The screen is entered from outside the account routes (a row, the card); moving inside them keeps the session. */
  fromOutside: boolean;
}

/** `hr:grownup:trust` as read (null when the read failed): only a version 1 record with a positive epoch is trust. */
export function trustOf(raw: unknown): AccountTrust | null {
  const parsed = AccountTrustSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * ND-5: whether a typed PIN (`ui-store.lastPinTypedAt`) or a native sign-in (`ui-store.lastAccountSignInAt`) is
 * younger than `GROWN_UP_FRESH_PIN_MS`. A time in the future (the clock went back) proves nothing, so a clock change
 * can only make this stricter (section 12).
 */
export function freshProof(now: number, lastPinTypedAt: number | null, lastAccountSignInAt: number | null): boolean {
  const young = (at: number | null): boolean => at !== null && Number.isFinite(at) && at <= now && now - at < GROWN_UP_FRESH_PIN_MS;
  return young(lastPinTypedAt) || young(lastAccountSignInAt);
}

export function accountLock(input: AccountLockInput): AccountLock {
  const { gate } = input;
  if (gate.state === 'unknown') return { kind: 'locked', cause: 'unknown', action: 'try_again' };
  if (gate.state === 'nopin') return { kind: 'needs_pin', cause: 'needs_pin' };
  if (gate.state === 'open') return input.signedIn ? { kind: 'home' } : { kind: 'sign_in' };
  if (gate.epoch === 0) return { kind: 'locked', cause: 'epoch_zero', action: 'back' };
  const stale = input.fromOutside && !input.fresh;
  if (!input.signedIn) return stale ? { kind: 'verify_pin' } : { kind: 'sign_in' };
  if (input.trust === null || input.trust.epoch !== gate.epoch) {
    if (input.retrustPending) return { kind: 'locked', cause: 'retrust_password', action: 'sign_in_again' };
    return { kind: 'locked', cause: input.trust === null ? 'no_trust' : 'pin_changed', action: 'sign_in_again' };
  }
  return stale ? { kind: 'verify_pin' } : { kind: 'home' };
}
