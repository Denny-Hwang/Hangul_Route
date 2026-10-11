/**
 * Which question format a word gets (F-VOC-004 §3.2). Pure.
 *
 * The learner level decides which formats exist at all; inside it, each
 * word's Leitner box (F-VOC-005 §3.4) picks one: box 0-1 word-to-image, box 2
 * audio-to-image, box 3 and above image-to-word, each falling back to the
 * nearest format that is allowed (image-to-word -> audio-to-image ->
 * word-to-image), and audio-to-image only when a voice can play (S7).
 */

export type VocabFormat = 'word-to-image' | 'image-to-word' | 'audio-to-image';

/** Learner level as F-LEARN-001's `levelOrder` (null is read as 1 by the caller). */
export type VocabLevelOrder = 0 | 1 | 2;

/** Ladder order, easiest first: hear-and-see the word, then sound only, then read it. */
export const VOCAB_FORMATS: readonly VocabFormat[] = Object.freeze(['word-to-image', 'audio-to-image', 'image-to-word']);

/** Pictures first (0) cannot be asked to read, so it never gets image-to-word. */
export function formatsForLevel(levelOrder: VocabLevelOrder, canPlay: boolean): VocabFormat[] {
  return VOCAB_FORMATS.filter((f) => (levelOrder !== 0 || f !== 'image-to-word') && (canPlay || f !== 'audio-to-image'));
}

const CHAIN_BY_BOX: readonly (readonly VocabFormat[])[] = [
  ['word-to-image'],
  ['word-to-image'],
  ['audio-to-image', 'word-to-image'],
  ['image-to-word', 'audio-to-image', 'word-to-image'],
];

function usable(format: VocabFormat, allowed: readonly VocabFormat[], canPlay: boolean): boolean {
  return allowed.includes(format) && (canPlay || format !== 'audio-to-image');
}

/**
 * The format for a word in `box` (0..5; out-of-range boxes read as the nearest
 * one). Falls back to word-to-image, the default first format for any word,
 * when nothing in the chain is allowed.
 */
export function formatFor(box: number, allowed: readonly VocabFormat[], canPlay: boolean): VocabFormat {
  const index = Number.isNaN(box) ? 0 : Math.min(CHAIN_BY_BOX.length - 1, Math.max(0, Math.floor(box)));
  // `index` is clamped to the table, so the entry always exists.
  return CHAIN_BY_BOX[index]!.find((f) => usable(f, allowed, canPlay)) ?? 'word-to-image';
}

/**
 * The format for a word asked again in the same round: the first format of
 * the ladder it has not had yet, or null when none is left (the word is then
 * not repeated).
 */
export function repeatFormat(used: readonly VocabFormat[], allowed: readonly VocabFormat[], canPlay: boolean): VocabFormat | null {
  return VOCAB_FORMATS.find((f) => !used.includes(f) && usable(f, allowed, canPlay)) ?? null;
}
