import { checkpointRoundKey } from '../round-keys';

/**
 * Pure state machine behind the story reader (F-STORY-002 §3.2-3.7). It never
 * touches a store, the audio or the clock: `reduceReader` returns the next
 * state and a list of effects, and the screen applies them (bookmark, autoplay,
 * announcement, `answerRound`, telemetry). Nothing advances by itself; the
 * learner always taps (D3).
 *
 * Beyond the fields the spec names, the state carries the immutable inputs of
 * `initReader` (`sceneCount`, `checkpoints`) so `reduceReader(state, action)`
 * needs no third argument, and `resolved`, the checkpoint ids already answered
 * or skipped, so Back-then-Next never asks the same question twice.
 */

export type ReaderPhase = 'scene' | 'checkpoint' | 'end';

export interface ReaderState {
  /** The scene shown (on the end page, the last scene). */
  index: number;
  /** The fill-only meter: it never drops on Back. */
  furthest: number;
  phase: ReaderPhase;
  /** The open checkpoint while `phase === 'checkpoint'`, else null. */
  checkpointId: string | null;
  /** The inline term whose gloss card is open. */
  openTerm: string | null;
  /** Ids whose romanization was revealed by a tap (hide-until-tap mode), for this scene. */
  revealed: string[];
  sceneCount: number;
  /** `checkpointId` of each scene, by scene index; null = none. */
  checkpoints: ReadonlyArray<string | null>;
  resolved: string[];
}

export type ReaderAction =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'goTo'; index: number }
  | { type: 'restart' }
  | { type: 'tapTerm'; id: string }
  | { type: 'closeTerm' }
  | { type: 'reveal'; id: string }
  | { type: 'resolveCheckpoint'; correct: boolean }
  | { type: 'skipCheckpoint' };

/** What caused a scene to show: autoplay runs for `open`, `next`, `goTo` and `restart`, never for `back`. */
export type SceneChangeVia = 'open' | 'next' | 'back' | 'goTo' | 'restart';

export type ReaderEffect =
  /** Bookmark + autoplay + announcement. */
  | { type: 'scene-changed'; index: number; via: SceneChangeVia }
  | { type: 'answer'; roundKey: string; correct: boolean }
  | { type: 'finish-reading' };

export interface ReaderStep {
  state: ReaderState;
  effects: ReaderEffect[];
}

function whole(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.floor(value) : fallback;
}

function clamp(index: number, count: number): number {
  return Math.min(Math.max(whole(index, 0), 0), count - 1);
}

/**
 * @param checkpoints the `checkpointId` of each scene by scene index (a missing,
 *   undefined or null entry means the scene has none)
 */
export function initReader(
  sceneCount: number,
  startIndex: number,
  checkpoints: ReadonlyArray<string | null | undefined>,
): ReaderState {
  const count = Math.max(1, whole(sceneCount, 1));
  const index = clamp(startIndex, count);
  return {
    index,
    furthest: index,
    phase: 'scene',
    checkpointId: null,
    openTerm: null,
    revealed: [],
    sceneCount: count,
    checkpoints: Array.from({ length: count }, (_, i) => checkpoints[i] ?? null),
    resolved: [],
  };
}

/** The effect of opening the reader: it announces the scene it opened on. */
export function openEffects(state: ReaderState): ReaderEffect[] {
  return [{ type: 'scene-changed', index: state.index, via: 'open' }];
}

const NO_CHANGE = (state: ReaderState): ReaderStep => ({ state, effects: [] });

function showScene(state: ReaderState, index: number, via: SceneChangeVia): ReaderStep {
  return {
    state: {
      ...state,
      index,
      furthest: Math.max(state.furthest, index),
      phase: 'scene',
      checkpointId: null,
      openTerm: null,
      revealed: [],
    },
    effects: [{ type: 'scene-changed', index, via }],
  };
}

