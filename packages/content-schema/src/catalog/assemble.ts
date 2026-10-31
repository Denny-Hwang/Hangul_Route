import { StageKeySchema, ThemeKeySchema, type StageKey, type ThemeKey } from '../schemas/heritage-card';
import { cellIsReady, volumeEpisodeId, type Catalog, type CatalogCell, type CatalogQuest, type CatalogStory, type CatalogTopic } from './schema';

/**
 * How the catalogue is put together (F-CURR-002 §9.1, row CM-6): the rows content/ defines come
 * from `catalog.generated.ts` (scripts/build-lessons.mjs), the rest is hand-written in `data.ts`.
 * Pure, so a test can hand it a catalogue that grew.
 */

/**
 * A story file as the generator reads it: everything but its shelf order, plus, for a story added
 * after the frozen shelf, its `addedIn` stamp (the order it takes its shelf place in) and the festival
 * anchor its `shelf.anchor` names (the frozen shelf keeps the anchors of the first 24).
 */
export type GeneratedStoryRow = Pick<CatalogStory, 'title' | 'recommendedStage' | 'theme' | 'minutes' | 'sampler' | 'status'> & {
  slug: string;
  addedIn?: number;
  anchor?: NonNullable<CatalogStory['anchor']>;
};

/**
 * A generated lesson quest, compact: its title, minutes and what it teaches. Its id
 * (`quest:<stage>-<theme>-q<n>`, by position), cell, stage, theme and kind follow from its cell, so
 * the start bundle does not carry them once per quest.
 */
export type GeneratedQuestRow = readonly [title: string, minutes: number, teaches: readonly string[]];

/**
 * A generated upper-stage cell, compact: its quests in order (none for a "Coming soon" cell). A row of a cell's
 * Volume 2 (`<theme>.v2.json`, F-CURR-002 row CM-40) ends with its volume, 2; a Volume 1 row has none, so the rows
 * of a catalogue with no Volume 2 are what they were.
 */
export type GeneratedCellRow =
  | readonly [stage: StageKey, theme: ThemeKey, title: string, status: CatalogCell['status'], minutes: number, quests: readonly GeneratedQuestRow[]]
  | readonly [stage: StageKey, theme: ThemeKey, title: string, status: CatalogCell['status'], minutes: number, quests: readonly GeneratedQuestRow[], volume: number];

/**
 * A later volume of a cell (row CM-40): its episode (`<cellId>-v2`) and its quests in order. It joins its cell's
 * `episodeIds` and adds its quests to the catalogue, never a cell or a route day of its own.
 */
export interface CatalogVolumeSource {
  /** The cell's own id, its first volume (`episode:stage2-life`). */
  cellId: string;
  episodeId: string;
  volume: number;
  questIds: readonly string[];
}

/** Pure: compact generated cell rows -> the catalogue cells, their later volumes and their lesson quests. */
export function expandCellRows(rows: readonly GeneratedCellRow[]): { cells: CatalogCell[]; volumes: CatalogVolumeSource[]; quests: CatalogQuest[] } {
  const cells: CatalogCell[] = [];
  const volumes: CatalogVolumeSource[] = [];
  const quests: CatalogQuest[] = [];
  for (const row of rows) {
    const [stage, theme, title, status, minutes, rowQuests] = row;
    const volume = row[6] ?? 1;
    const cellId = `episode:${stage}-${theme}`;
    const episodeId = volumeEpisodeId(cellId, volume);
    const questIds = rowQuests.map((_, i) => `quest:${episodeId.slice('episode:'.length)}-q${i + 1}`);
    if (volume === 1) cells.push({ stage, theme, episodeId, title, status, minutes, questIds });
    else volumes.push({ cellId, episodeId, volume, questIds });
    rowQuests.forEach(([questTitle, questMinutes, teaches], i) => {
      quests.push({ id: questIds[i] as string, episodeId, stage, theme, title: questTitle, minutes: questMinutes, teaches: [...teaches], kind: 'lesson' });
    });
  }
  return { cells, volumes, quests };
}

/** A vocabulary topic file as the generator reads it: everything but the free rule and the minutes. */
export type GeneratedTopicRow = Pick<CatalogTopic, 'id' | 'key' | 'title' | 'order'>;

/** A frozen shelf entry: the story's slug and, for a festival story, its anchor. */
export type StoryShelfEntry = readonly [slug: string, anchor?: CatalogStory['anchor']];

export interface CatalogSources {
  version: number;
  /** Cells written by hand (Stage 1, the Stage 5 books) and generated ones (the lesson cell files). */
  cells: readonly CatalogCell[];
  /** The later volumes of those cells (row CM-40; none until a Volume 2 ships). */
  volumes?: readonly CatalogVolumeSource[];
  /** The lesson quests of those cells and volumes, in any order. */
  lessonQuests: readonly CatalogQuest[];
  stories: readonly GeneratedStoryRow[];
  /**
   * The frozen shelf order and anchors; a story not listed follows them, by its `addedIn` stamp and
   * then slug, with the anchor of its own file (or none), so a later story takes the next shelf place,
   * none already shipped moves, and its PR edits only its own file.
   */
  storyShelf: readonly StoryShelfEntry[];
  topics: readonly GeneratedTopicRow[];
  /** How many topics, in topic order, are free (F-VOC-001 D5). */
  freeTopics: number;
  /** Minutes a topic takes (F-VOC-001 section 3.3). */
  topicMinutes: number;
}

const byString = (a: string, b: string): number => Number(a > b) - Number(a < b);

/**
 * The catalogue: cells in grid order, each with its episodes by volume (`episodeIds`); the lesson quests of the first
 * volumes in route order, then those of the later volumes in grid order (row CM-40: a later volume is off the route
 * days); then one listen quest per story. A later volume with no cell, or of a cell that is not ready, is left out.
 */
export function assembleCatalog(sources: CatalogSources): Catalog {
  const byVolume = new Map<string, CatalogVolumeSource[]>();
  for (const v of [...(sources.volumes ?? [])].sort((a, b) => a.volume - b.volume)) byVolume.set(v.cellId, [...(byVolume.get(v.cellId) ?? []), v]);
  const cellById = new Map(sources.cells.map((c) => [c.episodeId, c]));
  const laterVolumes: CatalogVolumeSource[] = [];
  const cells = StageKeySchema.options.flatMap((stage) =>
    ThemeKeySchema.options.flatMap((theme) => {
      const found = cellById.get(`episode:${stage}-${theme}`);
      if (found === undefined) return [];
      const later = cellIsReady(found) ? (byVolume.get(found.episodeId) ?? []) : [];
      laterVolumes.push(...later);
      return [{ ...found, episodeIds: [found.episodeId, ...later.map((v) => v.episodeId)] }];
    }),
  );
  const lessonById = new Map(sources.lessonQuests.map((q) => [q.id, q]));
  const lessonQuests = [...cells.map((c) => c.questIds), ...laterVolumes.map((v) => v.questIds)].flatMap((ids) =>
    ids.flatMap((id) => {
      const found = lessonById.get(id);
      return found === undefined ? [] : [found];
    }),
  );

  const shelfRank = new Map(sources.storyShelf.map(([slug], index) => [slug, index]));
  const anchors = new Map(sources.storyShelf.map(([slug, anchor]) => [slug, anchor ?? null]));
  const anchorOf = (row: GeneratedStoryRow): CatalogStory['anchor'] => (shelfRank.has(row.slug) ? (anchors.get(row.slug) ?? null) : (row.anchor ?? null));
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
    anchor: anchorOf(row),
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
