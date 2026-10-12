import { LearnerReportResponseSchema, ReportSummarySchema } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { D1Db } from '../db';
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
  return { status: res.status, body: (await res.json()) as Envelope };
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
    await upload(mina, { ...baseSummary, selfRoute, routeGoal });

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

      // Exactly the schema's shape: what the client parses is what the Worker sends.
      expect(r.body.data).toEqual(body);
      const raw = JSON.stringify(r.body);
      expect(raw).not.toContain('payload-only-1');
      expect(raw).not.toContain('ageGroup');
      expect(raw).not.toContain('joinCode');
      expect(raw).not.toContain('ownerAccountId');
      const summary = (r.body.data as { summary: Record<string, unknown> }).summary;
      for (const hidden of ['schemaVersion', 'stage1Anchor', 'vocab', 'routeGoal', 'payload']) expect(summary, hidden).not.toHaveProperty(hidden);
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

  it('fails closed in production: 503 without a Clerk key, 401 for a forged bearer with one (audit SEC-2)', async () => {
    const path = reportPath('space:fam', 'profile:any');
    setDevFallbacksDefaultForTests(false);
    try {
      const unconfigured = await app.request(path, { headers: bearer('mom') }, {});
      expect(unconfigured.status).toBe(503);
      const d1 = openSqliteD1();
      try {
        const T = '2026-10-01T00:00:00.000Z';
        const bound = new D1Db(d1);
        await bound.putAccount({ id: 'mom', email: null, displayName: null, consent: null, createdAt: T });
        await bound.putSpace({ id: 'space:fam', kind: 'family', name: 'Kim family', parentSpaceId: null, ownerAccountId: 'mom', joinCode: null, joinCodeExpiresAt: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: T });
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
