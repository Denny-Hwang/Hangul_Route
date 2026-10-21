import { ADMIN_INVITE_TTL_MS, APP_ORIGIN, AdminInviteBodySchema, SCHOOL_ADMIN_CAP, adminInviteUrl, type Space } from '@hangul-route/content-schema';
import { Hono, type Context } from 'hono';
import { dbFor, type Db, type EndAdminRoleResult, type StoredAdminInvite } from '../db';
import { fail, ok } from '../envelope';
import { accountActor, requireAccount, spaceContext } from '../lib/access';
import { can, type Action } from '../lib/can';
import { hashSecret } from '../lib/device-auth';
import { identityPortFor, type IdentityPort } from '../lib/identity';
import { clientKey, createRateLimiter } from '../lib/rate-limit';
import { recordServerEvent } from '../lib/server-events';
import { requireStepUp } from '../lib/step-up';
import { spaceEventId, type Account } from '../store';
import { findSpace } from './spaces';

/**
 * [SA] School administrators (AMENDMENTS-SEATS-ADMINS sections 6.1 to 6.4, 6.8). A school has its owner and up to
 * `SCHOOL_ADMIN_CAP` (2) admins, who join only through a single-use invite link the owner makes. The token rides in
 * the link's fragment and in the JSON body of preview and accept, never in a path or a query; only its SHA-256 hash
 * is stored. Every write is one guarded statement or one gate-then-guarded-writes batch, so the cap holds under
 * concurrent tabs and accepts. Telemetry carries codes only; `space_events` is the record.
 *
 * - `adminSpaceRoutes` (under /api/spaces): GET /:id/admins, POST /:id/admin-invites, DELETE
 *   /:id/admin-invites/:inviteId, DELETE /:id/admins/:accountId, POST /:id/admins/leave.
 * - `adminInviteRoutes` (under /api/admin-invites): POST /preview, POST /accept.
 */
export const adminSpaceRoutes = new Hono();
export const adminInviteRoutes = new Hono();

/** Preview and accept: 20 per client key per hour, shared by both (section 6.4). */
export const ADMIN_INVITE_LIMIT = 20;
export const adminInviteLimiter = createRateLimiter(ADMIN_INVITE_LIMIT, 60 * 60 * 1000);

/** The last school events the owner sees (section 6.4). */
export const ADMIN_HISTORY_LIMIT = 20;

/** 32 random bytes as base64url without padding: 43 characters (section 6.3). */
export function newInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A grown-up's name for these routes: the display name, else the email (signed-in members of the school), else null. */
function nameOf(account: Account | undefined): string | null {
  return account?.displayName ?? account?.email ?? null;
}

/**
 * The names of `ids` from one set-wise read (chunked inside the Db), so the owner's view stays a flat number of D1
 * statements however long the history grows (Workers Free: 50 per invocation). A missing account reads null.
 */
async function namesOf(db: Db, ids: Iterable<string>): Promise<(accountId: string | null) => string | null> {
  const byId = new Map((await db.getAccounts([...new Set(ids)])).map((a) => [a.id, a]));
  return (accountId) => (accountId === null ? null : nameOf(byId.get(accountId)));
}

/** The account allowed `action` on the space and the space a school, else the refusal (403, then 422 `not_a_school`). */
async function requireSchool(c: Context, db: Db, space: Space, action: Action): Promise<Response | Account> {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (!can(await accountActor(db, account), action, { kind: 'space', ctx: await spaceContext(db, space) })) return fail(c, 'forbidden', 'Not allowed for this space', 403);
  if (space.kind !== 'school') return fail(c, 'not_a_school', 'Only a school has administrators', 422);
  return account;
}

/** The verified email of an account for the owner's view, or null (none, unverified, not configured, or Clerk failed). */
async function verifiedEmail(port: IdentityPort | null, accountId: string): Promise<string | null> {
  if (!port) return null;
  try {
    const found = await port.primaryEmail(accountId);
    return found?.verified ? found.email : null;
  } catch {
    return null;
  }
}

/**
 * [SA] Ends an admin role (section 6.1) for the admins route and the members route alike: back to teacher when the
 * account was promoted from a teacher or owns or teaches a live class of the school, else out of the school.
 */
