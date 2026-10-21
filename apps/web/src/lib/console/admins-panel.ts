import { formatDate, getMessages, DEFAULT_LOCALE, type UiLocale } from '@hangul-route/i18n';
import { browserStorage, readItem, writeItem, type KeyValueStorage } from '../i18n/safe-storage';
import type { AdminEventRow, AdminRow, AdminsView, ApiResult } from './api';

/**
 * [SA] View model of the Administrators panel on the school page (AMENDMENTS-SEATS-ADMINS section 6.6; wireframe
 * design/wireframes/console/admins-panel.md, mock design/screens/console/admins-panel.md). Pure, so each rule is
 * tested without a page: who sees what, when Invite shows, the owner's new-admin notice, the history lines and what a
 * refused action does. Names are data; nothing here builds a URL or sends telemetry.
 */

/** How long the owner's new-admin notice shows after an administrator joined (section 6.3 item 3). */
export const NEW_ADMIN_NOTICE_MS = 7 * 24 * 60 * 60 * 1000;
/** Got it on a notice, remembered per browser (`localStorage`, the safe storage wrapper): digests only, never an account id or a name. */
export const ADMIN_NOTICE_SEEN_KEY = 'hr:admin-notice-seen';
const SEEN_MAX = 20;

/** The panel's view of this account: the owner (full panel), an administrator (the list and Stop), or neither. */
export type PanelViewer = 'owner' | 'admin' | 'none';

export function panelViewer(view: Pick<AdminsView, 'owner' | 'admins'>, accountId: string): PanelViewer {
  if (view.owner.accountId === accountId) return 'owner';
  return view.admins.some((a) => a.accountId === accountId) ? 'admin' : 'none';
}

/** Admins plus open invites: an open invite holds a place (D12). */
export function placesTaken(view: Pick<AdminsView, 'admins' | 'invites'>): number {
  return view.admins.length + (view.invites?.length ?? 0);
}

/** **Invite an administrator**: the owner, a live school, a free place (section 6.6; an archived school answers `422`). */
export function inviteShown(view: Pick<AdminsView, 'admins' | 'invites' | 'limit'>, viewer: PanelViewer, archived: boolean): boolean {
  return viewer === 'owner' && !archived && placesTaken(view) < view.limit;
}

/** The full line instead of the button: the owner of a live school whose places are all taken or invited. */
export function fullShown(view: Pick<AdminsView, 'admins' | 'invites' | 'limit'>, viewer: PanelViewer, archived: boolean): boolean {
  return viewer === 'owner' && !archived && placesTaken(view) >= view.limit;
}

/** The shape of a remembered notice id: `n` and a 53-bit digest in base 36. Anything else in the record is dropped. */
const NOTICE_ID_RE = /^n[0-9a-z]{1,11}$/;

/**
 * The id Got it remembers for one admin's joining (section 6.3 item 3: an id, not PII). It is a one-way 53-bit digest
 * (cyrb53) of the account and the time it joined, so this browser never stores another person's account id, a name or
 * an email. `GET /:id/admins` carries no event id today; the digest stands in for it and changes when they join again.
 */
