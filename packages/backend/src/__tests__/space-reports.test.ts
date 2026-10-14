import { CATALOG, ClassReportResponseSchema, LearnerReportResponseSchema, ReportSummarySchema, classReport, type ReportSummary } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { D1Db } from '../db';
import type { D1Like, D1PreparedLike } from '../db/d1';
import app from '../index';
import { setDevFallbacksDefaultForTests } from '../lib/runtime';
import { lookupLimiter } from '../routes/spaces';
import { store } from '../store';
import { testDb as db } from './helpers/db';
import { openSqliteD1 } from './helpers/sqlite';

/**
 * GET /api/spaces/:id/learners/:learnerId/report — F-REPORT-001 section 3.8
 * (RP-5). One learner's report body: the roster's projection of that learner's
 * summary, read with a narrow select (never `payload_json`), for exactly who
 * can open the roster. Runs on memory and, with HR_TEST_DB=sqlite, on the real
 * migrations.
 */
type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string } };
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
const deviceAuth = (deviceId: string, secret: string): Record<string, string> => ({ ...json, authorization: `Device ${deviceId}:${secret}` });

async function call(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, cacheControl: res.headers.get('cache-control'), body: (await res.json()) as Envelope };
}
const post = (path: string, headers: Record<string, string>, body?: unknown) => call('POST', path, headers, body);
const get = (path: string, headers: Record<string, string>) => call('GET', path, headers);

type Created = { space: { id: string }; joinCode: string | null };
async function createSpace(user: string, kind: string, name: string, extra: Record<string, unknown> = {}): Promise<Created> {
  const r = await post('/api/spaces', bearer(user), { kind, name, ...extra });
  expect(r.status).toBe(201);
  return r.body.data as Created;
}
async function issueCode(user: string, spaceId: string): Promise<string> {
  const r = await post(`/api/spaces/${spaceId}/code`, bearer(user));
  expect(r.status).toBe(200);
  return (r.body.data as { joinCode: string }).joinCode;
}
async function registerLearner(deviceId: string, name: string) {
  const r = await post('/api/sync/learners', json, { deviceId, learner: { displayName: name, ageGroup: '5-7', avatar: 'hoya-orange' } });
  expect(r.status).toBe(201);
  const data = r.body.data as { learner: { id: string }; device: { secret: string } };
  return { learnerId: data.learner.id, auth: deviceAuth(deviceId, data.device.secret) };
}
async function join(spaceId: string, headers: Record<string, string>, body: Record<string, unknown>): Promise<void> {
  expect((await post(`/api/spaces/${spaceId}/join`, headers, body)).status).toBe(201);
}

const snapshotFor = (profileId: string) => ({
  profileId,
  updatedAt: '2026-10-01T00:00:00.000Z',
  episodes: [],
  quests: [{ questId: 'quest:payload-only-1', episodeId: 'episode:stage1-letters', startedAt: 't', completedAt: 't', stars: 3, attempts: 1, accuracy: 1 }],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});
const baseSummary = {
  schemaVersion: 1,
  lastActiveAt: '2026-10-01T00:00:00.000Z',
  streakDays: 2,
  stage1: { questsDone: 4, questsTotal: 15, anchorAccuracy: 0.75 },
  stage1Anchor: { met: false, checkedAt: '2026-09-30T00:00:00.000Z', tricky: ['ㅂ'] },
  cardsUnlocked: 3,
  minutesLast7d: 21,
  jamoRecognized: ['ㄱ', 'ㄴ'],
  needsPractice: ['ㅂ'],
  planProgress: {},
};
async function upload(learner: { learnerId: string; auth: Record<string, string> }, summary: Record<string, unknown>): Promise<void> {
  const r = await call('PUT', `/api/sync/learners/${learner.learnerId}/snapshot`, learner.auth, { baseRev: 0, snapshot: snapshotFor(learner.learnerId), summary, schemaVer: 1, contentVer: '2026.10' });
  expect(r.status).toBe(200);
}

const reportPath = (spaceId: string, learnerId: string, period?: string) =>
  `/api/spaces/${spaceId}/learners/${learnerId}/report${period === undefined ? '' : `?period=${period}`}`;
const viewed = () => store.events.filter((e) => e.name === 'report.viewed');

beforeEach(async () => {
  await db.reset();
  store.reset();
  lookupLimiter.reset();
});
afterEach(() => vi.restoreAllMocks());

