import type { SpaceKind } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ApiError } from './api';

/** Re-link approval helpers — F-TCH-001 §10.1 (wireframe console/relink-approval). */
const MIN_MS = 60_000;

export function minutesLeft(expiresAt: string, now: Date): number {
  const ms = Date.parse(expiresAt) - now.getTime();
  return Number.isNaN(ms) ? 0 : Math.max(0, Math.ceil(ms / MIN_MS));
}

/** "expires in 8 min" · "expires in 1 min" · "expired", in `locale`. */
export function expiresLabel(expiresAt: string, now: Date, locale: UiLocale = DEFAULT_LOCALE): string {
  const words = getMessages(locale).console.relink;
  const left = minutesLeft(expiresAt, now);
  return left === 0 ? words.expired : words.expiresIn(left);
}

/** "asked just now" · "asked 2 min ago", in `locale`. */
export function requestedLabel(requestedAt: string, now: Date, locale: UiLocale = DEFAULT_LOCALE): string {
  const words = getMessages(locale).console.relink;
  const ms = now.getTime() - Date.parse(requestedAt);
  if (Number.isNaN(ms) || ms < MIN_MS) return words.askedJustNow;
  return words.askedAgo(Math.floor(ms / MIN_MS));
}

/** Who may delete a learner's data from this space (F-TCH-001 §10.3). */
export function canDeleteLearnerData(kind: SpaceKind, consentMode: 'parent' | 'school'): boolean {
  if (kind === 'family') return true;
  return kind === 'class' && consentMode === 'school';
}

/**
 * Who may issue a new rescue code from the console (SEC-4): a code opens the
 * learner's whole snapshot, so it follows snapshot.read — family owners and
 * caregivers. The server refuses class and school roles with 403.
 */
export function canReissueRescueCode(kind: SpaceKind): boolean {
  return kind === 'family';
}

/**
 * The note after a failed approve / deny. A 409 usually means the request
 * closed meanwhile; a learner who left the class (409 `not_a_member`,
 * F-SPACE-002 T-1b) is not a closed request, so it gets the generic error.
 */
export function decideFailureNote(result: { error: ApiError; code?: string }, locale: UiLocale = DEFAULT_LOCALE): string {
  const words = getMessages(locale).console.relink;
  if (result.error === 'unknown' && result.code !== 'not_a_member') return words.closed;
  return words.failed;
}

/** What the re-link page last did; kept as data and worded at render time, so it follows the header language select. */
export type RelinkNote =
  | { kind: 'approved' | 'denied'; name: string }
  | { kind: 'decideFailed'; result: { error: ApiError; code?: string } }
  | { kind: 'issueFailed' };

/** The words for a `RelinkNote`, in `locale`. */
export function relinkNoteText(note: RelinkNote, locale: UiLocale = DEFAULT_LOCALE): string {
  const words = getMessages(locale).console.relink;
  if (note.kind === 'approved') return words.approved(note.name);
  if (note.kind === 'denied') return words.denied(note.name);
  if (note.kind === 'decideFailed') return decideFailureNote(note.result, locale);
  return words.issueFailed;
}

export const RELINK_REFRESH_MS = 10_000;
