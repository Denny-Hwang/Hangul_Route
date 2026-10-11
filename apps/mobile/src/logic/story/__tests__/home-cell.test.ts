import { describe, expect, it } from 'vitest';
import { StageKeySchema, ThemeKeySchema, type StoryShelf } from '@hangul-route/content-schema';
import { homeCellOf, isHomeCell } from '../home-cell';
import { buildStoryIndex, entriesForCell } from '../story-index';
import { bookEpisode, questId, shelfEpisode, story, storyQuest, unreviewed } from './shelf-fixture';

/** F-STORY-005 §3.2: a shelf story's home cell is (`stage<recommendedStage>`, theme); metadata, never capacity. */
describe('homeCellOf', () => {
  it('maps every recommended stage 1-7 to its stage key and keeps the theme', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      expect(homeCellOf({ recommendedStage: n, theme: 'rites' })).toEqual({ stage: `stage${n}`, theme: 'rites' });
    }
  });

  it('reads a whole story', () => {
    expect(homeCellOf(story('jikji-metal-type', { recommendedStage: 2, theme: 'letters' }))).toEqual({
      stage: 'stage2',
      theme: 'letters',
    });
  });

  it('refuses a recommended stage outside the 7 stages (the story schema already forbids it)', () => {
    expect(() => homeCellOf({ recommendedStage: 0, theme: 'letters' })).toThrow();
    expect(() => homeCellOf({ recommendedStage: 8, theme: 'letters' })).toThrow();
  });
});

describe('isHomeCell', () => {
  it('agrees with homeCellOf for every stage and theme', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      const s = { recommendedStage: n, theme: 'rites' as const };
      const home = homeCellOf(s);
      for (const stage of StageKeySchema.options) {
        for (const theme of ThemeKeySchema.options) {
          expect(isHomeCell(s, stage, theme), `${n} ${stage}:${theme}`).toBe(home.stage === stage && home.theme === theme);
        }
      }
    }
  });
});

describe('entriesForCell', () => {
  const shelf = (category: StoryShelf['category'], order: number): Partial<StoryShelf> => ({ category, order });
  const sejong = story('sejong-new-letters', { recommendedStage: 1, theme: 'letters', shelf: shelf('culture', 1) });
  const hangulDay = story('hangeul-day', { recommendedStage: 1, theme: 'letters', shelf: shelf('culture', 3) });
  const shapes = story('shapes-of-hangeul', { recommendedStage: 1, theme: 'letters', shelf: shelf('culture', 2) });
  const tale = story('letters-tale', { recommendedStage: 1, theme: 'letters', shelf: shelf('story-time', 9) });
  const jikji = story('jikji-metal-type', { recommendedStage: 2, theme: 'letters', shelf: shelf('culture', 9) });
  const seollal = story('seollal-new-year', { recommendedStage: 1, theme: 'rites', shelf: shelf('story-time', 1) });
  const all = [sejong, hangulDay, shapes, tale, jikji, seollal];

  const indexOf = (stories: typeof all, showUnreviewed: boolean, extra: Parameters<typeof buildStoryIndex>[0]['episodes'] = []) =>
    buildStoryIndex({
      stories,
      episodes: [...stories.map((s) => shelfEpisode(s)), ...extra],
      quests: [...stories.map((s) => storyQuest(s.id.replace(/^story:/, ''))), storyQuest('hangeul-day', 'read-along')],
      showUnreviewed,
    });

  it('lists the shelf entries whose home cell is the cell, in shelf order (Story Time first, then order)', () => {
    const index = indexOf(all, false);
    expect(entriesForCell(index, 'stage1', 'letters').map((e) => e.storyId)).toEqual([
      'story:letters-tale',
      'story:sejong-new-letters',
      'story:shapes-of-hangeul',
      'story:hangeul-day',
    ]);
    expect(entriesForCell(index, 'stage2', 'letters').map((e) => e.storyId)).toEqual(['story:jikji-metal-type']);
    expect(entriesForCell(index, 'stage1', 'rites').map((e) => e.storyId)).toEqual(['story:seollal-new-year']);
  });

  it('uses the recommended stage, not the shelf episode stage (every shelf episode sits in stage1)', () => {
    const index = indexOf(all, false);
    expect(index.find((e) => e.storyId === jikji.id)?.stage).toBe('stage1');
    expect(entriesForCell(index, 'stage1', 'letters').some((e) => e.storyId === jikji.id)).toBe(false);
  });

  it('returns an empty list for a cell no story calls home', () => {
    expect(entriesForCell(indexOf(all, false), 'stage7', 'crafts')).toEqual([]);
    expect(entriesForCell([], 'stage1', 'letters')).toEqual([]);
  });

  it('leaves out a book (grid) entry: it is the cell episode, not a story whose home cell this is', () => {
    const book = bookEpisode('episode:stage5-letters', [questId('hangeul-day', 'read-along')]);
    const fiveLetters = story('hangeul-day', { recommendedStage: 5, theme: 'letters', shelf: shelf('culture', 3) });
    const index = indexOf([fiveLetters], false, [book]);
    expect(index.map((e) => e.placement)).toEqual(['shelf', 'grid']);
    expect(entriesForCell(index, 'stage5', 'letters').map((e) => [e.placement, e.level])).toEqual([['shelf', 'listen']]);
  });

  it('applies the review gate of the index: unreviewed stories count only when the gate is widened', () => {
    const draftShapes = unreviewed(shapes);
    const stories = [sejong, draftShapes, hangulDay];
    expect(entriesForCell(indexOf(stories, false), 'stage1', 'letters').map((e) => e.storyId)).toEqual([
      'story:sejong-new-letters',
      'story:hangeul-day',
    ]);
    expect(entriesForCell(indexOf(stories, true), 'stage1', 'letters').map((e) => e.storyId)).toEqual([
      'story:sejong-new-letters',
      'story:shapes-of-hangeul',
      'story:hangeul-day',
    ]);
  });

  it('does not reorder the index it is given', () => {
    const index = indexOf(all, false);
    const before = index.map((e) => e.storyId);
    entriesForCell(index, 'stage1', 'letters');
    expect(index.map((e) => e.storyId)).toEqual(before);
  });
});
