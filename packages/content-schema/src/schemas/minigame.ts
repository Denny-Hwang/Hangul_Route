import { z } from 'zod';
import { ALLOMORPH_PAIRS, allomorph, slotEndingIssues } from '../hangul/allomorph';
import { isOneKeyFinal } from '../hangul/compose-typed';
import { syllableBuildIssues } from '../hangul/syllable-build';
import { AudioRefSchema } from './audio';
import { KoTextSchema, KoTextShape, PictureRefSchema, refineKoText } from './ko-text';
import { RolePlaySceneSchema } from './role-play';
import { ART_CANVAS } from './scene-art';

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
  // F-CURR-002 §7.1 F1 (row CM-30), additive: read a sentence with one gap, pick the tile that fills it.
  'cloze-pick', // Recognition · Cloze Pick (fallback: Listen & Pick with a text prompt)
  // F-CURR-002 §7.1 (row CM-34), additive.
  'story-order', // Discovery · put 3-5 Korean captions (with or without pictures) in order; fallback Story Sequence
  // F-CURR-002 §7.1 (row CM-35), additive.
  'role-play', // Interaction · a branching chat, read and tap a reply (fallback: Tap to Respond on the same turns)
  'hidden-heritage', // Discovery · ⑩ find the named things in a large scene (F-CURR-002 §7.1 F7, row CM-36)
  // F-CURR-002 §7.1 F8 (row CM-38), additive.
  'my-story', // Construction · 3-5 chained word-bank frames make a short text, shown as My page and not kept
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
    /**
     * F-CURR-002 section 4.5 (row CM-31): the read-plus-meaning spelling round of Letters S2. The prompt's meaning
     * (`prompt.en`, in the UI language) and its picture are shown with the sound, and the options are spellings that
     * may sound the same (책이 and 채기 are both [채기]); the meaning or the picture is what settles it.
     */
    promptKind: z.literal('spelling').optional(),
    /** A spelling round's picture of the word (shown above its meaning). */
    pictureRef: PictureRefSchema.optional(),
    /**
     * A spelling round's other options for its `game.spelling-pick` fallback (`spellingPickToListenPick`): taught words
     * that sound different from the answer, so every option left has one right answer by sound alone. The lint's
     * `dictation-unambiguous` checks the spelling round's shape (`spellingRoundIssues`, lesson-lint.ts), so these
     * rules stay out of the start bundle.
     */
    fallbackOptions: z.array(ListenPickOptionSchema).min(1).max(3).optional(),
    /**
     * F-CURR-002 section 7.1 (row CM-3A S2): Read Pick Meaning, the read rung of section 4.3. The prompt's Korean and its
     * romanization are shown as text and nothing is said before the answer (the word is said once after the right pick);
     * the options are meanings (pictures with their labels), never spellings. A scope's rounds are all read or all
     * heard. The lint checks the shape (`readPickRoundIssues`, lesson-lint.ts), so the start bundle carries only the field.
     */
    promptShown: z.literal(true).optional(),
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

/** Whether a Listen & Pick scope is Read Pick Meaning (row CM-3A S2): its rounds show their Korean prompt, none is heard. */
export function isReadPickScope(rounds: readonly ListenPickRound[]): boolean {
  return rounds.length > 0 && rounds.every((r) => r.promptShown === true);
}

/** Whether a Listen & Pick round is the spelling round of section 4.5 (row CM-31). */
export function isSpellingRound(round: Pick<ListenPickRound, 'promptKind'>): boolean {
  return round.promptKind === 'spelling';
}

/**
 * The `game.spelling-pick` fallback (row CM-31, design/wireframes/minigame/type-hangul.md): Listen & Pick on the same
 * word in its shipped audio prompt. The right spelling stays, the look-alike spellings go, and the round's fallback
 * options (taught words that sound different) take their place; no picture and no meaning, as Listen & Pick shows.
 * A round that is not a spelling round comes back as it is.
 */
