import { STORY_SHELF_HASH, loadStoryShelf } from './__generated__/stories-index';
import { createStoryShelfSlot } from '../logic/story/story-shelf-load';
import type { StoryShelfChunk } from '../logic/story/story-chunk-store';
import { abandonPendingChunk } from '../platform/lesson-chunk-abandon';

/**
 * The story shelf on the web (F-CURR-002 §10, row CM-8b): a precached chunk of its own (`stories-shelf-<md5>.js`),
 * which `index.ts` loads before it evaluates the app (every story list, the shelf episodes and quests, the books
 * and the story cards are derived from it at module load). It comes from the precache in a frame or two; a
 * request that hangs past 15 s gives up its pending script, so Try again asks again. Reading it before it is in
 * throws: something that reads the stories was imported before the boot loaded the shelf.
 */
const slot = createStoryShelfSlot({
  load: loadStoryShelf,
  hash: STORY_SHELF_HASH,
  timeoutMs: 15_000,
  abandon: (bundleName) => {
    abandonPendingChunk(bundleName);
  },
});

export function storyShelf(): StoryShelfChunk {
  return slot.shelf();
}

export function isStoryShelfIn(): boolean {
  return slot.isIn();
}

export function ensureStoryShelf(): Promise<void> {
  return slot.ensure();
}
