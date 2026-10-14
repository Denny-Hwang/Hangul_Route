import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  defaultGoalStage,
  pickGoal,
  planGoalStage,
  planLastDay,
  routeCatalogOf,
  StageKeySchema,
  stageAvailabilityOf,
  type Catalog,
  type CurriculumMeta,
  type GoalSource,
  type PlanItem,
  type RouteStageAvailability,
  type RouteStageState,
  type StageKey,
} from '../../index';
import { CATALOG_2026_10 } from '../../__tests__/fixtures/catalog-2026-10';

/**
 * Learning Route amendment section 4.1 (LR-3a): where the goal comes from.
 * Every rule of `pickGoal` runs on the frozen October 2026 catalogue.
 */

const catalog = routeCatalogOf(CATALOG_2026_10);
const availability = (stage: StageKey): RouteStageAvailability => stageAvailabilityOf(CATALOG_2026_10, stage);

type Rows = { stage: StageKey; state: RouteStageState }[];
/** The seven stage rows, all `open` unless overridden (stage 3 and 5 to 7 have no content, so `later`). */
const rows = (over: Partial<Record<StageKey, RouteStageState>> = {}): Rows =>
  StageKeySchema.options.map((stage) => ({
    stage,
    state: over[stage] ?? (stage === 'stage1' || stage === 'stage2' || stage === 'stage4' ? 'open' : 'later'),
  }));

const meta = (o: { start?: string; weeks?: number; level?: StageKey } = {}): CurriculumMeta => {
  const weeks = o.weeks ?? 4;
  const start = o.start ?? '2026-10-05';
  const startOf = (i: number): string => {
    const [y, m, d] = start.split('-').map(Number) as [number, number, number];
    return new Date(Date.UTC(y, m - 1, d) + 7 * i * 86_400_000).toISOString().slice(0, 10);
  };
  return {
    kind: 'curriculum',
    generatorVersion: 1,
    catalogVersion: 4,
    params: {
      audience: 'class',
      level: { stage: o.level ?? 'stage1', band: 0 },
      startDate: start,
      weeks,
      sessionsPerWeek: 2,
      minutesPerSession: 10,
      daysOff: [],
      goals: { focus: 'balanced' },
      includeComingSoon: true,
      culturalAnchors: true,
      unlockedStages: ['stage1'],
    },
    weeks: Array.from({ length: weeks }, (_, i) => ({
      index: i + 1,
      startDate: startOf(i),
      kind: 'learn' as const,
      focus: { episodeId: null, storyIds: [], festival: null },
      extras: [],
    })),
    horizonDays: 7,
    repacedAt: null,
  };
};

const quest = (id: string): PlanItem => ({ kind: 'quest', id });
const episode = (id: string): PlanItem => ({ kind: 'episode', id });

const source = (o: Partial<GoalSource> & Pick<GoalSource, 'id' | 'kind'>): GoalSource => ({
  assignedAt: '2026-10-01T09:00:00.000Z',
  items: [quest('quest:stage1-life-q1')],
  meta: meta(),
  ...o,
});

const TODAY = '2026-10-11';
const goalOf = (sources: GoalSource[], stages: Rows = rows(), today = TODAY) => pickGoal({ sources, catalog, stages, availability, today });

describe('stageAvailabilityOf (the catalogue twin of the app stageAvailability)', () => {
  it('words a stage open when every cell is ready, a taste when some are, soon when none is', () => {
    expect(StageKeySchema.options.map((stage) => stageAvailabilityOf(CATALOG_2026_10, stage))).toEqual(['open', 'taste', 'soon', 'taste', 'soon', 'soon', 'soon']);
  });

  it('agrees on the shipped catalogue today (Stage 5 is open since all five of its books shipped, F-STORY-005 PR 5.6; Stage 3 a taste since First Sentences, F-CURR-001 S3-1; Stage 7 a taste since Make & Share, S7-5)', () => {
    expect(StageKeySchema.options.map((stage) => stageAvailabilityOf(CATALOG, stage))).toEqual(['open', 'taste', 'taste', 'taste', 'open', 'soon', 'taste']);
  });

  it('counts a ready cell like a shipped one, and a preview or draft cell as not ready', () => {
    const allReady: Catalog = { ...CATALOG_2026_10, cells: CATALOG_2026_10.cells.map((c) => (c.stage === 'stage2' ? { ...c, status: 'ready' } : c)) };
    expect(stageAvailabilityOf(allReady, 'stage2')).toBe('open');
    const draft: Catalog = { ...CATALOG_2026_10, cells: CATALOG_2026_10.cells.map((c) => (c.stage === 'stage1' ? { ...c, status: 'draft' } : c)) };
    expect(stageAvailabilityOf(draft, 'stage1')).toBe('soon');
  });

  it('a stage with no cell at all is soon', () => {
    const empty: Catalog = { ...CATALOG_2026_10, cells: CATALOG_2026_10.cells.filter((c) => c.stage !== 'stage7') };
    expect(stageAvailabilityOf(empty, 'stage7')).toBe('soon');
  });
});

