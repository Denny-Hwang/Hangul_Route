import { OrderItRoundSchema, type OrderItRound } from '@hangul-route/content-schema';

/**
 * The Sentence Builder e2e rounds (F-CURR-001 G-1): the sample sentences of the D-1 mock
 * (F-CURR-001 §3.4, §3.7), parsed through the C-1 schema so they stay valid content. Used only by
 * `sentence-builder-e2e.tsx`, which fixture builds alone register. Every Korean string carries its
 * Revised Romanization, checked by apps/mobile/src/content/__tests__/romanization.test.ts.
 */

const parse = (round: unknown): OrderItRound => OrderItRoundSchema.parse(round);

/** Stage 3 practice: an order round with one extra tile, a particle round, a three-word round. */
export const PRACTICE: readonly OrderItRound[] = [
  parse({
    id: 'e2e-eat-rice',
    sentence: { ko: '밥을 먹어요.', romanization: 'babeul meogeoyo', en: 'I eat rice.' },
    pictureRef: 'card:rice',
    distractors: [{ ko: '물을', romanization: 'mureul', en: 'water' }],
  }),
  parse({
    id: 'e2e-book-i',
    sentence: { ko: '책이 있어요.', romanization: 'chaegi isseoyo', en: 'There is a book.' },
    pictureRef: 'card:book',
    particle: {
      tile: 0,
      choices: [
        { ko: '이', romanization: 'i', en: 'subject marker' },
        { ko: '가', romanization: 'ga', en: 'subject marker' },
      ],
    },
  }),
  parse({
    id: 'e2e-school',
    sentence: { ko: '저는 학교에 가요.', romanization: 'jeoneun hakgyoe gayo', en: 'I go to school.' },
  }),
];

/** The Stage 7 Check: exactly two rounds, no extra tile. */
export const CHECK: readonly OrderItRound[] = [
  parse({
    id: 'e2e-like-tteokguk',
    sentence: { ko: '저는 떡국을 좋아해요.', romanization: 'jeoneun tteokgugeul joahaeyo', en: 'I like tteokguk.' },
  }),
  parse({
    id: 'e2e-drink-milk',
    sentence: { ko: '우유를 마셔요.', romanization: 'uyureul masyeoyo', en: 'I drink milk.' },
  }),
];

/** The Discover note a Stage 3 particle quest would carry (shown again under a particle miss). */
export const PATTERN_NOTE = 'Use {ko:이} after a final consonant, {ko:가} after a vowel.';
