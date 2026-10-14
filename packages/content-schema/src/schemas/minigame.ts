import { z } from 'zod';
import { ALLOMORPH_PAIRS, allomorph, slotEndingIssues } from '../hangul/allomorph';
import { isOneKeyFinal } from '../hangul/compose-typed';
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
  'story-read', // Discovery · story reader (F-STORY-002); a read, records no round
  'story-check', // Discovery · story comprehension check (F-STORY-003); data is StoryCheckSchema, not a Round
  // F-CURR-001 §3.10 (row C-1), additive. Sentence Builder is the existing `order-it`.
  'realia-read', // Discovery · find information in a drawn menu, ticket, sign or price card
  'type-hangul', // Construction · type on the in-app two-set Hangul keyboard
  'trace-word', // Construction · trace a whole syllable block or a two-syllable word
  'write-frame', // Construction · fill a sentence frame from a word bank ("my own sentence")
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

// ---- upper-stage rounds (F-CURR-001 §3.4, §3.6, §3.7; row C-1) -------------------------------

/** Hangul syllable blocks and single spaces only, no edge spaces: what a learner can compose on the keyboard. */
const COMPOSABLE_RE = /^[가-힣]+( [가-힣]+)*$/;
const isComposable = (ko: string): boolean => COMPOSABLE_RE.test(ko);

/**
 * Sentence Builder (`order-it`): the sentence's word tiles (어절, split at spaces)
 * tapped into order, with up to two distractor tiles and, in some rounds, a
 * particle choice on one tile (이 or 가, 을 or 를).
 */
export const OrderItRoundSchema = z
  .object({
    id: z.string().min(1),
    sentence: KoTextSchema,
    pictureRef: PictureRefSchema.optional(),
    distractors: z.array(KoTextSchema).max(2).default([]),
    particle: z
      .object({
        /** The tile (0-based, in sentence order) whose ending the learner picks. */
        tile: z.number().int().min(0),
        choices: z.tuple([KoTextSchema, KoTextSchema]),
      })
      .optional(),
  })
  .superRefine((round, ctx) => {
    const tiles = round.sentence.ko.split(' ');
    if (tiles.length < 2 || tiles.length > 6) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sentence', 'ko'], message: 'a sentence builds from 2-6 word tiles' });
    }
    // Compared without the sentence mark, as the game draws tiles: `먹어요` is the tile `먹어요.`.
    const bare = (ko: string): string => ko.replace(/[.?!]+$/, '');
    const words = tiles.map(bare);
    round.distractors.forEach((d, i) => {
      if (words.includes(bare(d.ko))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['distractors', i, 'ko'], message: 'a distractor tile is also a tile of the sentence' });
      }
    });
    const { particle } = round;
    if (particle) {
      const tile = tiles[particle.tile];
      const [a, b] = particle.choices;
      const fits = (c: string) => tile !== undefined && tile.replace(/[.?!]$/, '').endsWith(c);
      if (a.ko === b.ko || fits(a.ko) === fits(b.ko)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['particle'],
          message: 'exactly one particle choice ends the chosen tile',
        });
        return;
      }
      // The choices are an allomorph pair, and the one in the tile is the form that fits the
      // word before it: `사과을` with 을 or 를 is caught here, not by a learner.
      const pair = ALLOMORPH_PAIRS.find((p) => p === `${a.ko}/${b.ko}` || p === `${b.ko}/${a.ko}`);
      if (pair === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['particle', 'choices'], message: 'the particle choices are not an allomorph pair (e.g. 이 or 가)' });
        return;
      }
      const chosen = fits(a.ko) ? a.ko : b.ko;
      const stem = (tile as string).replace(/[.?!]$/, '').slice(0, -chosen.length);
      let right: string | null = null;
      try {
        right = allomorph(stem, pair);
      } catch {
        right = null;
      }
      if (right !== chosen) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sentence', 'ko'],
          message: `tile ${particle.tile} takes ${right ?? 'neither form'} after "${stem}", not ${chosen}`,
        });
      }
    }
  });
