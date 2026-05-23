import { z } from 'zod';

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
      illustrationRef: z.string().optional(),
    }),
  ),
});

export const RoundSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('match-sound'), data: MatchSoundRoundSchema }),
  z.object({ kind: z.literal('build-letter'), data: BuildLetterRoundSchema }),
  z.object({ kind: z.literal('trace-stroke'), data: TraceStrokeRoundSchema }),
  z.object({ kind: z.literal('voice-echo'), data: VoiceEchoRoundSchema }),
  z.object({ kind: z.literal('card-match'), data: CardMatchRoundSchema }),
  z.object({ kind: z.literal('story-sequence'), data: StorySequenceRoundSchema }),
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
