import { CATALOG, PLAN_MAX_ITEMS, generateCurriculum, toMeta, toPlanItems, type CurriculumMeta, type PlanItem } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { testDb as db } from './helpers/db';

/** F-PLAN-002 section 3.5 (PR P2-4): plan meta, the curriculum item cap and the inbox capability gate. */

type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string; details?: Record<string, unknown> } };
type PlanView = { id: string; title: string; items: PlanItem[]; meta: CurriculumMeta | null; publishedAt: string | null };
type InboxView = { plans: Array<{ id: string; title: string; items: PlanItem[]; meta?: CurriculumMeta | null }> };

const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
async function call(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Envelope };
}
const put = (spaceId: string, user: string, body: unknown) => call('PUT', `/api/spaces/${spaceId}/plans`, bearer(user), body);
const planOf = (r: { body: Envelope }): PlanView => (r.body.data as { plan: PlanView }).plan;

async function createSpace(kind: 'class' | 'family', user = 'teacher') {
  const r = await call('POST', '/api/spaces', bearer(user), { kind, name: kind === 'class' ? 'A' : 'Home' });
  const data = r.body.data as { space: { id: string }; joinCode?: string };
  let code = data.joinCode;
  if (!code) code = ((await call('POST', `/api/spaces/${data.space.id}/code`, bearer(user))).body.data as { joinCode: string }).joinCode;
  return { id: data.space.id, code };
}
async function registerAndJoin(spaceId: string, code: string, deviceId: string, name: string) {
  const reg = await call('POST', '/api/sync/learners', json, { deviceId, learner: { displayName: name, ageGroup: '5-7', avatar: 'hoya-orange' } });
  const data = reg.body.data as { learner: { id: string }; device: { secret: string } };
  const auth = { ...json, authorization: `Device ${deviceId}:${data.device.secret}` };
  expect((await call('POST', `/api/spaces/${spaceId}/join`, auth, { code, learnerId: data.learner.id })).status).toBe(201);
  return { learnerId: data.learner.id, auth };
}

