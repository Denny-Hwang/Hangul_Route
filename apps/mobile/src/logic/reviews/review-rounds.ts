import type { ReviewFormat, ReviewItem, ReviewItemKind } from '@hangul-route/content-schema/review-items';
import { CLOZE_GAP } from '@hangul-route/content-schema';
import { jitter, type EngineContext, type ReviewQuestion } from './engine';

/**
 * The rounds of a review session (F-CURR-002 sections 4.3 and 4.5, row CM-14): what a Daily Review or
 * Keep going question shows, built from the review item itself. Pure and deterministic for a seed.
 *
 * Every round is reading, listening or writing; nothing records or measures speech. A round is one of:
 * - **pick**: hear it (recognize) or see it (read), then pick among 2 to 4 options. A heard round's
 *   options are spellings, so an item with a homophone carries the engine's picture or gloss cue, and
 *   a spelling that sounds the same is never an option (section 4.5).
 * - **type**: Type Hangul `see` or `picture` (produce), graded by the engine's typing tolerance.
 * - **order**: Sentence Builder (produce): the sentence's words, or an exchange's reply, in order.
 * - **cloze**: Cloze Pick (produce, row CM-30, behind `game.cloze-pick`): a sentence with one word left out, its
 *   meaning shown, and 3 or 4 word tiles; the left-out word fits.
 *
 * The formats drawn here are the ones whose rounds have shipped (`SURFACE_FORMATS`); the new formats of
 * section 7.1 join with their own rows behind `game.<kind>`: Dictation (Type Hangul `hear`, row CM-31) when
 * `game.type-hangul-hear` is on (`SurfaceOptions.dictation`), Cloze Pick (row CM-30) when `game.cloze-pick` is on
 * (`SurfaceOptions.clozePick`), Syllable Build and Match Shape later.
 * `surfaceIndex` gives the engine the item index with only these formats, so an item it cannot ask that way falls
 * back to another way, or to the read rung, inside the engine, never here. The engine itself keeps Dictation to an
 * item that passes `dictation-unambiguous` (no homophone, no sound change) on a device with a voice.
 */

/** The formats this surface draws (section 7.1 formats come with their own rows). */
export const SURFACE_FORMATS: ReadonlySet<ReviewFormat> = new Set<ReviewFormat>(['hear-pick', 'read-pick', 'type-see', 'type-picture', 'sentence-builder']);
/** With `game.cloze-pick` on (row CM-30): the produce rung of a sentence (`pat`) can also be a Cloze Pick round. */
export const CLOZE_SURFACE_FORMATS: ReadonlySet<ReviewFormat> = new Set<ReviewFormat>([...SURFACE_FORMATS, 'cloze-pick']);

/** What a surface may ask beyond the shipped formats: the section 7.1 formats whose `game.<kind>` is on. */
export interface SurfaceGames {
  clozePick?: boolean;
  /** Dictation with `game.type-hangul-hear` on (row CM-31). */
  dictation?: boolean;
}
/** The name row CM-31 gave the same options. */
export type SurfaceOptions = SurfaceGames;

/** The formats a surface with these games on may ask. */
function allowedFormats(games: SurfaceGames): ReadonlySet<ReviewFormat> {
  const base = games.clozePick === true ? CLOZE_SURFACE_FORMATS : SURFACE_FORMATS;
  return games.dictation === true ? new Set<ReviewFormat>([...base, 'dictation']) : base;
}

/** At most this many options a pick round shows (2 x 2 at 320). */
export const MAX_OPTIONS = 4;
/** A sentence of more words than this is not ordered tile by tile (the 288 dp column holds about this many). */
export const MAX_ORDER_TILES = 8;

/** A blank in a frame (`___이에요/예요.`): nothing to hear or order. */
const HAS_SLOT = /_/;

/**
 * The formats of an item this surface can ask: a symbol is never heard (a lone letter read by the device voice says
 * its name, not its sound); a frame with a blank is never heard or ordered; a realia card needs its card (Realia
 * Read), which the item does not carry, so it is left to its own surfaces. `allowed` is the set of formats this
 * surface draws, or the games that are on (`SurfaceGames`), which give that set.
 */
/** What this surface draws beyond the shipped formats: Dictation with `game.type-hangul-hear` on (row CM-31). */
export interface SurfaceOptions extends SurfaceGames {
  dictation?: boolean;
}