describe('GET /api/spaces/:id/learners/:learnerId/report (F-REPORT-001 section 3.8, RP-5)', () => {
  it('serves a family caregiver and owner the family projection: the summary keys a report reads, never the payload or the age group', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const famCode = await issueCode('mom', fam.space.id);
    await join(fam.space.id, bearer('dad'), { code: famCode });
    const mina = await registerLearner('device-mina0001', 'Mina');
    await join(fam.space.id, mina.auth, { code: famCode, learnerId: mina.learnerId });
    const selfRoute = { done: 2, total: 5, notReady: 0, weeks: 6, endsOn: '2026-11-20' };
    const routeGoal = { stage: 'stage2', from: 'family' };
    const vocab = { collected: 6, strong: 2, topicsStarted: 1, topicsPracticed7d: 1, firstTryRate: 0.5, needsPractice: ['vocab:apple'] };
    await upload(mina, { ...baseSummary, selfRoute, routeGoal, vocab });

    for (const user of ['mom', 'dad']) {
      const r = await get(reportPath(fam.space.id, mina.learnerId), bearer(user));
      expect(r.status, user).toBe(200);
      const body = LearnerReportResponseSchema.parse(r.body.data);
      expect(body.space).toMatchObject({ id: fam.space.id, kind: 'family', name: 'Kim family', archivedAt: null });
      expect(body.learner).toMatchObject({ id: mina.learnerId, displayName: 'Mina', avatar: 'hoya-orange' });
      expect(Date.parse(body.learner.joinedAt)).not.toBeNaN();
      expect(Date.parse(body.learner.lastActiveAt)).not.toBeNaN();
      expect(body.summary).toMatchObject({ cardsUnlocked: 3, needsPractice: ['ㅂ'], selfRoute, stage1: { questsDone: 4 } });
      expect(Date.parse(body.lastSyncedAt ?? '')).not.toBeNaN();
      expect(Date.parse(body.serverTime)).not.toBeNaN();
      expect(r.cacheControl).toBe('no-store');

      // Exactly the schema's shape: what the client parses is what the Worker sends.
      expect(r.body.data).toEqual(body);
      const raw = JSON.stringify(r.body);
      expect(raw).not.toContain('payload-only-1');
      expect(raw).not.toContain('ageGroup');
      expect(raw).not.toContain('joinCode');
      expect(raw).not.toContain('ownerAccountId');
      const summary = (r.body.data as { summary: Record<string, unknown> }).summary;
      for (const hidden of ['schemaVersion', 'routeGoal', 'payload']) expect(summary, hidden).not.toHaveProperty(hidden);
      // [TV] a family reads the full scope, with the learner's settings (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 2)
      expect(body.scope).toBe('full');
      expect(body.settings).toEqual({ classNotes: 'all' });
      expect(Object.keys(summary).every((key) => key in ReportSummarySchema.shape)).toBe(true);
    }
  });

  it('serves the class teacher and a school admin over the class the class projection: no self-route, no activity day before the learner joined', async () => {
    const sch = await createSpace('principal', 'school', 'School');
    await join(sch.space.id, bearer('teacher'), { code: await issueCode('principal', sch.space.id) });
    const cls = await createSpace('teacher', 'class', 'Sunday Class A', { parentSpaceId: sch.space.id });
    const fam = await createSpace('mom', 'family', 'Kim family');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    await join(fam.space.id, suni.auth, { code: await issueCode('mom', fam.space.id), learnerId: suni.learnerId });

    const roster = await get(`/api/spaces/${cls.space.id}/roster`, bearer('teacher'));
    const joinedAt = (roster.body.data as { learners: Array<{ joinedAt: string }> }).learners[0]?.joinedAt as string;
    const joinDay = joinedAt.slice(0, 10);
    const dayBefore = new Date(Date.parse(`${joinDay}T00:00:00.000Z`) - 2 * 86_400_000).toISOString().slice(0, 10);
    const activity = {
      v: 1,
      tz: 0,
      asOf: joinDay,
      days: [
        { d: dayBefore, min: 10, q: 1, c: 0, w: 0, j: ['ㄱ'] },
        { d: joinDay, min: 12, q: 1, c: 1, w: 0, j: [] },
      ],
      months: [],
      total: { since: dayBefore, min: 22, q: 2, c: 1, w: 0, days: 2 },
      milestones: [],
      next: { q: 'quest:stage1-letters-q2', plan: true },
    };
    const selfRoute = { done: 1, total: 3, notReady: 0, weeks: 4, endsOn: '2026-11-20' };
    await upload(suni, { ...baseSummary, selfRoute, activity });

    for (const user of ['teacher', 'principal']) {
      const r = await get(reportPath(cls.space.id, suni.learnerId), bearer(user));
      expect(r.status, user).toBe(200);
      const body = LearnerReportResponseSchema.parse(r.body.data);
      expect(body.space.kind).toBe('class');
      expect(body.learner.joinedAt).toBe(joinedAt);
      expect(body.summary).not.toHaveProperty('selfRoute');
      expect(body.summary?.activity?.days.map((d) => d.d)).toEqual([joinDay]);
      expect(body.summary?.activity?.total).toEqual({ ...activity.total, since: null });
      expect(body.summary?.activity?.next).toEqual({ q: 'quest:stage1-letters-q2', plan: false });
      // The same projection as the roster: a report never shows more than the roster's consent allows.
      const rosterRow = ((await get(`/api/spaces/${cls.space.id}/roster`, bearer(user))).body.data as { learners: Array<{ summary: unknown }> }).learners[0];
      expect(body.summary).toEqual(rosterRow?.summary);
    }

    const family = LearnerReportResponseSchema.parse((await get(reportPath(fam.space.id, suni.learnerId), bearer('mom'))).body.data);
    expect(family.summary?.selfRoute).toEqual(selfRoute);
    expect(family.summary?.activity?.days.map((d) => d.d)).toEqual([dayBefore, joinDay]);
    expect(family.summary?.activity?.next).toEqual({ q: 'quest:stage1-letters-q2', plan: true });
  });

  it('answers summary: null and lastSyncedAt: null for a learner whose device never saved progress (the no_data state)', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    const r = await get(reportPath(cls.space.id, suni.learnerId), bearer('teacher'));
    expect(r.status).toBe(200);
    expect(LearnerReportResponseSchema.parse(r.body.data)).toMatchObject({ summary: null, lastSyncedAt: null, learner: { id: suni.learnerId, displayName: 'Suni' } });
  });

  it('serves an archived space read-only, like the roster', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    await upload(suni, baseSummary);
    expect((await post(`/api/spaces/${cls.space.id}/archive`, bearer('teacher'))).status).toBe(200);
    const r = await get(reportPath(cls.space.id, suni.learnerId), bearer('teacher'));
    expect(r.status).toBe(200);
    const body = LearnerReportResponseSchema.parse(r.body.data);
    expect(body.space.archivedAt).not.toBeNull();
    expect(body.summary).toMatchObject({ cardsUnlocked: 3 });
  });

  it('shows the roster name: initials when the class anonymizes its roster', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni Park');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    expect((await call('PATCH', `/api/spaces/${cls.space.id}/settings`, bearer('teacher'), { anonymizeRoster: true })).status).toBe(200);
    const r = await get(reportPath(cls.space.id, suni.learnerId), bearer('teacher'));
    expect(r.status).toBe(200);
    expect((r.body.data as { learner: { displayName: string } }).learner.displayName).toBe('S. P.');
    expect(JSON.stringify(r.body)).not.toContain('Suni Park');
  });

  it('answers 401 without a session, 403 to an outsider and 404 for an unknown space', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    expect((await get(reportPath(cls.space.id, suni.learnerId), json)).status).toBe(401);
    // a learner's device credential never reaches an account route
    expect((await get(reportPath(cls.space.id, suni.learnerId), suni.auth)).status).toBe(401);
    expect((await get(reportPath(cls.space.id, suni.learnerId), bearer('stranger'))).status).toBe(403);
    const missing = await get(reportPath('space:nope', suni.learnerId), bearer('teacher'));
    expect(missing.status).toBe(404);
    expect(missing.body.error?.code).toBe('not_found');
    expect(viewed()).toEqual([]);
  });

  it('answers 404 not_member for a learner of another space and for an unknown id, with no hint which', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const other = await createSpace('teacher2', 'class', 'B');
    const suni = await registerLearner('device-suni0001', 'Suni');
    const minho = await registerLearner('device-minho001', 'Minho');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    await join(other.space.id, minho.auth, { code: other.joinCode, learnerId: minho.learnerId });
    await upload(minho, baseSummary);

    const elsewhere = await get(reportPath(cls.space.id, minho.learnerId), bearer('teacher'));
    const unknown = await get(reportPath(cls.space.id, 'profile:nobody'), bearer('teacher'));
    for (const r of [elsewhere, unknown]) {
      expect(r.status).toBe(404);
      expect(r.body.error?.code).toBe('not_member');
    }
    expect(elsewhere.body.error).toEqual(unknown.body.error);
    expect(JSON.stringify(elsewhere.body)).not.toContain('Minho');

    // a learner who left is no longer a member
    expect((await post(`/api/spaces/${cls.space.id}/leave`, suni.auth, { learnerId: suni.learnerId })).status).toBe(200);
    expect((await get(reportPath(cls.space.id, suni.learnerId), bearer('teacher'))).body.error?.code).toBe('not_member');
    expect(viewed()).toEqual([]);
  });

  it('answers 409 wrong_kind for a school space: its admin opens the class report instead', async () => {
    const sch = await createSpace('principal', 'school', 'School');
    const r = await get(reportPath(sch.space.id, 'profile:anyone'), bearer('principal'));
    expect(r.status).toBe(409);
    expect(r.body.error?.code).toBe('wrong_kind');
    // an outsider learns nothing about the kind
    expect((await get(reportPath(sch.space.id, 'profile:anyone'), bearer('stranger'))).status).toBe(403);
    expect(viewed()).toEqual([]);
  });

  it('records one report.viewed server event per served report, codes only, with an unknown period read as week', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const mina = await registerLearner('device-mina0001', 'Mina');
    await join(fam.space.id, mina.auth, { code: await issueCode('mom', fam.space.id), learnerId: mina.learnerId });
    const cls = await createSpace('teacher', 'class', 'A');
    await join(cls.space.id, mina.auth, { code: cls.joinCode, learnerId: mina.learnerId });

    expect((await get(reportPath(fam.space.id, mina.learnerId, 'month'), bearer('mom'))).status).toBe(200);
    expect((await get(reportPath(cls.space.id, mina.learnerId, 'day'), bearer('teacher'))).status).toBe(200);
    expect((await get(reportPath(cls.space.id, mina.learnerId, 'year'), bearer('teacher'))).status).toBe(200);
    expect((await get(reportPath(fam.space.id, mina.learnerId), bearer('mom'))).status).toBe(200);
    expect((await get(reportPath(fam.space.id, mina.learnerId, 'all'), bearer('mom'))).status).toBe(200);

    expect(viewed().map((e) => e.payload)).toEqual([
      { scope: 'learner', space: 'family', period: 'month' },
      { scope: 'learner', space: 'class', period: 'day' },
      { scope: 'learner', space: 'class', period: 'week' },
      { scope: 'learner', space: 'family', period: 'week' },
      { scope: 'learner', space: 'family', period: 'all' },
    ]);
    for (const event of viewed()) {
      expect(event.profileId).toBeUndefined();
      const raw = JSON.stringify(event);
      for (const id of [mina.learnerId, fam.space.id, cls.space.id, 'Mina', 'mom', 'teacher']) expect(raw).not.toContain(id);
    }
  });

  it('fails closed in production: 503 without D1, 503 auth_not_configured without a Clerk key, 401 for a forged bearer with one (audit SEC-2)', async () => {
    const path = reportPath('space:fam', 'profile:any');
    setDevFallbacksDefaultForTests(false);
    try {
      const noDb = await app.request(path, { headers: bearer('mom') }, {});
      expect(noDb.status).toBe(503);
      expect(((await noDb.json()) as Envelope).error?.code).toBe('db_not_configured');
      const d1 = openSqliteD1();
      try {
        const T = '2026-10-01T00:00:00.000Z';
        const bound = new D1Db(d1);
        await bound.putAccount({ id: 'mom', email: null, displayName: null, consent: null, createdAt: T });
        await bound.putSpace({ id: 'space:fam', kind: 'family', name: 'Kim family', parentSpaceId: null, ownerAccountId: 'mom', joinCode: null, joinCodeExpiresAt: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: T });
        const noClerk = await app.request(path, { headers: bearer('mom') }, { DB: d1 });
        expect(noClerk.status).toBe(503);
        expect(((await noClerk.json()) as Envelope).error?.code).toBe('auth_not_configured');
        const forged = await app.request(path, { headers: bearer('mom') }, { DB: d1, CLERK_SECRET_KEY: 'sk_test_x' });
        expect(forged.status).toBe(401); // the bearer is not trusted as an account id
      } finally {
        d1.close();
      }
    } finally {
      setDevFallbacksDefaultForTests(true);
    }
    expect(viewed()).toEqual([]);
  });

  it('drops only a stored field the schema has since tightened, so the body always parses', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    // Written straight to storage, as an older build's accepted summary would sit there.
    const stale = { ...baseSummary, needsPractice: ['ㅂ', 'ㅅ', 'ㅈ', 'ㅊ'], stage1: { questsDone: 'four' }, planProgress: { 'plan:a': { done: 1, total: 2 } } };
    await db.putSnapshot({ learnerId: suni.learnerId, rev: 1, schemaVer: 1, contentVer: '2026.09', deviceId: 'device-suni0001', summary: stale, payload: snapshotFor(suni.learnerId), updatedAt: '2026-10-01T00:00:00.000Z' }, 0);
    const r = await get(reportPath(cls.space.id, suni.learnerId), bearer('teacher'));
    expect(r.status).toBe(200);
    expect(LearnerReportResponseSchema.parse(r.body.data)).toEqual(r.body.data);
    const summary = (r.body.data as { summary: Record<string, unknown> }).summary;
    expect(summary).not.toHaveProperty('needsPractice');
    expect(summary).not.toHaveProperty('stage1');
    // planProgress keeps this space's plans only (none here), and the rest arrives as stored
    expect(summary).toMatchObject({ cardsUnlocked: 3, jamoRecognized: ['ㄱ', 'ㄴ'], planProgress: {}, streakDays: 2 });
  });

  it('drops only the plan entry the schema has since tightened, never the other plans of the space', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    const stale = { ...baseSummary, planProgress: { 'plan:a': { done: 1, total: 2 }, 'plan:b': { done: -1, total: 3 }, 'plan:c': { done: 2, total: 2, notReady: 1 } } };
    await db.putSnapshot({ learnerId: suni.learnerId, rev: 1, schemaVer: 1, contentVer: '2026.09', deviceId: 'device-suni0001', summary: stale, payload: snapshotFor(suni.learnerId), updatedAt: '2026-10-01T00:00:00.000Z' }, 0);
    const plans = (await db.plansOf(cls.space.id)).concat(['plan:a', 'plan:b', 'plan:c'].map((id) => ({ id }) as Awaited<ReturnType<typeof db.plansOf>>[number]));
    vi.spyOn(db, 'plansOf').mockResolvedValue(plans);
    const r = await get(reportPath(cls.space.id, suni.learnerId), bearer('teacher'));
    expect(r.status).toBe(200);
    expect(LearnerReportResponseSchema.parse(r.body.data)).toEqual(r.body.data);
    expect((r.body.data as { summary: { planProgress: unknown } }).summary.planProgress).toEqual({
      'plan:a': { done: 1, total: 2, notReady: 0 },
      'plan:c': { done: 2, total: 2, notReady: 1 },
    });
  });

  it('answers a HEAD without recording a view', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    const res = await app.request(reportPath(cls.space.id, suni.learnerId), { method: 'HEAD', headers: bearer('teacher') });
    expect(res.status).toBe(200);
    expect(viewed()).toEqual([]);
  });

  it('answers not_member for a membership whose learner row is gone', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const ghost = await registerLearner('device-ghost001', 'Ghost');
    await join(cls.space.id, ghost.auth, { code: cls.joinCode, learnerId: ghost.learnerId });
    vi.spyOn(db, 'getLearner').mockResolvedValue(null);
    const r = await get(reportPath(cls.space.id, ghost.learnerId), bearer('teacher'));
    expect(r.status).toBe(404);
    expect(r.body.error?.code).toBe('not_member');
    expect(viewed()).toEqual([]);
  });

  it('never loads the full snapshot: the route reads the summary through the narrow summaryOf', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    await upload(suni, baseSummary);
    const getSnapshot = vi.spyOn(db, 'getSnapshot');
    const summaryOf = vi.spyOn(db, 'summaryOf');
    expect((await get(reportPath(cls.space.id, suni.learnerId), bearer('teacher'))).status).toBe(200);
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(summaryOf).toHaveBeenCalledTimes(1);
    expect(summaryOf).toHaveBeenCalledWith(suni.learnerId);
  });
});

