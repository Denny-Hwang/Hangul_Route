import { CLASS_SCOPE_TEXT_VERSION, LearnerReportResponseSchema, type MemorySummary } from '@hangul-route/content-schema';
import { LearningSummaryResponseSchema } from '@hangul-route/content-schema/learning-summary';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { lookupLimiter } from '../routes/spaces';
import { store } from '../store';
import { testDb as db } from './helpers/db';

/**
 * GET /api/spaces/:id/learning-summary — F-CURR-002 section 8 (row CM-16, Worker first): each learner's `memory`
 * block and the class aggregate of the items due for the most learners. Counts and content ids only, never an item
 * state; a class reads a block only where the family acknowledged the class-scope text that lists the `memory` item.
 * Runs on memory and, with HR_TEST_DB=sqlite, on the real migrations.
 */
type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string } };
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
const deviceAuth = (deviceId: string, secret: string): Record<string, string> => ({ ...json, authorization: `Device ${deviceId}:${secret}` });

async function call(method: string, path: string, headers: Record<string, string>, body?: unknown, env?: Record<string, unknown>) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env);
  return { status: res.status, cacheControl: res.headers.get('cache-control'), body: (await res.json()) as Envelope };
}
const post = (path: string, headers: Record<string, string>, body?: unknown) => call('POST', path, headers, body);
const get = (path: string, headers: Record<string, string>, env?: Record<string, unknown>) => call('GET', path, headers, undefined, env);

