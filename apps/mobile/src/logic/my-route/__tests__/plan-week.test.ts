import { describe, expect, it } from 'vitest';
import type { CurriculumMeta, GoalSource, RouteGoal } from '@hangul-route/content-schema';
import { planWeekOf } from '../plan-week';

/** The weekly plan line's week (amendment section 4.3, LR-5a): the goal's own plan, the week holding today. */
const meta = (starts: string[]): CurriculumMeta => ({
  kind: 'curriculum',
  generatorVersion: 1,
  catalogVersion: 4,
  params: {
    audience: 'class',
    level: { stage: 'stage1', band: 0 },
    startDate: starts[0] ?? '2026-10-05',
    weeks: starts.length,
    sessionsPerWeek: 2,
    minutesPerSession: 10,
    daysOff: [],
    goals: { focus: 'balanced' },
    includeComingSoon: true,
    culturalAnchors: true,
    unlockedStages: ['stage1'],
  },
  weeks: starts.map((startDate, i) => ({ index: i + 1, startDate, kind: 'learn' as const, focus: { episodeId: null, storyIds: [], festival: null }, extras: [] })),
  horizonDays: 7,
  repacedAt: null,
});
const source = (id: string, m: CurriculumMeta | null): GoalSource => ({ id, kind: 'class', assignedAt: 't', items: [], meta: m });
const goal = (sourceId: string | null): Pick<RouteGoal, 'sourceId'> => ({ sourceId });
const SOURCES = [source('plan:c', meta(['2026-10-05', '2026-10-12', '2026-10-19'])), source('plan:old', null)];

describe('planWeekOf', () => {
  it('names the week of the goal plan that holds today, first and last day inclusive', () => {
    expect(planWeekOf(goal('plan:c'), SOURCES, '2026-10-05')).toBe(1);
    expect(planWeekOf(goal('plan:c'), SOURCES, '2026-10-11')).toBe(1);
    expect(planWeekOf(goal('plan:c'), SOURCES, '2026-10-12')).toBe(2);
    expect(planWeekOf(goal('plan:c'), SOURCES, '2026-10-25')).toBe(3);
  });

  it('is null before the plan starts, after its last week, for the default goal, a missing source or a classic plan', () => {
    expect(planWeekOf(goal('plan:c'), SOURCES, '2026-10-04')).toBeNull();
    expect(planWeekOf(goal('plan:c'), SOURCES, '2026-10-26')).toBeNull();
    expect(planWeekOf(goal(null), SOURCES, '2026-10-12')).toBeNull();
    expect(planWeekOf(null, SOURCES, '2026-10-12')).toBeNull();
    expect(planWeekOf(goal('plan:gone'), SOURCES, '2026-10-12')).toBeNull();
    expect(planWeekOf(goal('plan:old'), SOURCES, '2026-10-12')).toBeNull();
  });
});
