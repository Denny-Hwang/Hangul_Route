import { describe, expect, it } from 'vitest';
import type { VocabQuestion } from '../question-builder';
import {
  QUESTION_FLOW_TIMING,
  optionState,
  showsAnswer,
  startQuestionFlow,
  stepQuestionFlow,
  type QuestionFlowMode,
  type QuestionFlowState,
} from '../question-flow';

const QUESTION: VocabQuestion = {
  key: 'q0:vocab:sagwa:word-to-image',
  itemId: 'vocab:sagwa',
  format: 'word-to-image',
  prompt: { kind: 'word', ko: 'x', romanization: 'sagwa', spokenKo: 'x' },
  options: ['vocab:bae', 'vocab:sagwa', 'vocab:ttalgi', 'vocab:podo'].map((id) => ({ id, pictureRef: `word:${id}` })),
  answerId: 'vocab:sagwa',
};
const AUDIO: VocabQuestion = { ...QUESTION, key: 'q1:vocab:sagwa:audio-to-image', format: 'audio-to-image', prompt: { kind: 'audio', spokenKo: 'x' } };

const tap = (optionId: string, at: number) => ({ type: 'tap', optionId, at }) as const;

function play(mode: QuestionFlowMode, taps: ReadonlyArray<readonly [string, number]>, q: VocabQuestion = QUESTION) {
  let state: QuestionFlowState = startQuestionFlow();
  const effects = [];
  for (const [id, at] of taps) {
    const step = stepQuestionFlow(state, tap(id, at), q, mode);
    state = step.state;
    effects.push(...step.effects);
  }
  return { state, effects };
}

describe('timing (F-VOC-004 §3.6, F-VOC-003 quick check)', () => {
  it('600 ms after a right answer, 1000 ms after a miss, 700 ms in the check, a 50 ms touch window', () => {
    expect(QUESTION_FLOW_TIMING).toEqual({ revealRightMs: 600, revealMissMs: 1_000, checkAdvanceMs: 700, touchWindowMs: 50 });
  });
});

describe("mode 'speed': one try, then the reveal (S5)", () => {
  it('a right first tap resolves, speaks the word and advances after 600 ms', () => {
    const { state, effects } = play('speed', [['vocab:sagwa', 100]]);
    expect(state).toMatchObject({ status: 'resolved', chosenId: 'vocab:sagwa', wrongIds: [] });
    expect(effects).toEqual([
      { type: 'answer', optionId: 'vocab:sagwa', correct: true, firstTry: true },
      { type: 'haptic', kind: 'success' },
      { type: 'speak' },
      { type: 'schedule-advance', ms: 600 },
    ]);
  });

  it('a wrong first tap locks and continues: the word is still spoken, then the next question after 1000 ms', () => {
    const { state, effects } = play('speed', [['vocab:bae', 100]]);
    expect(state).toMatchObject({ status: 'resolved', chosenId: 'vocab:bae', wrongIds: ['vocab:bae'] });
    expect(effects).toEqual([
      { type: 'answer', optionId: 'vocab:bae', correct: false, firstTry: true },
      { type: 'haptic', kind: 'nudge' },
      { type: 'speak' },
      { type: 'schedule-advance', ms: 1_000 },
    ]);
  });

  it('every later tap is ignored', () => {
    const { effects } = play('speed', [
      ['vocab:bae', 100],
      ['vocab:sagwa', 400],
      ['vocab:podo', 900],
    ]);
    expect(effects.filter((e) => e.type === 'answer')).toHaveLength(1);
  });

  it('marks the miss amber with the right answer shown, the rest disabled', () => {
    const { state } = play('speed', [['vocab:bae', 100]]);
    expect(optionState(QUESTION, 'vocab:bae', state, 'speed', false)).toBe('nudge');
    expect(optionState(QUESTION, 'vocab:sagwa', state, 'speed', false)).toBe('correct');
    expect(optionState(QUESTION, 'vocab:podo', state, 'speed', false)).toBe('disabled');
    expect(showsAnswer(state)).toBe(true);
  });

  it('the session hint ring shows on the right option only while asking', () => {
    const asking = startQuestionFlow();
    expect(optionState(QUESTION, 'vocab:sagwa', asking, 'speed', true)).toBe('hint');
    expect(optionState(QUESTION, 'vocab:bae', asking, 'speed', true)).toBe('idle');
    expect(optionState(QUESTION, 'vocab:sagwa', asking, 'speed', false)).toBe('idle');
    const { state } = play('speed', [['vocab:sagwa', 1]]);
    expect(optionState(QUESTION, 'vocab:sagwa', state, 'speed', true)).toBe('correct');
    // A speed miss never rings: one try only.
    expect(optionState(QUESTION, 'vocab:sagwa', play('speed', [['vocab:bae', 1]]).state, 'speed', false)).toBe('correct');
  });
});

