import type { MinigameKind } from '@hangul-route/content-schema';

/**
 * Maps a quest's minigame ref into a concrete content scope.
 * Each Stage 1 quest declares the jamo / words its minigames should target.
 */

export interface MinigameScope {
  kind: MinigameKind;
  jamoIds?: string[];
  syllables?: Array<{ ko: string; romanization: string; jamoChars: string[] }>;
  cardPairs?: Array<{ ko: string; en: string; romanization?: string }>;
  storySteps?: Array<{ id: string; labelEn: string; labelKo?: string }>;
  rounds?: number;
}

const J = (id: string): string => `jamo:${id}`;
const Jb = (id: string): string => `jamo:${id}-batchim`;

export const minigameScopes: Record<string, MinigameScope> = {
  // Stage 1 / Letters / Q1 — g, n, d, l
  'minigame:s1-letters-recognize-1': {
    kind: 'match-sound',
    jamoIds: [J('giyeok'), J('nieun'), J('digeut'), J('rieul')],
    rounds: 4,
  },
  'minigame:s1-letters-match-1': {
    kind: 'match-sound',
    jamoIds: [J('giyeok'), J('nieun'), J('digeut'), J('rieul')],
    rounds: 5,
  },
  'minigame:s1-letters-build-1': {
    kind: 'build-letter',
    syllables: [
      { ko: '가', romanization: 'ga', jamoChars: ['ㄱ', 'ㅏ'] },
      { ko: '나', romanization: 'na', jamoChars: ['ㄴ', 'ㅏ'] },
      { ko: '다', romanization: 'da', jamoChars: ['ㄷ', 'ㅏ'] },
      { ko: '라', romanization: 'ra', jamoChars: ['ㄹ', 'ㅏ'] },
    ],
  },

  // Stage 1 / Letters / Q2 — m, b, s, ng
  'minigame:s1-letters-recognize-2': {
    kind: 'match-sound',
    jamoIds: [J('mieum'), J('bieup'), J('siot'), J('ieung')],
    rounds: 4,
  },
  'minigame:s1-letters-trace-1': {
    kind: 'trace-stroke',
    jamoIds: [J('mieum'), J('bieup'), J('siot'), J('ieung')],
    rounds: 4,
  },
  'minigame:s1-letters-match-2': {
    kind: 'match-sound',
    jamoIds: [
      J('giyeok'),
      J('nieun'),
      J('digeut'),
      J('rieul'),
      J('mieum'),
      J('bieup'),
      J('siot'),
      J('ieung'),
    ],
    rounds: 5,
  },

  // Stage 1 / Letters / Q3 — vowels
  'minigame:s1-letters-recognize-3': {
    kind: 'match-sound',
    jamoIds: [J('a'), J('eo'), J('o'), J('u'), J('eu'), J('i')],
    rounds: 5,
  },
  'minigame:s1-letters-match-3': {
    kind: 'match-sound',
    jamoIds: [J('a'), J('eo'), J('o'), J('u'), J('eu'), J('i')],
    rounds: 5,
  },
  'minigame:s1-letters-build-2': {
    kind: 'build-letter',
    syllables: [
      { ko: '가', romanization: 'ga', jamoChars: ['ㄱ', 'ㅏ'] },
      { ko: '거', romanization: 'geo', jamoChars: ['ㄱ', 'ㅓ'] },
      { ko: '고', romanization: 'go', jamoChars: ['ㄱ', 'ㅗ'] },
      { ko: '구', romanization: 'gu', jamoChars: ['ㄱ', 'ㅜ'] },
    ],
  },

  // Stage 1 / Food & Life
  'minigame:s1-life-card-1': {
    kind: 'card-match',
    cardPairs: [
      { ko: '김치', en: 'Kimchi', romanization: 'gimchi' },
      { ko: '밥', en: 'Rice', romanization: 'bap' },
      { ko: '김밥', en: 'Kimbap', romanization: 'gimbap' },
      { ko: '젓가락', en: 'Chopsticks', romanization: 'jeotgarak' },
    ],
  },
  'minigame:s1-life-card-2': {
    kind: 'card-match',
    cardPairs: [
      { ko: '엄마', en: 'Mom', romanization: 'eomma' },
      { ko: '아빠', en: 'Dad', romanization: 'appa' },
      { ko: '가족', en: 'Family', romanization: 'gajok' },
      { ko: '집', en: 'Home', romanization: 'jip' },
    ],
  },
  'minigame:s1-life-match-1': {
    kind: 'match-sound',
    jamoIds: [J('giyeok'), J('mieum'), J('bieup'), J('jieut')],
    rounds: 4,
  },
  'minigame:s1-life-story-1': {
    kind: 'story-sequence',
    storySteps: [
      { id: 'a', labelEn: 'Wash hands', labelKo: '손 씻기' },
      { id: 'b', labelEn: 'Set the table', labelKo: '상 차리기' },
      { id: 'c', labelEn: 'Eat with family', labelKo: '같이 먹기' },
      { id: 'd', labelEn: 'Say thanks', labelKo: '잘 먹었습니다' },
    ],
  },

  // Stage 1 / Rites
  'minigame:s1-rites-card-1': {
    kind: 'card-match',
    cardPairs: [
      { ko: '설날', en: 'Lunar New Year', romanization: 'seollal' },
      { ko: '떡국', en: 'Rice cake soup', romanization: 'tteokguk' },
      { ko: '한복', en: 'Hanbok', romanization: 'hanbok' },
      { ko: '세배', en: 'New Year bow', romanization: 'sebae' },
    ],
  },
  'minigame:s1-rites-match-1': {
    kind: 'match-sound',
    jamoIds: [J('siot'), J('digeut'), J('rieul'), J('hieut')],
    rounds: 4,
  },
  'minigame:s1-rites-story-1': {
    kind: 'story-sequence',
    storySteps: [
      { id: 'a', labelEn: 'Wear hanbok', labelKo: '한복 입기' },
      { id: 'b', labelEn: 'Bow to elders', labelKo: '세배 드리기' },
      { id: 'c', labelEn: 'Eat tteokguk', labelKo: '떡국 먹기' },
      { id: 'd', labelEn: 'Receive lucky money', labelKo: '세뱃돈 받기' },
    ],
  },

  // Stage 1 / Nature
  'minigame:s1-nature-card-1': {
    kind: 'card-match',
    cardPairs: [
      { ko: '호랑이', en: 'Tiger', romanization: 'horangi' },
      { ko: '까치', en: 'Magpie', romanization: 'kkachi' },
      { ko: '달', en: 'Moon', romanization: 'dal' },
      { ko: '산', en: 'Mountain', romanization: 'san' },
    ],
  },
  'minigame:s1-nature-match-1': {
    kind: 'match-sound',
    jamoIds: [J('hieut'), J('kieuk'), J('mieum'), J('siot')],
    rounds: 4,
  },

  // Stage 1 / Crafts
  'minigame:s1-crafts-card-1': {
    kind: 'card-match',
    cardPairs: [
      { ko: '윷', en: 'Yut sticks', romanization: 'yut' },
      { ko: '연', en: 'Kite', romanization: 'yeon' },
      { ko: '팽이', en: 'Top', romanization: 'paengi' },
      { ko: '제기', en: 'Foot shuttlecock', romanization: 'jegi' },
    ],
  },
  'minigame:s1-crafts-match-1': {
    kind: 'match-sound',
    jamoIds: [J('ieung'), J('pieup'), J('jieut'), J('kieuk')],
    rounds: 4,
  },
  'minigame:s1-crafts-story-1': {
    kind: 'story-sequence',
    storySteps: [
      { id: 'a', labelEn: 'Pick teams', labelKo: '편 가르기' },
      { id: 'b', labelEn: 'Throw the yut', labelKo: '윷 던지기' },
      { id: 'c', labelEn: 'Move the piece', labelKo: '말 옮기기' },
      { id: 'd', labelEn: 'Win!', labelKo: '승리!' },
    ],
  },

  // Stage 1 / Letters — Odd One Out (consonants vs vowels)
  'minigame:s1-letters-odd-1': {
    kind: 'odd-one-out',
    jamoIds: [J('giyeok'), J('nieun'), J('digeut'), J('rieul'), J('a'), J('eo')],
    rounds: 4,
  },

  // Stage 1 / Nature — Culture Quiz (Korean word -> English meaning)
  'minigame:s1-nature-quiz-1': {
    kind: 'culture-quiz',
    cardPairs: [
      { ko: '호랑이', en: 'Tiger', romanization: 'horangi' },
      { ko: '까치', en: 'Magpie', romanization: 'kkachi' },
      { ko: '달', en: 'Moon', romanization: 'dal' },
      { ko: '산', en: 'Mountain', romanization: 'san' },
      { ko: '바다', en: 'Sea', romanization: 'bada' },
    ],
    rounds: 4,
  },
};

export function scopeFor(ref: string): MinigameScope | undefined {
  return minigameScopes[ref];
}

// Suppress unused-import warning for type used in JSDoc
export type { MinigameKind };
