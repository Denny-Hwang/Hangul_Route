import { composeTyped } from '@hangul-route/content-schema';
import { scoreTyped, type TypedScore } from './score';

/**
 * Type Hangul round flow (F-CURR-001 §3.7 item 2; design/wireframes/minigame/type-hangul.md):
 * a pure reducer that returns the effects the renderer runs. The typed keys live only in this
 * state, which the renderer keeps in React state: never in a store, a log line or telemetry
 * (test P-1). A round scores on its first Done only; later Dones are retries.
 */

/** The pause before a passed round moves on: the Trace pass pause. */
export const PASS_PAUSE_MS = 1100;
/** The field holds at most this many characters (a target is at most 12). */
export const MAX_TYPED = 24;

export type TypeHangulPhase = 'typing' | 'pass' | 'miss';

export interface TypeHangulState {
  /** The targets' Korean, in round order. */
  targets: readonly string[];
  total: number;
  roundIdx: number;
  /** The keys typed this round: jamo and `' '`. The text is `composeTyped(keys)`. */
  keys: readonly string[];
  phase: TypeHangulPhase;
  /** The last Done's check; null while typing a fresh round. */
  score: TypedScore | null;
  /** The first Done of this round has been reported. */
  answered: boolean;
  /** Dones after the first one, this round. */
  retries: number;
  /** The last edit, for the field's live line (Del reads the whole text). */
  lastEdit: 'key' | 'space' | 'delete' | null;
  /** Every round passed (or there were none). */
  done: boolean;
}

export type TypeHangulEvent =
  | { type: 'key'; jamo: string }
  | { type: 'space' }
  | { type: 'delete' }
  | { type: 'done' }
  | { type: 'fix' }
  | { type: 'advance' }
  /** Skip: leave the game now, without recording the remaining rounds (shell rule for construction games). */
  | { type: 'skip' };

export type TypeHangulEffect =
  | { type: 'answer'; roundIdx: number; correct: boolean }
  | { type: 'haptic'; kind: 'success' | 'nudge' }
  | { type: 'schedule-advance'; ms: number }
  | { type: 'complete' };

export interface TypeHangulStep {
  state: TypeHangulState;
  effects: TypeHangulEffect[];
}

const freshRound = (s: TypeHangulState, roundIdx: number): TypeHangulState => ({
  ...s,
  roundIdx,
  keys: [],
  phase: 'typing',
  score: null,
  answered: false,
  retries: 0,
  lastEdit: null,
});

export function startFlow(targets: readonly string[]): TypeHangulState {
  return {
    targets,
    total: targets.length,
    roundIdx: 0,
    keys: [],
    phase: 'typing',
    score: null,
    answered: false,
    retries: 0,
    lastEdit: null,
    done: targets.length === 0,
  };
}

/** What the answer field draws and reads. */
export interface FieldView {
  text: string;
  /** The text without the block still being built. */
  settled: string;
  /** The block being built (underlined), or null after a space or with nothing typed. */
  open: string | null;
  /** What the polite live region reads: finished blocks while typing, the whole text after Del. */
  live: string;
  empty: boolean;
}

/** Reads only the keys and the last edit, so Write Frame's field draws the same way (G-5). */
export function fieldView(s: Pick<TypeHangulState, 'keys' | 'lastEdit'>): FieldView {
  const text = composeTyped(s.keys);
  const last = s.keys[s.keys.length - 1];
  const open = last === undefined || last === ' ' ? null : text.slice(-1);
  const settled = open === null ? text : text.slice(0, -1);
  return { text, settled, open, live: s.lastEdit === 'delete' ? text : settled, empty: text.trim() === '' };
}

const unchanged = (state: TypeHangulState): TypeHangulStep => ({ state, effects: [] });

export function stepFlow(s: TypeHangulState, e: TypeHangulEvent): TypeHangulStep {
  switch (e.type) {
    case 'key': {
      if (s.phase !== 'typing') return unchanged(s);
      const keys = [...s.keys, e.jamo];
      if (composeTyped(keys).length > MAX_TYPED) return unchanged(s);
      return unchanged({ ...s, keys, lastEdit: 'key' });
    }
    case 'space': {
      const last = s.keys[s.keys.length - 1];
      if (s.phase !== 'typing' || last === undefined || last === ' ') return unchanged(s);
      return unchanged({ ...s, keys: [...s.keys, ' '], lastEdit: 'space' });
    }
    case 'delete':
      if (s.phase !== 'typing' || s.keys.length === 0) return unchanged(s);
      return unchanged({ ...s, keys: s.keys.slice(0, -1), lastEdit: 'delete' });
    case 'done': {
      const text = composeTyped(s.keys);
      if (s.phase !== 'typing' || s.done || text.trim() === '') return unchanged(s);
      const score = scoreTyped(text, s.targets[s.roundIdx] as string);
      const correct = score.verdict === 'match';
      const effects: TypeHangulEffect[] = s.answered ? [] : [{ type: 'answer', roundIdx: s.roundIdx, correct }];
      effects.push({ type: 'haptic', kind: correct ? 'success' : 'nudge' });
      if (correct) effects.push({ type: 'schedule-advance', ms: PASS_PAUSE_MS });
      return {
        state: { ...s, score, phase: correct ? 'pass' : 'miss', answered: true, retries: s.answered ? s.retries + 1 : s.retries },
        effects,
      };
    }
    case 'fix':
      return s.phase === 'miss' ? unchanged({ ...s, phase: 'typing', lastEdit: null }) : unchanged(s);
    case 'skip':
      // Once only: a second Skip, or the pass pause's advance after a Skip, completes nothing more.
      return s.done ? unchanged(s) : { state: { ...s, done: true }, effects: [{ type: 'complete' }] };
    case 'advance':
      if (s.phase !== 'pass' || s.done) return unchanged(s);
      if (s.roundIdx >= s.total - 1) return { state: { ...s, done: true }, effects: [{ type: 'complete' }] };
      return unchanged(freshRound(s, s.roundIdx + 1));
  }
}
