import type { Jamo } from '@hangul-route/content-schema';

/**
 * 24 base jamo (14 consonants + 10 vowels) + 6 batchim (final consonants).
 * Stage 1 anchor skill: ≥90% recognition accuracy.
 * Each entry pairs with a planned audio asset in apps/mobile/assets/audio/jamo/.
 */

const c = (
  id: string,
  char: string,
  romanization: string,
  nameEn: string,
  ipa: string,
  exampleWordKo: string,
  exampleWordEn: string,
  order: number,
): Jamo => ({
  id: `jamo:${id}`,
  char,
  romanization,
  nameEn,
  ipa,
  kind: 'consonant',
  exampleWordKo,
  exampleWordEn,
  audioRef: `audio/jamo/${id}.mp3`,
  order,
});

const v = (
  id: string,
  char: string,
  romanization: string,
  nameEn: string,
  ipa: string,
  exampleWordKo: string,
  exampleWordEn: string,
  order: number,
): Jamo => ({
  id: `jamo:${id}`,
  char,
  romanization,
  nameEn,
  ipa,
  kind: 'vowel',
  exampleWordKo,
  exampleWordEn,
  audioRef: `audio/jamo/${id}.mp3`,
  order,
});

const b = (id: string, char: string, romanization: string, nameEn: string, order: number): Jamo => ({
  id: `jamo:${id}-batchim`,
  char,
  romanization,
  nameEn,
  kind: 'batchim',
  audioRef: `audio/jamo/${id}-batchim.mp3`,
  order,
});

export const jamoConsonants: Jamo[] = [
  c('giyeok', 'ㄱ', 'g/k', 'giyeok', 'k', '가족', 'family', 1),
  c('nieun', 'ㄴ', 'n', 'nieun', 'n', '나무', 'tree', 2),
  c('digeut', 'ㄷ', 'd/t', 'digeut', 't', '달', 'moon', 3),
  c('rieul', 'ㄹ', 'r/l', 'rieul', 'r', '라면', 'ramyeon', 4),
  c('mieum', 'ㅁ', 'm', 'mieum', 'm', '물', 'water', 5),
  c('bieup', 'ㅂ', 'b/p', 'bieup', 'p', '밥', 'rice', 6),
  c('siot', 'ㅅ', 's', 'siot', 's', '산', 'mountain', 7),
  c('ieung', 'ㅇ', '∅/ng', 'ieung', 'ŋ', '아이', 'child', 8),
  c('jieut', 'ㅈ', 'j', 'jieut', 'tɕ', '집', 'house', 9),
  c('chieut', 'ㅊ', 'ch', 'chieut', 'tɕʰ', '책', 'book', 10),
  c('kieuk', 'ㅋ', 'k', 'kieuk', 'kʰ', '코', 'nose', 11),
  c('tieut', 'ㅌ', 't', 'tieut', 'tʰ', '토끼', 'rabbit', 12),
  c('pieup', 'ㅍ', 'p', 'pieup', 'pʰ', '포도', 'grape', 13),
  c('hieut', 'ㅎ', 'h', 'hieut', 'h', '하늘', 'sky', 14),
];

export const jamoVowels: Jamo[] = [
  v('a', 'ㅏ', 'a', 'a', 'a', '아빠', 'dad', 15),
  v('ya', 'ㅑ', 'ya', 'ya', 'ja', '야구', 'baseball', 16),
  v('eo', 'ㅓ', 'eo', 'eo', 'ʌ', '엄마', 'mom', 17),
  v('yeo', 'ㅕ', 'yeo', 'yeo', 'jʌ', '여우', 'fox', 18),
  v('o', 'ㅗ', 'o', 'o', 'o', '오리', 'duck', 19),
  v('yo', 'ㅛ', 'yo', 'yo', 'jo', '요리', 'cooking', 20),
  v('u', 'ㅜ', 'u', 'u', 'u', '우유', 'milk', 21),
  v('yu', 'ㅠ', 'yu', 'yu', 'ju', '유리', 'glass', 22),
  v('eu', 'ㅡ', 'eu', 'eu', 'ɯ', '으뜸', 'first', 23),
  v('i', 'ㅣ', 'i', 'i', 'i', '이름', 'name', 24),
];

export const jamoBatchim: Jamo[] = [
  b('giyeok', 'ㄱ', 'k', 'giyeok-final', 25),
  b('nieun', 'ㄴ', 'n', 'nieun-final', 26),
  b('rieul', 'ㄹ', 'l', 'rieul-final', 27),
  b('mieum', 'ㅁ', 'm', 'mieum-final', 28),
  b('bieup', 'ㅂ', 'p', 'bieup-final', 29),
  b('ieung', 'ㅇ', 'ng', 'ieung-final', 30),
];

export const jamoAll: Jamo[] = [...jamoConsonants, ...jamoVowels, ...jamoBatchim];

export function findJamo(id: string): Jamo | undefined {
  return jamoAll.find((j) => j.id === id);
}
