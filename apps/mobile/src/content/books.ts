import { BOOK_MIN_QUESTS, type Episode, type Quest, type Story } from '@hangul-route/content-schema';
import { storyById } from './stories';
import { storyQuestSkeleton } from './story-skeleton';

/**
 * Stage 5 books (F-STORY-005 §3.2, §3.3): hand-written grid story episodes,
 * one per Stage 5 cell, each reusing its placeholder id
 * (`episode:stage5-<theme>`) and listing its `storyIds`. A book replaces its
 * cell's "Coming soon" preview automatically (`previewEpisodesFor`).
 *
 * A book plays its stories at the `read` level, so a story joins a book only
 * once its `read` tier has passed the language and culture review. At run time
 * the build can only see the story-level review tokens; the per-tier review
 * (the read tier's verification notes) is enforced in CI by books.test.ts. A cell
 * stays a placeholder until its book has at least two reviewed quests (§3.1
 * rule 5). Stage 5 opens cell by cell (PR 5.6): the rites book first.
 */

/** A book as authored: everything but the quests, which come from its stories. */
export interface BookDefinition {
  id: string;
  stage: Episode['stage'];
  theme: Episode['theme'];
  order: number;
  titleEn: string;
  hoyaIntroEn: string;
  /** The stories in reading order (an editorial decision, §3.3 book plan). */
  storyIds: readonly string[];
  pillarTags: NonNullable<Episode['pillarTags']>;
}

/** The books, in grid order. */
export const BOOK_DEFINITIONS: readonly BookDefinition[] = [
  {
    id: 'episode:stage5-rites',
    stage: 'stage5',
    theme: 'rites',
    order: 3,
    titleEn: 'Festival Tales',
    hoyaIntroEn: "Let's read festival stories in Korean, one short sentence at a time.",
    storyIds: ['story:seollal-new-year', 'story:dano-ssireum', 'story:chuseok-ganggangsullae'],
    pillarTags: ['B5'],
  },
];

/** The production review gate of the story index (D14), for one story. */
function isReviewed(story: Story): boolean {
  return story.state === 'ready' && story.review.language === 'native-reviewed' && story.review.culture === 'culture-reviewed';
}

/**
 * Pure: a book's episode and Read quests from the bundle. A story that is not bundled (held for a
 * correction, F-STORY-001 §3.7), is not reviewed or has no `read` tier is left out, and a book left with
 * fewer than `BOOK_MIN_QUESTS` stories is not built, so its cell stays a placeholder: content trouble
 * never breaks the app at load.
 */
export function buildBook(definition: BookDefinition, lookup: (id: string) => Story | undefined): { episode: Episode; quests: Quest[] } | null {
  const stories = definition.storyIds
    .map((id) => lookup(id))
    .filter((s): s is Story => s !== undefined && isReviewed(s) && s.tiers.some((t) => t.level === 'read'));
  if (stories.length < BOOK_MIN_QUESTS) return null;
  const quests = stories.map((story) => storyQuestSkeleton(story, 'read'));
  return {
    episode: {
      id: definition.id,
      stage: definition.stage,
      theme: definition.theme,
      order: definition.order,
      titleEn: definition.titleEn,
      hoyaIntroEn: definition.hoyaIntroEn,
      questIds: quests.map((q) => q.id),
      // Book reward cards are the Stage 5 scene cards of F-CARD-S5-001 (a draft, out of scope).
      rewardCardIds: [],
      estimatedMinutes: quests.reduce((sum, q) => sum + q.estimatedMinutes, 0),
      status: 'shipped',
      format: 'story',
      placement: 'grid',
      volume: 1,
      storyIds: stories.map((s) => s.id),
      pillarTags: [...definition.pillarTags],
      companionId: 'hoya',
    },
    quests,
  };
}

const built = BOOK_DEFINITIONS.flatMap((definition) => {
  const book = buildBook(definition, storyById);
  return book ? [book] : [];
});

export const bookEpisodes: Episode[] = built.map((b) => b.episode);

/** The Read quests of every shipped book, in book order (`questsAll` appends them). */
export const bookQuests: Quest[] = built.flatMap((b) => b.quests);
