import {
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
import { fail, ok } from '../envelope';
import { accountActor, requireAccount, spaceContext } from '../lib/access';
import { can, type Action } from '../lib/can';
import { authorizeDevice, parseDeviceHeader } from '../lib/device-auth';
import { classCap } from '../lib/entitlement';
import { generateJoinCode, isJoinCodeLive, joinCodeExpiry } from '../lib/join-code';
import { clientKey, createRateLimiter } from '../lib/rate-limit';
import { id, store, type Account } from '../store';

/**
 * /api/spaces — F-SPACE-001 §3.3. One shape for family / class / school;
 * every route resolves the actor once and asks `can()`.
 */
export const spacesRoutes = new Hono();

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

function studentsIn(spaceId: string): number {
  return store.membersOf(spaceId).filter((m) => m.memberKind === 'learner').length;
}

function activeClassesOf(learnerId: string): number {
  return store
    .membershipsOf('learner', learnerId)
    .map((m) => store.spaces.get(m.spaceId))
    .filter((s): s is Space => !!s && s.kind === 'class' && !s.archivedAt).length;
}

function issueCode(space: Space, now: Date): void {
  space.joinCode = generateJoinCode((code) => {
    const holder = store.spaceByCode(code);
    return !!holder && isJoinCodeLive(holder, now);
  });
  space.joinCodeExpiresAt = joinCodeExpiry(now);
}

/** Authorize an account for `action` on `space`; returns the account or an error Response. */
async function requireCan(c: Context, space: Space, action: Action): Promise<Response | Account> {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (!can(accountActor(account), action, { kind: 'space', ctx: spaceContext(space) })) {
    return fail(c, 'forbidden', 'Not allowed for this space', 403);
  }
  return account;
}

function findSpace(c: Context, spaceId: string, allowArchived = false): Response | Space {
  const space = store.spaces.get(spaceId);
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

  let parent: Space | null = null;
  if (input.parentSpaceId) {
    parent = store.spaces.get(input.parentSpaceId) ?? null;
    if (!parent || parent.archivedAt) return fail(c, 'not_found', 'Parent space not found', 404);
    if (parent.kind !== 'school' || input.kind !== 'class') return fail(c, 'bad_request', 'Only a class can sit under a school', 422);
    if (!can(accountActor(account), 'class.create', { kind: 'space', ctx: spaceContext(parent) })) {
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
  if (space.kind === 'class') issueCode(space, now);
  store.spaces.set(space.id, space);
  const membership: Membership = { spaceId: space.id, memberKind: 'account', memberId: account.id, role: 'owner', joinedAt: space.createdAt };
  store.addMembership(membership);
  return ok(c, { space: publicSpace(space), membership, ...liveCode(space, now) }, 201);
});

spacesRoutes.get('/', async (c) => {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const actor = accountActor(account);
  const now = new Date();
  const spaces = store
    .membershipsOf('account', account.id)
    .map((m) => ({ m, space: store.spaces.get(m.spaceId) }))
    .filter((x): x is { m: Membership; space: Space } => !!x.space)
    .sort((a, b) => b.space.createdAt.localeCompare(a.space.createdAt))
    .map(({ m, space }) => {
      const members = store.membersOf(space.id);
      const manage = can(actor, 'space.manage', { kind: 'space', ctx: spaceContext(space) });
      return {
        space: publicSpace(space),
        role: m.role,
        counts: {
          learners: members.filter((x) => x.memberKind === 'learner').length,
          accounts: members.filter((x) => x.memberKind === 'account').length,
          classes: store.childSpaces(space.id).length,
        },
        ...(manage ? liveCode(space, now) : { joinCode: null, joinCodeExpiresAt: null }),
      };
    });
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
  const space = store.spaceByCode(parsed.data.code);
  if (!space || space.archivedAt) return fail(c, 'code_not_found', 'No class or family has this code', 404);
  if (!isJoinCodeLive(space, new Date())) return fail(c, 'code_expired', 'This code has expired', 404);
  // Class rosters (names only) let a returning student pick themselves (F-TCH-001 §10.1).
  const roster =
    space.kind === 'class'
      ? store
          .membersOf(space.id)
          .filter((m) => m.memberKind === 'learner')
          .map((m) => ({ m, learner: store.learners.get(m.memberId) }))
          .filter((x): x is { m: Membership; learner: NonNullable<ReturnType<typeof store.learners.get>> } => !!x.learner)
          .map(({ learner }) => ({ learnerId: learner.id, name: rosterName(space, learner.displayName) }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];
  return ok(c, {
    space: { id: space.id, kind: space.kind, name: space.name },
    full: space.kind === 'class' && studentsIn(space.id) >= classCap(space, new Date()),
    roster,
  });
});

spacesRoutes.get('/:id/members', async (c) => {
  const space = findSpace(c, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, space, 'roster.manage');
  if (!('id' in account)) return account;
  const members = store.membersOf(space.id).map((m) => {
    if (m.memberKind === 'account') {
      const a = store.accounts.get(m.memberId);
      return { memberKind: 'account' as const, memberId: m.memberId, role: m.role, joinedAt: m.joinedAt, name: a?.displayName ?? a?.email ?? m.memberId, isOwner: m.memberId === space.ownerAccountId };
    }
    return { memberKind: 'learner' as const, memberId: m.memberId, role: m.role, joinedAt: m.joinedAt, name: rosterName(space, store.learners.get(m.memberId)?.displayName ?? '?'), isOwner: false };
  });
  return ok(c, { members });
});

spacesRoutes.patch('/:id/settings', async (c) => {
  const space = findSpace(c, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, space, 'space.manage');
  if (!('id' in account)) return account;
  const parsed = SpaceSettingsPatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid settings', 422, { issues: parsed.error.issues });
  space.settings = { ...space.settings, ...parsed.data };
  return ok(c, { space: publicSpace(space) });
});

spacesRoutes.post('/:id/archive', async (c) => {
  const space = findSpace(c, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, space, 'space.manage');
  if (!('id' in account)) return account;
  space.archivedAt = space.archivedAt ?? new Date().toISOString();
  return ok(c, { space: publicSpace(space) });
});

spacesRoutes.post('/:id/unarchive', async (c) => {
  const space = findSpace(c, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, space, 'space.manage');
  if (!('id' in account)) return account;
  space.archivedAt = null;
  return ok(c, { space: publicSpace(space) });
});

spacesRoutes.delete('/:id/learners/:learnerId/data', async (c) => {
  const space = findSpace(c, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const learnerId = c.req.param('learnerId');
  if (!store.membership(space.id, 'learner', learnerId)) return fail(c, 'not_found', 'Learner is not in this space', 404);
  const account = await requireCan(c, space, 'learner.delete');
  if (!('id' in account)) return account;
  return ok(c, { deleted: store.deleteLearner(learnerId) });
});

spacesRoutes.post('/:id/code', async (c) => {
  const space = findSpace(c, c.req.param('id'));
  if (!('id' in space)) return space;
  const account = await requireCan(c, space, 'space.manage');
  if (!('id' in account)) return account;
  const now = new Date();
  issueCode(space, now);
  return ok(c, { joinCode: space.joinCode, expiresAt: space.joinCodeExpiresAt });
});

spacesRoutes.post('/:id/join', async (c) => {
  const space = findSpace(c, c.req.param('id'));
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
    const existing = store.membership(space.id, 'learner', learnerId);
    if (existing) return ok(c, { alreadyMember: true, membership: existing, space: { id: space.id, kind: space.kind, name: space.name } });
    if (space.kind === 'class' && activeClassesOf(learnerId) >= LEARNER_CLASS_CAP) {
      return fail(c, 'cap_learner', `A learner can be in at most ${LEARNER_CLASS_CAP} classes`, 409);
    }
    if (space.kind === 'class' && studentsIn(space.id) >= classCap(space, now)) {
      return fail(c, 'cap_class', 'This class is full', 409);
    }
    const membership: Membership = { spaceId: space.id, memberKind: 'learner', memberId: learnerId, role: 'student', joinedAt: now.toISOString() };
    store.addMembership(membership);
    const learner = store.learners.get(learnerId);
    if (learner && displayName) learner.displayName = displayName;
    return ok(c, { alreadyMember: false, membership, space: { id: space.id, kind: space.kind, name: space.name } }, 201);
  }

  // Account path: co-parent into a family, invited teacher into a school.
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const roleFor: Partial<Record<Space['kind'], SpaceRole>> = { family: 'caregiver', school: 'teacher' };
  const role = roleFor[space.kind];
  if (!role) return fail(c, 'co_teacher_unsupported', 'Classes have one teacher for now', 403);
  const existing = store.membership(space.id, 'account', account.id);
  if (existing) return ok(c, { alreadyMember: true, membership: existing, space: { id: space.id, kind: space.kind, name: space.name } });
  const membership: Membership = { spaceId: space.id, memberKind: 'account', memberId: account.id, role, joinedAt: now.toISOString() };
  store.addMembership(membership);
  return ok(c, { alreadyMember: false, membership, space: { id: space.id, kind: space.kind, name: space.name } }, 201);
});

spacesRoutes.post('/:id/leave', async (c) => {
  const space = findSpace(c, c.req.param('id'));
  if (!('id' in space)) return space;
  const body = (await c.req.json().catch(() => ({}))) as { learnerId?: string };
  const learnerId = typeof body.learnerId === 'string' ? body.learnerId : '';
  if (!learnerId) return fail(c, 'bad_request', 'learnerId required', 422);
  const auth = await authorizeDevice(c, learnerId);
  if (typeof auth !== 'string') return auth;
  const removed = store.removeMembership(space.id, 'learner', learnerId);
  return ok(c, { left: removed });
});

spacesRoutes.delete('/:id/members/:kind/:memberId', async (c) => {
  const space = findSpace(c, c.req.param('id'));
  if (!('id' in space)) return space;
  const kind = c.req.param('kind');
  if (kind !== 'account' && kind !== 'learner') return fail(c, 'bad_request', 'kind must be account or learner', 422);
  const memberId = c.req.param('memberId');
  const account = await requireCan(c, space, 'roster.manage');
  if (!('id' in account)) return account;
  if (kind === 'account' && memberId === space.ownerAccountId) return fail(c, 'owner', 'The owner cannot be removed', 409);
  return ok(c, { removed: store.removeMembership(space.id, kind, memberId) });
});

spacesRoutes.get('/:id/roster', async (c) => {
  const space = findSpace(c, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, space, 'summary.read');
  if (!('id' in account)) return account;
  const now = new Date();
  const learners = store
    .membersOf(space.id)
    .filter((m) => m.memberKind === 'learner')
    .map((m) => ({ m, learner: store.learners.get(m.memberId) }))
    .filter((x): x is { m: Membership; learner: NonNullable<ReturnType<typeof store.learners.get>> } => !!x.learner)
    .sort((a, b) => b.learner.lastActiveAt.localeCompare(a.learner.lastActiveAt))
    .map(({ m, learner }) => {
      const snapshot = store.snapshots.get(learner.id);
      // summary only — payload_json never leaves through this route (roadmap §3.1).
      return {
        id: learner.id,
        displayName: rosterName(space, learner.displayName),
        ageGroup: learner.ageGroup,
        avatar: learner.avatar,
        joinedAt: m.joinedAt,
        lastActiveAt: learner.lastActiveAt,
        summary: snapshot?.summary ?? null,
        lastSyncedAt: snapshot?.updatedAt ?? null,
      };
    });
  const manage = can(accountActor(account), 'space.manage', { kind: 'space', ctx: spaceContext(space) });
  return ok(c, { space: publicSpace(space), learners, ...(manage ? liveCode(space, now) : { joinCode: null, joinCodeExpiresAt: null }) });
});

/** Learner-facing rows for the sync inbox (archived spaces drop out). */
export function learnerMembershipRows(learnerId: string) {
  return store
    .membershipsOf('learner', learnerId)
    .map((m) => ({ m, space: store.spaces.get(m.spaceId) }))
    .filter((x): x is { m: Membership; space: Space } => !!x.space && !x.space.archivedAt)
    .map(({ m, space }) => ({ spaceId: space.id, kind: space.kind, name: space.name, role: m.role, joinedAt: m.joinedAt }));
}
