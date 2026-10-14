import type { TraceWordMode } from './rounds';

/**
 * Trace a Word round flow (wireframe minigame/trace-word.md, "Interaction points"): a word is
 * traced block after block (or, in letter mode, letter after letter inside each block). A unit
 * that does not pass stays current and is drawn again; a passed one stays passed. The round is
 * right first time when every evaluation in it passed; the screen answers once per round, when
 * the word is done (`answerOf`). Retries never change stars. Pure reducer.
 */

/** What the screen needs to know of each round: its mode and how many letters each block has. */
export interface TraceWordRoundShape {
  mode: TraceWordMode;
  letterCounts: readonly number[];
}

/**
 * `drawing`: the current unit is live. `letterDone`: a letter passed, the next letter of the
 * block follows (letter mode). `blockDone`: a block passed, the next block follows.
 * `wordDone`: the word is whole (the strip shows it). `retry`: the unit did not pass and is
 * cleared after the pause. `finished`: every round is done.
 */
export type TraceWordPhase = 'drawing' | 'letterDone' | 'blockDone' | 'wordDone' | 'retry' | 'finished';

export interface TraceWordState {
  round: number;
  block: number;
  /** The live letter of the block (letter mode); 0 in block mode. */
  letter: number;
  phase: TraceWordPhase;
  /** Every evaluation of this round passed on its first try so far. */
  firstTry: boolean;
}

export type TraceWordAction = { type: 'evaluated'; passed: boolean } | { type: 'continue' };

export const initialTraceWordState = (rounds: readonly TraceWordRoundShape[]): TraceWordState => ({
  round: 0,
  block: 0,
  letter: 0,
  phase: rounds.length === 0 ? 'finished' : 'drawing',
  firstTry: true,
});

export function traceWordReducer(
  state: TraceWordState,
  action: TraceWordAction,
  rounds: readonly TraceWordRoundShape[],
): TraceWordState {
  const shape = rounds[state.round];
  if (!shape) return state;
  if (action.type === 'evaluated') {
    if (state.phase !== 'drawing') return state;
    if (!action.passed) return { ...state, phase: 'retry', firstTry: false };
    const letters = shape.letterCounts[state.block] ?? 1;
    const lastLetter = shape.mode === 'block' || state.letter >= letters - 1;
    if (!lastLetter) return { ...state, phase: 'letterDone' };
    return { ...state, phase: state.block >= shape.letterCounts.length - 1 ? 'wordDone' : 'blockDone' };
  }
  switch (state.phase) {
    case 'retry':
      return { ...state, phase: 'drawing' };
    case 'letterDone':
      return { ...state, letter: state.letter + 1, phase: 'drawing' };
    case 'blockDone':
      return { ...state, block: state.block + 1, letter: 0, phase: 'drawing' };
    case 'wordDone':
      return state.round >= rounds.length - 1
        ? { ...state, phase: 'finished' }
        : { round: state.round + 1, block: 0, letter: 0, phase: 'drawing', firstTry: true };
    default:
      return state;
  }
}

/** The round's one answer, on the step into `wordDone`: right when every evaluation passed first time. */
export function answerOf(prev: TraceWordState, next: TraceWordState): { round: number; correct: boolean } | null {
  if (next.phase !== 'wordDone' || prev.phase === 'wordDone') return null;
  return { round: next.round, correct: next.firstTry };
}

/** Blocks of the current round already passed (their chips show the check). */
export function blocksPassed(state: TraceWordState): number {
  return state.phase === 'blockDone' || state.phase === 'wordDone' ? state.block + 1 : state.block;
}

/** Letters of the current block already passed (letter mode's part marks). */
export function lettersPassed(state: TraceWordState, letterCount: number): number {
  if (state.phase === 'blockDone' || state.phase === 'wordDone') return letterCount;
  return state.phase === 'letterDone' ? state.letter + 1 : state.letter;
}