export function spellingPickToListenPick(round: ListenPickRound): ListenPickRound {
  if (!isSpellingRound(round)) return round;
  const answer = round.options.find((o) => o.id === round.answerId);
  const options = [...(answer ? [answer] : []), ...(round.fallbackOptions ?? [])].slice(0, 4);
  return { id: round.id, prompt: round.prompt, options, answerId: round.answerId };
}

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
  /**
   * F-CURR-002 section 7.1 F2 (row CM-31), additive: `hear` is Dictation (hear the word, type it; its Korean and
   * romanization are hidden until Done). Absent is `see`, so every round written before it reads as before; a `see`
   * round with a `pictureRef` is the picture prompt. Only an item that passes `dictation-unambiguous` is heard.
   */
  mode: z.enum(['see', 'hear']).optional(),
  /** A recording of the word for `hear` (it wins over the device voice, F-AUDIO-004). */
  audioRef: AudioRefSchema.optional(),
  pictureRef: PictureRefSchema.optional(),
  target: KoTextSchema.refine((t) => isComposable(t.ko) && t.ko.length <= 12, {
    message: 'a typed target is 1-12 characters of Hangul syllables and single spaces',
    path: ['ko'],
  }),
});
export type TypeHangulRound = z.infer<typeof TypeHangulRoundSchema>;

/** A Type Hangul round's mode: an absent mode is `see` (rounds written before row CM-31). */
export function typeHangulMode(round: Pick<TypeHangulRound, 'mode'>): 'see' | 'hear' {
  return round.mode === 'hear' ? 'hear' : 'see';
}

/** Trace a Word: one syllable block or a two-syllable word over a ghost, at the relaxed tolerance. */
export const TraceWordRoundSchema = z.object({
  id: z.string().min(1),
  word: KoTextSchema.refine((t) => /^[가-힣]{1,2}$/.test(t.ko), {
    message: 'a traced word is one or two Hangul syllable blocks',
    path: ['ko'],
  }),
  tolerancePx: z.number().int().positive().optional(),
  /**
   * `block` (default): the whole block over its placed ghost; `letter`: one letter at a time
   * in its zone, for a block whose placed ghost reads poorly at block size (F-CURR-001 §9
   * assumption 3, row G-4).
   */
  mode: z.enum(['block', 'letter']).optional(),
});
export type TraceWordRound = z.infer<typeof TraceWordRoundSchema>;

/** One tile of the name round's sound table: a whole syllable block, or a final letter (F-CURR-001 §3.7, row G-5). */
// `en` is the content gloss every Korean item carries (validate-content korean-without-gloss); the tile draws only ko and romanization.
const SoundTileSchema = z.object({ ko: z.string().min(1), romanization: z.string().trim().min(1).max(12), en: z.string().trim().min(1).optional() });

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
    // Ten groups: the vowels, one row per vowel (ㅏ ㅐ ㅓ ㅔ ㅗ ㅜ ㅡ ㅣ) and the y and w sounds (S7-1 pass 4).
    .max(10),
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
export const WriteFrameRoundShape = z.object({
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
});

/**
 * The rules of a Write Frame round, shared with the frames of My Story (F-CURR-002 row CM-38), which
 * extend the shape (a `ZodEffects` has no `.extend`).
 */
export function writeFrameRoundRules(round: z.infer<typeof WriteFrameRoundShape>, ctx: z.RefinementCtx): void {
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
}

export const WriteFrameRoundSchema = WriteFrameRoundShape.superRefine(writeFrameRoundRules);
export type WriteFrameRound = z.infer<typeof WriteFrameRoundSchema>;

// ---- Cloze Pick (F-CURR-002 §7.1 F1, row CM-30) ------------------------------------------------

/** The gap of a Cloze Pick sentence; the same `___` as `SLOT_MARKER` in `schemas/quest` (a test checks). */
export const CLOZE_GAP = '___';
const gapsIn = (text: string): number => text.split(CLOZE_GAP).length - 1;

