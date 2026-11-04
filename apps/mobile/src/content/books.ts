import { BOOK_MIN_QUESTS, type Episode, type Quest, type Story } from '@hangul-route/content-schema';
import { laterStoryIdsOf } from '../logic/offline/offline-packs';
import { storyTierLevels } from '../logic/story/story-chunk-store';
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
 * rule 5). Stage 5 opened cell by cell (PR 5.6): the rites book first, then the
 * letters, life, nature and crafts books.
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
  /**
   * A cell's book 2 (F-CURR-002 §5.1, row CM-40): volume 2, id `episode:stage5-<theme>-v2`, the second episode of its
   * cell, on the same path as a lesson cell's Volume 2. Absent for book 1.
   */
  volume?: 2;
}

/** The books, in grid order. */
export const BOOK_DEFINITIONS: readonly BookDefinition[] = [
  {
    id: 'episode:stage5-letters',
    stage: 'stage5',
    theme: 'letters',
    order: 1,
    titleEn: 'Stories of Letters',
    hoyaIntroEn: "Let's read stories about Hangul in Korean, one short sentence at a time.",
    storyIds: ['story:sejong-new-letters', 'story:shapes-of-hangeul', 'story:hangeul-day'],
    pillarTags: ['A1'],
  },
  // F-CURR-002 §5.2 S5, row CM-46: the Letters cell's book 2, in the order the records were made. The eight
  // listen-only Letters stories joined it through their read tiers (row CM-46a); the two new tales (Hangul letters of
  // Joseon families, and how Hangul got its name) join once their multi-agent review signs them (`buildBook` leaves an
  // unreviewed story out). Volume 2, so it shows only while `volumes` is on.
  {
    id: 'episode:stage5-letters-v2',
    stage: 'stage5',
    theme: 'letters',
    order: 1,
    titleEn: 'Books, Records and Letters',
    hoyaIntroEn: "Let's read stories of old books, records and letters in Korean, one short sentence at a time.",
    storyIds: [
      'story:tripitaka-koreana',
      'story:jikji-metal-type',
      'story:sillok-royal-historians',
      'story:sillok-mountain-archives',
      'story:eongan-letters',
      'story:nanjung-ilgi',
      'story:seungjeongwon-ilgi-every-day',
      'story:ilseongnok-daily-reflection',
      'story:hangul-name',
      'story:joseon-records-today',
    ],
    pillarTags: ['A1'],
    volume: 2,
  },
  {
    id: 'episode:stage5-life',
    stage: 'stage5',
    theme: 'life',
    order: 2,
    titleEn: 'Family Stories',
    hoyaIntroEn: "Let's read stories of everyday life in Korean, one short sentence at a time.",
    storyIds: ['story:gimjang-arirang', 'story:kim-hongdo-genre-paintings', 'story:donguibogam'],
    pillarTags: ['B1', 'B5', 'E4'],
  },
  /**
   * The Food cell's book 2 (F-CURR-002 §5.3 S5, row CM-46): the two new tales, on the Volume 2 path behind `volumes`.
   * Kimjang and Kim Hongdo's market paintings already ship in book 1 (`gimjang-arirang`, `kim-hongdo-genre-paintings`),
   * so book 2 tells of jang and of the rice cakes of the seasons. The two tales are a book of their own size
   * (BOOK_MIN_QUESTS).
   */
  {
    id: 'episode:stage5-life-v2',
    stage: 'stage5',
    theme: 'life',
    order: 2,
    titleEn: 'Jang and Rice Cakes',
    hoyaIntroEn: "Let's read stories of Korean food through the year in Korean, one short sentence at a time.",
    storyIds: ['story:jang-fermented-sauces', 'story:tteok-through-the-seasons'],
    pillarTags: ['B1', 'B5'],
    volume: 2,
  },
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
  // F-CURR-002 §5.4 S5, row CM-46: the Holidays cell's book 2. Daeboreum (the first full moon) and the tale of Gyeonu
  // and Jiknyeo (Chilseok) are the two new tales, in the order of the lunar year; the royal birthday record joined through
  // its read tier (row CM-46a). The two tales join once their multi-agent review signs them (`buildBook` leaves an
  // unreviewed story out), so until then the book has one quest and is not built. Volume 2: it shows only while
  // `volumes` is on.
  {
    id: 'episode:stage5-rites-v2',
    stage: 'stage5',
    theme: 'rites',
    order: 3,
    titleEn: 'Moons, Stars and Feasts',
    hoyaIntroEn: "Let's read stories of full moons, stars and royal feasts in Korean, one short sentence at a time.",
    storyIds: ['story:daeboreum-full-moon', 'story:gyeonu-jingnyeo', 'story:uigwe-royal-birthday'],
    pillarTags: ['B5'],
    volume: 2,
  },
  {
    id: 'episode:stage5-nature',
    stage: 'stage5',
    theme: 'nature',
    order: 4,
    titleEn: 'Nature Tales',
    hoyaIntroEn: "Let's read stories of the sun and the sky in Korean, one short sentence at a time.",
    storyIds: ['story:sun-and-moon', 'story:angbuilgu-sundial'],
    pillarTags: ['D5', 'E5'],
  },
  // F-CURR-002 §5.5 S5, row CM-46: the Nature cell's book 2, three new readers about Korea's nature (a volcanic island,
  // the first national park and a wetland of migrating birds). Volume 2, so it shows only while `volumes` is on.
  {
    id: 'episode:stage5-nature-v2',
    stage: 'stage5',
    theme: 'nature',
    order: 4,
    titleEn: 'Island, Mountain and Wetland',
    hoyaIntroEn: "Let's read stories of Korea's island, mountain and wetland in Korean, one short sentence at a time.",
    storyIds: ['story:jeju-volcanic-island', 'story:jirisan-national-park', 'story:suncheon-bay-wetland'],
    pillarTags: ['D2'],
    volume: 2,
  },
  {
    id: 'episode:stage5-crafts',
    stage: 'stage5',
    theme: 'crafts',
    order: 5,
    titleEn: 'Craft Stories',
    hoyaIntroEn: "Let's read stories of clever makers and old tales in Korean, one short sentence at a time.",
    storyIds: ['story:cheugugi-rain-gauge', 'story:jagyeongnu-water-clock', 'story:pansori-tales'],
    pillarTags: ['E3', 'C3'],
  },
  /**
   * The Play cell's book 2 (F-CURR-002 §5.6 S5, row CM-46): the two new tales, on the Volume 2 path behind `volumes`.
   * Editorial choice: janggyeong-panjeon, a crafts story whose read tier row CM-46a added, stays a shelf story and is not
   * in this book. It is the hall that keeps the Tripitaka woodblocks, so it reads with the printing and records stories
   * (its research cluster is hangul-printing), not with masks and paper. The two tales are a book of its own size
   * (BOOK_MIN_QUESTS).
   */
  {
    id: 'episode:stage5-crafts-v2',
    stage: 'stage5',
    theme: 'crafts',
    order: 5,
    titleEn: 'Masks and Paper',
    hoyaIntroEn: "Let's read stories of masks and paper made by hand in Korean, one short sentence at a time.",
    storyIds: ['story:hahoe-mask-dance', 'story:hanji-korean-paper'],
    pillarTags: ['C4', 'E1'],
    volume: 2,
  },
];

