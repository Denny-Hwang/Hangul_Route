import { StageKeySchema, ThemeKeySchema, type StageKey } from '../schemas/heritage-card';
import type { Catalog, CatalogCell, CatalogQuest, CatalogStory, CatalogTopic } from './schema';

/**
 * How the catalogue is put together (F-CURR-002 §9.1, row CM-6): the rows content/ defines come
 * from `catalog.generated.ts` (scripts/build-lessons.mjs), the rest is hand-written in `data.ts`.
 * Pure, so a test can hand it a catalogue that grew.
 */

/**
 * A story file as the generator reads it: everything but its shelf order and festival anchor, plus
 * the `addedIn` stamp of a story added after the frozen shelf (the order it takes its shelf place in).
 */
export type GeneratedStoryRow = Pick<CatalogStory, 'title' | 'recommendedStage' | 'theme' | 'minutes' | 'sampler' | 'status'> & {
  slug: string;
  addedIn?: number;
};

/** A vocabulary topic file as the generator reads it: everything but the free rule and the minutes. */
export type GeneratedTopicRow = Pick<CatalogTopic, 'id' | 'key' | 'title' | 'order'>;

/** A frozen shelf entry: the story's slug and, for a festival story, its anchor. */
export type StoryShelfEntry = readonly [slug: string, anchor?: CatalogStory['anchor']];

export interface CatalogSources {
  version: number;
  /** Cells written by hand (Stage 1, the Stage 5 books) and generated ones (the lesson cell files). */
  cells: readonly CatalogCell[];
  /** The lesson quests of those cells, in any order. */
  lessonQuests: readonly CatalogQuest[];
  stories: readonly GeneratedStoryRow[];
  /**
   * The frozen shelf order; a story not listed follows them, by its `addedIn` stamp and then slug,
   * with no anchor, so a later story takes the next shelf place and none already shipped moves.
   */
  storyShelf: readonly StoryShelfEntry[];
  topics: readonly GeneratedTopicRow[];
  /** How many topics, in topic order, are free (F-VOC-001 D5). */
  freeTopics: number;
  /** Minutes a topic takes (F-VOC-001 section 3.3). */
  topicMinutes: number;
}

const byString = (a: string, b: string): number => Number(a > b) - Number(a < b);

/** The catalogue: cells in grid order, lesson quests in route order, then one listen quest per story. */
export function assembleCatalog(sources: CatalogSources): Catalog {
  const cellById = new Map(sources.cells.map((c) => [c.episodeId, c]));
  const cells = StageKeySchema.options.flatMap((stage) =>
    ThemeKeySchema.options.flatMap((theme) => {
      const found = cellById.get(`episode:${stage}-${theme}`);
      return found === undefined ? [] : [found];
    }),
  );
  const lessonById = new Map(sources.lessonQuests.map((q) => [q.id, q]));
  const lessonQuests = cells.flatMap((c) =>
    c.questIds.flatMap((id) => {
      const found = lessonById.get(id);
      return found === undefined ? [] : [found];
    }),
  );

  const shelfRank = new Map(sources.storyShelf.map(([slug], index) => [slug, index]));
  const anchors = new Map(sources.storyShelf.map(([slug, anchor]) => [slug, anchor ?? null]));
  const rank = (slug: string): number => shelfRank.get(slug) ?? sources.storyShelf.length;
  const storyRows = [...sources.stories].sort(
    (a, b) => rank(a.slug) - rank(b.slug) || (a.addedIn ?? 0) - (b.addedIn ?? 0) || byString(a.slug, b.slug),
  );
  const stories: CatalogStory[] = storyRows.map((row, index) => ({
    id: `story:${row.slug}`,
    questId: `quest:story-${row.slug}-listen`,
    order: index + 1,
    title: row.title,
    recommendedStage: row.recommendedStage,
    theme: row.theme,
    minutes: row.minutes,
    anchor: anchors.get(row.slug) ?? null,
    // The catalogue sampler is the intended free set (D5): the story file's shelf block states it.
    sampler: row.sampler,
    // F-PLAN-002 section 3.2: `catalogStatusOfStory`, applied by the generator to the story file.
    status: row.status,
  }));
  /** One listen quest per story (F-STORY-004 section 3.1), on the shelf episode of its slug. */
  const storyQuests: CatalogQuest[] = storyRows.map((row) => ({
    id: `quest:story-${row.slug}-listen`,
    episodeId: `episode:shelf-${row.slug}`,
    stage: `stage${row.recommendedStage}` as StageKey,
    theme: row.theme,
    title: row.title,
    minutes: row.minutes,
    teaches: [],
    kind: 'story',
  }));

  const topics: CatalogTopic[] = [...sources.topics]
    .sort((a, b) => a.order - b.order || byString(a.key, b.key))
    .map((topic, index) => ({ ...topic, free: index < sources.freeTopics, minutes: sources.topicMinutes, questId: null }));

  return { version: sources.version, cells, quests: [...lessonQuests, ...storyQuests], stories, topics };
}