export type OrderItRound = z.infer<typeof OrderItRoundSchema>;

/**
 * The four realia layouts of the Realia Read sheet (row G-2, design/wireframes/minigame/realia-read.md):
 * a menu board, a train ticket, a trail sign and market price cards. A realia without a kind is
 * drawn as the plain sheet (the same lines on paper, never blank).
 */
export const REALIA_KINDS = ['menu', 'ticket', 'sign', 'price-card'] as const;
export const RealiaKindSchema = z.enum(REALIA_KINDS);
export type RealiaKind = z.infer<typeof RealiaKindSchema>;

/** Generic drawn goods above a price card (scene-art props `prop:realia-goods-*`, row G-2). */
export const REALIA_GOODS = ['apples', 'fan', 'hanji'] as const;

/** A line of a realia: its text, an optional value (a price, a time), and on a sign the way its board points. */
export const RealiaEntrySchema = z.object({
  id: z.string().min(1),
  text: KoTextSchema,
  value: KoTextSchema.optional(),
  /** A trail-sign board points this way (its arrow, its side and its accessible name). */
  dir: z.enum(['left', 'right']).optional(),
  /** On a price card, the goods drawn above it (decoration; the card text names them). */
  goods: z.enum(REALIA_GOODS).optional(),
});
export type RealiaEntry = z.infer<typeof RealiaEntrySchema>;

/** A drawn real-world text; every entry is also real text for the accessibility tree (F-CURR-001 §3.14). */
export const RealiaSchema = z.object({
  ref: z.string().regex(/^realia:[a-z0-9-]+$/),
  /** The layout and dressing (row G-2); absent: the plain sheet. */
  kind: RealiaKindSchema.optional(),
  title: KoTextSchema.optional(),
  /** E.g. a menu line and its price; read in order by a screen reader. */
  entries: z.array(RealiaEntrySchema).min(1).max(12),
  altEn: z.string().trim().min(1).max(140),
});
export type Realia = z.infer<typeof RealiaSchema>;

/** One Realia Read option: a Korean answer, a plain figure (no Hangul, e.g. "5,000") or a picture. */
export const RealiaOptionSchema = z
  .object({
    id: z.string().min(1),
    text: KoTextSchema.optional(),
    figure: z.string().trim().min(1).max(16).regex(/^[^ㄱ-ㆎ가-힣]+$/, 'a figure carries no Hangul; use text').optional(),
    pictureRef: PictureRefSchema.optional(),
    /** A picture's name in the UI language: its accessible name and its text fallback (row G-2). */
    labelEn: z.string().trim().min(1).max(40).optional(),
  })
  .refine((o) => [o.text, o.figure, o.pictureRef].filter((v) => v !== undefined).length === 1, 'an option is exactly one of text, figure or picture')
  .refine((o) => (o.pictureRef === undefined ? o.labelEn === undefined : o.labelEn !== undefined), {
    message: 'a picture option has a labelEn (its name and text fallback); other options have none',
    path: ['labelEn'],
  });

/** Realia Read: a question about the drawn text, answered by picking (F-CURR-001 §3.6). */
export const RealiaReadRoundSchema = z
  .object({
    id: z.string().min(1),
    questionEn: z.string().trim().min(1).max(90),
    /** The word the question is about, shown under it (`KoreanText`), e.g. 라면 for "How much is this?". */
    key: KoTextSchema.optional(),
    options: z.array(RealiaOptionSchema).min(2).max(4),
    answerId: z.string(),
    /**
     * The realia entry that holds the answer: ringed ("look here") after a second miss and marked
     * found with its gloss after the right answer (row G-2). Must be an entry of the scope's realia.
     */
    answerEntryId: z.string().min(1).optional(),
  })
  .superRefine((round, ctx) => {
    const ids = round.options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'option ids must be unique' });
    }
    if (!ids.includes(round.answerId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['answerId'], message: 'answerId must be one of the option ids' });
    }
  });
