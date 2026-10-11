import { describe, expect, it } from 'vitest';
import {
  buildStoryIndex,
  compareShelfOrder,
  defaultStoryIndex,
  entryForQuest,
  entryForStory,
  shelfEntries,
} from '../story-index';
import { storyMinigameRef } from '../story-ref';
import { bookEpisode, questId, shelfEpisode, story, storyQuest, unreviewed } from './shelf-fixture';

const sun = story('sun-and-moon', { theme: 'nature', minutes: 5, shelf: { category: 'story-time', order: 2, minutes: 5 } });
const seollal = story('seollal-new-year', { theme: 'rites', shelf: { category: 'culture', order: 1 } });
const hangul = story('hangul-day', { shelf: { category: 'story-time', order: 1 } });

describe('buildStoryIndex', () => {
  it('builds one shelf entry per story quest with the §3.1 fields', () => {
    const index = buildStoryIndex({
      stories: [sun],
      episodes: [shelfEpisode(sun)],
      quests: [storyQuest('sun-and-moon')],
      showUnreviewed: false,
    });
    expect(index).toEqual([
      {
        storyId: 'story:sun-and-moon',
        story: sun,
        questId: 'quest:story-sun-and-moon-listen',
        episodeId: 'episode:shelf-sun-and-moon',
        level: 'listen',
        placement: 'shelf',
        category: 'story-time',
        order: 2,
        minutes: 5,
        theme: 'nature',
      },
    ]);
  });

  it('gives a grid (book) entry no category and the episode order', () => {
    const book = bookEpisode('episode:stage5-letters', [questId('hangul-day', 'read-along')], { order: 7 });
    const [entry] = buildStoryIndex({
      stories: [hangul],
      episodes: [book],
      quests: [storyQuest('hangul-day', 'read-along')],
      showUnreviewed: false,
    });
    expect(entry).toMatchObject({ placement: 'grid', category: null, order: 7, level: 'read-along', episodeId: book.id });
  });

  it('treats an episode without `placement` as grid', () => {
    const { placement: _omit, ...legacy } = bookEpisode('episode:stage5-letters', [questId('hangul-day')]);
    const [entry] = buildStoryIndex({ stories: [hangul], episodes: [legacy], quests: [storyQuest('hangul-day')], showUnreviewed: false });
    expect(entry?.placement).toBe('grid');
  });

  it('keeps several entries for one story (shelf Listen + book Read)', () => {
    const index = buildStoryIndex({
      stories: [hangul],
      episodes: [shelfEpisode(hangul), bookEpisode('episode:stage5-letters', [questId('hangul-day', 'read-along')])],
      quests: [storyQuest('hangul-day'), storyQuest('hangul-day', 'read-along')],
      showUnreviewed: false,
    });
    expect(index.map((e) => [e.placement, e.level])).toEqual([
      ['shelf', 'listen'],
      ['grid', 'read-along'],
    ]);
  });

  it('skips draft and preview episodes', () => {
    const index = buildStoryIndex({
      stories: [sun, hangul],
      episodes: [shelfEpisode(sun, { status: 'draft' }), shelfEpisode(hangul, { status: 'preview' })],
      quests: [storyQuest('sun-and-moon'), storyQuest('hangul-day')],
      showUnreviewed: false,
    });
    expect(index).toEqual([]);
  });

  it('keeps ready and shipped episodes', () => {
    const index = buildStoryIndex({
      stories: [sun, hangul],
      episodes: [shelfEpisode(sun, { status: 'ready' }), shelfEpisode(hangul, { status: 'shipped' })],
      quests: [storyQuest('sun-and-moon'), storyQuest('hangul-day')],
      showUnreviewed: false,
    });
    expect(index).toHaveLength(2);
  });

  it('ignores missing refs: unknown quest, non-story quest, unknown story, missing level', () => {
    const lesson = { id: 'quest:meet-the-letters', steps: [{ id: 'a', kind: 'discover' as const, titleEn: 'Hi' }] };
    const ghostStory = {
      id: 'quest:story-ghost-listen',
      steps: [{ id: 'r', kind: 'practice' as const, titleEn: 'Read', minigameKind: 'story-read' as const, minigameRef: storyMinigameRef('read', 'listen', 'story:ghost') }],
    };
    // The fixture story has listen and read-along tiers only.
    const index = buildStoryIndex({
      stories: [hangul],
      episodes: [
        bookEpisode('episode:stage5-letters', [
          'quest:not-bundled',
          lesson.id,
          ghostStory.id,
          questId('hangul-day', 'read'),
        ]),
      ],
      quests: [lesson, ghostStory, storyQuest('hangul-day', 'read')],
      showUnreviewed: false,
    });
    expect(index).toEqual([]);
  });

  it('hides a story that is not both native-reviewed and culture-reviewed (D14)', () => {
    for (const which of ['language', 'culture', 'both'] as const) {
      const draft = unreviewed(sun, which);
      const args = { stories: [draft], episodes: [shelfEpisode(draft)], quests: [storyQuest('sun-and-moon')] };
      expect(buildStoryIndex({ ...args, showUnreviewed: false }), which).toEqual([]);
      expect(buildStoryIndex({ ...args, showUnreviewed: true }), which).toHaveLength(1);
    }
  });

  it('a shelf entry of a story without a shelf block has no category and falls back to the story minutes', () => {
    const bare = story('sun-and-moon', { minutes: 6, shelf: null });
    const [entry] = buildStoryIndex({
      stories: [bare],
      episodes: [shelfEpisode(bare, { order: 140 })],
      quests: [storyQuest('sun-and-moon')],
      showUnreviewed: false,
    });
    expect(entry).toMatchObject({ placement: 'shelf', category: null, order: 140, minutes: 6 });
  });

  it('follows episode order, then the quest order inside an episode', () => {
    const index = buildStoryIndex({
      stories: [sun, hangul],
      episodes: [bookEpisode('episode:stage5-letters', [questId('sun-and-moon'), questId('hangul-day')])],
      quests: [storyQuest('hangul-day'), storyQuest('sun-and-moon')],
      showUnreviewed: false,
    });
    expect(index.map((e) => e.storyId)).toEqual(['story:sun-and-moon', 'story:hangul-day']);
  });
});

