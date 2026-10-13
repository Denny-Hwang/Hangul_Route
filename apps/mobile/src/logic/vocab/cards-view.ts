import type { RuntimeVocabItem, VocabProgress } from '@hangul-route/content-schema';
import { chunksFor, initFlash, quickCheckItems, suggestedChunk, type ChunkTally, type FlashState } from './flashcards';
import type { VocabLevelOrder } from './format-for';
import { buildQuestions, type VocabQuestion } from './question-builder';

/**
 * View decisions of the flashcards screen — F-VOC-003 C-5 (section 3.5-3.7;
 * design/screens/vocab/cards.md). Pure; `VocabCardsScreen` renders what these
 * return. The card state machine and what each step writes are
 * `flashcards.ts` (C-3).
 */

/** The `VocabCards` route params (section 3.1; `ids` is F-VOC-004 S-5's "Practice these"). */
export interface CardsParams {
  chunk?: number;
  startId?: string;
  ids?: readonly string[];
}

export interface CardsRun<T> {
  /** The topic's chunks at the learner's size. */
  chunks: T[][];
  /** The chunk shown, or -1 for an `ids` run (not one of the topic's chunks). */
  index: number;
  /** The run's words in the order they are shown. */
  words: T[];
  /** The word that opens on its back face (a collected wall tile), when it is in the run. */
  startId: string | null;
}

/**
 * Which words a `VocabCards` visit shows: `ids` when any of them is in the
 * topic (only those, in that order, once each), else the `chunk` asked for
 * when it exists, else the suggested chunk (the first with a word to meet).
 * `startId` puts that word first when it is in the run.
 */
export function cardsRun<T extends Pick<RuntimeVocabItem, 'id' | 'level'>>(
  items: readonly T[],
  opts: { size: number; fixedOrder: boolean; progress: VocabProgress; params: CardsParams },
): CardsRun<T> {
  const { params } = opts;
  const chunks = chunksFor(items, opts.size, opts.fixedOrder);
  const byId = new Map(items.map((item) => [item.id, item]));
  const picked = [...new Set(params.ids ?? [])].map((id) => byId.get(id)).filter((item): item is T => item !== undefined);

  let index: number;
  let words: T[];
  if (picked.length > 0) {
    index = -1;
    words = picked;
  } else {
    const asked = params.chunk;
    index = asked !== undefined && Number.isInteger(asked) && asked >= 0 && asked < chunks.length ? asked : suggestedChunk(chunks, opts.progress);
    words = chunks[index] ?? [];
  }
  const start = words.find((w) => w.id === params.startId);
  if (start === undefined) return { chunks, index, words, startId: null };
  return { chunks, index, words: [start, ...words.filter((w) => w !== start)], startId: start.id };
}

/**
 * The run's first state. A start word (already collected: only a collected
 * wall tile opens one) shows its back at once and counts as turned, so its
 * `introduced` is not written again.
 */
export function initCardsFlash(words: readonly { id: string }[], startId: string | null): FlashState {
  const s = initFlash(words);
  if (startId === null || s.queue[0] !== startId) return s;
  return { ...s, face: 'back', flipped: new Set([startId]) };
}

/** The strings the card's names are made of (`a11y.koreanItem` and `a11y.vocab.cards`). */
export interface CardsA11y {
  koreanItem: (item: { ko: string; romanization: string; gloss?: string }) => string;
  cards: {
    word: (ko: string) => string;
    front: (word: string) => string;
    back: (word: string, gloss: string) => string;
    turnedBack: (word: string, gloss: string) => string;
    turnedFront: (word: string) => string;
  };
}

export interface CardLabels {
  /** The card button's name on its front: the word and what a press does. */
  front: string;
  /** On its back: the word, its meaning and what a press does. */
  back: string;
  /** Said after a flip to the back. */
  turnedBack: string;
  /** Said after a flip to the front. */
  turnedFront: string;
}

/**
 * The card's names (design/components/FlipCard/spec.md: a caller whose face
 * content is the point of the card puts it in the label and announces the new
 * face). The romanization stays out while reading practice hides it.
 */
export function cardLabels(
  item: { ko: string; romanization: string; gloss: string },
  romanizationShown: boolean,
  a11y: CardsA11y,
): CardLabels {
  const word = romanizationShown ? a11y.koreanItem({ ko: item.ko, romanization: item.romanization }) : a11y.cards.word(item.ko);
  return {
    front: a11y.cards.front(word),
    back: a11y.cards.back(word, item.gloss),
    turnedBack: a11y.cards.turnedBack(word, item.gloss),
    turnedFront: a11y.cards.turnedFront(word),
  };
}

