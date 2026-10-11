import { checkRoundKey } from '../round-keys';
import type { CheckView } from './check-view';

/**
 * Pure state machine behind the story-check screen (F-STORY-003 §3.3-3.4).
 * It never touches a store: it returns effects and the screen applies them
 * (`answerRound`, haptics, telemetry). Nothing advances by itself; the learner
 * taps Next after each explanation.
 */

/** Wrong taps on one item before the correct option gets a highlight ring. */
export const HIGHLIGHT_AFTER_WRONG = 2;

export type CheckPhase = 'answering' | 'explained' | 'recap' | 'done';

export interface CheckState {
  /** Index of the current item. */
  index: number;
  phase: CheckPhase;
  /** Option ids already tapped wrong on the current item (locked). */
  wrong: string[];
  /** Taps on the current item, wrong and right. */
  taps: number;
}

export interface CheckPlayerView {
  items: readonly CheckView[];
  /** True when `recapWords` is non-empty, so the step ends with the word recap. */
  hasRecap: boolean;
}

export type CheckAction =
  | { type: 'choose'; optionId: string }
  | { type: 'next' }
  | { type: 'finishRecap' };

export type CheckEffect =
  /** Report every tap; the run store keeps only the first answer per key. */
  | { type: 'answer'; roundKey: string; correct: boolean }
  /** The item was answered right (after any number of wrong taps). */
  | { type: 'resolved'; checkId: string; firstTry: boolean; taps: number }
  | { type: 'highlight'; optionId: string }
  | { type: 'finish' };

export interface CheckStep {
  state: CheckState;
  effects: CheckEffect[];
}

export function initCheckState(view: CheckPlayerView): CheckState {
  return { index: 0, phase: view.items.length === 0 ? 'done' : 'answering', wrong: [], taps: 0 };
}

const NO_CHANGE = (state: CheckState): CheckStep => ({ state, effects: [] });

function choose(state: CheckState, optionId: string, view: CheckPlayerView): CheckStep {
  const item = view.items[state.index];
  if (state.phase !== 'answering' || !item) return NO_CHANGE(state);
  const option = item.options.find((o) => o.id === optionId);
  if (!option || state.wrong.includes(optionId)) return NO_CHANGE(state);

  const roundKey = checkRoundKey(item.checkId);
  const taps = state.taps + 1;
  if (option.isCorrect) {
    return {
      state: { ...state, phase: 'explained', taps },
      effects: [
        { type: 'answer', roundKey, correct: true },
        { type: 'resolved', checkId: item.checkId, firstTry: state.wrong.length === 0, taps },
      ],
    };
  }
  const wrong = [...state.wrong, optionId];
  const effects: CheckEffect[] = [{ type: 'answer', roundKey, correct: false }];
  if (wrong.length === HIGHLIGHT_AFTER_WRONG) {
    effects.push({ type: 'highlight', optionId: item.correctOptionId });
  }
  return { state: { ...state, wrong, taps }, effects };
}

function next(state: CheckState, view: CheckPlayerView): CheckStep {
  if (state.phase !== 'explained') return NO_CHANGE(state);
  if (state.index + 1 < view.items.length) {
    return { state: { index: state.index + 1, phase: 'answering', wrong: [], taps: 0 }, effects: [] };
  }
  if (view.hasRecap) return { state: { ...state, phase: 'recap' }, effects: [] };
  return { state: { ...state, phase: 'done' }, effects: [{ type: 'finish' }] };
}

export function reduceCheck(state: CheckState, action: CheckAction, view: CheckPlayerView): CheckStep {
  switch (action.type) {
    case 'choose':
      return choose(state, action.optionId, view);
    case 'next':
      return next(state, view);
    case 'finishRecap':
      return state.phase === 'recap'
        ? { state: { ...state, phase: 'done' }, effects: [{ type: 'finish' }] }
        : NO_CHANGE(state);
  }
}
