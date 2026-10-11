import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH, normalizeJoinCode } from '@hangul-route/content-schema';
import { NEUTRAL_COPY } from '../audience-copy';

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

/** Calm copy for the learner; names the fix, never a person (F-LEARN-001 §3.9). */
export function joinErrorMessage(code: JoinErrorCode): string {
  switch (code) {
    case 'code_not_found':
      return "That code didn't work. Check it with your teacher.";
    case 'code_expired':
      return 'That code is too old. Ask for a new one.';
    case 'cap_learner':
      return NEUTRAL_COPY.joinCodeFull;
    case 'cap_class':
      return 'This class is full. Ask your teacher.';
    case 'not_joinable':
      return NEUTRAL_COPY.joinCodeNotForLearners;
    case 'learner_not_found':
      return 'That name is not in this class anymore. Ask your teacher.';
    case 'already_bound':
      return 'This device already has that learner — switch profiles instead.';
    case 'too_many_attempts':
      return "Let's wait a few minutes before trying again.";
    case 'network':
      return 'This needs internet. Try again when you are online.';
    case 'invalid':
      return 'A code has 6 letters or numbers.';
    case 'off':
      return 'Joining a class is not set up on this build.';
    default:
      return 'Something went wrong. Try again in a moment.';
  }
}

/** Errors that mean "fix the code" (stay on the code step) versus "stop here". */
export function isCodeError(code: JoinErrorCode): boolean {
  return code === 'code_not_found' || code === 'code_expired' || code === 'invalid' || code === 'not_joinable';
}
