import { z } from 'zod';

export const RaritySchema = z.enum(['common', 'uncommon', 'rare', 'legendary']);
export type Rarity = z.infer<typeof RaritySchema>;

export const ThemeKeySchema = z.enum(['letters', 'life', 'rites', 'nature', 'crafts']);
export type ThemeKey = z.infer<typeof ThemeKeySchema>;

export const StageKeySchema = z.enum([
  'stage1',
  'stage2',
  'stage3',
  'stage4',
  'stage5',
  'stage6',
  'stage7',
]);
export type StageKey = z.infer<typeof StageKeySchema>;

/**
 * The award rules a card can name (F-STORY-006 §3.1): finishing an episode,
 * finishing a whole stage, the welcome gift, or completing a set of story
 * cards. Anything else is a typo and fails validation, so a card can never
 * name a rule that no code honours.
 */
export const UNLOCKED_BY_PATTERN = /^(episode:[a-z0-9-]+|stage[1-7]-complete|first-launch|set:[a-z0-9-]+)$/;

/** The source of a story card's back-face fact: the fact's first source and how many others it has. */
export const CardCitationSchema = z.object({
  title: z.string().min(1),
  publisher: z.string().min(1),
  more: z.number().int().nonnegative().default(0),
});
export type CardCitation = z.infer<typeof CardCitationSchema>;

/**
 * Heritage Card — a collectible piece of Korean culture earned by completing
 * an episode or milestone. The primary reward of Hangul Route.
 */
export const HeritageCardSchema = z
  .object({
    id: z.string().regex(/^card:[a-z0-9-]+$/),
    titleEn: z.string(),
    subtitleKo: z.string().optional(),
    romanization: z.string().optional(),
    blurbEn: z.string(),
    factEn: z.string().optional(),
    theme: ThemeKeySchema,
    stage: StageKeySchema,
    rarity: RaritySchema,
    illustrationRef: z.string().optional(),
    unlockedBy: z.string().regex(UNLOCKED_BY_PATTERN),
    era: z.string().optional(),
    region: z.string().optional(),
    /** F-STORY-006 §3.2: the story a story card belongs to. */
    storyId: z.string().regex(/^story:[a-z0-9-]+$/).optional(),
    /** The set a story card counts toward. */
    setId: z.string().regex(/^set:[a-z0-9-]+$/).optional(),
    /** Resolves into the story's `facts[]`; `factEn` is that fact's claim, verbatim. */
    factId: z.string().optional(),
    citation: CardCitationSchema.optional(),
  })
  .refine(
    (card) => card.subtitleKo === undefined || (card.romanization !== undefined && card.romanization.length > 0),
    { path: ['romanization'], message: 'subtitleKo requires romanization (F-CNT-002 §3.5)' },
  )
  .superRefine((card, ctx) => {
    if (card.factId !== undefined && card.citation === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['citation'], message: 'factId requires citation (F-STORY-006 §3.2)' });
    }
    if (card.citation !== undefined && card.factId === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['factId'], message: 'citation requires factId (F-STORY-006 §3.2)' });
    }
    if ((card.factId !== undefined || card.citation !== undefined) && card.storyId === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['storyId'], message: 'factId and citation appear only on a story card (F-STORY-006 §3.2)' });
    }
  });

export type HeritageCard = z.infer<typeof HeritageCardSchema>;
export const HeritageCardListSchema = z.array(HeritageCardSchema);
