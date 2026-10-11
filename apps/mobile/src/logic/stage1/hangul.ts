import type { Jamo } from '@hangul-route/content-schema';
import { jamoBatchim, jamoConsonants, jamoVowels } from '../../content/jamo';

/**
 * Hangul decomposition for the Stage 1 rules (F-QUEST-002 §3.7): which of the
 * 30 anchor symbols does a word use? Pure; Unicode arithmetic only.
 */

/** The 19 leading consonants in Unicode order (compatibility jamo). */
const INITIALS = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
/** The 21 vowels in Unicode order. */
const MEDIALS = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
/** The 27 final consonants in Unicode order; index 0 (no final) is skipped. */
const FINALS = [...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

const SYLLABLE_FIRST = 0xac00;
const SYLLABLE_LAST = 0xd7a3;
const MEDIAL_COUNT = 21;
const FINAL_COUNT = 28;

export interface HangulBlock {
  initial: string;
  medial: string;
  /** `null` when the block has no final consonant. */
  final: string | null;
}

/**
 * Split one precomposed syllable block into its jamo (compatibility
 * characters, so they compare equal to `Jamo.char`). `null` when `block` is
 * not exactly one Hangul syllable.
 */
export function decompose(block: string): HangulBlock | null {
  if (block.length !== 1) return null;
  const code = block.charCodeAt(0);
  if (code < SYLLABLE_FIRST || code > SYLLABLE_LAST) return null;
  const offset = code - SYLLABLE_FIRST;
  const finalIndex = offset % FINAL_COUNT;
  const medialIndex = Math.floor(offset / FINAL_COUNT) % MEDIAL_COUNT;
  const initialIndex = Math.floor(offset / (FINAL_COUNT * MEDIAL_COUNT));
  return {
    initial: INITIALS[initialIndex]!,
    medial: MEDIALS[medialIndex]!,
    final: finalIndex === 0 ? null : FINALS[finalIndex - 1]!,
  };
}

function idOf(list: readonly Jamo[], char: string): string | null {
  return list.find((j) => j.char === char)?.id ?? null;
}

/**
 * The anchor symbols a word uses, in reading order, repeats included. An
 * initial ㅇ is `jamo:ieung`; a final in the six taught batchim is its
 * `jamo:*-batchim` id (never the initial's id). `null` when any part of the
 * word is outside the 30 symbols: tense or compound jamo, other finals, a
 * non-Hangul character or a space.
 */
export function symbolsOf(word: string): string[] | null {
  if (word.length === 0) return null;
  const ids: string[] = [];
  for (const block of word) {
    const parts = decompose(block);
    if (!parts) return null;
    const initial = idOf(jamoConsonants, parts.initial);
    const medial = idOf(jamoVowels, parts.medial);
    if (!initial || !medial) return null;
    ids.push(initial, medial);
    if (parts.final !== null) {
      const final = idOf(jamoBatchim, parts.final);
      if (!final) return null;
      ids.push(final);
    }
  }
  return ids;
}

/**
 * One key per symbol: the character for a consonant or vowel, `'ㄱ/final'`
 * for a batchim, so a final and the matching initial never share a key
 * (caregiver coverage, F-QUEST-002 §3.7).
 */
export function symbolKey(jamo: Pick<Jamo, 'char' | 'kind'>): string {
  return jamo.kind === 'batchim' ? `${jamo.char}/final` : jamo.char;
}
