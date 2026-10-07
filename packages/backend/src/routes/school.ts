import { MemberAddSchema, type Membership, type Space } from '@hangul-route/content-schema';
import { Hono, type Context } from 'hono';
import { dbFor, type Db } from '../db';
import { fail, ok } from '../envelope';
import { accountActor, requireAccount, spaceContext } from '../lib/access';
import { can } from '../lib/can';
import { isEntitlementActive, schoolLimits, schoolUsage } from '../lib/entitlement';
import { isJoinCodeLive } from '../lib/join-code';

/** /api/spaces/:id/school + /:id/members — F-SCHOOL-001 §3.2. Aggregates only. */
export const schoolRoutes = new Hono();

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function publicSpace(space: Space) {
  return { id: space.id, kind: space.kind, name: space.name, parentSpaceId: space.parentSpaceId, settings: space.settings, archivedAt: space.archivedAt, createdAt: space.createdAt };
}

async function teacherOf(db: Db, cls: Space, school: Space): Promise<{ accountId: string; name: string } | null> {
  const candidates = (await db.membersOf(cls.id)).filter((m) => m.memberKind === 'account' && (m.role === 'teacher' || (m.role === 'owner' && m.memberId !== school.ownerAccountId)));
  const pick = candidates.find((m) => m.role === 'teacher') ?? candidates[0];
  if (!pick) return null;
  const account = await db.getAccount(pick.memberId);
  return { accountId: pick.memberId, name: account?.displayName ?? account?.email ?? pick.memberId };
}

type WeekSummary = { minutesLast7d?: number; lastActiveAt?: string } | undefined;
function practicedThisWeek(summary: WeekSummary, now: Date): boolean {
  return !!summary && (summary.minutesLast7d ?? 0) > 0 && !!summary.lastActiveAt && now.getTime() - Date.parse(summary.lastActiveAt) < WEEK_MS;
}

schoolRoutes.get('/:id/school', async (c: Context) => {
  const db = dbFor(c);
  const school = await db.getSpace(c.req.param('id') ?? '');
  if (!school || school.kind !== 'school') return fail(c, 'not_found', 'School not found', 404);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (!can(await accountActor(db, account), 'space.manage', { kind: 'space', ctx: await spaceContext(db, school) })) return fail(c, 'forbidden', 'Not allowed for this school', 403);

  const now = new Date();
  const limits = await schoolLimits(db, school, now);
  const usage = await schoolUsage(db, school);
  const classes = [];
  const seen = new Set<string>();
  let practiced = 0;
  for (const cls of (await db.childSpaces(school.id)).filter((s) => s.kind === 'class')) {
    const learners = (await db.membersOf(cls.id)).filter((m) => m.memberKind === 'learner');
    const lastActive: string[] = [];
    let clsPracticed = 0;
    for (const m of learners) {
      const learner = await db.getLearner(m.memberId);
      if (learner) lastActive.push(learner.lastActiveAt);
      const summary = (await db.getSnapshot(m.memberId))?.summary as WeekSummary;
      const did = practicedThisWeek(summary, now);
      if (did) clsPracticed += 1;
      if (!cls.archivedAt && !seen.has(m.memberId)) {
        seen.add(m.memberId);
        if (did) practiced += 1;
      }
    }
    classes.push({
      space: publicSpace(cls),
      teacher: await teacherOf(db, cls, school),
      students: learners.length,
      practiced: clsPracticed,
      lastActiveAt: lastActive.sort().at(-1) ?? null,
      hasPublishedPlan: (await db.plansOf(cls.id)).some((p) => p.publishedAt && !p.archivedAt),
    });
  }
  classes.sort((a, b) => Number(!!a.space.archivedAt) - Number(!!b.space.archivedAt) || b.space.createdAt.localeCompare(a.space.createdAt));
  const live = classes.filter((k) => !k.space.archivedAt);
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
  const db = dbFor(c);
  const cls = await db.getSpace(c.req.param('id') ?? '');
  if (!cls || cls.archivedAt) return fail(c, 'not_found', 'Space not found', 404);
  if (cls.kind !== 'class') return fail(c, 'bad_request', 'Teachers are assigned to classes', 422);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (!can(await accountActor(db, account), 'roster.manage', { kind: 'space', ctx: await spaceContext(db, cls) })) return fail(c, 'forbidden', 'Not allowed for this class', 403);
  const parsed = MemberAddSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid member body', 422, { issues: parsed.error.issues });
  const school = cls.parentSpaceId ? await db.getSpace(cls.parentSpaceId) : null;
  const inSchool = !!school && school.kind === 'school' && ((await db.membership(school.id, 'account', parsed.data.accountId)) !== null || school.ownerAccountId === parsed.data.accountId);
  if (!inSchool) return fail(c, 'not_in_school', 'That teacher has not joined the school yet', 422);
  const existing = await db.membership(cls.id, 'account', parsed.data.accountId);
  if (existing) return ok(c, { membership: existing, alreadyMember: true });
  const membership: Membership = { spaceId: cls.id, memberKind: 'account', memberId: parsed.data.accountId, role: 'teacher', joinedAt: new Date().toISOString() };
  await db.addMembership(membership);
  return ok(c, { membership, alreadyMember: false }, 201);
});
