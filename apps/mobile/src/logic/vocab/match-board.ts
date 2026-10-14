import type { PicWordPair, PicWordRound, RuntimeVocabItem, VocabProgress } from '@hangul-route/content-schema';
import type { MinigameScope } from '../minigame-config';
import { shuffle } from '../shuffle';
import { sameSense } from './catalog';
import { excludedPair } from './excluded-pairs';
import { normaliseSeed } from './question-builder';

/**
 * The Match board of a topic — F-VOC-003 section 3.9 (PR C-6). Pure: the
 * topic's collected words whose pictures draw, in a seeded order, as one
 * F-QUEST-002 Pic-Word Match board of 3 to 5 pairs (`PicWordRoundSchema`).
 * Two words that share their Korean, a sense, an overlapping pair or a
 * picture never sit on one board: either could be "the" match.
 */

/** The most pairs on a board (the schema allows 3-5). */
export const MATCH_MAX_PAIRS = 5;
/** Below this many playable words there is no board (the topic page hides Match). */
export const MATCH_MIN_PAIRS = 3;

export function matchBoard(
  items: readonly RuntimeVocabItem[],
  progress: VocabProgress,
  opts: { seed: number; canRender: (ref: string) => boolean; glossOf: (item: RuntimeVocabItem) => string },
): PicWordRound | null {
  const collected = new Set(progress.items.map((s) => s.id));
  const candidates = shuffle(
    items.filter((item) => collected.has(item.id) && opts.canRender(item.visual)),
    normaliseSeed(opts.seed),
  );
  const chosen = largestBoard(candidates);
  if (chosen.length < MATCH_MIN_PAIRS) return null;
  return { pairs: chosen.map((item) => pairOf(item, opts.glossOf(item))) };
}

/**
 * Whether `matchBoard` deals a board for these words, whatever the seed: the
 * topic page draws Match only then, so the button never goes nowhere.
 */
export function matchPlayable(items: readonly RuntimeVocabItem[], progress: VocabProgress, canRender: (ref: string) => boolean): boolean {
  return matchBoard(items, progress, { seed: 1, canRender, glossOf: () => '' }) !== null;
}

function clash(a: RuntimeVocabItem, b: RuntimeVocabItem): boolean {
  return sameSense(a, b) || excludedPair(a.id, b.id) || a.visual === b.visual;
}

/** Most candidate steps the search takes; far above any topic's size, it only bounds a pathological catalog. */
const SEARCH_BUDGET = 20_000;

/**
 * The most words (up to `MATCH_MAX_PAIRS`) that fit on one board, in the
 * candidates' (seeded) order. A first-fit pick can strand a board (a word that
 * clashes with two others taken first), so this searches: the first fit when
 * it fills a board, else the largest set the candidates allow. The result does
 * not depend on the order whether a board of 3 exists.
 */
function largestBoard(candidates: readonly RuntimeVocabItem[]): RuntimeVocabItem[] {
  let best: RuntimeVocabItem[] = [];
  let steps = 0;
  const chosen: RuntimeVocabItem[] = [];
  const walk = (from: number): boolean => {
    if (chosen.length > best.length) best = [...chosen];
    if (best.length >= MATCH_MAX_PAIRS) return true;
    for (let i = from; i < candidates.length; i += 1) {
      if (chosen.length + (candidates.length - i) <= best.length) return false;
      steps += 1;
      if (steps > SEARCH_BUDGET) return true;
      const item = candidates[i]!;
      if (chosen.some((c) => clash(c, item))) continue;
      chosen.push(item);
      if (walk(i + 1)) return true;
      chosen.pop();
    }
    return false;
  };
  walk(0);
  return best;
}

function pairOf(item: RuntimeVocabItem, gloss: string): PicWordPair {
  const word: PicWordPair['word'] = { ko: item.ko, romanization: item.romanization, en: gloss };
  if (item.spokenKo !== undefined) word.spokenKo = item.spokenKo;
  if (item.audioRef !== undefined) word.audioRef = item.audioRef;
  return { id: item.id, pictureRef: item.visual, word };
}

/** One board as the scope `PicWordMatchGame` plays. */
export function matchScope(board: PicWordRound): MinigameScope {
  return { kind: 'pic-word-match', picWord: { boards: [board] } };
}
