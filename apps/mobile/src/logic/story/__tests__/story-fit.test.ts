import { describe, expect, it } from 'vitest';
import { StageKeySchema, type Episode, type StageKey } from '@hangul-route/content-schema';
import { emptyBookmarks } from '../bookmarks';
import { placementStageOf, reachedStage, stageNumber, storyFit, storyFitsFor, storyFitsForSnapshot } from '../story-fit';
import { shelfEntries } from '../story-index';
import { pickedForYou, pickStoryForHome, type StoryPickInput } from '../story-pick';
import { bookEpisode, questId, shelfEpisode, shelfIndex, snapshot, story } from './shelf-fixture';

const at = (day: number): string => `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`;

/** A grid (lesson) episode; only `stage`, `placement` and `questIds` matter here. */
const lesson = (id: string, stage: Episode['stage'], questIds: string[]): Episode =>
  bookEpisode(id, questIds, { stage, format: 'lesson' });

const GRID: Episode[] = [
  lesson('episode:stage1-letters', 'stage1', ['quest:s1-a', 'quest:s1-b']),
  lesson('episode:stage2-letters', 'stage2', ['quest:s2-a']),
  lesson('episode:stage4-letters', 'stage4', ['quest:s4-a']),
];

const done = (...ids: string[]) => snapshot(ids.map((id, i) => ({ questId: id, completedAt: at(i + 1) })));

/** A stored level-check result at `stage`; only `level` is read. */
const placed = (stage: StageKey) => ({ level: { stage, band: 1 } });

describe('stageNumber', () => {
  it('reads the number of every stage key', () => {
    StageKeySchema.options.forEach((key, i) => expect(stageNumber(key)).toBe(i + 1));
    expect(stageNumber('stage3')).toBe(3);
  });
});

describe('reachedStage', () => {
  it('is 1 for a learner who has played nothing, with or without a snapshot', () => {
    expect(reachedStage(snapshot([]), GRID)).toBe(1);
    expect(reachedStage(undefined, GRID)).toBe(1);
  });

  it('is the highest stage with at least one completed grid quest', () => {
    expect(reachedStage(done('quest:s1-a'), GRID)).toBe(1);
    expect(reachedStage(done('quest:s1-a', 'quest:s2-a'), GRID)).toBe(2);
    // One quest is enough; stage 3 has no episode and is skipped over.
    expect(reachedStage(done('quest:s4-a'), GRID)).toBe(4);
  });

  it('ignores a started but unfinished quest', () => {
    expect(reachedStage(snapshot([{ questId: 'quest:s2-a' }]), GRID)).toBe(1);
  });

  it('counts grid episodes only: a finished shelf story quest never raises it', () => {
    const shelfStory = story('stage5-tale', { recommendedStage: 5 });
    const withShelf = [...GRID, shelfEpisode(shelfStory, { stage: 'stage5' })];
    expect(reachedStage(done(questId('stage5-tale')), withShelf)).toBe(1);
  });

  it('a quest listed in grid episodes of two stages counts for the higher stage, in either order', () => {
    const low = lesson('episode:stage2-review', 'stage2', ['quest:shared']);
    const high = lesson('episode:stage4-review', 'stage4', ['quest:shared']);
    expect(reachedStage(done('quest:shared'), [high, low])).toBe(4);
    expect(reachedStage(done('quest:shared'), [low, high])).toBe(4);
  });

  it('a quest id no episode lists counts for nothing', () => {
    expect(reachedStage(done('quest:retired'), GRID)).toBe(1);
  });

  it('placement (the level-check stage) raises it and never lowers it', () => {
    expect(reachedStage(snapshot([]), GRID, 3)).toBe(3);
    expect(reachedStage(done('quest:s4-a'), GRID, 2)).toBe(4);
    expect(reachedStage(snapshot([]), GRID, undefined)).toBe(1);
  });

  it('stays within stages 1 to 7 whatever placement it is given', () => {
    expect(reachedStage(snapshot([]), GRID, 0)).toBe(1);
    expect(reachedStage(snapshot([]), GRID, 12)).toBe(7);
  });
});

describe('storyFit', () => {
  it('ready up to one stage above the reached stage, stretch beyond', () => {
    expect(storyFit(1, 1)).toBe('ready');
    expect(storyFit(2, 1)).toBe('ready');
    expect(storyFit(3, 1)).toBe('stretch');
    expect(storyFit(5, 4)).toBe('ready');
    expect(storyFit(6, 4)).toBe('stretch');
    expect(storyFit(1, 7)).toBe('ready');
  });
});

describe('placementStageOf', () => {
  it('is undefined without a stored result', () => {
    expect(placementStageOf(undefined)).toBeUndefined();
    expect(placementStageOf([])).toBeUndefined();
  });

  it('is the highest stage any stored result placed the learner at (the effective level)', () => {
    expect(placementStageOf([placed('stage2')])).toBe(2);
    expect(placementStageOf([placed('stage3'), placed('stage1')])).toBe(3);
  });
});

