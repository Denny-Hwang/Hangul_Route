import { describe, expect, it } from 'vitest';
import { answer, expire, skip, startSession, tally } from '../assessment/session';
import type { AssessmentResponse } from '../assessment/question';
import { makeQuestion } from './helpers/assessment-fixtures';

const three = () => [makeQuestion('q1'), makeQuestion('q2'), makeQuestion('q3', 'b')];

describe('startSession', () => {
  it('starts with no responses and not ended', () => {
    const s = startSession(three());
    expect(s.questions.map((q) => q.id)).toEqual(['q1', 'q2', 'q3']);
    expect(s.responses).toEqual([]);
    expect(s.endedAtMs).toBeNull();
  });

  it('rejects duplicate question ids', () => {
    expect(() => startSession([makeQuestion('q1'), makeQuestion('q1')])).toThrow(/duplicate/i);
  });

  it('accepts an empty list', () => {
    expect(startSession([]).questions).toEqual([]);
  });
});

describe('answer', () => {
  it('records correct when the chosen option is the correct one', () => {
    const s = answer(startSession(three()), 'q1', 'q1-a', { ms: 800 });
    expect(s.responses).toEqual([
      { questionId: 'q1', outcome: 'correct', chosenOptionId: 'q1-a', assisted: false, ms: 800 },
    ]);
  });

  it('records wrong for another option of the question', () => {
    const s = answer(startSession(three()), 'q1', 'q1-b', { ms: 800 });
    expect(s.responses[0]?.outcome).toBe('wrong');
    expect(s.responses[0]?.chosenOptionId).toBe('q1-b');
  });

  it('keeps the assisted flag', () => {
    const s = answer(startSession(three()), 'q1', 'q1-a', { ms: 800, assisted: true });
    expect(s.responses[0]?.assisted).toBe(true);
  });

  it('does not change the session it was given', () => {
    const s0 = startSession(three());
    answer(s0, 'q1', 'q1-a', { ms: 1 });
    expect(s0.responses).toEqual([]);
  });

  it('rejects a question that is not in the session', () => {
    expect(() => answer(startSession(three()), 'nope', 'nope-a', { ms: 1 })).toThrow(/not in the session/);
  });

  it('rejects an option that does not belong to the question', () => {
    expect(() => answer(startSession(three()), 'q1', 'q2-a', { ms: 1 })).toThrow(/option/);
  });

  it('rejects a second response to the same question', () => {
    const s = answer(startSession(three()), 'q1', 'q1-a', { ms: 1 });
    expect(() => answer(s, 'q1', 'q1-b', { ms: 1 })).toThrow(/already/);
    expect(() => skip(s, 'q1', { ms: 1 })).toThrow(/already/);
  });

  it('clamps ms into the schema range and treats a non-number as 0', () => {
    const s0 = startSession(three());
    expect(answer(s0, 'q1', 'q1-a', { ms: 9_999_999 }).responses[0]?.ms).toBe(600_000);
    expect(answer(s0, 'q1', 'q1-a', { ms: -5 }).responses[0]?.ms).toBe(0);
    expect(answer(s0, 'q1', 'q1-a', { ms: 12.6 }).responses[0]?.ms).toBe(13);
    expect(answer(s0, 'q1', 'q1-a', { ms: Number.NaN }).responses[0]?.ms).toBe(0);
  });
});

describe('skip', () => {
  it('records skipped with no chosen option, never wrong', () => {
    const s = skip(startSession(three()), 'q2', { ms: 4000 });
    expect(s.responses).toEqual([
      { questionId: 'q2', outcome: 'skipped', chosenOptionId: null, assisted: false, ms: 4000 },
    ]);
  });

  it('rejects an unknown question', () => {
    expect(() => skip(startSession(three()), 'nope', { ms: 1 })).toThrow(/not in the session/);
  });

  it('keeps the assisted flag', () => {
    expect(skip(startSession(three()), 'q2', { ms: 1, assisted: true }).responses[0]?.assisted).toBe(true);
  });
});

describe('expire', () => {
  it('marks every unanswered question skipped, never wrong, and ends the session', () => {
    let s = startSession(three());
    s = answer(s, 'q2', 'q2-a', { ms: 500 });
    const ended = expire(s, 360_000);
    expect(ended.endedAtMs).toBe(360_000);
    expect(ended.responses.map((r) => [r.questionId, r.outcome])).toEqual([
      ['q2', 'correct'],
      ['q1', 'skipped'],
      ['q3', 'skipped'],
    ]);
    expect(ended.responses.some((r) => r.outcome === 'wrong')).toBe(false);
    const added = ended.responses.slice(1);
    for (const r of added) {
      expect(r.chosenOptionId).toBeNull();
      expect(r.assisted).toBe(false);
      expect(r.ms).toBe(0);
    }
  });

  it('leaves the answered responses untouched, wrong ones included', () => {
    const s = answer(startSession(three()), 'q1', 'q1-b', { ms: 100 });
    const ended = expire(s, 1);
    expect(ended.responses[0]?.outcome).toBe('wrong');
  });

  it('does not change the session it was given', () => {
    const s = startSession(three());
    expire(s, 5);
    expect(s.responses).toEqual([]);
    expect(s.endedAtMs).toBeNull();
  });

  it('is idempotent: a second expire changes nothing', () => {
    const once = expire(startSession(three()), 10);
    const twice = expire(once, 99);
    expect(twice).toBe(once);
    expect(twice.endedAtMs).toBe(10);
  });

  it('rejects answers and skips after the session has ended', () => {
    const ended = expire(startSession(three()), 10);
    expect(() => answer(ended, 'q1', 'q1-a', { ms: 1 })).toThrow(/already/);
    const early = { ...startSession(three()), endedAtMs: 7 };
    expect(() => answer(early, 'q1', 'q1-a', { ms: 1 })).toThrow(/ended/);
    expect(() => skip(early, 'q1', { ms: 1 })).toThrow(/ended/);
  });

  it('ends a session that was already fully answered without adding responses', () => {
    let s = startSession([makeQuestion('q1')]);
    s = answer(s, 'q1', 'q1-a', { ms: 1 });
    const ended = expire(s, 42);
    expect(ended.responses).toHaveLength(1);
    expect(ended.endedAtMs).toBe(42);
  });
});

describe('tally', () => {
  const r = (outcome: AssessmentResponse['outcome'], assisted = false): AssessmentResponse => ({
    questionId: 'q',
    outcome,
    chosenOptionId: outcome === 'skipped' ? null : 'o',
    assisted,
    ms: 1,
  });

  it('counts each outcome and the assisted correct answers', () => {
    expect(
      tally([r('correct'), r('correct', true), r('wrong'), r('wrong', true), r('skipped'), r('skipped', true)]),
    ).toEqual({ asked: 6, correct: 2, wrong: 2, skipped: 2, assistedCorrect: 1 });
  });

  it('is all zeros for no responses', () => {
    expect(tally([])).toEqual({ asked: 0, correct: 0, wrong: 0, skipped: 0, assistedCorrect: 0 });
  });

  it('tallies an expired session as skipped, not wrong', () => {
    const s = expire(answer(startSession(three()), 'q1', 'q1-a', { ms: 1 }), 5);
    expect(tally(s.responses)).toEqual({ asked: 3, correct: 1, wrong: 0, skipped: 2, assistedCorrect: 0 });
  });
});
