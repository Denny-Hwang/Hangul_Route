import { describe, expect, it } from 'vitest';
import {
  PLACEMENT_MODES,
  STAGE_JUMP_STAGES,
  effectiveRoute,
  jumpLevelOf,
  jumpedStagesOf,
  modeCeiling,
  overrideInForce,
  placementLevelRank,
  placedOutGrowth,
  questsPlacedOutAtLevel,
  type CatalogHistory,
  type PlacementLevel,
  type PlacementResult,
  type RouteCatalog,
  type RouteQuest,
  type StageKey,
  type ThemeKey,
} from '..';
import { STAGE1_15_QUESTS, ids, q, qs } from './fixtures/stage1-15';
import { makeResult } from './fixtures/placement-results';

/**
 * Stage Jump Ahead and the amended F-PLC-001 ceiling (F-CURR-002 row CM-25): a passed jump latches the stage's key in
 * `testedOut` beside its cells' keys; `effectiveRoute` folds it in by the maximum, so a placement result and a jump
 * never lower each other, and nothing but a jump places a learner above `stage3`.
 */

const later = (id: string, stage: StageKey, theme: ThemeKey, order: number, extra: Partial<RouteQuest> = {}): RouteQuest => ({
  id: `quest:${id}`,
  episodeId: `episode:${id.replace(/-q\d+$/, '')}`,
  stage,
  theme,
  order,
  teaches: [],
  playable: true,
  grid: true,
  ...extra,
});

const STAGE2 = [later('stage2-life-q1', 'stage2', 'life', 16), later('stage2-nature-q1', 'stage2', 'nature', 17)];
const STAGE3 = [
  later('stage3-life-q1', 'stage3', 'life', 18),
  later('stage3-life-q2', 'stage3', 'life', 19),
  later('stage3-nature-q1', 'stage3', 'nature', 20),
];
const STAGE4 = [later('stage4-life-q1', 'stage4', 'life', 21), later('stage4-rites-q1', 'stage4', 'rites', 22)];
const SHELF = later('shelf-tiger-q1', 'stage3', 'nature', 23, { grid: false });
const ROUTE: RouteCatalog = { quests: [...STAGE1_15_QUESTS, ...STAGE2, ...STAGE3, ...STAGE4, SHELF] };

const paid = { isEntitled: () => true, completedQuestIds: new Set<string>() };
const at = (day: number): string => `2026-10-${String(10 + day).padStart(2, '0')}T10:00:00.000Z`;

/** The `testedOut` a passed jump of each stage writes: every grid cell of the stage and the stage key, one instant. */
const jumpOf = (route: RouteCatalog, stages: readonly StageKey[], when = at(5)): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const stage of stages) {
    for (const quest of route.quests) if (quest.grid && quest.stage === stage) out[quest.episodeId] = when;
    out[stage] = when;
  }
  return out;
};

const short = makeResult({ id: 'placement:short', completedAt: at(1), mode: 'short', length: 'quick', level: { stage: 'stage1', band: 1 }, placedOutQuestIds: qs(1, 2, 3) });
const standard = makeResult({
  id: 'placement:standard',
  completedAt: at(2),
  mode: 'standard',
  level: { stage: 'stage2', band: 0 },
  placedOutQuestIds: ids(STAGE1_15_QUESTS),
});
const deep = makeResult({
  id: 'placement:deep',
  completedAt: at(3),
  mode: 'deep',
  level: { stage: 'stage3', band: 0 },
  placedOutQuestIds: [...ids(STAGE1_15_QUESTS), ...ids(STAGE2)],
});

const rank = (level: PlacementLevel | undefined): number => (level === undefined ? 0 : placementLevelRank(level));

describe('the jump level and the jumped stages', () => {
  it('a jump of Stage N stands for the next stage band 0; the scale ends at Stage 7', () => {
    expect(STAGE_JUMP_STAGES).toEqual(['stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7']);
    expect(jumpLevelOf('stage2')).toEqual({ stage: 'stage3', band: 0 });
    expect(jumpLevelOf('stage3')).toEqual({ stage: 'stage4', band: 0 });
    expect(jumpLevelOf('stage6')).toEqual({ stage: 'stage7', band: 0 });
    expect(jumpLevelOf('stage7')).toEqual({ stage: 'stage7', band: 0 });
  });

  it('reads only stage keys from testedOut: a cell key, Stage 1 and an unknown key are never a jump', () => {
    expect(jumpedStagesOf(undefined)).toEqual([]);
    expect(jumpedStagesOf({ 'episode:stage3-life': at(1), stage1: at(1), stage9: at(1) })).toEqual([]);
    expect(jumpedStagesOf({ stage4: at(2), stage2: at(1), 'episode:stage2-life': at(1) })).toEqual(['stage2', 'stage4']);
  });
});

