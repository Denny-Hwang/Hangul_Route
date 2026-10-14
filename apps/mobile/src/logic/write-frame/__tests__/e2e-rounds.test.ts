import { WriteFrameRoundSchema, checkRomanization, fillFrame, romanize, type WriteFrameRound } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { FIXTURE_ROUNDS } from '../e2e-rounds';

describe('Write Frame e2e fixture rounds', () => {
  it('match the C-1 round schema, and every bank word carries a correct romanization', () => {
    for (const round of Object.values(FIXTURE_ROUNDS) as WriteFrameRound[]) {
      expect(WriteFrameRoundSchema.safeParse(round).success, round.id).toBe(true);
      for (const word of round.slots.flatMap((s) => s.bank)) expect(checkRomanization(word.ko, word.romanization), word.ko).toEqual([]);
    }
  });

  it('every pick makes a sentence the converter reads', () => {
    const { food, holiday } = FIXTURE_ROUNDS;
    expect(food.slots[0].bank.map((w) => fillFrame(food.frame.ko, [w.ko]))).toEqual([
      '저는 떡볶이를 좋아해요.',
      '저는 김밥을 좋아해요.',
      '저는 라면을 좋아해요.',
      '저는 비빔밥을 좋아해요.',
    ]);
    expect(romanize(fillFrame(holiday.frame.ko, ['추석', '송편'])).unknown).toEqual([]);
  });
});
