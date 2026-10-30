/**
 * Letter names for Syllable Build's screen-reader labels (F-CURR-002 row CM-32; design/wireframes/minigame/syllable-build.md,
 * Accessibility): a tile is named by its jamo and the letter's name in romanization ("ㅂ, letter bieup"), never by its
 * sound value in the block, so a label never answers the round. The names are the RR names the Stage 1 symbols carry
 * (`jamo:bieup`; `packages/content-schema/src/review-items/stage1-items.json`, kept equal by a test). A vowel's name is
 * its sound (ㅏ `a`), the only name a screen reader can give it, and the name the Stage 1 lessons teach.
 */
const NAMES: Readonly<Record<string, string>> = {
  ㄱ: 'giyeok',
  ㄲ: 'ssanggiyeok',
  ㄴ: 'nieun',
  ㄷ: 'digeut',
  ㄸ: 'ssangdigeut',
  ㄹ: 'rieul',
  ㅁ: 'mieum',
  ㅂ: 'bieup',
  ㅃ: 'ssangbieup',
  ㅅ: 'siot',
  ㅆ: 'ssangsiot',
  ㅇ: 'ieung',
  ㅈ: 'jieut',
  ㅉ: 'ssangjieut',
  ㅊ: 'chieut',
  ㅋ: 'kieuk',
  ㅌ: 'tieut',
  ㅍ: 'pieup',
  ㅎ: 'hieut',
  ㅏ: 'a',
  ㅐ: 'ae',
  ㅑ: 'ya',
  ㅒ: 'yae',
  ㅓ: 'eo',
  ㅔ: 'e',
  ㅕ: 'yeo',
  ㅖ: 'ye',
  ㅗ: 'o',
  ㅘ: 'wa',
  ㅙ: 'wae',
  ㅚ: 'oe',
  ㅛ: 'yo',
  ㅜ: 'u',
  ㅝ: 'wo',
  ㅞ: 'we',
  ㅟ: 'wi',
  ㅠ: 'yu',
  ㅡ: 'eu',
  ㅢ: 'ui',
  ㅣ: 'i',
};

/** The letter's name in romanization (`bieup`); the jamo itself for a character that is no letter. */
export function letterName(jamo: string): string {
  return NAMES[jamo] ?? jamo;
}

/** Every letter that has a name: the 19 first letters and the 21 vowels. */
export const NAMED_LETTERS: readonly string[] = Object.keys(NAMES);