export async function endAdmin(db: Db, school: Space, accountId: string, actorAccountId: string, kind: 'admin_removed' | 'admin_left'): Promise<EndAdminRoleResult> {
  const stays = await db.endAdminRole({ spaceId: school.id, accountId, actorAccountId, kind, now: new Date(), eventId: spaceEventId() });
  if (stays) recordServerEvent(kind === 'admin_removed' ? 'space.admin.removed' : 'space.admin.left');
  return stays;
}

adminSpaceRoutes.get('/:id/admins', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireSchool(c, db, space, 'space.manage');
  if (!('id' in account)) return account;
  const actor = await accountActor(db, account);
  const isOwner = can(actor, 'admin.manage', { kind: 'space', ctx: await spaceContext(db, space) });
  const port = isOwner ? identityPortFor(c) : null;
  const rows = (await db.membersOf(space.id)).filter((x) => x.memberKind === 'account' && x.role === 'admin');
  // The history only for the owner; every name of the view comes from one read.
  const history = isOwner ? await db.spaceEventsOf(space.id, ADMIN_HISTORY_LIMIT) : [];
  const name = await namesOf(db, [space.ownerAccountId, ...rows.map((m) => m.memberId), ...history.flatMap((e) => (e.subjectAccountId ? [e.actorAccountId, e.subjectAccountId] : [e.actorAccountId]))]);
  const admins = [];
  // At most SCHOOL_ADMIN_CAP rows, so two reads each stay within the statement budget.
  for (const m of rows) {
    // A promoted teacher's row keeps its teacher join date: the admin joined at the latest `admin_joined` event.
    const joined = await db.latestSpaceEvent(space.id, 'admin_joined', m.memberId);
    admins.push({
      accountId: m.memberId,
      name: name(m.memberId),
      // The verified sign-in email, for the owner only (section 6.3): read now, never stored, never sent to an admin.
      ...(isOwner ? { email: await verifiedEmail(port, m.memberId) } : {}),
      joinedAt: joined?.createdAt ?? m.joinedAt,
      staysTeacher: await db.adminStaysTeacher(space.id, m.memberId),
    });
  }
  admins.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.accountId.localeCompare(b.accountId));
  const owner = { accountId: space.ownerAccountId, name: name(space.ownerAccountId) };
  if (!isOwner) return ok(c, { owner, admins, limit: SCHOOL_ADMIN_CAP });
  const invites = (await db.openAdminInvites(space.id, new Date())).map((i) => ({ id: i.id, createdAt: i.createdAt, expiresAt: i.expiresAt }));
  // Names at read time; a missing account reads null (the console shows "A former member", never an id).
  const events = history.map((e) => ({ kind: e.kind, at: e.createdAt, actorName: name(e.actorAccountId), subjectName: name(e.subjectAccountId) }));
  return ok(c, { owner, admins, limit: SCHOOL_ADMIN_CAP, invites, events });
});

adminSpaceRoutes.post('/:id/admin-invites', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireSchool(c, db, space, 'admin.manage');
  if (!('id' in account)) return account;
  if (space.archivedAt) return fail(c, 'archived', 'Unarchive the school to invite an administrator', 422);
  // Step-up (section 6.3, OQ-7): the link hands someone the school's rosters. Clerk's reverification body as is.
  const stepUp = await requireStepUp(c);
  if (stepUp) return stepUp;
  const token = newInviteToken();
  const now = new Date();
  const invite = { id: `invite:${crypto.randomUUID()}`, spaceId: space.id, tokenHash: await hashSecret(token), createdBy: account.id, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + ADMIN_INVITE_TTL_MS).toISOString() };
  if (!(await db.createAdminInvite({ invite, cap: SCHOOL_ADMIN_CAP, eventId: spaceEventId() }))) {
    // The statement refused: say which, from one read (an archive may have landed since the read above).
    const again = await db.getSpace(space.id);
    if (!again) return fail(c, 'not_found', 'Space not found', 404);
    if (again.archivedAt) return fail(c, 'archived', 'Unarchive the school to invite an administrator', 422);
    return fail(c, 'admins_full', 'Every administrator place is taken or invited', 409, { max: SCHOOL_ADMIN_CAP });
  }
  recordServerEvent('space.admin.invite_created');
  // The token is shown once, here; nothing keeps it.
  c.header('Cache-Control', 'no-store');
  return ok(c, { invite: { id: invite.id, createdAt: invite.createdAt, expiresAt: invite.expiresAt }, url: adminInviteUrl(APP_ORIGIN, token) }, 201);
});

