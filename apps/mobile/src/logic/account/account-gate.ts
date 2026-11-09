import type { AccountTrust } from '@hangul-route/content-schema';
import { accountLock, type AccountLockCause } from './account-lock';
import type { NativeGateState } from './gate-state';

/**
 * F-AUTH-004 sections 7.2, 7.3 and 10 (row NS-4; CS-N2, CS-N3, CS-N11, CS-N14; design `lock.md`, `native-lock.md`):
 * what `AccountGate` does for the account screen it wraps, at one decision moment (mount, every focus, every return of
 * the app to `active`). Pure over `accountLock` (the table of sections 7.2 and 7.3), with what one screen mount adds:
 *
 * - **Before Clerk**: gate `unknown` locks with Try again and Back, and `nopin` goes to PIN setup, whatever Clerk says
 *   (no account call). Without Clerk's provider for this visit nothing can be checked: the `unknown` lock. While Clerk
 *   loads the screen waits, drawing nothing of the account.
 * - **The screen's own result**: the sign-in screen opens on `sign_in`; a home on `home`. The other one is replaced
 *   (`to_sign_in`, `to_home`). Once the sign-in screen has opened in this mount it stays open on `home` too: its own
 *   completion moves on (section 6.5), so a decision while it finishes never races it.
 * - **Freshness** (ND-5): `fromOutside` holds only until the screen first opened in this mount; moving inside the
 *   account routes keeps the 15-minute session (OA-D5b), and no longer: once that session lapsed, an open screen
 *   closes it (`close`: `closeGrownUpSession` pops the area, so the next entry asks the typed PIN again). `verify_pin` asks the typed PIN once (`ask_pin`); a return
 *   still without one (Cancel, Close, face or fingerprint, which never counts: CS-N11) leaves the screen (`leave`).
 * - **Sign in again** (`again`: the lock card's button, or the account card's, which opens the sign-in with it): only
 *   on a lock whose action is Sign in again; it needs a typed PIN or a sign-in within 2 minutes first, then signs out
 *   on this device and goes on to the sign-in. A PIN asked for it and not typed leaves the lock as it was (the
 *   screen drops `again` after every step but `ask_pin`).
 */

export type GateScreen = 'sign_in' | 'home';

export interface GateDecisionInput {
  screen: GateScreen;
  /** `nativeGateState()`, read now. */
  gate: NativeGateState;
  /** Clerk for this visit: no provider (`off`), the provider still loading, or loaded. */
  clerk: 'off' | 'loading' | 'ready';
  /** Clerk's `isSignedIn`, and not signed out in this run (R-2). */
  signedIn: boolean;
  signedInThisVisit: boolean;
  trust: AccountTrust | null;
  retrustPending: boolean;
  /** `freshProof(...)`: a typed PIN or a native sign-in within `GROWN_UP_FRESH_PIN_MS`. */
  fresh: boolean;
  /** The screen was entered from outside the account routes (the route under it is not an account route). */
  enteredFromOutside: boolean;
  /** This mount has shown the screen's content. */
  opened: boolean;
  /** This mount asked the typed PIN, and this is the decision after it. */
  askedPin: boolean;
  /** Sign in again is waiting (the lock's button, or `SignIn { again }`). */
  again: boolean;
  /**
   * The grown-up session's 15 minutes from the PIN are over (`parentGateOpenedAt` absent or too old, OA-D5). Read
   * only once the screen has opened: an open account screen never outlives its session.
   */
  sessionLapsed: boolean;
}

export type GateLockCause = Exclude<AccountLockCause, 'needs_pin'>;

export type GateStep =
  | { kind: 'wait' }
  | { kind: 'open' }
  | { kind: 'to_sign_in' }
  | { kind: 'to_home' }
  | { kind: 'ask_pin' }
  | { kind: 'leave' }
  | { kind: 'setup' }
  | { kind: 'sign_out_then_sign_in' }
  | { kind: 'close' }
  | { kind: 'locked'; cause: GateLockCause; action: 'try_again' | 'back' | 'sign_in_again' };

const CANT_CHECK: GateStep = { kind: 'locked', cause: 'unknown', action: 'try_again' };

export function gateStep(input: GateDecisionInput): GateStep {
  const { gate } = input;
  // Row NS-4 review: an open screen whose session lapsed closes the session (the area goes; the next entry asks again).
  if (input.opened && input.sessionLapsed) return { kind: 'close' };
  // `unknown` and `nopin` are decided by `accountLock` before anything Clerk says; any other state needs Clerk.
  if (gate.state !== 'unknown' && gate.state !== 'nopin') {
    if (input.clerk === 'off') return CANT_CHECK;
    if (input.clerk === 'loading') return { kind: 'wait' };
  }
  const lock = accountLock({
    gate,
    signedIn: input.signedIn,
    signedInThisVisit: input.signedInThisVisit,
    trust: input.trust,
    retrustPending: input.retrustPending,
    fresh: input.fresh,
    fromOutside: input.enteredFromOutside && !input.opened,
  });
  switch (lock.kind) {
    case 'needs_pin':
      return { kind: 'setup' };
    case 'verify_pin':
      return input.askedPin ? { kind: 'leave' } : { kind: 'ask_pin' };
    case 'locked':
      if (input.again && lock.action === 'sign_in_again') {
        if (input.fresh) return { kind: 'sign_out_then_sign_in' };
        if (!input.askedPin) return { kind: 'ask_pin' };
      }
      return { kind: 'locked', cause: lock.cause, action: lock.action };
    case 'sign_in':
      return input.screen === 'sign_in' ? { kind: 'open' } : { kind: 'to_sign_in' };
    case 'home':
      return input.screen === 'home' || input.opened ? { kind: 'open' } : { kind: 'to_home' };
  }
}

/** `auth.native.lock`'s cause for a step, or null for a step that is no locked decision (section 15). */
export function lockCauseOf(step: GateStep): AccountLockCause | null {
  if (step.kind === 'locked') return step.cause;
  if (step.kind === 'setup') return 'needs_pin';
  return null;
}

/** The account routes of the nested Grown-up area stack (rows NS-3 to NS-6 add theirs). */
export const ACCOUNT_ROUTE_NAMES: ReadonlySet<string> = new Set(['SignIn', 'AccountHome', 'AccountLearnerReport', 'AccountSpace', 'AccountSchool', 'AccountClassReport']);

/**
 * Whether the account screen with `key` was entered from outside the account routes (ND-5): the route under it in
 * its stack is not an account route (the Grown-up area's dashboard), or there is none (the stack's first route,
 * opened from the chooser or Welcome). A screen not found in the state counts as entered from outside (fail closed).
 */
export function enteredFromOutside(routes: readonly { key: string; name: string }[], key: string): boolean {
  const index = routes.findIndex((r) => r.key === key);
  if (index <= 0) return true;
  return !ACCOUNT_ROUTE_NAMES.has(routes[index - 1]!.name);
}
