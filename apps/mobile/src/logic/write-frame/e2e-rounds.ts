import type { WriteFrameRound } from '@hangul-route/content-schema';

/**
 * Test-only Write Frame rounds in the C-1 round shape, played by the fixture build's
 * `navigation/write-frame-e2e.tsx` and the component tests (F-CURR-001 G-5). Never shipped
 * content: no lesson cell reads them (Stage 7's cells are rows S7-1 .. S7-5). Their Korean is
 * checked like any taught Korean (`e2e-rounds.test.ts`); the name round uses the cast name
 * 호야 only, never a real name.
 */
export const FIXTURE_ROUNDS = {
  food: {
    id: 'e2e-food',
    frame: { ko: '저는 ___을/를 좋아해요.', romanization: 'jeoneun ___eul/reul joahaeyo', en: 'I like ___.' },
    slots: [
      {
        id: 'what',
        bank: [
          { ko: '떡볶이', romanization: 'tteokbokki', en: 'spicy rice cakes' },
          { ko: '김밥', romanization: 'gimbap', en: 'gimbap' },
          { ko: '라면', romanization: 'ramyeon', en: 'instant noodles' },
          { ko: '비빔밥', romanization: 'bibimbap', en: 'bibimbap' },
        ],
      },
    ],
    entry: 'type',
    freeEntry: false,
  },
  holiday: {
    id: 'e2e-holiday',
    frame: { ko: '___에 ___을/를 먹었어요.', romanization: '___e ___eul/reul meogeosseoyo', en: 'On ___, I ate ___.' },
    slots: [
      {
        id: 'when',
        bank: [
          { ko: '설날', romanization: 'seollal', en: 'Seollal' },
          { ko: '추석', romanization: 'chuseok', en: 'Chuseok' },
        ],
      },
      {
        id: 'what',
        bank: [
          { ko: '떡국', romanization: 'tteokguk', en: 'rice-cake soup' },
          { ko: '송편', romanization: 'songpyeon', en: 'half-moon rice cakes' },
        ],
      },
    ],
    entry: 'type',
    freeEntry: false,
  },
  place: {
    id: 'e2e-place',
    frame: { ko: '오늘 ___에 가요.', romanization: 'oneul ___e gayo', en: 'Today I go to ___.' },
    slots: [
      {
        id: 'where',
        bank: [
          { ko: '학교', romanization: 'hakgyo', en: 'school' },
          { ko: '공원', romanization: 'gongwon', en: 'the park' },
          { ko: '시장', romanization: 'sijang', en: 'the market' },
        ],
      },
    ],
    entry: 'pick',
    freeEntry: false,
  },
  name: {
    id: 'e2e-name',
    frame: { ko: '제 이름은 ___이에요/예요.', romanization: 'je ireumeun ___ieyo/yeyo', en: 'My name is ___.' },
    slots: [{ id: 'name', bank: [] }],
    entry: 'type',
    freeEntry: true,
    soundTable: {
      groups: [
        [
          { ko: '아', romanization: 'a' },
          { ko: '에', romanization: 'e' },
          { ko: '이', romanization: 'i' },
          { ko: '오', romanization: 'o' },
          { ko: '우', romanization: 'u' },
        ],
        [
          { ko: '마', romanization: 'ma' },
          { ko: '나', romanization: 'na' },
          { ko: '라', romanization: 'ra' },
          { ko: '사', romanization: 'sa' },
          { ko: '카', romanization: 'ka' },
          { ko: '타', romanization: 'ta' },
          { ko: '하', romanization: 'ha' },
        ],
        [
          { ko: '야', romanization: 'ya' },
          { ko: '호', romanization: 'ho' },
          { ko: '리', romanization: 'ri' },
        ],
      ],
      finals: [
        { ko: 'ㄴ', romanization: 'n' },
        { ko: 'ㄹ', romanization: 'l' },
        { ko: 'ㅁ', romanization: 'm' },
        { ko: 'ㅇ', romanization: 'ng' },
      ],
    },
  },
} as const satisfies Record<string, WriteFrameRound>;

export type WriteFrameFixture = keyof typeof FIXTURE_ROUNDS;
