import { FINAL_JAMO, INITIAL_JAMO, decomposeSyllable } from '../romanization/hangul';

/**
 * Hangul spelled block by block with the letter names (F-CURR-002 section 4.5, row CM-31): what a screen reader says
 * for an option of the spelling round, whose options may sound the same (책이 and 채기 are both [채기]). 책이 is
 * "치읓 애 기역, 이응 이" and 채기 is "치읓 애, 기역 이": the letters of each block with a space, the blocks with a comma
 * and a space, and words with a period and a space, so the two options can be told apart by ear. Not in the package
 * barrel (`@hangul-route/content-schema/letter-names`), so the start bundle does not carry the table.
 */

/** The name of each consonant (a first letter, or a final of one letter). */
export const CONSONANT_NAMES: Readonly<Record<string, string>> = {
  'ㄱ': '기역', 'ㄲ': '쌍기역', 'ㄴ': '니은', 'ㄷ': '디귿', 'ㄸ': '쌍디귿', 'ㄹ': '리을', 'ㅁ': '미음',
  'ㅂ': '비읍', 'ㅃ': '쌍비읍', 'ㅅ': '시옷', 'ㅆ': '쌍시옷', 'ㅇ': '이응', 'ㅈ': '지읒', 'ㅉ': '쌍지읒',
  'ㅊ': '치읓', 'ㅋ': '키읔', 'ㅌ': '티읕', 'ㅍ': '피읖', 'ㅎ': '히읗',
};

/** A final of two letters is named by its two letters (ㄳ: 기역 시옷). */
const FINAL_PAIRS: Readonly<Record<string, readonly [string, string]>> = {
  'ㄳ': ['ㄱ', 'ㅅ'], 'ㄵ': ['ㄴ', 'ㅈ'], 'ㄶ': ['ㄴ', 'ㅎ'], 'ㄺ': ['ㄹ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ'], 'ㄼ': ['ㄹ', 'ㅂ'],
  'ㄽ': ['ㄹ', 'ㅅ'], 'ㄾ': ['ㄹ', 'ㅌ'], 'ㄿ': ['ㄹ', 'ㅍ'], 'ㅀ': ['ㄹ', 'ㅎ'], 'ㅄ': ['ㅂ', 'ㅅ'],
};

/** A vowel is named by its sound, written with the silent ㅇ (ㅐ: 애), in Unicode medial order. */
export const VOWEL_NAMES: readonly string[] = [
  '아', '애', '야', '얘', '어', '에', '여', '예', '오', '와', '왜', '외', '요', '우', '워', '웨', '위', '유', '으', '의', '이',
];

/** One block's letters by name: 책 is "치읓 애 기역"; a character that is not a block is kept as it is. */
export function spellBlock(block: string): string {
  const parts = decomposeSyllable(block);
  if (parts === null) return block;
  const names = [CONSONANT_NAMES[parts.initial] as string, VOWEL_NAMES[parts.medial] as string];
  if (parts.final !== '') {
    const pair = FINAL_PAIRS[parts.final];
    names.push(...(pair ? pair.map((l) => CONSONANT_NAMES[l] as string) : [CONSONANT_NAMES[parts.final] as string]));
  }
  return names.join(' ');
}

/** Korean spelled block by block with letter names: blocks joined by ", ", words by ". " (책이: 치읓 애 기역, 이응 이). */
export function spellByLetterNames(ko: string): string {
  return ko
    .normalize('NFC')
    .trim()
    .split(/\s+/)
    .filter((w) => w !== '')
    .map((word) => [...word].filter((ch) => decomposeSyllable(ch) !== null).map(spellBlock).join(', '))
    .filter((w) => w !== '')
    .join('. ');
}

/** Every jamo the tables name: the 19 first letters, the 27 finals and the 21 vowels (a parity test reads it). */
export const NAMED_LETTERS = { initials: INITIAL_JAMO, finals: FINAL_JAMO.slice(1) } as const;
