import * as generated from './__generated__/stories-shelf';
import type { StoryShelfChunk } from '../logic/story/story-chunk-store';

/**
 * The story shelf on native and in the tests (F-CURR-002 §10, row CM-8b): the shelf chunk is part of the one
 * bundle there, so it is imported statically and is in from the first line. The web build reads
 * `story-shelf.web.ts` instead, where `index.ts` loads the shelf chunk before the app's modules run.
 * The namespace read keeps the e2e build's optional exports (`STORY_INLINE_BODIES`, `STORY_FIXTURE_IDS`).
 */
const shelf = generated as unknown as StoryShelfChunk;

export function storyShelf(): StoryShelfChunk {
  return shelf;
}

export function isStoryShelfIn(): boolean {
  return true;
}

/** Nothing to load: the shelf is in the bundle. */
export function ensureStoryShelf(): Promise<void> {
  return Promise.resolve();
}