/** Leaves the current scene or checkpoint forwards: the next scene, or the end page. */
function advance(state: ReaderState, resolved: string[]): { state: ReaderState; change: ReaderEffect | null; finished: boolean } {
  const base: ReaderState = { ...state, resolved };
  if (state.index >= state.sceneCount - 1) {
    return {
      state: { ...base, phase: 'end', checkpointId: null, openTerm: null },
      change: null,
      finished: true,
    };
  }
  const moved = showScene(base, state.index + 1, 'next');
  return { state: moved.state, change: moved.effects[0] ?? null, finished: false };
}

function next(state: ReaderState): ReaderStep {
  if (state.phase !== 'scene') return NO_CHANGE(state);
  const checkpointId = state.checkpoints[state.index] ?? null;
  if (checkpointId !== null && !state.resolved.includes(checkpointId)) {
    return { state: { ...state, phase: 'checkpoint', checkpointId, openTerm: null }, effects: [] };
  }
  const step = advance(state, state.resolved);
  return { state: step.state, effects: step.finished ? [{ type: 'finish-reading' }] : step.change ? [step.change] : [] };
}

function back(state: ReaderState): ReaderStep {
  if (state.phase === 'checkpoint') {
    return { state: { ...state, phase: 'scene', checkpointId: null }, effects: [] };
  }
  if (state.phase === 'end') return showScene(state, state.sceneCount - 1, 'back');
  if (state.index === 0) return NO_CHANGE(state);
  return showScene(state, state.index - 1, 'back');
}

function goTo(state: ReaderState, requested: number): ReaderStep {
  if (!Number.isFinite(requested)) return NO_CHANGE(state);
  const index = clamp(requested, state.sceneCount);
  if (index === state.index && state.phase === 'scene') return NO_CHANGE(state);
  return showScene(state, index, 'goTo');
}

function restart(state: ReaderState): ReaderStep {
  // The dots keep what was filled: a meter never drops (D3). A fresh read asks its checkpoints again.
  return showScene({ ...state, resolved: [] }, 0, 'restart');
}

/** Finishes the open checkpoint: `scene-changed` (or `finish-reading`) with the `answer` between them. */
function leaveCheckpoint(state: ReaderState, answer: ReaderEffect | null): ReaderStep {
  const id = state.checkpointId;
  const resolved = id !== null && !state.resolved.includes(id) ? [...state.resolved, id] : state.resolved;
  const step = advance(state, resolved);
  const effects: ReaderEffect[] = [];
  if (step.change) effects.push(step.change);
  if (answer) effects.push(answer);
  if (step.finished) effects.push({ type: 'finish-reading' });
  return { state: step.state, effects };
}

function resolveCheckpoint(state: ReaderState, correct: boolean): ReaderStep {
  if (state.phase !== 'checkpoint' || state.checkpointId === null) return NO_CHANGE(state);
  const answer: ReaderEffect = { type: 'answer', roundKey: checkpointRoundKey(state.checkpointId), correct };
  // A miss is reported (the run store keeps only the first answer) and the card stays for another try.
  if (!correct) return { state, effects: [answer] };
  return leaveCheckpoint(state, answer);
}

export function reduceReader(state: ReaderState, action: ReaderAction): ReaderStep {
  switch (action.type) {
    case 'next':
      return next(state);
    case 'back':
      return back(state);
    case 'goTo':
      return goTo(state, action.index);
    case 'restart':
      return restart(state);
    case 'tapTerm':
      if (state.phase !== 'scene') return NO_CHANGE(state);
      return { state: { ...state, openTerm: state.openTerm === action.id ? null : action.id }, effects: [] };
    case 'closeTerm':
      return state.openTerm === null ? NO_CHANGE(state) : { state: { ...state, openTerm: null }, effects: [] };
    case 'reveal':
      if (state.phase === 'end' || state.revealed.includes(action.id)) return NO_CHANGE(state);
      return { state: { ...state, revealed: [...state.revealed, action.id] }, effects: [] };
    case 'resolveCheckpoint':
      return resolveCheckpoint(state, action.correct);
    case 'skipCheckpoint':
      return state.phase === 'checkpoint' ? leaveCheckpoint(state, null) : NO_CHANGE(state);
  }
}
