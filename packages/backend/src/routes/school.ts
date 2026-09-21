import { MemberAddSchema, type Membership, type Space } from '@hangul-route/content-schema';
import { Hono, type Context } from 'hono';
import { fail, ok } from '../envelope';
import { accountActor, requireAccount, spaceContext } from '../lib/access';
import { can } from '../lib/can';
import { isEntitlementActive, schoolLimits, schoolUsage } from '../lib/entitlement';
import { isJoinCodeLive } from '../lib/join-code';
import { store } from '../store';

/** /api/spaces/:id/school + /:id/members — F-SCHOOL-001 §3.2. Aggregates only. */
export const schoolRoutes = new Hono();

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function publicSpace(space: Space) {
  return { id: space.id, kind: space.kind, name: space.name, parentSpaceId: space.parentSpaceId, settings: space.settings, archivedAt: space.archivedAt, createdAt: space.createdAt };
}

function teacherOf(cls: Space, school: Space): { accountId: string; name: string } | null {
  const candidates = store.membersOf(cls.id).filter((m) => m.memberKind === 'account' && (m.role === 'teacher' || (m.role === 'owner' && m.memberId !== school.ownerAccountId)));
  const pick = candidates.find((m) => m.role === 'teacher') ?? candidates[0];
  if (!pick) return null;
  const account = store.accounts.get(pick.memberId);
  return { accountId: pick.memberId, name: account?.displayName ?? account?.email ?? pick.memberId };
}

schoolRoutes.get('/:id/school', async (c: Context) => {
  const school = store.spaces.get(c.req.param('id') ?? '');
  if (!school || school.kind !== 'school') return fail(c, 'not_found', 'School not found', 404);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (!can(accountActor(account), 'space.manage', { kind: 'space', ctx: spaceContext(school) })) return fail(c, 'forbidden', 'Not allowed for this school', 403);

  const now = new Date();
  const limits = schoolLimits(school, now);
  const usage = schoolUsage(school);
  const classes = store
    .childSpaces(school.id)
    .filter((s) => s.kind === 'class')
    .map((cls) => {
      const learners = store.membersOf(cls.id).filter((m) => m.memberKind === 'learner');
      const lastActive = learners
        .map((m) => store.learners.get(m.memberId)?.lastActiveAt ?? null)
        .filter((t): t is string => !!t)
        .sort()
        .at(-1) ?? null;
      const practiced = learners.filter((m) => {
        const snap = store.snapshots.get(m.memberId);
        const summary = snap?.summary as { minutesLast7d?: number; lastActiveAt?: string } | undefined;
        return !!summary && (summary.minutesLast7d ?? 0) > 0 && !!summary.lastActiveAt && now.getTime() - Date.parse(summary.lastActiveAt) < WEEK_MS;
      }).length;
      return {
        space: publicSpace(cls),
        teacher: teacherOf(cls, school),
        students: learners.length,
        practiced,
        lastActiveAt: lastActive,
        hasPublishedPlan: store.plansOf(cls.id).some((p) => p.publishedAt && !p.archivedAt),
      };
    })
    .sort((a, b) => Number(!!a.space.archivedAt) - Number(!!b.space.archivedAt) || b.space.createdAt.localeCompare(a.space.createdAt));
  const live = classes.filter((k) => !k.space.archivedAt);
  const seen = new Set<string>();
  let practiced = 0;
  for (const cls of store.childSpaces(school.id).filter((s) => s.kind === 'class' && !s.archivedAt)) {
    for (const m of store.membersOf(cls.id)) {
      if (m.memberKind !== 'learner' || seen.has(m.memberId)) continue;
      seen.add(m.memberId);
      const summary = store.snapshots.get(m.memberId)?.summary as { minutesLast7d?: number; lastActiveAt?: string } | undefined;
      if (summary && (summary.minutesLast7d ?? 0) > 0 && summary.lastActiveAt && now.getTime() - Date.parse(summary.lastActiveAt) < WEEK_MS) practiced += 1;
    }
  }
  const license = limits.license;
  return ok(c, {
    school: publicSpace(school),
    invite: isJoinCodeLive(school, now) ? { joinCode: school.joinCode, joinCodeExpiresAt: school.joinCodeExpiresAt } : { joinCode: null, joinCodeExpiresAt: null },
    license: license ? { ...license, subjectName: school.name, active: isEntitlementActive(license, now) } : null,
    limits: { licensed: limits.licensed, students: limits.students, teachers: limits.teachers },
    usage,
    thisWeek: { students: usage.students, practiced, classes: live.length, classesWithPlan: live.filter((k) => k.hasPublishedPlan).length },
    classes,
  });
});

schoolRoutes.post('/:id/members', async (c: Context) => {
  const cls = store.spaces.get(c.req.param('id') ?? '');
  if (!cls || cls.archivedAt) return fail(c, 'not_found', 'Space not found', 404);
  if (cls.kind !== 'class') return fail(c, 'bad_request', 'Teachers are assigned to classes', 422);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (!can(accountActor(account), 'roster.manage', { kind: 'space', ctx: spaceContext(cls) })) return fail(c, 'forbidden', 'Not allowed for this class', 403);
  const parsed = MemberAddSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid member body', 422, { issues: parsed.error.issues });
  const school = cls.parentSpaceId ? store.spaces.get(cls.parentSpaceId) : undefined;
  const inSchool = !!school && school.kind === 'school' && (store.membership(school.id, 'account', parsed.data.accountId) !== undefined || school.ownerAccountId === parsed.data.accountId);
  if (!inSchool) return fail(c, 'not_in_school', 'That teacher has not joined the school yet', 422);
  const existing = store.membership(cls.id, 'account', parsed.data.accountId);
  if (existing) return ok(c, { membership: existing, alreadyMember: true });
  const membership: Membership = { spaceId: cls.id, memberKind: 'account', memberId: parsed.data.accountId, role: 'teacher', joinedAt: new Date().toISOString() };
  store.addMembership(membership);
  return ok(c, { membership, alreadyMember: false }, 201);
});