const draft = generateCurriculum(
  {
    audience: 'class',
    level: { stage: 'stage1', band: 0 },
    startDate: '2026-10-18',
    weeks: 26,
    sessionsPerWeek: 3,
    minutesPerSession: 15,
    unlockedStages: ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'],
  },
  CATALOG,
);
const meta = toMeta(draft);
// Today's bundle schedules fewer than 30 items; later weeks are padded the way content growth will fill them.
const routeItems: PlanItem[] = [
  ...toPlanItems(draft),
  ...Array.from({ length: 30 }, (_, i): PlanItem => ({ kind: 'quest', id: `quest:later-${i}`, targetDate: '2027-03-01', week: 20 })),
];
const classic: PlanItem = { kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-09-28' };
const many = (n: number): PlanItem[] => Array.from({ length: n }, (_, i) => ({ kind: 'quest', id: `quest:q${i}`, targetDate: '2026-10-18', week: 1 }));

beforeEach(async () => db.reset());

describe('plan meta (F-PLAN-002 section 3.5)', () => {
  it('stores a generated route: meta and week-bearing items round-trip through PUT and GET', async () => {
    expect(routeItems.length).toBeGreaterThan(PLAN_MAX_ITEMS);
    const cls = await createSpace('class');
    const created = await put(cls.id, 'teacher', { title: 'Term 1', items: routeItems, meta });
    expect(created.status).toBe(201);
    expect(planOf(created).meta).toEqual(meta);
    expect(planOf(created).items).toEqual(routeItems);
    const list = (await call('GET', `/api/spaces/${cls.id}/plans`, bearer('teacher'))).body.data as { plans: PlanView[] };
    expect(list.plans[0]?.meta).toEqual(meta);
    expect(list.plans[0]?.items[0]?.week).toBe(1);
  });

  it('answers a classic plan with meta null', async () => {
    const cls = await createSpace('class');
    expect(planOf(await put(cls.id, 'teacher', { title: 'Week 3', items: [classic] })).meta).toBeNull();
  });

  it('accepts 31 to 260 items only with meta; a classic plan keeps its cap of 30', async () => {
    const cls = await createSpace('class');
    expect((await put(cls.id, 'teacher', { title: 'x', items: many(PLAN_MAX_ITEMS) })).status).toBe(201);
    const over = await put(cls.id, 'teacher', { title: 'x', items: many(PLAN_MAX_ITEMS + 1) });
    expect(over.status).toBe(422);
    expect(over.body.error?.code).toBe('bad_request');
    expect((await put(cls.id, 'teacher', { title: 'x', items: many(PLAN_MAX_ITEMS + 1), meta: null })).status).toBe(422);
    expect((await put(cls.id, 'teacher', { title: 'x', items: many(PLAN_MAX_ITEMS + 1), meta })).status).toBe(201);
    expect((await put(cls.id, 'teacher', { title: 'x', items: many(260), meta })).status).toBe(201);
    expect((await put(cls.id, 'teacher', { title: 'x', items: many(261), meta })).status).toBe(422);
  });

  it('keeps the stored meta when an update omits it (an older console cannot strip a route)', async () => {
    const cls = await createSpace('class');
    const id = planOf(await put(cls.id, 'teacher', { title: 'Term 1', items: routeItems, meta, publish: true })).id;
    const resaved = await put(cls.id, 'teacher', { id, title: 'Term 1b', items: routeItems.slice(1) });
    expect(resaved.status).toBe(200);
    expect(planOf(resaved)).toMatchObject({ title: 'Term 1b', meta });
    expect(planOf(resaved).items).toHaveLength(routeItems.length - 1);
  });

  it('replaces the meta on an update that sends one (a re-pace)', async () => {
    const cls = await createSpace('class');
    const id = planOf(await put(cls.id, 'teacher', { title: 'Term 1', items: routeItems, meta })).id;
    const repaced = { ...meta, repacedAt: '2026-11-02T00:00:00.000Z' };
    expect(planOf(await put(cls.id, 'teacher', { id, title: 'Term 1', items: routeItems, meta: repaced })).meta).toEqual(repaced);
  });

  it('turns a route into a classic plan on meta null, and then applies the classic cap', async () => {
    const cls = await createSpace('class');
    const id = planOf(await put(cls.id, 'teacher', { title: 'Term 1', items: routeItems, meta })).id;
    expect((await put(cls.id, 'teacher', { id, title: 'Term 1', items: routeItems, meta: null })).status).toBe(422);
    const short = await put(cls.id, 'teacher', { id, title: 'Week 1', items: routeItems.slice(0, 3), meta: null });
    expect(short.status).toBe(200);
    expect(planOf(short).meta).toBeNull();
    // A classic plan updated without meta stays classic and keeps the cap of 30.
    expect((await put(cls.id, 'teacher', { id, title: 'Week 1', items: many(PLAN_MAX_ITEMS + 1) })).status).toBe(422);
  });

  it('lets an update without meta keep more than 30 items when the stored plan is a route', async () => {
    const cls = await createSpace('class');
    const id = planOf(await put(cls.id, 'teacher', { title: 'Term 1', items: routeItems, meta })).id;
    expect((await put(cls.id, 'teacher', { id, title: 'Term 1', items: many(PLAN_MAX_ITEMS + 5) })).status).toBe(200);
  });
});

describe('the inbox capability gate (F-PLAN-002 section 3.5)', () => {
  async function setup() {
    const cls = await createSpace('class');
    const suni = await registerAndJoin(cls.id, cls.code, 'device-suni0001', 'Suni');
    const week = planOf(await put(cls.id, 'teacher', { title: 'Week 3', items: [classic], publish: true }));
    const term = planOf(await put(cls.id, 'teacher', { title: 'Term 1', items: routeItems, meta, publish: true }));
    const inbox = async (query = '') =>
      (await call('GET', `/api/sync/learners/${suni.learnerId}/inbox${query}`, suni.auth)).body.data as InboxView;
    return { week, term, inbox };
  }

  it('hides a route from an app that does not ask with ?cap=curriculum; classic plans are unchanged', async () => {
    const { week, inbox } = await setup();
    const old = await inbox();
    expect(old.plans.map((p) => p.id)).toEqual([week.id]);
    expect(old.plans[0]).toMatchObject({ title: 'Week 3', items: [classic], meta: null });
    expect((await inbox('?cap=homework')).plans.map((p) => p.id)).toEqual([week.id]);
  });

  it('delivers the route with its meta and week-bearing items when the app asks', async () => {
    const { week, term, inbox } = await setup();
    const next = await inbox('?cap=curriculum');
    expect(next.plans.map((p) => p.id)).toEqual([week.id, term.id]);
    expect(next.plans[1]?.meta).toEqual(meta);
    expect(next.plans[1]?.items).toEqual(routeItems);
    expect(next.plans[0]?.meta).toBeNull();
    // A list of capabilities, in either form, is read too.
    expect((await inbox('?cap=other,curriculum')).plans).toHaveLength(2);
    expect((await inbox('?cap=other&cap=curriculum')).plans).toHaveLength(2);
  });

  it('still keeps family routes away from a class-scoped device', async () => {
    const fam = await createSpace('family', 'mom');
    const suni = await registerAndJoin(fam.id, fam.code, 'device-suni0002', 'Suni');
    await put(fam.id, 'mom', { title: 'Home route', items: routeItems, meta, publish: true });
    const device = await db.getDevice(suni.learnerId, 'device-suni0002');
    if (device) await db.putDevice({ ...device, scope: 'class' });
    const r = await call('GET', `/api/sync/learners/${suni.learnerId}/inbox?cap=curriculum`, suni.auth);
    expect(r.status).toBe(200);
    expect((r.body.data as InboxView).plans).toEqual([]);
  });
});
