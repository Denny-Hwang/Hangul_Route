import type { Story } from '@hangul-route/content-schema';
import * as generated from './stories.generated';
import { heldStoryCards, storiesAll, storyEpisodes, storyQuests } from './stories.generated';

/**
 * The only reader of the generated bundle (F-STORY-001 §3.9): `episodes.ts`
 * and `quests.ts` take `storyEpisodes` / `storyQuests` from here.
 */
export { storiesAll, storyEpisodes, storyQuests };

/**
 * The cards of held stories (F-STORY-006 §3.8, rule 1): a held story is a
 * draft and leaves `storiesAll`, but a learner who owns its card keeps it.
 */
export { heldStoryCards };

/**
 * Ids of the test fixtures in an e2e bundle (`build-stories.mjs
 * --include-fixtures`, F-STORY-002 §5). The export exists only in that bundle,
 * so a real build reads an empty list.
 */
export const storyFixtureIds: readonly string[] =
  (generated as unknown as { storyFixtureIds?: readonly string[] }).storyFixtureIds ?? [];

export function storyById(id: string): Story | undefined {
  return storiesAll.find((s) => s.id === id);
}

/** `story:seollal-new-year` -> `seollal-new-year` (the part used in episode, quest and minigame ids). */
export function storySlug(id: string): string {
  return id.replace(/^story:/, '');
}