/**
 * What the gap holds (design/wireframes/minigame/cloze-pick.md): a taught word, a particle or ending
 * (`물___ 마셔요.` with 을 / 를 / 이), or a value read from the scope's realia card (`___ 원이에요.`,
 * the produce rung of a `rea` item, §4.3).
 */
export const CLOZE_GAP_KINDS = ['word', 'particle', 'value'] as const;
export const ClozeGapKindSchema = z.enum(CLOZE_GAP_KINDS);
export type ClozeGapKind = z.infer<typeof ClozeGapKindSchema>;

/**
 * Cloze Pick: one Korean sentence with one gap (`___` in `ko` and in `romanization`) and 3 or 4
 * tiles; exactly the tile at `answerIndex` fills it. `en` is the sentence's meaning in full (a word
 * or particle gap: the meaning is the input the round reads from, D3), or with the gap kept for a
 * value gap (`It is ___ won.`), whose value is read from the card. `filledRomanization` is the
 * completed sentence's romanization when it is not the gap's text filled with the tile's (a
 * particle links to the word before it: `mul___` with `eul` reads `mureul`); a particle gap needs it.
 * Tiles show Korean and romanization only; their `en` is the content gloss every Korean item carries.
 */
/**
 * A Cloze Pick tile: taught Korean, and `soundChange: true` when its standard pronunciation differs from the spelling in a
 * way `hasSoundChange` does not model (할게 [할께], tensification after the -ㄹ ending; row CM-42 S4 review fix), so the
 * review item it teaches is never offered as Dictation (F-CURR-002 section 4.5). The game itself ignores the flag.
 */
export const ClozePickTileSchema = KoTextShape.extend({ soundChange: z.literal(true).optional() }).superRefine(refineKoText);

export const ClozePickRoundSchema = z
  .object({
    id: z.string().min(1),
    sentence: KoTextSchema,
    gapKind: ClozeGapKindSchema.default('word'),
    tiles: z.array(ClozePickTileSchema).min(3).max(4),
    answerIndex: z.number().int().min(0),
    filledRomanization: z.string().trim().min(1).optional(),
  })
  .superRefine((round, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    const { sentence: s, tiles, gapKind } = round;
    if (gapsIn(s.ko) !== 1 || gapsIn(s.romanization) !== 1) issue(['sentence'], 'one gap (___) in the Korean and one in the romanization');
    if (gapsIn(s.en) !== (gapKind === 'value' ? 1 : 0)) issue(['sentence', 'en'], 'the meaning keeps the gap for a value gap only (It is ___ won.)');
    if (round.answerIndex >= tiles.length) issue(['answerIndex'], 'answerIndex must point at a tile');
    if (new Set(tiles.map((t) => t.ko)).size !== tiles.length || tiles.some((t) => gapsIn(t.ko) > 0)) issue(['tiles'], 'tiles differ and carry no gap');
    if (gapKind !== 'particle') return;
    if (round.filledRomanization === undefined) issue(['filledRomanization'], 'a particle gap gives the completed romanization (the particle links)');
    // The word before the gap picks the particle: `사과___` takes 를, so a round whose answer is 을 is caught here.
    const stem = (s.ko.split(CLOZE_GAP)[0] ?? '').split(' ').pop() ?? '';
    const answer = tiles[round.answerIndex]?.ko ?? '';
    const pair = ALLOMORPH_PAIRS.find((p) => p.split('/').includes(answer));
    if (!/[가-힣]$/.test(stem)) issue(['sentence', 'ko'], 'a particle gap follows its word (물___ 마셔요.)');
    else if (pair !== undefined && allomorph(stem, pair) !== answer) issue(['answerIndex'], `"${stem}" takes ${allomorph(stem, pair)}, not ${answer}`);
  });
export type ClozePickRound = z.infer<typeof ClozePickRoundSchema>;

/** The text with its one gap filled (`책을 ___.` with 읽어요 is `책을 읽어요.`). */
export const fillClozeGap = (text: string, fill: string): string => text.replace(CLOZE_GAP, fill);
/**
 * Story Order (F-CURR-002 §7.1 F5, row CM-34; design/wireframes/minigame/story-order.md): 3-5 panels, each
 * a Korean caption (one short line of taught words, with romanization and gloss) and, on an illustrated
 * round, its picture, listed in the RIGHT order (the game deranges them). The cards show the Korean and
 * its romanization only while the learner orders them; the gloss shows on Show meanings and in the replay.
 */
