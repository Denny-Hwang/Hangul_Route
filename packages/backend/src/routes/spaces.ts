import {
  SpaceCreateSchema,
  SpaceJoinSchema,
  SpaceLookupSchema,
  SpaceSettingsPatchSchema,
  checkSpaceName,
  rosterAlias,
  type Membership,
  type Space,
  type SpaceEventKind,
  type SpaceRole,
} from '@hangul-route/content-schema';
import { Hono, type Context } from 'hono';
import { dbFor, type Db } from '../db';
import { fail, ok } from '../envelope';
import { accountActor, requireAccount, spaceContext } from '../lib/access';
import { can, type Action, type Actor } from '../lib/can';
import { authorizeDevice, parseDeviceHeader } from '../lib/device-auth';
import { learnerCapOf, schoolUsage } from '../lib/entitlement';
import { generateJoinCode, isJoinCodeLive, joinCodeExpiry } from '../lib/join-code';
import { clientKey, createRateLimiter } from '../lib/rate-limit';
import { learnerScopes, type ClassScopeEnv } from '../lib/class-scope';
import { rosterSummary } from '../lib/roster-summary';
import { lookupSeat, takeLearnerSeat, type SeatRefusal } from '../lib/seats';
import { recordServerEvent } from '../lib/server-events';
import { id, spaceEventId, type Account } from '../store';

/**
 * /api/spaces — F-SPACE-001 §3.3. One shape for family / class / school;
 * every route resolves the actor once and asks `can()`.
 */
export const spacesRoutes = new Hono<{ Bindings: { SCHOOL_CONSENT_MODE?: string } & ClassScopeEnv }>();

/** School consent mode stays locked until the owner's legal review (app-map decision #26). */
export function schoolConsentModeEnabled(env: { SCHOOL_CONSENT_MODE?: string } | undefined): boolean {
  return env?.SCHOOL_CONSENT_MODE === 'enabled';
}

export const LOOKUP_LIMIT = 20;
export const LOOKUP_WINDOW_MS = 60 * 60 * 1000;
export const lookupLimiter = createRateLimiter(LOOKUP_LIMIT, LOOKUP_WINDOW_MS);

/** [SA] Renames per account per hour (AMENDMENTS-SEATS-ADMINS section 5.2). */
export const RENAME_LIMIT = 30;
export const renameLimiter = createRateLimiter(RENAME_LIMIT, 60 * 60 * 1000);

/** What members see about a space — never the code (handed out separately, by role). */
export function publicSpace(space: Space) {
  return {
    id: space.id,
    kind: space.kind,
    name: space.name,
    parentSpaceId: space.parentSpaceId,
    settings: space.settings,
    archivedAt: space.archivedAt,
    createdAt: space.createdAt,
  };
}

function liveCode(space: Space, now: Date): { joinCode: string | null; joinCodeExpiresAt: string | null } {
  return isJoinCodeLive(space, now) ? { joinCode: space.joinCode, joinCodeExpiresAt: space.joinCodeExpiresAt } : { joinCode: null, joinCodeExpiresAt: null };
}

/** A fresh code no other space holds (the column is unique, live or not). */
async function issueCode(db: Db, space: Space, now: Date): Promise<void> {
  const taken = new Set<string>();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateJoinCode((candidate) => taken.has(candidate));
    const holder = await db.spaceByCode(code);
    if (!holder || holder.id === space.id) {
      space.joinCode = code;
      space.joinCodeExpiresAt = joinCodeExpiry(now);
      return;
    }
    taken.add(code);
  }
  throw new Error('join code space exhausted');
}

/** Authorize an account for `action` on `space`; returns the account or an error Response. */
export async function requireCan(c: Context, db: Db, space: Space, action: Action): Promise<Response | Account> {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (!can(await accountActor(db, account), action, { kind: 'space', ctx: await spaceContext(db, space) })) {
    return fail(c, 'forbidden', 'Not allowed for this space', 403);
  }
  return account;
}

/** The space, or a 404 Response; archived spaces only when `allowArchived` (read-only routes). */
export async function findSpace(c: Context, db: Db, spaceId: string, allowArchived = false): Promise<Response | Space> {
  const space = await db.getSpace(spaceId);
  if (!space || (space.archivedAt && !allowArchived)) return fail(c, 'not_found', 'Space not found', 404);
  return space;
}

