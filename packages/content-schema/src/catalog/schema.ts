import { z } from 'zod';
import { EpisodeStatusSchema } from '../schemas/episode';
import { StageKeySchema, ThemeKeySchema } from '../schemas/heritage-card';
import { VocabTopicKeySchema } from '../schemas/vocab';

/**
 * The shared catalogue (F-PLAN-002 section 3.2): the 35 grid cells, the quests
 * they hold, the 24 shelf stories and the 12 vocabulary topics. Pure data and
 * zod schemas; `apps/mobile/src/content/__tests__/catalog-parity.test.ts` keeps
 * it equal to the shipped content bundle.
 */

export const CatalogCellSchema = z.object({
  stage: StageKeySchema,
  theme: ThemeKeySchema,
  episodeId: z.string(),
  title: z.string(),
  status: EpisodeStatusSchema,
  minutes: z.number().int(),
  questIds: z.array(z.string()),
});
export type CatalogCell = z.infer<typeof CatalogCellSchema>;

export const CatalogQuestSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  stage: StageKeySchema,
  theme: ThemeKeySchema,
  title: z.string(),
  minutes: z.number().int(),
  /** Symbol keys the quest teaches (F-QUEST-002): 'ㄱ', 'ㅏ', 'ㄴ/final'. */
  teaches: z.array(z.string()),
  kind: z.enum(['lesson', 'story']),
});
export type CatalogQuest = z.infer<typeof CatalogQuestSchema>;

export const FESTIVAL_ANCHORS = ['hangeul-day', 'seollal', 'chuseok'] as const;
export const FestivalAnchorSchema = z.enum(FESTIVAL_ANCHORS);
export type FestivalAnchor = z.infer<typeof FestivalAnchorSchema>;

export const CatalogStorySchema = z.object({
  id: z.string().regex(/^story:[a-z0-9-]+$/),
  questId: z.string(),
  order: z.number().int(),
  title: z.string(),
  recommendedStage: z.number().int().min(1).max(7),
  theme: ThemeKeySchema,
  minutes: z.number().int(),
  anchor: FestivalAnchorSchema.nullable(),
  sampler: z.boolean(),
  status: z.enum(['ready', 'draft']),
});
export type CatalogStory = z.infer<typeof CatalogStorySchema>;

export const CatalogTopicSchema = z.object({
  id: z.string().regex(/^topic:[a-z0-9-]+$/),
  key: VocabTopicKeySchema,
  title: z.string(),
  order: z.number().int(),
  free: z.boolean(),
  minutes: z.number().int(),
  questId: z.string().nullable(),
});
export type CatalogTopic = z.infer<typeof CatalogTopicSchema>;

/**
 * Solar day of each anchor, year to `YYYY-MM-DD`, 2026 to 2030 (spec section 9,
 * assumption 1). Seollal and Chuseok are the Korean lunar dates (new moon in
 * Korea, UTC+9), not the Chinese ones. A one-day anchor only.
 */
export const FESTIVAL_DATES: Record<FestivalAnchor, Record<string, string>> = {
  'hangeul-day': {
    '2026': '2026-10-09',
    '2027': '2027-10-09',
    '2028': '2028-10-09',
    '2029': '2029-10-09',
    '2030': '2030-10-09',
  },
  seollal: {
    '2026': '2026-02-17',
    '2027': '2027-02-07',
    '2028': '2028-01-27',
    '2029': '2029-02-13',
    '2030': '2030-02-03',
  },
  chuseok: {
    '2026': '2026-09-25',
    '2027': '2027-09-15',
    '2028': '2028-10-03',
    '2029': '2029-09-22',
    '2030': '2030-09-12',
  },
};