export type RealiaReadRound = z.infer<typeof RealiaReadRoundSchema>;

/**
 * Cross-checks of a Realia Read scope that one round cannot see: entry ids are unique, and every
 * round names its `answerEntryId`, an entry of the realia (without it the look-here ring and the
 * found line with its gloss never show; D-2 Notes for C-1). Messages carry their path.
 */
export function realiaReadIssues(realia: Realia, rounds: readonly RealiaReadRound[]): Array<{ path: (string | number)[]; message: string }> {
  const out: Array<{ path: (string | number)[]; message: string }> = [];
  const ids = realia.entries.map((e) => e.id);
  if (new Set(ids).size !== ids.length) out.push({ path: ['realia', 'entries'], message: 'realia entry ids must be unique' });
  rounds.forEach((round, i) => {
    if (round.answerEntryId === undefined) {
      out.push({ path: ['rounds', i, 'answerEntryId'], message: 'every round names its answer entry (answerEntryId)' });
    } else if (!ids.includes(round.answerEntryId)) {
      out.push({ path: ['rounds', i, 'answerEntryId'], message: `answerEntryId "${round.answerEntryId}" is not an entry of the realia` });
    }
  });
  return out;
}

/** Type Hangul: type a short word or phrase on the in-app keyboard; checked by syllable after Done (F-CURR-001 §3.7). */
export const TypeHangulRoundSchema = z.object({
  id: z.string().min(1),
  promptEn: z.string().trim().min(1).max(90),
  pictureRef: PictureRefSchema.optional(),
  target: KoTextSchema.refine((t) => isComposable(t.ko) && t.ko.length <= 12, {
    message: 'a typed target is 1-12 characters of Hangul syllables and single spaces',
    path: ['ko'],
  }),
});
export type TypeHangulRound = z.infer<typeof TypeHangulRoundSchema>;

/** Trace a Word: one syllable block or a two-syllable word over a ghost, at the relaxed tolerance. */
export const TraceWordRoundSchema = z.object({
  id: z.string().min(1),
  word: KoTextSchema.refine((t) => /^[가-힣]{1,2}$/.test(t.ko), {
    message: 'a traced word is one or two Hangul syllable blocks',
    path: ['ko'],
  }),
  tolerancePx: z.number().int().positive().optional(),
});
export type TraceWordRound = z.infer<typeof TraceWordRoundSchema>;

/** One tile of the name round's sound table: a whole syllable block, or a final letter (F-CURR-001 §3.7, row G-5). */
const SoundTileSchema = z.object({ ko: z.string().min(1), romanization: z.string().trim().min(1).max(12) });

/**
 * The short sound table of the free-entry name round (Write Your Name q3, design/wireframes/minigame/write-frame.md):
 * groups of whole syllable blocks, each tile adding its block to the name, and the "at the end" letters, each adding
 * a final to the last block. The content (which sounds) is row S7-1's; the shape is G-5's.
 */
export const SoundTableSchema = z.object({
  groups: z
    .array(
      z
        .array(SoundTileSchema.refine((t) => /^[가-힣]$/.test(t.ko), { message: 'a block tile is one Hangul syllable block', path: ['ko'] }))
        .min(1)
        .max(14),
    )
    .min(1)
    .max(6),
  finals: z
    .array(
      // One keyboard letter that can close a block: the tile sends that one key, so a double final (ㄳ, ㄺ) is two tiles' worth.
      SoundTileSchema.refine((t) => isOneKeyFinal(t.ko), {
        message: 'a final tile is one keyboard letter that can close a block',
        path: ['ko'],
      }),
    )
    .max(8),
}).superRefine((table, ctx) => {
  // Every tile once: a tile is named (and found) by its Korean.
  const seen = new Set<string>();
  [...table.groups.flat(), ...table.finals].forEach((t) => {
    if (seen.has(t.ko)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `the sound table lists ${t.ko} twice` });
    seen.add(t.ko);
  });
});
export type SoundTable = z.infer<typeof SoundTableSchema>;

