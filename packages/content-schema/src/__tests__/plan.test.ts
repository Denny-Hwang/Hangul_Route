import { describe, expect, it } from 'vitest';
import { InboxPlanSchema, PLAN_MAX_ITEMS, PlanSchema, PlanUpsertSchema, ProgressSummarySchema, SyncInboxSchema } from '../index';

const item = { kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-09-28' };

describe('plan schemas (F-PLAN-001 §3.1)', () => {
  it('validates items, plans and upserts', () => {
    const plan = { id: 'plan:abc', spaceId: 'space:c', authorAccountId: 'teacher', title: 'Week 3', items: [item], targetLearnerIds: null, publishedAt: null, archivedAt: null, createdAt: 't', updatedAt: 't' };
    expect(PlanSchema.parse(plan).items[0]?.kind).toBe('quest');
    expect(PlanSchema.safeParse({ ...plan, items: [] }).success).toBe(false);
    expect(PlanSchema.safeParse({ ...plan, items: Array.from({ length: PLAN_MAX_ITEMS + 1 }, () => item) }).success).toBe(false);
    expect(PlanSchema.safeParse({ ...plan, items: [{ ...item, targetDate: 'tomorrow' }] }).success).toBe(false);
    expect(PlanSchema.safeParse({ ...plan, items: [{ kind: 'story', id: 'x' }] }).success).toBe(false);
    const upsert = PlanUpsertSchema.parse({ title: '  Week 3 ', items: [{ kind: 'episode', id: 'episode:stage1-letters', note: ' bring crayons ' }] });
    expect(upsert).toEqual({ title: 'Week 3', items: [{ kind: 'episode', id: 'episode:stage1-letters', note: 'bring crayons' }], publish: false });
    expect(PlanUpsertSchema.safeParse({ title: '', items: [item] }).success).toBe(false);
    expect(PlanUpsertSchema.parse({ title: 'x', items: [item], targetLearnerIds: ['profile:a'], publish: true }).targetLearnerIds).toEqual(['profile:a']);
  });

  it('types inbox plans and defaults notReady in plan progress', () => {
    const row = { id: 'plan:abc', spaceId: 'space:c', spaceKind: 'class', spaceName: 'A', title: 'Week 3', items: [item], publishedAt: 't', updatedAt: 't' };
    expect(InboxPlanSchema.parse(row).spaceKind).toBe('class');
    expect(SyncInboxSchema.parse({ rev: 1, plans: [row], memberships: [], tier: 'free', serverTime: 't' }).plans).toHaveLength(1);
    expect(SyncInboxSchema.safeParse({ rev: 1, plans: [{ id: 'x' }], memberships: [], tier: 'free', serverTime: 't' }).success).toBe(false);
    const summary = ProgressSummarySchema.parse({
      schemaVersion: 1, lastActiveAt: 't', streakDays: 0, stage1: { questsDone: 0, questsTotal: 11, anchorAccuracy: null }, cardsUnlocked: 0, minutesLast7d: 0, jamoRecognized: [], needsPractice: [],
      planProgress: { 'plan:abc': { done: 1, total: 3 } },
    });
    expect(summary.planProgress['plan:abc']).toEqual({ done: 1, total: 3, notReady: 0 });
  });
});
