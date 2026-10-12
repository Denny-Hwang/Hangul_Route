import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Episode } from '@hangul-route/content-schema';
import { TELEMETRY_EVENT_NAMES } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { cellStoriesOpenedEvent, cellStoriesView, homeCellLink, lessonRowCount } from '../cell-stories';
import { buildStoryIndex } from '../story-index';
import { bookEpisode, questId, shelfEpisode, shelfIndex, story, storyQuest } from './shelf-fixture';

/**
 * F-STORY-005 PR 5.5b §3.6: the cell page (its lesson first, then the cell's stories in shelf order),
 * the lesson page's stories row, the story page's home-cell pill and `journey.cell_stories_opened`.
 */

const lesson = (id: string, stage: Episode['stage'], theme: Episode['theme'], status: Episode['status'] = 'shipped'): Episode => ({
  id: `episode:${id}`,
  stage,
  theme,
  order: 1,
  titleEn: id,
  hoyaIntroEn: 'hi',
  questIds: [`quest:${id}-q1`],
  rewardCardIds: [],
  estimatedMinutes: 5,
  status,
});

const S1_LETTERS = lesson('s1-letters', 'stage1', 'letters');
const S2_LETTERS = lesson('stage2-letters', 'stage2', 'letters', 'preview');
const sejong = story('sejong-new-letters', { recommendedStage: 1, theme: 'letters', shelf: { order: 2 } });
const hangulDay = story('hangeul-day', { recommendedStage: 1, theme: 'letters', shelf: { order: 1 } });
const jikji = story('jikji-metal-type', { recommendedStage: 2, theme: 'letters', shelf: { order: 3 } });
const INDEX = shelfIndex([sejong, hangulDay, jikji]);
const EPISODES: Episode[] = [S1_LETTERS, S2_LETTERS, ...[sejong, hangulDay, jikji].map((s) => shelfEpisode(s))];

describe('cellStoriesView', () => {
  it('a lesson cell: the lesson first, then its stories in shelf order', () => {
    const view = cellStoriesView({ stage: 'stage1', theme: 'letters', episodes: EPISODES, index: INDEX });
    expect(view.lessonEpisodeId).toBe('episode:s1-letters');
    expect(view.entries.map((e) => e.storyId)).toEqual(['story:hangeul-day', 'story:sejong-new-letters']);
  });

  it('a stories-only cell has no lesson row', () => {
    const view = cellStoriesView({ stage: 'stage2', theme: 'letters', episodes: EPISODES, index: INDEX });
    expect(view.lessonEpisodeId).toBeNull();
    expect(view.entries.map((e) => e.storyId)).toEqual(['story:jikji-metal-type']);
  });

  it('a book cell names the book as its lesson', () => {
    const book = bookEpisode('episode:stage5-letters', [questId('x', 'read-along')]);
    const view = cellStoriesView({ stage: 'stage5', theme: 'letters', episodes: [book], index: INDEX });
    expect(view.lessonEpisodeId).toBe('episode:stage5-letters');
    expect(view.entries).toEqual([]);
  });

  it('a stale link to an empty cell: no lesson, no story', () => {
    const view = cellStoriesView({ stage: 'stage7', theme: 'crafts', episodes: EPISODES, index: INDEX });
    expect(view).toEqual({ stage: 'stage7', theme: 'crafts', lessonEpisodeId: null, entries: [] });
  });
});

describe('cellStoriesOpenedEvent', () => {
  it('ids and counts only, with the entry that opened the page', () => {
    const view = cellStoriesView({ stage: 'stage1', theme: 'letters', episodes: EPISODES, index: INDEX });
    for (const source of ['cell', 'lesson-row', 'story-pill'] as const) {
      expect(cellStoriesOpenedEvent(view, source)).toEqual({
        name: 'journey.cell_stories_opened',
        payload: { stageKey: 'stage1', themeKey: 'letters', stories: 2, source },
      });
    }
  });

  it('is a listed telemetry name', () => {
    expect(TELEMETRY_EVENT_NAMES).toContain(cellStoriesOpenedEvent(cellStoriesView({ stage: 'stage1', theme: 'life', episodes: [], index: [] }), 'cell').name);
  });
});

describe('lessonRowCount', () => {
  it('the number of stories whose home is the lesson’s cell', () => {
    expect(lessonRowCount(S1_LETTERS, INDEX)).toBe(2);
    expect(lessonRowCount(lesson('s1-life', 'stage1', 'life'), INDEX)).toBe(0);
  });

  it('0 on a preview, draft or shelf episode: the row is only on a lesson page', () => {
    expect(lessonRowCount(S2_LETTERS, INDEX)).toBe(0);
    expect(lessonRowCount(lesson('d', 'stage1', 'letters', 'draft'), INDEX)).toBe(0);
    expect(lessonRowCount(shelfEpisode(sejong), INDEX)).toBe(0);
  });

  it('applies the review gate of the index', () => {
    expect(lessonRowCount(S1_LETTERS, [])).toBe(0);
  });
});

describe('homeCellLink', () => {
  it('a one-story shelf page links to its story’s home cell', () => {
    const entries = INDEX.filter((e) => e.storyId === 'story:jikji-metal-type');
    expect(homeCellLink(entries)).toEqual({ stage: 'stage2', theme: 'letters' });
  });

  it('no link for a book page or an empty page', () => {
    const book = bookEpisode('episode:stage5-letters', [questId('jikji-metal-type', 'read-along')]);
    const bookIndex = buildStoryIndex({
      stories: [story('jikji-metal-type', { recommendedStage: 2, theme: 'letters', shelf: null })],
      episodes: [book],
      quests: [storyQuest('jikji-metal-type', 'read-along')],
      showUnreviewed: false,
    });
    expect(bookIndex).toHaveLength(1);
    expect(homeCellLink(bookIndex)).toBeNull();
    expect(homeCellLink([])).toBeNull();
    expect(homeCellLink(INDEX)).toBeNull();
  });
});

describe('cell page sources (screens are covered by Playwright; these pin the wiring)', () => {
  const SRC = join(__dirname, '..', '..', '..');
  const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');
  const screen = read('screens/story/CellStoriesScreen.tsx');

  it('the cell page names its design, reuses the Library tiles and sends its one event', () => {
    expect(screen).toMatch(/design\/wireframes\/story\/cell-stories\.md/);
    expect(screen).toContain('<StoryTileGrid');
    expect(screen).toContain('cellStoriesOpenedEvent(view, source)');
    expect(screen).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    expect(screen).not.toMatch(/tone="primary"/);
  });

  it('the route and its three doors', () => {
    expect(read('navigation/types.ts')).toContain('CellStories: { stage: StageKey; theme: ThemeKey; source: CellStoriesSource };');
    expect(read('navigation/root.tsx')).toContain('<Stack.Screen name="CellStories" component={CellStoriesScreen} />');
    expect(read('screens/journey/JourneyScreen.tsx')).toContain("navigation.navigate('CellStories', { stage, theme, source: 'cell' })");
    const detail = read('screens/episode/EpisodeDetailView.tsx');
    expect(detail).toContain("onOpenCellStories(episode.stage, episode.theme, 'lesson-row')");
    expect(detail).toContain("onOpenCellStories(stage, theme, 'story-pill')");
    expect(read('screens/episode/StoryEpisodeDetail.tsx')).toContain('homeCellLink(sourceEntries)');
  });

  it('the Library sections and the cell page share one tile grid', () => {
    expect(read('screens/library/StoryShelf.tsx')).toContain('<StoryTileGrid');
  });
});