describe('storyFitsFor', () => {
  const s1 = story('s1', { recommendedStage: 1 });
  const s2 = story('s2', { recommendedStage: 2 });
  const s3 = story('s3', { recommendedStage: 3 });

  it('a new learner: stories that recommend stage 2 or lower fit, stage 3+ do not', () => {
    const fits = storyFitsFor({ snapshot: snapshot([]), episodes: GRID });
    expect(fits({ story: s1 })).toBe(true);
    expect(fits({ story: s2 })).toBe(true);
    expect(fits({ story: s3 })).toBe(false);
  });

  it('follows grid progress and the level-check result', () => {
    expect(storyFitsFor({ snapshot: done('quest:s2-a'), episodes: GRID })({ story: s3 })).toBe(true);
    expect(storyFitsFor({ snapshot: undefined, episodes: GRID, placements: [placed('stage2')] })({ story: s3 })).toBe(true);
  });
});

describe('storyFitsForSnapshot (the fits Home and the Library hero pass)', () => {
  const s2 = story('s2', { recommendedStage: 2 });
  const s3 = story('s3', { recommendedStage: 3 });
  const s6 = story('s6', { recommendedStage: 6 });

  it('without a snapshot, only stories recommending stage 2 or lower fit', () => {
    const fits = storyFitsForSnapshot(undefined, GRID);
    expect(fits({ story: s2 })).toBe(true);
    expect(fits({ story: s3 })).toBe(false);
  });

  it('reads both grid progress and the stored level-check results of the snapshot', () => {
    expect(storyFitsForSnapshot(done('quest:s2-a'), GRID)({ story: s3 })).toBe(true);
    const placedAt5 = { ...snapshot([]), placements: [placed('stage5')] };
    expect(storyFitsForSnapshot(placedAt5, GRID)({ story: s6 })).toBe(true);
    expect(storyFitsForSnapshot({ ...snapshot([]), placements: [] }, GRID)({ story: s3 })).toBe(false);
  });

  it('defaults to the bundled episodes', () => {
    const fits = storyFitsForSnapshot(snapshot([]));
    expect(fits({ story: s2 })).toBe(true);
    expect(fits({ story: s6 })).toBe(false);
  });
});

/** Behaviour #3 (F-STORY-005 §3.14): fit only orders `pickedForYou` / `next`; it never removes a story. */
describe('fit ordering in the story pick', () => {
  // Shelf order puts the stage 3 and 4 stories first, so only fit can move the stage 1-2 ones ahead.
  const far = story('far', { recommendedStage: 4, shelf: { category: 'culture', order: 1 } });
  const stretch = story('stretch', { recommendedStage: 3, shelf: { category: 'culture', order: 2 } });
  const near = story('near', { recommendedStage: 2, shelf: { category: 'culture', order: 3 } });
  const first = story('first', { recommendedStage: 1, shelf: { category: 'culture', order: 4 } });
  const index = shelfIndex([far, stretch, near, first]);

  function input(patch: Partial<StoryPickInput> = {}): StoryPickInput {
    const snap = patch.snapshot ?? snapshot([]);
    return {
      entries: index,
      snapshot: snap,
      bookmarks: emptyBookmarks(),
      isLocked: () => false,
      fits: storyFitsFor({ snapshot: snap, episodes: GRID }),
      ...patch,
    };
  }

  it('a learner who has played nothing gets a story recommending stage 2 or lower first', () => {
    expect(pickedForYou({ ...input(), category: 'culture' })?.entry.storyId).toBe('story:near');
    expect(pickStoryForHome(input())?.entry.storyId).toBe('story:near');
  });

  it('once every fitting story is finished, the stretch stories follow in shelf order', () => {
    const snap = done(questId('near'), questId('first'));
    const fits = storyFitsFor({ snapshot: snap, episodes: GRID });
    expect(pickedForYou({ ...input({ snapshot: snap, fits }), category: 'culture' })?.entry.storyId).toBe('story:far');
  });

  it('the Library shelf ignores fit: a learner who has played nothing still sees all four, in shelf order', () => {
    const fits = storyFitsForSnapshot(snapshot([]), GRID);
    const listed = shelfEntries(index, 'culture');
    expect(listed.map((e) => e.storyId)).toEqual(['story:far', 'story:stretch', 'story:near', 'story:first']);
    expect(listed.filter((e) => !fits(e)).map((e) => e.storyId)).toEqual(['story:far', 'story:stretch']);
  });

  it('never removes a story: walking the pick through every finish offers all four', () => {
    const offered: string[] = [];
    let finished: string[] = [];
    for (let i = 0; i < index.length; i += 1) {
      const snap = done(...finished);
      const pick = pickedForYou({ ...input({ snapshot: snap, fits: storyFitsFor({ snapshot: snap, episodes: GRID }) }), category: 'culture' });
      expect(pick?.reason).toBe('next');
      offered.push(pick?.entry.storyId ?? '');
      finished = [...finished, pick?.entry.questId ?? ''];
    }
    expect(offered).toEqual(['story:near', 'story:first', 'story:far', 'story:stretch']);
  });
});
