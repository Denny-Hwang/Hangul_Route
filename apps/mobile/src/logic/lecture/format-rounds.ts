import type { ListenPickRound } from '@hangul-route/content-schema';
import type { MinigameScope } from '../minigame-config';
import { lp } from '../scope-builders';

/**
 * Lecture mode for the Stage 1 additions' format (F-CURR-002 section 8, row CM-33): "most new formats need no new
 * slide kind", so Match Shape plays on the existing listen question slides, built with the shipped Listen & Pick builders.
 *
 * - **Match Shape**: the room hears each origin round's letter and picks it among that round's three letters. The
 *   picture and the sourced line are not projected (a listening round, no origin fact). A pair round is left out: its
 *   letter and look-alike (bieup / pieup, eo / o) told apart by ear alone would test hearing, not shape, with a device
 *   voice deciding the answer (owner audio report, 2026-10-29).
 *
 * A round the builders refuse is left out (the deck counts the step as too small, never a crash).
 */

export function shapeListenRounds(scope: MinigameScope): ListenPickRound[] {
  return (scope.matchShape?.rounds ?? []).flatMap((round) => {
    if (round.shape !== 'origin') return [];
    const letters = round.options;
    try {
      return [lp.sym(round.target, letters, { optionIds: letters })];
    } catch {
      return [];
    }
  });
}