describe('lookups', () => {
  const index = buildStoryIndex({
    stories: [sun, seollal, hangul],
    episodes: [
      bookEpisode('episode:stage5-letters', [questId('hangul-day', 'read-along')]),
      shelfEpisode(sun),
      shelfEpisode(seollal),
      shelfEpisode(hangul),
    ],
    quests: [storyQuest('sun-and-moon'), storyQuest('seollal-new-year'), storyQuest('hangul-day'), storyQuest('hangul-day', 'read-along')],
    showUnreviewed: false,
  });

  it('shelfEntries lists one category in shelf order', () => {
    expect(shelfEntries(index, 'story-time').map((e) => e.storyId)).toEqual(['story:hangul-day', 'story:sun-and-moon']);
    expect(shelfEntries(index, 'culture').map((e) => e.storyId)).toEqual(['story:seollal-new-year']);
  });

  it('entryForQuest finds the entry of a quest, or undefined', () => {
    expect(entryForQuest(index, questId('hangul-day', 'read-along'))?.placement).toBe('grid');
    expect(entryForQuest(index, 'quest:nope')).toBeUndefined();
  });

  it('entryForStory prefers the shelf entry, else the first entry, else undefined', () => {
    expect(entryForStory(index, 'story:hangul-day')?.placement).toBe('shelf');
    const gridOnly = index.filter((e) => e.placement === 'grid');
    expect(entryForStory(gridOnly, 'story:hangul-day')?.level).toBe('read-along');
    expect(entryForStory(index, 'story:nope')).toBeUndefined();
  });

  it('compareShelfOrder: shelf before grid, Story Time before Culture, then order', () => {
    const sorted = [...index].sort(compareShelfOrder).map((e) => `${e.placement}:${e.storyId}`);
    expect(sorted).toEqual([
      'shelf:story:hangul-day',
      'shelf:story:sun-and-moon',
      'shelf:story:seollal-new-year',
      'grid:story:hangul-day',
    ]);
  });

  it('compareShelfOrder puts an uncategorised shelf entry after the categories', () => {
    const bare = story('bare', { shelf: null });
    const odd = buildStoryIndex({
      stories: [bare, seollal],
      episodes: [shelfEpisode(bare, { order: 1 }), shelfEpisode(seollal)],
      quests: [storyQuest('bare'), storyQuest('seollal-new-year')],
      showUnreviewed: false,
    });
    expect([...odd].sort(compareShelfOrder).map((e) => e.storyId)).toEqual(['story:seollal-new-year', 'story:bare']);
  });
});

describe('defaultStoryIndex', () => {
  it('is built once from the bundle and memoised', () => {
    const first = defaultStoryIndex();
    expect(defaultStoryIndex()).toBe(first);
    // Tests run with the launch flags: `showUnreviewedStories` is off, so only reviewed stories are indexed.
    const reviewed = (e: (typeof first)[number]) =>
      e.story.review.language === 'native-reviewed' && e.story.review.culture === 'culture-reviewed';
    expect(first.every(reviewed)).toBe(true);
  });
});