/** The formats a surface allows for these switches (Cloze Pick with `game.cloze-pick` on). */
const allowedFormats = (options: SurfaceOptions): ReadonlySet<ReviewFormat> => (options.clozePick === true ? CLOZE_SURFACE_FORMATS : SURFACE_FORMATS);

export function surfaceFormats(
  item: Pick<ReviewItem, 'kind' | 'ko' | 'romanization' | 'formats' | 'picture'>,
  allowed: ReadonlySet<ReviewFormat> | SurfaceOptions = {},
): ReviewFormat[] {
  if (item.kind === 'rea') return [];
  const options: SurfaceOptions = allowed instanceof Set ? {} : (allowed as SurfaceOptions);
  const formats = allowed instanceof Set ? (allowed as ReadonlySet<ReviewFormat>) : allowedFormats(options);
  return item.formats.filter((f) => {
    // Dictation is a word typed by ear (a `lex` item; its frames and symbols are never heard).
    if (f === 'dictation') return options.dictation === true && item.kind === 'lex' && !HAS_SLOT.test(item.ko);
    if (!formats.has(f)) return false;
    // Dictation is a word typed by ear (a `lex` item; its frames and symbols are never heard).
    if (f === 'dictation') return item.kind === 'lex' && !HAS_SLOT.test(item.ko);
    // A Cloze Pick round leaves out one word of a sentence, so its words and their romanization must line up.
    if (f === 'cloze-pick') return item.kind === 'pat' && clozeWords(item) !== null;
    if (f === 'hear-pick' && (item.kind === 'sym' || HAS_SLOT.test(item.ko))) return false;
    if (f === 'sentence-builder' && HAS_SLOT.test(item.ko)) return false;
    if (f === 'type-picture' && item.picture === undefined) return false;
    return true;
  });
}

type SurfaceIndex = EngineContext['index'];
/** One cache per switch combination (Cloze Pick, Dictation), so a surface index is built once per index. */
const surfaceCaches = new Map<string, WeakMap<object, SurfaceIndex>>();

/**
 * The item index with each item's formats cut to this surface's; an item left with none is not askable here. With
 * `game.cloze-pick` off a sentence's produce rung is Sentence Builder, or the read rung (the engine falls back); with
 * `game.type-hangul-hear` off a word's produce rung is Type Hangul `see`.
 */
export function surfaceIndex(index: SurfaceIndex, options: SurfaceOptions = {}): SurfaceIndex {
  const key = `${options.clozePick === true ? 'c' : ''}${options.dictation === true ? 'd' : ''}`;
  let cache = surfaceCaches.get(key);
  if (cache === undefined) {
    cache = new WeakMap();
    surfaceCaches.set(key, cache);
  }
  const held = cache.get(index);
  if (held) return held;
  const cut: ReviewItem[] = [];
  for (const item of index.items) {
    const formats = surfaceFormats(item, options);
    if (formats.length > 0) cut.push(formats.length === item.formats.length ? item : { ...item, formats });
  }
  // A sentence none of whose words has two fair tiles cannot be a Cloze Pick round: its produce rung is then Sentence
  // Builder, or the engine asks it at read (section 4.5), rather than choosing a format whose round is never built.
  const pool = options.clozePick === true ? clozePool(cut) : null;
  const items: ReviewItem[] = [];
  for (const item of cut) {
    if (pool === null || !item.formats.includes('cloze-pick') || clozeTileable(item, pool)) items.push(item);
    else {
      const formats = item.formats.filter((f) => f !== 'cloze-pick');
      if (formats.length > 0) items.push({ ...item, formats });
    }
  }
  const out: SurfaceIndex = { items, byId: new Map(items.map((i) => [i.id, i])), retired: index.retired };
  cache.set(index, out);
  return out;
}

/** The words of the sentences (`pat`) at each place counted from the end, and the sentences by their meaning. */
interface ClozePool {
  atFromEnd: Map<number, Set<string>>;
  byMeaning: Map<string, Array<{ id: string; ko: string }>>;
}

function clozePool(items: readonly ReviewItem[]): ClozePool {
  const atFromEnd = new Map<number, Set<string>>();
  const byMeaning = new Map<string, Array<{ id: string; ko: string }>>();
  for (const item of items) {
    if (item.kind !== 'pat') continue;
    if (item.en !== undefined) byMeaning.set(item.en, [...(byMeaning.get(item.en) ?? []), { id: item.id, ko: bareWord(item.ko) }]);
    const words = clozeWords(item);
    words?.forEach((w, i) => {
      const fromEnd = words.length - 1 - i;
      const set = atFromEnd.get(fromEnd) ?? new Set<string>();
      set.add(w.ko);
      atFromEnd.set(fromEnd, set);
    });
  }
  return { atFromEnd, byMeaning };
}

