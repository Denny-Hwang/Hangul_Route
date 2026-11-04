import { cellChunkName, isLaterCellId, storyChunkName } from '../logic/offline/offline-packs';
import { isOnline } from '../platform/online';
import { offlinePacks } from '../store/offline-packs-store';
import { VOLUME_TWO_STORY_IDS } from './books';
import { LESSON_CELL_CHUNKS } from './__generated__/lessons-index';
import { STORY_SHELF } from './__generated__/stories-index';

/**
 * Which body chunks are core and which are later (F-CURR-002 §10 item 4, row CM-5B). Core chunks (Volume 1, Stage 1,
 * every shelf and book 1 tale) are precached, so they load offline. Later chunks (a cell's Volume 2, a tale only a book
 * 2 holds) are cached the first time they are used or when a grown-up saves their stage; offline, only the ones on the
 * device load. The whole-catalogue screens and the background load read this, so a learner who never opens a Volume 2
 * never downloads one, and an offline grown-up root never waits on a chunk it cannot get.
 */

/** The tales only a book 2 holds (a new tale, never a shelf story that joined a book 2 through its read tier). */
export const LATER_STORY_IDS: ReadonlySet<string> = VOLUME_TWO_STORY_IDS;

const cellIds = Object.keys(LESSON_CELL_CHUNKS);
const storyIds = STORY_SHELF.map((e) => e.id);

export const CORE_CELLS: readonly string[] = cellIds.filter((id) => !isLaterCellId(id));
export const LATER_CELLS: readonly string[] = cellIds.filter(isLaterCellId);
export const CORE_STORIES: readonly string[] = storyIds.filter((id) => !LATER_STORY_IDS.has(id));
export const LATER_STORIES: readonly string[] = storyIds.filter((id) => LATER_STORY_IDS.has(id));

/** The later cell's chunk is on the device (always on native). */
export const cellOpensOffline = (cellId: string): boolean => !isLaterCellId(cellId) || offlinePacks.getState().opensOffline(cellChunkName(cellId));
/** The story's chunk is on the device (always on native, and for every core tale). */
export const storyOpensOffline = (storyId: string): boolean => !LATER_STORY_IDS.has(storyId) || offlinePacks.getState().opensOffline(storyChunkName(storyId));

export interface ContentScope {
  core: { cells: readonly string[]; stories: readonly string[] };
  /** The later chunks to load now: with `whenOnline`, every one while online; otherwise only those on the device. */
  later: (whenOnline: boolean) => { cells: string[]; stories: string[] };
}

export function contentScope(online: () => boolean = isOnline): ContentScope {
  return {
    core: { cells: CORE_CELLS, stories: CORE_STORIES },
    later: (whenOnline) => {
      const all = whenOnline && online();
      return { cells: LATER_CELLS.filter((id) => all || cellOpensOffline(id)), stories: LATER_STORIES.filter((id) => all || storyOpensOffline(id)) };
    },
  };
}
