import { z } from 'zod';
import { AudioRefSchema } from './audio';
import { EpisodeStatusSchema } from './episode';
import { KoTextSchema, PictureRefSchema } from './ko-text';

/**
 * Vocabulary schemas (F-VOC-001 §3.1). Taught words are flat `KoText`-shaped
 * objects (`ko` + `romanization` + `en`) plus metadata, so one item can be handed
 * to `KoreanText`, `playPrompt` and Listen & Pick unchanged. The JSON in
 * `content/vocab/` is parsed with these schemas by the content suites.
 */

export const VOCAB_TOPIC_KEYS = [
  'food',
  'animals',
  'family',
  'school',
  'body',
  'colors',
  'numbers',
  'nature',
  'travel',
  'sports',
  'k-culture',
  'science',
] as const; // v1.1 appends: 'numbers-sino', 'home', 'weather', 'clothes', 'feelings', 'actions' (additive)
export const VocabTopicKeySchema = z.enum(VOCAB_TOPIC_KEYS);
export type VocabTopicKey = z.infer<typeof VocabTopicKeySchema>;

export const VocabIdSchema = z.string().regex(/^vocab:[a-z0-9]+(-[a-z0-9]+)*$/);
export type VocabId = z.infer<typeof VocabIdSchema>;

// launch: noun | number, plus `pronoun` for 나 only
export const VocabPosSchema = z.enum(['noun', 'pronoun', 'verb', 'adjective', 'number', 'expression']);
export type VocabPos = z.infer<typeof VocabPosSchema>;

/**
 * Words a learner must never read (same list as `scripts/validate-content.mjs`
 * and `packages/i18n/src/banned-words.json` `en.learner`; `content-schema` cannot
 * import either) plus the age words F-VOC-001 §3.8 forbids in vocabulary copy.
 */
export const VOCAB_BANNED_LEARNER_WORDS = ['missed', 'incomplete', 'failed', 'overdue'] as const;
export const VOCAB_AGE_WORDS = ['kids', 'children', 'ages', 'baby talk'] as const;

const BANNED_WORDS: readonly string[] = [...VOCAB_BANNED_LEARNER_WORDS, ...VOCAB_AGE_WORDS];
const BANNED_ENTRIES: readonly { word: string; re: RegExp }[] = BANNED_WORDS.map((word) => ({
  word,
  re: new RegExp(`\\b${word.replace(/ /g, '\\s+')}\\b`, 'i'),
}));

/** First banned learner or age word in `text` (word-boundary, case-insensitive), else null. */
export function findVocabBannedWord(text: string): string | null {
  for (const { word, re } of BANNED_ENTRIES) {
    if (re.test(text)) return word;
  }
  return null;
}

const HANGUL_RE = /\p{Script=Hangul}/u;
const KO_WORDS_RE = /^[가-힣]+( [가-힣]+)*$/;

/** A learner-facing English field: no Hangul (F-CNT-001 `korean-in-ui-field`), no banned word. */
function checkLearnerEnglish(
  value: string | undefined,
  path: (string | number)[],
  ctx: z.RefinementCtx,
): void {
  if (value === undefined) return;
  if (HANGUL_RE.test(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'learner English must not contain Hangul' });
  }
  const banned = findVocabBannedWord(value);
  if (banned !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `banned learner word: ${banned}` });
  }
}

