import { TypeHangulRoundSchema, checkRomanization } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { FIXTURE_ROUNDS } from '../e2e-rounds';

describe('Type Hangul e2e fixture rounds', () => {
  it('match the C-1 round schema and carry a correct romanization', () => {
    for (const round of Object.values(FIXTURE_ROUNDS)) {
      expect(TypeHangulRoundSchema.safeParse(round).success, round.id).toBe(true);
      expect(checkRomanization(round.target.ko, round.target.romanization), round.id).toEqual([]);
    }
  });
});