/**
 * A slug: the memory item id is `<round>/<panel>` and the gloss overlay key joins ids with `.`, so neither may hold one.
 */
const StoryOrderIdSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'a lowercase slug (letters, digits, hyphens)');

/** Strict: an unknown key (such as an `art` the game never draws) fails the build instead of being dropped. */
export const StoryOrderPanelSchema = z
  .object({
    id: StoryOrderIdSchema,
    caption: KoTextSchema,
    pictureRef: PictureRefSchema.optional(),
  })
  .strict();
export type StoryOrderPanel = z.infer<typeof StoryOrderPanelSchema>;

export const StoryOrderRoundSchema = z
  .object({
    id: StoryOrderIdSchema,
    panels: z.array(StoryOrderPanelSchema).min(3).max(5),
    /** Drawn without its pictures (a panel may still name one): the order comes from the Korean alone. */
    captionsOnly: z.boolean().optional(),
    /**
     * Illustrated, with captions that settle the order on their own (sequence or time words such as
     * 먼저 and 마지막에, or cause and result), as the MAR confirms. Read by the lint `story-order-text`.
     */
    captionsSettleOrder: z.boolean().optional(),
  })
  .superRefine((round, ctx) => {
    const ids = new Set<string>();
    const lines = new Set<string>();
    round.panels.forEach((panel, i) => {
      if (ids.has(panel.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['panels', i, 'id'], message: 'panel ids must be unique' });
      ids.add(panel.id);
      if (lines.has(panel.caption.ko)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['panels', i, 'caption', 'ko'], message: 'two panels share the same caption' });
      }
      lines.add(panel.caption.ko);
    });
  });
export type StoryOrderRound = z.infer<typeof StoryOrderRoundSchema>;

/** Whether a Story Order round draws its pictures: not captions only, and at least one panel has one. */
export function storyOrderPictures(round: StoryOrderRound): boolean {
  return round.captionsOnly !== true && round.panels.some((p) => p.pictureRef !== undefined);
}

/**
 * Whether the round's order comes from its text (the rule of the lint `story-order-text`, which
 * reads the same fields off raw JSON): captions only, no picture at all, or marked as settled by its captions.
 */
export function storyOrderTextSettled(round: StoryOrderRound): boolean {
  return !storyOrderPictures(round) || round.captionsSettleOrder === true;
}

/**
 * The Story Sequence round a Story Order round falls back to while `game.story-order` is off
 * (§7.1, §12.2): the same panels in the same order, the caption's gloss as the step label (Story
 * Sequence shows it), its Korean and romanization, and the picture unless the round is captions only.
 */
export function storyOrderToSequence(round: StoryOrderRound): z.infer<typeof StorySequenceRoundSchema> {
  const pictures = round.captionsOnly !== true;
  return {
    steps: round.panels.map((p) => ({
      id: p.id,
      labelEn: p.caption.en,
      labelKo: p.caption.ko,
      romanization: p.caption.romanization,
      ...(pictures && p.pictureRef !== undefined ? { illustrationRef: p.pictureRef } : {}),
    })),
  };
}
// ---- Hidden Heritage (F-CURR-002 §7.1 F7 and OD-10, row CM-36; design/wireframes/minigame/hidden-heritage.md) ----

/** Hit-area rules of the scene style guide: H-1 a spot is at least 75 x 75 canvas units, H-2 spots keep 11 apart. */
export const HIDDEN_HERITAGE_SPOT = { min: 75, gap: 11 } as const;

