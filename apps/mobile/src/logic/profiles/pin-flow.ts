/**
 * How the PIN screen is entered — F-LEARN-001 §3.4, §3.5. Pure: the screen
 * passes its route params and what the account store holds.
 */
export type PinMode = 'setup-1' | 'setup-2' | 'verify';

/**
 * Which Forgot PIN path led to a new-PIN screen; carried so telemetry can name it. [OA] `sign_in`: the console's
 * sign-in reset ticket (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.5), which also titles the screen.
 */
export type PinResetMethod = 'rescue_code' | 'wait' | 'sign_in';

/**
 * The destination of the PIN screen opened for the grown-up area on the app host (F-APP-001
 * section 3.9): the lock's "Use the grown-up PIN" and, from A-7, the Profile row, the dashboard
 * card and the Plan screen.
 */
export const GROWN_UP_AREA = 'GrownUpArea';

export interface PinRouteParams {
  /**
   * `'setup'` opens creation even when a PIN is stored (Forgot PIN, or a deliberate setup). [OA] `'change'` asks the
   * current PIN first and then opens creation (Change PIN on the reset-by-wait notice when the last PIN is older than
   * `GROWN_UP_FRESH_PIN_MS`, OA-D21).
   */
  mode?: 'setup' | 'change';
  via?: PinResetMethod;
  /** Where the screen continues; only `GrownUpArea` changes how it opens. */
  next?: string;
}

/** Whether the screen was opened for the grown-up area. */
export function forGrownUpArea(params: PinRouteParams): boolean {
  return params.next === GROWN_UP_AREA;
}

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D21 (row OA-4a): the chooser's **Cancel the wait**. It only checks the
 * PIN: a correct one clears the pending 24-hour wait and returns to the chooser, opening nothing (CS-4).
 */
export const CANCEL_RESET = 'CancelReset';

/** [OA] Whether the screen was opened by Cancel the wait. */
export function forCancelReset(params: PinRouteParams): boolean {
  return params.next === CANCEL_RESET;
}

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 6.3 (row OA-5): a locked learner tile. Verify only, through
 * `verifyForLockedProfile`: a correct PIN opens that learner (`setActive`, then Home) and never a grown-up session
 * (CS-3). It never creates a PIN; Forgot PIN? stays and leads to the reset paths, whose new PIN then opens the learner.
 */
export const LOCKED_PROFILE = 'LockedProfile';

/** [OA] Whether the screen was opened by a locked tile. */
export function forLockedProfile(params: PinRouteParams): boolean {
  return params.next === LOCKED_PROFILE;
}

/**
 * [OA] OA-D5b (3), section 8.4 (row OA-5): a grown-up control that changes who is on the device (the Edit profile
 * lock switch) asks the PIN again when the last one is older than `GROWN_UP_FRESH_PIN_MS`. Verify only, no Forgot
 * PIN?: a correct PIN marks a fresh PIN and goes back to the control, which then applies the change. It never creates
 * or resets a PIN.
 */
export const FRESH_PIN = 'FreshPin';

/** [OA] Whether the screen was opened for a fresh PIN. */
export function forFreshPin(params: PinRouteParams): boolean {
  return params.next === FRESH_PIN;
}

/**
 * The step the screen opens on. `GrownUpArea` never creates or resets a PIN (F-APP-001 section
 * 3.9): it always verifies, whatever `mode` says, so a child cannot make a PIN that opens the
 * grown-up area. With no PIN stored it shows `grownUpAreaNoPin` instead of the pad.
 */
export function initialPinMode(params: PinRouteParams, storedHash: string | null): PinMode {
  if (forGrownUpArea(params) || forCancelReset(params) || forFreshPin(params)) return 'verify';
  // [OA] A locked tile never opens setup by itself (no Forgot PIN shortcut to setup): only the reset paths' new PIN.
  if (forLockedProfile(params)) return params.mode === 'setup' && params.via !== undefined ? 'setup-1' : 'verify';
  if (params.mode === 'change') return storedHash === null ? 'setup-1' : 'verify';
  return params.mode === 'setup' || storedHash === null ? 'setup-1' : 'verify';
}

/**
 * "Forgot PIN?" exists only where a PIN is being checked, and never for the grown-up area (no reset from there), for
 * Cancel the wait ([OA]: a reset is already waiting; this screen only stops it) or for a fresh PIN ([OA] row OA-5: a
 * grown-up inside the Grown-up area changes the PIN there).
 */
export function showForgotPin(mode: PinMode, params: PinRouteParams = {}): boolean {
  return mode === 'verify' && !forGrownUpArea(params) && !forCancelReset(params) && !forFreshPin(params);
}

/**
 * [OA] A destination that checks a PIN but has none to check (CS-4): a locked tile (a lock without a PIN is void, so
 * the learner opens) and a fresh PIN (the control is disabled without a PIN, so there is nothing to confirm). A hash
 * that could not be read (`hashReadFailed`) is not "no PIN": nothing is void then (fail closed, section 13.2).
 */
export function voidWithoutPin(params: PinRouteParams, storedHash: string | null, hashReadFailed = false): boolean {
  return storedHash === null && !hashReadFailed && (forFreshPin(params) || (forLockedProfile(params) && params.mode !== 'setup'));
}

/** The grown-up area on a device with no PIN stored: one line and Continue to the grown-up page, no pad. */
export function grownUpAreaNoPin(params: PinRouteParams, storedHash: string | null): boolean {
  return forGrownUpArea(params) && storedHash === null;
}

/** The `where` of `pin.created` for a PIN stored by this screen (the first-run card reports `first_run` itself). */
export function pinCreatedWhere(params: PinRouteParams): 'gate' | 'reset' | 'optional' {
  if (params.via !== undefined) return 'reset';
  return params.mode === 'setup' || params.mode === 'change' ? 'optional' : 'gate';
}

/**
 * [OA] After a correct PIN, `'change'` goes on to create the new PIN instead of to the destination (never for Cancel
 * the wait, a fresh PIN or a locked tile: those only check the PIN, row OA-5).
 */
export function verifiedGoesToSetup(params: PinRouteParams): boolean {
  return (
    params.mode === 'change' && !forGrownUpArea(params) && !forCancelReset(params) && !forFreshPin(params) && !forLockedProfile(params)
  );
}