describe('planLastDay (section 4.1 rule 1: the last week start plus 6 days)', () => {
  it('is the last week start plus six days', () => {
    expect(planLastDay(meta({ start: '2026-10-05', weeks: 4 }))).toBe('2026-11-01');
    expect(planLastDay(meta({ start: '2026-12-28', weeks: 1 }))).toBe('2027-01-03');
  });

  it('takes the latest week whatever the array order', () => {
    const m = meta({ start: '2026-10-05', weeks: 3 });
    expect(planLastDay({ ...m, weeks: [...m.weeks].reverse() })).toBe('2026-10-25');
  });

  it('falls back to the stored params when a meta has no weeks', () => {
    const m = meta({ start: '2026-10-05', weeks: 2 });
    expect(planLastDay({ ...m, weeks: [] })).toBe('2026-10-18');
  });
});

describe('planGoalStage (section 4.1 rule 3: the generator endsAtStage rule)', () => {
  it('is the highest stage of the lesson items', () => {
    expect(planGoalStage([quest('quest:stage1-letters-q1'), quest('quest:stage2-life-q1'), quest('quest:stage1-life-q1')], meta(), catalog)).toBe('stage2');
    expect(planGoalStage([quest('quest:stage4-rites-q1'), quest('quest:stage2-life-q1')], meta(), catalog)).toBe('stage4');
  });

  it('never moves for a story, whatever stage the story recommends', () => {
    expect(planGoalStage([quest('quest:stage1-life-q1'), quest('quest:story-sillok-mountain-archives-listen')], meta(), catalog)).toBe('stage1');
  });

  it('counts an episode item of a ready cell, never a coming-soon placeholder or an unknown id', () => {
    expect(planGoalStage([quest('quest:stage1-life-q1'), episode('episode:stage2-nature')], meta(), catalog)).toBe('stage2');
    expect(planGoalStage([quest('quest:stage1-life-q1'), episode('episode:stage3-letters'), episode('episode:stage2-rites')], meta(), catalog)).toBe('stage1');
    expect(planGoalStage([quest('quest:stage1-life-q1'), quest('quest:retired-q9'), episode('episode:nowhere')], meta(), catalog)).toBe('stage1');
  });

  it("falls back to the plan level's stage when no item is a lesson", () => {
    expect(planGoalStage([], meta({ level: 'stage2' }), catalog)).toBe('stage2');
    expect(planGoalStage([quest('quest:story-sejong-new-letters-listen'), episode('episode:stage5-life')], meta({ level: 'stage4' }), catalog)).toBe('stage4');
  });

  it("never names a stage below the plan level (lessons put back below it keep the level's stage)", () => {
    expect(planGoalStage([quest('quest:stage1-life-q1')], meta({ level: 'stage2' }), catalog)).toBe('stage2');
  });
});

describe('defaultGoalStage (section 4.1 rule 4, LR-OD-5)', () => {
  it('is the first open stage in order 1 to 7: Stage 1, then Stage 2, then Stage 4, then none', () => {
    expect(defaultGoalStage(rows())).toBe('stage1');
    expect(defaultGoalStage(rows({ stage1: 'complete' }))).toBe('stage2');
    expect(defaultGoalStage(rows({ stage1: 'known', stage2: 'explored' }))).toBe('stage4');
    expect(defaultGoalStage(rows({ stage1: 'complete', stage2: 'explored', stage4: 'explored' }))).toBeNull();
  });

  it('reads the rows in stage order whatever order they arrive in', () => {
    expect(defaultGoalStage([...rows({ stage1: 'complete' })].reverse())).toBe('stage2');
  });

  it('is null with no rows', () => {
    expect(defaultGoalStage([])).toBeNull();
  });
});