/** A thing's hit area on the 400 x 300 scene canvas (H-1, H-4). */
export const HiddenHeritageSpotSchema = z
  .object({ x: z.number().min(0), y: z.number().min(0), w: z.number().min(HIDDEN_HERITAGE_SPOT.min), h: z.number().min(HIDDEN_HERITAGE_SPOT.min) })
  .refine((s) => s.x + s.w <= ART_CANVAS.width && s.y + s.h <= ART_CANVAS.height, 'a spot lies inside the 400 x 300 canvas');
export type HiddenHeritageSpot = z.infer<typeof HiddenHeritageSpotSchema>;

/** The gap between two spots in canvas units; 0 when they touch or overlap (H-2). */
export function spotGap(a: HiddenHeritageSpot, b: HiddenHeritageSpot): number {
  const dx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0);
  const dy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0);
  return Math.max(dx, dy);
}

/**
 * A drawn thing of the scene: its Korean word and its spot. A target's word is the prompt (Korean, heard and written
 * with romanization, never an English label); every spot is named by its word's meaning for a screen reader.
 */
const HiddenHeritageThingSchema = z.object({ id: z.string().regex(/^[a-z0-9-]+$/), word: KoTextSchema, spot: HiddenHeritageSpotSchema });

/**
 * One scene to search: the scene (art in a lazy chunk), its alt text (the setting, never the things), the 3-5 targets
 * with the bundled picture the Pic-Word Match fallback draws (`card:` / `word:`), and 3-6 other things, at least as
 * many as targets, so a random tap or the screen-reader list never gives the answer away.
 */
export const HiddenHeritageRoundSchema = z
  .object({
    id: z.string().min(1),
    sceneId: z.string().regex(/^scene:[a-z0-9-]+$/),
    altEn: z.string().trim().min(1).max(140),
    targets: z.array(HiddenHeritageThingSchema.extend({ picture: PictureRefSchema })).min(3).max(5),
    others: z.array(HiddenHeritageThingSchema).min(3).max(6),
  })
  .superRefine((round, ctx) => {
    // Short messages: this schema is in the app's start bundle (F-CURR-002 §10).
    const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    const things = [...round.targets, ...round.others];
    const ids = new Set(things.map((t) => t.id));
    const words = new Set(things.map((t) => t.word.ko));
    if (ids.size < things.length) issue('thing ids repeat');
    if (words.size < things.length) issue('two things share a word');
    if (round.others.length < round.targets.length) issue('fewer other things than targets');
    things.forEach((a, i) => things.slice(i + 1).forEach((b) => spotGap(a.spot, b.spot) < HIDDEN_HERITAGE_SPOT.gap && issue(`spots ${a.id} and ${b.id} too close`)));
    const c = round.targets.map((t) => t.spot.x + t.spot.w / 2 - ART_CANVAS.width / 2);
    if (!c.some((x) => x < 0) || !c.some((x) => x > 0)) issue('a target in each half');
    if (/[\u3130-\u318F\uAC00-\uD7A3]|^\s*image of\b/i.test(round.altEn)) issue('altEn: no Hangul, no "Image of"');
  });
export type HiddenHeritageRound = z.infer<typeof HiddenHeritageRoundSchema>;
/**
 * Syllable Build (F-CURR-002 section 7.1 F3, row CM-32; design/wireframes/minigame/syllable-build.md): hear one real
 * block, then tap its first letter, vowel and final (or No final, implicit) into the zones of a block. Tiles are
 * compatibility jamo, 3-4 first letters, 3-4 vowels and 2-3 finals; the tile faces show the jamo only. The target is a
 * block of the Stage 1 table or of a taught word, never a pseudo-word (section 19 assumption 5). Its `en` is the word's
 * meaning, shown under the speaker; a block that is not a word has none, so no meaning line (and no "the sound ga" line,
 * which would read out the answer). `fixedZone`: that zone is filled and locked (a symbol item at the produce rung, 4.3).
 */
