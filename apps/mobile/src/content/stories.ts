import type { Episode, HeldStoryCard, Quest, Story, StoryLevel } from '@hangul-route/content-schema';
import * as generated from './__generated__/stories-index';
import { HELD_STORY_CARDS, STORY_SHELF, loadStoryBody } from './__generated__/stories-index';
import { createStoryStore, shelfLevelOf, storiesOverStore, storyTierLevels, type StoryBody } from '../logic/story/story-chunk-store';
import { storyQuestSkeleton } from './story-skeleton';

/**
 * The only reader of the generated story modules (F-STORY-001 §3.9, F-CURR-002 §10 row CM-8):
 * `episodes.ts` and `quests.ts` take `storyEpisodes` / `storyQuests` from here. The shelf (each
 * story without its body) loads at start; a story's body (tiers, scenes, art, facts, keywords,
 * summary) loads on demand from its content-hashed chunk. `storyContent` is the store the screens
 * wait on (`screens/story-content.tsx`).
 */

const extras = generated as unknown as { STORY_INLINE_BODIES?: Readonly<Record<string, StoryBody>>; STORY_FIXTURE_IDS?: readonly string[] };

export const storyContent = createStoryStore({ entries: STORY_SHELF, inline: extras.STORY_INLINE_BODIES ?? {} }, loadStoryBody);

/** Every bundled story; a story's body fields read its chunk, so they hold placeholders until `storyContent` has it. */
export const storiesAll: Story[] = storiesOverStore(STORY_SHELF, storyContent);

const byId = new Map(storiesAll.map((s) => [s.id, s]));

/** The levels of a story's tiers, from the shelf, so they are known before its chunk loads. */
export const storyLevels: (story: Pick<Story, 'tiers'>) => StoryLevel[] = storyTierLevels;

/**
 * F-STORY-001 §3.9 "Shelf episodes and quests are derived, not hand-written": one shelf episode and
 * its five-step quest per story with a `shelf` block. The twin of `deriveShelf` in
 * scripts/build-stories.mjs; `content/__tests__/story-chunks.test.ts` keeps the two equal.
 */
function shelfEpisodeOf(story: Story, quest: Quest): Episode {
  const listenCard = story.rewardCardIds?.listen;
  return {
    id: `episode:shelf-${storySlug(story.id)}`,
    stage: 'stage1',
    theme: story.theme,
    order: 100 + (story.shelf?.order ?? 0),
    titleEn: story.title.en,
    hoyaIntroEn: story.hoyaIntroEn ?? '',
    questIds: [quest.id],
    rewardCardIds: listenCard ? [listenCard] : [],
    estimatedMinutes: quest.estimatedMinutes,
    status: 'ready',
    format: 'story',
    placement: 'shelf',
    pillarTags: [...story.pillarTags],
    companionId: story.companionId,
  };
}

const shelfDerived = STORY_SHELF.flatMap((entry) => {
  const story = byId.get(entry.id);
  const level = shelfLevelOf(entry.levels);
  if (!entry.shelf || story === undefined || level === undefined) return [];
  const quest = storyQuestSkeleton(story, level);
  return [{ episode: shelfEpisodeOf(story, quest), quest }];
});

export const storyEpisodes: Episode[] = shelfDerived.map((d) => d.episode);
export const storyQuests: Quest[] = shelfDerived.map((d) => d.quest);

/**
 * The cards of held stories (F-STORY-006 §3.8, rule 1): a held story is a
 * draft and leaves `storiesAll`, but a learner who owns its card keeps it.
 */
export const heldStoryCards: HeldStoryCard[] = HELD_STORY_CARDS;

/**
 * Ids of the test fixtures in an e2e build (`build-stories.mjs --include-fixtures`, F-STORY-002 §5).
 * The export exists only in that build, so a real build reads an empty list.
 */
export const storyFixtureIds: readonly string[] = extras.STORY_FIXTURE_IDS ?? [];

export function storyById(id: string): Story | undefined {
  return byId.get(id);
}

/** `story:seollal-new-year` -> `seollal-new-year` (the part used in episode, quest and minigame ids). */
export function storySlug(id: string): string {
  return id.replace(/^story:/, '');
}
