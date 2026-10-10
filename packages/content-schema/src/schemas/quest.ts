import { z } from 'zod';
import { KoTextSchema, PictureRefSchema } from './ko-text';
import { MinigameKindSchema } from './minigame';

/**
 * Quest — learning sequence (per content-skill timing convention).
 * Stage 2 / 4 taste quests: intro → present → practice → apply → reward.
 * Stage 1 quests (F-QUEST-002): intro → discover → practice → apply → check → reward.
 */
export const QuestStepKindSchema = z.enum([
  'intro',
  'present',
  'discover',
  'practice',
  'apply',
  'check',
  'reward',
]);
export type QuestStepKind = z.infer<typeof QuestStepKindSchema>;

/** Discover (teach before play): one or two new things per page (F-QUEST-002 §3.1). */
export const DiscoverItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('jamo'),
    jamoId: z.string().regex(/^jamo:[a-z0-9-]+$/),
    /** A word containing the symbol (reading word or theme word). */
    example: KoTextSchema,
    picture: PictureRefSchema.optional(),
  }),
  z.object({
    type: z.literal('word'),
    word: KoTextSchema,
    picture: PictureRefSchema.optional(),
    noteEn: z.string().max(80).optional(),
  }),
]);
export type DiscoverItem = z.infer<typeof DiscoverItemSchema>;

export const DiscoverPageSchema = z.object({
  /** Never more than two new things on one page. */
  items: z.array(DiscoverItemSchema).min(1).max(2),
  captionEn: z.string().max(90).optional(),
});
export type DiscoverPage = z.infer<typeof DiscoverPageSchema>;

export const DiscoverSchema = z.object({ pages: z.array(DiscoverPageSchema).min(1).max(3) });
export type Discover = z.infer<typeof DiscoverSchema>;

export const QuestStepSchema = z.object({
  id: z.string(),
  kind: QuestStepKindSchema,
  titleEn: z.string(),
  bodyEn: z.string().optional(),
  hoyaLineEn: z.string().optional(),
  minigameKind: MinigameKindSchema.optional(),
  minigameRef: z.string().optional(),
  discover: DiscoverSchema.optional(),
  durationSeconds: z.number().int().positive().optional(),
});

export type QuestStep = z.infer<typeof QuestStepSchema>;

const SCORED_KINDS: ReadonlySet<QuestStepKind> = new Set(['practice', 'apply', 'check']);

export const QuestSchema = z
  .object({
    id: z.string().regex(/^quest:[a-z0-9-]+$/),
    titleEn: z.string(),
    blurbEn: z.string().optional(),
    /** One plain line for the "Next up" card on Results (F-QUEST-002 §3.5). */
    teaserEn: z.string().max(70).optional(),
    estimatedMinutes: z.number().int().min(3).max(15),
    steps: z.array(QuestStepSchema).min(3).max(7),
    rewardCardId: z.string().optional(),
  })
  .superRefine((quest, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['steps', ...path], message });
    const { steps } = quest;

    steps.forEach((step, i) => {
      if (step.kind === 'discover') {
        if (!step.discover) issue([i, 'discover'], 'a discover step needs its discover pages');
        if (step.minigameKind) issue([i, 'minigameKind'], 'a discover step has no minigame');
        if (step.minigameRef) issue([i, 'minigameRef'], 'a discover step has no minigame');
      } else if (step.discover) {
        issue([i, 'discover'], 'only a discover step carries discover pages');
      }
      if (step.kind === 'check') {
        if (!step.minigameKind) issue([i, 'minigameKind'], 'a check step needs a minigameKind');
        if (!step.minigameRef) issue([i, 'minigameRef'], 'a check step needs a minigameRef');
      }
    });

    const indexesOf = (kind: QuestStepKind) =>
      steps.flatMap((step, i) => (step.kind === kind ? [i] : []));
    const discoverAt = indexesOf('discover');
    const checkAt = indexesOf('check');
    discoverAt.slice(1).forEach((i) => issue([i, 'kind'], 'at most one discover step per quest'));
    checkAt.slice(1).forEach((i) => issue([i, 'kind'], 'at most one check step per quest'));

    const firstDiscover = discoverAt[0];
    if (firstDiscover !== undefined) {
      steps.forEach((step, i) => {
        if (i < firstDiscover && SCORED_KINDS.has(step.kind)) {
          issue([i, 'kind'], 'discover must come before practice, apply and check');
        }
      });
    }

    const rewardAt = indexesOf('reward');
    checkAt.forEach((c) => {
      const playedAfter = steps.some((s, i) => i > c && (s.kind === 'practice' || s.kind === 'apply'));
      const rewardBefore = rewardAt.some((r) => r < c);
      if (playedAfter || rewardBefore) {
        issue([c, 'kind'], 'check must come after practice and apply, and before reward');
      }
    });

    if (checkAt.length > 0 && !steps.some((s) => SCORED_KINDS.has(s.kind) && s.minigameRef)) {
      issue([], 'a quest with a check step needs at least one scored step');
    }
  });

export type Quest = z.infer<typeof QuestSchema>;
