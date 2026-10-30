import type { ListenPickRound, TypeHangulRound } from '@hangul-route/content-schema';

/**
 * Test-only Type Hangul rounds in the C-1 round shape, played by the fixture build's
 * `navigation/type-hangul-e2e.tsx` (F-CURR-001 G-3). Never shipped content: no lesson
 * cell reads them. Their Korean is checked like any taught Korean (`e2e-rounds.test.ts`).
 */
export const FIXTURE_ROUNDS = {
  hoya: {
    id: 'e2e-hoya',
    promptEn: "Type Hoya's name",
    target: { ko: '호야', romanization: 'hoya', en: 'Hoya' },
  },
  bibimbap: {
    id: 'e2e-bibimbap',
    promptEn: 'Type the dish you want to order',
    pictureRef: 'word:culture-bibimbap',
    target: { ko: '비빔밥', romanization: 'bibimbap', en: 'bibimbap' },
  },
  sentence: {
    id: 'e2e-sentence',
    promptEn: 'Type the sentence',
    target: { ko: '저는 호야예요', romanization: 'jeoneun hoyayeyo', en: 'I am Hoya.' },
  },
  // F-CURR-002 row CM-31: Dictation (Type Hangul `hear`); words with one spelling for their sound and no sound change.
  hearApple: {
    id: 'e2e-hear-apple',
    promptEn: 'Type the word you hear.',
    mode: 'hear',
    target: { ko: '사과', romanization: 'sagwa', en: 'apple' },
  },
  hearMilk: {
    id: 'e2e-hear-milk',
    promptEn: 'Type the word you hear.',
    mode: 'hear',
    target: { ko: '우유', romanization: 'uyu', en: 'milk' },
  },
} as const satisfies Record<string, TypeHangulRound>;

/**
 * Test-only spelling rounds (F-CURR-002 section 4.5, row CM-31) for the fixture build's spelling e2e: the two options
 * of 책이 sound the same ([채기]); the meaning settles it, and the fallback options sound different.
 */
export const FIXTURE_SPELLING_ROUNDS = {
  book: {
    id: 'e2e-spelling-book',
    promptKind: 'spelling',
    prompt: { ko: '책이', romanization: 'chaegi', en: 'book' },
    options: [
      { id: 'a', text: { ko: '책이', romanization: 'chaegi', en: 'book' } },
      { id: 'b', text: { ko: '채기', romanization: 'chaegi', en: 'book' } },
    ],
    answerId: 'a',
    fallbackOptions: [
      { id: 'c', text: { ko: '학교', romanization: 'hakgyo', en: 'school' } },
      { id: 'd', text: { ko: '우유', romanization: 'uyu', en: 'milk' } },
    ],
  },
} as const satisfies Record<string, ListenPickRound>;