export const CatalogSchema = z
  .object({
    version: z.number().int().positive(),
    cells: z.array(CatalogCellSchema).length(35),
    quests: z.array(CatalogQuestSchema),
    stories: z.array(CatalogStorySchema),
    topics: z.array(CatalogTopicSchema),
  })
  .superRefine((catalog, ctx) => {
    const fail = (message: string): void => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    const duplicates = (values: readonly string[]): string[] =>
      values.filter((value, index) => values.indexOf(value) !== index);

    // Cells: one per (stage, theme), the episode id is derived from it.
    const seenCells = new Set<string>();
    for (const cell of catalog.cells) {
      const key = `${cell.stage}-${cell.theme}`;
      if (seenCells.has(key)) fail(`Two cells share the cell ${key}`);
      seenCells.add(key);
      if (cell.episodeId !== `episode:${key}`) fail(`Cell ${key} must have the episode id episode:${key}`);
    }

    // Unique ids inside each list.
    for (const id of duplicates(catalog.cells.map((c) => c.episodeId))) fail(`Duplicate episode id ${id}`);
    for (const id of duplicates(catalog.quests.map((q) => q.id))) fail(`Duplicate quest id ${id}`);
    for (const id of duplicates(catalog.stories.map((s) => s.id))) fail(`Duplicate story id ${id}`);
    for (const id of duplicates(catalog.topics.map((t) => t.id))) fail(`Duplicate topic id ${id}`);

    const questById = new Map(catalog.quests.map((q) => [q.id, q]));
    const cellByEpisode = new Map(catalog.cells.map((c) => [c.episodeId, c]));

    // Cells only list lesson quests that belong to them.
    for (const cell of catalog.cells) {
      for (const questId of cell.questIds) {
        const quest = questById.get(questId);
        if (quest === undefined) fail(`Cell ${cell.episodeId} lists the unknown quest ${questId}`);
        else if (quest.kind === 'story') fail(`Cell ${cell.episodeId} lists the story quest ${questId}`);
        else if (quest.episodeId !== cell.episodeId) {
          fail(`Cell ${cell.episodeId} lists the quest ${questId} of ${quest.episodeId}`);
        }
      }
    }

    // Lesson quests sit in a cell that lists them, with the cell's stage and theme.
    for (const quest of catalog.quests.filter((q) => q.kind === 'lesson')) {
      const cell = cellByEpisode.get(quest.episodeId);
      if (cell === undefined) {
        fail(`Lesson quest ${quest.id} names the unknown cell ${quest.episodeId}`);
        continue;
      }
      if (!cell.questIds.includes(quest.id)) fail(`Lesson quest ${quest.id} is not listed by its cell`);
      if (quest.stage !== cell.stage || quest.theme !== cell.theme) {
        fail(`Quest ${quest.id} must carry the stage and theme of its cell`);
      }
    }

    // Stories: the listen quest is derived from the slug and agrees with the story.
    const ownedStoryQuests = new Set<string>();
    for (const story of catalog.stories) {
      const expected = `quest:story-${story.id.slice('story:'.length)}-listen`;
      ownedStoryQuests.add(story.questId);
      if (story.questId !== expected) fail(`Story ${story.id} must use the quest ${expected}`);
      const quest = questById.get(expected);
      if (quest === undefined || quest.kind !== 'story') {
        fail(`Story ${story.id} has no story quest ${expected}`);
      } else if (
        quest.minutes !== story.minutes ||
        quest.stage !== `stage${story.recommendedStage}` ||
        quest.theme !== story.theme
      ) {
        fail(`Story ${story.id} and its quest must agree on minutes, stage and theme`);
      }
    }
    for (const quest of catalog.quests.filter((q) => q.kind === 'story')) {
      if (!ownedStoryQuests.has(quest.id)) fail(`Story quest ${quest.id} has no story`);
    }
    for (const anchor of duplicates(catalog.stories.flatMap((s) => (s.anchor === null ? [] : [s.anchor])))) {
      fail(`Two stories claim the anchor ${anchor}`);
    }

    // Topics: a quest, when named, exists; the order is a sequence.
    for (const topic of catalog.topics) {
      if (topic.questId !== null && !questById.has(topic.questId)) {
        fail(`Topic ${topic.id} names the unknown quest ${topic.questId}`);
      }
    }
    for (const order of duplicates(catalog.topics.map((t) => String(t.order)))) fail(`Two topics share the order ${order}`);
  });
export type Catalog = z.infer<typeof CatalogSchema>;

/** A cell is ready when its status is `shipped` or `ready`; `preview` and `draft` are coming soon. */
export const cellIsReady = (cell: Pick<CatalogCell, 'status'>): boolean =>
  cell.status === 'shipped' || cell.status === 'ready';

/** A story is offered only when a reviewer has signed it (F-STORY-004). */
export const storyIsReady = (story: Pick<CatalogStory, 'status'>): boolean => story.status === 'ready';

/** The fields of a story file (F-STORY-001 section 3.2) that decide its catalogue status. */
export interface StoryOfferFields {
  state: 'draft' | 'ready';
  shelf?: unknown;
  review: { language: 'draft' | 'native-reviewed'; culture: 'draft' | 'culture-reviewed' };
}

/**
 * The catalogue status a story file implies (F-PLAN-002 section 3.2), the one rule
 * `catalog-parity.test.ts` holds `data.ts` to. `ready` (offered by plans and placement)
 * needs all three: the file is `ready` (bundled), it has a `shelf` block (so the bundle
 * holds its listen quest and shelf episode) and both review sign-offs are recorded (the
 * F-STORY-004 review gate). A story can be `ready` as content before PR 1.9 adds its
 * shelf block and sign-offs; until then it stays `draft` here and no learner path offers it.
 */
export const catalogStatusOfStory = (story: StoryOfferFields): CatalogStory['status'] =>
  story.state === 'ready' &&
  story.shelf !== undefined &&
  story.review.language === 'native-reviewed' &&
  story.review.culture === 'culture-reviewed'
    ? 'ready'
    : 'draft';
