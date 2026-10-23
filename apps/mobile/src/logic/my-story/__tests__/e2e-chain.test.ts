import { MyStoryFramesSchema, checkRomanization, fillFrame, romanize } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { FIXTURE_CHAIN } from '../e2e-chain';

describe('the My Story fixture chain (row CM-38)', () => {
  it('is a chain of the schema, and every bank word carries a correct romanization', () => {
    expect(MyStoryFramesSchema.safeParse(FIXTURE_CHAIN).success).toBe(true);
    for (const word of FIXTURE_CHAIN.flatMap((f) => f.slots.flatMap((s) => s.bank))) expect(checkRomanization(word.ko, word.romanization), word.ko).toEqual([]);
  });

  it('every pick makes a sentence the converter reads; the neutral picks tell nothing about the learner', () => {
    for (const frame of FIXTURE_CHAIN) {
      for (const word of frame.slots[0]!.bank) expect(romanize(fillFrame(frame.frame.ko, [word.ko])).unknown, word.ko).toEqual([]);
    }
    const neutral = FIXTURE_CHAIN.map((f) => fillFrame(f.frame.ko, [f.slots[0]!.bank.find((w) => w.neutral === true)!.ko]));
    expect(neutral).toEqual(['저는 주말에 공원에 가요.', '호야와 같이 가요.', '기분이 괜찮아요.']);
  });
});
