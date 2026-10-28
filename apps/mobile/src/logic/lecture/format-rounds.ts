import type { ListenPickRound } from '@hangul-route/content-schema';
import type { MinigameScope } from '../minigame-config';
import { lp } from '../scope-builders';

/**
 * Lecture mode for the Stage 1 additions' format (F-CURR-002 section 8, row CM-33): "most new formats need no new
 * slide kind", so Match Shape plays on the existing listen question slides, built with the shipped Listen & Pick builders.
 *
 * - **Match Shape**: the room hears each round's letter and picks it among the round's letters (an origin round's
 *   three, a pair round's letter and its look-alike), the confusable pair said aloud. The picture is not projected.
 *
 * A round the builders refuse is left out (the deck counts the step as too small, never a crash).
 */

export function shapeListenRounds(scope: MinigameScope): ListenPickRound[] {
  return (scope.matchShape?.rounds ?? []).flatMap((round) => {
    const letters = round.shape === 'origin' ? round.options : [round.target, round.lookAlike];
    try {
      return [lp.sym(round.target, letters, { optionIds: letters })];
    } catch {
      return [];
    }
  });
}