describe('pickGoal (section 4.1)', () => {
  it('a curriculum plan sets the goal: stage, source, plan id and last day', () => {
    const plan = source({ id: 'plan:class-a', kind: 'class', items: [quest('quest:stage1-life-q1'), quest('quest:stage2-life-q1')] });
    expect(goalOf([plan])).toEqual({ stage: 'stage2', from: 'class', sourceId: 'plan:class-a', endsOn: '2026-11-01', reached: false, taste: true });
  });

  it('a classic plan (no meta) is homework, not a route, and sets no goal', () => {
    const classic = source({ id: 'plan:classic', kind: 'class', meta: null, items: [quest('quest:stage4-rites-q1')] });
    expect(goalOf([classic])).toMatchObject({ stage: 'stage1', from: 'default', sourceId: null, endsOn: null });
  });

  it('a finished plan is ignored; its last day still counts (inclusive)', () => {
    const plan = source({ id: 'plan:fam', kind: 'family', items: [quest('quest:stage2-life-q1')], meta: meta({ start: '2026-10-05', weeks: 1 }) });
    expect(goalOf([plan], rows(), '2026-10-11')).toMatchObject({ from: 'family', stage: 'stage2', endsOn: '2026-10-11' });
    expect(goalOf([plan], rows(), '2026-10-12')).toMatchObject({ from: 'default', stage: 'stage1' });
  });

  it('a plan that starts later already sets the goal', () => {
    const plan = source({ id: 'plan:soon', kind: 'self', items: [quest('quest:stage2-nature-q1')], meta: meta({ start: '2026-11-02' }) });
    expect(goalOf([plan])).toMatchObject({ from: 'self', stage: 'stage2' });
  });

  it("ranks a teacher's plan first, then a parent's (family and school alike), then the learner's own", () => {
    const cls = source({ id: 'plan:class', kind: 'class', assignedAt: '2026-09-01T00:00:00.000Z', items: [quest('quest:stage1-life-q1')] });
    const fam = source({ id: 'plan:fam', kind: 'family', assignedAt: '2026-10-10T00:00:00.000Z', items: [quest('quest:stage2-life-q1')] });
    const sch = source({ id: 'plan:school', kind: 'school', assignedAt: '2026-10-09T00:00:00.000Z', items: [quest('quest:stage4-rites-q1')] });
    const self = source({ id: 'route:self', kind: 'self', assignedAt: '2026-10-11T00:00:00.000Z', items: [quest('quest:stage2-nature-q1')] });
    expect(goalOf([self, sch, fam, cls])).toMatchObject({ from: 'class', sourceId: 'plan:class' });
    expect(goalOf([self, sch, fam])).toMatchObject({ from: 'family', sourceId: 'plan:fam' });
    expect(goalOf([self, sch])).toMatchObject({ from: 'school', sourceId: 'plan:school', stage: 'stage4' });
    expect(goalOf([self])).toMatchObject({ from: 'self', sourceId: 'route:self' });
  });

  it('inside one rank the newest assignedAt wins; an exact tie goes to the lower id', () => {
    const older = source({ id: 'plan:b-old', kind: 'class', assignedAt: '2026-09-01T00:00:00.000Z', items: [quest('quest:stage4-rites-q1')] });
    const newer = source({ id: 'plan:a-new', kind: 'class', assignedAt: '2026-10-02T00:00:00.000Z', items: [quest('quest:stage2-life-q1')] });
    expect(goalOf([older, newer])).toMatchObject({ sourceId: 'plan:a-new', stage: 'stage2' });
    expect(goalOf([newer, older])).toMatchObject({ sourceId: 'plan:a-new', stage: 'stage2' });
    const twinB = source({ id: 'plan:b', kind: 'family', items: [quest('quest:stage4-rites-q1')] });
    const twinA = source({ id: 'plan:a', kind: 'school', items: [quest('quest:stage2-life-q1')] });
    expect(goalOf([twinB, twinA])).toMatchObject({ sourceId: 'plan:a' });
    expect(goalOf([twinA, twinB])).toMatchObject({ sourceId: 'plan:a' });
  });

  it('a classic or finished plan of a higher rank gives way to a live curriculum of a lower rank', () => {
    const classic = source({ id: 'plan:classic', kind: 'class', meta: null });
    const done = source({ id: 'plan:done', kind: 'family', meta: meta({ start: '2026-08-03', weeks: 2 }) });
    const self = source({ id: 'route:self', kind: 'self', items: [quest('quest:stage2-life-q1')] });
    expect(goalOf([classic, done, self])).toMatchObject({ from: 'self', sourceId: 'route:self', stage: 'stage2' });
  });

  it('with no curriculum source the default rule applies: never reached, no plan id, no last day', () => {
    expect(goalOf([])).toEqual({ stage: 'stage1', from: 'default', sourceId: null, endsOn: null, reached: false, taste: false });
    expect(goalOf([], rows({ stage1: 'complete' }))).toEqual({ stage: 'stage2', from: 'default', sourceId: null, endsOn: null, reached: false, taste: true });
    expect(goalOf([], rows({ stage1: 'complete', stage2: 'explored' }))).toMatchObject({ stage: 'stage4', reached: false, taste: true });
  });

  it('is null at the end of the open road', () => {
    expect(goalOf([], rows({ stage1: 'complete', stage2: 'explored', stage4: 'known' }))).toBeNull();
  });

  describe('reached (section 4.1 rule 6)', () => {
    const plan = (stage: 'stage1' | 'stage2'): GoalSource =>
      source({ id: 'plan:class', kind: 'class', items: [quest(stage === 'stage1' ? 'quest:stage1-life-q1' : 'quest:stage2-life-q1')] });

    it('is true when the goal stage is complete or known', () => {
      expect(goalOf([plan('stage1')], rows({ stage1: 'complete' }))).toMatchObject({ stage: 'stage1', reached: true, taste: false });
      expect(goalOf([plan('stage1')], rows({ stage1: 'known' }))).toMatchObject({ stage: 'stage1', reached: true });
    });

    it('is true for an explored taste stage, never for an explored full stage', () => {
      expect(goalOf([plan('stage2')], rows({ stage2: 'explored' }))).toMatchObject({ stage: 'stage2', reached: true, taste: true });
      expect(goalOf([plan('stage1')], rows({ stage1: 'explored' }))).toMatchObject({ stage: 'stage1', reached: false });
    });

    it('is false while the goal stage is open or later, or has no row', () => {
      expect(goalOf([plan('stage2')])).toMatchObject({ reached: false });
      expect(goalOf([plan('stage2')], rows({ stage2: 'later' }))).toMatchObject({ reached: false });
      expect(goalOf([plan('stage2')], rows().filter((r) => r.stage !== 'stage2'))).toMatchObject({ stage: 'stage2', reached: false });
    });

    it('a reached plan goal stays the goal until the plan ends, then the rule falls to the next source', () => {
      const cls = source({ id: 'plan:class', kind: 'class', items: [quest('quest:stage1-life-q1')], meta: meta({ start: '2026-10-05', weeks: 1 }) });
      const fam = source({ id: 'plan:fam', kind: 'family', items: [quest('quest:stage2-life-q1')], meta: meta({ start: '2026-10-05', weeks: 8 }) });
      const done = rows({ stage1: 'complete' });
      expect(goalOf([cls, fam], done, '2026-10-11')).toMatchObject({ from: 'class', stage: 'stage1', reached: true });
      expect(goalOf([cls, fam], done, '2026-10-12')).toMatchObject({ from: 'family', stage: 'stage2', reached: false });
      expect(goalOf([cls], done, '2026-10-12')).toMatchObject({ from: 'default', stage: 'stage2', reached: false });
    });
  });

  it('names a stage with no shipped content when a plan reaches it (the collapsed later row keeps its tag)', () => {
    const fromOtherCatalogue = { quests: [...catalog.quests, { id: 'quest:stage3-life-q1', episodeId: 'episode:stage3-life', stage: 'stage3' as const, theme: 'life' as const, order: 999, teaches: [], playable: false, grid: true }] };
    const plan = source({ id: 'plan:class', kind: 'class', items: [quest('quest:stage3-life-q1')] });
    expect(pickGoal({ sources: [plan], catalog: fromOtherCatalogue, stages: rows(), availability, today: TODAY })).toMatchObject({ stage: 'stage3', taste: false, reached: false });
  });
});