/**
 * Write Frame: a frame with one or two slots (`___`, each written with its
 * particle or ending, e.g. `___을/를`, `___이에요/예요`, `___에`), a word bank per
 * slot (any pick is right), then the picked word typed or traced. `freeEntry`
 * marks the one round composed without a bank (Write Your Name q3): unscored,
 * held in component state only (F-CURR-001 §3.7).
 */
export const WriteFrameRoundSchema = z
  .object({
    id: z.string().min(1),
    frame: KoTextSchema,
    slots: z
      .array(z.object({ id: z.string().min(1), bank: z.array(KoTextSchema).max(6).default([]) }))
      .min(1)
      .max(2),
    entry: z.enum(['type', 'trace', 'pick']),
    freeEntry: z.boolean().default(false),
    /** The name round's Blocks tab; only a free-entry round has one. */
    soundTable: SoundTableSchema.optional(),
  })
  .superRefine((round, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    const slots = round.frame.ko.split('___').length - 1;
    if (slots !== round.slots.length) issue(['frame', 'ko'], `the frame has ${slots} slot(s) but ${round.slots.length} slot entries`);
    round.slots.forEach((slot, i) => {
      if (round.freeEntry) {
        if (slot.bank.length > 0) issue(['slots', i, 'bank'], 'a free-entry slot has no word bank');
      } else if (slot.bank.length < 2) {
        issue(['slots', i, 'bank'], 'a word bank holds 2-6 taught words');
      }
      slot.bank.forEach((w, j) => {
        if (!isComposable(w.ko)) issue(['slots', i, 'bank', j, 'ko'], 'a bank word is Hangul syllables only');
      });
    });
    if (round.freeEntry && round.slots.length !== 1) issue(['slots'], 'a free-entry round has exactly one slot');
    if (!round.freeEntry && round.soundTable !== undefined) issue(['soundTable'], 'only a free-entry round has a sound table');
    // Each slot is followed by a known pair, a single form or nothing, and every bank word is
    // Hangul syllables (above), so `fillFrame` fills every pick as correct Korean: the form of a
    // pair is chosen from the pick's last syllable (a test fills every bank word of a sound frame).
    slotEndingIssues(round.frame.ko).forEach((message) => issue(['frame', 'ko'], message));
  });
export type WriteFrameRound = z.infer<typeof WriteFrameRoundSchema>;

export const RoundSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('match-sound'), data: MatchSoundRoundSchema }),
  z.object({ kind: z.literal('build-letter'), data: BuildLetterRoundSchema }),
  z.object({ kind: z.literal('trace-stroke'), data: TraceStrokeRoundSchema }),
  z.object({ kind: z.literal('voice-echo'), data: VoiceEchoRoundSchema }),
  z.object({ kind: z.literal('card-match'), data: CardMatchRoundSchema }),
  z.object({ kind: z.literal('story-sequence'), data: StorySequenceRoundSchema }),
  z.object({ kind: z.literal('listen-pick'), data: ListenPickRoundSchema }),
  z.object({ kind: z.literal('pic-word-match'), data: PicWordRoundSchema }),
  z.object({ kind: z.literal('order-it'), data: OrderItRoundSchema }),
  z.object({ kind: z.literal('realia-read'), data: RealiaReadRoundSchema }),
  z.object({ kind: z.literal('type-hangul'), data: TypeHangulRoundSchema }),
  z.object({ kind: z.literal('trace-word'), data: TraceWordRoundSchema }),
  z.object({ kind: z.literal('write-frame'), data: WriteFrameRoundSchema }),
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
