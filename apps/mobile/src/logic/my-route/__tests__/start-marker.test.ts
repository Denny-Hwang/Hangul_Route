import { describe, expect, it } from 'vitest';
import type { PlacementResult, ProgressSnapshot, StageKey } from '@hangul-route/content-schema';
import { buildMyRoute } from '../model';
import { startMarkerOf, startRouteOf } from '../start-marker';
import { journeySummaryOf } from '../summary';
import { routeOrder } from '../order';
import type { MyRouteInput, MyRouteModel } from '../types';
import { BUNDLE_15, BUNDLE_8, STAGE1_8, STAGE_DEFS, THEME_DEFS, catalogOf, snapshotWith, type Bundle } from './fixtures/bundle-2026-10';
import { result, seed } from './fixtures/route';

/**
 * F-ROUTE-001 R-7a (section 3.6): the start marker is a fixed anchor computed
 * with no completions, so it moves only with a better retake or a grown-up
 * override, never because the learner played; placed-out quests that are not
 * done are `known` pips.
 */

const LETTERS = ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3'];
const everyone = (): boolean => true;

const inputOf = (snapshot: ProgressSnapshot, bundle: Bundle, over: Partial<MyRouteInput> = {}): MyRouteInput => {
  const catalog = catalogOf(bundle);
  const isEntitled = over.isEntitled ?? everyone;
  return {
    snapshot,
    catalog,
    episodes: bundle.episodes,
    quests: bundle.quests,
    cards: [],
    stages: STAGE_DEFS,
    themes: THEME_DEFS,
    isEntitled,
    route: startRouteOf(snapshot.placements, catalog, isEntitled),
    now: new Date('2026-10-11T12:00:00.000Z'),
    ...over,
  };
};

/** The model the way the app builds it: the route from the stored placements, with no completions. */
const build = (done: string[], placements: PlacementResult[], bundle: Bundle = BUNDLE_8, over: Partial<MyRouteInput> = {}): MyRouteModel =>
  buildMyRoute(inputOf(snapshotWith(done, { placements }), bundle, over));

const row = (m: MyRouteModel, stage: StageKey) => m.stages.find((s) => s.stage === stage);
const startPips = (m: MyRouteModel) => m.stages.flatMap((s) => [...s.pips, ...s.newPips]).filter((p) => p.isStart).map((p) => p.questId);
const startRows = (m: MyRouteModel) => m.stages.filter((s) => s.isStart).map((s) => s.stage);

describe('startRouteOf: effectiveRoute with no completions', () => {
  it('is null without a stored level-check result (old snapshot or none taken)', () => {
    const catalog = catalogOf(BUNDLE_8);
    expect(startRouteOf(undefined, catalog, everyone)).toBeNull();
    expect(startRouteOf([], catalog, everyone)).toBeNull();
  });

  it('ignores completions: the start stays on a quest the learner has since finished', () => {
    const route = startRouteOf([result({ placedOutQuestIds: LETTERS })], catalogOf(BUNDLE_8), everyone);
    expect(route?.startQuestId).toBe('quest:stage1-life-q1');
    expect(route?.placedOutQuestIds).toEqual(LETTERS);
  });
});

