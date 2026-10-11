import { describe, expect, it } from 'vitest';
import {
  CURRICULUM_MAX_ITEMS,
  InboxPlanSchema,
  PLAN_MAX_ITEMS,
  PlanItemSchema,
  PlanSchema,
  PlanUpsertSchema,
  StageKeySchema,
  SyncInboxSchema,
  generateCurriculum,
  isCurriculumPlan,
  toMeta,
  toPlanItems,
  type CurriculumMeta,
  type InboxPlan,
  type Plan,
  type StageKey,
} from '../index';
import { CATALOG_2026_10 } from './fixtures/catalog-2026-10';

/** F-PLAN-002 section 3.5: the additive mapping of a curriculum onto F-PLAN-001 plans (PR P2-4). */

const draft = generateCurriculum(
  {
    audience: 'class',
    level: { stage: 'stage1', band: 0 },
    startDate: '2026-10-18',
    weeks: 12,
    sessionsPerWeek: 2,
    sessionDays: ['sun', 'wed'],
    minutesPerSession: 10,
    goals: { focus: 'balanced', motivation: 'heritage' },
    daysOff: [{ from: '2026-11-22', to: '2026-11-28' }],
    unlockedStages: StageKeySchema.options as StageKey[],
    reviewEvery: 4,
  },
  CATALOG_2026_10,
);
const meta: CurriculumMeta = toMeta(draft);
const items = toPlanItems(draft);
const item = { kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-10-18' };
const many = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'quest' as const, id: `quest:q${i}` }));
const base = { id: 'plan:abc', spaceId: 'space:c', authorAccountId: 'teacher', title: 'Term 1', targetLearnerIds: null, publishedAt: null, archivedAt: null, createdAt: 't', updatedAt: 't' };
const inboxRow = { id: 'plan:abc', spaceId: 'space:c', spaceKind: 'class', spaceName: 'A', title: 'Term 1', items: [item], publishedAt: 't', updatedAt: 't' };

describe('PlanItem.week (section 3.5)', () => {
  it('is optional, an integer from 1 to 52', () => {
    expect(PlanItemSchema.parse(item)).not.toHaveProperty('week');
    expect(PlanItemSchema.parse({ ...item, week: 1 }).week).toBe(1);
    expect(PlanItemSchema.parse({ ...item, week: 52 }).week).toBe(52);
    for (const week of [0, 53, 1.5, '3']) expect(PlanItemSchema.safeParse({ ...item, week }).success).toBe(false);
  });

  it('keeps kind to quest and episode (stories are shelf quests; a review kind comes later)', () => {
    expect(PlanItemSchema.safeParse({ ...item, kind: 'review' }).success).toBe(false);
  });

  it('accepts every item the generator emits', () => {
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) expect(PlanItemSchema.parse(it)).toEqual(it);
  });
});

describe('PlanSchema.meta and the item cap (section 3.5)', () => {
  it('defaults meta to null, so every stored plan parses as a classic plan', () => {
    const parsed = PlanSchema.parse({ ...base, items: [item] });
    expect(parsed.meta).toBeNull();
    expect(isCurriculumPlan(parsed)).toBe(false);
  });

  it('round-trips a generated curriculum meta', () => {
    const parsed = PlanSchema.parse({ ...base, items, meta });
    expect(parsed.meta).toEqual(meta);
    expect(isCurriculumPlan(parsed)).toBe(true);
  });

  it('keeps 30 items as the cap of a classic plan, exactly as before', () => {
    expect(PlanSchema.safeParse({ ...base, items: many(PLAN_MAX_ITEMS) }).success).toBe(true);
    const over = PlanSchema.safeParse({ ...base, items: many(PLAN_MAX_ITEMS + 1) });
    expect(over.success).toBe(false);
    expect(over.success ? [] : over.error.issues.map((i) => i.path.join('.'))).toEqual(['items']);
    expect(PlanSchema.safeParse({ ...base, items: many(PLAN_MAX_ITEMS + 1), meta: null }).success).toBe(false);
  });

  it('allows 31 to 260 items only with meta', () => {
    expect(PlanSchema.safeParse({ ...base, items: many(PLAN_MAX_ITEMS + 1), meta }).success).toBe(true);
    expect(PlanSchema.safeParse({ ...base, items: many(CURRICULUM_MAX_ITEMS), meta }).success).toBe(true);
    expect(PlanSchema.safeParse({ ...base, items: many(CURRICULUM_MAX_ITEMS + 1), meta }).success).toBe(false);
    expect(PlanSchema.safeParse({ ...base, items: [], meta }).success).toBe(false);
  });

  it('rejects a meta that is not a curriculum', () => {
    expect(PlanSchema.safeParse({ ...base, items: [item], meta: { ...meta, kind: 'template' } }).success).toBe(false);
    expect(PlanSchema.safeParse({ ...base, items: [item], meta: { ...meta, horizonDays: 29 } }).success).toBe(false);
  });

  it('never stores the learner completions in meta', () => {
    expect(PlanSchema.parse({ ...base, items, meta: { ...meta, params: { ...meta.params, completedQuestIds: ['quest:x'] } } }).meta?.params).not.toHaveProperty(
      'completedQuestIds',
    );
  });
});

