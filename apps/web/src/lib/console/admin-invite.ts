import { ADMIN_INVITE_PATH, ADMIN_INVITE_TOKEN_RE, parseAdminInvite } from '@hangul-route/content-schema';
import { browserStorage, readItem, removeItem, writeItem, type KeyValueStorage } from '../i18n/safe-storage';
import type { AdminInviteAccepted, AdminInvitePreview, ApiResult } from './api';

/**
 * [SA] The administrator invite on the console (AMENDMENTS-SEATS-ADMINS section 6.6 "Accept page", steps 1 to 8;
 * wireframe design/wireframes/console/admin-invite-accept.md). The owner's link is `/account/invite#t=<token>`, and
 * every console page sits inside `GrownUpGate`, whose sign-in redirect keeps the path and the query only. So the
 * gate's first render stashes the token in this tab's `sessionStorage` (`hr:admin-invite`, through the safe storage
 * wrapper) and strips the fragment from the address, before any redirect, lock or page runs. From then on the token
 * lives only in that stash and in the JSON body of preview and accept: never in a URL the app builds (`next`, Clerk's
 * redirect), a page title or telemetry.
 *
 * The stash lasts 30 minutes. It is removed after accept, a final refusal, Not now, Go to my home (every state), every
 * sign-out other than Use another account (`clearGrownUpTab`) and a session that ends on its own (`GrownUpGate`);
 * Try again, Use another account and the lock's re-auth keep it.
 */
export const ADMIN_INVITE_STASH_KEY = 'hr:admin-invite';
/** How long a stashed invite waits for its sign-in (section 6.6 step 1). */
export const ADMIN_INVITE_STASH_MS = 30 * 60_000;

/** The invite page, as a static export serves it: `/account/invite`, with a trailing slash, or `.html`. */
export function isAdminInvitePath(pathname: string): boolean {
  return pathname === ADMIN_INVITE_PATH || pathname === `${ADMIN_INVITE_PATH}/` || pathname === `${ADMIN_INVITE_PATH}.html`;
}

function sessionArea(): KeyValueStorage | null {
  return browserStorage('session');
}

/** The part of the address the capture reads. */
export interface InviteLocation {
  pathname: string;
  search: string;
  hash: string;
}

/**
 * Step 1, the stash: on the invite page, a fragment that holds a token is written to this tab (`{ token, savedAt }`).
 * Idempotent; it never touches another path. True when it stashed a token.
 */
/**
 * The stash when this tab's `sessionStorage` cannot hold it (unavailable, full or throwing): kept in memory for this
 * page load, so the fragment can still leave the address and the invite page still reads the token. It follows the
 * same 30 minutes and is removed with the stash.
 */
let memoryStash: { token: string; savedAt: number } | null = null;

export function captureAdminInvite(location: InviteLocation, storage: KeyValueStorage | null, now: number): boolean {
  if (!isAdminInvitePath(location.pathname)) return false;
  const token = parseAdminInvite(location.hash);
  if (token === null) return false;
  if (writeItem(storage, ADMIN_INVITE_STASH_KEY, JSON.stringify({ token, savedAt: now }))) memoryStash = null;
  else memoryStash = { token, savedAt: now };
  return true;
}

/** Step 1, the address: the invite page's path and query without its fragment, or null when there is nothing to strip. */
export function strippedInviteAddress(location: InviteLocation): string | null {
  if (!isAdminInvitePath(location.pathname) || location.hash === '') return null;
  return `${location.pathname}${location.search}`;
}

/** The stash against this tab's address and storage, for `GrownUpGate`'s first render; nothing outside a browser. */
export function captureAdminInviteHere(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const { pathname, search, hash } = window.location;
    return captureAdminInvite({ pathname, search, hash }, sessionArea(), Date.now());
  } catch {
    return false;
  }
}

/**
 * Removes the fragment from the address, from the gate's first effect: after the App Router has written its first
 * history entry (its insertion effect runs before any page effect, fragment included) and before the gate's own sign-in
 * redirect is sent, so the redirect is the later navigation and wins. The state passed is not the router's own, so its
 * `replaceState` patch, once installed, hears of the change and keeps its address in step. True when it stripped.
 */
export function stripAdminInviteFragmentHere(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const { pathname, search, hash } = window.location;
    const address = strippedInviteAddress({ pathname, search, hash });
    if (address === null) return false;
    window.history.replaceState(null, '', address);
    return true;
  } catch {
    return false;
  }
}