/** Roster names as the space wants them shown (F-TCH-001 §10.3 anonymize). */
export function rosterName(space: Space, displayName: string): string {
  return space.settings.anonymizeRoster ? rosterAlias(displayName) : displayName;
}

spacesRoutes.post('/', async (c) => {
  const parsed = SpaceCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid space body', 422, { issues: parsed.error.issues });
  const input = parsed.data;
  const account = await requireAccount(c, { email: input.email, displayName: input.displayName });
  if (!('id' in account)) return account;
  const db = dbFor(c);

  let parent: Space | null = null;
  if (input.parentSpaceId) {
    parent = await db.getSpace(input.parentSpaceId);
    if (!parent || parent.archivedAt) return fail(c, 'not_found', 'Parent space not found', 404);
    if (parent.kind !== 'school' || input.kind !== 'class') return fail(c, 'bad_request', 'Only a class can sit under a school', 422);
    if (!can(await accountActor(db, account), 'class.create', { kind: 'space', ctx: await spaceContext(db, parent) })) {
      return fail(c, 'forbidden', 'Not allowed to add a class to this school', 403);
    }
  }

  const now = new Date();
  const space: Space = {
    id: id('space'),
    kind: input.kind,
    name: input.name,
    parentSpaceId: parent?.id ?? null,
    ownerAccountId: account.id,
    joinCode: null,
    joinCodeExpiresAt: null,
    settings: { consentMode: 'parent', anonymizeRoster: input.kind === 'school' },
    archivedAt: null,
    createdAt: now.toISOString(),
  };
  if (space.kind === 'class') await issueCode(db, space, now);
  await db.putSpace(space);
  const membership: Membership = { spaceId: space.id, memberKind: 'account', memberId: account.id, role: 'owner', joinedAt: space.createdAt };
  await db.addMembership(membership);
  return ok(c, { space: publicSpace(space), membership, ...liveCode(space, now) }, 201);
});

spacesRoutes.get('/', async (c) => {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const db = dbFor(c);
  const actor = await accountActor(db, account);
  const now = new Date();
  const rows: Array<{ m: Membership; space: Space }> = [];
  for (const m of await db.membershipsOf('account', account.id)) {
    const space = await db.getSpace(m.spaceId);
    if (space) rows.push({ m, space });
  }
  rows.sort((a, b) => b.space.createdAt.localeCompare(a.space.createdAt));
  const spaces = [];
  for (const { m, space } of rows) {
    const members = await db.membersOf(space.id);
    const manage = can(actor, 'space.manage', { kind: 'space', ctx: await spaceContext(db, space) });
    spaces.push({
      space: publicSpace(space),
      role: m.role,
      counts: {
        learners: members.filter((x) => x.memberKind === 'learner').length,
        accounts: members.filter((x) => x.memberKind === 'account').length,
        classes: (await db.childSpaces(space.id)).length,
      },
      ...(manage ? liveCode(space, now) : { joinCode: null, joinCodeExpiresAt: null }),
    });
  }
  return ok(c, { spaces });
});

spacesRoutes.post('/lookup', async (c) => {
  const decision = lookupLimiter.check(clientKey((n) => c.req.header(n)));
  if (!decision.allowed) {
    return c.json(
      { ok: false, error: { code: 'too_many_attempts', message: 'Too many attempts — try again later', details: { retryAfterSeconds: decision.retryAfterSeconds } } },
      429,
    );
  }
  const parsed = SpaceLookupSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'invalid_code', 'Join code must be 6 letters or digits', 422);
  const db = dbFor(c);
  const space = await db.spaceByCode(parsed.data.code);
  if (!space || space.archivedAt) return fail(c, 'code_not_found', 'No class or family has this code', 404);
  const now = new Date();
  if (!isJoinCodeLive(space, now)) return fail(c, 'code_expired', 'This code has expired', 404);
  // Class rosters (names only) let a returning student pick themselves (F-TCH-001 §10.1).
  const roster: Array<{ learnerId: string; name: string }> = [];
  if (space.kind === 'class') {
    for (const m of await db.membersOf(space.id)) {
      if (m.memberKind !== 'learner') continue;
      const learner = await db.getLearner(m.memberId);
      if (learner) roster.push({ learnerId: learner.id, name: rosterName(space, learner.displayName) });
    }
    roster.sort((a, b) => a.name.localeCompare(b.name));
  }
  // [SA] section 3.4: `full` is always false. Shipped apps stop on it before the class roster and its relink step, so a
  // student at a full class (or a class of a full school) on a new device could not reach relink, which takes no
  // seat; the atomic `/join` refuses a new learner instead. The field stays so shipped apps parse the answer.
  const full = false;
  // [SA] `seat` is learner-aware: a learner this device vouches for (the `/join` check) who already holds the seat
  // finds room. An unvouched `learnerId` is ignored, never an error, so the lookup reveals nothing about it.
  const learnerId = parsed.data.learnerId && LOOKUP_LEARNER_ID.test(parsed.data.learnerId) ? parsed.data.learnerId : null;
  const vouched = learnerId && parseDeviceHeader(c.req.header('Authorization')) && typeof (await authorizeDevice(c, learnerId)) === 'string' ? learnerId : null;
  const seat = await lookupSeat(db, space, vouched, now);
  return ok(c, { space: { id: space.id, kind: space.kind, name: space.name }, full, seat, roster });
});

