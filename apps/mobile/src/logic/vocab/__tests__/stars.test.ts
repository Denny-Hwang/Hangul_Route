import { describe, expect, it } from 'vitest';
import type { VocabQuestion } from '../question-builder';
import type { QuestionResult, SessionConfig } from '../speed-session';
import { starsForRound, summarize } from '../stars';

/** F-RVW-001 §3.1, written out independently of the code under test. */
function expected(firstTry: number, answered: number): 1 | 2 | 3 {
  if (firstTry * 10 >= answered * 8) return 3;
  if (firstTry * 2 >= answered) return 2;
  return 1;
}

describe('starsForRound (F-VOC-004 S4, F-RVW-001 §3.1)', () => {
  it('matches the 0.8 / 0.5 table for every N from 1 to 20, and is never 0', () => {
    for (let answered = 1; answered <= 20; answered += 1) {
      for (let firstTry = 0; firstTry <= answered; firstTry += 1) {
        const stars = starsForRound(firstTry, answered);
        expect(stars, `${firstTry} of ${answered}`).toBe(expected(firstTry, answered));
        expect(stars).not.toBe(0);
      }
    }
  });

  it('pins the boundaries of behaviour 10', () => {
    expect(starsForRound(8, 10)).toBe(3);
    expect(starsForRound(7, 10)).toBe(2);
    expect(starsForRound(5, 10)).toBe(2);
    expect(starsForRound(4, 10)).toBe(1);
    expect(starsForRound(0, 10)).toBe(1);
    expect(starsForRound(4, 5)).toBe(3);
    expect(starsForRound(1, 2)).toBe(2);
    expect(starsForRound(2, 2)).toBe(3);
  });

  it('is null when nothing was answered: the round was not played', () => {
    expect(starsForRound(0, 0)).toBeNull();
    expect(starsForRound(3, 0)).toBeNull();
    expect(starsForRound(0, -1)).toBeNull();
    expect(starsForRound(0, Number.NaN)).toBeNull();
  });

  it('clamps a first-try count outside 0..answered', () => {
    expect(starsForRound(12, 10)).toBe(3);
    expect(starsForRound(-3, 10)).toBe(1);
    expect(starsForRound(Number.NaN, 10)).toBe(1);
  });

  it('is not the quest table (starsForAccuracy, 0.95 / 0.6 / 0.2)', () => {
    // 9 of 10 is 3 here and 2 under the quest table; 1 of 10 is 1 here and 0 there.
    expect(starsForRound(9, 10)).toBe(3);
    expect(starsForRound(1, 10)).toBe(1);
  });
});

// ---------- summarize ----------

const q = (itemId: string): VocabQuestion => ({
  key: `q:${itemId}`,
  itemId,
  format: 'word-to-image',
  prompt: { kind: 'word' },
  options: [],
  answerId: itemId,
});

const cfg = (mode: SessionConfig['mode'], clockMs: number | null): SessionConfig => ({
  mode,
  questions: [q('vocab:a'), q('vocab:b'), q('vocab:c')],
  clockMs,
  hintsEnabled: mode === 'relaxed',
});

const r = (itemId: string, correct: boolean, hinted = false): QuestionResult => ({ itemId, format: 'word-to-image', correct, hinted, ms: 1_000 });

describe('summarize', () => {
  it('counts first-try right answers without hints, and caught as distinct words', () => {
    const results = [
      r('vocab:a', true),
      r('vocab:b', true, true), // found with a hint: a spark, but not a first try
      r('vocab:c', false),
      r('vocab:a', true), // caught twice, counted once
      r('vocab:c', true),
    ];
    const s = summarize(results, cfg('relaxed', null), 'questions');
    expect(s).toEqual({
      mode: 'relaxed',
      endedBy: 'questions',
      clockMs: null,
      answered: 5,
      firstTryCorrect: 3,
      hinted: 1,
      caught: 2,
      caughtIds: ['vocab:a', 'vocab:c'],
      seeAgainIds: ['vocab:c'],
      stars: 2, // 3 of 5 first try
    });
  });

  it('lists words to see again once each, in the order they came up, including hinted-only words', () => {
    const results = [r('vocab:b', false), r('vocab:a', true, true), r('vocab:b', false), r('vocab:c', false)];
    const s = summarize(results, cfg('challenge', 60_000), 'clock');
    expect(s.seeAgainIds).toEqual(['vocab:b', 'vocab:c']);
    expect(s.caught).toBe(0);
    expect(s.caughtIds).toEqual([]);
    expect(s.stars).toBe(1);
    expect(s.mode).toBe('challenge');
    expect(s.endedBy).toBe('clock');
    expect(s.clockMs).toBe(60_000);
  });

  it('a round with nothing answered has no stars', () => {
    const s = summarize([], cfg('challenge', 60_000), 'clock');
    expect(s.stars).toBeNull();
    expect(s.answered).toBe(0);
    expect(s.caught).toBe(0);
  });

  it('is a plain serialisable object (it rides in the VocabResults route)', () => {
    const s = summarize([r('vocab:a', true)], cfg('relaxed', null), 'questions');
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