export function noticeId(admin: Pick<AdminRow, 'accountId' | 'joinedAt'>): string {
  const text = `${admin.accountId}@${admin.joinedAt}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `n${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`;
}

/**
 * The owner's new-admin notices: an administrator who joined in the last 7 days and still holds the role (they are in
 * the list), with the verified email the owner may check, not yet dismissed in this browser. Never for an admin caller
 * (they receive no email).
 */
export function newAdminNotices(admins: readonly AdminRow[], viewer: PanelViewer, now: Date, seen: ReadonlySet<string>): Array<AdminRow & { email: string }> {
  if (viewer !== 'owner') return [];
  return admins.flatMap((a) => {
    const age = now.getTime() - Date.parse(a.joinedAt);
    if (!(age >= 0 && age < NEW_ADMIN_NOTICE_MS) || seen.has(noticeId(a)) || typeof a.email !== 'string' || a.email === '') return [];
    return [{ ...a, email: a.email }];
  });
}

function localArea(): KeyValueStorage | null {
  return browserStorage('local');
}

/** The notices dismissed in this browser (lenient: a corrupt record reads as none). */
export function readSeenNotices(storage: KeyValueStorage | null = localArea()): Set<string> {
  try {
    const raw = JSON.parse(readItem(storage, ADMIN_NOTICE_SEEN_KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && NOTICE_ID_RE.test(x)) : []);
  } catch {
    return new Set();
  }
}

/** Got it: the notice's id joins the dismissed ones (the newest 20 kept). */
export function rememberNotice(id: string, storage: KeyValueStorage | null = localArea()): Set<string> {
  const seen = [...readSeenNotices(storage)].filter((x) => x !== id);
  seen.push(id);
  const kept = seen.slice(-SEEN_MAX);
  writeItem(storage, ADMIN_NOTICE_SEEN_KEY, JSON.stringify(kept));
  return new Set(kept);
}

/** The display name of a row; an account with neither name nor email reads "A former member", never an id. */
export function adminName(name: string | null | undefined, locale: UiLocale = DEFAULT_LOCALE): string {
  return typeof name === 'string' && name !== '' ? name : getMessages(locale).console.admins.history.someone;
}

/** "Oct 3" in the console language, local time. */
export function adminDay(iso: string, locale: UiLocale = DEFAULT_LOCALE): string {
  return formatDate(locale, iso, 'monthDay');
}

/** "Oct 25, 2026" in the console language, local time. */
export function adminDate(iso: string, locale: UiLocale = DEFAULT_LOCALE): string {
  return formatDate(locale, iso, 'monthDayYear');
}

/**
 * One history line (section 6.4): who did it, with the day. Joined, removed and left name the administrator (the
 * subject); the others name who acted. A kind this build cannot word (a newer Worker) is left out.
 */
export function historyLine(event: AdminEventRow, locale: UiLocale = DEFAULT_LOCALE): string | null {
  const h = getMessages(locale).console.admins.history;
  const day = adminDay(event.at, locale);
  if (day === '') return null;
  const actor = adminName(event.actorName, locale);
  const subject = adminName(event.subjectName ?? event.actorName, locale);
  switch (event.kind) {
    case 'admin_invite_created':
      return h.inviteCreated(actor, day);
    case 'admin_invite_revoked':
      return h.inviteRevoked(actor, day);
    case 'admin_joined':
      return h.joined(subject, day);
    case 'admin_removed':
      return h.removed(adminName(event.subjectName, locale), day);
    case 'admin_left':
      return h.left(subject, day);
    case 'renamed':
      return h.renamed(actor, day);
    case 'class_renamed':
      return h.renamedClass(actor, day);
    default:
      return null;
  }
}

/** The history lines, newest first, at most 20 (the Worker sends the last 20; order kept by time here). */
export function historyLines(events: readonly AdminEventRow[] | undefined, locale: UiLocale = DEFAULT_LOCALE): string[] {
  return [...(events ?? [])]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 20)
    .flatMap((e) => {
      const line = historyLine(e, locale);
      return line ? [line] : [];
    });
}

/**
 * What a Revoke, Remove or Stop answer means for the panel: done; `reload` for a `404`, `403` or `409` (already done
 * in another tab, the viewer's own role just removed, `invite_used`, `owner`), where a retry cannot help; `failed` only
 * for a network failure or a `5xx` (`console.admins.actionFailed`, nothing in the list changes).
 */
export function actionOutcome(result: ApiResult<unknown>): 'done' | 'reload' | 'failed' {
  if (result.ok) return 'done';
  if (result.status === 404 || result.status === 403 || result.status === 409) return 'reload';
  return 'failed';
}

/** Where Stop being an administrator lands: the teacher home while they stay a teacher, else the router's grown-up home. */
export function afterLeaving(stays: 'teacher' | 'none'): '/teach/home' | '/teach' {
  return stays === 'teacher' ? '/teach/home' : '/teach';
}