spacesRoutes.get('/:id/members', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, db, space, 'roster.manage');
  if (!('id' in account)) return account;
  // [SA] section 6.4: whether this caller may remove each member, by the rules of DELETE /:id/members (Settings never guesses).
  const removable = await removalRules(db, await accountActor(db, account), space);
  const members = [];
  for (const m of await db.membersOf(space.id)) {
    if (m.memberKind === 'account') {
      const a = await db.getAccount(m.memberId);
      members.push({ memberKind: 'account' as const, memberId: m.memberId, role: m.role, joinedAt: m.joinedAt, name: a?.displayName ?? a?.email ?? m.memberId, isOwner: m.memberId === space.ownerAccountId, canRemove: removable(m) === null });
    } else {
      const learner = await db.getLearner(m.memberId);
      members.push({ memberKind: 'learner' as const, memberId: m.memberId, role: m.role, joinedAt: m.joinedAt, name: rosterName(space, learner?.displayName ?? '?'), isOwner: false, canRemove: true });
    }
  }
  return ok(c, { members });
});

/**
 * [SA] Who a caller holding `roster.manage` may remove from the space (section 6.4), as the refusal code or null:
 * never the space's owner (`owner`); on a school, an admin only with `admin.manage` (the school's owner); on a class
 * of a school, the school's owner or one of its admins only with `admin.manage` on the school, so the class cascade
 * cannot be used by one admin to unassign another admin or the owner (`owner_only`).
 */
async function removalRules(db: Db, actor: Actor, space: Space): Promise<(m: Pick<Membership, 'memberKind' | 'memberId' | 'role'>) => 'owner' | 'owner_only' | null> {
  const ctx = await spaceContext(db, space);
  const ownsHere = can(actor, 'admin.manage', { kind: 'space', ctx });
  const school = ctx.parent?.kind === 'school' ? ctx.parent : null;
  const ownsSchool = school ? can(actor, 'admin.manage', { kind: 'space', ctx: { space: school, parent: null } }) : false;
  const schoolAdmins = new Set(school ? (await db.membersOf(school.id)).filter((x) => x.memberKind === 'account' && x.role === 'admin').map((x) => x.memberId) : []);
  return (m) => {
    if (m.memberKind !== 'account') return null;
    if (m.memberId === space.ownerAccountId) return 'owner';
    if (space.kind === 'school' && m.role === 'admin' && !ownsHere) return 'owner_only';
    if (school && (m.memberId === school.ownerAccountId || schoolAdmins.has(m.memberId)) && !ownsSchool) return 'owner_only';
    return null;
  };
}

spacesRoutes.patch('/:id/settings', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, db, space, 'space.settings');
  if (!('id' in account)) return account;
  const parsed = SpaceSettingsPatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid settings', 422, { issues: parsed.error.issues });
  if (parsed.data.consentMode === 'school' && !schoolConsentModeEnabled(c.env)) {
    return fail(c, 'consent_mode_locked', 'School consent mode is not available yet', 422);
  }
  space.settings = { ...space.settings, ...parsed.data };
  await db.putSpace(space);
  return ok(c, { space: publicSpace(space) });
});

