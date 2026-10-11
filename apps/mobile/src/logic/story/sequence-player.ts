import { sequenceRoundKey } from '../round-keys';
import { derangeSeeded } from './seeded-order';

/**
 * Pure state machine behind Story Order v2 (F-STORY-003 §3.3, §3.5). The cards
 * are shown in a derangement of the correct order; the learner taps the card
 * that comes next. Wrong taps score the slot as a miss and move nothing. When
 * every slot is filled the story replay starts (it records nothing).
 */

/** Wrong taps on one slot before the right card gets a highlight ring. */
export const HIGHLIGHT_SLOT_AFTER_WRONG = 2;

export type SequencePhase = 'ordering' | 'replay' | 'done';

export interface SequenceState {
  /** The correct order of card ids. */
  solution: string[];
  /** Display order of all cards at the start: never sorted, no card in its place. */
  order: string[];
  /** Card ids placed so far, in slot order. */
  placed: string[];
  phase: SequencePhase;
  /** Wrong taps per slot. */
  wrongBySlot: number[];
  /** Replay position (an index into `solution`). */
  replayIndex: number;
  paused: boolean;
  /** True once the last replay card has been shown. */
  replayed: boolean;
}

export type SequenceAction =
  | { type: 'tap'; cardId: string }
  | { type: 'skipReplay' }
  | { type: 'replayNext' }
  | { type: 'replayBack' }
  | { type: 'togglePause' }
  | { type: 'finish' };

export type SequenceEffect =
  /** Report every tap; the run store keeps only the first answer per slot key. */
  | { type: 'answer'; roundKey: number; correct: boolean }
  | { type: 'highlight'; cardId: string }
  | { type: 'finish' };

export interface SequenceStep {
  state: SequenceState;
  effects: SequenceEffect[];
}

/** @param cards the cards in their CORRECT order. */
export function initSequenceState(cards: ReadonlyArray<{ id: string }>, seed: number): SequenceState {
  const solution = cards.map((c) => c.id);
  return {
    solution,
    order: derangeSeeded(solution, seed),
    placed: [],
    phase: solution.length === 0 ? 'done' : 'ordering',
    wrongBySlot: solution.map(() => 0),
    replayIndex: 0,
    paused: false,
    replayed: false,
  };
}

/** Card ids still to place, in display order. */
export function remainingCards(state: SequenceState): string[] {
  return state.order.filter((id) => !state.placed.includes(id));
}

const NO_CHANGE = (state: SequenceState): SequenceStep => ({ state, effects: [] });

function tap(state: SequenceState, cardId: string): SequenceStep {
  if (state.phase !== 'ordering' || !remainingCards(state).includes(cardId)) return NO_CHANGE(state);
  const slot = state.placed.length;
  const roundKey = sequenceRoundKey(slot);
  const expected = state.solution[slot] as string;

  if (cardId === expected) {
    const placed = [...state.placed, cardId];
    const full = placed.length === state.solution.length;
    return {
      state: {
        ...state,
        placed,
        phase: full ? 'replay' : 'ordering',
        replayIndex: 0,
        replayed: full && state.solution.length <= 1,
      },
      effects: [{ type: 'answer', roundKey, correct: true }],
    };
  }

  const wrongBySlot = state.wrongBySlot.map((n, i) => (i === slot ? n + 1 : n));
  const effects: SequenceEffect[] = [{ type: 'answer', roundKey, correct: false }];
  if (wrongBySlot[slot] === HIGHLIGHT_SLOT_AFTER_WRONG) effects.push({ type: 'highlight', cardId: expected });
  return { state: { ...state, wrongBySlot }, effects };
}

function replayTo(state: SequenceState, index: number): SequenceStep {
  const last = state.solution.length - 1;
  const replayIndex = Math.min(Math.max(index, 0), last);
  return { state: { ...state, replayIndex, replayed: state.replayed || replayIndex === last }, effects: [] };
}

export function reduceSequence(state: SequenceState, action: SequenceAction): SequenceStep {
  if (action.type === 'tap') return tap(state, action.cardId);
  if (state.phase !== 'replay') return NO_CHANGE(state);
  switch (action.type) {
    case 'replayNext':
      return replayTo(state, state.replayIndex + 1);
    case 'replayBack':
      return replayTo(state, state.replayIndex - 1);
    case 'togglePause':
      return { state: { ...state, paused: !state.paused }, effects: [] };
    case 'skipReplay':
    case 'finish':
      return { state: { ...state, phase: 'done' }, effects: [{ type: 'finish' }] };
  }
}