describe('the ceiling (F-PLC-001 section 3.6 as amended)', () => {
  it('no placement mode reaches above stage3 on its own', () => {
    for (const mode of PLACEMENT_MODES) expect(rank(modeCeiling(mode))).toBeLessThanOrEqual(placementLevelRank({ stage: 'stage3', band: 0 }));
    const route = effectiveRoute([short, standard, deep], ROUTE, paid)!;
    expect(route.level).toEqual({ stage: 'stage3', band: 0 });
  });

  it('a jump is the only way above stage3', () => {
    const route = effectiveRoute([deep], ROUTE, { ...paid, testedOut: jumpOf(ROUTE, ['stage3']) })!;
    expect(route.level).toEqual({ stage: 'stage4', band: 0 });
    expect(route.beyondContent).toBe(true);
  });

  it('the coarse mapping at a level above stage3 places out the stages below it and never the level stage', () => {
    for (const stage of ['stage4', 'stage5', 'stage6', 'stage7'] as const) {
      const out = new Set(questsPlacedOutAtLevel({ stage, band: 0 }, ROUTE));
      for (const quest of ROUTE.quests) {
        const below = quest.grid && Number(quest.stage.slice(5)) < Number(stage.slice(5));
        expect(out.has(quest.id), `${quest.id} at ${stage}`).toBe(below);
      }
    }
  });
});

