import type { TypeHangulRound } from '@hangul-route/content-schema';

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
} as const satisfies Record<string, TypeHangulRound>;
