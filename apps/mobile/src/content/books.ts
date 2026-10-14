import type { Episode, Quest, Story } from '@hangul-route/content-schema';
import { storyById } from './stories';
import { storyQuestSkeleton } from './story-skeleton';

/**
 * Stage 5 books (F-STORY-005 §3.2, §3.3): hand-written grid story episodes,
 * one per Stage 5 cell, each reusing its placeholder id
 * (`episode:stage5-<theme>`) and listing its `storyIds`. A book replaces its
 * cell's "Coming soon" preview automatically (`previewEpisodesFor`).
 *
 * A book plays its stories at the `read` level, so a story joins a book only
 * once its `read` tier has passed the language and culture review; a cell
 * stays a placeholder until its book has at least two reviewed quests (§3.1
 * rule 5). Stage 5 opens cell by cell (PR 5.6): the rites book first.
 */

/** The stories of each shipped book, in reading order (an editorial decision, §3.3 book plan). */
const RITES_STORY_IDS = ['story:seollal-new-year', 'story:dano-ssireum', 'story:chuseok-ganggangsullae'] as const;

function bookStories(ids: readonly string[]): Story[] {
  return ids.map((id) => {
    const story = storyById(id);
    if (!story) throw new Error(`books.ts: ${id} is not in the story bundle`);
    return story;
  });
}

const riteStories = bookStories(RITES_STORY_IDS);

/** The Read quests of every shipped book, in book order (`questsAll` appends them). */
export const bookQuests: Quest[] = riteStories.map((story) => storyQuestSkeleton(story, 'read'));

export const bookEpisodes: Episode[] = [
  {
    id: 'episode:stage5-rites',
    stage: 'stage5',
    theme: 'rites',
    order: 3,
    titleEn: 'Festival Tales',
    hoyaIntroEn: "Let's read three festival stories in Korean, one short sentence at a time.",
    questIds: bookQuests.map((q) => q.id),
    rewardCardIds: [],
    estimatedMinutes: bookQuests.reduce((sum, q) => sum + q.estimatedMinutes, 0),
    status: 'shipped',
    format: 'story',
    placement: 'grid',
    volume: 1,
    storyIds: [...RITES_STORY_IDS],
    pillarTags: ['B5'],
    companionId: 'hoya',
  },
];
