import { FAMILY_LIFETIME_LEARNERS, JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH, normalizeJoinCode, type LookupSeat, type SpaceKind } from '@hangul-route/content-schema';
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
 * What the Join screen's code field starts with: the class join link's code (owner decision 2026-10-17), else the
 * family home's hand-off, each cleaned as typed keys are; null when neither holds anything.
 */
export function joinPrefill(linkCode: string | undefined, handoff: string | null): string | null {
  for (const raw of [linkCode, handoff]) {
    if (raw === undefined || raw === null) continue;
    const code = cleanJoinCode(raw);
    if (code !== '') return code;
  }
  return null;
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
  | 'cap_family'
  | 'cap_school'
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
export function joinErrorMessage(code: JoinErrorCode, m: Pick<Messages['caregiver'], 'join' | 'retry' | 'audience'>, cap?: number | null): string {
  switch (code) {
    case 'code_not_found':
      return m.join.errors.codeNotFound;
    case 'code_expired':
      return m.join.errors.codeExpired;
    case 'cap_learner':
      return m.audience.shared.joinCodeFull;
    case 'cap_class':
      return m.join.errors.classFull;
    // [SA] AMENDMENTS-SEATS-ADMINS section 3.4: the cap the Worker sent (`seat.cap`, `details.cap`), else the family cap.
    case 'cap_family':
      return m.join.errors.familyFull(cap ?? FAMILY_LIFETIME_LEARNERS);
    case 'cap_school':
      return m.join.errors.schoolFull;
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

/**
 * [SA] The at-cap refusal a lookup answer carries (AMENDMENTS-SEATS-ADMINS section 3.4), or null when the learner finds
 * room. `seat` decides when the Worker sent it (learner-aware: a member already holds its seat), and its `reason`
 * picks the line, not the kind of space; an older Worker sends only `full`, which was always the class cap. A seat
 * with no reason (never sent) falls back to the space's own cap. Advisory only: the `/join` is the gate.
 */
export function lookupRefusal(result: { kind: SpaceKind; full: boolean; seat: LookupSeat | null }): { code: 'cap_family' | 'cap_class' | 'cap_school'; cap: number | null } | null {
  if (result.seat) {
    if (!result.seat.full) return null;
    return { code: result.seat.reason ?? (result.kind === 'family' ? 'cap_family' : 'cap_class'), cap: result.seat.cap };
  }
  return result.full ? { code: 'cap_class', cap: null } : null;
}

/** Errors that mean "fix the code" (stay on the code step) versus "stop here". */
export function isCodeError(code: JoinErrorCode): boolean {
  return code === 'code_not_found' || code === 'code_expired' || code === 'invalid' || code === 'not_joinable';
}