describe("mode 'check': try again until right (F-VOC-003 quick check, Listen & Pick semantics)", () => {
  it('a wrong tap locks that option, stays on the question and records a non-first answer next', () => {
    const { state, effects } = play('check', [
      ['vocab:bae', 100],
      ['vocab:sagwa', 400],
    ]);
    expect(state).toMatchObject({ status: 'resolved', chosenId: 'vocab:bae', wrongIds: ['vocab:bae'] });
    expect(effects).toEqual([
      { type: 'answer', optionId: 'vocab:bae', correct: false, firstTry: true },
      { type: 'haptic', kind: 'nudge' },
      { type: 'answer', optionId: 'vocab:sagwa', correct: true, firstTry: false },
      { type: 'haptic', kind: 'success' },
      { type: 'speak' },
      { type: 'schedule-advance', ms: 700 },
    ]);
  });

  it('a locked option cannot be tapped again', () => {
    const { effects, state } = play('check', [
      ['vocab:bae', 100],
      ['vocab:bae', 400],
    ]);
    expect(effects.filter((e) => e.type === 'answer')).toHaveLength(1);
    expect(state.status).toBe('asking');
    expect(showsAnswer(state)).toBe(false);
    expect(optionState(QUESTION, 'vocab:bae', state, 'check', false)).toBe('nudge');
    expect(optionState(QUESTION, 'vocab:sagwa', state, 'check', false)).toBe('idle');
  });

  it('a second miss rings the right option', () => {
    const { state } = play('check', [
      ['vocab:bae', 100],
      ['vocab:podo', 400],
    ]);
    expect(optionState(QUESTION, 'vocab:sagwa', state, 'check', false)).toBe('hint');
    expect(optionState(QUESTION, 'vocab:ttalgi', state, 'check', false)).toBe('idle');
  });

  it('a right first tap is the scored first try', () => {
    const { effects } = play('check', [['vocab:sagwa', 100]]);
    expect(effects[0]).toEqual({ type: 'answer', optionId: 'vocab:sagwa', correct: true, firstTry: true });
  });
});

describe('both modes', () => {
  it('drops a second touch inside 50 ms of an accepted one (F-001 §3.4)', () => {
    const { effects } = play('check', [
      ['vocab:bae', 100],
      ['vocab:sagwa', 149],
    ]);
    expect(effects.filter((e) => e.type === 'answer')).toHaveLength(1);
    const later = play('check', [
      ['vocab:bae', 100],
      ['vocab:sagwa', 150],
    ]);
    expect(later.effects.filter((e) => e.type === 'answer')).toHaveLength(2);
  });

  it('ignores an id that is not an option', () => {
    for (const mode of ['speed', 'check'] as const) {
      const start = startQuestionFlow();
      const step = stepQuestionFlow(start, tap('vocab:elsewhere', 5), QUESTION, mode);
      expect(step.state).toBe(start);
      expect(step.effects).toEqual([]);
    }
  });

  it('starts asking with nothing chosen', () => {
    expect(startQuestionFlow()).toEqual({ status: 'asking', chosenId: null, wrongIds: [], textPrompt: false, lastTapAt: null });
  });
});

describe('audio failure (§3.6, F-AUDIO-004 §3.8)', () => {
  it('a sound question shows its text prompt and still scores normally', () => {
    const start = startQuestionFlow();
    const step = stepQuestionFlow(start, { type: 'audio-failed' }, AUDIO, 'speed');
    expect(step.state.textPrompt).toBe(true);
    expect(step.effects).toEqual([]);
    const again = stepQuestionFlow(step.state, { type: 'audio-failed' }, AUDIO, 'speed');
    expect(again.state).toBe(step.state);
    const answered = stepQuestionFlow(step.state, tap('vocab:sagwa', 10), AUDIO, 'speed');
    expect(answered.effects[0]).toEqual({ type: 'answer', optionId: 'vocab:sagwa', correct: true, firstTry: true });
    expect(answered.state.textPrompt).toBe(true);
  });

  it('changes nothing for a question that already shows its word', () => {
    const start = startQuestionFlow();
    expect(stepQuestionFlow(start, { type: 'audio-failed' }, QUESTION, 'speed').state).toBe(start);
  });
});