export const SyllableBuildTargetSchema = KoTextShape.extend({ en: z.string().min(1).optional() }).superRefine(refineKoText);
export const SyllableBuildRoundSchema = z
  .object({
    id: z.string().min(1),
    target: SyllableBuildTargetSchema,
    firstTiles: z.array(z.string().min(1)).min(3).max(4),
    vowelTiles: z.array(z.string().min(1)).min(3).max(4),
    finalTiles: z.array(z.string().min(1)).min(2).max(3),
    fixedZone: z.enum(['first', 'vowel', 'final']).optional(),
  })
  .superRefine((round, ctx) => {
    for (const { path, message } of syllableBuildIssues(round)) ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  });
export type SyllableBuildRound = z.infer<typeof SyllableBuildRoundSchema>;
/**
 * Match Shape (F-CURR-002 section 7.1 F4, row CM-33): its round schema is `./match-shape.ts`
 * (`@hangul-route/content-schema/match-shape`), outside the barrel and `RoundSchema`, because its rounds are Stage 1
 * TypeScript rows (section 4.2), never lesson JSON, so the start bundle carries only the type.
 */
export type { MatchShapeRound } from './match-shape';
/** The look-alike letters a pair round sets against each other (7.1 F4), each letter's first; review asks these. */
export const SHAPE_LOOK_ALIKES: Readonly<Record<string, string>> = { ㅂ: 'ㅍ', ㅍ: 'ㅂ', ㅓ: 'ㅗ', ㅗ: 'ㅓ', ㅏ: 'ㅓ', ㄹ: 'ㄷ', ㄷ: 'ㄹ' };
// ---- My Story (F-CURR-002 §7.1 F8, OD-13; row CM-38) -------------------------------------------

/** A chain holds 3 to 5 frames (F-CURR-002 §7.1 F8). */
export const MY_STORY_FRAMES_MIN = 3;
export const MY_STORY_FRAMES_MAX = 5;
/** Every slot of a My Story frame offers 3 to 5 taught words (design/wireframes/minigame/my-story.md). */
export const MY_STORY_BANK_MIN = 3;
export const MY_STORY_BANK_MAX = 5;

/**
 * Slot topics a My Story frame may never ask of the learner (F-CURR-002 §6.6 and §13, personal disclosure;
 * design/wireframes/minigame/my-story.md: no home address, school name, real name, age, health or religion). Read
 * in the frame's English gloss, any case, and only where the frame asks about the learner ("my" or "your" before the
 * topic, or "I" or "you" with the fact): a frame about Hoya or the cast ("Her name is ___", "Hoya's grandmother
 * lives in ___", "After school I ___") is not a disclosure and parses. The learner's own family is a topic too
 * (§6.6: content never requires it). The MAR still checks every frame.
 */
export const MY_STORY_PRIVATE_TOPICS =
  /\b(?:(?:my|your)\s+(?:(?:real|full|first|last|home|e-?mail|phone)\s+)?(?:names?|address(?:es)?|street|school|class|grade|teachers?|age|birthday|phone|e-?mail|password|home(?:town)?|house|neighbou?rhood|city|town|country|health|illness|medicine|religion|doctor|hospital|church|mosque|temple|family|mom|mum|dad|mother|father|parents?|brothers?|sisters?|grand(?:ma|pa|mother|father|parents?))|(?:I|you)\s+(?:live|lives|lived|am from|are from|come from|grew up|was born|were born|pray)|(?:I am|I'm|you are|you're)\s+(?:\S+\s+)?years?\s+old|(?:I am|I'm|I feel|you are|you're|you feel)\s+(?:sick|ill)|(?:I|you)\s+go\s+to\s+(?:church|mosque|temple)|where\s+(?:(?:do|did|are|am)\s+)?(?:I|you)\s+(?:live|from|come from|grew up)|how\s+old\s+(?:are\s+you|am\s+I)|(?:I am|I'm|you are|you're)\s+(?:called|named)|call\s+me)\b/i;

/** A bank word of a My Story slot: taught Korean, and `neutral: true` on the one option that tells nothing about the learner. */
export const MyStoryBankWordSchema = KoTextShape.extend({ neutral: z.literal(true).optional() }).superRefine(refineKoText);
export type MyStoryBankWord = z.infer<typeof MyStoryBankWordSchema>;

