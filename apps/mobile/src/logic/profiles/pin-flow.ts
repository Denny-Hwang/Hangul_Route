/**
 * How the PIN screen is entered — F-LEARN-001 §3.4, §3.5. Pure: the screen
 * passes its route params and what the account store holds.
 */
export type PinMode = 'setup-1' | 'setup-2' | 'verify';

/** Which Forgot PIN path led to a new-PIN screen; carried so telemetry can name it. */
export type PinResetMethod = 'rescue_code' | 'wait';

export interface PinRouteParams {
  /** `'setup'` opens creation even when a PIN is stored (Forgot PIN, or a deliberate setup). */
  mode?: 'setup';
  via?: PinResetMethod;
}

export function initialPinMode(params: PinRouteParams, storedHash: string | null): PinMode {
  return params.mode === 'setup' || storedHash === null ? 'setup-1' : 'verify';
}

/** "Forgot PIN?" exists only where a PIN is being checked. */
export function showForgotPin(mode: PinMode): boolean {
  return mode === 'verify';
}

/** The `where` of `pin.created` for a PIN stored by this screen (the first-run card reports `first_run` itself). */
export function pinCreatedWhere(params: PinRouteParams): 'gate' | 'reset' | 'optional' {
  if (params.via !== undefined) return 'reset';
  return params.mode === 'setup' ? 'optional' : 'gate';
}
