import { afterEach, describe, expect, it } from 'vitest';
import { isLaterCellId } from '../../logic/offline/offline-packs';
import { offlinePacks } from '../../store/offline-packs-store';
import { BOOK_DEFINITIONS } from '../books';
import { CORE_CELLS, CORE_STORIES, LATER_CELLS, LATER_STORIES, LATER_STORY_IDS, cellOpensOffline, contentScope, storyOpensOffline } from '../later-content';
import { LESSON_CELL_CHUNKS } from '../__generated__/lessons-index';
import { storyShelf } from '../story-shelf';

/** F-CURR-002 row CM-5B: which body chunks are core (precached) and which are later (cached on use, or saved). */
const initial = offlinePacks.getState();
afterEach(() => {
  offlinePacks.setState(initial, true);
});

describe('later content', () => {
  it('splits every cell and every shelf tale into core and later, with nothing lost', () => {
    expect([...CORE_CELLS, ...LATER_CELLS].sort()).toEqual(Object.keys(LESSON_CELL_CHUNKS).sort());
    expect(CORE_CELLS.some(isLaterCellId)).toBe(false);
    expect(LATER_CELLS.every(isLaterCellId)).toBe(true);
    expect([...CORE_STORIES, ...LATER_STORIES].sort()).toEqual(storyShelf().STORY_SHELF.map((e) => e.id).sort());
    // Every first volume is core: Stage 1, Volume 1 and every book 1 tale stay in the precache.
    for (const book of BOOK_DEFINITIONS.filter((b) => (b.volume ?? 1) === 1)) for (const id of book.storyIds) expect(LATER_STORY_IDS.has(id)).toBe(false);
    // A shelf story that joined the Letters book 2 through its read tier (row CM-46) stays core.
    expect(CORE_STORIES).toContain('story:tripitaka-koreana');
  });

  it('a core cell or tale always opens offline; a later one once the device holds it', () => {
    expect(cellOpensOffline('episode:stage2-nature')).toBe(true);
    expect(storyOpensOffline('story:sun-and-moon')).toBe(true);
    offlinePacks.setState({ opensOffline: (name: string) => name === 'lessons-cell-stage2-nature-v2' });
    expect(cellOpensOffline('episode:stage2-nature-v2')).toBe(true);
    expect(cellOpensOffline('episode:stage3-life-v2')).toBe(false);
  });

  it('the scope: core always; later every one while online for a root, else only those on the device', () => {
    offlinePacks.setState({ opensOffline: () => false });
    const off = contentScope(() => false);
    expect(off.core.cells).toBe(CORE_CELLS);
    expect(off.core.stories).toBe(CORE_STORIES);
    expect(off.later(true)).toEqual({ cells: [], stories: [] });
    const on = contentScope(() => true);
    expect(on.later(true)).toEqual({ cells: [...LATER_CELLS], stories: [...LATER_STORIES] });
    expect(on.later(false)).toEqual({ cells: [], stories: [] });
  });
});
