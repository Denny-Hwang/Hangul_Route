import { normalizeRescueCode } from '@hangul-route/content-schema';

/**
 * Rescue Code helpers for the UI — F-RESTORE-001 §3.4. Three fields on
 * screen (WORD · WORD · 1234) map to one normalized code.
 */
export interface RescueCodeParts {
  first: string;
  second: string;
  digits: string;
}

export function splitRescueCode(code: string): RescueCodeParts | null {
  const n = normalizeRescueCode(code);
  if (!n) return null;
  const [first = '', second = '', digits = ''] = n.split('-');
  return { first, second, digits };
}

export function joinRescueCode(parts: RescueCodeParts): string | null {
  return normalizeRescueCode(`${parts.first}-${parts.second}-${parts.digits}`);
}

/** Field-level cleanup while typing: letters only for words, digits only for the number. */
export function cleanWord(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10);
}

export function cleanDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4);
}

export type ClaimErrorCode = 'code_not_found' | 'too_many_attempts' | 'network' | 'invalid' | 'unknown';

/** Calm, adult-facing copy; never blames the child. */
export function claimErrorMessage(code: ClaimErrorCode): string {
  switch (code) {
    case 'code_not_found':
      return 'Check the code and try again.';
    case 'too_many_attempts':
      return "Let's wait a few minutes before trying again.";
    case 'network':
      return 'This needs internet. Try again when you are online.';
    case 'invalid':
      return 'A rescue code looks like TIGER-MOON-4821.';
    default:
      return 'Something went wrong. Try again in a moment.';
  }
}
