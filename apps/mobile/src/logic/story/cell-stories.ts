import type { Episode, StageKey, ThemeKey } from '@hangul-route/content-schema';
import { gridEpisodes } from '../../content/episodes';
import { cellModel, isPlayable } from '../journey-cells';
import { homeCellOf, type HomeCell } from './home-cell';
import { entriesForCell, type StoryIndexEntry } from './story-index';

/**
 * The cell page and its two doors (F-STORY-005 §3.6; wireframes `story/cell-stories.md` B and
 * `episode/detail-cell-stories-row.md` C). Pure: the screen reads the bundle and paints the result.
 */

/** Which door opened the cell page, for `journey.cell_stories_opened`. */
export type CellStoriesSource = 'cell' | 'lesson-row' | 'story-pill';

export interface CellStoriesView {
  stage: StageKey;
  theme: ThemeKey;
  /** The cell's lesson or book, listed first so it is never hidden; null for a stories-only or empty cell. */
  lessonEpisodeId: string | null;
  /** Which the first row names: "the lesson" or (a Stage 5 book cell, PR 5.6) "the book" for this cell. */
  lessonKind: 'lesson' | 'book' | null;
  /** The stories whose home is the cell, in shelf order (the index's review gate applied). */
  entries: StoryIndexEntry[];
}

export function cellStoriesView(i: {
  stage: StageKey;
  theme: ThemeKey;
  episodes: readonly Episode[];
  index: readonly StoryIndexEntry[];
}): CellStoriesView {
  const cell = cellModel({ stage: i.stage, theme: i.theme, episodes: gridEpisodes(i.episodes), storyEntries: i.index, quests: [] });
  return {
    stage: i.stage,
    theme: i.theme,
    lessonEpisodeId: cell.episodeId ?? null,
    lessonKind: cell.kind === 'lesson' || cell.kind === 'book' ? cell.kind : null,
    entries: entriesForCell(i.index, i.stage, i.theme),
  };
}

/**
 * The back history through the cell page (review of PR 5.5b). React Navigation 6's `navigate` goes back to
 * any earlier route of the same name and replaces its params, so a tile that navigated to `EpisodeDetail`
 * turned the lesson page under the cell page into the story page and dropped the cell page from Back.
 *
 * - `CellStories` has a route id (`getId`, one entry per cell; the door is not part of it): the lesson
 *   row and a story's pill return to that cell's page when it is in the stack, and push it otherwise.
 * - `EpisodeDetail` has no id (Culture notes pushes a second copy of a page on purpose, and an id would
 *   move the first copy instead), so the cell page opens episodes with `episodeOpenFromCellPage`.
 */
export function cellStoriesRouteId(params: { stage: StageKey; theme: ThemeKey }): string {
  return `${params.stage}:${params.theme}`;
}

/**
 * How the cell page opens an episode (a tile or its lesson row): Back when the page right under it is
 * that same episode (lesson > row > lesson row; story > pill > that story's tile), so the stack never
 * grows without end; otherwise push, so Back returns to the cell page.
 */
export function episodeOpenFromCellPage(
  under: { name: string; params?: object } | undefined,
  episodeId: string,
): 'back' | 'push' {
  const params = under?.params as { episodeId?: unknown } | undefined;
  return under?.name === 'EpisodeDetail' && params?.episodeId === episodeId ? 'back' : 'push';
}

/**
 * What makes one open of the cell page: the cell and the door. A door tapped again while its cell page
 * is still on top (a double tap before the transition ends) brings equal params, the same key, and no
 * second `journey.cell_stories_opened`. The page clears its last key when it loses focus, so a later
 * return through a door (a story's pill) is a new open.
 */
export function cellStoriesOpenKey(params: { stage: string; theme: string; source: CellStoriesSource }): string {
  return `${params.stage}:${params.theme}:${params.source}`;
}

/** Sent once each time the cell page opens: ids and counts only (§3.11). */
export function cellStoriesOpenedEvent(
  view: Pick<CellStoriesView, 'stage' | 'theme' | 'entries'>,
  source: CellStoriesSource,
): { name: 'journey.cell_stories_opened'; payload: { stageKey: StageKey; themeKey: ThemeKey; stories: number; source: CellStoriesSource } } {
  return {
    name: 'journey.cell_stories_opened',
    payload: { stageKey: view.stage, themeKey: view.theme, stories: view.entries.length, source },
  };
}

/**
 * The count on a lesson page's "Heritage stories for this cell" row; 0 hides the row. Only a playable
 * grid episode's page has the row: a preview page keeps its coming-soon card, and a story page has its
 * home-cell pill instead.
 */
export function lessonRowCount(
  episode: Pick<Episode, 'stage' | 'theme' | 'status' | 'placement'>,
  index: readonly StoryIndexEntry[],
): number {
  if (episode.placement === 'shelf') return 0;
  if (!isPlayable(episode)) return 0;
  return entriesForCell(index, episode.stage, episode.theme).length;
}

/** A one-story shelf page's home cell, for its plain "Stage 2 · Letters" pill; null on a book page. */
export function homeCellLink(entries: readonly Pick<StoryIndexEntry, 'placement' | 'story'>[]): HomeCell | null {
  const [only, ...rest] = entries;
  if (!only || rest.length > 0 || only.placement !== 'shelf') return null;
  return homeCellOf(only.story);
}