/**
 * GET /api/spaces/:id/class-report — F-REPORT-001 sections 3.7 and 3.8
 * (RP-5b). Aggregates only, computed on the Worker from each member's roster
 * projection, read with batched, chunked narrow reads (`learnersOf`,
 * `summariesOf`), for exactly who can open the class roster.
 */
const classReportPath = (spaceId: string, query = '') => `/api/spaces/${spaceId}/class-report${query}`;
type RosterRow = { id: string; displayName: string; joinedAt: string; summary: ReportSummary | null; lastSyncedAt: string | null };

/** Today's activity for a learner who joined today: one practice day, one quest, one new letter. */
const todayActivity = (letter: string) => {
  const today = new Date().toISOString().slice(0, 10);
  return { v: 1, tz: 0, asOf: today, days: [{ d: today, min: 12, q: 1, c: 1, w: 0, j: [letter] }], months: [], total: { since: today, min: 12, q: 1, c: 1, w: 0, days: 1 }, milestones: [] };
};

describe('GET /api/spaces/:id/class-report (F-REPORT-001 sections 3.7 and 3.8, RP-5b)', () => {
  // A fixed instant, so an upload and the route's own `now` always fall on the same learner day (no flake at UTC midnight).
  const NOW = '2026-10-15T12:00:00.000Z';
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(NOW), toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('serves the class teacher and a school admin over the class the aggregates of every learner member: no id, no name, no payload', async () => {
    const sch = await createSpace('principal', 'school', 'School');
    await join(sch.space.id, bearer('teacher'), { code: await issueCode('principal', sch.space.id) });
    const cls = await createSpace('teacher', 'class', 'Sunday Class A', { parentSpaceId: sch.space.id });
    const other = await createSpace('teacher2', 'class', 'B');
    const suni = await registerLearner('device-suni0001', 'Suni Park');
    const minho = await registerLearner('device-minho001', 'Minho Lee');
    const jiwoo = await registerLearner('device-jiwoo001', 'Jiwoo Han');
    const outsider = await registerLearner('device-outs0001', 'Outsider');
    for (const l of [suni, minho, jiwoo]) await join(cls.space.id, l.auth, { code: cls.joinCode, learnerId: l.learnerId });
    await join(other.space.id, outsider.auth, { code: other.joinCode, learnerId: outsider.learnerId });
    // Suni: day-by-day data; Minho: an older app (no activity); Jiwoo: never saved; the outsider practiced elsewhere.
    await upload(suni, { ...baseSummary, activity: todayActivity('ㄱ') });
    await upload(minho, { ...baseSummary, needsPractice: ['ㅂ', 'ㅅ'] });
    await upload(outsider, { ...baseSummary, activity: todayActivity('ㄴ') });

    for (const user of ['teacher', 'principal']) {
      const r = await get(classReportPath(cls.space.id), bearer(user));
      expect(r.status, user).toBe(200);
      const body = ClassReportResponseSchema.parse(r.body.data);
      // Exactly the schema's shape: what the client parses is what the Worker sends.
      expect(r.body.data).toEqual(body);
      expect(body.space).toMatchObject({ id: cls.space.id, kind: 'class', name: 'Sunday Class A', archivedAt: null });
      expect(body.period).toBe('week');
      expect(Date.parse(body.serverTime)).not.toBeNaN();
      expect(body.report.class).toEqual({ learners: 3, withActivity: 1, olderApp: 1, notSaved7d: 0 });
      expect(body.report.headline).toMatchObject({ code: 'class_practiced', practiced: 1, learners: 3 });
      expect(body.report.wentWell.lettersNew).toEqual([{ letter: 'ㄱ', learners: 1 }]);
      expect(body.report.revisit).toEqual([
        { letter: 'ㅂ', learners: 2 },
        { letter: 'ㅅ', learners: 1 },
      ]);
      expect(r.cacheControl).toBe('no-store');

      // The report is the class aggregate of the roster's own projection: never more than the roster's consent allows.
      const roster = (await get(`/api/spaces/${cls.space.id}/roster`, bearer(user))).body.data as { learners: RosterRow[] };
      const expected = classReport({
        learners: roster.learners.map((row) => ({ summary: row.summary, lastSyncedAt: row.lastSyncedAt, joinedAt: row.joinedAt })),
        plans: await db.plansOf(cls.space.id),
        period: 'week',
        now: new Date(body.serverTime),
        catalog: CATALOG,
      });
      expect(body.report).toEqual(expected);

      const raw = JSON.stringify(r.body);
      for (const hidden of [suni.learnerId, minho.learnerId, jiwoo.learnerId, outsider.learnerId, 'Suni', 'Minho', 'Jiwoo', 'Outsider', 'payload-only-1', 'joinCode', 'ownerAccountId', 'ageGroup', 'avatar', 'hoya-orange'])
        expect(raw, hidden).not.toContain(hidden);
    }
  });

  it('counts the class plans as homework rows, never a plan of another space', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    const T = '2026-10-01T00:00:00.000Z';
    await db.putPlan({ id: 'plan:week-one', spaceId: cls.space.id, authorAccountId: 'teacher', title: 'Week one', items: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }], targetLearnerIds: null, publishedAt: T, archivedAt: null, createdAt: T, updatedAt: T, meta: null });
    const progress = { 'plan:week-one': { done: 1, total: 1, notReady: 0 }, 'plan:elsewhere': { done: 2, total: 2, notReady: 0 } };
    await upload(suni, { ...baseSummary, planProgress: progress, activity: todayActivity('ㄱ') });
    const body = ClassReportResponseSchema.parse((await get(classReportPath(cls.space.id), bearer('teacher'))).body.data);
    const expected = classReport({
      learners: [{ summary: ((await get(`/api/spaces/${cls.space.id}/roster`, bearer('teacher'))).body.data as { learners: RosterRow[] }).learners[0]?.summary ?? null, lastSyncedAt: null, joinedAt: null }],
      plans: await db.plansOf(cls.space.id),
      period: 'week',
      now: new Date(body.serverTime),
      catalog: CATALOG,
    });
    expect(body.report.plans).toEqual(expected.plans);
    expect(body.report.plans).toMatchObject([{ planId: 'plan:week-one', title: 'Week one', assigned: 1, finished: 1 }]);
    expect(JSON.stringify(body)).not.toContain('plan:elsewhere');
  });

  it('reads the period and the day it steps back to, with an unknown period read as week', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    await upload(suni, { ...baseSummary, activity: todayActivity('ㄱ') });
    for (const [query, period] of [['?period=month', 'month'], ['?period=day', 'day'], ['?period=all', 'all'], ['?period=year', 'week'], ['', 'week']] as const) {
      const body = ClassReportResponseSchema.parse((await get(classReportPath(cls.space.id, query), bearer('teacher'))).body.data);
      expect(body.period, query).toBe(period);
      expect(body.report.period, query).toBe(period);
    }
    // Last week: today's practice is not in it; a malformed day reads as the current window.
    const lastWeek = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const past = ClassReportResponseSchema.parse((await get(classReportPath(cls.space.id, `?period=week&at=${lastWeek}`), bearer('teacher'))).body.data);
    expect(past.report.headline.practiced).toBe(0);
    const malformed = ClassReportResponseSchema.parse((await get(classReportPath(cls.space.id, '?period=week&at=not-a-day'), bearer('teacher'))).body.data);
    expect(malformed.report.headline.practiced).toBe(1);
  });

  it('echoes the window the figures read: a day within the limits as asked, a month from its 1st, null for the current window', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    await upload(suni, { ...baseSummary, activity: todayActivity('ㄱ') });
    const cases = [
      ['?period=week&at=2026-10-08', '2026-10-08'],
      ['?period=day&at=2026-10-15', '2026-10-15'],
      ['?period=month&at=2026-09-20', '2026-09-01'],
      ['', null],
      ['?period=week', null],
      ['?period=week&at=not-a-day', null],
      ['?period=week&at=2026-10-20', null],
      ['?period=week&at=2020-01-07', null],
      ['?period=all&at=2026-10-08', null],
    ] as const;
    const roster = (await get(`/api/spaces/${cls.space.id}/roster`, bearer('teacher'))).body.data as { learners: RosterRow[] };
    for (const [query, at] of cases) {
      const r = await get(classReportPath(cls.space.id, query), bearer('teacher'));
      expect(r.status, query).toBe(200);
      const body = ClassReportResponseSchema.parse(r.body.data);
      expect(r.body.data, query).toEqual(body);
      expect(body.at, query).toBe(at);
      // The figures read exactly the echoed window.
      const expected = classReport({
        learners: roster.learners.map((row) => ({ summary: row.summary, lastSyncedAt: row.lastSyncedAt, joinedAt: row.joinedAt })),
        plans: await db.plansOf(cls.space.id),
        period: body.period,
        at: body.at,
        now: new Date(body.serverTime),
        catalog: CATALOG,
      });
      expect(body.report, query).toEqual(expected);
    }
  });

  it('reads each member from their join day and their last sync: no day before joining, a known 0 after it, a stale device in notSaved7d', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    // A long-standing member: joined on 2026-09-25, with a row from before that day (practice at home) and one today.
    const old = await registerLearner('device-old00001', 'Old');
    await db.addMembership({ spaceId: cls.space.id, memberKind: 'learner', memberId: old.learnerId, role: 'student', joinedAt: '2026-09-25T12:00:00.000Z' });
    const activity = {
      v: 1,
      tz: 0,
      asOf: '2026-10-15',
      days: [
        { d: '2026-09-20', min: 30, q: 2, c: 1, w: 0, j: ['ㄷ'] },
        { d: '2026-10-15', min: 12, q: 1, c: 1, w: 0, j: ['ㄱ'] },
      ],
      months: [],
      total: { since: '2026-09-20', min: 42, q: 3, c: 2, w: 0, days: 2 },
      milestones: [],
    };
    await upload(old, { ...baseSummary, activity });

    // The day before they joined: the row from home never reaches the class, and the member sits out of that window.
    const before = ClassReportResponseSchema.parse((await get(classReportPath(cls.space.id, '?period=day&at=2026-09-20'), bearer('teacher'))).body.data);
    expect(before.at).toBe('2026-09-20');
    expect(before.report.headline.practiced).toBe(0);
    expect(before.report.wentWell.lettersNew).toEqual([]);
    expect(before.report.time.minutesTotal.count).toBe(0);
    expect(before.report.practice).toEqual({ dayBands: [{ band: 'practiced', learners: 0 }, { band: 'not_yet', learners: 0 }], notSaved: 1 });

    // A week after joining with no row: a known 0 (the class vouches for it from the join day), never "not saved".
    const quiet = ClassReportResponseSchema.parse((await get(classReportPath(cls.space.id, '?period=week&at=2026-10-01'), bearer('teacher'))).body.data);
    expect(quiet.report.practice.notSaved).toBe(0);
    expect(quiet.report.practice.dayBands).toContainEqual({ band: '0', learners: 1 });
    // Without the join day the first saved row (today) would stand in, and that week would read "not saved".
    const roster = (await get(`/api/spaces/${cls.space.id}/roster`, bearer('teacher'))).body.data as { learners: RosterRow[] };
    const withoutJoin = classReport({
      learners: roster.learners.map((row) => ({ summary: row.summary, lastSyncedAt: row.lastSyncedAt, joinedAt: null })),
      plans: [],
      period: 'week',
      at: '2026-10-01',
      now: new Date(NOW),
      catalog: CATALOG,
    });
    expect(withoutJoin.practice.notSaved).toBe(1);

    // An older app whose last sync was ten days ago: only the sync time can say so (it has no activity to date it).
    vi.setSystemTime(new Date('2026-10-05T12:00:00.000Z'));
    const stale = await registerLearner('device-stale001', 'Stale');
    await join(cls.space.id, stale.auth, { code: cls.joinCode, learnerId: stale.learnerId });
    await upload(stale, baseSummary);
    vi.setSystemTime(new Date(NOW));
    const now = ClassReportResponseSchema.parse((await get(classReportPath(cls.space.id), bearer('teacher'))).body.data);
    expect(now.report.class).toEqual({ learners: 2, withActivity: 1, olderApp: 1, notSaved7d: 1 });
  });

  it('answers 409 wrong_kind for a family space (siblings are never compared) and for a school space', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const mina = await registerLearner('device-mina0001', 'Mina');
    await join(fam.space.id, mina.auth, { code: await issueCode('mom', fam.space.id), learnerId: mina.learnerId });
    const sch = await createSpace('principal', 'school', 'School');
    for (const [spaceId, user] of [[fam.space.id, 'mom'], [sch.space.id, 'principal']] as const) {
      const r = await get(classReportPath(spaceId), bearer(user));
      expect(r.status, user).toBe(409);
      expect(r.body.error?.code).toBe('wrong_kind');
      expect(JSON.stringify(r.body)).not.toContain('Mina');
      // an outsider learns nothing about the kind
      expect((await get(classReportPath(spaceId), bearer('stranger'))).status).toBe(403);
    }
    expect(viewed()).toEqual([]);
  });

  it('answers 401 without a session or with a learner device, 403 to an outsider and 404 for an unknown space', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    expect((await get(classReportPath(cls.space.id), json)).status).toBe(401);
    expect((await get(classReportPath(cls.space.id), suni.auth)).status).toBe(401);
    expect((await get(classReportPath(cls.space.id), bearer('stranger'))).status).toBe(403);
    const missing = await get(classReportPath('space:nope'), bearer('teacher'));
    expect(missing.status).toBe(404);
    expect(missing.body.error?.code).toBe('not_found');
    expect(viewed()).toEqual([]);
  });

  it('serves an archived class read-only, like the roster', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    await upload(suni, { ...baseSummary, activity: todayActivity('ㄱ') });
    expect((await post(`/api/spaces/${cls.space.id}/archive`, bearer('teacher'))).status).toBe(200);
    const r = await get(classReportPath(cls.space.id), bearer('teacher'));
    expect(r.status).toBe(200);
    const body = ClassReportResponseSchema.parse(r.body.data);
    expect(body.space.archivedAt).not.toBeNull();
    expect(body.report.class.learners).toBe(1);
  });

  it('serves an empty class: every figure 0, nothing to hide', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const body = ClassReportResponseSchema.parse((await get(classReportPath(cls.space.id), bearer('teacher'))).body.data);
    expect(body.report.class).toEqual({ learners: 0, withActivity: 0, olderApp: 0, notSaved7d: 0 });
    expect(body.report.headline).toMatchObject({ practiced: 0, learners: 0 });
  });

  it('records one report.viewed server event per served class report, codes only; a HEAD records nothing', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    expect((await get(classReportPath(cls.space.id, '?period=month'), bearer('teacher'))).status).toBe(200);
    expect((await get(classReportPath(cls.space.id, '?period=year'), bearer('teacher'))).status).toBe(200);
    expect((await app.request(classReportPath(cls.space.id), { method: 'HEAD', headers: bearer('teacher') })).status).toBe(200);
    expect(viewed().map((e) => e.payload)).toEqual([
      { scope: 'class', space: 'class', period: 'month' },
      { scope: 'class', space: 'class', period: 'week' },
    ]);
    for (const event of viewed()) {
      expect(event.profileId).toBeUndefined();
      const raw = JSON.stringify(event);
      for (const id of [suni.learnerId, cls.space.id, 'Suni', 'teacher']) expect(raw).not.toContain(id);
    }
  });

  it('counts only members whose learner row exists, as the roster does', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    const ghost = await registerLearner('device-ghost001', 'Ghost');
    for (const l of [suni, ghost]) await join(cls.space.id, l.auth, { code: cls.joinCode, learnerId: l.learnerId });
    await upload(ghost, { ...baseSummary, activity: todayActivity('ㄱ') });
    const learnersOf = db.learnersOf.bind(db);
    vi.spyOn(db, 'learnersOf').mockImplementation(async (ids) => (await learnersOf(ids)).filter((id) => id !== ghost.learnerId));
    const body = ClassReportResponseSchema.parse((await get(classReportPath(cls.space.id), bearer('teacher'))).body.data);
    expect(body.report.class).toMatchObject({ learners: 1, withActivity: 0 });
  });

  it('never loads a full snapshot or a learner row: one batched learnersOf and one batched summariesOf', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const learners = [];
    for (const n of [1, 2, 3]) learners.push(await registerLearner(`device-lrn0000${n}`, `Learner ${n}`));
    for (const l of learners) await join(cls.space.id, l.auth, { code: cls.joinCode, learnerId: l.learnerId });
    for (const l of learners) await upload(l, baseSummary);
    const spies = { getSnapshot: vi.spyOn(db, 'getSnapshot'), summaryOf: vi.spyOn(db, 'summaryOf'), getLearner: vi.spyOn(db, 'getLearner'), getLearners: vi.spyOn(db, 'getLearners'), summariesOf: vi.spyOn(db, 'summariesOf'), learnersOf: vi.spyOn(db, 'learnersOf') };
    expect((await get(classReportPath(cls.space.id), bearer('teacher'))).status).toBe(200);
    for (const name of ['getSnapshot', 'summaryOf', 'getLearner', 'getLearners'] as const) expect(spies[name], name).not.toHaveBeenCalled();
    const ids = learners.map((l) => l.learnerId).sort();
    expect(spies.learnersOf).toHaveBeenCalledTimes(1);
    expect([...(spies.learnersOf.mock.calls[0]?.[0] ?? [])].sort()).toEqual(ids);
    expect(spies.summariesOf).toHaveBeenCalledTimes(1);
    expect([...(spies.summariesOf.mock.calls[0]?.[0] ?? [])].sort()).toEqual(ids);
  });

  it('300 members on the real migrations: a constant number of statements, at most 100 ids each, never payload_json', async () => {
    const d1 = openSqliteD1();
    const statements: Array<{ sql: string; params: number }> = [];
    let counting = false;
    const counted: D1Like = {
      prepare(sql: string): D1PreparedLike {
        const inner = d1.prepare(sql);
        const entry = { sql, params: 0 };
        if (counting) statements.push(entry);
        const stmt: D1PreparedLike = {
          bind(...values: unknown[]) {
            entry.params = values.length;
            inner.bind(...values);
            return stmt;
          },
          first: <T>() => inner.first<T>(),
          all: <T>() => inner.all<T>(),
          run: () => inner.run(),
        };
        return stmt;
      },
      batch: (batch) => d1.batch(batch),
    };
    const T = '2026-10-01T00:00:00.000Z';
    const seed = new D1Db(d1);
    const classOf = async (spaceId: string, members: number): Promise<void> => {
      await seed.putSpace({ id: spaceId, kind: 'class', name: spaceId, parentSpaceId: null, ownerAccountId: 'teacher', joinCode: null, joinCodeExpiresAt: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: T });
      await seed.addMembership({ spaceId, memberKind: 'account', memberId: 'teacher', role: 'owner', joinedAt: T });
      for (let i = 0; i < members; i += 1) {
        const id = `profile:${spaceId.slice(6)}-${String(i).padStart(3, '0')}`;
        await seed.putLearner({ id, displayName: `Learner ${i}`, ageGroup: '5-7', avatar: 'hoya-orange', recoveryHash: null, createdAt: T, lastActiveAt: T });
        await seed.addMembership({ spaceId, memberKind: 'learner', memberId: id, role: 'student', joinedAt: T });
        await seed.putSnapshot({ learnerId: id, rev: 1, schemaVer: 1, contentVer: '2026.10', deviceId: `device-${i}`, summary: { ...baseSummary, activity: todayActivity('ㄱ') }, payload: snapshotFor(id), updatedAt: T }, 0);
      }
    };
    const { setFallbackDb, fallbackDb } = await import('../db');
    const before = fallbackDb();
    try {
      await seed.putAccount({ id: 'teacher', email: null, displayName: null, consent: null, createdAt: T });
      await classOf('space:one', 1);
      await classOf('space:big', 300);
      setFallbackDb(new D1Db(counted));
      const run = async (spaceId: string) => {
        statements.length = 0;
        counting = true;
        const started = performance.now();
        const r = await get(classReportPath(spaceId), bearer('teacher'));
        const ms = performance.now() - started;
        counting = false;
        expect(r.status).toBe(200);
        return { body: ClassReportResponseSchema.parse(r.body.data), sql: statements.map((s) => ({ ...s })), ms };
      };
      const one = await run('space:one');
      const big = await run('space:big');
      expect(one.body.report.class.learners).toBe(1);
      expect(big.body.report.class).toMatchObject({ learners: 300, withActivity: 300 });
      expect(big.body.report.headline).toMatchObject({ practiced: 300, learners: 300 });

      const on = (table: string, sql: Array<{ sql: string }>) => sql.filter((s) => new RegExp(`\\bFROM ${table}\\b`).test(s.sql));
      // 300 members: 3 learner chunks, 3 summary chunks and ([TV]) 3 class-scope chunks; everything else is the same as for 1 member.
      expect(on('learners', big.sql)).toHaveLength(3);
      expect(on('snapshots', big.sql)).toHaveLength(3);
      expect(on('class_scope_acks', big.sql)).toHaveLength(3);
      expect(on('learners', one.sql)).toHaveLength(1);
      expect(on('snapshots', one.sql)).toHaveLength(1);
      expect(on('class_scope_acks', one.sql)).toHaveLength(1);
      expect(big.sql.length - one.sql.length).toBe(6);
      expect(big.sql.length).toBeLessThanOrEqual(19);
      for (const s of big.sql) {
        expect(s.params, s.sql).toBeLessThanOrEqual(100);
        expect(s.sql).not.toContain('payload_json');
        expect(s.sql).not.toMatch(/SELECT \* FROM (snapshots|learners)\b/);
      }
      expect(on('snapshots', big.sql).every((s) => s.sql.startsWith('SELECT learner_id, summary_json, updated_at FROM snapshots WHERE learner_id IN ('))).toBe(true);
      expect(on('learners', big.sql).every((s) => s.sql.startsWith('SELECT id FROM learners WHERE id IN ('))).toBe(true);
      // Timing note (section 9 assumption f): the whole 300-member call stays far inside the roster's latency budget on the shim.
      expect(big.ms).toBeLessThan(5_000);
    } finally {
      setFallbackDb(before);
      d1.close();
    }
  });
});