adminSpaceRoutes.delete('/:id/admin-invites/:inviteId', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireSchool(c, db, space, 'admin.manage');
  if (!('id' in account)) return account;
  const inviteId = c.req.param('inviteId');
  const changed = await db.revokeAdminInvite({ inviteId, spaceId: space.id, actorAccountId: account.id, now: new Date(), eventId: spaceEventId() });
  const row = await db.getAdminInvite(inviteId);
  if (!row || row.spaceId !== space.id) return fail(c, 'not_found', 'Invite not found', 404);
  // A revoke that lands after an accept changes nothing: the accepted row keeps `revoked_at` null.
  if (row.acceptedAt !== null || row.revokedAt === null) return fail(c, 'invite_used', 'This invite was already used', 409);
  if (changed === 1) recordServerEvent('space.admin.invite_revoked');
  return ok(c, { revoked: true });
});

adminSpaceRoutes.delete('/:id/admins/:accountId', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireSchool(c, db, space, 'admin.manage');
  if (!('id' in account)) return account;
  const target = c.req.param('accountId');
  if (target === space.ownerAccountId) return fail(c, 'owner', 'The owner cannot be removed', 409);
  const stays = await endAdmin(db, space, target, account.id, 'admin_removed');
  if (!stays) return fail(c, 'not_found', 'Not an administrator of this school', 404);
  return ok(c, { removed: true, stays });
});

adminSpaceRoutes.post('/:id/admins/leave', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (space.kind !== 'school') return fail(c, 'not_a_school', 'Only a school has administrators', 422);
  if (account.id === space.ownerAccountId) return fail(c, 'owner', 'The owner cannot leave the school', 409);
  const stays = await endAdmin(db, space, account.id, account.id, 'admin_left');
  if (!stays) return fail(c, 'not_found', 'Not an administrator of this school', 404);
  return ok(c, { left: true, stays });
});

type InviteState = 'open' | 'already_admin' | 'not_found' | 'used' | 'expired' | 'revoked' | 'owner' | 'full';

/** Where an invite stands for this account, from one read (section 6.4); the school is the live school it opens. */
async function inviteState(db: Db, invite: StoredAdminInvite | null, accountId: string, now: Date): Promise<{ state: InviteState; school: Space | null }> {
  if (!invite) return { state: 'not_found', school: null };
  const school = await db.getSpace(invite.spaceId);
  if (!school || school.kind !== 'school' || school.archivedAt) return { state: 'not_found', school: null };
  const role = (await db.membership(school.id, 'account', accountId))?.role ?? null;
  if (school.ownerAccountId === accountId || role === 'owner') return { state: 'owner', school };
  if (role === 'admin') return { state: 'already_admin', school };
  if (invite.revokedAt !== null) return { state: 'revoked', school };
  if (invite.acceptedAt !== null) return { state: 'used', school };
  if (invite.expiresAt <= now.toISOString()) return { state: 'expired', school };
  const admins = (await db.membersOf(school.id)).filter((m) => m.memberKind === 'account' && m.role === 'admin').length;
  if (admins >= SCHOOL_ADMIN_CAP) return { state: 'full', school };
  return { state: 'open', school };
}

/** The refusal of a state that is neither open nor already_admin. */
function refusal(c: Context, state: Exclude<InviteState, 'open' | 'already_admin'>): Response {
  switch (state) {
    case 'not_found':
      return fail(c, 'invite_not_found', 'This invite link does not open anything', 404);
    case 'used':
      return fail(c, 'invite_used', 'This invite was already used', 410);
    case 'expired':
      return fail(c, 'invite_expired', 'This invite has ended', 410);
    case 'revoked':
      return fail(c, 'invite_revoked', 'This invite was revoked', 410);
    case 'owner':
      return fail(c, 'already_owner', 'You own this school', 409);
    case 'full':
      return fail(c, 'admins_full', 'Every administrator place is taken', 409, { max: SCHOOL_ADMIN_CAP });
  }
}

