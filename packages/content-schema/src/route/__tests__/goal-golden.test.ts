import { describe, expect, it } from 'vitest';
import { generateCurriculum, planGoalStage, routeCatalogOf, toMeta, toPlanItems, type CurriculumParamsInput } from '../../index';
import { CATALOG_2026_10 } from '../../__tests__/fixtures/catalog-2026-10';

/**
 * Learning Route amendment section 4.1 rule 3 and assumption c (LR-3a): the
 * goal stage of a curriculum plan is the generator's own `endsAtStage`, read
 * back from what the plan stores (its items and its meta). Goldens A and B are
 * F-PLAN-002 section 3.4's worked examples on the frozen October 2026
 * catalogue; the other drafts cover the generator's corner cases, so the two
 * rules cannot drift apart.
 */

const catalog = routeCatalogOf(CATALOG_2026_10);
const ALL = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'] as const;

const goldenA: CurriculumParamsInput = {
  audience: 'class',
  level: { stage: 'stage1', band: 0 },
  startDate: '2026-10-18',
  weeks: 12,
  sessionsPerWeek: 2,
  sessionDays: ['sun', 'wed'],
  minutesPerSession: 10,
  goals: { focus: 'balanced', motivation: 'heritage' },
  daysOff: [{ from: '2026-11-22', to: '2026-11-28' }],
  unlockedStages: [...ALL],
  reviewEvery: 4,
};

const goldenB: CurriculumParamsInput = {
  audience: 'self',
  level: { stage: 'stage1', band: 3 },
  startDate: '2026-10-12',
  weeks: 26,
  sessionsPerWeek: 3,
  sessionDays: ['mon', 'wed', 'fri'],
  minutesPerSession: 15,
  goals: { focus: 'balanced', motivation: 'kculture' },
  unlockedStages: ['stage1'],
  reviewEvery: 4,
};

const goalOfDraft = (params: CurriculumParamsInput) => {
  const draft = generateCurriculum(params, CATALOG_2026_10);
  return { draft, goal: planGoalStage(toPlanItems(draft), toMeta(draft), catalog) };
};

describe('planGoalStage equals the generator endsAtStage (assumption c)', () => {
  it('golden A: a 12-week class reaches Stage 2', () => {
    const { draft, goal } = goalOfDraft(goldenA);
    expect(draft.stats.endsAtStage).toBe('stage2');
    expect(goal).toBe(draft.stats.endsAtStage);
  });

  it('golden B: a 6-month self-learner with only Stage 1 open stays in Stage 1 (coming-soon placeholders never move it)', () => {
    const { draft, goal } = goalOfDraft(goldenB);
    expect(draft.stats.endsAtStage).toBe('stage1');
    expect(toPlanItems(draft).some((item) => item.kind === 'episode')).toBe(true);
    expect(goal).toBe(draft.stats.endsAtStage);
  });

  const stage1 = CATALOG_2026_10.quests.filter((quest) => quest.kind === 'lesson' && quest.stage === 'stage1').map((quest) => quest.id);

  it.each([
    ['a 40-week plan with every stage open reaches Stage 4', { ...goldenA, weeks: 40, sessionsPerWeek: 3, sessionDays: undefined, reviewEvery: 0 }, 'stage4'],
    ['a plan whose lesson queue ends one below its level holds stories only and keeps the level stage', { ...goldenA, level: { stage: 'stage4', band: 0 }, endStage: 'stage3' }, 'stage4'],
    [
      'lessons put back below a Stage 2 level (exact placed-out set, queue ends at Stage 1) keep the level stage',
      { ...goldenA, level: { stage: 'stage2', band: 0 }, endStage: 'stage1', placedOutQuestIds: stage1.slice(2) },
      'stage2',
    ],
    ['an exact placed-out set under a Stage 2 level with the whole road open reaches Stage 4', { ...goldenA, level: { stage: 'stage2', band: 0 }, placedOutQuestIds: stage1.slice(0, 2) }, 'stage4'],
    ['a one-week plan', { ...goldenB, weeks: 1 }, 'stage1'],
    ['a 40-week plan that ends at Stage 2', { ...goldenA, weeks: 40, sessionsPerWeek: 3, sessionDays: undefined, endStage: 'stage2' }, 'stage2'],
  ] as const)('%s', (_name, params, endsAt) => {
    const { draft, goal } = goalOfDraft(params as CurriculumParamsInput);
    expect(draft.stats.endsAtStage).toBe(endsAt);
    expect(goal).toBe(draft.stats.endsAtStage);
  });

  it('the put-back case really schedules only lessons below the level', () => {
    const { draft } = goalOfDraft({ ...goldenA, level: { stage: 'stage2', band: 0 }, endStage: 'stage1', placedOutQuestIds: stage1.slice(2) });
    const lessons = toPlanItems(draft).filter((item) => item.id.startsWith('quest:stage'));
    expect(lessons.map((item) => item.id)).toEqual(stage1.slice(0, 2));
  });
});
