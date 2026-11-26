import type { HostMode } from '../../screens/minigames/host';
import type { Rung } from '../memory/spacing';

/**
 * What a Check holds back until the question is answered (AMENDMENTS-STAGE1-DECODING-CHECK section 3.1, row DC-1a;
 * owner decision 2026-11-22, OD-R1: the Checks measure reading). One rule, one place, pure.
 *
 * The keys to an answer, while the question is open: every romanization line of the question's taught Korean (the
 * prompt or stimulus and every option or tile) and the gloss of every Korean option. A held line keeps its room, draws
 * nothing and is off the accessibility tree (AU-8's `romanizationReserved`); the screen-reader names are unchanged. The
 * hold ends when the question is answered right, and then every line shows as the surface shows it (the learner's mode).
 * It applies whatever the romanization mode is, so no screen passes an override for it.
 */
export type HoldSurface = 'quest-check' | 'hangul-check' | 'stage-check' | 'cell-check' | 'daily-review' | 'practice';

/**
 * Whether the keys to this question's answer are held while the question is open. The four Checks hold every round
 * (a Cell Check in every mode: each is an assessment); the Daily Review (and Keep going) holds at the read and produce
 * rungs, its recognize rung (hear it, pick it) is practice; `practice` never holds and is what a surface that names
 * nothing gets.
 */
export function holdsRomanization(surface: HoldSurface, rung?: Rung): boolean {
  switch (surface) {
    case 'quest-check':
    case 'hangul-check':
    case 'stage-check':
    case 'cell-check':
      return true;
    case 'daily-review':
      return rung === 'read' || rung === 'produce';
    case 'practice':
      return false;
  }
}

/**
 * The surface a Listen & Pick host stands for: the quest's Check step (`check`) and the Hangul Check (`review`) are
 * Checks; a practice step, a vocabulary round and a preview are practice.
 */
export function hostSurface(mode: HostMode): HoldSurface {
  return mode === 'check' ? 'quest-check' : mode === 'review' ? 'hangul-check' : 'practice';
}
