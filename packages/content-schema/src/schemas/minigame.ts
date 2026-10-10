import { z } from 'zod';
import { KoTextSchema, PictureRefSchema } from './ko-text';

/**
 * Minigame catalog — 4 families × 12 games (see docs/blueprints/06).
 * MVP build implements `recognition`, `construction`, `interaction`,
 * `discovery` with at least one game each.
 */
export const MinigameFamilySchema = z.enum([
  'recognition',
  'construction',
  'interaction',
  'discovery',
]);
export type MinigameFamily = z.infer<typeof MinigameFamilySchema>;

export const MinigameKindSchema = z.enum([
  'match-sound', // Recognition · ①
  'match-shape', // Recognition · ②
  'odd-one-out', // Recognition · ③
  'build-letter', // Construction · ④
  'trace-stroke', // Construction · ⑤
  'syllable-build', // Construction · ⑥
  'voice-echo', // Interaction · ⑦
  'tap-respond', // Interaction · Tap to Respond (dialogue)
  'tap-rhythm', // Interaction · ⑧
  'order-it', // Interaction · ⑨
  'card-match', // Discovery · ⑩
  'story-sequence', // Discovery · ⑪
  'culture-quiz', // Discovery · ⑫
  'listen-pick', // Recognition · ③ (F-QUEST-002)
  'pic-word-match', // Recognition · ② (F-QUEST-002)
]);
export type MinigameKind = z.infer<typeof MinigameKindSchema>;

export const MatchSoundRoundSchema = z.object({
  promptJamoId: z.string(),
  tileJamoIds: z.array(z.string()).min(2).max(4),
});

export const BuildLetterRoundSchema = z.object({
  targetSyllableKo: z.string().min(1).max(3),
  romanization: z.string(),
  componentJamoIds: z.array(z.string()).min(2).max(3),
  distractorJamoIds: z.array(z.string()).min(0).max(4),
});

export const TraceStrokeRoundSchema = z.object({
  jamoId: z.string(),
  strokeCount: z.number().int().min(1).max(8),
  tolerancePx: z.number().int().positive(),
});

export const VoiceEchoRoundSchema = z.object({
  promptKo: z.string(),
  romanization: z.string(),
  expectedConfidence: z.number().min(0).max(1),
});

export const CardMatchRoundSchema = z.object({
  pairs: z.array(
    z.object({
      ko: z.string(),
      en: z.string(),
      illustrationRef: z.string().optional(),
    }),
  ),
});

export const StorySequenceRoundSchema = z.object({
  steps: z.array(
    z.object({
      id: z.string(),
      labelEn: z.string(),
      labelKo: z.string().optional(),
      /** Revised Romanization of labelKo (F-CNT-002 §3.5; values land in PR 2b). */
      romanization: z.string().min(1).optional(),
      illustrationRef: z.string().optional(),
    }),
  ),
});

/** Listen & Pick (F-QUEST-002 §3.10): hear a prompt, pick how it is written or what it shows. */
export const ListenPickOptionSchema = z
  .object({
    id: z.string(),
    text: KoTextSchema.optional(),
    pictureRef: PictureRefSchema.optional(),
    /** Visible label under a picture and its accessible name. */
    labelEn: z.string().max(40).optional(),
  })
  .refine((o) => Boolean(o.text) || Boolean(o.pictureRef), 'an option needs text or a picture');

export const ListenPickRoundSchema = z
  .object({
    id: z.string(),
    /** Spoken: prompt.spokenKo ?? prompt.ko (or audioRef). */
    prompt: KoTextSchema,
    options: z.array(ListenPickOptionSchema).min(2).max(4),
    answerId: z.string(),
  })
  .superRefine((round, ctx) => {
    const ids = new Set<string>();
    const texts = new Set<string>();
    const pictures = new Set<string>();
    round.options.forEach((option, i) => {
      if (ids.has(option.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options', i, 'id'], message: 'option ids must be unique' });
      }
      ids.add(option.id);
      if (option.text) {
        if (texts.has(option.text.ko)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['options', i, 'text', 'ko'],
            message: 'two options share the same Korean text',
          });
        }
        texts.add(option.text.ko);
      }
      if (option.pictureRef) {
        if (pictures.has(option.pictureRef)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['options', i, 'pictureRef'],
            message: 'two options share the same picture',
          });
        }
        pictures.add(option.pictureRef);
      }
    });
    if (!ids.has(round.answerId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['answerId'], message: 'answerId must be one of the option ids' });
    }
  });
export type ListenPickRound = z.infer<typeof ListenPickRoundSchema>;

/** Pic-Word Match (F-QUEST-002 §3.11): pair 3-5 pictures with their Korean words. */
export const PicWordPairSchema = z.object({
  id: z.string(),
  pictureRef: PictureRefSchema.optional(),
  word: KoTextSchema,
});
export type PicWordPair = z.infer<typeof PicWordPairSchema>;

export const PicWordRoundSchema = z
  .object({ pairs: z.array(PicWordPairSchema).min(3).max(5) })
  .superRefine((board, ctx) => {
    const ids = new Set<string>();
    const words = new Set<string>();
    const pictures = new Set<string>();
    board.pairs.forEach((pair, i) => {
      if (ids.has(pair.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pairs', i, 'id'], message: 'pair ids must be unique' });
      }
      ids.add(pair.id);
      if (words.has(pair.word.ko)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pairs', i, 'word', 'ko'], message: 'two pairs share a word' });
      }
      words.add(pair.word.ko);
      if (pair.pictureRef) {
        if (pictures.has(pair.pictureRef)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['pairs', i, 'pictureRef'],
            message: 'two pairs share a picture',
          });
        }
        pictures.add(pair.pictureRef);
      }
    });
  });
export type PicWordRound = z.infer<typeof PicWordRoundSchema>;

export const RoundSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('match-sound'), data: MatchSoundRoundSchema }),
  z.object({ kind: z.literal('build-letter'), data: BuildLetterRoundSchema }),
  z.object({ kind: z.literal('trace-stroke'), data: TraceStrokeRoundSchema }),
  z.object({ kind: z.literal('voice-echo'), data: VoiceEchoRoundSchema }),
  z.object({ kind: z.literal('card-match'), data: CardMatchRoundSchema }),
  z.object({ kind: z.literal('story-sequence'), data: StorySequenceRoundSchema }),
  z.object({ kind: z.literal('listen-pick'), data: ListenPickRoundSchema }),
  z.object({ kind: z.literal('pic-word-match'), data: PicWordRoundSchema }),
]);
export type Round = z.infer<typeof RoundSchema>;

export const MinigameSchema = z.object({
  id: z.string().regex(/^minigame:[a-z0-9-]+$/),
  kind: MinigameKindSchema,
  family: MinigameFamilySchema,
  titleEn: z.string(),
  blurbEn: z.string(),
  rounds: z.array(RoundSchema).min(1),
});

export type Minigame = z.infer<typeof MinigameSchema>;
