import {
  CATALOG,
  CURRICULUM_MAX_ITEMS,
  CurriculumMetaSchema,
  InboxPlanSchema,
  PlanItemShapeSchema,
  StoredCurriculumParamsSchema,
  addDays,
  generateCurriculum,
  isDateKey,
  toMeta,
  toPlanItems,
  type CurriculumMeta,
  type PlanItem,
} from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { rosterSummary } from '../lib/roster-summary';
import { testDb as db } from './helpers/db';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND section 9.3 (row BL-W, Worker first): a blended class plan (class days with practice
 * days) round-trips the Worker with every new key; an app built before BL-W parses it and keeps every item
 * (assumption b); `snapshot.practiceDays` keeps the preserve rule; `summary.practiceWeek` reaches a family only.
 */

type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string } };
type PlanView = { id: string; items: PlanItem[]; meta: CurriculumMeta | null };
type InboxView = { plans: Array<Record<string, unknown> & { id: string; items: PlanItem[]; meta?: CurriculumMeta | null }> };

const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
async function call(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Envelope };
}

async function createSpace(kind: 'class' | 'family', user: string) {
  const r = await call('POST', '/api/spaces', bearer(user), { kind, name: kind === 'class' ? 'A' : 'Home' });
  const data = r.body.data as { space: { id: string }; joinCode?: string | null };
  let code = data.joinCode ?? undefined;
  if (!code) code = ((await call('POST', `/api/spaces/${data.space.id}/code`, bearer(user))).body.data as { joinCode: string }).joinCode;
  return { id: data.space.id, code };
}
async function register(deviceId: string) {
  const reg = await call('POST', '/api/sync/learners', json, { deviceId, learner: { displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange' } });
  const data = reg.body.data as { learner: { id: string }; device: { secret: string } };
  return { learnerId: data.learner.id, auth: { ...json, authorization: `Device ${deviceId}:${data.device.secret}` } };
}
async function join(spaceId: string, code: string, learner: { learnerId: string; auth: Record<string, string> }) {
  expect((await call('POST', `/api/spaces/${spaceId}/join`, learner.auth, { code, learnerId: learner.learnerId })).status).toBe(201);
}

// A class on Tuesday (30 min) with practice 3 times a week (10 min): the owner example, 4 distinct days a week.
const draft = generateCurriculum(
  {
    audience: 'class',
    level: { stage: 'stage1', band: 0 },
    startDate: '2026-10-13',
    weeks: 26,
    sessionsPerWeek: 4,
    sessionDays: ['tue', 'wed', 'fri', 'sun'],
    minutesPerSession: 10,
    unlockedStages: ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'],
  },
  CATALOG,
);
const plain = toMeta(draft);
const meta: CurriculumMeta = {
  ...plain,
  generatorVersion: 2,
  params: {
    ...plain.params,
    blend: {
      mode: 'overlap',
      lecture: { days: ['tue'], minutes: 30 },
      personal: { perWeek: 3, days: ['wed', 'fri', 'sun'], minutes: 10 },
      classDaysOff: ['2026-12-29'],
      keepAverage: false,
    },
  },
  refresh: [
    { date: '2026-10-16', cellIds: ['cell:stage1-letters-a'] },
    { date: '2026-10-18', cellIds: ['cell:stage1-letters-a', 'cell:stage1-letters-b'] },
  ],
};
// Every dated item was taught on the class day before it (the generator of BL-2 writes these; here they are set by hand).
const items: PlanItem[] = toPlanItems(draft).map((item) => (item.targetDate ? { ...item, lectureDate: addDays(item.targetDate, -1) } : item));

/**
 * The cross-field check of an app built before BL-W, frozen from `curriculum/params.ts` at cf7a4e483 (the last main
 * commit before BL-W). It counts `sessionDays` (or `sessionsPerWeek`) only and knows nothing of `blend`.
 */
const preBlendRefineParams = (
  params: { startDate: string; weeks: number; sessionsPerWeek: number; sessionDays?: readonly string[] | undefined; daysOff: ReadonlyArray<{ from: string; to: string }> },
  ctx: { addIssue: (issue: { code: 'custom'; path: Array<string | number>; params: { code: string } }) => void },
): void => {
  const fail = (code: string, path: Array<string | number>): void => ctx.addIssue({ code: 'custom', path, params: { code } });
  const days = params.sessionDays ?? [];
  days.forEach((day, index) => {
    if (days.indexOf(day) !== index) fail('session-day-repeated', ['sessionDays', index]);
  });
  const perWeek = params.sessionDays === undefined ? params.sessionsPerWeek : params.sessionDays.length;
  if (params.weeks * perWeek > CURRICULUM_MAX_ITEMS) fail('too-many-sessions', ['weeks']);
  params.daysOff.forEach((range, index) => {
    if (!isDateKey(range.from)) fail('not-a-real-day', ['daysOff', index, 'from']);
    if (!isDateKey(range.to)) fail('not-a-real-day', ['daysOff', index, 'to']);
    if (range.from > range.to) fail('days-off-reversed', ['daysOff', index, 'to']);
  });
  if (!isDateKey(params.startDate)) fail('not-a-real-day', ['startDate']);
};

/** The parser of an app built before BL-W: the same shapes without `lectureDate`, `meta.refresh` and `params.blend`. */
const OldParamsSchema = StoredCurriculumParamsSchema.innerType().omit({ blend: true }).superRefine(preBlendRefineParams);
const OldMetaSchema = CurriculumMetaSchema.omit({ refresh: true }).extend({ params: OldParamsSchema });
const OldInboxPlanSchema = InboxPlanSchema.extend({
  items: PlanItemShapeSchema.omit({ lectureDate: true }).array(),
  meta: OldMetaSchema.nullable().default(null),
});

beforeEach(async () => db.reset());

describe('a blended plan through the Worker (section 9.3)', () => {
  it('has the shapes this test relies on', () => {
    expect(items.length).toBeGreaterThan(0);
    expect(items.filter((i) => i.lectureDate !== undefined).length).toBe(items.filter((i) => i.targetDate !== undefined).length);
    expect(CurriculumMetaSchema.parse(meta)).toEqual(meta);
  });

  it('round-trips PUT and GET with lectureDate, meta.refresh and params.blend', async () => {
    const cls = await createSpace('class', 'teacher');
    const created = await call('PUT', `/api/spaces/${cls.id}/plans`, bearer('teacher'), { title: 'Term 1', items, meta, publish: true });
    expect(created.status).toBe(201);
    const plan = (created.body.data as { plan: PlanView }).plan;
    expect(plan.items).toEqual(items);
    expect(plan.meta).toEqual(meta);
    const list = (await call('GET', `/api/spaces/${cls.id}/plans`, bearer('teacher'))).body.data as { plans: PlanView[] };
    expect(list.plans[0]?.items).toEqual(items);
    expect(list.plans[0]?.meta).toEqual(meta);
  });

  it('refuses an item taught on or after its practice date, and blend on a family plan', async () => {
    const cls = await createSpace('class', 'teacher');
    const bad = items.map((item, i) => (i === 0 && item.targetDate ? { ...item, lectureDate: item.targetDate } : item));
    expect((await call('PUT', `/api/spaces/${cls.id}/plans`, bearer('teacher'), { title: 'Term 1', items: bad, meta })).status).toBe(422);
    const fam = await createSpace('family', 'mom');
    const familyMeta = { ...meta, params: { ...meta.params, audience: 'family' } };
    expect((await call('PUT', `/api/spaces/${fam.id}/plans`, bearer('mom'), { title: 'Home', items, meta: familyMeta })).status).toBe(422);
  });

  it('sends it unchanged under ?cap=curriculum, and not without it (no new capability)', async () => {
    const cls = await createSpace('class', 'teacher');
    const suni = await register('device-suni0001');
    await join(cls.id, cls.code, suni);
    await call('PUT', `/api/spaces/${cls.id}/plans`, bearer('teacher'), { title: 'Term 1', items, meta, publish: true });
    const inbox = async (query: string) => (await call('GET', `/api/sync/learners/${suni.learnerId}/inbox${query}`, suni.auth)).body.data as InboxView;
    const next = await inbox('?cap=curriculum');
    expect(next.plans).toHaveLength(1);
    expect(next.plans[0]?.items).toEqual(items);
    expect(next.plans[0]?.meta).toEqual(meta);
    expect((await inbox('')).plans).toEqual([]);
  });

  it('an app built before BL-W parses it and keeps every item on its date, with the weekly count it knows (assumption b)', async () => {
    const cls = await createSpace('class', 'teacher');
    const suni = await register('device-suni0002');
    await join(cls.id, cls.code, suni);
    await call('PUT', `/api/spaces/${cls.id}/plans`, bearer('teacher'), { title: 'Term 1', items, meta, publish: true });
    const sent = ((await call('GET', `/api/sync/learners/${suni.learnerId}/inbox?cap=curriculum`, suni.auth)).body.data as InboxView).plans[0];
    const old = OldInboxPlanSchema.parse(sent);
    expect(old.items).toHaveLength(items.length);
    expect(old.items).toEqual(items.map(({ lectureDate: _taught, ...rest }) => rest));
    expect(old.items.some((i) => 'lectureDate' in i)).toBe(false);
    expect(old.meta).not.toBeNull();
    expect(old.meta && 'refresh' in old.meta).toBe(false);
    expect(old.meta && 'blend' in old.meta.params).toBe(false);
    expect(old.meta?.params.sessionsPerWeek).toBe(4);
    expect(old.meta?.params.sessionDays).toEqual(['tue', 'wed', 'fri', 'sun']);
  });
});

describe('snapshot.practiceDays (section 9.4): preserve and merge', () => {
  const base = { schemaVer: 1, contentVer: '2026.11' };
  const summary = {
    schemaVersion: 1,
    lastActiveAt: '2026-11-01T00:00:00.000Z',
    streakDays: 0,
    stage1: { questsDone: 0, questsTotal: 11, anchorAccuracy: null },
    cardsUnlocked: 0,
    minutesLast7d: 0,
    jamoRecognized: [],
    needsPractice: [],
    planProgress: {},
  };
  const snapshotFor = (profileId: string, extra: Record<string, unknown> = {}) => ({
    profileId,
    updatedAt: '2026-11-01T00:00:00.000Z',
    episodes: [],
    quests: [],
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
    ...extra,
  });
  const entry = (planId: string, days: string[], updatedAt: string) => ({ planId, days, updatedAt });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-03T12:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  async function put(learner: { learnerId: string; auth: Record<string, string> }, baseRev: number, extra: Record<string, unknown>, sum: Record<string, unknown> = summary) {
    const res = await call('PUT', `/api/sync/learners/${learner.learnerId}/snapshot`, learner.auth, { ...base, baseRev, snapshot: snapshotFor(learner.learnerId, extra), summary: sum });
    expect(res.status).toBe(200);
  }
  async function stored(learner: { learnerId: string; auth: Record<string, string> }) {
    return ((await call('GET', `/api/sync/learners/${learner.learnerId}/snapshot`, learner.auth)).body.data as { snapshot: Record<string, unknown>; summary: Record<string, unknown> });
  }

  it('stores the entries, keeps them when an older build leaves the key out, and merges by plan with the newest updatedAt', async () => {
    const suni = await register('device-suni0003');
    const first = [entry('plan:a', ['wed', 'fri', 'sun'], '2026-11-01T09:00:00.000Z')];
    await put(suni, 0, { practiceDays: first });
    expect((await stored(suni)).snapshot.practiceDays).toEqual(first);

    // An older build: no key, so the stored entries stay.
    await put(suni, 1, {});
    expect((await stored(suni)).snapshot.practiceDays).toEqual(first);

    // A device that synced before the change sends an older entry for plan:a and a new plan: the newer plan:a stays.
    await put(suni, 2, { practiceDays: [entry('plan:a', ['mon'], '2026-10-30T09:00:00.000Z'), entry('plan:b', ['tue', 'thu'], '2026-11-02T09:00:00.000Z')] });
    expect((await stored(suni)).snapshot.practiceDays).toEqual([first[0], entry('plan:b', ['tue', 'thu'], '2026-11-02T09:00:00.000Z')]);

    // A newer change wins.
    const newer = entry('plan:a', ['sat'], '2026-11-03T09:00:00.000Z');
    await put(suni, 3, { practiceDays: [newer] });
    expect((await stored(suni)).snapshot.practiceDays).toEqual([newer, entry('plan:b', ['tue', 'thu'], '2026-11-02T09:00:00.000Z')]);
  });

  it('drops a malformed entry on its own and never fails the sync', async () => {
    const suni = await register('device-suni0004');
    const good = entry('plan:a', ['wed'], '2026-11-01T09:00:00.000Z');
    await put(suni, 0, { practiceDays: [good, entry('plan:b', [], '2026-11-01T09:00:00.000Z'), entry('plan:c', ['mon', 'mon'], '2026-11-01T09:00:00.000Z'), { planId: 'plan:d' }] });
    expect((await stored(suni)).snapshot.practiceDays).toEqual([good]);
  });

  describe('summary.practiceWeek (section 11): a family reads it, a class never does', () => {
    it('reaches the family roster and report, and is removed from the class roster', async () => {
      const cls = await createSpace('class', 'teacher');
      const fam = await createSpace('family', 'mom');
      const suni = await register('device-suni0005');
      await join(cls.id, cls.code, suni);
      await join(fam.id, fam.code, suni);
      await put(suni, 0, {}, { ...summary, practiceWeek: { practicedDays: 3 } });
      type Roster = { learners: Array<{ summary: Record<string, unknown> | null }> };
      const famRoster = (await call('GET', `/api/spaces/${fam.id}/roster`, bearer('mom'))).body.data as Roster;
      expect(famRoster.learners[0]?.summary?.practiceWeek).toEqual({ practicedDays: 3 });
      const clsRoster = (await call('GET', `/api/spaces/${cls.id}/roster`, bearer('teacher'))).body.data as Roster;
      expect(clsRoster.learners[0]?.summary).not.toBeNull();
      expect(clsRoster.learners[0]?.summary).not.toHaveProperty('practiceWeek');
      const famReport = (await call('GET', `/api/spaces/${fam.id}/learners/${suni.learnerId}/report`, bearer('mom'))).body.data as { summary: Record<string, unknown> };
      expect(famReport.summary.practiceWeek).toEqual({ practicedDays: 3 });
      const clsReport = (await call('GET', `/api/spaces/${cls.id}/learners/${suni.learnerId}/report`, bearer('teacher'))).body.data as { summary: Record<string, unknown> };
      expect(clsReport.summary).not.toHaveProperty('practiceWeek');
    });

    it('stays out of a class or school roster at full scope too, and drops a malformed count', () => {
      const stored = { ...summary, practiceWeek: { practicedDays: 4 } };
      for (const kind of ['class', 'school'] as const) {
        for (const scope of ['base', 'full'] as const) expect(rosterSummary(stored, new Set(), kind, { scope, memory: true })).not.toHaveProperty('practiceWeek');
      }
      expect(rosterSummary(stored, new Set(), 'family')?.practiceWeek).toEqual({ practicedDays: 4 });
      expect(rosterSummary({ ...summary, practiceWeek: { practicedDays: 8 } }, new Set(), 'family')).not.toHaveProperty('practiceWeek');
      expect(rosterSummary({ ...summary, practiceWeek: { practicedDays: 2, days: ['mon', 'wed'] } }, new Set(), 'family')?.practiceWeek).toEqual({ practicedDays: 2 });
    });
  });
});