describe('PlanUpsertSchema.meta (section 3.5)', () => {
  it('leaves meta absent when the body omits it (an update then keeps the stored meta)', () => {
    const parsed = PlanUpsertSchema.parse({ title: 'Week 3', items: [item] });
    expect(parsed).not.toHaveProperty('meta');
  });

  it('carries an explicit null (turn the plan into a classic one) and a curriculum meta', () => {
    expect(PlanUpsertSchema.parse({ title: 'Week 3', items: [item], meta: null }).meta).toBeNull();
    expect(PlanUpsertSchema.parse({ title: 'Term 1', items, meta, publish: false }).meta).toEqual(meta);
  });

  it('applies the classic cap when meta is null and the curriculum cap otherwise', () => {
    expect(PlanUpsertSchema.safeParse({ title: 'x', items: many(PLAN_MAX_ITEMS + 1), meta: null }).success).toBe(false);
    expect(PlanUpsertSchema.safeParse({ title: 'x', items: many(PLAN_MAX_ITEMS + 1), meta }).success).toBe(true);
    expect(PlanUpsertSchema.safeParse({ title: 'x', items: many(CURRICULUM_MAX_ITEMS + 1), meta }).success).toBe(false);
  });

  it('lets an absent meta through up to the curriculum cap: the route checks it against the stored plan', () => {
    expect(PlanUpsertSchema.safeParse({ title: 'x', items: many(PLAN_MAX_ITEMS + 1) }).success).toBe(true);
    expect(PlanUpsertSchema.safeParse({ title: 'x', items: many(CURRICULUM_MAX_ITEMS + 1) }).success).toBe(false);
  });
});

describe('InboxPlanSchema.meta (section 3.5)', () => {
  it('parses an inbox row from a Worker that predates meta as a classic plan', () => {
    expect(InboxPlanSchema.parse(inboxRow).meta).toBeNull();
  });

  it('carries meta and week-bearing items to the device', () => {
    const parsed = InboxPlanSchema.parse({ ...inboxRow, items, meta });
    expect(parsed.meta).toEqual(meta);
    expect(parsed.items[0]).toEqual({ kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-10-18', week: 1 });
    expect(SyncInboxSchema.parse({ rev: 1, plans: [{ ...inboxRow, meta }], memberships: [], tier: 'free', serverTime: 't' }).plans[0]?.meta).toEqual(meta);
  });

  it('is optional in the type, because devices read their stored inbox copy unparsed', () => {
    const stored: InboxPlan = { id: 'plan:abc', spaceId: 'space:c', spaceKind: 'class', spaceName: 'A', title: 'Week 3', items: [item as InboxPlan['items'][number]], publishedAt: 't', updatedAt: 't' };
    expect(isCurriculumPlan(stored)).toBe(false);
    expect(isCurriculumPlan({ ...stored, meta })).toBe(true);
  });

  it('keeps a 52-week meta near 10 KB', () => {
    const long = toMeta(generateCurriculum({ ...draft.params, weeks: 52, sessionDays: undefined, sessionsPerWeek: 5 }, CATALOG_2026_10));
    expect(long.weeks).toHaveLength(52);
    expect(JSON.stringify(long).length).toBeLessThan(16_000);
  });
});

describe('the Plan type of the Worker (section 3.5)', () => {
  it('requires meta on a plan the Worker builds', () => {
    const plan: Plan = { ...base, items: [{ kind: 'quest', id: 'quest:a' }], meta: null };
    expect(PlanSchema.parse(plan)).toEqual(plan);
  });
});