/**
 * The rules a My Story frame adds to Write Frame's (row CM-38):
 * - `my-story-neutral-option`: every slot's bank has exactly one neutral option (호야 for a person, 괜찮아요 for a
 *   feeling, 공원 for a place), so nobody has to share a family, a feeling or a place to finish. It is drawn like the
 *   others, so it is never the first card of the bank (it is not the default).
 * - `my-story-private-topic`: the frame never asks for a private fact (`MY_STORY_PRIVATE_TOPICS`).
 * Word bank only (no free text) and no sound table are in the shape itself.
 */
export function myStoryFrameRules(frame: { frame: { en: string }; slots: readonly { bank: readonly { neutral?: true | undefined }[] }[] }, ctx: z.RefinementCtx): void {
  frame.slots.forEach((slot, i) => {
    const neutral = slot.bank.flatMap((w, j) => (w.neutral === true ? [j] : []));
    if (neutral.length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['slots', i, 'bank'], message: `my-story-neutral-option: a slot's bank has exactly one neutral option (it has ${neutral.length})` });
    } else if (neutral[0] === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['slots', i, 'bank', 0], message: 'my-story-neutral-option: the neutral option is drawn like the others, never first in the bank' });
    }
  });
  const topic = MY_STORY_PRIVATE_TOPICS.exec(frame.frame.en);
  if (topic) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['frame', 'en'], message: `my-story-private-topic: a frame never asks for a private fact ("${topic[0]}")` });
  }
}

/**
 * One frame of a My Story chain: a Write Frame round with a bank of 3 to 5 words per slot, one of them neutral, and
 * no free entry and no sound table (slots are word-bank only, F-CURR-002 §7.1 F8). It parses to a `WriteFrameRound`
 * (each bank word may carry `neutral`), so the fallback plays it in Write Frame unchanged.
 */
export const MyStoryFrameSchema = WriteFrameRoundShape.extend({
  slots: z
    .array(z.object({ id: z.string().min(1), bank: z.array(MyStoryBankWordSchema).min(MY_STORY_BANK_MIN).max(MY_STORY_BANK_MAX) }))
    .min(1)
    .max(2),
  freeEntry: z.literal(false, { errorMap: () => ({ message: 'a My Story frame is word-bank only: no free entry' }) }).default(false),
  soundTable: z.never({ errorMap: () => ({ message: 'a My Story frame is word-bank only: no sound table' }) }).optional(),
})
  .superRefine(writeFrameRoundRules)
  .superRefine(myStoryFrameRules);
export type MyStoryFrame = z.infer<typeof MyStoryFrameSchema>;

/** A chain of 3 to 5 frames with distinct ids, in story order. */
export const MyStoryFramesSchema = z
  .array(MyStoryFrameSchema)
  .min(MY_STORY_FRAMES_MIN)
  .max(MY_STORY_FRAMES_MAX)
  .superRefine((frames, ctx) => {
    const ids = frames.map((f) => f.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'frame ids must be unique' });
  });

/**
 * My Story (F-CURR-002 §7.1 F8, blueprint 06 game 12): 3-5 chained Write Frame rounds that make a short text, shown at
 * the end as "My page" and not kept (OD-13, F-CURR-001 OD-6). The text is never stored or sent.
 */
export const MyStoryRoundSchema = z.object({ id: z.string().min(1), frames: MyStoryFramesSchema });
export type MyStoryRound = z.infer<typeof MyStoryRoundSchema>;

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
  z.object({ kind: z.literal('cloze-pick'), data: ClozePickRoundSchema }),
  z.object({ kind: z.literal('story-order'), data: StoryOrderRoundSchema }),
  z.object({ kind: z.literal('role-play'), data: RolePlaySceneSchema }),
  z.object({ kind: z.literal('hidden-heritage'), data: HiddenHeritageRoundSchema }),
  z.object({ kind: z.literal('syllable-build'), data: SyllableBuildRoundSchema }),
  z.object({ kind: z.literal('my-story'), data: MyStoryRoundSchema }),
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
