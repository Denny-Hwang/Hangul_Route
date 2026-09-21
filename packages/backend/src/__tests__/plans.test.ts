import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { store } from '../store';

type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string; details?: Record<string, unknown> } };
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
async function call(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Envelope };
}
type PlanView = { id: string; publishedAt: string | null; archivedAt: string | null; updatedAt: string; title: string; targetLearnerIds: string[] | null };

async function createClass(user = 'teacher') {
  const r = await call('POST', '/api/spaces', bearer(user), { kind: 'class', name: 'A' });
  const data = r.body.data as { space: { id: string }; joinCode: string };
  return { id: data.space.id, code: data.joinCode };
}
async function registerAndJoin(spaceId: string, code: string, deviceId: string, name: string) {
  const reg = await call('POST', '/api/sync/learners', json, { deviceId, learner: { displayName: name, ageGroup: '5-7', avatar: 'hoya-orange' } });
  const data = reg.body.data as { learner: { id: string }; device: { secret: string } };
  const auth = { ...json, authorization: `Device ${deviceId}:${data.device.secret}` };
  expect((await call('POST', `/api/spaces/${spaceId}/join`, auth, { code, learnerId: data.learner.id })).status).toBe(201);
  return { learnerId: data.learner.id, auth };
}
const item = { kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-09-28' };
const put = (spaceId: string, user: string, body: unknown) => call('PUT', `/api/spaces/${spaceId}/plans`, bearer(user), body);

beforeEach(() => store.reset());

describe('plans (F-PLAN-001 §3.2)', () => {
  it('creates a draft, publishes it, keeps it published on later saves, archives', async () => {
    const cls = await createClass();
    const draft = await put(cls.id, 'teacher', { title: 'Week 3', items: [item] });
    expect(draft.status).toBe(201);
    const plan = (draft.body.data as { plan: PlanView }).plan;
    expect(plan).toMatchObject({ publishedAt: null, archivedAt: null, targetLearnerIds: null, title: 'Week 3' });

    const published = await put(cls.id, 'teacher', { id: plan.id, title: 'Week 3', items: [item, { kind: 'episode', id: 'episode:stage1-life' }], publish: true });
    expect(published.status).toBe(200);
    const p2 = (published.body.data as { plan: PlanView }).plan;
    expect(p2.publishedAt).not.toBeNull();

    const resaved = await put(cls.id, 'teacher', { id: plan.id, title: 'Week 3b', items: [item] });
    const p3 = (resaved.body.data as { plan: PlanView }).plan;
    expect(p3.publishedAt).toBe(p2.publishedAt);
    expect(p3.title).toBe('Week 3b');

    const archived = await call('POST', `/api/spaces/${cls.id}/plans/${plan.id}/archive`, bearer('teacher'));
    expect((archived.body.data as { plan: PlanView }).plan.archivedAt).not.toBeNull();
    const list = (await call('GET', `/api/spaces/${cls.id}/plans`, bearer('teacher'))).body.data as { plans: PlanView[] };
    expect(list.plans).toHaveLength(1);
    expect(list.plans[0]?.archivedAt).not.toBeNull();
  });

  it('validates bodies, targets, ownership and existence', async () => {
    const cls = await createClass();
    const suni = await registerAndJoin(cls.id, cls.code, 'device-suni0001', 'Suni');
    expect((await put(cls.id, 'teacher', { title: '', items: [item] })).status).toBe(422);
    expect((await put(cls.id, 'teacher', { title: 'x', items: [] })).status).toBe(422);
    const unknown = await put(cls.id, 'teacher', { title: 'x', items: [item], targetLearnerIds: [suni.learnerId, 'profile:nobody'] });
    expect(unknown.status).toBe(422);
    expect(unknown.body.error?.code).toBe('unknown_learner');
    expect((await put(cls.id, 'teacher', { title: 'x', items: [item], targetLearnerIds: [suni.learnerId] })).status).toBe(201);
    expect((await put(cls.id, 'stranger', { title: 'x', items: [item] })).status).toBe(403);
    expect((await put('space:nope', 'teacher', { title: 'x', items: [item] })).status).toBe(404);
    expect((await put(cls.id, 'teacher', { id: 'plan:nope', title: 'x', items: [item] })).status).toBe(404);
    const other = await createClass('t2');
    const mine = (await put(cls.id, 'teacher', { title: 'x', items: [item] })).body.data as { plan: PlanView };
    expect((await put(other.id, 't2', { id: mine.plan.id, title: 'steal', items: [item] })).status).toBe(404);
    expect((await call('POST', `/api/spaces/${cls.id}/plans/plan:nope/archive`, bearer('teacher'))).status).toBe(404);
    expect((await call('GET', `/api/spaces/${cls.id}/plans`, bearer('stranger'))).status).toBe(403);
    expect((await call('GET', `/api/spaces/${cls.id}/plans`, json)).status).toBe(401);
  });

  it('delivers only published, live, targeted plans through the inbox, oldest first', async () => {
    const cls = await createClass();
    const suni = await registerAndJoin(cls.id, cls.code, 'device-suni0001', 'Suni');
    const minho = await registerAndJoin(cls.id, cls.code, 'device-minho001', 'Minho');
    await put(cls.id, 'teacher', { title: 'Draft', items: [item] });
    const everyone = (await put(cls.id, 'teacher', { title: 'Everyone', items: [item], publish: true })).body.data as { plan: PlanView };
    const onlyMinho = (await put(cls.id, 'teacher', { title: 'Only Minho', items: [item], targetLearnerIds: [minho.learnerId], publish: true })).body.data as { plan: PlanView };
    const gone = (await put(cls.id, 'teacher', { title: 'Archived', items: [item], publish: true })).body.data as { plan: PlanView };
    await call('POST', `/api/spaces/${cls.id}/plans/${gone.plan.id}/archive`, bearer('teacher'));

    const suniInbox = (await call('GET', `/api/sync/learners/${suni.learnerId}/inbox`, suni.auth)).body.data as { plans: Array<{ id: string; spaceKind: string; spaceName: string; title: string }> };
    expect(suniInbox.plans.map((p) => p.title)).toEqual(['Everyone']);
    expect(suniInbox.plans[0]).toMatchObject({ id: everyone.plan.id, spaceKind: 'class', spaceName: 'A' });
    const minhoInbox = (await call('GET', `/api/sync/learners/${minho.learnerId}/inbox`, minho.auth)).body.data as { plans: Array<{ id: string }> };
    expect(minhoInbox.plans.map((p) => p.id)).toEqual([everyone.plan.id, onlyMinho.plan.id]);

    const space = store.spaces.get(cls.id);
    if (space) space.archivedAt = '2026-09-21T00:00:00.000Z';
    expect(((await call('GET', `/api/sync/learners/${minho.learnerId}/inbox`, minho.auth)).body.data as { plans: unknown[] }).plans).toEqual([]);
  });
});
