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
 * The step the screen opens on. `GrownUpArea` never creates or resets a PIN (F-APP-001 section
 * 3.9): it always verifies, whatever `mode` says, so a child cannot make a PIN that opens the
 * grown-up area. With no PIN stored it shows `grownUpAreaNoPin` instead of the pad.
 */
export function initialPinMode(params: PinRouteParams, storedHash: string | null): PinMode {
  if (forGrownUpArea(params) || forCancelReset(params)) return 'verify';
  if (params.mode === 'change') return storedHash === null ? 'setup-1' : 'verify';
  return params.mode === 'setup' || storedHash === null ? 'setup-1' : 'verify';
}

/**
 * "Forgot PIN?" exists only where a PIN is being checked, and never for the grown-up area (no reset from there) or
 * for Cancel the wait ([OA]: a reset is already waiting; this screen only stops it).
 */
export function showForgotPin(mode: PinMode, params: PinRouteParams = {}): boolean {
  return mode === 'verify' && !forGrownUpArea(params) && !forCancelReset(params);
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

/** [OA] After a correct PIN, `'change'` goes on to create the new PIN instead of to the destination (never for Cancel the wait). */
export function verifiedGoesToSetup(params: PinRouteParams): boolean {
  return params.mode === 'change' && !forGrownUpArea(params) && !forCancelReset(params);
}
