import { z } from 'zod';
import { PictureRefSchema } from '../schemas/ko-text';

/**
 * The built question the player renders (F-PLC-001 section 3.3). Korean text
 * is data, never typed here; taught Korean keeps its romanization and gloss
 * (KoTextSchema, schemas/ko-text.ts).
 */
export const ASSESSMENT_FORMATS = [
  'shape-odd-one-out', // pick the tile that differs (visual only)
  'hear-pick-written', // hear a sound / syllable / word, pick the written form
  'see-pick-sound', // see a symbol or syllable, pick its sound chip
  'build-syllable', // tap tiles into the blocks (explicit jamo ids)
  'hear-pick-picture', // hear a word or sentence, pick the picture
  'read-pick-picture', // read a word or sentence, pick the picture
  'reply-pick', // hear a line, pick the written reply
] as const;

/** `skipped` covers "I am not sure" and every unanswered question: never `wrong`. There is no `timeout`. */
export const OutcomeSchema = z.enum(['correct', 'wrong', 'skipped']);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const AssessmentOptionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    ko: z.string().optional(),
    romanization: z.string().optional(),
    /** Gloss / accessible label, never shown on the item. */
    en: z.string().optional(),
    pictureRef: PictureRefSchema.optional(),
    /** Latin sound chip: language-neutral. */
    sound: z.string().regex(/^[a-z]{1,8}$/).optional(),
    isCorrect: z.boolean(),
  })
  .refine(
    (o) => o.ko !== undefined || o.pictureRef !== undefined || o.sound !== undefined,
    'an option needs Korean, a picture or a sound chip',
  );
export type AssessmentOption = z.infer<typeof AssessmentOptionSchema>;

export const AssessmentQuestionShape = z.object({
  /** Template id, or an item id of a review. */
  id: z.string(),
  format: z.enum(ASSESSMENT_FORMATS),
  promptKo: z.string().optional(),
  promptRomanization: z.string().optional(),
  /** What the voice says (F-AUDIO-004: `spokenKo` wins over `promptKo`). */
  spokenKo: z.string().optional(),
  audioRef: z.string().optional(),
  options: z.array(AssessmentOptionSchema).min(2).max(4),
  tags: z.array(z.string()).max(8),
  requires: z.object({
    audio: z.boolean(),
    picture: z.enum(['card', 'word']).nullable(),
  }),
  /** True: showing romanization or a gloss would give the answer away. */
  leaks: z.boolean(),
});

/**
 * The cross-field rules of a built question. Exported so a bank template
 * (whose question carries no `id` of its own) can re-apply them to
 * `AssessmentQuestionShape.omit({ id: true })`: a `ZodEffects` has no `.omit`.
 *
 * Two options never share Korean text or a picture, except that the tiles of a
 * `shape-odd-one-out` question repeat one letter by design (three show it, one
 * differs); their ids stay unique and exactly one is correct.
 */
export const refineAssessmentQuestion = (
  q: { format: (typeof ASSESSMENT_FORMATS)[number]; options: readonly AssessmentOption[] },
  ctx: z.RefinementCtx,
): void => {
  const repeatsAllowed = q.format === 'shape-odd-one-out';
  if (q.options.filter((o) => o.isCorrect).length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'exactly one option must be correct',
    });
  }
  const ids = new Set<string>();
  const kos = new Set<string>();
  const pictures = new Set<string>();
  q.options.forEach((o, i) => {
    if (ids.has(o.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options', i, 'id'], message: 'option ids must be unique' });
    }
    ids.add(o.id);
    if (o.ko !== undefined) {
      if (kos.has(o.ko) && !repeatsAllowed) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options', i, 'ko'], message: 'two options share the same Korean text' });
      }
      kos.add(o.ko);
    }
    if (o.pictureRef !== undefined) {
      if (pictures.has(o.pictureRef)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options', i, 'pictureRef'], message: 'two options share the same picture' });
      }
      pictures.add(o.pictureRef);
    }
  });
};

export const AssessmentQuestionSchema = AssessmentQuestionShape.superRefine(refineAssessmentQuestion);
export type AssessmentQuestion = z.infer<typeof AssessmentQuestionSchema>;

export const AssessmentResponseSchema = z.object({
  questionId: z.string(),
  outcome: OutcomeSchema,
  chosenOptionId: z.string().nullable(),
  /** The sound guide was revealed before answering. */
  assisted: z.boolean().default(false),
  ms: z.number().int().nonnegative().max(600_000),
});
export type AssessmentResponse = z.infer<typeof AssessmentResponseSchema>;