describe('a jump combined with a placement result by the maximum', () => {
  const cases: readonly [string, PlacementResult][] = [
    ['Short', short],
    ['Standard', standard],
    ['Deep', deep],
  ];

  for (const [name, result] of cases) {
    it(`${name}: the level and the placed-out set never drop, in either order`, () => {
      const alone = effectiveRoute([result], ROUTE, paid)!;
      for (const stage of ['stage2', 'stage3'] as const) {
        const testedOut = jumpOf(ROUTE, [stage]);
        const both = effectiveRoute([result], ROUTE, { ...paid, testedOut })!;
        expect(rank(both.level)).toBeGreaterThanOrEqual(rank(alone.level));
        expect(rank(both.level)).toBeGreaterThanOrEqual(rank(jumpLevelOf(stage)));
        expect(both.level).toEqual(rank(alone.level) > rank(jumpLevelOf(stage)) ? alone.level : jumpLevelOf(stage));
        expect(both.placedOutQuestIds).toEqual(expect.arrayContaining(alone.placedOutQuestIds));
        // The jumped stage's quests are placed out; a lower stage the result did not place out is not.
        for (const quest of ROUTE.quests.filter((x) => x.grid && x.stage === stage)) expect(both.placedOutQuestIds).toContain(quest.id);
        // The priority tokens, the listening level and the theme order stay the result's.
        expect(both.priorityTokens).toEqual(alone.priorityTokens);
        expect(both.oralStage).toEqual(alone.oralStage);
        expect(both.themeOrder).toEqual(alone.themeOrder);
        // A retake after the jump (a later completedAt) cannot lower it either.
        const retake = makeResult({ ...result, id: 'placement:retake', completedAt: at(9), level: { stage: 'stage1', band: 0 }, placedOutQuestIds: [] });
        const after = effectiveRoute([result, retake], ROUTE, { ...paid, testedOut })!;
        expect(after.level).toEqual(both.level);
        expect(after.placedOutQuestIds).toEqual(expect.arrayContaining(both.placedOutQuestIds));
      }
    });
  }

  it('the start quest moves past the jumped stage and never back', () => {
    const before = effectiveRoute([deep], ROUTE, paid)!;
    expect(before.startQuestId).toBe('quest:stage3-life-q1');
    const after = effectiveRoute([deep], ROUTE, { ...paid, testedOut: jumpOf(ROUTE, ['stage3']) })!;
    expect(after.startQuestId).toBe('quest:stage4-life-q1');
    // A Stage 2 jump under a Deep result changes nothing: stage3 band 0 is already reached.
    const lower = effectiveRoute([deep], ROUTE, { ...paid, testedOut: jumpOf(ROUTE, ['stage2']) })!;
    expect(lower.level).toEqual(before.level);
    expect(lower.startQuestId).toBe(before.startQuestId);
  });

  it('the highest of several jumps wins, whatever the key order', () => {
    const testedOut = { ...jumpOf(ROUTE, ['stage3'], at(6)), ...jumpOf(ROUTE, ['stage2'], at(4)) };
    expect(effectiveRoute([standard], ROUTE, { ...paid, testedOut })!.level).toEqual({ stage: 'stage4', band: 0 });
  });

  it('a jump with no placement result is a route of its own; with neither there is none', () => {
    expect(effectiveRoute([], ROUTE, paid)).toBeNull();
    expect(effectiveRoute([], ROUTE, { ...paid, testedOut: { 'episode:stage2-life': at(1) } })).toBeNull();
    const route = effectiveRoute([], ROUTE, { ...paid, testedOut: jumpOf(ROUTE, ['stage2']) })!;
    expect(route.level).toEqual({ stage: 'stage3', band: 0 });
    expect(route.placedOutQuestIds).toEqual(ids(STAGE2));
    expect(route.priorityTokens).toEqual([]);
    expect(route.oralStage).toBeNull();
    // Stage 1 was not placed out by the jump: the start is its first quest.
    expect(route.startQuestId).toBe(q(1));
  });

  it('places out only the cells the jump marked: a cell shipped later in that stage is new content', () => {
    const testedOut = jumpOf(ROUTE, ['stage3']);
    const grown: RouteCatalog = { quests: [...ROUTE.quests, later('stage3-crafts-q1', 'stage3', 'crafts', 20.5)] };
    const route = effectiveRoute([deep], grown, { ...paid, testedOut })!;
    expect(route.placedOutQuestIds).not.toContain('quest:stage3-crafts-q1');
    expect(route.startQuestId).toBe('quest:stage3-crafts-q1');
    expect(route.level).toEqual({ stage: 'stage4', band: 0 });
    expect(route.placedOutQuestIds).not.toContain(SHELF.id);
  });

  it('a grown-up override newer than the jump puts the jumped stage back (the grown-up keeps the last word)', () => {
    const override = makeResult({ id: 'placement:o', completedAt: at(7), override: { by: 'parent', at: at(7), startQuestId: q(1) } });
    // The jump at day 5, the override at day 7.
    const route = effectiveRoute([deep, override], ROUTE, { ...paid, testedOut: jumpOf(ROUTE, ['stage3']) })!;
    expect(route.startQuestId).toBe(q(1));
    for (const quest of STAGE3) expect(route.placedOutQuestIds).not.toContain(quest.id);
    // An override moves the start, never the level (as with a result).
    expect(route.level).toEqual(jumpLevelOf('stage3'));
  });

  it('a jump newer than the override moves past it; the override still sets the start before the stage', () => {
    const override = makeResult({ id: 'placement:o', completedAt: at(3), override: { by: 'parent', at: at(3), startQuestId: q(1) } });
    const route = effectiveRoute([deep, override], ROUTE, { ...paid, testedOut: jumpOf(ROUTE, ['stage3'], at(8)) })!;
    expect(route.startQuestId).toBe(q(1));
    for (const quest of STAGE3) expect(route.placedOutQuestIds).toContain(quest.id);
    expect(overrideInForce([deep, override])?.at).toBe(at(3));
    expect(overrideInForce([deep])).toBeUndefined();
  });

  it('a completed quest is never touched, and an unentitled jumped level names the stage it needs', () => {
    const route = effectiveRoute([deep], ROUTE, {
      isEntitled: (s: StageKey) => s !== 'stage4',
      completedQuestIds: new Set(['quest:stage4-life-q1']),
      testedOut: jumpOf(ROUTE, ['stage3']),
    })!;
    expect(route.startQuestId).toBeNull();
    expect(route.needsStage).toBe('stage4');
  });
});

describe('the catalogue-growth rule reads each result level, never the jump level', () => {
  const HISTORY: CatalogHistory = { version: 9, idsAt: (v) => new Set(v >= 9 ? ids(ROUTE.quests) : ids(STAGE1_15_QUESTS)) };

  it('a result stored at an older catalogue grows by its own level; the jump adds only its own cells', () => {
    const stored = makeResult({ ...standard, catalogVersion: 8 });
    expect(placedOutGrowth(stored.level, 8, ROUTE, new Set(), HISTORY)).toEqual([]);
    const route = effectiveRoute([stored], ROUTE, { ...paid, catalogHistory: HISTORY, testedOut: jumpOf(ROUTE, ['stage3']) })!;
    // stage4 band 0 from the jump does not place out Stage 2 through the growth rule.
    for (const quest of STAGE2) expect(route.placedOutQuestIds).not.toContain(quest.id);
    for (const quest of STAGE3) expect(route.placedOutQuestIds).toContain(quest.id);
    expect(route.startQuestId).toBe('quest:stage2-life-q1');
  });
});
