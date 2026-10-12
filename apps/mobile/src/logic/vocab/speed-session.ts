import type { VocabFormat, VocabQuestion } from './question-builder';
import type { SpeedMode } from './session-clock';

/**
 * The Speed Round session reducer (F-VOC-004 §3.4). Pure: every rule of the
 * round lives here, none in the screen.
 *
 * - One session clock, Challenge only, counted from the first question's
 *   appearance; it does not run during a reveal or a pause, so reading the
 *   answer is free and a miss costs no time (S2).
 * - Time never marks anything wrong: when the clock reaches zero the round
 *   ends and the question on screen is dropped, not recorded.
 * - `sparks` only goes up: it grows by one for each right answer (a hinted
 *   one too) and no event lowers it (S3).
 * - The first tap of a question decides; a second tap during the reveal is
 *   ignored (S5).
 * - A paused round never expires; a pause during a reveal waits for the
 *   reveal to finish. Relaxed has no clock, so it never pauses.
 * - `done` is absorbing: every event but `quit` returns the same state.
 */

export interface SessionConfig {
  mode: SpeedMode;
  /** Built up front; Challenge builds 40 and stops at the clock. */
  questions: VocabQuestion[];
  /** `null` in Relaxed; `60000 * clockScale` in Challenge (`clockFor`). */
  clockMs: number | null;
  /** Relaxed only, and false when a screen reader is on (§3.6). */
  hintsEnabled: boolean;
}

export interface QuestionResult {
  itemId: string;
  format: VocabFormat;
  correct: boolean;
  hinted: boolean;
  /** Active time to the first tap. */
  ms: number;
}

export type SpeedPhase = 'ready' | 'question' | 'reveal' | 'paused' | 'done';
export type PauseReason = 'user' | 'background';
export type EndedBy = 'questions' | 'clock' | 'quit';

export interface SpeedState {
  phase: SpeedPhase;
  /** What `paused` returns to. */
  resumePhase?: 'question';
  /** The current question. */
  index: number;
  /** Only ever increases (S3). */
  sparks: number;
  /** One per answered question, in order. */
  results: QuestionResult[];
  /** The first tap of the current question. */
  chosenId: string | null;
  hint: 'none' | 'soft' | 'ring';
  /** Active time on the current question. */
  elapsedMs: number;
  /** The Challenge clock; `null` in Relaxed. */
  remainingMs: number | null;
  totalActiveMs: number;
  pauses: number;
  /** Informational: the paused wall time the caller's clock reported. */
  pausedMs: number;
  /** A pause asked for during a reveal; it takes effect at `reveal-done`. */
  pendingPause: PauseReason | null;
  endedBy: EndedBy | null;
}

export type SpeedEvent =
  | { type: 'start' }
  /** Active time only; ignored outside `question`. */
  | { type: 'tick'; dtMs: number }
  /** Only the first answer per question counts. */
  | { type: 'answer'; optionId: string }
  /** The caller's reveal beat (600 ms right, 1000 ms miss) has elapsed. */
  | { type: 'reveal-done' }
  | { type: 'pause'; reason: PauseReason }
  /** `pausedMs`: the wall time the round spent paused, from the caller's clock. */
  | { type: 'resume'; pausedMs?: number }
  | { type: 'quit' };

/** Relaxed: Hoya says "Take your time." */
export const HINT_SOFT_MS = 12_000;
/** Relaxed: a soft ring appears on the right option. */
export const HINT_RING_MS = 20_000;

export function initSession(c: SessionConfig): SpeedState {
  return {
    phase: 'ready',
    index: 0,
    sparks: 0,
    results: [],
    chosenId: null,
    hint: 'none',
    elapsedMs: 0,
    remainingMs: c.clockMs,
    totalActiveMs: 0,
    pauses: 0,
    pausedMs: 0,
    pendingPause: null,
    endedBy: null,
  };
}

function hintFor(elapsedMs: number, c: SessionConfig): SpeedState['hint'] {
  if (c.mode !== 'relaxed' || !c.hintsEnabled) return 'none';
  if (elapsedMs >= HINT_RING_MS) return 'ring';
  return elapsedMs >= HINT_SOFT_MS ? 'soft' : 'none';
}