/**
 * Whether a new card front plays its word by itself (T6): once per showing,
 * only when a voice or clip may play with sound on, after the first gesture
 * (F-AUDIO-004 section 3.6), and with no screen reader on (it would talk over
 * the reader as focus lands on the card; `null` = not known yet, the quiet side).
 */
export function mayAutoplay(i: { canPlay: boolean; unlocked: boolean; screenReader: boolean | null; played: boolean }): boolean {
  return i.canPlay && i.unlocked && i.screenReader === false && !i.played;
}

/**
 * The quick check's questions (section 3.5): word-to-picture on
 * `quickCheckItems` (the Show-me-again words first), options from the same
 * topic. Two questions or none: when the topic cannot build two (fewer than 4
 * words with pictures), the check is skipped.
 */
export function quickCheckQuestions(i: {
  chunk: readonly RuntimeVocabItem[];
  again: ReadonlySet<string>;
  universe: readonly RuntimeVocabItem[];
  optionCount: 3 | 4;
  levelOrder: VocabLevelOrder;
  seed: number;
  canRender: (ref: string) => boolean;
}): VocabQuestion[] {
  const pool = quickCheckItems(
    i.chunk.filter((w) => i.canRender(w.visual)),
    i.again,
  );
  if (pool.length < 2) return [];
  let built: VocabQuestion[];
  try {
    built = buildQuestions({
      pool,
      universe: i.universe,
      count: pool.length,
      optionCount: i.optionCount,
      levelOrder: i.levelOrder,
      boxOf: () => 0,
      seed: i.seed,
      canRender: i.canRender,
      // Word-to-picture only: the check never turns into a sound question.
      canPlay: false,
    });
  } catch {
    // `NotEnoughWords`, the builder's only error: no question at all.
    return [];
  }
  const questions = built.filter((q) => q.format === 'word-to-image');
  return questions.length === pool.length ? questions : [];
}

/** `vocab.cards.start` (section 3.7): `level` is the level order, never an age; `chunk` -1 is an `ids` run. */
export function cardsStartEvent(p: { topicKey: string; chunk: number; chunks: number; words: number; level: 0 | 1 | 2 | null }): {
  name: 'vocab.cards.start';
  payload: { topicKey: string; chunk: number; chunks: number; words: number; level: 0 | 1 | 2 | null };
} {
  return { name: 'vocab.cards.start', payload: { topicKey: p.topicKey, chunk: p.chunk, chunks: p.chunks, words: p.words, level: p.level } };
}

/** `vocab.cards.complete` (section 3.7): counts only, no names, no free text. */
export function cardsCompleteEvent(p: { topicKey: string; chunk: number; tally: ChunkTally; checkFirstTry: number; checkQuestions: number }): {
  name: 'vocab.cards.complete';
  payload: {
    topicKey: string;
    chunk: number;
    words: number;
    gotIt: number;
    again: number;
    heard: number;
    newlyCollected: number;
    checkFirstTry: number;
    checkQuestions: number;
  };
} {
  const { tally } = p;
  return {
    name: 'vocab.cards.complete',
    payload: {
      topicKey: p.topicKey,
      chunk: p.chunk,
      words: tally.words,
      gotIt: tally.gotIt,
      again: tally.again,
      heard: tally.heard,
      newlyCollected: tally.newlyCollected,
      checkFirstTry: p.checkFirstTry,
      checkQuestions: p.checkQuestions,
    },
  };
}

/** The summary's Speed round button: its screen is in the build and the learner has a word per option (the topic page's rule). */
export function summarySpeedShown(i: { speedScreen: boolean; collected: number; optionCount: 3 | 4 }): boolean {
  return i.speedScreen && i.collected >= i.optionCount;
}

/**
 * The column width two `lg` mark buttons need side by side: "Show me again"
 * and its longer Spanish line ("Muestramela otra vez") with the button's
 * padding, measured in Chromium (design/screens/vocab/cards.md).
 */
export const MARK_PAIR_MIN_WIDTH = 400;

/** The two mark buttons stack (Got it first) when the column is narrower than they need at this font scale. */
export function markButtonsStacked(columnWidth: number, fontScale: number): boolean {
  return columnWidth < MARK_PAIR_MIN_WIDTH * Math.max(1, fontScale);
}
