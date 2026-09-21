import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { store } from '../store';

type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string } };
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
async function call(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Envelope };
}
async function createSpace(user: string, kind: string, name: string, extra: Record<string, unknown> = {}) {
  const r = await call('POST', '/api/spaces', bearer(user), { kind, name, ...extra });
  expect(r.status).toBe(201);
  return (r.body.data as { space: { id: string }; joinCode: string | null }).space.id;
}
async function issueCode(user: string, spaceId: string): Promise<string> {
  return ((await call('POST', `/api/spaces/${spaceId}/code`, bearer(user))).body.data as { joinCode: string }).joinCode;
}
async function registerAndJoin(spaceId: string, code: string, deviceId: string, name: string) {
  const reg = (await call('POST', '/api/sync/learners', json, { deviceId, learner: { displayName: name, ageGroup: '5-7', avatar: 'hoya-orange' } })).body.data as { learner: { id: string }; device: { secret: string } };
  const auth = { ...json, authorization: `Device ${deviceId}:${reg.device.secret}` };
  const joined = await call('POST', `/api/spaces/${spaceId}/join`, auth, { code, learnerId: reg.learner.id });
  return { learnerId: reg.learner.id, auth, status: joined.status, code: joined.body.error?.code };
}

beforeEach(() => store.reset());

