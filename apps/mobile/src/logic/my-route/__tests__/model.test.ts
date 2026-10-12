import { describe, expect, it } from 'vitest';
import { effectiveRoute, type ProgressSnapshot, type StageKey } from '@hangul-route/content-schema';
import { buildMyRoute } from '../model';
import type { MyRouteInput, SeenRecord } from '../types';
import { BUNDLE_15, BUNDLE_8, STAGE1_8, STAGE_DEFS, THEME_DEFS, catalogOf, snapshotWith, type Bundle } from './fixtures/bundle-2026-10';
import { result, seed } from './fixtures/route';

const CARDS = [
  { id: 'card:hunminjeongeum', unlockedBy: 'stage1-complete' },
  { id: 'card:other', unlockedBy: 'quest:stage1-letters-q1' },
];

const inputOf = (snapshot: ProgressSnapshot, over: Partial<MyRouteInput> = {}, bundle: Bundle = BUNDLE_8): MyRouteInput => ({
  snapshot,
  catalog: catalogOf(bundle),
  episodes: bundle.episodes,
  quests: bundle.quests,
  cards: CARDS,
  stages: STAGE_DEFS,
  themes: THEME_DEFS,
  isEntitled: () => true,
  route: null,
  now: new Date('2026-10-11T12:00:00.000Z'),
  ...over,
});
const build = (done: string[], over: Partial<MyRouteInput> = {}, bundle: Bundle = BUNDLE_8, extra: Partial<ProgressSnapshot> = {}) =>
  buildMyRoute(inputOf(snapshotWith(done, extra), over, bundle));
const row = (m: ReturnType<typeof buildMyRoute>, stage: StageKey) => m.stages.find((s) => s.stage === stage);
const states = (m: ReturnType<typeof buildMyRoute>, stage: StageKey) => row(m, stage)?.pips.map((p) => p.state);

