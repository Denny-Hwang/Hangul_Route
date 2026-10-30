import { ListenPickRoundSchema, TypeHangulRoundSchema, checkRomanization } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { FIXTURE_ROUNDS, FIXTURE_SPELLING_ROUNDS } from '../e2e-rounds';

describe('Type Hangul e2e fixture rounds', () => {
  it('match the C-1 round schema and carry a correct romanization', () => {
    for (const round of Object.values(FIXTURE_ROUNDS)) {
      expect(TypeHangulRoundSchema.safeParse(round).success, round.id).toBe(true);
      expect(checkRomanization(round.target.ko, round.target.romanization), round.id).toEqual([]);
    }
  });

  it('the spelling rounds parse, carry correct romanizations, and their fallback options sound different from the answer', () => {
    for (const round of Object.values(FIXTURE_SPELLING_ROUNDS)) {
      expect(ListenPickRoundSchema.safeParse(round).success, round.id).toBe(true);
      for (const o of [...round.options, ...round.fallbackOptions]) expect(checkRomanization(o.text.ko, o.text.romanization), o.text.ko).toEqual([]);
      const answer = round.options.find((o) => o.id === round.answerId)!;
      for (const o of round.fallbackOptions) expect(o.text.romanization).not.toBe(answer.text.romanization);
    }
  });
});
