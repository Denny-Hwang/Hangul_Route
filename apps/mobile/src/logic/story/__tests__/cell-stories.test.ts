import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { Episode } from '@hangul-route/content-schema';
import { TELEMETRY_EVENT_NAMES } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { cellStoriesOpenedEvent, cellStoriesRouteId, cellStoriesView, episodeOpenFromCellPage, homeCellLink, lessonRowCount } from '../cell-stories';
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

/**
 * The back history through the cell page (review of PR 5.5b). React Navigation 6's `navigate` goes back
 * to any earlier route of the same name and replaces its params, so "lesson > stories row > tile" turned
 * the lesson page into the story page and dropped the cell page. This drives the app's own StackRouter
 * (`@react-navigation/routers`, reached through native > core) the way the screens call it.
 */
describe('the back history through the cell page', () => {
  type Params = Record<string, unknown> | undefined;
  interface NavRoute {
    name: string;
    params?: Params;
  }
  interface NavState {
    index: number;
    routes: NavRoute[];
  }
  interface Router {
    getInitialState(o: object): NavState;
    getStateForAction(s: NavState, a: object, o: object): NavState | null;
  }
  const requireFrom = (from: string) => createRequire(from);
  const native = requireFrom(__filename).resolve('@react-navigation/native');
  const core = requireFrom(native).resolve('@react-navigation/core');
  const routers = requireFrom(core)('@react-navigation/routers') as {
    StackRouter: (o: object) => Router;
    CommonActions: { navigate: (name: string, params?: object) => object; goBack: () => object };
    StackActions: { push: (name: string, params?: object) => object };
  };
  const routeNames = ['Main', 'EpisodeDetail', 'CellStories', 'CultureNotes'];

  /** `fixed`: the root stack as built (a `CellStories` id, the cell page's own opener); else the first cut. */
  function stack(fixed: boolean) {
    const router = routers.StackRouter({});
    const routeGetIdList = fixed
      ? { CellStories: ({ params }: { params?: Params }) => cellStoriesRouteId(params as { stage: 'stage1'; theme: 'letters' }) }
      : {};
    const options = { routeNames, routeParamList: {}, routeGetIdList };
    let state = router.getInitialState(options);
    const apply = (action: object): void => {
      state = router.getStateForAction(state, action, options) ?? state;
    };
    return {
      navigate: (name: string, params?: object) => apply(routers.CommonActions.navigate(name, params)),
      push: (name: string, params?: object) => apply(routers.StackActions.push(name, params)),
      back: () => apply(routers.CommonActions.goBack()),
      /** A tile or the lesson row on the cell page (`CellStoriesScreen.openEpisode`). */
      openFromCell: (episodeId: string) => {
        if (!fixed) return apply(routers.CommonActions.navigate('EpisodeDetail', { episodeId }));
        if (episodeOpenFromCellPage(state.routes[state.index - 1], episodeId) === 'back') apply(routers.CommonActions.goBack());
        else apply(routers.StackActions.push('EpisodeDetail', { episodeId }));
      },
      trail: () => state.routes.map((r) => `${r.name}${r.params ? `(${Object.values(r.params).slice(0, 2).join('/')})` : ''}`),
    };
  }
  const LESSON = { episodeId: 'episode:s1-letters' };
  const STORY = { episodeId: 'episode:shelf-hangeul-day' };
  const CELL = { stage: 'stage1', theme: 'letters', source: 'lesson-row' };

  it('one cell page per cell (the door is not part of the id)', () => {
    expect(cellStoriesRouteId({ stage: 'stage2', theme: 'life' })).toBe('stage2:life');
  });

  it('the cell page goes Back only to the same episode right under it, else pushes', () => {
    expect(episodeOpenFromCellPage({ name: 'EpisodeDetail', params: LESSON }, LESSON.episodeId)).toBe('back');
    expect(episodeOpenFromCellPage({ name: 'EpisodeDetail', params: STORY }, LESSON.episodeId)).toBe('push');
    expect(episodeOpenFromCellPage({ name: 'Main' }, LESSON.episodeId)).toBe('push');
    expect(episodeOpenFromCellPage(undefined, LESSON.episodeId)).toBe('push');
  });

  it('the first cut: a tile on the cell page replaced the lesson page (the bug)', () => {
    const nav = stack(false);
    nav.navigate('EpisodeDetail', LESSON);
    nav.navigate('CellStories', CELL);
    nav.openFromCell(STORY.episodeId);
    expect(nav.trail()).toEqual(['Main', 'EpisodeDetail(episode:shelf-hangeul-day)']);
  });

  it('lesson > stories row > tile: Back shows the cell page, then the lesson page', () => {
    const nav = stack(true);
    nav.navigate('EpisodeDetail', LESSON);
    nav.navigate('CellStories', CELL);
    nav.openFromCell(STORY.episodeId);
    expect(nav.trail()).toEqual([
      'Main',
      'EpisodeDetail(episode:s1-letters)',
      'CellStories(stage1/letters)',
      'EpisodeDetail(episode:shelf-hangeul-day)',
    ]);
    nav.back();
    expect(nav.trail().at(-1)).toBe('CellStories(stage1/letters)');
    nav.back();
    expect(nav.trail().at(-1)).toBe('EpisodeDetail(episode:s1-letters)');
  });

  it("the cell page's lesson row and a story's pill go back to the page they came from, so the stack never grows", () => {
    const nav = stack(true);
    nav.navigate('EpisodeDetail', LESSON);
    nav.navigate('CellStories', CELL);
    nav.openFromCell(LESSON.episodeId);
    expect(nav.trail()).toEqual(['Main', 'EpisodeDetail(episode:s1-letters)']);

    nav.navigate('CellStories', CELL);
    nav.openFromCell(STORY.episodeId);
    nav.navigate('CellStories', { ...CELL, source: 'story-pill' });
    expect(nav.trail()).toEqual(['Main', 'EpisodeDetail(episode:s1-letters)', 'CellStories(stage1/letters)']);
  });

  it('Library story page > pill > cell page > lesson row keeps the story page under it', () => {
    const nav = stack(true);
    nav.navigate('EpisodeDetail', STORY);
    nav.navigate('CellStories', { ...CELL, source: 'story-pill' });
    nav.openFromCell(LESSON.episodeId);
    expect(nav.trail()).toEqual([
      'Main',
      'EpisodeDetail(episode:shelf-hangeul-day)',
      'CellStories(stage1/letters)',
      'EpisodeDetail(episode:s1-letters)',
    ]);
  });

  it("a cell page lower in the stack is not reused for another cell", () => {
    const nav = stack(true);
    nav.navigate('CellStories', { stage: 'stage2', theme: 'letters', source: 'cell' });
    nav.openFromCell(STORY.episodeId);
    nav.navigate('CellStories', CELL);
    expect(nav.trail()).toEqual(['Main', 'CellStories(stage2/letters)', 'EpisodeDetail(episode:shelf-hangeul-day)', 'CellStories(stage1/letters)']);
  });

  it("EpisodeDetail keeps no id: Culture notes' push of the same page still stacks a second copy", () => {
    const nav = stack(true);
    nav.navigate('EpisodeDetail', STORY);
    nav.push('CultureNotes', { storyId: 'story:hangeul-day' });
    nav.push('EpisodeDetail', STORY);
    expect(nav.trail()).toEqual([
      'Main',
      'EpisodeDetail(episode:shelf-hangeul-day)',
      'CultureNotes(story:hangeul-day)',
      'EpisodeDetail(episode:shelf-hangeul-day)',
    ]);
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

  it('the route, its id and its three doors', () => {
    expect(read('navigation/types.ts')).toMatch(/CellStories: \{[^}]*source: CellStoriesSource/);
    const root = read('navigation/root.tsx');
    expect(root).toMatch(/name="CellStories"[^>]*getId=\{cellStoriesRouteIdOf\}/);
    expect(root).not.toMatch(/name="EpisodeDetail"[^>]*getId/);
    // The cell page opens episodes with push or Back (episodeOpenFromCellPage), never navigate.
    expect(screen).toContain('episodeOpenFromCellPage(');
    expect(screen).toContain("navigation.push('EpisodeDetail'");
    expect(screen).not.toContain("navigate('EpisodeDetail'");
    expect(read('screens/journey/JourneyScreen.tsx')).toMatch(/'CellStories',[^)]*source: 'cell'/);
    const detail = read('screens/episode/EpisodeDetailView.tsx');
    expect(detail).toMatch(/onOpenCellStories\([^)]*'lesson-row'\)/);
    expect(detail).toMatch(/onOpenCellStories\([^)]*'story-pill'\)/);
    expect(read('screens/episode/StoryEpisodeDetail.tsx')).toContain('homeCellLink(');
  });

  it('one playable rule: the lesson-page row counts only on a page the map would open (review of PR 5.5b)', () => {
    expect(read('logic/story/cell-stories.ts')).toMatch(/!isPlayable\(episode\)/);
    expect(read('logic/story/cell-stories.ts')).not.toMatch(/status !== 'shipped'/);
  });

  it('the open event is keyed on the open, not on the profile id resolving later (review of PR 5.5b)', () => {
    const effect = screen.slice(screen.indexOf('cellStoriesOpenedEvent(view, source)'));
    const deps = /\}, \[([^\]]*)\]\);/.exec(effect)?.[1] ?? '';
    expect(deps).toBe('route.params');
    expect(screen).toContain('profileIdRef.current');
  });

  it('the Library sections and the cell page share one tile grid', () => {
    expect(read('screens/library/StoryShelf.tsx')).toContain('<StoryTileGrid');
  });
});