/** The sentences of another item with the same meaning (bare): a tile that makes one of them is not fair. */
const sameMeaningOf = (item: Pick<ReviewItem, 'id' | 'en'>, byMeaning: ClozePool['byMeaning']): Set<string> =>
  new Set((item.en === undefined ? [] : (byMeaning.get(item.en) ?? [])).filter((o) => o.id !== item.id).map((o) => o.ko));

/**
 * Whether `tile` may stand beside `answer` in a gap: not a word of the sentence, not one that differs only in its
 * ending (책이 / 책은: the meaning would not decide), and not one that makes another sentence of the same meaning.
 */
const fairTile = (tile: string, answer: string, own: ReadonlySet<string>, sameMeaning: ReadonlySet<string>, filled: string): boolean =>
  !own.has(tile) && tile[0] !== answer[0] && !sameMeaning.has(filled);

/** Whether some word of the sentence has at least two fair tiles in the pool (what `clozeRound` needs to build a round). */
function clozeTileable(item: ReviewItem, pool: ClozePool): boolean {
  const words = clozeWords(item);
  if (item.kind !== 'pat' || words === null) return false;
  const own = new Set(words.map((w) => w.ko));
  const sameMeaning = sameMeaningOf(item, pool.byMeaning);
  return words.some((answer, at) => {
    let fair = 0;
    for (const tile of pool.atFromEnd.get(words.length - 1 - at) ?? []) {
      const filled = words.map((w, i) => (i === at ? tile : w.ko)).join(' ');
      if (fairTile(tile, answer.ko, own, sameMeaning, filled) && ++fair >= 2) return true;
    }
    return false;
  });
}

/** The words of a sentence (edge punctuation off) beside their romanization, or null when the two do not line up. */
export function clozeWords(item: Pick<ReviewItem, 'ko' | 'romanization'>): Array<{ ko: string; romanization: string }> | null {
  if (HAS_SLOT.test(item.ko)) return null;
  const words = item.ko.split(/\s+/).filter((w) => w !== '');
  const roms = item.romanization.split(/\s+/).filter((w) => w !== '');
  if (words.length < 2 || words.length !== roms.length) return null;
  const out = words.map((w, i) => ({ ko: bareWord(w), romanization: bareWord(roms[i] as string) }));
  return out.every((w) => w.ko !== '' && w.romanization !== '') ? out : null;
}

