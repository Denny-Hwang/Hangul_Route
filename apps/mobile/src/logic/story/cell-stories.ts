import type { Episode, StageKey, ThemeKey } from '@hangul-route/content-schema';
import { gridEpisodes } from '../../content/episodes';
import { cellModel } from '../journey-cells';
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
    entries: entriesForCell(i.index, i.stage, i.theme),
  };
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
  if (episode.status !== 'shipped' && episode.status !== 'ready') return 0;
  return entriesForCell(index, episode.stage, episode.theme).length;
}

/** A one-story shelf page's home cell, for its plain "Stage 2 · Letters" pill; null on a book page. */
export function homeCellLink(entries: readonly Pick<StoryIndexEntry, 'placement' | 'story'>[]): HomeCell | null {
  const [only, ...rest] = entries;
  if (!only || rest.length > 0 || only.placement !== 'shelf') return null;
  return homeCellOf(only.story);
}