spacesRoutes.post('/:id/archive', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, db, space, 'space.archive');
  if (!('id' in account)) return account;
  space.archivedAt = space.archivedAt ?? new Date().toISOString();
  await db.putSpace(space);
  return ok(c, { space: publicSpace(space) });
});

spacesRoutes.post('/:id/unarchive', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, db, space, 'space.archive');
  if (!('id' in account)) return account;
  space.archivedAt = null;
  await db.putSpace(space);
  return ok(c, { space: publicSpace(space) });
});

spacesRoutes.delete('/:id/learners/:learnerId/data', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const learnerId = c.req.param('learnerId');
  if (!(await db.membership(space.id, 'learner', learnerId))) return fail(c, 'not_found', 'Learner is not in this space', 404);
  const account = await requireCan(c, db, space, 'learner.delete');
  if (!('id' in account)) return account;
  return ok(c, { deleted: await db.deleteLearner(learnerId) });
});

/** [SA] The role a rename is recorded with (section 5.5): the actor's own role, else its role in the school above. */
function renameRole(memberships: readonly Membership[], accountId: string, space: Space, parent: Space | null): 'owner' | 'teacher' | 'admin' {
  const roleIn = (spaceId: string): SpaceRole | null => memberships.find((m) => m.spaceId === spaceId && m.memberKind === 'account' && m.memberId === accountId)?.role ?? null;
  const own = roleIn(space.id);
  if (own === 'owner' || own === 'teacher' || own === 'admin') return own;
  return parent && roleIn(parent.id) === 'owner' ? 'owner' : 'admin';
}

/** [SA] The school a rename is recorded on, and how (section 6.2): schools only, never a family or a stand-alone class. */
function renameEvent(space: Space, parent: Space | null): { schoolId: string; kind: SpaceEventKind; subjectSpaceId: string | null } | null {
  if (space.kind === 'school') return { schoolId: space.id, kind: 'renamed', subjectSpaceId: null };
  if (space.kind === 'class' && parent?.kind === 'school') return { schoolId: parent.id, kind: 'class_renamed', subjectSpaceId: space.id };
  return null;
}

spacesRoutes.patch('/:id/name', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const actor = await accountActor(db, account);
  const ctx = await spaceContext(db, space);
  if (!can(actor, 'space.rename', { kind: 'space', ctx })) return fail(c, 'forbidden', 'Not allowed for this space', 403);
  if (space.archivedAt) return fail(c, 'archived', 'Unarchive the space to rename it', 422);
  const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null;
  if (!body || typeof body !== 'object' || typeof body.name !== 'string') return fail(c, 'bad_request', 'name required', 422);
  const checked = checkSpaceName(body.name);
  if (!checked.ok) return fail(c, 'bad_name', 'This name cannot be used', 422, { reason: checked.reason });
  if (checked.name === space.name) return ok(c, { space: publicSpace(space), changed: false });
  const decision = renameLimiter.check(account.id);
  if (!decision.allowed) return fail(c, 'too_many_attempts', 'Too many renames: try again later', 429, { retryAfterSeconds: decision.retryAfterSeconds });
  if ((await db.renameSpace(space.id, checked.name)) === 0) {
    // An archive or a delete landed between the read and the write: say which, record nothing.
    const now = await db.getSpace(space.id);
    return now ? fail(c, 'archived', 'Unarchive the space to rename it', 422) : fail(c, 'not_found', 'Space not found', 404);
  }
  const event = renameEvent(space, ctx.parent);
  if (event) {
    // After the committed rename, best effort: an audit write that fails never reports the rename as failed. A
    // fixed code only, never the name.
    try {
      await db.addSpaceEvent({ id: spaceEventId(), spaceId: event.schoolId, kind: event.kind, actorAccountId: account.id, subjectAccountId: null, subjectSpaceId: event.subjectSpaceId, inviteId: null, createdAt: new Date().toISOString() });
    } catch {
      console.warn('space_event_write_failed');
    }
  }
  recordServerEvent('space.renamed', { kind: space.kind, role: renameRole(actor.kind === 'account' ? actor.memberships : [], account.id, space, ctx.parent) });
  return ok(c, { space: publicSpace({ ...space, name: checked.name }), changed: true });
});

spacesRoutes.post('/:id/code', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'));
  if (!('id' in space)) return space;
  const account = await requireCan(c, db, space, 'space.manage');
  if (!('id' in account)) return account;
  const now = new Date();
  await issueCode(db, space, now);
  await db.putSpace(space);
  return ok(c, { joinCode: space.joinCode, expiresAt: space.joinCodeExpiresAt });
});

