import type { VocabQuestion } from './question-builder';

/**
 * The decisions behind the shared `VocabQuestionView` (F-VOC-004 §3.9). Pure:
 * the view renders what this returns and runs the effects it asks for (the
 * test lanes cannot render components).
 *
 * Two modes, one question at a time:
 * - `speed` (the Speed Round, S5): the first tap decides. A wrong tap locks
 *   and continues: the tapped option turns amber with a dash, the right one is
 *   marked, the word is spoken, and the next question opens after 1000 ms
 *   (600 ms after a right tap). The hint ring comes from the session reducer.
 * - `check` (F-VOC-003's quick check): a wrong tap locks that option and
 *   stays; the learner may tap again until right, and a second miss rings the
 *   right option (Listen & Pick semantics, F-QUEST-002 §3.10). The right tap
 *   speaks the word and the next question opens after 700 ms.
 *
 * Every accepted tap reports an `answer` effect with `firstTry` set on the
 * first one; the host records the first answer per question as the scored one
 * (`first-try.ts`). A touch inside `touchWindowMs` (350 ms, under the board's 400 ms lock) after an accepted one is a bounce and is
 * dropped (AMENDMENTS-TOUCH KT-D5; the 50 ms window of F-001 §3.4 became this lock).
 */

export type QuestionFlowMode = 'speed' | 'check';

export const QUESTION_FLOW_TIMING = {
  /** Speed: a right answer's reveal beat. */
  revealRightMs: 600,
  /** Speed: a miss's reveal beat (the right answer is shown and spoken). */
  revealMissMs: 1_000,
  /** Check: the right answer -> the next question. */
  checkAdvanceMs: 700,
  /** Touches inside this window after an accepted one are a bounce and are dropped (AMENDMENTS-TOUCH KT-D5). */
  // `TAP_LOCK_MS` of the design system's tap model less a 50 ms clock slack (literals here: app code imports no
  // design-system subpath at runtime, and logic stays free of react-native; the test pins the value). The board's
  // lock is the gate at `TAP_LOCK_MS` on the touch events' own times; this window is the backstop on `Date.now()` at
  // dispatch, so a first tap whose handler ran a few ms late must not make it drop a tap the board accepted.
  touchWindowMs: 350,
} as const;

export interface QuestionFlowState {
  /** `resolved`: the question is over (speed: any tap; check: the right tap). */
  status: 'asking' | 'resolved';
  /** The first tap of this question. */
  chosenId: string | null;
  /** Options tapped that were not the answer; they stay locked. */
  wrongIds: readonly string[];
  /** A sound prompt could not play, so its word is shown as text. */
  textPrompt: boolean;
  /** When the last accepted tap arrived, for the bounce window (`touchWindowMs`). */
  lastTapAt: number | null;
}

export type QuestionFlowEvent = { type: 'tap'; optionId: string; at: number } | { type: 'audio-failed' };

export type QuestionFlowEffect =
  | { type: 'answer'; optionId: string; correct: boolean; firstTry: boolean }
  | { type: 'haptic'; kind: 'success' | 'nudge' }
  /** Speak the answer word (`playPrompt`, kind `word`). */
  | { type: 'speak' }
  /** Open the next question after `ms` (speed: the session's `reveal-done`). */
  | { type: 'schedule-advance'; ms: number };

export interface QuestionFlowStep {
  state: QuestionFlowState;
  effects: QuestionFlowEffect[];
}

/** How one option looks: `nudge` is the amber miss with a dash, `hint` the thick ring. */
export type OptionState = 'idle' | 'correct' | 'nudge' | 'hint' | 'disabled';

/** Check mode: misses before the right option is ringed. */
const CHECK_RING_AFTER_MISSES = 2;

export function startQuestionFlow(): QuestionFlowState {
  return { status: 'asking', chosenId: null, wrongIds: [], textPrompt: false, lastTapAt: null };
}

const unchanged = (state: QuestionFlowState): QuestionFlowStep => ({ state, effects: [] });

function tapStep(state: QuestionFlowState, optionId: string, at: number, q: VocabQuestion, mode: QuestionFlowMode): QuestionFlowStep {
  if (state.status !== 'asking' || state.wrongIds.includes(optionId)) return unchanged(state);
  if (!q.options.some((o) => o.id === optionId)) return unchanged(state);
  if (state.lastTapAt !== null && at - state.lastTapAt < QUESTION_FLOW_TIMING.touchWindowMs) return unchanged(state);

  const correct = optionId === q.answerId;
  const firstTry = state.chosenId === null;
  const answer: QuestionFlowEffect = { type: 'answer', optionId, correct, firstTry };
  const tapped: QuestionFlowState = {
    ...state,
    chosenId: state.chosenId ?? optionId,
    wrongIds: correct ? state.wrongIds : [...state.wrongIds, optionId],
    lastTapAt: at,
  };

  if (correct) {
    const ms = mode === 'speed' ? QUESTION_FLOW_TIMING.revealRightMs : QUESTION_FLOW_TIMING.checkAdvanceMs;
    return {
      state: { ...tapped, status: 'resolved' },
      effects: [answer, { type: 'haptic', kind: 'success' }, { type: 'speak' }, { type: 'schedule-advance', ms }],
    };
  }
  if (mode === 'speed') {
    return {
      state: { ...tapped, status: 'resolved' },
      effects: [answer, { type: 'haptic', kind: 'nudge' }, { type: 'speak' }, { type: 'schedule-advance', ms: QUESTION_FLOW_TIMING.revealMissMs }],
    };
  }
  return { state: tapped, effects: [answer, { type: 'haptic', kind: 'nudge' }] };
}

/** One event in, the next state and the effects the view must run. */
export function stepQuestionFlow(state: QuestionFlowState, event: QuestionFlowEvent, q: VocabQuestion, mode: QuestionFlowMode): QuestionFlowStep {
  if (event.type === 'tap') return tapStep(state, event.optionId, event.at, q, mode);
  if (q.prompt.kind !== 'audio' || state.textPrompt) return unchanged(state);
  return { state: { ...state, textPrompt: true }, effects: [] };
}

/**
 * How option `optionId` looks now. `ring` is the session's hint ring (speed,
 * Relaxed at 20 s); check mode rings the answer itself after two misses.
 */
export function optionState(q: VocabQuestion, optionId: string, state: QuestionFlowState, mode: QuestionFlowMode, ring: boolean): OptionState {
  const isAnswer = optionId === q.answerId;
  const resolved = state.status === 'resolved';
  if (resolved && isAnswer) return 'correct';
  if (state.wrongIds.includes(optionId)) return 'nudge';
  if (resolved) return 'disabled';
  const ringed = ring || (mode === 'check' && state.wrongIds.length >= CHECK_RING_AFTER_MISSES);
  return ringed && isAnswer ? 'hint' : 'idle';
}

/** The answer's gloss and romanization appear under the prompt once the question is over. */
export function showsAnswer(state: QuestionFlowState): boolean {
  return state.status === 'resolved';
}