describe('buildMyRoute (F-ROUTE-001 section 3.18 behaviours, frozen fixtures)', () => {
  it('a new learner: hero start, Stage 1 here and open with ring pips, the rest as the table says', () => {
    const m = build([]);
    expect(m.hero).toBe('start');
    expect(m.cursor).toEqual({ questId: 'quest:stage1-letters-q1', episodeId: 'episode:stage1-letters', stage: 'stage1' });
    expect(m.stages).toHaveLength(7);
    expect(m.stages.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(m.stages.map((s) => s.state)).toEqual(['open', 'open', 'later', 'open', 'later', 'later', 'later']);
    expect(m.stages.map((s) => s.availability)).toEqual(['open', 'taste', 'soon', 'taste', 'soon', 'soon', 'soon']);
    expect(m.stages.filter((s) => s.here).map((s) => s.stage)).toEqual(['stage1']);
    expect(states(m, 'stage1')).toEqual(Array(8).fill('open'));
    expect(row(m, 'stage1')?.title).toBe('Hangul');
    expect(m.trailReached).toBe(0);
    expect(m.skills.map((s) => s.marks)).toEqual([0, 0, 0]);
    expect(m.gains).toEqual({ stars: 0, cards: 0, storiesRead: 0 });
    expect(m.start).toBeNull();
    expect(m.latchesToWrite).toEqual([]);
    expect(m.stages.every((s) => !s.isStart && !s.latched && s.newPips.length === 0 && s.newSinceSeen === 0)).toBe(true);
  });

  it('Appendix C: letters q1..q3 and life q1 done', () => {
    const m = build(['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3', 'quest:stage1-life-q1'], {}, BUNDLE_8, {
      cards: [{ cardId: 'card:x', unlockedAt: 't', newSinceLastView: false }],
    });
    expect(m.hero).toBe('continue');
    expect(m.cursor?.questId).toBe('quest:stage1-life-q2');
    expect(states(m, 'stage1')).toEqual(['done', 'done', 'done', 'done', 'open', 'open', 'open', 'open']);
    expect(row(m, 'stage1')?.pips.filter((p) => p.isCursor).map((p) => p.questId)).toEqual(['quest:stage1-life-q2']);
    expect(row(m, 'stage1')).toMatchObject({ state: 'open', here: true, done: 4, known: 0 });
    expect(states(m, 'stage2')).toEqual(['open', 'open', 'later', 'later', 'later']);
    expect(states(m, 'stage4')).toEqual(['open', 'later', 'later', 'later', 'later']);
    expect(m.skills).toEqual([
      { skill: 'read', marks: 3, nextReachable: true, quests: 4 },
      { skill: 'listen', marks: 3, nextReachable: true, quests: 4 },
      { skill: 'write', marks: 1, nextReachable: false, quests: 1 },
    ]);
    expect(m.tiles).toBe(2);
    expect(m.gains).toEqual({ stars: 4, cards: 1, storiesRead: 0 });
    expect(m.trailReached).toBe(0);
  });

  it('Stage 1 latched at 8 of 8, then 7 quests join: the earned group stays full, the new ones are their own group', () => {
    const seen: SeenRecord = { totals: { stage1: 8 }, doneKeys: [], at: '2026-10-01T00:00:00.000Z' };
    const m = build(STAGE1_8, { seen }, BUNDLE_15, { stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z' } });
    const s1 = row(m, 'stage1');
    expect(s1?.state).toBe('complete');
    expect(s1?.latched).toBe(true);
    expect(s1?.pips.map((p) => p.state)).toEqual(Array(8).fill('done'));
    expect(s1?.newPips.map((p) => p.state)).toEqual(Array(7).fill('new'));
    expect(s1?.newSinceSeen).toBe(7);
    expect(s1?.done).toBe(8);
    expect(m.cursor?.questId).toBe('quest:stage1-life-q3');
    expect(m.latchesToWrite).toEqual([]);
  });

  it('a stage complete by the derived rule and not latched yet is named in latchesToWrite', () => {
    const m = build(STAGE1_8);
    expect(row(m, 'stage1')?.state).toBe('complete');
    expect(row(m, 'stage1')?.latched).toBe(false);
    expect(m.latchesToWrite).toEqual(['stage1']);
    expect(m.cursor?.stage).toBe('stage2');
    expect(row(m, 'stage2')?.here).toBe(true);
  });

  it('a learner placed into Stage 2: Stage 1 reads known, nothing is awarded, here moves past it', () => {
    const m = build([], { route: seed(STAGE1_8, { level: { stage: 'stage2', band: 0 } }) });
    const s1 = row(m, 'stage1');
    expect(s1?.state).toBe('known');
    expect(s1?.pips.map((p) => p.state)).toEqual(Array(8).fill('known'));
    expect(s1).toMatchObject({ done: 0, known: 8, here: false, latched: false });
    expect(m.latchesToWrite).toEqual([]);
    expect(row(m, 'stage2')?.here).toBe(true);
    expect(m.cursor?.questId).toBe('quest:stage2-life-q1');
    expect(m.trailReached).toBe(0);
    // R-7a: a start marker exists (the seed names no start quest, so the tag sits on the known stage), so the hero is continue.
    expect(m.start).toEqual({ stage: 'stage1', questId: null });
    expect(m.hero).toBe('continue');
    expect(m.skills.every((s) => s.quests === 0)).toBe(true);
  });

  it('Stage 2 with both shipped cells done reads explored, never complete', () => {
    const m = build(['quest:stage2-life-q1', 'quest:stage2-nature-q1']);
    expect(row(m, 'stage2')?.state).toBe('explored');
    expect(m.latchesToWrite).toEqual([]);
    expect(m.trailReached).toBe(1);
  });

  it('a grown-up override puts quests back: known returns to open, done stays, the trail does not retract', () => {
    const catalog = catalogOf(BUNDLE_8);
    const opts = { isEntitled: () => true, completedQuestIds: new Set<string>() };
    const done = ['quest:stage1-letters-q1'];
    const placed = [result({ level: { stage: 'stage4', band: 0 }, placedOutQuestIds: [...STAGE1_8, 'quest:stage2-life-q1', 'quest:stage2-nature-q1'] })];
    const before = build(done, { route: effectiveRoute(placed, catalog, opts) }, BUNDLE_8, { placements: placed });
    expect(before.trailReached).toBe(1);
    expect(row(before, 'stage1')?.state).toBe('known');

    const overridden = [...placed, result({ override: { by: 'parent', at: 't', startQuestId: 'quest:stage1-life-q1' } })];
    const after = build(done, { route: effectiveRoute(overridden, catalog, opts) }, BUNDLE_8, { placements: overridden });
    expect(states(after, 'stage1')).toEqual(['done', 'known', 'known', 'open', 'open', 'open', 'open', 'open']);
    expect(states(after, 'stage2')?.slice(0, 2)).toEqual(['open', 'open']);
    expect(after.trailReached).toBe(1);
    expect(after.cursor?.questId).toBe('quest:stage1-life-q1');
  });

  it('an override naming a quest the bundle does not hold moves nothing', () => {
    const placed = [result({ override: { by: 'parent', at: 't', startQuestId: 'quest:removed' } })];
    const m = build([], { route: seed([]) }, BUNDLE_8, { placements: placed });
    expect(m.trailReached).toBe(0);
    expect(m.stages.every((s) => s.known === 0)).toBe(true);
  });

  it('ignores placed-out ids the bundle does not hold, and a snapshot written before placements existed', () => {
    const placed = [result({ placedOutQuestIds: ['quest:removed-long-ago'] })];
    expect(build([], { route: seed(['quest:removed-long-ago']) }, BUNDLE_8, { placements: placed }).trailReached).toBe(0);
    const old = snapshotWith(['quest:stage2-life-q1']);
    delete old.placements;
    expect(buildMyRoute(inputOf(old, { route: seed([]) })).trailReached).toBe(1);
  });

  it('owning the stage card keeps a stage complete even before the latch is written', () => {
    const m = build(['quest:stage1-letters-q1'], {}, BUNDLE_15, { cards: [{ cardId: 'card:hunminjeongeum', unlockedAt: 't', newSinceLastView: false }] });
    expect(row(m, 'stage1')?.state).toBe('complete');
    expect(m.latchesToWrite).toEqual([]);
  });

  it('a stage whose only playable cell is ready (not shipped) is open with its pips, never coming later', () => {
    const ready: Bundle = {
      episodes: BUNDLE_8.episodes.map((e) =>
        e.id === 'episode:stage3-letters' ? { ...e, questIds: ['quest:stage1-letters-q1'], status: 'ready' as const } : e,
      ),
      quests: BUNDLE_8.quests,
    };
    const m = build([], {}, ready);
    expect(row(m, 'stage3')?.availability).toBe('soon');
    expect(row(m, 'stage3')?.state).toBe('open');
    expect(row(m, 'stage3')?.cells[0]?.pips.map((p) => p.kind)).toEqual(['quest']);
  });

  it('falls back to the stage key when no stage definition is given', () => {
    expect(build([], { stages: [] }).stages.map((s) => s.title)).toEqual(['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7']);
  });

  it('ignores stageDoneAt keys that are not stage keys', () => {
    const m = build([], {}, BUNDLE_8, { stageDoneAt: { stage9: '2026-10-01T00:00:00.000Z' } });
    expect(m.stages.every((s) => !s.latched)).toBe(true);
  });
});

describe('hero at rest', () => {
  const all = BUNDLE_8.quests.map((q) => q.id);
  it('rest when no cursor is left', () => {
    const m = build(all);
    expect(m.hero).toBe('rest');
    expect(m.cursor).toBeNull();
    expect(row(m, 'stage4')?.here).toBe(true);
  });

  it('beyond when the level check placed past the content', () => {
    expect(build(all, { route: seed([], { beyondContent: true }) }).hero).toBe('beyond');
  });

  it('rest wording when placed at a stage the tier lacks', () => {
    expect(build(all, { route: seed([], { beyondContent: true, needsStage: 'stage3' }) }).hero).toBe('rest');
  });

  it('rest when nothing is offerable and nothing is done', () => {
    const m = build([], { isEntitled: () => false });
    expect(m.hero).toBe('rest');
    expect(m.stages.map((s) => s.state)).toEqual(Array(7).fill('later'));
    expect(row(m, 'stage1')?.here).toBe(true);
  });

  it('here falls back to the start quest stage when nothing is done and nothing is offerable', () => {
    const m = build([], { isEntitled: () => false, route: seed([], { startQuestId: 'quest:stage2-life-q1' }) });
    expect(row(m, 'stage2')?.here).toBe(true);
  });
});

describe('tier changes', () => {
  it('an unentitled stage reads later and its quests are later pips; done pips stay', () => {
    const m = build(['quest:stage2-life-q1'], { isEntitled: (s) => s === 'stage1' });
    expect(states(m, 'stage2')).toEqual(['done', 'later', 'later', 'later', 'later']);
    expect(row(m, 'stage2')?.state).toBe('open');
    expect(row(m, 'stage4')?.state).toBe('later');
    expect(m.skills.find((s) => s.skill === 'read')?.nextReachable).toBe(true);
  });
});
