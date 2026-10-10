/**
 * Hangul constants and syllable decompose/compose helpers (F-CNT-002 §3.2).
 * No sound-change logic lives here. Pure, dependency-free, Hermes-safe
 * (no Unicode property escapes, no look-behind).
 */

/** Initial consonants (choseong) in Unicode block order, as compatibility jamo. */
export const INITIAL_JAMO: readonly string[] = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

/** Final consonants (jongseong); index 0 is "no final". */
export const FINAL_JAMO: readonly string[] = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ',
  'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

/** Revised Romanization of each initial, aligned with INITIAL_JAMO. */
export const INITIAL_RR: readonly string[] = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's',
  'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h',
];

/** Revised Romanization of each medial vowel (jungseong), in Unicode block order. */
export const MEDIAL_RR: readonly string[] = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae',
  'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i',
];

/** Index of the medial ㅣ (palatalisation trigger). */
export const MEDIAL_I = 20;

const SYLLABLE_FIRST = 0xac00;
const SYLLABLE_LAST = 0xd7a3;
const MEDIALS = 21;
const FINALS = 28;

export interface SyllableParts {
  /** Initial consonant as a compatibility jamo (ㅇ for a silent initial). */
  initial: string;
  /** Medial vowel index into MEDIAL_RR (0..20). */
  medial: number;
  /** Final consonant as a compatibility jamo, or '' when absent. */
  final: string;
}

/** True when `ch` is exactly one precomposed Hangul syllable block (U+AC00..U+D7A3). */
export function isSyllable(ch: string): boolean {
  if (ch.length !== 1) return false;
  const code = ch.charCodeAt(0);
  return code >= SYLLABLE_FIRST && code <= SYLLABLE_LAST;
}

/** Split one syllable block into initial/medial/final; null when `ch` is not a syllable block. */
export function decomposeSyllable(ch: string): SyllableParts | null {
  if (!isSyllable(ch)) return null;
  const index = ch.charCodeAt(0) - SYLLABLE_FIRST;
  return {
    initial: INITIAL_JAMO[Math.floor(index / (MEDIALS * FINALS))] as string,
    medial: Math.floor((index % (MEDIALS * FINALS)) / FINALS),
    final: FINAL_JAMO[index % FINALS] as string,
  };
}

/** Inverse of decomposeSyllable; null when any part is not a valid jamo. */
export function composeSyllable(parts: SyllableParts): string | null {
  const initial = INITIAL_JAMO.indexOf(parts.initial);
  const final = FINAL_JAMO.indexOf(parts.final);
  if (initial < 0 || final < 0 || parts.medial < 0 || parts.medial >= MEDIALS) return null;
  if (parts.medial !== Math.floor(parts.medial)) return null;
  return String.fromCharCode(SYLLABLE_FIRST + (initial * MEDIALS + parts.medial) * FINALS + final);
}