/** The stashed token while it is live (younger than 30 minutes); an expired, corrupt or foreign stash is removed. */
export function readAdminInvite(storage: KeyValueStorage | null = sessionArea(), now: number = Date.now()): string | null {
  const raw = readItem(storage, ADMIN_INVITE_STASH_KEY);
  if (raw === null) {
    if (memoryStash === null) return null;
    const age = now - memoryStash.savedAt;
    if (age >= 0 && age < ADMIN_INVITE_STASH_MS) return memoryStash.token;
    memoryStash = null;
    return null;
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const record = parsed !== null && typeof parsed === 'object' ? (parsed as { token?: unknown; savedAt?: unknown }) : null;
  const token = typeof record?.token === 'string' && ADMIN_INVITE_TOKEN_RE.test(record.token) ? record.token : null;
  const age = typeof record?.savedAt === 'number' ? now - record.savedAt : Number.NaN;
  if (token === null || !(age >= 0 && age < ADMIN_INVITE_STASH_MS)) {
    removeItem(storage, ADMIN_INVITE_STASH_KEY);
    return null;
  }
  return token;
}

/** A live invite waits in this tab: `/signin` adds its line, sign-up and `/start` go to the invite page (steps 2, 3). */
export function adminInviteLive(storage: KeyValueStorage | null = sessionArea(), now: number = Date.now()): boolean {
  return readAdminInvite(storage, now) !== null;
}

export function clearAdminInvite(storage: KeyValueStorage | null = sessionArea()): void {
  memoryStash = null;
  removeItem(storage, ADMIN_INVITE_STASH_KEY);
}

/**
 * A sign-out that keeps the stash (Use another account, the lock's Sign in again) marks it here, so `GrownUpGate`,
 * which removes the stash when a session ends any other way (it expired, was revoked, or was signed out in another
 * tab), leaves this one alone. The mark lasts until the next session starts.
 */
let keptThroughSignOut = false;

export function keepAdminInviteThroughSignOut(): void {
  keptThroughSignOut = true;
}

/**
 * `GrownUpGate` on a change of session: a session that ended without a keeping sign-out drops the stash, so the next
 * person to sign in in this tab is never forwarded to someone else's invite (section 6.6 step 1). A new session clears
 * the mark. True when it removed the stash.
 */
export function settleAdminInviteOnSession(previous: string | null, current: string | null, storage: KeyValueStorage | null = sessionArea()): boolean {
  if (current !== null) {
    keptThroughSignOut = false;
    return false;
  }
  if (previous === null || keptThroughSignOut) return false;
  clearAdminInvite(storage);
  return true;
}

/** Where a sign-up returns while an invite waits: the invite page, never `/start` (an invitee makes no space). */
export function signUpLanding(start: string, inviteWaiting: boolean): string {
  return inviteWaiting ? ADMIN_INVITE_PATH : start;
}

/** A final refusal of the invite: one calm line and Go to my home (step 8). */
/**
 * `ineligible` is `409 invite_ineligible`: the account is a caregiver or student member of the school, whose role an
 * invite never changes (only a teacher row is promoted, section 6.4); the invite stays open.
 */
export type InviteRefusal = 'used' | 'expired' | 'revoked' | 'full' | 'owner' | 'ineligible' | 'alreadyAdmin' | 'notFound' | 'emailUnverified';
/**
 * A refusal that a later try can get past: its line, Try again (the stash kept) and Go to my home. `identity` is accept's
 * `503 identity_unavailable` (Clerk could not be asked: `console.adminInvite.tryAgain`, sections 6.3 item 1 and 9.4).
 */
export type InviteRetry = 'tooMany' | 'cantReach' | 'identity';

export type InviteAnswer =
  | { at: 'preview'; school: string; invitedBy: string | null; expiresAt: string }
  | { at: 'accepted'; spaceId: string; school: string }
  | { at: 'refused'; reason: InviteRefusal; school?: string }
  | { at: 'retry'; reason: InviteRetry };

const REFUSAL_CODES: Readonly<Record<string, Exclude<InviteRefusal, 'alreadyAdmin'>>> = {
  invite_not_found: 'notFound',
  invite_used: 'used',
  invite_expired: 'expired',
  invite_revoked: 'revoked',
  already_owner: 'owner',
  admins_full: 'full',
  invite_ineligible: 'ineligible',
  email_unverified: 'emailUnverified',
};

/** A refusal of preview or accept, by the envelope's code (section 6.4); a `429`, a `5xx` or a network failure can be retried. */
function refusalOf(result: Extract<ApiResult<unknown>, { ok: false }>): InviteAnswer {
  if (result.status === 429) return { at: 'retry', reason: 'tooMany' };
  if (result.status === 503 && result.code === 'identity_unavailable') return { at: 'retry', reason: 'identity' };
  const reason = result.code ? REFUSAL_CODES[result.code] : undefined;
  if (reason) return { at: 'refused', reason };
  // 503 identity_not_configured (D18, section 6.6 step 8), another 5xx, a network failure, a signed-out moment: the service, not the person.
  return { at: 'retry', reason: 'cantReach' };
}

/** What the page shows after `POST /admin-invites/preview`. */
export function previewAnswer(result: ApiResult<AdminInvitePreview>): InviteAnswer {
  if (!result.ok) return refusalOf(result);
  const data = result.data;
  if (data.state === 'already_admin') return { at: 'refused', reason: 'alreadyAdmin', school: data.school.name };
  if (data.state !== 'open' || typeof data.expiresAt !== 'string') return { at: 'retry', reason: 'cantReach' };
  return { at: 'preview', school: data.school.name, invitedBy: typeof data.invitedBy === 'string' && data.invitedBy !== '' ? data.invitedBy : null, expiresAt: data.expiresAt };
}

/** What the page does after `POST /admin-invites/accept`: the school page, or a refusal line. */
export function acceptAnswer(result: ApiResult<AdminInviteAccepted>): InviteAnswer {
  if (!result.ok) return refusalOf(result);
  const data = result.data;
  if (data.state === 'already_admin') return { at: 'refused', reason: 'alreadyAdmin', school: data.school?.name ?? data.space.name };
  return { at: 'accepted', spaceId: data.space.id, school: data.space.name };
}
