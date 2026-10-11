import type { Story } from '@hangul-route/content-schema';
import { storiesAll, storyEpisodes, storyQuests } from './stories.generated';

/**
 * The only reader of the generated bundle (F-STORY-001 §3.9): `episodes.ts`
 * and `quests.ts` take `storyEpisodes` / `storyQuests` from here.
 */
export { storiesAll, storyEpisodes, storyQuests };

export function storyById(id: string): Story | undefined {
  return storiesAll.find((s) => s.id === id);
}

/** `story:seollal-new-year` -> `seollal-new-year` (the part used in episode, quest and minigame ids). */
export function storySlug(id: string): string {
  return id.replace(/^story:/, '');
}
