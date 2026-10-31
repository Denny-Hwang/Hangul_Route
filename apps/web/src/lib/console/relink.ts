import type { SpaceKind } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ApiError } from './api';

/** Re-link approval helpers — F-TCH-001 §10.1 (wireframe console/relink-approval). */
const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;

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

/**
 * "asked just now" · "asked 2 min ago" · "asked 4 hours ago" · "asked 3 days ago", in `locale`: from an hour on the
 * time rolls up (AMENDMENTS-GROWNUP-UX T12, row GX-12), so a page never reads "240 min ago".
 */
export function requestedLabel(requestedAt: string, now: Date, locale: UiLocale = DEFAULT_LOCALE): string {
  const words = getMessages(locale).console.relink;
  const ms = now.getTime() - Date.parse(requestedAt);
  if (Number.isNaN(ms) || ms < MIN_MS) return words.askedJustNow;
  if (ms < HOUR_MS) return words.askedAgo(Math.floor(ms / MIN_MS));
  if (ms < DAY_MS) return words.askedHoursAgo(Math.floor(ms / HOUR_MS));
  return words.askedDaysAgo(Math.floor(ms / DAY_MS));
}

/** The platforms the learner app sends with a request (`Platform.OS`), each with a name in `console.relink.platform`. */
const PLATFORMS = ['ios', 'android', 'web'] as const;
type RelinkPlatform = (typeof PLATFORMS)[number];
const isPlatform = (value: string): value is RelinkPlatform => (PLATFORMS as readonly string[]).includes(value);

/** "iPhone or iPad" · "Android" · "Web" for what the learner app sends; the shipped "device" for anything else (GX-12). */
export function platformLabel(platform: string | null | undefined, locale: UiLocale = DEFAULT_LOCALE): string {
  const words = getMessages(locale).console.relink;
  const key = (platform ?? '').trim().toLowerCase();
  return isPlatform(key) ? words.platform[key] : words.device;
}

/** A small margin past the minute, so the timer wakes after the label has changed, not just before. */
const TICK_MARGIN_MS = 250;

/**
 * How long until any minute label of these requests changes: a countdown ("expires in 8 min") ticking down or an
 * "asked 2 min ago" ticking up (GX-12: the countdown moves once a minute, even when a read fails). At most a minute
 * (plus the margin); a whole minute when nothing on the page counts minutes.
 */
export function nextMinuteTick(requests: ReadonlyArray<{ requestedAt: string; expiresAt: string }>, now: Date): number {
  let soonest = Number.POSITIVE_INFINITY;
  for (const request of requests) {
    const left = Date.parse(request.expiresAt) - now.getTime();
    if (left > 0) soonest = Math.min(soonest, left % MIN_MS || MIN_MS);
    const since = now.getTime() - Date.parse(request.requestedAt);
    if (since >= 0 && since < HOUR_MS) soonest = Math.min(soonest, MIN_MS - (since % MIN_MS));
  }
  return Number.isFinite(soonest) ? soonest + TICK_MARGIN_MS : MIN_MS;
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
  /** `spaceKind`: a family's denial names a grown-up, not a teacher (AMENDMENTS-GROWNUP-UX P8). */
  | { kind: 'approved' | 'denied'; name: string; spaceKind?: SpaceKind }
  | { kind: 'decideFailed'; result: { error: ApiError; code?: string } }
  | { kind: 'issueFailed' };

/** The words for a `RelinkNote`, in `locale`. */
export function relinkNoteText(note: RelinkNote, locale: UiLocale = DEFAULT_LOCALE): string {
  const words = getMessages(locale).console.relink;
  if (note.kind === 'approved') return words.approved(note.name);
  if (note.kind === 'denied') return note.spaceKind === 'family' ? words.deniedFamily(note.name) : words.denied(note.name);
  if (note.kind === 'decideFailed') return decideFailureNote(note.result, locale);
  return words.issueFailed;
}

export const RELINK_REFRESH_MS = 10_000;