const bareWord = (word: string): string => word.replace(/^["'“”‘’(]+|[.!?~…,"'“”‘’)]+$/g, '');

// ---- the rounds ---------------------------------------------------------------------------------------------

/** Taught Korean as a round shows it: always with its romanization (CLAUDE.md section 1). */
export interface KoText {
  ko: string;
  romanization: string;
}

export interface PickOption {
  /** The item the option stands for. */
  id: string;
  /** A spelling option (heard rounds, a reply). */
  ko?: KoText;
  /** A meaning (the gloss in the UI language) or a sound (romanization) option. */
  label?: string;
  /** A picture option's picture (`card:` or `word:` ref). */
  picture?: string;
}

/** What the round settles on: the right answer, shown by Hoya after a miss (Korean, romanization, meaning). */
export interface RoundAnswer {
  ko: KoText;
  gloss?: string;
}

interface RoundBase {
  question: ReviewQuestion;
  answer: RoundAnswer;
}

export type PickAsk = 'spelling' | 'meaning' | 'sound' | 'reply';

export interface PickRound extends RoundBase {
  type: 'pick';
  /** The prompt is played (recognize); otherwise it is shown. */
  heard: boolean;
  /**
   * What the options are: spellings (heard), meanings, letters or blocks for a shown sound (a symbol or block read; the
   * options' romanization is not shown), or replies to a line.
   */
  ask: PickAsk;
  /** What is played or shown: the item, or an exchange's line. */
  prompt: KoText;
  /** A heard round's settling cue for an item with a homophone (section 4.5). */
  cue?: { picture?: string; gloss?: string };
  options: PickOption[];
  answerId: string;
}

export interface TypeRound extends RoundBase {
  type: 'type';
  /** `hear` is Dictation (row CM-31): the word is played and its Korean and romanization stay hidden until Done. */
  mode: 'see' | 'picture' | 'hear';
  /** The Korean to type. */
  target: string;
  picture?: string;
}

export interface OrderTile {
  /** Unique within the round (two tiles may say the same). */
  key: string;
  ko: string;
}

export interface OrderRound extends RoundBase {
  type: 'order';
  /** An exchange's line, shown above the reply to order. */
  line?: KoText;
  /** The meaning of what is built, in the UI language. */
  meaning?: string;
  /** The tiles, shuffled. */
  tiles: OrderTile[];
  /** The words in order: a tile is right when its text is the next word. */
  words: string[];
}

export interface ClozeRound extends RoundBase {
  type: 'cloze';
  /** The sentence with its one word left out (`___`), and its romanization the same way. */
  gapped: KoText;
  /** The sentence's meaning in the UI language: the input the round reads from (no meaning, no Cloze round). */
  meaning: string;
  /** The word tiles (Korean and romanization, no meaning), in a seeded order. */
  tiles: PickOption[];
  answerId: string;
}

export type ReviewRound = PickRound | TypeRound | OrderRound | ClozeRound;

/** The meaning of an item (or a reply) in the UI language; undefined when it has none. */
export type GlossOf = (key: string | undefined, en: string | undefined) => string | undefined;

export interface RoundInput {
  index: SurfaceIndex;
  gloss: GlossOf;
  /** The same seed gives the same options and tiles. */
  seed: string;
}

const koOf = (item: Pick<ReviewItem, 'ko' | 'romanization'>): KoText => ({ ko: item.ko, romanization: item.romanization });
const replyKo = (item: ReviewItem): KoText | undefined => (item.reply ? { ko: item.reply.ko, romanization: item.reply.romanization } : undefined);
const itemGloss = (item: ReviewItem, input: RoundInput): string | undefined => input.gloss(item.glossKey, item.en);
const replyGloss = (item: ReviewItem, input: RoundInput): string | undefined => (item.reply ? input.gloss(item.reply.glossKey, item.reply.en) : undefined);

const byKind = new WeakMap<object, Map<ReviewItemKind, ReviewItem[]>>();
function itemsOfKind(index: SurfaceIndex, kind: ReviewItemKind): readonly ReviewItem[] {
  let map = byKind.get(index);
  if (map === undefined) {
    map = new Map();
    for (const item of index.items) map.set(item.kind, [...(map.get(item.kind) ?? []), item]);
    byKind.set(index, map);
  }
  return map.get(kind) ?? [];
}

const seededOrder = <T>(list: readonly T[], seed: string, keyOf: (t: T) => string): T[] =>
  [...list].sort((a, b) => jitter(seed, keyOf(a)) - jitter(seed, keyOf(b)) || (keyOf(a) < keyOf(b) ? -1 : 1));

/**
 * Up to 3 other items of the same kind whose option text differs from the answer's and from each other's: the
 * same theme first (a fairer choice), then any; an item with the same spelling or the same sound as the answer
 * (a homophone) is never one.
 */
function distractors(target: ReviewItem, input: RoundInput, textOf: (item: ReviewItem) => string | undefined): ReviewItem[] {
  const answerText = textOf(target);
  if (answerText === undefined) return [];
  const pool = itemsOfKind(input.index, target.kind).filter(
    (i) => i.id !== target.id && i.ko !== target.ko && !target.homophoneOf.includes(i.id) && !i.homophoneOf.includes(target.id),
  );
  const seed = `${input.seed}|${target.id}`;
  const near = seededOrder(
    pool.filter((i) => i.home === target.home),
    seed,
    (i) => i.id,
  );
  const far = seededOrder(
    pool.filter((i) => i.home !== target.home),
    seed,
    (i) => i.id,
  );
  const out: ReviewItem[] = [];
  const seen = new Set([answerText]);
  for (const item of [...near, ...far]) {
    if (out.length >= MAX_OPTIONS - 1) break;
    const text = textOf(item);
    if (text === undefined || seen.has(text)) continue;
    seen.add(text);
    out.push(item);
  }
  return out;
}

function pickRound(question: ReviewQuestion, item: ReviewItem, input: RoundInput, heard: boolean): PickRound | null {
  const exchange = item.kind === 'exc';
  // What the options are: an exchange's reply, a spelling (heard rounds), else a meaning, else a sound.
  const gloss = itemGloss(item, input);
  const kind: PickAsk = exchange ? 'reply' : heard ? 'spelling' : gloss !== undefined ? 'meaning' : 'sound';
  const textOf = (i: ReviewItem): string | undefined =>
    kind === 'reply' ? i.reply?.ko : kind === 'spelling' ? i.ko : kind === 'meaning' ? itemGloss(i, input) : i.romanization;
  const others = distractors(item, input, textOf);
  if (others.length === 0) return null;
  const optionOf = (i: ReviewItem): PickOption => {
    if (kind === 'reply') return { id: i.id, ko: replyKo(i) as KoText };
    if (kind === 'spelling') return { id: i.id, ko: koOf(i) };
    if (kind === 'meaning') return { id: i.id, label: itemGloss(i, input) as string, ...(i.picture ? { picture: i.picture } : {}) };
    // A sound round shows the sound and asks for the letter or block, as Match Sound's text mode does: the options'
    // romanization would be the answer, so the screen hides it (`ask: 'sound'`); the sounds still differ.
    return { id: i.id, ko: koOf(i) };
  };
  const options = seededOrder([item, ...others], `${input.seed}|${item.id}|options`, (i) => i.id).map(optionOf);
  // A meaning round shows pictures only when every option has one, so no option stands out.
  if (kind === 'meaning' && !options.every((o) => o.picture !== undefined)) for (const o of options) delete o.picture;
  const round: PickRound = {
    type: 'pick',
    question,
    heard,
    ask: kind,
    prompt: koOf(item),
    options,
    answerId: item.id,
    answer: exchange ? { ko: replyKo(item) as KoText, ...(replyGloss(item, input) ? { gloss: replyGloss(item, input) } : {}) } : { ko: koOf(item), ...(gloss ? { gloss } : {}) },
  };
  if (heard && question.cue !== undefined) {
    const cue = question.cue === 'picture' && item.picture ? { picture: item.picture } : gloss ? { gloss } : undefined;
    if (cue === undefined) return null;
    round.cue = cue;
  }
  return round;
}

function typeRound(question: ReviewQuestion, item: ReviewItem, input: RoundInput, mode: TypeRound['mode']): TypeRound | null {
  if (mode === 'picture' && item.picture === undefined) return null;
  const gloss = itemGloss(item, input);
  return {
    type: 'type',
    question,
    mode,
    target: item.ko,
    ...(mode === 'picture' ? { picture: item.picture } : {}),
    answer: { ko: koOf(item), ...(gloss ? { gloss } : {}) },
  };
}

function orderRound(question: ReviewQuestion, item: ReviewItem, input: RoundInput): OrderRound | null {
  const exchange = item.kind === 'exc';
  const built = exchange ? replyKo(item) : koOf(item);
  if (built === undefined) return null;
  const words = built.ko.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 2 || words.length > MAX_ORDER_TILES) return null;
  const meaning = exchange ? replyGloss(item, input) : itemGloss(item, input);
  const tiles = words.map((ko, i) => ({ key: `t${i}`, ko }));
  let shuffled = seededOrder(tiles, `${input.seed}|${item.id}|tiles`, (t) => t.key);
  // Never hand over the answer already in order.
  if (shuffled.every((t, i) => t.ko === words[i])) shuffled = [...shuffled.slice(1), shuffled[0] as OrderTile];
  return {
    type: 'order',
    question,
    ...(exchange ? { line: koOf(item) } : {}),
    ...(meaning ? { meaning } : {}),
    tiles: shuffled,
    words,
    answer: { ko: built, ...(meaning ? { gloss: meaning } : {}) },
  };
}

/**
 * Cloze Pick (row CM-30): one word of the sentence left out. The tiles are that word and up to three words that
 * stand at the same place, counted from the end, in other sentences (a Korean sentence ends with its verb), the same
 * theme first. A tile is never one that differs only in its ending (책이 / 책은: the meaning would not decide), one
 * already in the sentence, or one that makes another sentence with the same meaning. The left-out word is the first,
 * in a seeded order, that has at least two such tiles; none has, or the meaning is missing in the UI language: null,
 * and `roundFor` asks it another way (`surfaceIndex` already drops Cloze Pick from a sentence no word of which has two).
 */
function clozeRound(question: ReviewQuestion, item: ReviewItem, input: RoundInput): ClozeRound | null {
  const words = clozeWords(item);
  if (words === null) return null;
  // Without the meaning in the UI language the tiles are not settled (책이 ___ takes 있어요 and 없어요): asked another way.
  const meaning = itemGloss(item, input);
  if (meaning === undefined) return null;
  const own = new Set(words.map((w) => w.ko));
  const pats = itemsOfKind(input.index, 'pat');
  const sameMeaning = new Set(item.en === undefined ? [] : pats.filter((i) => i.id !== item.id && i.en === item.en).map((i) => bareWord(i.ko)));
  const others = itemsOfKind(input.index, 'pat').filter((i) => i.id !== item.id);
  const seed = `${input.seed}|${item.id}`;
  const places = seededOrder(
    words.map((_, i) => i),
    `${seed}|gap`,
    (i) => String(i),
  );
  for (const at of places) {
    const answer = words[at] as { ko: string; romanization: string };
    const fromEnd = words.length - 1 - at;
    const filledWith = (ko: string): string => words.map((w, i) => (i === at ? ko : w.ko)).join(' ');
    const pool = (list: readonly ReviewItem[]) =>
      seededOrder(list, `${seed}|${at}`, (i) => i.id).flatMap((other) => {
        const theirs = clozeWords(other);
        const word = theirs?.[theirs.length - 1 - fromEnd];
        return word ? [{ word, home: other.home }] : [];
      });
    const near = pool(others.filter((o) => o.home === item.home));
    const far = pool(others.filter((o) => o.home !== item.home));
    const tiles: Array<{ ko: string; romanization: string }> = [];
    const seen = new Set([answer.ko]);
    for (const { word } of [...near, ...far]) {
      if (tiles.length >= MAX_OPTIONS - 1) break;
      if (seen.has(word.ko) || !fairTile(word.ko, answer.ko, own, sameMeaning, filledWith(word.ko))) continue;
      seen.add(word.ko);
      tiles.push(word);
    }
    if (tiles.length < 2) continue;
    const answerId = `${item.id}#${at}`;
    const options = seededOrder(
      [{ id: answerId, ko: answer }, ...tiles.map((t, i) => ({ id: `${item.id}#${at}:${i}`, ko: t }))],
      `${seed}|tiles`,
      (o) => o.id,
    );
    const gapKo = item.ko
      .split(/\s+/)
      .filter((w) => w !== '')
      .map((w, i) => (i === at ? w.replace(answer.ko, CLOZE_GAP) : w))
      .join(' ');
    const gapRom = item.romanization
      .split(/\s+/)
      .filter((w) => w !== '')
      .map((w, i) => (i === at ? w.replace(answer.romanization, CLOZE_GAP) : w))
      .join(' ');
    return {
      type: 'cloze',
      question,
      gapped: { ko: gapKo, romanization: gapRom },
      meaning,
      tiles: options,
      answerId,
      answer: { ko: koOf(item), gloss: meaning },
    };
  }
  return null;
}

/** The round for an engine question, or null when the item cannot be played this way (it is then skipped). */
export function roundFor(question: ReviewQuestion, input: RoundInput): ReviewRound | null {
  const item = input.index.byId.get(question.itemId);
  if (item === undefined) return null;
  switch (question.format) {
    case 'hear-pick':
      return pickRound(question, item, input, true);
    case 'read-pick':
      return pickRound(question, item, input, false);
    case 'type-see':
      return typeRound(question, item, input, 'see');
    case 'type-picture':
      return typeRound(question, item, input, 'picture');
    case 'dictation':
      return typeRound(question, item, input, 'hear');
    case 'sentence-builder':
      return orderRound(question, item, input);
    case 'cloze-pick':
      // No round (no meaning in the UI language yet, or no fair tiles for this pool): the same produce rung as
      // Sentence Builder when the item has it, so the rung the engine records stays right; else the item is skipped.
      return (
        clozeRound(question, item, input) ??
        (item.formats.includes('sentence-builder') ? orderRound({ ...question, format: 'sentence-builder' }, item, input) : null)
      );
    default:
      return null;
  }
}

/**
 * The meaning of an item in the UI language. In English (no overlays) it is the English as authored. In es and ko it
 * is the gloss key's value in the locale's content overlays, and never the English: a lesson chunk not loaded yet
 * leaves its meanings out of the overlays, and an English meaning beside Spanish or Korean ones would mix the UI
 * languages (and give the answer away in a meaning pick). Undefined, the item is asked another way or not offered.
 */
export function glossFrom(overlays: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined): GlossOf {
  return (key, en) => {
    if (overlays === undefined) return en;
    if (key === undefined) return undefined;
    const hash = key.indexOf('#');
    const value = hash < 0 ? undefined : overlays[key.slice(0, hash)]?.[key.slice(hash + 1)];
    return value !== undefined && value !== '' ? value : undefined;
  };
}
