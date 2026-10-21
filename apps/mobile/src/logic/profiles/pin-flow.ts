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
 * The step the screen opens on. `GrownUpArea` never creates or resets a PIN (F-APP-001 section
 * 3.9): it always verifies, whatever `mode` says, so a child cannot make a PIN that opens the
 * grown-up area. With no PIN stored it shows `grownUpAreaNoPin` instead of the pad.
 */
export function initialPinMode(params: PinRouteParams, storedHash: string | null): PinMode {
  if (forGrownUpArea(params)) return 'verify';
  return params.mode === 'setup' || storedHash === null ? 'setup-1' : 'verify';
}

/** "Forgot PIN?" exists only where a PIN is being checked, and never for the grown-up area (no reset from there). */
export function showForgotPin(mode: PinMode, params: PinRouteParams = {}): boolean {
  return mode === 'verify' && !forGrownUpArea(params);
}

/** The grown-up area on a device with no PIN stored: one line and Continue to the grown-up page, no pad. */
export function grownUpAreaNoPin(params: PinRouteParams, storedHash: string | null): boolean {
  return forGrownUpArea(params) && storedHash === null;
}

/** The `where` of `pin.created` for a PIN stored by this screen (the first-run card reports `first_run` itself). */
export function pinCreatedWhere(params: PinRouteParams): 'gate' | 'reset' | 'optional' {
  if (params.via !== undefined) return 'reset';
  return params.mode === 'setup' ? 'optional' : 'gate';
}
