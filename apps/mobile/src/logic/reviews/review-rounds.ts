import type { ReviewFormat, ReviewItem, ReviewItemKind } from '@hangul-route/content-schema/review-items';
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
 *
 * The formats drawn here are the ones whose rounds have shipped (`SURFACE_FORMATS`); the new formats of
 * section 7.1 (Dictation, Syllable Build, Match Shape, Cloze Pick) join with their own rows behind
 * `game.<kind>`. `surfaceIndex` gives the engine the item index with only these formats, so an item it
 * cannot ask that way falls back to another way, or to the read rung, inside the engine, never here.
 */

/** The formats this surface draws (section 7.1 formats come with their own rows). */
export const SURFACE_FORMATS: ReadonlySet<ReviewFormat> = new Set<ReviewFormat>(['hear-pick', 'read-pick', 'type-see', 'type-picture', 'sentence-builder']);

/** At most this many options a pick round shows (2 x 2 at 320). */
export const MAX_OPTIONS = 4;
/** A sentence of more words than this is not ordered tile by tile (the 288 dp column holds about this many). */
export const MAX_ORDER_TILES = 8;

/** A blank in a frame (`___이에요/예요.`): nothing to hear or order. */
const HAS_SLOT = /_/;

/**
 * The formats of an item this surface can ask: a symbol is never heard (a lone letter read by the device voice says
 * its name, not its sound); a frame with a blank is never heard or ordered; a realia card needs its card (Realia
 * Read), which the item does not carry, so it is left to its own surfaces.
 */
export function surfaceFormats(item: Pick<ReviewItem, 'kind' | 'ko' | 'formats' | 'picture'>): ReviewFormat[] {
  if (item.kind === 'rea') return [];
  return item.formats.filter((f) => {
    if (!SURFACE_FORMATS.has(f)) return false;
    if (f === 'hear-pick' && (item.kind === 'sym' || HAS_SLOT.test(item.ko))) return false;
    if (f === 'sentence-builder' && HAS_SLOT.test(item.ko)) return false;
    if (f === 'type-picture' && item.picture === undefined) return false;
    return true;
  });
}

type SurfaceIndex = EngineContext['index'];
const surfaceCache = new WeakMap<object, SurfaceIndex>();

/** The item index with each item's formats cut to this surface's; an item left with none is not askable here. */
export function surfaceIndex(index: SurfaceIndex): SurfaceIndex {
  const held = surfaceCache.get(index);
  if (held) return held;
  const items: ReviewItem[] = [];
  for (const item of index.items) {
    const formats = surfaceFormats(item);
    if (formats.length > 0) items.push(formats.length === item.formats.length ? item : { ...item, formats });
  }
  const out: SurfaceIndex = { items, byId: new Map(items.map((i) => [i.id, i])), retired: index.retired };
  surfaceCache.set(index, out);
  return out;
}

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
  mode: 'see' | 'picture';
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

export type ReviewRound = PickRound | TypeRound | OrderRound;

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

function typeRound(question: ReviewQuestion, item: ReviewItem, input: RoundInput, mode: 'see' | 'picture'): TypeRound | null {
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
    case 'sentence-builder':
      return orderRound(question, item, input);
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
