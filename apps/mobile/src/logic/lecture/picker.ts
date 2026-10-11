import type { PickerMode } from '@hangul-route/content-schema';

/**
 * Helper picker (F-TCH-004 §3.5, TD5): a turn-taking tool, never a score.
 * A shuffled bag drawn without replacement; `undo` returns the last label to
 * the bag, `skip` returns it and draws another (no reason is ever given),
 * `reset` starts a new bag. The randomness is injected so the module is pure.
 *
 * The state holds the labels and the bag only: no per-learner count, history,
 * ranking or score is ever kept, and nothing here is stored or sent. Labels
 * come from the in-memory roster (`picker-labels.ts`); with none, the picker
 * runs in numbers (1..count).
 */

export type Rng = () => number;

export interface PickerState {
  /** The mode actually in use (names / initials degrade to numbers without labels). */
  mode: PickerMode;
  /** Everyone in this picker, for `reset`. */
  pool: readonly string[];
  /** Labels that have not had a turn yet, in draw order. */
  bag: readonly string[];
  /** The label on screen, if any. */
  current: string | null;
  /** `empty`: "Everyone has had a turn". */
  phase: 'ready' | 'drawn' | 'empty';
}

export type PickerEvent = 'draw' | 'undo' | 'skip' | 'reset';

export interface PickerInput {
  mode: PickerMode;
  /** Numbers mode draws 1..count (clamped to 0..60). */
  count: number;
  /** Names or initials held in memory for this deck; absent or empty = numbers. */
  labels?: readonly string[] | null;
}

const MAX_COUNT = 60;

function index(rng: Rng, length: number): number {
  return Math.min(length - 1, Math.max(0, Math.floor(rng() * length)));
}

function shuffle(items: readonly string[], rng: Rng): string[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = index(rng, i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function insertAtRandom(bag: readonly string[], label: string, rng: Rng): string[] {
  const out = [...bag];
  out.splice(index(rng, out.length + 1), 0, label);
  return out;
}

export function createPicker(input: PickerInput, rng: Rng): PickerState {
  const useLabels = input.mode !== 'numbers' && input.labels != null && input.labels.length > 0;
  const count = Math.min(MAX_COUNT, Math.max(0, Math.trunc(input.count)));
  const pool = useLabels ? [...input.labels!] : Array.from({ length: count }, (_, i) => String(i + 1));
  return { mode: useLabels ? input.mode : 'numbers', pool, bag: shuffle(pool, rng), current: null, phase: 'ready' };
}

export function reducePicker(state: PickerState, event: PickerEvent, rng: Rng): PickerState {
  switch (event) {
    case 'draw': {
      if (state.bag.length === 0) {
        return state.phase === 'empty' ? state : { ...state, current: null, phase: 'empty' };
      }
      const [next, ...rest] = state.bag;
      return { ...state, bag: rest, current: next!, phase: 'drawn' };
    }
    case 'undo':
      if (state.current === null) return state;
      return { ...state, bag: insertAtRandom(state.bag, state.current, rng), current: null, phase: 'ready' };
    case 'skip': {
      if (state.current === null || state.bag.length === 0) return state;
      const [next, ...rest] = state.bag;
      return { ...state, bag: insertAtRandom(rest, state.current, rng), current: next!, phase: 'drawn' };
    }
    case 'reset':
      return { ...state, bag: shuffle(state.pool, rng), current: null, phase: 'ready' };
  }
}
