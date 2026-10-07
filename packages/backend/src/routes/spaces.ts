import {
  FAMILY_LIFETIME_LEARNERS,
  LEARNER_CLASS_CAP,
  SpaceCreateSchema,
  SpaceJoinSchema,
  SpaceLookupSchema,
  SpaceSettingsPatchSchema,
  rosterAlias,
  type Membership,
  type Space,
  type SpaceRole,
} from '@hangul-route/content-schema';
import { Hono, type Context } from 'hono';
import { dbFor, type Db } from '../db';
import { fail, ok } from '../envelope';
import { accountActor, requireAccount, spaceContext } from '../lib/access';
import { can, type Action } from '../lib/can';
import { authorizeDevice, parseDeviceHeader } from '../lib/device-auth';
import { classCap, schoolIsFull } from '../lib/entitlement';
import { generateJoinCode, isJoinCodeLive, joinCodeExpiry } from '../lib/join-code';
import { clientKey, createRateLimiter } from '../lib/rate-limit';
import { id, type Account } from '../store';

/**
 * /api/spaces — F-SPACE-001 §3.3. One shape for family / class / school;
 * every route resolves the actor once and asks `can()`.
 */
export const spacesRoutes = new Hono<{ Bindings: { SCHOOL_CONSENT_MODE?: string } }>();

/** School consent mode stays locked until the owner's legal review (app-map decision #26). */
export function schoolConsentModeEnabled(env: { SCHOOL_CONSENT_MODE?: string } | undefined): boolean {
  return env?.SCHOOL_CONSENT_MODE === 'enabled';
}

export const LOOKUP_LIMIT = 20;
export const LOOKUP_WINDOW_MS = 60 * 60 * 1000;
export const lookupLimiter = createRateLimiter(LOOKUP_LIMIT, LOOKUP_WINDOW_MS);

/** What members see about a space — never the code (handed out separately, by role). */
function publicSpace(space: Space) {
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

async function studentsIn(db: Db, spaceId: string): Promise<number> {
  return (await db.membersOf(spaceId)).filter((m) => m.memberKind === 'learner').length;
}

async function activeClassesOf(db: Db, learnerId: string): Promise<number> {
  let n = 0;
  for (const m of await db.membershipsOf('learner', learnerId)) {
    const s = await db.getSpace(m.spaceId);
    if (s && s.kind === 'class' && !s.archivedAt) n += 1;
  }
  return n;
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
async function requireCan(c: Context, db: Db, space: Space, action: Action): Promise<Response | Account> {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (!can(await accountActor(db, account), action, { kind: 'space', ctx: await spaceContext(db, space) })) {
    return fail(c, 'forbidden', 'Not allowed for this space', 403);
  }
  return account;
}

async function findSpace(c: Context, db: Db, spaceId: string, allowArchived = false): Promise<Response | Space> {
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
  const full = space.kind === 'class' && ((await studentsIn(db, space.id)) >= (await classCap(db, space, now)) || (await schoolIsFull(db, space, now)));
  return ok(c, { space: { id: space.id, kind: space.kind, name: space.name }, full, roster });
});

spacesRoutes.get('/:id/members', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, db, space, 'roster.manage');
  if (!('id' in account)) return account;
  const members = [];
  for (const m of await db.membersOf(space.id)) {
    if (m.memberKind === 'account') {
      const a = await db.getAccount(m.memberId);
      members.push({ memberKind: 'account' as const, memberId: m.memberId, role: m.role, joinedAt: m.joinedAt, name: a?.displayName ?? a?.email ?? m.memberId, isOwner: m.memberId === space.ownerAccountId });
    } else {
      const learner = await db.getLearner(m.memberId);
      members.push({ memberKind: 'learner' as const, memberId: m.memberId, role: m.role, joinedAt: m.joinedAt, name: rosterName(space, learner?.displayName ?? '?'), isOwner: false });
    }
  }
  return ok(c, { members });
});

spacesRoutes.patch('/:id/settings', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, db, space, 'space.manage');
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
  const account = await requireCan(c, db, space, 'space.manage');
  if (!('id' in account)) return account;
  space.archivedAt = space.archivedAt ?? new Date().toISOString();
  await db.putSpace(space);
  return ok(c, { space: publicSpace(space) });
});

spacesRoutes.post('/:id/unarchive', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, db, space, 'space.manage');
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
    if (existing) return ok(c, { alreadyMember: true, membership: existing, space: { id: space.id, kind: space.kind, name: space.name } });
    if (space.kind === 'class' && (await activeClassesOf(db, learnerId)) >= LEARNER_CLASS_CAP) {
      return fail(c, 'cap_learner', `A learner can be in at most ${LEARNER_CLASS_CAP} classes`, 409);
    }
    if (space.kind === 'class' && (await studentsIn(db, space.id)) >= (await classCap(db, space, now))) {
      return fail(c, 'cap_class', 'This class is full', 409);
    }
    if (space.kind === 'class' && (await schoolIsFull(db, space, now, learnerId))) {
      return fail(c, 'cap_school', 'This school has used all its seats', 409);
    }
    if (space.kind === 'family' && (await studentsIn(db, space.id)) >= FAMILY_LIFETIME_LEARNERS) {
      return fail(c, 'cap_family', `A family holds up to ${FAMILY_LIFETIME_LEARNERS} learners`, 409);
    }
    const membership: Membership = { spaceId: space.id, memberKind: 'learner', memberId: learnerId, role: 'student', joinedAt: now.toISOString() };
    await db.addMembership(membership);
    if (displayName) {
      const learner = await db.getLearner(learnerId);
      if (learner) await db.putLearner({ ...learner, displayName });
    }
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
  await db.addMembership(membership);
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
  return ok(c, { left: await db.removeMembership(space.id, 'learner', learnerId) });
});

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
  return ok(c, { removed: await db.removeMembership(space.id, kind, memberId) });
});

spacesRoutes.get('/:id/roster', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, db, space, 'summary.read');
  if (!('id' in account)) return account;
  const now = new Date();
  const learners = [];
  for (const m of await db.membersOf(space.id)) {
    if (m.memberKind !== 'learner') continue;
    const learner = await db.getLearner(m.memberId);
    if (!learner) continue;
    const snapshot = await db.getSnapshot(learner.id);
    // summary only — payload_json never leaves through this route (roadmap §3.1).
    learners.push({
      id: learner.id,
      displayName: rosterName(space, learner.displayName),
      ageGroup: learner.ageGroup,
      avatar: learner.avatar,
      joinedAt: m.joinedAt,
      lastActiveAt: learner.lastActiveAt,
      summary: snapshot?.summary ?? null,
      lastSyncedAt: snapshot?.updatedAt ?? null,
    });
  }
  learners.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  const manage = can(await accountActor(db, account), 'space.manage', { kind: 'space', ctx: await spaceContext(db, space) });
  return ok(c, { space: publicSpace(space), learners, ...(manage ? liveCode(space, now) : { joinCode: null, joinCodeExpiresAt: null }) });
});

/** Learner-facing rows for the sync inbox (archived spaces drop out). */
export async function learnerMembershipRows(db: Db, learnerId: string) {
  const rows = [];
  for (const m of await db.membershipsOf('learner', learnerId)) {
    const space = await db.getSpace(m.spaceId);
    if (space && !space.archivedAt) rows.push({ spaceId: space.id, kind: space.kind, name: space.name, role: m.role, joinedAt: m.joinedAt });
  }
  return rows;
}
