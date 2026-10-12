import { z } from 'zod';
import { CatalogueFieldsSchema, pillarTagProblems } from '../pillars';
import { StageKeySchema, ThemeKeySchema, type StageKey, type ThemeKey } from './heritage-card';

/**
 * Episode — one grid cell (Stage × Theme). Contains 1–N Quests.
 */
/** The episode id grammar, `episode:<slug>` (exported for F-BROWSE-001 §4.4 and the lecture blocks). */
export const EPISODE_ID_RE = /^episode:[a-z0-9-]+$/;

export const EpisodeStatusSchema = z.enum(['draft', 'ready', 'shipped', 'preview']);
export type EpisodeStatus = z.infer<typeof EpisodeStatusSchema>;

/**
 * The plain object: the only thing later specs extend (a refined schema is a
 * `ZodEffects` and has no `.extend` / `.merge`, F-STORY-001 §3.9).
 * `format` / `placement` / `volume` default, so every existing episode stays valid.
 */
export const EpisodeObjectSchema = z.object({
  id: z.string().regex(EPISODE_ID_RE),
  stage: StageKeySchema,
  theme: ThemeKeySchema,
  order: z.number().int().nonnegative(),
  titleEn: z.string(),
  subtitleEn: z.string().optional(),
  hoyaIntroEn: z.string(),
  questIds: z.array(z.string()),
  rewardCardIds: z.array(z.string()).min(0),
  estimatedMinutes: z.number().int().min(3).max(60),
  status: EpisodeStatusSchema,
  format: z.enum(['lesson', 'story']).default('lesson'),
  placement: z.enum(['grid', 'shelf']).default('grid'),
  volume: z.number().int().min(1).default(1),
  storyIds: z.array(z.string()).optional(),
}).merge(CatalogueFieldsSchema); // `pillarTags`, `companionId` (F-STORY-005 §3.2)

/**
 * A grid episode's `order` is its theme's column, 1-based in `ThemeKeySchema` order. The app's
 * `themes[theme].order` (apps/mobile stages.ts) must equal it; content-integrity.test.ts guards that.
 */
export const themeOrder = (theme: ThemeKey): number => ThemeKeySchema.options.indexOf(theme) + 1;

/** At launch a story episode on the grid is a Stage 5 book (F-STORY-005 D9) holding 2-3 quests. */
export const BOOK_STAGE: StageKey = 'stage5';
export const BOOK_MIN_QUESTS = 2;
export const BOOK_MAX_QUESTS = 3;

/** The parsed fields the rules read (defaults already applied). */
export type EpisodeRuleInput = Pick<
  z.output<typeof EpisodeObjectSchema>,
  'id' | 'stage' | 'theme' | 'order' | 'questIds' | 'status' | 'format' | 'placement' | 'volume' | 'pillarTags'
>;

/**
 * Object-level rules: the questIds relaxation of F-STORY-001 §3.9 and the
 * catalogue rules of F-STORY-005 §3.2. Shelf-episode conventions (one quest,
 * `stage1`, `order >= 100`) stay F-STORY-004's integrity tests.
 */
export const episodeRules = (episode: EpisodeRuleInput, ctx: z.RefinementCtx): void => {
  const issue = (path: Array<string | number>, message: string): void =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  const preview = episode.status === 'preview';

  if (episode.questIds.length < 1 && !preview) {
    issue(['questIds'], 'questIds needs at least one quest unless the episode is a preview');
  }

  for (const p of pillarTagProblems(episode.pillarTags)) {
    issue(
      ['pillarTags', p.index],
      p.rule === 'pillar-tag-unknown'
        ? `pillar-tag-unknown: ${p.tag} is not in PILLAR_TAGS`
        : `pillar-tag-duplicate: ${p.tag} is listed twice`,
    );
  }

  if (episode.placement === 'grid') {
    const expected = themeOrder(episode.theme);
    if (episode.order !== expected) {
      issue(['order'], `a grid episode in ${episode.theme} has order ${expected}, not ${episode.order}`);
    }
    if (episode.format === 'story') {
      if (episode.stage !== BOOK_STAGE) {
        issue(['stage'], `a story episode on the grid is a ${BOOK_STAGE} book at launch, not ${episode.stage}`);
      }
      const n = episode.questIds.length;
      if (!preview && (n < BOOK_MIN_QUESTS || n > BOOK_MAX_QUESTS)) {
        issue(['questIds'], `a story book holds ${BOOK_MIN_QUESTS}-${BOOK_MAX_QUESTS} quests, not ${n}`);
      }
    }
  }

  const { volume } = episode;
  if (volume >= 2 && !episode.id.endsWith(`-v${volume}`)) {
    issue(['id'], `an episode of volume ${volume} has an id ending -v${volume} (got ${episode.id})`);
  } else {
    const suffix = /-v(\d+)$/.exec(episode.id)?.[1];
    if (suffix !== undefined && Number(suffix) !== volume) {
      issue(['volume'], `an episode whose id ends -v${suffix} has volume ${suffix} (got ${volume})`);
    }
  }
};

export const EpisodeSchema = EpisodeObjectSchema.superRefine(episodeRules);

/** Input shape: `format`, `placement`, `volume`, `pillarTags` and `companionId` stay optional for hand-written episodes. */
export type Episode = z.input<typeof EpisodeObjectSchema>;
export const EpisodeListSchema = z.array(EpisodeSchema);
