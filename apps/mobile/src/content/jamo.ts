import type { Jamo } from '@hangul-route/content-schema';

type SpokenKind = Jamo['spokenKind'];

/**
 * 24 base jamo (14 consonants + 10 vowels) + 6 batchim (final consonants).
 * Stage 1 anchor skill: ≥90% recognition accuracy.
 * Each entry pairs with a planned audio asset in apps/mobile/assets/audio/jamo/.
 *
 * Spoken forms (F-AUDIO-004 §3.2, AD2 carrier rule): consonant sound = consonant + ㅏ,
 * vowel sound = ㅇ + vowel, batchim sound = ㅇ + ㅏ + final. Initial ㅇ has no sound,
 * so it is spoken by its name 이응 (spokenKind 'name'). spokenRomanization is the
 * Revised Romanization of spokenKo (D13); nameKo is the Hangul letter name.
 */

const c = (
  id: string,
  char: string,
  romanization: string,
  nameEn: string,
  ipa: string,
  exampleWordKo: string,
  exampleWordRomanization: string,
  exampleWordEn: string,
  order: number,
  spokenKo: string,
  spokenRomanization: string,
  nameKo: string,
  spokenKind: SpokenKind = 'sound',
): Jamo => ({
  id: `jamo:${id}`,
  char,
  romanization,
  nameEn,
  ipa,
  kind: 'consonant',
  exampleWordKo,
  exampleWordRomanization,
  exampleWordEn,
  audioRef: `audio/jamo/${id}.mp3`,
  spokenKo,
  spokenRomanization,
  spokenKind,
  nameKo,
  order,
});

const v = (
  id: string,
  char: string,
  romanization: string,
  nameEn: string,
  ipa: string,
  exampleWordKo: string,
  exampleWordRomanization: string,
  exampleWordEn: string,
  order: number,
  spokenKo: string,
  spokenRomanization: string,
  nameKo: string,
  spokenKind: SpokenKind = 'sound',
): Jamo => ({
  id: `jamo:${id}`,
  char,
  romanization,
  nameEn,
  ipa,
  kind: 'vowel',
  exampleWordKo,
  exampleWordRomanization,
  exampleWordEn,
  audioRef: `audio/jamo/${id}.mp3`,
  spokenKo,
  spokenRomanization,
  spokenKind,
  nameKo,
  order,
});

const b = (
  id: string,
  char: string,
  romanization: string,
  nameEn: string,
  order: number,
  spokenKo: string,
  spokenRomanization: string,
): Jamo => ({
  id: `jamo:${id}-batchim`,
  char,
  romanization,
  nameEn,
  kind: 'batchim',
  audioRef: `audio/jamo/${id}-batchim.mp3`,
  spokenKo,
  spokenRomanization,
  spokenKind: 'sound',
  order,
});

export const jamoConsonants: Jamo[] = [
  c('giyeok', 'ㄱ', 'g/k', 'giyeok', 'k', '가족', 'gajok', 'family', 1, '가', 'ga', '기역'),
  c('nieun', 'ㄴ', 'n', 'nieun', 'n', '나무', 'namu', 'tree', 2, '나', 'na', '니은'),
  c('digeut', 'ㄷ', 'd/t', 'digeut', 't', '달', 'dal', 'moon', 3, '다', 'da', '디귿'),
  c('rieul', 'ㄹ', 'r/l', 'rieul', 'r', '라면', 'ramyeon', 'ramyeon', 4, '라', 'ra', '리을'),
  c('mieum', 'ㅁ', 'm', 'mieum', 'm', '물', 'mul', 'water', 5, '마', 'ma', '미음'),
  c('bieup', 'ㅂ', 'b/p', 'bieup', 'p', '밥', 'bap', 'rice', 6, '바', 'ba', '비읍'),
  c('siot', 'ㅅ', 's', 'siot', 's', '산', 'san', 'mountain', 7, '사', 'sa', '시옷'),
  c('ieung', 'ㅇ', 'silent/ng', 'ieung', 'ŋ', '아이', 'ai', 'child', 8, '이응', 'ieung', '이응', 'name'),
  c('jieut', 'ㅈ', 'j', 'jieut', 'tɕ', '집', 'jip', 'house', 9, '자', 'ja', '지읒'),
  c('chieut', 'ㅊ', 'ch', 'chieut', 'tɕʰ', '책', 'chaek', 'book', 10, '차', 'cha', '치읓'),
  c('kieuk', 'ㅋ', 'k', 'kieuk', 'kʰ', '코', 'ko', 'nose', 11, '카', 'ka', '키읔'),
  c('tieut', 'ㅌ', 't', 'tieut', 'tʰ', '토끼', 'tokki', 'rabbit', 12, '타', 'ta', '티읕'),
  c('pieup', 'ㅍ', 'p', 'pieup', 'pʰ', '포도', 'podo', 'grape', 13, '파', 'pa', '피읖'),
  c('hieut', 'ㅎ', 'h', 'hieut', 'h', '하늘', 'haneul', 'sky', 14, '하', 'ha', '히읗'),
];

export const jamoVowels: Jamo[] = [
  v('a', 'ㅏ', 'a', 'a', 'a', '아빠', 'appa', 'dad', 15, '아', 'a', '아'),
  v('ya', 'ㅑ', 'ya', 'ya', 'ja', '야구', 'yagu', 'baseball', 16, '야', 'ya', '야'),
  v('eo', 'ㅓ', 'eo', 'eo', 'ʌ', '엄마', 'eomma', 'mom', 17, '어', 'eo', '어'),
  v('yeo', 'ㅕ', 'yeo', 'yeo', 'jʌ', '여우', 'yeou', 'fox', 18, '여', 'yeo', '여'),
  v('o', 'ㅗ', 'o', 'o', 'o', '오리', 'ori', 'duck', 19, '오', 'o', '오'),
  v('yo', 'ㅛ', 'yo', 'yo', 'jo', '요리', 'yori', 'cooking', 20, '요', 'yo', '요'),
  v('u', 'ㅜ', 'u', 'u', 'u', '우유', 'uyu', 'milk', 21, '우', 'u', '우'),
  v('yu', 'ㅠ', 'yu', 'yu', 'ju', '유리', 'yuri', 'glass', 22, '유', 'yu', '유'),
  v('eu', 'ㅡ', 'eu', 'eu', 'ɯ', '으뜸', 'eutteum', 'first', 23, '으', 'eu', '으'),
  v('i', 'ㅣ', 'i', 'i', 'i', '이름', 'ireum', 'name', 24, '이', 'i', '이'),
];

export const jamoBatchim: Jamo[] = [
  b('giyeok', 'ㄱ', 'k', 'giyeok-final', 25, '악', 'ak'),
  b('nieun', 'ㄴ', 'n', 'nieun-final', 26, '안', 'an'),
  b('rieul', 'ㄹ', 'l', 'rieul-final', 27, '알', 'al'),
  b('mieum', 'ㅁ', 'm', 'mieum-final', 28, '암', 'am'),
  b('bieup', 'ㅂ', 'p', 'bieup-final', 29, '압', 'ap'),
  b('ieung', 'ㅇ', 'ng', 'ieung-final', 30, '앙', 'ang'),
];

export const jamoAll: Jamo[] = [...jamoConsonants, ...jamoVowels, ...jamoBatchim];

export function findJamo(id: string): Jamo | undefined {
  return jamoAll.find((j) => j.id === id);
}
