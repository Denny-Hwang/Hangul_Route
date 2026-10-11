import { normalizeRescueCode } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';

/**
 * Rescue Code helpers for the UI — F-RESTORE-001 §3.4. One field takes the
 * whole code as written on paper or pasted from a message: new codes are four
 * words + six digits (SEC-5), codes issued earlier two words + four digits.
 * `normalizeRescueCode` decides what is valid; these only tidy and describe.
 * The words come from the caregiver message subtree the screen passes in
 * (F-I18N-001 §3.4 rule 3).
 */

/** Longest code (4 × 10 letters + 6 digits + 4 separators = 50) plus slack for extra spaces. */
export const RESCUE_INPUT_MAX = 64;

/** Field cleanup while typing: upper case; letters, digits, hyphens and single spaces only. */
export function cleanRescueInput(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^ /, '')
    .slice(0, RESCUE_INPUT_MAX);
}

/** "four words + 6 digits" — the caption under a code a parent is copying down. */
export function rescueCodeHint(code: string, m: Pick<Messages['caregiver']['saveProgress'], 'codeShape'>): string | null {
  const normalized = normalizeRescueCode(code);
  if (!normalized) return null;
  const words = normalized.split('-').length - 1; // 4, or 2 for a code issued before SEC-5
  const digits = normalized.length - normalized.lastIndexOf('-') - 1;
  return m.codeShape(words, digits);
}

/**
 * The rows a code is shown in on sync/save-progress: one word per row, the
 * number last. A four-word code is up to 50 characters, and at display size a
 * 10-letter word does not fit on one 320 px line, so a single wrapping string
 * broke words mid-way (LIGHTHOUS / E-). Anything that is not a code is shown
 * as stored.
 */
export function rescueCodeLines(code: string): string[] {
  const normalized = normalizeRescueCode(code);
  return normalized ? normalized.split('-') : [code];
}

export type ClaimErrorCode = 'code_not_found' | 'too_many_attempts' | 'network' | 'invalid' | 'unknown';

/**
 * Calm, adult-facing copy; never blames the child. The invalid-code line is the
 * one the Forgot PIN screen shows too (`pin.reset.failure.badFormat`).
 */
export function claimErrorMessage(code: ClaimErrorCode, m: Pick<Messages['caregiver'], 'restore' | 'retry' | 'pin'>): string {
  switch (code) {
    case 'code_not_found':
      return m.restore.code.notFound;
    case 'too_many_attempts':
      return m.retry.tooManyAttempts;
    case 'network':
      return m.retry.offline;
    case 'invalid':
      return m.pin.reset.failure.badFormat;
    default:
      return m.retry.unknown;
  }
}

/**
 * Rows the code field needs. Wide letters can leave one word per row on a
 * narrow phone, and fonts differ per device, so plan for the worst case:
 * one row per word-or-number typed so far (two rows while it is short,
 * five for a full four-word code).
 */
export function rescueInputRows(text: string): number {
  const parts = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(5, Math.max(2, parts));
}
