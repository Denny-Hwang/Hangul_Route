import { PIN_LENGTH } from '../profiles/pin-hash';

/**
 * Create-and-confirm PIN field inside the onboarding grown-up card —
 * F-LEARN-001 §3.4. Pure state machine; the card only paints it (dots, the
 * `PinPad`, the "PIN set" line). 4 digits entered twice; a mismatch clears both
 * entries and starts over with a calm line, never a red state.
 */
export type PinSetupStage = 'create' | 'confirm' | 'set';

export interface PinSetupState {
  stage: PinSetupStage;
  /** Digits typed in the current stage. */
  entry: string;
  /** The first entry, kept while the learner types it again. */
  first: string;
  /** The confirmed PIN, once `stage === 'set'`. */
  pin: string | null;
  /** The second entry did not match; shown until the next digit. */
  mismatch: boolean;
}

export const PIN_SETUP_START: PinSetupState = { stage: 'create', entry: '', first: '', pin: null, mismatch: false };

/** Same wording as the PIN screen (`PinEntryScreen`). */
export const PIN_SETUP_MISMATCH = "Those didn't match. Let's start again.";

/** The pad's `onChange` landed: `next` is the full entry for the current stage. */
export function pinSetupChange(state: PinSetupState, next: string): PinSetupState {
  if (state.stage === 'set') return state;
  if (next.length < PIN_LENGTH) return { ...state, entry: next, mismatch: false };
  if (state.stage === 'create') return { stage: 'confirm', entry: '', first: next, pin: null, mismatch: false };
  if (next === state.first) return { stage: 'set', entry: '', first: state.first, pin: next, mismatch: false };
  return { ...PIN_SETUP_START, mismatch: true };
}

/** "Change": forget the confirmed PIN and start over. */
export function pinSetupRedo(): PinSetupState {
  return PIN_SETUP_START;
}
