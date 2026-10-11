import { decomposeSyllable, type RuntimeVocabItem } from '@hangul-route/content-schema';
import { COLOR_CONFUSION_PAIRS } from '@hangul-route/design-system/word-art';
import { shuffle } from '../shuffle';
import { sameSense } from './catalog';
import { formatFor, formatsForLevel, repeatFormat, type VocabFormat, type VocabLevelOrder } from './format-for';

/**
 * The vocabulary question builder (F-VOC-004 §3.3). Pure, seeded, keyed by
 * item id (never by English string, so homonyms and pictures stay apart). It
 * generalises `buildCultureQuizRounds` for the Speed Round, F-VOC-003's quick
 * check and, later, F-RVW-001's Daily Test (`universe` = the catalogue).
 */

export type { VocabFormat } from './format-for';

/** One option; the ListenPickOption shape (F-QUEST-002 §3.10). */
export interface VocabOption {
  id: string;
  /** Word options (image-to-word). */
  text?: { ko: string; romanization: string; en: string };
  /** Picture options (word-to-image, audio-to-image). */
  pictureRef?: string;
  /** The English gloss of a picture option, for its accessible name (the view localises it). */
  labelEn?: string;
}

export interface VocabPrompt {
  kind: 'word' | 'image' | 'audio';
  ko?: string;
  romanization?: string;
  pictureRef?: string;
  spokenKo?: string;
  audioRef?: string;
}

export interface VocabQuestion {
  /** `q${index}:${itemId}:${format}` */
  key: string;
  itemId: string;
  format: VocabFormat;
  prompt: VocabPrompt;
  /** Shuffled; exactly `optionCount`. */
  options: VocabOption[];
  /** Equals `itemId`. */
  answerId: string;
  /**
   * The answer's primary topic key, only when another item of the universe
   * shares its `ko` (a homonym prompt in a mixed pool). The view shows the
   * topic's localised title for it.
   */
  topicChip?: string;
}

export interface BuildInput {
  /** The words to ask about, already in selection priority order (F-VOC-005 §3.6). */
  pool: readonly RuntimeVocabItem[];
  /** Every candidate for distractors (the topic; the whole catalogue for a mixed review). */
  universe: readonly RuntimeVocabItem[];
  count: number;
  optionCount: 3 | 4;
  levelOrder: VocabLevelOrder;
  /** Leitner box 0..5 (F-VOC-005 §3.4). */
  boxOf(id: string): number;
  seed: number;
  /** Whether a picture ref resolves to a drawable picture. */
  canRender(ref: string): boolean;
  /** `canPlayKorean()` and not muted, decided once before the round (S7). */
  canPlay: boolean;
}

/** Thrown only when not a single question can be built. */
export class NotEnoughWords extends Error {
  constructor(message = 'Not enough words to build a question') {
    super(message);
    this.name = 'NotEnoughWords';
  }
}

/** Seed spacing between questions, so no two questions share a shuffle. */
const QUESTION_SEED_STEP = 7919;

/** The picture family: `card` for heritage card art, `word-<family>` for WordArt (F-VOC-002 §3.11). */
export function pictureFamily(ref: string): string {
  if (ref.startsWith('card:')) return 'card';
  const key = ref.slice(ref.indexOf(':') + 1);
  // split always yields at least one piece (the whole key when it has no '-').
  return `word-${key.split('-', 1)[0]!}`;
}

const COUNT_RE = /^word:count-(\d+)$/;
/** The count a number word shows (`word:count-N`), else null. */
function countOf(item: RuntimeVocabItem): number | null {
  const match = COUNT_RE.exec(item.visual);
  return match === null ? null : Number(match[1]);
}

const CONFUSED: ReadonlySet<string> = new Set(COLOR_CONFUSION_PAIRS.map(([a, b]) => pairKey(a, b)));
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
function colourConfused(a: RuntimeVocabItem, b: RuntimeVocabItem): boolean {
  return CONFUSED.has(pairKey(a.id, b.id));
}

/** Same first syllable, or same initial consonant of the first syllable (rule 6). */
function confusable(a: RuntimeVocabItem, b: RuntimeVocabItem): boolean {
  // `ko` is never empty (VocabItemSchema), so both are syllable blocks.
  const first = a.ko.charAt(0);
  const other = b.ko.charAt(0);
  if (first === other) return true;
  const initial = decomposeSyllable(first)?.initial;
  return initial !== undefined && initial === decomposeSyllable(other)?.initial;
}