export const VocabItemSchema = z
  .object({
    id: VocabIdSchema,
    /** Hangul syllables and single spaces only (refined below). */
    ko: z.string().min(1).max(12),
    /** Revised Romanization, unhyphenated; checked by F-CNT-002 in the content suite. */
    romanization: z.string().min(1).max(40),
    /** Base English gloss; no Hangul; banned-word scanned. */
    en: z.string().min(1).max(40),
    pos: VocabPosSchema.default('noun'),
    /** topics[0] = primary = the file the item lives in. */
    topics: z.array(VocabTopicKeySchema).min(1).max(3),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    /** 'card:*' or 'word:*' (never 'swatch:*', V8). */
    visual: PictureRefSchema,
    /** Plain English, no Hangul; say who/when. */
    senseNote: z.string().max(90).optional(),
    senseGroup: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    /** What the voice says when it differs from `ko` (F-AUDIO-004). */
    spokenKo: z.string().min(1).optional(),
    /** audio/vocab/<slug>.mp3 where <slug> = id without 'vocab:'. */
    audioRef: AudioRefSchema.optional(),
    /** Level 2+; v1.1 for most words. */
    example: z.object({ ko: z.string(), romanization: z.string(), en: z.string() }).optional(),
  })
  .superRefine((item, ctx) => {
    // 1. completed syllables only
    if (!KO_WORDS_RE.test(item.ko)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ko'],
        message: 'ko must be completed Hangul syllables separated by single spaces',
      });
    }
    // 3. card: or word: only
    if (item.visual.startsWith('swatch:')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['visual'], message: 'visual must be card: or word:' });
    }
    // 4. the item's own audio slug
    if (item.audioRef !== undefined && item.audioRef !== `audio/vocab/${item.id.slice('vocab:'.length)}.mp3`) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['audioRef'],
        message: 'audioRef must be audio/vocab/<id without vocab:>.mp3',
      });
    }
    // 5. learner English
    checkLearnerEnglish(item.en, ['en'], ctx);
    checkLearnerEnglish(item.senseNote, ['senseNote'], ctx);
    // 2. (sense suffix against _senses.json) and 6. (topics[0] against the file) are file-level (§3.8).
  });

export const VocabTopicSchema = z
  .object({
    /** = `vocab-topic:${key}` (refined below); the entity id overlays and `overlay-unknown-id` look up. */
    id: z.string().regex(/^vocab-topic:[a-z0-9]+(-[a-z0-9]+)*$/),
    key: VocabTopicKeySchema,
    order: z.number().int().min(1).max(99),
    titleEn: z.string().min(1).max(24),
    /** e.g. 음식 / eumsik / food, shown with KoreanText on the tile. */
    titleKo: KoTextSchema,
    /** One plain line; no age words. */
    blurbEn: z.string().max(70),
    hoyaIntroEn: z.string().max(90),
    tint: z.enum(['theme.letters', 'theme.life', 'theme.rites', 'theme.nature', 'theme.crafts', 'stage.stage2']),
    /** The tile picture = that item's visual. */
    coverItemId: VocabIdSchema,
    status: EpisodeStatusSchema,
    /** true: flashcard chunks keep file order (colors, numbers). */
    fixedOrder: z.boolean().default(false),
  })
  .superRefine((topic, ctx) => {
    if (topic.id !== `vocab-topic:${topic.key}`) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['id'], message: 'id must equal vocab-topic:<key>' });
    }
    checkLearnerEnglish(topic.titleEn, ['titleEn'], ctx);
    checkLearnerEnglish(topic.blurbEn, ['blurbEn'], ctx);
    checkLearnerEnglish(topic.hoyaIntroEn, ['hoyaIntroEn'], ctx);
  });

export const VocabTopicFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    topic: VocabTopicSchema,
    /** Launch: exactly 12 (a content test, not the schema, so v1.1 can grow). */
    items: z.array(VocabItemSchema).min(8).max(60),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    file.items.forEach((item, index) => {
      if (seen.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index, 'id'],
          message: `duplicate item id ${item.id}`,
        });
      }
      seen.add(item.id);
    });
    if (!seen.has(file.topic.coverItemId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['topic', 'coverItemId'],
        message: 'coverItemId must be an item of this file',
      });
    }
  });

/** `content/vocab/_senses.json`. Holds no Korean string: the homonym's Hangul is read from the items. */
export const VocabSensesFileSchema = z.object({
  schemaVersion: z.literal(1),
  groups: z.array(
    z.object({
      group: z.string().regex(/^[a-z0-9-]+$/),
      members: z
        .array(z.object({ id: VocabIdSchema, en: z.string(), state: z.enum(['launch', 'reserved']) }))
        .min(1),
    }),
  ),
});

export type VocabItem = z.infer<typeof VocabItemSchema>;
export type VocabTopic = z.infer<typeof VocabTopicSchema>;
export type VocabTopicFile = z.infer<typeof VocabTopicFileSchema>;
export type VocabSensesFile = z.infer<typeof VocabSensesFileSchema>;

/** Runtime view assembled by the generator (§3.7): the item plus its glosses in every shipped locale. */
export interface RuntimeVocabItem extends VocabItem {
  glosses: { en: string; es?: string; ko?: string };
}
