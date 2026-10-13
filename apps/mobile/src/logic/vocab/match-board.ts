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
  const chosen: RuntimeVocabItem[] = [];
  for (const item of candidates) {
    if (chosen.length >= MATCH_MAX_PAIRS) break;
    if (chosen.some((c) => sameSense(c, item) || excludedPair(c.id, item.id) || c.visual === item.visual)) continue;
    chosen.push(item);
  }
  if (chosen.length < MATCH_MIN_PAIRS) return null;
  return { pairs: chosen.map((item) => pairOf(item, opts.glossOf(item))) };
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
