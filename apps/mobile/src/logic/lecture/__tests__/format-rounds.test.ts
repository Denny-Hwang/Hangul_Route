import { describe, expect, it } from 'vitest';
import { scopeFor, type MinigameScope } from '../../minigame-config';
import { shapeListenRounds } from '../format-rounds';

/**
 * F-CURR-002 section 8, row CM-33: lecture mode plays Match Shape's origin rounds as listening rounds among the round's
 * three letters, and leaves the pair rounds out, so no look-alike pair (bieup / pieup, eo / o) is told apart by ear.
 */
describe('shapeListenRounds', () => {
  for (const ref of ['minigame:s1-crafts-q4-play', 'minigame:s1-crafts-q4-apply']) {
    it(`${ref}: one listening round per origin round, none for a pair round`, () => {
      const scope = scopeFor(ref) as MinigameScope;
      const origins = (scope.matchShape?.rounds ?? []).filter((r) => r.shape === 'origin');
      const rounds = shapeListenRounds(scope);
      expect(rounds).toHaveLength(origins.length);
      rounds.forEach((round, i) => {
        const origin = origins[i]!;
        expect(round.answerId).toBe(origin.target);
        expect(round.options.map((o) => o.id).sort()).toEqual([...(origin.shape === 'origin' ? origin.options : [])].sort());
      });
    });
  }
});
