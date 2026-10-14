import type { SbRound } from './progression';
import { FRESH_SCORE, isRightTile, scoreComplete, scoreMiss, type RoundScore } from './scoring';

/**
 * Sentence Builder flow (F-CURR-001 §3.4, §3.7, §3.15 behaviour 3; wireframe
 * minigame/sentence-builder.md): the reducer behind `SentenceBuilderGame`. Pure, so the
 * screen renders what this returns and runs the effects it asks for.
 *
 * Each tap is answered at once (no Done button): a right tile joins the line and stays; a
 * wrong tile slides to the slot and back, is marked "tried" and stays tappable; the second
 * miss on one slot rings the right tile. Taps wait while a tile slides back, and only the
 * first touch in a 50 ms window counts. A built sentence is heard once, then the next round
 * opens (`advance`); the last round completes the step.
 */

/** Touches inside this window after an accepted one are dropped (F-001 §3.4, as Listen & Pick). */
export const TOUCH_WINDOW_MS = 50;

/** Why the last miss happened, for Hoya's line (`view.ts`). */
export type SbHint = 'miss' | 'lastWord' | 'particle' | 'lookHere';

export interface SbState {
  /** `empty`: no playable round. `complete`: the sentence is built, waiting to advance. `done`: after the last round. */
  status: 'empty' | 'building' | 'complete' | 'done';
  roundIdx: number;
  total: number;
  /** Tile ids placed, in the order of the round's open slots. */
  placed: readonly string[];
  /** Tiles tried for the current slot (amber mark); cleared when a slot is filled. */
  tried: readonly string[];
  /** Misses on the current slot; two ring the right tile. */
  slotMisses: number;
  /** The tile sliding back after a miss; taps wait until it settles. */
  returning: string | null;
  hint: SbHint | null;
  score: RoundScore;
  lastTapAt: number | null;
}

export type SbEvent =
  | { type: 'tap'; tileId: string; at: number }
  /** The wrong tile is back in the tray. */
  | { type: 'settle' }
  /** The built sentence has been heard (or the no-sound wait is over). */
  | { type: 'advance' };

export type SbEffect =
  | { type: 'answer'; roundKey: number; correct: boolean }
  | { type: 'haptic'; kind: 'light' | 'nudge' | 'success' }
  /** The wrong tile slides to the slot and back (the screen times it on the motion tokens), then `settle`. */
  | { type: 'schedule-settle' }
  /** Play the built sentence once, then dispatch `advance`. */
  | { type: 'play-sentence' }
  | { type: 'complete' };

export interface SbStep {
  state: SbState;
  effects: SbEffect[];
}

const freshRound = { placed: [], tried: [], slotMisses: 0, returning: null, hint: null, score: FRESH_SCORE, lastTapAt: null } as const;

/** A fresh flow on round 1. */
export function startFlow(total: number): SbState {
  return { status: total < 1 ? 'empty' : 'building', roundIdx: 0, total: Math.max(0, total), ...freshRound };
}

const unchanged = (state: SbState): SbStep => ({ state, effects: [] });

/** The hint a miss earns: the ring after two on one slot, else why this tile does not go here yet. */
export function missHint(round: SbRound, filled: number, tileId: string, slotMisses: number): SbHint {
  if (slotMisses >= 2) return 'lookHere';
  if (round.particle) return 'particle';
  const last = round.words.length - 1;
  const tile = round.tray.find((t) => t.id === tileId);
  const isLastWord = tile !== undefined && tile.id.startsWith('w') && tile.ko === round.words[last]?.ko;
  return isLastWord && round.open[filled] !== last ? 'lastWord' : 'miss';
}

function tapStep(state: SbState, round: SbRound, event: Extract<SbEvent, { type: 'tap' }>): SbStep {
  if (state.status !== 'building' || state.returning !== null || state.placed.includes(event.tileId)) return unchanged(state);
  if (state.lastTapAt !== null && event.at - state.lastTapAt < TOUCH_WINDOW_MS) return unchanged(state);
  const tile = round.tray.find((t) => t.id === event.tileId);
  if (!tile) return unchanged(state);

  const filled = state.placed.length;
  if (isRightTile(round, filled, tile)) {
    const placed = [...state.placed, tile.id];
    const next: SbState = { ...state, placed, tried: [], slotMisses: 0, hint: null, lastTapAt: event.at };
    if (placed.length < round.open.length) return { state: next, effects: [{ type: 'haptic', kind: 'light' }] };
    const { score, record } = scoreComplete(state.score);
    return {
      state: { ...next, status: 'complete', score },
      effects: [
        ...(record === null ? [] : [{ type: 'answer', roundKey: state.roundIdx, correct: record } as const]),
        { type: 'haptic', kind: 'success' },
        { type: 'play-sentence' },
      ],
    };
  }

  const slotMisses = state.slotMisses + 1;
  const { score, record } = scoreMiss(state.score);
  return {
    state: {
      ...state,
      tried: state.tried.includes(tile.id) ? state.tried : [...state.tried, tile.id],
      slotMisses,
      returning: tile.id,
      hint: missHint(round, filled, tile.id, slotMisses),
      score,
      lastTapAt: event.at,
    },
    effects: [
      ...(record === null ? [] : [{ type: 'answer', roundKey: state.roundIdx, correct: record } as const]),
      { type: 'haptic', kind: 'nudge' },
      { type: 'schedule-settle' },
    ],
  };
}

function advanceStep(state: SbState): SbStep {
  if (state.status !== 'complete') return unchanged(state);
  if (state.roundIdx >= state.total - 1) return { state: { ...state, status: 'done' }, effects: [{ type: 'complete' }] };
  return { state: { ...state, status: 'building', roundIdx: state.roundIdx + 1, ...freshRound }, effects: [] };
}

/** One event in, the next state and the effects the screen must run out. `rounds` are the game's playable rounds. */
export function stepFlow(state: SbState, rounds: readonly SbRound[], event: SbEvent): SbStep {
  if (state.status === 'empty' || state.status === 'done') return unchanged(state);
  switch (event.type) {
    case 'tap': {
      const round = rounds[state.roundIdx];
      return round ? tapStep(state, round, event) : unchanged(state);
    }
    case 'settle':
      return state.returning === null ? unchanged(state) : { state: { ...state, returning: null }, effects: [] };
    case 'advance':
      return advanceStep(state);
  }
}