function uniqueById(items: readonly RuntimeVocabItem[]): RuntimeVocabItem[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

/** Rule 4: count neighbours, and zero / twenty unless one of them is the answer. */
function countAllowed(answer: number, candidate: number | null, levelOrder: VocabLevelOrder): boolean {
  if (candidate === null) return true;
  const edges = answer === 0 || answer === 20;
  if (!edges && (candidate === 0 || candidate === 20)) return false;
  return Math.abs(candidate - answer) >= (levelOrder === 0 ? 2 : 1);
}

/**
 * The distractors for `answer` in `format` (§3.3 rules 1-8). Rules 1 (sense)
 * and 2 (picture) never relax; rule 3 (colours) and rule 4 (counts) relax, in
 * reverse order, when they would leave fewer than `optionCount - 1`; rules 5
 * (picture family), 6 (confusables, level 2) and 7 (same topic) rank the rest.
 * Options never share a sense or (picture formats) a picture with each other
 * either. Returns fewer than `optionCount - 1` only when the universe cannot
 * supply them.
 */
export function distractorsFor(answer: RuntimeVocabItem, format: VocabFormat, i: BuildInput): RuntimeVocabItem[] {
  const need = i.optionCount - 1;
  const pictures = format !== 'image-to-word';
  const base = uniqueById(i.universe).filter(
    (c) =>
      c.id !== answer.id &&
      !sameSense(c, answer) &&
      c.visual !== answer.visual &&
      (!pictures || i.canRender(c.visual)),
  );
  const answerCount = countOf(answer);
  const colour = pictureFamily(answer.visual) === 'word-color';
  const colourRule = (c: RuntimeVocabItem): boolean => !colour || !colourConfused(answer, c);
  const countRule = (c: RuntimeVocabItem): boolean =>
    answerCount === null || countAllowed(answerCount, countOf(c), i.levelOrder);

  // Rule 3 and 4 on, then rule 4 relaxed, then rule 3 relaxed too.
  let picked: RuntimeVocabItem[] = [];
  for (const [colours, counts] of [
    [true, true],
    [true, false],
    [false, false],
  ] as const) {
    const candidates = base.filter((c) => (!colours || colourRule(c)) && (!counts || countRule(c)));
    picked = pick(answer, candidates, need, i, { pictures, colours });
    if (picked.length === need) return picked;
  }
  return picked;
}

function pick(
  answer: RuntimeVocabItem,
  candidates: readonly RuntimeVocabItem[],
  need: number,
  i: BuildInput,
  rules: { pictures: boolean; colours: boolean },
): RuntimeVocabItem[] {
  const family = pictureFamily(answer.visual);
  const topic = answer.topics[0]!; // topics has at least one entry (VocabItemSchema)
  const confusables = i.levelOrder === 2;
  const score = (c: RuntimeVocabItem): number =>
    (pictureFamily(c.visual) === family ? 4 : 0) +
    (confusables && confusable(answer, c) ? 2 : 0) +
    ((c.topics as readonly string[]).includes(topic) ? 1 : 0);
  // Seeded order inside each preference tier (rule 8); sort is stable.
  const ranked = shuffle(candidates, i.seed).sort((a, b) => score(b) - score(a));
  const clashes = (c: RuntimeVocabItem, chosen: readonly RuntimeVocabItem[]): boolean =>
    chosen.some(
      (p) => sameSense(p, c) || (rules.pictures && p.visual === c.visual) || (rules.colours && colourConfused(p, c)),
    );

  const chosen: RuntimeVocabItem[] = [];
  // Behaviour 14: at level 2 one slot goes to a confusable whenever one is left.
  const firstConfusable = confusables ? ranked.find((c) => confusable(answer, c)) : undefined;
  if (firstConfusable !== undefined) chosen.push(firstConfusable);
  for (const c of ranked) {
    if (chosen.length >= need) break;
    if (!chosen.includes(c) && !clashes(c, chosen)) chosen.push(c);
  }
  return chosen.slice(0, need);
}

function promptFor(item: RuntimeVocabItem, format: VocabFormat): VocabPrompt {
  if (format === 'image-to-word') return { kind: 'image', pictureRef: item.visual };
  const prompt: VocabPrompt = { kind: format === 'word-to-image' ? 'word' : 'audio', ko: item.ko, romanization: item.romanization };
  if (item.spokenKo !== undefined) prompt.spokenKo = item.spokenKo;
  if (item.audioRef !== undefined) prompt.audioRef = item.audioRef;
  return prompt;
}

function optionFor(item: RuntimeVocabItem, format: VocabFormat): VocabOption {
  if (format === 'image-to-word') {
    return { id: item.id, text: { ko: item.ko, romanization: item.romanization, en: item.en } };
  }
  return { id: item.id, pictureRef: item.visual, labelEn: item.en };
}

/**
 * Up to `count` questions over `pool` (§3.3 selection). Walks the pool in
 * order and cycles it again when it is shorter than `count`, never asking a
 * word twice in a row nor in the same format twice; a word whose picture does
 * not resolve is dropped, and a word that cannot get `optionCount` options is
 * skipped. Throws `NotEnoughWords` only when no question at all can be built.
 */
export function buildQuestions(i: BuildInput): VocabQuestion[] {
  const allowed = formatsForLevel(i.levelOrder, i.canPlay);
  const pool = uniqueById(i.pool).filter((item) => i.canRender(item.visual));
  const everyone = uniqueById([...i.universe, ...pool]);
  const usedFormats = new Map<string, VocabFormat[]>();
  const questions: VocabQuestion[] = [];

  let cursor = 0;
  let misses = 0;
  while (questions.length < i.count && misses < pool.length) {
    const item = pool[cursor % pool.length]!;
    cursor += 1;
    const question = questions.at(-1)?.itemId === item.id ? null : build(item, questions.length);
    if (question === null) {
      misses += 1;
      continue;
    }
    misses = 0;
    questions.push(question);
  }
  if (questions.length === 0) throw new NotEnoughWords();
  return questions;

  function build(item: RuntimeVocabItem, index: number): VocabQuestion | null {
    const used = usedFormats.get(item.id) ?? [];
    const format = used.length === 0 ? formatFor(i.boxOf(item.id), allowed, i.canPlay) : repeatFormat(used, allowed, i.canPlay);
    if (format === null) return null;
    const seed = i.seed + index * QUESTION_SEED_STEP;
    const distractors = distractorsFor(item, format, { ...i, seed });
    if (distractors.length < i.optionCount - 1) return null;
    usedFormats.set(item.id, [...used, format]);
    const question: VocabQuestion = {
      key: `q${index}:${item.id}:${format}`,
      itemId: item.id,
      format,
      prompt: promptFor(item, format),
      options: shuffle([item, ...distractors], seed + 1).map((o) => optionFor(o, format)),
      answerId: item.id,
    };
    if (everyone.some((other) => other.id !== item.id && other.ko === item.ko)) question.topicChip = item.topics[0]!;
    return question;
  }
}