async function createSpace(user: string, kind: string, name: string, extra: Record<string, unknown> = {}): Promise<{ space: { id: string }; joinCode: string | null }> {
  const r = await post('/api/spaces', bearer(user), { kind, name, ...extra });
  expect(r.status).toBe(201);
  return r.body.data as { space: { id: string }; joinCode: string | null };
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

const snapshotFor = (profileId: string) => ({ profileId, updatedAt: '2026-10-21T00:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 });
const baseSummary = {
  schemaVersion: 1,
  lastActiveAt: '2026-10-21T00:00:00.000Z',
  streakDays: 2,
  stage1: { questsDone: 4, questsTotal: 15, anchorAccuracy: 0.75 },
  cardsUnlocked: 3,
  minutesLast7d: 21,
  jamoRecognized: ['ㄱ'],
  needsPractice: [],
  planProgress: {},
};
const block = (wordsKnown: number, topDue: string[]): MemorySummary => ({ wordsKnown, readyToRefresh: topDue.length, cellBestCounts: [4, 1, 0], stageChecks: 0, weekPoints: 12, topDue });
async function upload(learner: { learnerId: string; auth: Record<string, string> }, memory?: MemorySummary): Promise<void> {
  const summary = memory ? { ...baseSummary, memory } : baseSummary;
  const r = await call('PUT', `/api/sync/learners/${learner.learnerId}/snapshot`, learner.auth, { baseRev: 0, snapshot: snapshotFor(learner.learnerId), summary, schemaVer: 1, contentVer: '2026.10' });
  expect(r.status).toBe(200);
}
const ack = (learnerId: string, textVersion: string) => db.putClassScopeAck({ learnerId, textVersion, basis: 'caregiver', evidence: 'mom', ackedAt: '2026-10-21T00:00:00.000Z' });

const path = (spaceId: string) => `/api/spaces/${spaceId}/learning-summary`;
const read = async (spaceId: string, user: string, env?: Record<string, unknown>) => {
  const r = await get(path(spaceId), bearer(user), env);
  expect(r.status, user).toBe(200);
  expect(r.cacheControl).toBe('no-store');
  const body = LearningSummaryResponseSchema.parse(r.body.data);
  // Exactly the schema's shape: what a client parses is what the Worker sends.
  expect(r.body.data).toEqual(body);
  return body;
};

/** Every key of a value, at every depth (array indices left out). */
const keysOf = (value: unknown): string[] =>
  value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [...(/^\d+$/.test(k) ? [] : [k]), ...keysOf(v)]) : [];

beforeEach(async () => {
  await db.reset();
  store.reset();
  lookupLimiter.reset();
});

describe('GET /api/spaces/:id/learning-summary (F-CURR-002 section 8, row CM-16)', () => {
  it('serves a family caregiver and owner every learner block and the aggregate, with no item state and no name', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const code = await issueCode('mom', fam.space.id);
    await join(fam.space.id, bearer('dad'), { code });
    const mina = await registerLearner('device-mina0001', 'Mina');
    const jun = await registerLearner('device-jun00001', 'Jun');
    const new1 = await registerLearner('device-new00001', 'Ara');
    for (const learner of [mina, jun, new1]) await join(fam.space.id, learner.auth, { code, learnerId: learner.learnerId });
    await upload(mina, block(40, ['lex:sagwa', 'lex:bae~pear']));
    await upload(jun, block(12, ['lex:bae~pear']));
    // An answered state in the memory store: the route never reads or returns it.
    const pushed = await call('POST', `/api/sync/learners/${mina.learnerId}/memory`, mina.auth, {
      shards: { stage2: { 'lex:sagwa': { b: 2, d: '2026-10-22', c: 1, r: 3, n: 4, f: '2026-10-01', s: 3, at: '2026-10-21T10:00:00.000Z' } } },
    });
    expect(pushed.status).toBe(200);

    for (const user of ['mom', 'dad']) {
      const body = await read(fam.space.id, user);
      expect(body.space).toMatchObject({ id: fam.space.id, kind: 'family' });
      const byId = new Map(body.learners.map((row) => [row.learnerId, row]));
      expect(byId.get(mina.learnerId)?.memory).toEqual(block(40, ['lex:sagwa', 'lex:bae~pear']));
      expect(byId.get(jun.learnerId)?.memory).toEqual(block(12, ['lex:bae~pear']));
      // A learner whose device never saved progress: no block, never a zero.
      expect(byId.get(new1.learnerId)).toEqual({ learnerId: new1.learnerId, memory: null, classProgress: null });
      expect(body.learners.map((row) => row.learnerId)).toEqual([...body.learners.map((row) => row.learnerId)].sort());
      expect(body.class).toEqual({
        learners: 3,
        counted: 2,
        topDue: [
          { itemId: 'lex:bae~pear', learners: 2 },
          { itemId: 'lex:sagwa', learners: 1 },
        ],
      });
      const keys = keysOf(body);
      for (const field of ['b', 'd', 'c', 'r', 'n', 'f', 's', 'at', 'states', 'shards', 'seq']) expect(keys, field).not.toContain(field);
      for (const field of ['displayName', 'name', 'avatar', 'ageGroup']) expect(keysOf(body.learners), field).not.toContain(field);
      expect(JSON.stringify(body)).not.toMatch(/Mina|Jun|Ara/);
    }
  });

  it('serves a class a block only where the family read the class-scope text that lists the memory item', async () => {
    const sch = await createSpace('principal', 'school', 'School');
    await join(sch.space.id, bearer('teacher'), { code: await issueCode('principal', sch.space.id) });
    const cls = await createSpace('teacher', 'class', 'Sunday Class A', { parentSpaceId: sch.space.id });
    const base = await registerLearner('device-base0001', 'Bora');
    const earlier = await registerLearner('device-earl0001', 'Eun');
    const current = await registerLearner('device-curr0001', 'Chan');
    for (const learner of [base, earlier, current]) {
      await join(cls.space.id, learner.auth, { code: cls.joinCode, learnerId: learner.learnerId });
      await upload(learner, block(10, ['lex:sagwa']));
    }
    // The 10 text opens the full scope without the memory counts; the current one opens them.
    await ack(earlier.learnerId, 'class-scope-2026-10');
    await ack(current.learnerId, CLASS_SCOPE_TEXT_VERSION);

    for (const user of ['teacher', 'principal']) {
      const body = await read(cls.space.id, user);
      const byId = new Map(body.learners.map((row) => [row.learnerId, row.memory]));
      expect(byId.get(base.learnerId), 'base scope').toBeNull();
      expect(byId.get(earlier.learnerId), 'full scope at the 10 text').toBeNull();
      expect(byId.get(current.learnerId), 'memory scope').toEqual(block(10, ['lex:sagwa']));
      expect(body.class).toEqual({ learners: 3, counted: 1, topDue: [{ itemId: 'lex:sagwa', learners: 1 }] });
    }

    // The same rule on the learner report: a report never shows more than this route.
    const report = async (learnerId: string) => LearnerReportResponseSchema.parse((await get(`/api/spaces/${cls.space.id}/learners/${learnerId}/report`, bearer('teacher'))).body.data);
    expect((await report(current.learnerId)).summary?.memory).toEqual(block(10, ['lex:sagwa']));
    expect((await report(earlier.learnerId)).summary).not.toHaveProperty('memory');
    expect((await report(base.learnerId)).summary).not.toHaveProperty('memory');

    // The full-scope kill switch closes the memory counts too.
    const off = await read(cls.space.id, 'teacher', { CLASS_SCOPE_FULL: 'disabled' });
    expect(off.learners.every((row) => row.memory === null)).toBe(true);
    expect(off.class).toEqual({ learners: 3, counted: 0, topDue: [] });
  });

  it('answers 401 when signed out or with a learner device, 403 to an outsider and a teacher of another class, 404 for an unknown space', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    await createSpace('other-teacher', 'class', 'B');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await join(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    await upload(suni, block(5, ['lex:sagwa']));
    expect((await get(path(cls.space.id), json)).status).toBe(401);
    expect((await get(path(cls.space.id), suni.auth)).status).toBe(401);
    const outsider = await get(path(cls.space.id), bearer('stranger'));
    expect(outsider.status).toBe(403);
    expect(outsider.body.error?.code).toBe('forbidden');
    expect((await get(path(cls.space.id), bearer('other-teacher'))).status).toBe(403);
    const missing = await get(path('space:nope'), bearer('teacher'));
    expect(missing.status).toBe(404);
    expect(missing.body.error?.code).toBe('not_found');
    // A family grown-up of another family reads nothing of this class either.
    const fam = await createSpace('mom', 'family', 'Kim family');
    expect((await get(path(cls.space.id), bearer('mom'))).status).toBe(403);
    expect(fam.space.id).not.toBe(cls.space.id);
  });

  it('answers 409 wrong_kind for a school space: its admin opens the class', async () => {
    const sch = await createSpace('principal', 'school', 'School');
    const r = await get(path(sch.space.id), bearer('principal'));
    expect(r.status).toBe(409);
    expect(r.body.error?.code).toBe('wrong_kind');
  });

  it('serves an archived space read-only, and an empty class with nothing to count', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    expect(await read(cls.space.id, 'teacher')).toMatchObject({ learners: [], class: { learners: 0, counted: 0, topDue: [] } });
    expect((await post(`/api/spaces/${cls.space.id}/archive`, bearer('teacher'))).status).toBe(200);
    expect((await read(cls.space.id, 'teacher')).space.archivedAt).not.toBeNull();
  });

  it('writes nothing: no server event, and a GET never changes a stored summary', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const mina = await registerLearner('device-mina0001', 'Mina');
    await join(fam.space.id, mina.auth, { code: await issueCode('mom', fam.space.id), learnerId: mina.learnerId });
    await upload(mina, block(40, ['lex:sagwa']));
    const before = await db.summaryOf(mina.learnerId);
    const events = store.events.length;
    await read(fam.space.id, 'mom');
    expect(store.events.length).toBe(events);
    expect(await db.summaryOf(mina.learnerId)).toEqual(before);
  });
});