const REFUSAL_REASON: Record<Exclude<InviteState, 'open' | 'already_admin'>, 'not_found' | 'used' | 'expired' | 'revoked' | 'owner' | 'full'> = {
  not_found: 'not_found',
  used: 'used',
  expired: 'expired',
  revoked: 'revoked',
  owner: 'owner',
  full: 'full',
};

/** The signed-in account, the limiter and the token, or the refusal; the token is only ever read from the body. */
async function readInvite(c: Context, db: Db): Promise<Response | { account: Account; invite: StoredAdminInvite | null }> {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const decision = adminInviteLimiter.check(clientKey((n) => c.req.header(n)));
  if (!decision.allowed) return fail(c, 'too_many_attempts', 'Too many attempts: try again later', 429, { retryAfterSeconds: decision.retryAfterSeconds });
  const parsed = AdminInviteBodySchema.safeParse(await c.req.json().catch(() => null));
  // A malformed token can match nothing: the same answer as an unknown one.
  if (!parsed.success) return { account, invite: null };
  return { account, invite: await db.adminInviteByHash(await hashSecret(parsed.data.token)) };
}

/** The owner's display name, or null: never an email (a forwarded link must not show the owner's address). */
async function invitedBy(db: Db, school: Space): Promise<string | null> {
  const name = (await db.getAccount(school.ownerAccountId))?.displayName ?? null;
  return name && !name.includes('@') ? name : null;
}

adminInviteRoutes.post('/preview', async (c) => {
  const db = dbFor(c);
  const read = await readInvite(c, db);
  if (read instanceof Response) return read;
  const now = new Date();
  const { state, school } = await inviteState(db, read.invite, read.account.id, now);
  if (state === 'already_admin' && school) return ok(c, { state, school: { name: school.name } });
  if (state !== 'open' || !school || !read.invite) return refusal(c, state === 'open' || state === 'already_admin' ? 'not_found' : state);
  return ok(c, { school: { name: school.name }, invitedBy: await invitedBy(db, school), expiresAt: read.invite.expiresAt, state });
});

adminInviteRoutes.post('/accept', async (c) => {
  const db = dbFor(c);
  const read = await readInvite(c, db);
  if (read instanceof Response) return read;
  const { account, invite } = read;
  const now = new Date();
  const refuse = (state: Exclude<InviteState, 'open' | 'already_admin'>): Response => {
    recordServerEvent('space.admin.accept_refused', { reason: REFUSAL_REASON[state] });
    return refusal(c, state);
  };
  const before = await inviteState(db, invite, account.id, now);
  const alreadyAdmin = (school: Space): Response => ok(c, { state: 'already_admin' as const, school: { name: school.name }, space: { id: school.id, kind: school.kind, name: school.name }, role: 'admin' as const });
  if (before.state === 'already_admin' && before.school) return alreadyAdmin(before.school);
  if (before.state !== 'open' || !before.school || !invite) return refuse(before.state === 'open' || before.state === 'already_admin' ? 'not_found' : before.state);
  // A verified sign-in email (section 6.3): the link is a bearer link, so the owner must be able to check who accepted.
  const port = identityPortFor(c);
  if (!port) return fail(c, 'identity_not_configured', 'Accepting an invite is not configured on this deployment', 503);
  let email;
  try {
    email = await port.primaryEmail(account.id);
  } catch {
    return fail(c, 'identity_unavailable', 'Could not check your sign-in email: try again', 503);
  }
  if (!email || !email.verified) {
    recordServerEvent('space.admin.accept_refused', { reason: 'email_unverified' });
    return fail(c, 'email_unverified', 'Verify the email you sign in with, then open the invite again', 403);
  }
  if (await db.acceptAdminInvite({ inviteId: invite.id, spaceId: invite.spaceId, accountId: account.id, now, cap: SCHOOL_ADMIN_CAP, eventId: spaceEventId() })) {
    recordServerEvent('space.admin.joined');
    const school = before.school;
    return ok(c, { space: { id: school.id, kind: school.kind, name: school.name }, role: 'admin' as const });
  }
  // The gate refused: name the reason from one read (another tab, an accept or a revoke landed in between).
  const after = await inviteState(db, await db.getAdminInvite(invite.id), account.id, now);
  if (after.state === 'already_admin' && after.school) return alreadyAdmin(after.school);
  return refuse(after.state === 'open' || after.state === 'already_admin' ? 'used' : after.state);
});
