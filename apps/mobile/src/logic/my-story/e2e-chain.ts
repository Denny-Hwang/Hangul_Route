import type { MyStoryFrame } from '@hangul-route/content-schema';

/**
 * A test-only My Story chain (F-CURR-002 row CM-38): the wireframe's example (design/wireframes/minigame/my-story.md),
 * played by the fixture build's `navigation/my-story-e2e.tsx` and the component tests. Never shipped content: no lesson
 * cell reads it. Every bank has its neutral option (공원, 호야, 괜찮아요), drawn like the others and never first. Its
 * Korean is checked like any taught Korean (`__tests__/e2e-chain.test.ts`).
 */
export const FIXTURE_CHAIN: readonly MyStoryFrame[] = [
  {
    id: 'e2e-weekend',
    frame: { ko: '저는 주말에 ___에 가요.', romanization: 'jeoneun jumare ___e gayo', en: 'On the weekend I go to ___.' },
    slots: [
      {
        id: 'where',
        bank: [
          { ko: '도서관', romanization: 'doseogwan', en: 'the library' },
          { ko: '시장', romanization: 'sijang', en: 'the market' },
          { ko: '공원', romanization: 'gongwon', en: 'the park', neutral: true },
        ],
      },
    ],
    entry: 'type',
    freeEntry: false,
  },
  {
    id: 'e2e-with',
    frame: { ko: '___과/와 같이 가요.', romanization: '___gwa/wa gachi gayo', en: 'I go with ___.' },
    slots: [
      {
        id: 'who',
        bank: [
          { ko: '친구', romanization: 'chingu', en: 'a friend' },
          { ko: '가족', romanization: 'gajok', en: 'my family' },
          { ko: '호야', romanization: 'hoya', en: 'Hoya', neutral: true },
        ],
      },
    ],
    entry: 'type',
    freeEntry: false,
  },
  {
    id: 'e2e-feel',
    frame: { ko: '기분이 ___.', romanization: 'gibuni ___', en: 'I feel ___.' },
    slots: [
      {
        id: 'how',
        bank: [
          { ko: '좋아요', romanization: 'joayo', en: 'good' },
          { ko: '아주 좋아요', romanization: 'aju joayo', en: 'very good' },
          { ko: '괜찮아요', romanization: 'gwaenchanayo', en: 'okay', neutral: true },
        ],
      },
    ],
    entry: 'pick',
    freeEntry: false,
  },
];

/**
 * The longest chain (5 frames): the wireframe's three, then two pick-only frames, for the large-text and long-chain
 * cases (the story so far folds on a phone from 3 lines). Test data, like `FIXTURE_CHAIN`.
 */
export const FIXTURE_CHAIN_LONG: readonly MyStoryFrame[] = [
  ...FIXTURE_CHAIN,
  {
    id: 'e2e-weather',
    frame: { ko: '날씨가 ___.', romanization: 'nalssiga ___', en: 'The weather is ___.' },
    slots: [
      {
        id: 'weather',
        bank: [
          { ko: '맑아요', romanization: 'malgayo', en: 'clear' },
          { ko: '추워요', romanization: 'chuwoyo', en: 'cold' },
          { ko: '좋아요', romanization: 'joayo', en: 'nice', neutral: true },
        ],
      },
    ],
    entry: 'pick',
    freeEntry: false,
  },
  {
    id: 'e2e-tomorrow',
    frame: { ko: '내일은 ___에 가요.', romanization: 'naeireun ___e gayo', en: 'Tomorrow I go to ___.' },
    slots: [
      {
        id: 'where',
        bank: [
          { ko: '바다', romanization: 'bada', en: 'the sea' },
          { ko: '산', romanization: 'san', en: 'the mountain' },
          { ko: '공원', romanization: 'gongwon', en: 'the park', neutral: true },
        ],
      },
    ],
    entry: 'pick',
    freeEntry: false,
  },
];