/**
 * The stories that only a book 2 holds (F-CURR-002 §4.3, §5.1, row CM-46): new tales that are Volume 2 content. They
 * have no shelf twin, so their one door is their book, which shows only while `volumes` is on; the review engine reads
 * this set (`SourceVisibility.cellVolume`) so their items hide with `volumes` off too. A story that is also in a book 1,
 * or on the shelf, is never here.
 */
export const VOLUME_TWO_STORY_IDS: ReadonlySet<string> = new Set(
  laterStoryIdsOf(BOOK_DEFINITIONS, (id) => storyById(id)?.addedIn !== undefined),
);

/** The volume of a review-item cell that is a story (`story:<slug>`): 2 for a book 2 tale, else undefined (§4.3). */
export const storyCellVolume = (cell: string): number | undefined => (VOLUME_TWO_STORY_IDS.has(cell) ? 2 : undefined);

/** The production review gate of the story index (D14), for one story. */
function isReviewed(story: Story): boolean {
  return story.state === 'ready' && story.review.language === 'native-reviewed' && story.review.culture === 'culture-reviewed';
}

/**
 * A story a book can play: reviewed, with a `read` tier and the Hoya lines its quest needs
 * (`storyQuestSkeleton` throws without them). The levels are the shelf's (`storyTierLevels`), known
 * before the story's chunk loads (F-CURR-002 §10).
 */
function isBookReady(story: Story): boolean {
  return isReviewed(story) && storyTierLevels(story).includes('read') && Boolean(story.hoyaIntroEn) && Boolean(story.hoyaOutroEn);
}

/**
 * Pure: a book's episode and Read quests from the bundle. A story that is not bundled (held for a
 * correction, F-STORY-001 §3.7), is not reviewed, has no `read` tier or lacks a Hoya line is left out, and a book left with
 * fewer than `BOOK_MIN_QUESTS` stories is not built, so its cell stays a placeholder: content trouble
 * never breaks the app at load.
 */
export function buildBook(definition: BookDefinition, lookup: (id: string) => Story | undefined): { episode: Episode; quests: Quest[] } | null {
  const stories = definition.storyIds
    .map((id) => lookup(id))
    .filter((s): s is Story => s !== undefined && isBookReady(s));
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
      volume: definition.volume ?? 1,
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

