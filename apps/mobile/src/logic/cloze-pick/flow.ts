import { LISTEN_PICK_TIMING, startFlow, stepFlow, type FlowEffect as ListenEffect, type ListenPickFlowState } from '../listen-pick-flow';

/**
 * The Cloze Pick reducer (F-CURR-002 section 7.1 F1, row CM-30; design/wireframes/minigame/cloze-pick.md,
 * Interaction points). Pure. It is the Listen & Pick flow (`../listen-pick-flow.ts`) with Cloze Pick's sound rule,
 * so the two games score, lock, ring and advance the same way:
 *
 * - **No sound before the answer.** The sentence is not said while the gap is open (hearing it would answer the
 *   round), so the flow's autoplay, replay-after-a-miss and speaker taps play nothing here.
 * - **The right tile** fills the gap; the completed sentence is said once (`say`) and the next round opens after
 *   the shell's pause. After it, Hear it replays the sentence as often as the learner likes.
 * - **A tile that does not fit** locks in the amber nudge; the gap stays empty. The first answer of a round is the
 *   scored one (the host keeps later ones as retries); the second miss rings the tile that fits (`hint`).
 * - Only the first touch in a 50 ms window counts (the Listen & Pick rule).
 */

export type ClozeFlowState = ListenPickFlowState;

export type ClozeEvent =
  | { type: 'tap'; optionId: string; answerId: string; at: number }
  /** Hear it, after the right tile. */
  | { type: 'hear' }
  | { type: 'advance' };

export type ClozeEffect =
  | { type: 'answer'; roundKey: number; correct: boolean }
  | { type: 'haptic'; kind: 'success' | 'nudge' }
  /** Say the completed sentence of the current round. */
  | { type: 'say' }
  | { type: 'schedule-advance'; ms: number }
  | { type: 'complete' };

export interface ClozeStep {
  state: ClozeFlowState;
  effects: ClozeEffect[];
}

/** Round 1, asking (or `empty` with no playable round). `hint` starts the ring on (a scaffold round). */
export function startCloze(total: number, hint = false): ClozeFlowState {
  return { ...startFlow(total), hint };
}

/** The Listen & Pick effects Cloze Pick keeps: no sound but the one after the right tile. */
function keep(effect: ListenEffect): ClozeEffect[] {
  switch (effect.type) {
    case 'play':
      return effect.why === 'confirm' ? [{ type: 'say' }] : [];
    case 'cancel-replay':
    case 'schedule-replay':
      return [];
    default:
      return [effect];
  }
}

/** One event in: the next state and the effects the screen runs. */
export function stepCloze(state: ClozeFlowState, event: ClozeEvent): ClozeStep {
  if (event.type === 'hear') {
    const resolved = state.status === 'resolved' || state.status === 'done';
    return { state, effects: resolved ? [{ type: 'say' }] : [] };
  }
  const out = stepFlow(state, event);
  return { state: out.state, effects: out.effects.flatMap(keep) };
}

/** The pause between the right tile and the next round (the shell's, as Listen & Pick). */
export const CLOZE_ADVANCE_MS = LISTEN_PICK_TIMING.advanceDelayMs;
