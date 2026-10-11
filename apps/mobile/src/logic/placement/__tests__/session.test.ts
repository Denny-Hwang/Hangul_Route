import { apply, startRun, type PlacementConfig, type RouteCatalog } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { PLACEMENT_BANK } from '../../../content/placement.generated';
import { completedAtOf, newResponse, resultRoutes, rungPosition, startTarget } from '../session';
import { placementResult } from './fixtures';

const CONFIG: PlacementConfig = {
  mode: 'standard',
  revealMode: 'tap',
  audio: true,
  visual: true,
  takeMyTime: true,
  seed: 11,
  exclude: [],
  resolvesPicture: () => true,
};

describe('rungPosition and newResponse', () => {
  it('follows the open question through its rung', () => {
    const first = startRun(PLACEMENT_BANK, CONFIG, 0);
    expect(rungPosition(first)).toEqual({ gate: 'recog', form: 'decode', indexInRung: 0 });
    const second = apply(first, { type: 'notSure' }, 1_000);
    expect(rungPosition(second)?.indexInRung).toBe(1);
    expect(newResponse(first, second)).toMatchObject({ outcome: 'skipped', chosenOptionId: null, ms: 1_000 });
  });

  it('an event that records nothing gives no response; a finished run has no rung', () => {
    const first = startRun(PLACEMENT_BANK, CONFIG, 0);
    const touched = apply(first, { type: 'touch' }, 10);
    expect(newResponse(first, touched)).toBeNull();
    const quit = apply(first, { type: 'quit', by: 'learner' }, 20);
    expect(rungPosition(quit)).toBeNull();
  });
});

describe('resultRoutes and startTarget (section 3.7)', () => {
  const catalog: RouteCatalog = {
    quests: [
      { id: 'quest:q1', episodeId: 'episode:e1', stage: 'stage1', theme: 'letters', order: 1, teaches: [], playable: true, grid: true },
      { id: 'quest:q2', episodeId: 'episode:e1', stage: 'stage1', theme: 'letters', order: 2, teaches: [], playable: true, grid: true },
    ],
  };
  const opts = { isEntitled: () => true, completedQuestIds: new Set<string>() };

  it('a first check has no route before it', () => {
    const { before, after } = resultRoutes([], placementResult(), catalog, opts);
    expect(before).toBeNull();
    expect(after.startQuestId).toBe('quest:q1');
    expect(startTarget(after)).toEqual({ questId: 'quest:q1', episodeId: 'episode:e1' });
  });

  it('a retake compares with the stored route', () => {
    const earlier = placementResult({ id: 'placement:old', placedOutQuestIds: ['quest:q1'] });
    const { before, after } = resultRoutes([earlier], placementResult({ id: 'placement:new' }), catalog, opts);
    expect(before?.placedOutQuestIds).toEqual(['quest:q1']);
    expect(after.placedOutQuestIds).toEqual(['quest:q1']);
  });

  it('no start quest means no Start target', () => {
    const { after } = resultRoutes([], placementResult(), { quests: [] }, opts);
    expect(startTarget(after)).toBeNull();
  });
});

describe('completedAtOf', () => {
  it('now for a live run, the saved stop for a run recorded on reopening', () => {
    expect(completedAtOf('live', 1_000, 2_000)).toBe(new Date(2_000).toISOString());
    expect(completedAtOf('finish', 1_000, 2_000)).toBe(new Date(1_000).toISOString());
  });
});
