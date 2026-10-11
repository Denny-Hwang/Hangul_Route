import { describe, expect, it } from 'vitest';
import { buildMyRoute } from '../model';
import { stagesToLatch, withStageLatches } from '../latch';
import { BUNDLE_15, BUNDLE_8, STAGE1_8, STAGE_DEFS, THEME_DEFS, catalogOf, snapshotWith } from './fixtures/bundle-2026-10';
import { seed } from './fixtures/route';

const NOW = new Date('2026-10-11T09:30:00.000Z');

describe('stagesToLatch (F-ROUTE-001 section 3.3, OD-6)', () => {
  it('names a stage on the transition to complete', () => {
    expect(stagesToLatch(snapshotWith(STAGE1_8.slice(0, 7)), BUNDLE_8.episodes)).toEqual([]);
    expect(stagesToLatch(snapshotWith(STAGE1_8), BUNDLE_8.episodes)).toEqual(['stage1']);
  });

  it('names it on the first run for a learner who completed the stage before the writer shipped', () => {
    const old = snapshotWith([...STAGE1_8, 'quest:stage2-life-q1']);
    delete old.stageDoneAt;
    expect(stagesToLatch(old, BUNDLE_8.episodes)).toEqual(['stage1']);
  });

  it('never names a latched stage again', () => {
    expect(stagesToLatch(snapshotWith(STAGE1_8, { stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z' } }), BUNDLE_8.episodes)).toEqual([]);
  });

  it('never names a taste stage, even when every shipped cell is done', () => {
    expect(stagesToLatch(snapshotWith(['quest:stage2-life-q1', 'quest:stage2-nature-q1', 'quest:stage4-rites-q1']), BUNDLE_8.episodes)).toEqual([]);
  });

  it('never names a stage the learner only knew from the level check', () => {
    const snapshot = snapshotWith([]);
    expect(stagesToLatch(snapshot, BUNDLE_8.episodes)).toEqual([]);
    const m = buildMyRoute({
      snapshot,
      catalog: catalogOf(BUNDLE_8),
      episodes: BUNDLE_8.episodes,
      quests: BUNDLE_8.quests,
      cards: [],
      stages: STAGE_DEFS,
      themes: THEME_DEFS,
      isEntitled: () => true,
      route: seed(STAGE1_8),
      now: NOW,
    });
    expect(m.stages[0]?.state).toBe('known');
    expect(m.latchesToWrite).toEqual([]);
  });

  it('is the rule the model reports as latchesToWrite', () => {
    for (const [bundle, done] of [
      [BUNDLE_8, STAGE1_8],
      [BUNDLE_15, STAGE1_8],
      [BUNDLE_8, []],
    ] as const) {
      const snapshot = snapshotWith([...done]);
      const m = buildMyRoute({
        snapshot,
        catalog: catalogOf(bundle),
        episodes: bundle.episodes,
        quests: bundle.quests,
        cards: [],
        stages: STAGE_DEFS,
        themes: THEME_DEFS,
        isEntitled: () => true,
        route: null,
        now: NOW,
      });
      expect(m.latchesToWrite).toEqual(stagesToLatch(snapshot, bundle.episodes));
    }
  });
});

describe('withStageLatches', () => {
  it('adds keys with toISOString() and bumps updatedAt', () => {
    const snapshot = snapshotWith(STAGE1_8);
    const next = withStageLatches(snapshot, ['stage1'], NOW);
    expect(next.stageDoneAt).toEqual({ stage1: '2026-10-11T09:30:00.000Z' });
    expect(next.updatedAt).toBe('2026-10-11T09:30:00.000Z');
    expect(snapshot.stageDoneAt).toBeUndefined();
  });

  it('only adds keys: an existing latch (and a key from a newer build) is never moved or removed', () => {
    const snapshot = snapshotWith(STAGE1_8, { stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z', stage9: 'later-build' } });
    const next = withStageLatches(snapshot, ['stage1', 'stage2'], NOW);
    expect(next.stageDoneAt).toEqual({ stage1: '2026-10-01T00:00:00.000Z', stage9: 'later-build', stage2: '2026-10-11T09:30:00.000Z' });
  });

  it('returns the same snapshot when there is nothing to add', () => {
    const snapshot = snapshotWith(STAGE1_8, { stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z' } });
    expect(withStageLatches(snapshot, ['stage1'], NOW)).toBe(snapshot);
    expect(withStageLatches(snapshot, [], NOW)).toBe(snapshot);
  });
});
