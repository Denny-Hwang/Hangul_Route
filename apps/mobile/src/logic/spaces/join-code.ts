import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH, normalizeJoinCode } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';

/**
 * Join-code helpers for `sync/join-space` — F-SPACE-001 §3.5. The field
 * only ever holds alphabet characters; the server decides everything else.
 */
const ALLOWED = new Set(JOIN_CODE_ALPHABET);

/** Keystroke cleanup: upper case, alphabet only, at most six characters. */
export function cleanJoinCode(raw: string): string {
  return [...raw.toUpperCase()].filter((ch) => ALLOWED.has(ch)).join('').slice(0, JOIN_CODE_LENGTH);
}

export function isCompleteJoinCode(value: string): boolean {
  return normalizeJoinCode(value) !== null;
}

/**
 * The widest a code character draws, in ems: a bold W, the alphabet's widest letter, is just under one em in the
 * system fonts, so one em is the worst case.
 */
export const CODE_GLYPH_EM = 1;

/**
 * The code field's font size (Join a class, Move to another class): the display size at the chosen text size
 * (AMENDMENTS-DISPLAY-NAV section 4), but never larger than lets a whole code of the widest letter fit the field's
 * inner width with its letter spacing, so a code is never cut at a large text size on a narrow phone (the fit rule:
 * no text is clipped). Before the field is laid out (`innerWidth` 0) the display size stands.
 */
export function codeFieldFontSize(display: number, innerWidth: number, letterSpacing: number, length: number = JOIN_CODE_LENGTH): number {
  if (!(innerWidth > 0) || length <= 0) return display;
  const fits = Math.floor((innerWidth - length * letterSpacing) / (length * CODE_GLYPH_EM));
  return Math.max(1, Math.min(display, fits));
}

export type JoinErrorCode =
  | 'code_not_found'
  | 'code_expired'
  | 'cap_learner'
  | 'cap_class'
  | 'not_joinable'
  | 'learner_not_found'
  | 'already_bound'
  | 'too_many_attempts'
  | 'network'
  | 'invalid'
  | 'unknown'
  | 'off';

/**
 * Calm copy for the learner; names the fix, never a person (F-LEARN-001 §3.9).
 * The words come from the caregiver subtree the screen passes in (F-I18N-001
 * §3.4 rule 3): `join.errors`, the `retry` lines Restore shares, and the two
 * audience-free lines of `audience.shared`.
 */
export function joinErrorMessage(code: JoinErrorCode, m: Pick<Messages['caregiver'], 'join' | 'retry' | 'audience'>): string {
  switch (code) {
    case 'code_not_found':
      return m.join.errors.codeNotFound;
    case 'code_expired':
      return m.join.errors.codeExpired;
    case 'cap_learner':
      return m.audience.shared.joinCodeFull;
    case 'cap_class':
      return m.join.errors.classFull;
    case 'not_joinable':
      return m.audience.shared.joinCodeNotForLearners;
    case 'learner_not_found':
      return m.join.errors.learnerGone;
    case 'already_bound':
      return m.join.errors.alreadyOnDevice;
    case 'too_many_attempts':
      return m.retry.tooManyAttempts;
    case 'network':
      return m.retry.offline;
    case 'invalid':
      return m.join.errors.badFormat;
    case 'off':
      return m.join.errors.off;
    default:
      return m.retry.unknown;
  }
}

/** Errors that mean "fix the code" (stay on the code step) versus "stop here". */
export function isCodeError(code: JoinErrorCode): boolean {
  return code === 'code_not_found' || code === 'code_expired' || code === 'invalid' || code === 'not_joinable';
}