describe('school admin (F-SCHOOL-001)', () => {
  it('shows invite, licence, seats, classes with teachers and aggregates — to the admin only', async () => {
    const sch = await createSpace('principal', 'school', 'Seoul Hangul School', { displayName: 'Principal' });
    expect((await call('GET', `/api/spaces/${sch}/school`, bearer('principal'))).body.data).toMatchObject({ invite: { joinCode: null }, license: null, limits: { licensed: false, students: null, teachers: null }, usage: { students: 0, teachers: 0 }, classes: [] });
    const invite = await issueCode('principal', sch);
    expect((await call('POST', `/api/spaces/${sch}/join`, bearer('ms-park'), { code: invite })).status).toBe(201);
    await call('POST', '/api/spaces', bearer('ms-park'), { kind: 'family', name: 'x', displayName: 'Ms Park' }); // seeds a display name
    const clsA = await createSpace('ms-park', 'class', 'Sunday Class A', { parentSpaceId: sch });
    const clsB = await createSpace('principal', 'class', 'Saturday K', { parentSpaceId: sch });
    const codeA = (store.spaces.get(clsA) as { joinCode: string }).joinCode;
    const suni = await registerAndJoin(clsA, codeA, 'device-suni0001', 'Suni');
    await call('PUT', `/api/sync/learners/${suni.learnerId}/snapshot`, suni.auth, {
      baseRev: 0,
      snapshot: { profileId: suni.learnerId, updatedAt: 't', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 },
      summary: { schemaVersion: 1, lastActiveAt: new Date().toISOString(), streakDays: 0, stage1: { questsDone: 1, questsTotal: 11, anchorAccuracy: null }, cardsUnlocked: 0, minutesLast7d: 12, jamoRecognized: [], needsPractice: [], planProgress: {} },
      schemaVer: 1,
      contentVer: '2026.09',
    });
    await call('PUT', `/api/spaces/${clsA}/plans`, bearer('ms-park'), { title: 'Week 1', items: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }], publish: true });
    store.applyEntitlement({ subjectKind: 'space', subjectId: sch, planKey: 'school_license', status: 'active', provider: 'manual' }, new Date());

    const view = (await call('GET', `/api/spaces/${sch}/school`, bearer('principal'))).body.data as {
      invite: { joinCode: string };
      license: { planKey: string; active: boolean; subjectName: string };
      limits: { licensed: boolean; students: number; teachers: number };
      usage: { students: number; teachers: number };
      thisWeek: { students: number; practiced: number; classes: number; classesWithPlan: number };
      classes: Array<{ space: { id: string }; teacher: { accountId: string; name: string } | null; students: number; practiced: number; hasPublishedPlan: boolean; lastActiveAt: string | null }>;
    };
    expect(view.invite.joinCode).toBe(invite);
    expect(view.license).toMatchObject({ planKey: 'school_license', active: true, subjectName: 'Seoul Hangul School' });
    expect(view.limits).toEqual({ licensed: true, students: 300, teachers: 10 });
    expect(view.usage).toEqual({ students: 1, teachers: 1 });
    expect(view.thisWeek).toEqual({ students: 1, practiced: 1, classes: 2, classesWithPlan: 1 });
    const rowA = view.classes.find((k) => k.space.id === clsA);
    const rowB = view.classes.find((k) => k.space.id === clsB);
    expect(rowA).toMatchObject({ teacher: { accountId: 'ms-park', name: 'Ms Park' }, students: 1, practiced: 1, hasPublishedPlan: true });
    expect(rowA?.lastActiveAt).toBeTruthy();
    expect(rowB).toMatchObject({ teacher: null, students: 0, hasPublishedPlan: false, lastActiveAt: null });
    expect(JSON.stringify(view)).not.toContain('Suni'); // aggregates only

    expect((await call('GET', `/api/spaces/${sch}/school`, bearer('ms-park'))).status).toBe(403);
    expect((await call('GET', `/api/spaces/${clsA}/school`, bearer('principal'))).status).toBe(404);
  });

  it('assigns a school teacher to a class (admin cascade), refuses outsiders, and enforces school seats on join', async () => {
    const sch = await createSpace('principal', 'school', 'School');
    const invite = await issueCode('principal', sch);
    await call('POST', `/api/spaces/${sch}/join`, bearer('mr-lee'), { code: invite });
    const cls = await createSpace('principal', 'class', 'Saturday K', { parentSpaceId: sch });
    expect((await call('POST', `/api/spaces/${cls}/members`, bearer('principal'), { accountId: 'stranger', role: 'teacher' })).body.error?.code).toBe('not_in_school');
    expect((await call('POST', `/api/spaces/${cls}/members`, bearer('principal'), { accountId: 'mr-lee', role: 'admin' })).status).toBe(422);
    expect((await call('POST', `/api/spaces/${cls}/members`, bearer('mr-lee'), { accountId: 'mr-lee', role: 'teacher' })).status).toBe(403);
    const assigned = await call('POST', `/api/spaces/${cls}/members`, bearer('principal'), { accountId: 'mr-lee', role: 'teacher' });
    expect(assigned.status).toBe(201);
    expect((await call('POST', `/api/spaces/${cls}/members`, bearer('principal'), { accountId: 'mr-lee', role: 'teacher' })).body.data).toMatchObject({ alreadyMember: true });
    expect((await call('POST', `/api/spaces/${sch}/members`, bearer('principal'), { accountId: 'mr-lee', role: 'teacher' })).status).toBe(422);
    // the assigned teacher now manages the class
    expect((await call('GET', `/api/spaces/${cls}/roster`, bearer('mr-lee'))).status).toBe(200);
    expect(((await call('GET', `/api/spaces/${sch}/school`, bearer('principal'))).body.data as { usage: { teachers: number } }).usage.teachers).toBe(1);

    store.applyEntitlement({ subjectKind: 'space', subjectId: sch, planKey: 'school_seat', status: 'active', provider: 'manual', seats: 2 }, new Date());
    const code = (store.spaces.get(cls) as { joinCode: string }).joinCode;
    expect((await registerAndJoin(cls, code, 'device-a0000001', 'A')).status).toBe(201);
    const b = await registerAndJoin(cls, code, 'device-b0000001', 'B');
    expect(b.status).toBe(201);
    expect((await call('POST', '/api/spaces/lookup', json, { code })).body.data).toMatchObject({ full: true });
    const third = await registerAndJoin(cls, code, 'device-c0000001', 'C');
    expect(third.status).toBe(409);
    expect(third.code).toBe('cap_school');
    // a learner already counted in the school may join a second class
    const cls2 = await createSpace('principal', 'class', 'Second', { parentSpaceId: sch });
    const code2 = (store.spaces.get(cls2) as { joinCode: string }).joinCode;
    expect((await call('POST', `/api/spaces/${cls2}/join`, b.auth, { code: code2, learnerId: b.learnerId })).status).toBe(201);
    expect(((await call('GET', `/api/spaces/${sch}/school`, bearer('principal'))).body.data as { usage: { students: number } }).usage.students).toBe(2);
  });
});