function start(s: SpeedState, c: SessionConfig): SpeedState {
  if (s.phase !== 'ready') return s;
  if (c.questions.length === 0) return { ...s, phase: 'done', endedBy: 'questions' };
  return { ...s, phase: 'question', index: 0, elapsedMs: 0, totalActiveMs: 0, remainingMs: c.clockMs };
}

function tick(s: SpeedState, dtMs: number, c: SessionConfig): SpeedState {
  if (s.phase !== 'question' || !Number.isFinite(dtMs) || dtMs <= 0) return s;
  const elapsedMs = s.elapsedMs + dtMs;
  const totalActiveMs = s.totalActiveMs + dtMs;
  if (s.remainingMs !== null) {
    const remainingMs = Math.max(0, s.remainingMs - dtMs);
    // Time-out: the question on screen is not appended to `results` (S2).
    if (remainingMs <= 0) return { ...s, phase: 'done', endedBy: 'clock', remainingMs: 0, elapsedMs, totalActiveMs, pendingPause: null };
    return { ...s, elapsedMs, totalActiveMs, remainingMs, hint: hintFor(elapsedMs, c) };
  }
  return { ...s, elapsedMs, totalActiveMs, hint: hintFor(elapsedMs, c) };
}

function answer(s: SpeedState, optionId: string, c: SessionConfig): SpeedState {
  if (s.phase !== 'question' || s.chosenId !== null) return s;
  const q = c.questions[s.index];
  if (q === undefined || !q.options.some((o) => o.id === optionId)) return s;
  const correct = optionId === q.answerId;
  const result: QuestionResult = { itemId: q.itemId, format: q.format, correct, hinted: s.hint !== 'none', ms: s.elapsedMs };
  return {
    ...s,
    phase: 'reveal',
    chosenId: optionId,
    results: [...s.results, result],
    // The only line that touches the meter, and it can only add (S3).
    sparks: correct ? s.sparks + 1 : s.sparks,
  };
}

function revealDone(s: SpeedState, c: SessionConfig): SpeedState {
  if (s.phase !== 'reveal') return s;
  const index = s.index + 1;
  if (index >= c.questions.length) return { ...s, phase: 'done', endedBy: 'questions', pendingPause: null };
  const next: SpeedState = { ...s, phase: 'question', index, chosenId: null, elapsedMs: 0, hint: 'none', pendingPause: null };
  return s.pendingPause === null ? next : { ...next, phase: 'paused', resumePhase: 'question', pauses: s.pauses + 1 };
}

function pause(s: SpeedState, reason: PauseReason, c: SessionConfig): SpeedState {
  if (c.clockMs === null) return s;
  if (s.phase === 'question') return { ...s, phase: 'paused', resumePhase: 'question', pauses: s.pauses + 1 };
  if (s.phase === 'reveal' && s.pendingPause === null) return { ...s, pendingPause: reason };
  return s;
}

function resume(s: SpeedState, pausedMs: number | undefined): SpeedState {
  if (s.phase === 'reveal' && s.pendingPause !== null) return { ...s, pendingPause: null };
  if (s.phase !== 'paused') return s;
  const wall = pausedMs !== undefined && Number.isFinite(pausedMs) && pausedMs > 0 ? pausedMs : 0;
  const { resumePhase: _resumed, ...rest } = s;
  return { ...rest, phase: 'question', pausedMs: s.pausedMs + wall };
}

export function reduce(s: SpeedState, e: SpeedEvent, c: SessionConfig): SpeedState {
  if (e.type === 'quit') return s.endedBy === 'quit' ? s : { ...s, phase: 'done', endedBy: 'quit', pendingPause: null };
  if (s.phase === 'done') return s;
  switch (e.type) {
    case 'start':
      return start(s, c);
    case 'tick':
      return tick(s, e.dtMs, c);
    case 'answer':
      return answer(s, e.optionId, c);
    case 'reveal-done':
      return revealDone(s, c);
    case 'pause':
      return pause(s, e.reason, c);
    case 'resume':
      return resume(s, e.pausedMs);
  }
}
