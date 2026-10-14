import { OrderItRoundSchema, type OrderItRound } from '@hangul-route/content-schema';

/** Sentence Builder rounds in the C-1 shape, parsed so the fixtures stay valid content (F-CURR-001 §3.4, §3.7). */
const parse = (round: unknown): OrderItRound => OrderItRoundSchema.parse(round);

/** "I eat rice." with one extra tile. */
export const EAT_RICE = parse({
  id: 'r-eat-rice',
  sentence: { ko: '밥을 먹어요.', romanization: 'babeul meogeoyo', en: 'I eat rice.' },
  pictureRef: 'card:rice',
  distractors: [{ ko: '물을', romanization: 'mureul', en: 'water (object)' }],
});

/** Three words, no extra tile (the Stage 7 Check shape). */
export const LIKE_TTEOKGUK = parse({
  id: 'r-like-tteokguk',
  sentence: { ko: '저는 떡국을 좋아해요.', romanization: 'jeoneun tteokgugeul joahaeyo', en: 'I like tteokguk.' },
});

/** A particle round: 책 + 이, every other word pre-placed. */
export const BOOK_PARTICLE = parse({
  id: 'r-book-i',
  sentence: { ko: '책이 있어요.', romanization: 'chaegi isseoyo', en: 'There is a book.' },
  particle: {
    tile: 0,
    choices: [
      { ko: '이', romanization: 'i', en: 'subject marker (after a consonant)' },
      { ko: '가', romanization: 'ga', en: 'subject marker (after a vowel)' },
    ],
  },
});