/** Messages of the `/join` seat refusals (logs only, English; the client keys off the code and `details.cap`). */
const SEAT_MESSAGES: Record<SeatRefusal, (cap: number) => string> = {
  cap_learner: (cap) => `A learner can be in at most ${cap} classes`,
  cap_class: (cap) => `This class has room for ${cap} students`,
  cap_school: (cap) => `This school has room for ${cap} students`,
  cap_family: (cap) => `This family has room for ${cap} learners`,
};

spacesRoutes.post('/:id/join', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'));
  if (!('id' in space)) return space;
  const parsed = SpaceJoinSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'invalid_code', 'Join code must be 6 letters or digits', 422);
  const { code, learnerId, displayName } = parsed.data;
  const now = new Date();
  if (space.joinCode !== code) return fail(c, 'code_not_found', 'That code does not open this space', 404);
  if (!isJoinCodeLive(space, now)) return fail(c, 'code_expired', 'This code has expired', 404);

  if (parseDeviceHeader(c.req.header('Authorization'))) {
    // Learner path: the device proves it holds the learner.
    if (!learnerId) return fail(c, 'bad_request', 'learnerId required', 422);
    const auth = await authorizeDevice(c, learnerId);
    if (typeof auth !== 'string') return auth;
    if (space.kind === 'school') return fail(c, 'not_joinable', 'Learners join a class or a family, not a school', 422);
    const existing = await db.membership(space.id, 'learner', learnerId);
    // The device's current name becomes the roster name, also on a join again: the repair path for a learner
    // renamed on an app build that cannot PATCH. Column-only, and only while the learner has no PATCH edit (PATCH
    // orders edits by device time; a server-time join must not enter that order). The body already holds the
    // server's lenient name rule (trim, 1-20, `LegacyDisplayNameSchema`), the same one registration and PATCH use,
    // so a legacy name the device keeps applies as sent. Best effort: a failed repair never fails the join (the
    // membership may already be committed, and a retry would fail the same way). Only a fixed code is logged,
    // never the name.
    const applyName = async (): Promise<void> => {
      if (displayName === undefined) return;
      try {
        await db.setDisplayNameIfUnedited(learnerId, displayName);
      } catch {
        console.warn('join_name_repair_failed');
      }
    };
    if (existing) {
      await applyName();
      return ok(c, { alreadyMember: true, membership: existing, space: { id: space.id, kind: space.kind, name: space.name } });
    }
    // [SA] One atomic statement takes the seat under every cap (AMENDMENTS-SEATS-ADMINS section 3.3).
    const taken = await takeLearnerSeat(db, space, learnerId, now);
    if (taken.kind === 'already') {
      // Another device of this learner joined between the read above and the statement.
      await applyName();
      const row = await db.membership(space.id, 'learner', learnerId);
      return ok(c, { alreadyMember: true, membership: row, space: { id: space.id, kind: space.kind, name: space.name } });
    }
    if (taken.kind === 'refused') {
      const { code: reason, cap } = taken.refusal;
      recordServerEvent('space.seat_refused', { kind: space.kind, reason, path: 'join' });
      // [SA] section 3.4: a school cap answers `cap_class` (shipped apps map only `cap_class` to the class line);
      // `details.reason` names the cap that was reached.
      return fail(c, reason === 'cap_school' ? 'cap_class' : reason, SEAT_MESSAGES[reason](cap), 409, { reason, cap });
    }
    const membership: Membership = { spaceId: space.id, memberKind: 'learner', memberId: learnerId, role: 'student', joinedAt: now.toISOString() };
    await applyName();
    return ok(c, { alreadyMember: false, membership, space: { id: space.id, kind: space.kind, name: space.name } }, 201);
  }

  // Account path: co-parent into a family, invited teacher into a school.
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const roleFor: Partial<Record<Space['kind'], SpaceRole>> = { family: 'caregiver', school: 'teacher' };
  const role = roleFor[space.kind];
  if (!role) return fail(c, 'co_teacher_unsupported', 'Classes have one teacher for now', 403);
  const existing = await db.membership(space.id, 'account', account.id);
  if (existing) return ok(c, { alreadyMember: true, membership: existing, space: { id: space.id, kind: space.kind, name: space.name } });
  const membership: Membership = { spaceId: space.id, memberKind: 'account', memberId: account.id, role, joinedAt: now.toISOString() };
  // [SA] section 6.1: insert-if-absent, so a teacher-code join that read "no row" just before an admin accept never
  // demotes the new admin to teacher.
  if (!(await db.addMembershipIfAbsent(membership))) {
    return ok(c, { alreadyMember: true, membership: await db.membership(space.id, 'account', account.id), space: { id: space.id, kind: space.kind, name: space.name } });
  }
  return ok(c, { alreadyMember: false, membership, space: { id: space.id, kind: space.kind, name: space.name } }, 201);
});