describe('the start marker (section 3.6)', () => {
  it('no placement: no start marker, no start pip, no start tag', () => {
    const m = build([], []);
    expect(m.start).toBeNull();
    expect(startPips(m)).toEqual([]);
    expect(startRows(m)).toEqual([]);
  });

  it('marks the start pip and tags its stage; placed-out quests are known, not done', () => {
    const m = build([], [result({ placedOutQuestIds: LETTERS })]);
    expect(m.start).toEqual({ stage: 'stage1', questId: 'quest:stage1-life-q1' });
    expect(startPips(m)).toEqual(['quest:stage1-life-q1']);
    expect(startRows(m)).toEqual(['stage1']);
    expect(row(m, 'stage1')?.pips.map((p) => p.state)).toEqual(['known', 'known', 'known', 'open', 'open', 'open', 'open', 'open']);
    expect(row(m, 'stage1')).toMatchObject({ done: 0, known: 3, here: true });
    expect(row(m, 'stage1')?.cells[0]?.state).toBe('known');
    expect(m.cursor?.questId).toBe('quest:stage1-life-q1');
  });

  it('stays fixed while quests are completed', () => {
    const placements = [result({ placedOutQuestIds: LETTERS })];
    const before = build([], placements);
    const after = build(['quest:stage1-life-q1', 'quest:stage1-life-q2', 'quest:stage1-rites-q1'], placements);
    expect(after.start).toEqual(before.start);
    expect(startPips(after)).toEqual(['quest:stage1-life-q1']);
    expect(row(after, 'stage1')?.pips.find((p) => p.isStart)?.state).toBe('done');
    expect(after.cursor?.questId).toBe('quest:stage1-nature-q1');
  });

  it('a finished placed-out quest is done, never known', () => {
    const m = build(['quest:stage1-letters-q2'], [result({ placedOutQuestIds: LETTERS })]);
    expect(row(m, 'stage1')?.pips.slice(0, 3).map((p) => p.state)).toEqual(['known', 'done', 'known']);
    expect(row(m, 'stage1')).toMatchObject({ done: 1, known: 2 });
  });

  it('moves later with a higher retake and never earlier with a lower one', () => {
    const first = result({ placedOutQuestIds: LETTERS });
    const higher = result({ level: { stage: 'stage1', band: 3 }, placedOutQuestIds: [...LETTERS, 'quest:stage1-life-q1', 'quest:stage1-life-q2'] });
    const lower = result({ placedOutQuestIds: ['quest:stage1-letters-q1'] });
    expect(build([], [first]).start?.questId).toBe('quest:stage1-life-q1');
    expect(build([], [first, higher]).start?.questId).toBe('quest:stage1-rites-q1');
    expect(build([], [first, higher, lower]).start?.questId).toBe('quest:stage1-rites-q1');
  });

  it('a grown-up override moves it, even earlier, and puts the quests after it back to open', () => {
    const placed = result({ level: { stage: 'stage2', band: 0 }, placedOutQuestIds: STAGE1_8 });
    const overridden = result({ override: { by: 'parent', at: '2026-10-10T11:00:00.000Z', startQuestId: 'quest:stage1-letters-q2' } });
    const m = build([], [placed, overridden]);
    expect(m.start).toEqual({ stage: 'stage1', questId: 'quest:stage1-letters-q2' });
    expect(row(m, 'stage1')?.pips.map((p) => p.state)).toEqual(['known', 'open', 'open', 'open', 'open', 'open', 'open', 'open']);
    expect(row(m, 'stage1')?.state).toBe('open');
  });

  it('a learner placed into Stage 2: the start is the first Stage 2 quest, Stage 1 reads known, here is Stage 2', () => {
    const m = build([], [result({ level: { stage: 'stage2', band: 0 }, placedOutQuestIds: STAGE1_8 })]);
    expect(m.start).toEqual({ stage: 'stage2', questId: 'quest:stage2-life-q1' });
    expect(startRows(m)).toEqual(['stage2']);
    expect(row(m, 'stage1')).toMatchObject({ state: 'known', known: 8, done: 0, isStart: false, latched: false });
    expect(row(m, 'stage2')?.here).toBe(true);
    expect(m.latchesToWrite).toEqual([]);
  });

  it('the start pip in a latched stage sits in the new group and is still marked', () => {
    const placements = [result({ placedOutQuestIds: STAGE1_8 })];
    const m = build(STAGE1_8.slice(0, 1), placements, BUNDLE_15, {
      snapshot: snapshotWith(STAGE1_8.slice(0, 1), { placements, stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z' } }),
    });
    expect(m.start?.stage).toBe('stage1');
    expect(row(m, 'stage1')?.newPips.filter((p) => p.isStart)).toHaveLength(1);
    expect(startRows(m)).toEqual(['stage1']);
  });
});

describe('beyondContent and needsStage', () => {
  const ALL_GRID = BUNDLE_8.quests.map((q) => q.id);

  it('placed past every quest: no start quest, the tag sits on the highest stage with a known pip, hero beyond', () => {
    const m = build([], [result({ level: { stage: 'stage4', band: 0 }, beyondContent: true, placedOutQuestIds: ALL_GRID })]);
    expect(m.start).toEqual({ stage: 'stage4', questId: null });
    expect(startRows(m)).toEqual(['stage4']);
    expect(startPips(m)).toEqual([]);
    expect(m.cursor).toBeNull();
    expect(m.hero).toBe('beyond');
    // `here` follows the one start marker, never back to Stage 1 (section 3.3).
    expect(m.stages.filter((s) => s.here).map((s) => s.stage)).toEqual(['stage4']);
  });

  it('placed at a stage the tier lacks: rest wording, never beyond; the tag stays on the known stage', () => {
    const isEntitled = (stage: StageKey): boolean => stage === 'stage1';
    const m = build([], [result({ level: { stage: 'stage4', band: 0 }, placedOutQuestIds: STAGE1_8 })], BUNDLE_8, { isEntitled });
    expect(m.cursor).toBeNull();
    expect(m.hero).toBe('rest');
    expect(m.start).toEqual({ stage: 'stage1', questId: null });
    expect(m.stages.filter((s) => s.here).map((s) => s.stage)).toEqual(['stage1']);
  });

  it('here sits on the start tag when the start quest is held by a stage above Stage 1 and nothing is done', () => {
    const placements = [result({ level: { stage: 'stage4', band: 0 }, beyondContent: true, placedOutQuestIds: ALL_GRID })];
    const m = build([], placements);
    const tagged = m.stages.filter((s) => s.isStart).map((s) => s.stage);
    expect(m.stages.filter((s) => s.here).map((s) => s.stage)).toEqual(tagged);
  });

  it('keeps the start where it was while the learner finishes the placed-out quests', () => {
    const placements = [result({ level: { stage: 'stage4', band: 0 }, beyondContent: true, placedOutQuestIds: ALL_GRID })];
    expect(build(ALL_GRID, placements).start).toEqual({ stage: 'stage4', questId: null });
  });
});

describe('the start follows today\'s bundle and tier (section 3.6)', () => {
  it('a quest that joins the bundle before the old start becomes the start (it was never placed out)', () => {
    // Placed out as of the 8-quest bundle: letters 1-3 and life 1-2; the start was rites q1.
    const placements = [result({ placedOutQuestIds: [...LETTERS, 'quest:stage1-life-q1', 'quest:stage1-life-q2'] })];
    expect(build([], placements, BUNDLE_8).start).toEqual({ stage: 'stage1', questId: 'quest:stage1-rites-q1' });
    // The 15-quest bundle adds life q3 ahead of rites q1 in route order.
    expect(build([], placements, BUNDLE_15).start).toEqual({ stage: 'stage1', questId: 'quest:stage1-life-q3' });
  });

  it('a wider tier moves the start from the stage-only tag to the first quest the learner may now play', () => {
    const placements = [result({ level: { stage: 'stage4', band: 0 }, placedOutQuestIds: STAGE1_8 })];
    const stage1Only = (stage: StageKey): boolean => stage === 'stage1';
    expect(build([], placements, BUNDLE_8, { isEntitled: stage1Only }).start).toEqual({ stage: 'stage1', questId: null });
    const wider = build([], placements, BUNDLE_8);
    expect(wider.start?.questId).not.toBeNull();
    expect(wider.start?.stage).not.toBe('stage1');
  });
});

describe('the hero with a start marker', () => {
  it('continue, not start, when a start marker exists and nothing is done yet', () => {
    expect(build([], [result({ placedOutQuestIds: LETTERS })]).hero).toBe('continue');
  });

  it('start for a learner with no placement and nothing done', () => {
    expect(build([], []).hero).toBe('start');
  });
});

describe('startMarkerOf', () => {
  const order = routeOrder({ catalog: catalogOf(BUNDLE_8), episodes: BUNDLE_8.episodes, quests: BUNDLE_8.quests });

  it('null without a route', () => {
    expect(startMarkerOf(null, order)).toBeNull();
  });

  it('null when the route names nothing the bundle holds', () => {
    expect(startMarkerOf(seed(['quest:removed-long-ago'], { startQuestId: 'quest:removed' }), order)).toBeNull();
  });

  it('falls back to the highest placed-out stage when the start quest is not in the bundle', () => {
    expect(startMarkerOf(seed(STAGE1_8, { startQuestId: 'quest:removed' }), order)).toEqual({ stage: 'stage1', questId: null });
  });
});

describe('summary.journey carries known from the level check (R-7a)', () => {
  it('journeySummaryOf builds the route from the stored placements', () => {
    const bundle = BUNDLE_8;
    const placements = [result({ level: { stage: 'stage2', band: 0 }, placedOutQuestIds: STAGE1_8 })];
    const summary = journeySummaryOf(snapshotWith(['quest:stage1-letters-q1'], { placements }), {
      catalog: catalogOf(bundle),
      episodes: bundle.episodes,
      quests: bundle.quests,
      cards: [],
      stages: STAGE_DEFS,
      themes: THEME_DEFS,
      isEntitled: everyone,
    }, new Date('2026-10-11T00:00:00.000Z'));
    expect(summary?.stages[0]).toEqual({ stage: 'stage1', state: 'known', done: 1, known: 7, total: 8 });
    expect(summary?.here).toBe('stage2');
  });

  it('a learner placed past every quest uploads here on the start stage, not Stage 1', () => {
    const bundle = BUNDLE_8;
    const placements = [result({ level: { stage: 'stage4', band: 0 }, beyondContent: true, placedOutQuestIds: bundle.quests.map((q) => q.id) })];
    const summary = journeySummaryOf(snapshotWith([], { placements }), {
      catalog: catalogOf(bundle),
      episodes: bundle.episodes,
      quests: bundle.quests,
      cards: [],
      stages: STAGE_DEFS,
      themes: THEME_DEFS,
      isEntitled: everyone,
    }, new Date('2026-10-11T00:00:00.000Z'));
    expect(summary?.here).toBe('stage4');
    expect(summary?.seeded).toBe(true);
  });
});
