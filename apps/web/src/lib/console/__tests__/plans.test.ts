import { describe, expect, it } from 'vitest';
import type { RosterLearner } from '../api';
import { addDays, currentPlan, latestPublished, moveItem, oneExplicitPerDay, planReadout, planStatusLabel, readoutLine, spreadDates } from '../plans';

describe('plan helpers (F-PLAN-001 §3.5)', () => {
  it('spreads dates evenly and never twice on one day', () => {
    expect(spreadDates('2026-09-21', 2, 4)).toEqual(['2026-09-21', '2026-09-25', '2026-09-28', '2026-10-02']);
    expect(spreadDates('2026-09-21', 7, 3)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23']);
    expect(spreadDates('2026-09-21', 99, 3)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23']); // clamps to daily
    expect(spreadDates('2026-09-21', 0, 2)).toEqual(['2026-09-21', '2026-09-28']); // clamps to weekly
    expect(spreadDates('2026-12-30', 1, 2)).toEqual(['2026-12-30', '2027-01-06']);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('slides colliding items to the next free day in list order', () => {
    const { items, moved } = oneExplicitPerDay([
      { kind: 'quest', id: 'a', targetDate: '2026-09-21' },
      { kind: 'quest', id: 'b', targetDate: '2026-09-21' },
      { kind: 'quest', id: 'c' },
      { kind: 'quest', id: 'd', targetDate: '2026-09-22' },
    ]);
    expect(items.map((i) => i.targetDate)).toEqual(['2026-09-21', '2026-09-22', undefined, '2026-09-23']);
    expect(moved).toBe(2);
    expect(oneExplicitPerDay([{ kind: 'quest', id: 'a', targetDate: '2026-09-21' }]).moved).toBe(0);
  });

  it('picks the latest published and the current plan, and labels status', () => {
    const plans = [
      { id: 'p1', title: 'old', publishedAt: '2026-09-01T00:00:00.000Z', archivedAt: null, updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'p2', title: 'new', publishedAt: '2026-09-20T00:00:00.000Z', archivedAt: null, updatedAt: '2026-09-20T00:00:00.000Z' },
      { id: 'p3', title: 'draft', publishedAt: null, archivedAt: null, updatedAt: '2026-09-21T00:00:00.000Z' },
      { id: 'p4', title: 'gone', publishedAt: '2026-09-25T00:00:00.000Z', archivedAt: '2026-09-26T00:00:00.000Z', updatedAt: '2026-09-26T00:00:00.000Z' },
    ];
    expect(latestPublished(plans)?.id).toBe('p2');
    expect(currentPlan(plans)?.id).toBe('p3');
    expect(latestPublished([])).toBeNull();
    expect(currentPlan([plans[3] as (typeof plans)[number]])).toBeNull();
    expect(planStatusLabel(plans[1] as (typeof plans)[number])).toBe('Published Sep 20');
    expect(planStatusLabel(plans[2] as (typeof plans)[number])).toBe('Draft');
    expect(planStatusLabel(plans[3] as (typeof plans)[number])).toBe('Archived');
  });

  it('reads out per-learner progress in roster order without ranking', () => {
    const learner = (id: string, progress: { done: number; total: number; notReady: number } | null): RosterLearner => ({
      id,
      displayName: id,
      ageGroup: '5-7',
      avatar: 'hoya-orange',
      joinedAt: 't',
      lastActiveAt: 't',
      lastSyncedAt: null,
      summary: progress
        ? { schemaVersion: 1, lastActiveAt: 't', streakDays: 0, stage1: { questsDone: 0, questsTotal: 11, anchorAccuracy: null }, cardsUnlocked: 0, minutesLast7d: 0, jamoRecognized: [], needsPractice: [], planProgress: { 'plan:w3': progress } }
        : null,
    });
    const rows = planReadout('plan:w3', [learner('minho', { done: 2, total: 3, notReady: 0 }), learner('suji', { done: 0, total: 2, notReady: 1 }), learner('new', null)]);
    expect(rows.map((r) => r.name)).toEqual(['minho', 'suji', 'new']);
    expect(readoutLine(rows[0] as ReadoutRowT)).toBe('2 / 3');
    expect(readoutLine(rows[1] as ReadoutRowT)).toBe('0 / 2 · 1 not ready yet');
    expect(readoutLine(rows[2] as ReadoutRowT)).toBe('waiting for the next sync');
  });

  it('moves items within bounds only', () => {
    const items = [{ kind: 'quest' as const, id: 'a' }, { kind: 'quest' as const, id: 'b' }, { kind: 'quest' as const, id: 'c' }];
    expect(moveItem(items, 0, 2).map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(moveItem(items, 2, 0).map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(moveItem(items, 1, 1).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(moveItem(items, -1, 0).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(moveItem(items, 0, 5).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});

type ReadoutRowT = ReturnType<typeof planReadout>[number];