spacesRoutes.post('/:id/leave', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'));
  if (!('id' in space)) return space;
  const body = (await c.req.json().catch(() => ({}))) as { learnerId?: string };
  const learnerId = typeof body.learnerId === 'string' ? body.learnerId : '';
  if (!learnerId) return fail(c, 'bad_request', 'learnerId required', 422);
  const auth = await authorizeDevice(c, learnerId);
  if (typeof auth !== 'string') return auth;
  const left = await db.removeMembership(space.id, 'learner', learnerId);
  // F-FEEDBACK-001 section 7.5: the learner left from its own device, so its notes of the space go (reported ones,
  // and any note a report row names, stay for review); also on a retry.
  await db.deleteNotesForMembership(learnerId, space.id);
  return ok(c, { left });
});

/**
 * [SA] Removes an account member by the rules of section 6.4, guarded on the role it read: the delete runs only while
 * the row still has that role, so an accept or a leave landing between the read and the write is never overridden
 * (an admin never deletes another admin's row; a concurrent leave that kept a teacher row is not undone). On a
 * changed row it reads again and applies the rules to what is there now, a bounded number of times.
 */
async function removeAccountMember(c: Context, db: Db, space: Space, account: Account, memberId: string): Promise<Response | boolean> {
  const rules = await removalRules(db, await accountActor(db, account), space);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = await db.membership(space.id, 'account', memberId);
    const rule = rules({ memberKind: 'account', memberId, role: row?.role ?? 'teacher' });
    if (rule === 'owner_only') return fail(c, 'owner_only', "Only the school's owner can remove an administrator", 403);
    if (!row) return false;
    if (space.kind === 'school' && row.role === 'admin') {
      // [SA] section 6.4: the owner's removal of an admin ends the role as DELETE /:id/admins/:accountId does.
      const stays = await db.endAdminRole({ spaceId: space.id, accountId: memberId, actorAccountId: account.id, kind: 'admin_removed', now: new Date(), eventId: spaceEventId() });
      if (stays) {
        recordServerEvent('space.admin.removed');
        return ok(c, { removed: true, stays });
      }
      continue; // no longer an admin (a leave or a removal landed first): read the row again
    }
    if (await db.removeMembershipIfRole(space.id, 'account', memberId, row.role)) return true;
  }
  return fail(c, 'conflict', 'This member changed while removing: try again', 409);
}

spacesRoutes.delete('/:id/members/:kind/:memberId', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'));
  if (!('id' in space)) return space;
  const kind = c.req.param('kind');
  if (kind !== 'account' && kind !== 'learner') return fail(c, 'bad_request', 'kind must be account or learner', 422);
  const memberId = c.req.param('memberId');
  const account = await requireCan(c, db, space, 'roster.manage');
  if (!('id' in account)) return account;
  if (kind === 'account' && memberId === space.ownerAccountId) return fail(c, 'owner', 'The owner cannot be removed', 409);
  let removed: boolean;
  if (kind === 'account') {
    const outcome = await removeAccountMember(c, db, space, account, memberId);
    if (outcome instanceof Response) return outcome;
    removed = outcome;
  } else {
    removed = await db.removeMembership(space.id, kind, memberId);
  }
  // F-FEEDBACK-001 section 7.5: a removed learner's notes of this space are kept, not deleted, so an adult cannot
  // erase a note (a taken-back one included) by removing the learner before the family looks (D5, D9, 8.3 item 3);
  // delivery rule 2 already stops them, and the 180-day / 90-day retention purges them. A removed family adult
  // loses the owner's send grant with the membership (delivery rule 6 already stops its notes).
  if (kind === 'account' && space.kind === 'family') await db.deleteSendGrant(space.id, memberId);
  return ok(c, { removed });
});

