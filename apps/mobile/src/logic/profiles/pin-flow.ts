/**
 * How the PIN screen is entered — F-LEARN-001 §3.4, §3.5. Pure: the screen
 * passes its route params and what the account store holds.
 */
export type PinMode = 'setup-1' | 'setup-2' | 'verify';

/** Which Forgot PIN path led to a new-PIN screen; carried so telemetry can name it. */
export type PinResetMethod = 'rescue_code' | 'wait';

/**
 * The destination of the PIN screen opened for the grown-up area on the app host (F-APP-001
 * section 3.9): the lock's "Use the grown-up PIN" and, from A-7, the Profile row, the dashboard
 * card and the Plan screen.
 */
export const GROWN_UP_AREA = 'GrownUpArea';

export interface PinRouteParams {
  /** `'setup'` opens creation even when a PIN is stored (Forgot PIN, or a deliberate setup). */
  mode?: 'setup';
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
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 5.3, CS-4 (row OA-4b): the chooser's Family, Teacher, School and Sign in
 * as a grown-up rows (`PinEntry.use`). Verify only, like `GrownUpArea`: a correct PIN hands off to that use's page
 * (`openGrownUpArea({ via: 'chooser', target })`); it never creates or resets a PIN.
 */
export const GROWN_UP_USE = 'GrownUpUse';

/** [OA] Whether the screen was opened by a use row on the chooser. */
export function forGrownUpUse(params: PinRouteParams): boolean {
  return params.next === GROWN_UP_USE;
}

/**
 * The step the screen opens on. `GrownUpArea` never creates or resets a PIN (F-APP-001 section
 * 3.9): it always verifies, whatever `mode` says, so a child cannot make a PIN that opens the
 * grown-up area. With no PIN stored it shows `grownUpAreaNoPin` instead of the pad.
 */
export function initialPinMode(params: PinRouteParams, storedHash: string | null): PinMode {
  if (forGrownUpArea(params) || forGrownUpUse(params) || forCancelReset(params)) return 'verify';
  return params.mode === 'setup' || storedHash === null ? 'setup-1' : 'verify';
}

/**
 * "Forgot PIN?" exists only where a PIN is being checked, and never for the grown-up area (no reset from there) or
 * for Cancel the wait ([OA]: a reset is already waiting; this screen only stops it).
 */
export function showForgotPin(mode: PinMode, params: PinRouteParams = {}): boolean {
  return mode === 'verify' && !forGrownUpArea(params) && !forGrownUpUse(params) && !forCancelReset(params);
}

/**
 * The grown-up area on a device with no PIN stored: one line and Continue to the grown-up page, no pad. [OA] A use row
 * of the chooser too (CS-4): its Continue opens the sign-in page.
 */
export function grownUpAreaNoPin(params: PinRouteParams, storedHash: string | null): boolean {
  return (forGrownUpArea(params) || forGrownUpUse(params)) && storedHash === null;
}

/** The `where` of `pin.created` for a PIN stored by this screen (the first-run card reports `first_run` itself). */
export function pinCreatedWhere(params: PinRouteParams): 'gate' | 'reset' | 'optional' {
  if (params.via !== undefined) return 'reset';
  return params.mode === 'setup' ? 'optional' : 'gate';
}