spacesRoutes.get('/:id/roster', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, db, space, 'summary.read');
  if (!('id' in account)) return account;
  const now = new Date();
  // planProgress is filtered to this space's own plans (archived ones included): F-SPACE-002 T-1a.
  const planIds = new Set((await db.plansOf(space.id)).map((p) => p.id));
  const learners = [];
  const members = await db.membersOf(space.id);
  // [TV] each learner's scope, read once for the whole roster (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 2)
  const scopes = await learnerScopes(db, space.kind, members.filter((m) => m.memberKind === 'learner').map((m) => m.memberId), c.env);
  for (const m of members) {
    if (m.memberKind !== 'learner') continue;
    const learner = await db.getLearner(m.memberId);
    if (!learner) continue;
    const snapshot = await db.getSnapshot(learner.id);
    // The allow-listed summary only (F-SPACE-002 section 4.11); payload_json never leaves through this route (roadmap §3.1).
    learners.push({
      id: learner.id,
      displayName: rosterName(space, learner.displayName),
      ageGroup: learner.ageGroup,
      avatar: learner.avatar,
      joinedAt: m.joinedAt,
      lastActiveAt: learner.lastActiveAt,
      // selfRoute reaches a family space only (F-PLAN-002 section 3.10); a class sees no activity day before joinedAt (F-REPORT-001 section 3.8).
      // [TV] full scope (a family; a class after the family's acknowledgement) adds vocab, the Hangul Check, the self-route and the goal; never firstTryRate on a roster.
      summary: rosterSummary(snapshot?.summary, planIds, space.kind, { joinedAt: m.joinedAt, scope: scopes.get(learner.id) }),
      lastSyncedAt: snapshot?.updatedAt ?? null,
      scope: scopes.get(learner.id) ?? 'base',
    });
  }
  learners.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  const actor = await accountActor(db, account);
  const ctx = await spaceContext(db, space);
  const manage = can(actor, 'space.manage', { kind: 'space', ctx });
  // [SA] section 3.6 and 5.3: the seat counts the console shows, and whether this grown-up may rename the space.
  const canRename = can(actor, 'space.rename', { kind: 'space', ctx });
  return ok(c, {
    space: publicSpace(space),
    learners,
    ...(manage ? liveCode(space, now) : { joinCode: null, joinCodeExpiresAt: null }),
    seats: await rosterSeats(db, space, members.filter((m) => m.memberKind === 'learner').length, now),
    canRename,
    openMoves: canRename ? await hasOpenMoves(db, space.id) : false,
  });
});

/**
 * [SA] `GET /:id/roster` `seats` (section 3.6): the space's learners and cap, and for a class in a live school the
 * school's distinct students and cap. A cap of `null` is none; the school fields are `null` outside a school.
 */
export async function rosterSeats(db: Db, space: Space, learners: number, now: Date): Promise<{ learners: number; cap: number | null; schoolLearners: number | null; schoolCap: number | null }> {
  const caps = await learnerCapOf(db, space, now);
  const school = caps.schoolId ? await db.getSpace(caps.schoolId) : null;
  return { learners, cap: caps.cap, schoolLearners: school ? (await schoolUsage(db, school)).students : null, schoolCap: school ? caps.schoolCap : null };
}

/** [SA] Whether an open class transfer names the space as its source or destination (a rename resets its consent, section 5.4). */
/** [SA] section 3.4: the learner id shape `/lookup` may vouch for; any other value is ignored. */
const LOOKUP_LEARNER_ID = /^profile:[a-z0-9-]+$/;

export async function hasOpenMoves(db: Db, spaceId: string): Promise<boolean> {
  return (await db.openTransfersOfSpaces([spaceId], 'source')).length > 0 || (await db.openTransfersOfSpaces([spaceId], 'destination')).length > 0;
}

/** Learner-facing rows for the sync inbox (archived spaces drop out). */
export async function learnerMembershipRows(db: Db, learnerId: string) {
  const rows = [];
  for (const m of await db.membershipsOf('learner', learnerId)) {
    const space = await db.getSpace(m.spaceId);
    if (space && !space.archivedAt) rows.push({ spaceId: space.id, kind: space.kind, name: space.name, role: m.role, joinedAt: m.joinedAt });
  }
  return rows;
}
