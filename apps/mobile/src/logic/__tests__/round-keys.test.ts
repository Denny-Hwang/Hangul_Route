import { beforeEach, describe, expect, it } from 'vitest';
import { useQuestRunStore } from '../../store/quest-run-store';
import { pairRoundKey, sequenceRoundKey } from '../round-keys';

const run = (): ReturnType<typeof useQuestRunStore.getState> => useQuestRunStore.getState();

describe('round keys feed first-try scoring (F-001 §3.2 revised)', () => {
  beforeEach(() => {
    run().reset();
    run().beginQuest('q', 'e');
  });

  it('pair keys are stable per Korean card and distinct across cards', () => {
    expect(pairRoundKey(2)).toBe(pairRoundKey(2));
    expect(new Set([0, 1, 2, 3].map(pairRoundKey)).size).toBe(4);
  });

  it('Card Match: wrong picks then the right one on a card are one missed round, not three', () => {
    // The child taps Korean card 1, picks wrong twice, then right.
    run().answerRound(pairRoundKey(1), false);
    run().answerRound(pairRoundKey(1), false);
    run().answerRound(pairRoundKey(1), true);
    // Korean card 0 is matched first try.
    run().answerRound(pairRoundKey(0), true);
    const s = run();
    expect(s.totalCount).toBe(2);
    expect(s.correctCount).toBe(1);
    expect(s.retryCount).toBe(2);
  });

  it('Story Sequence: a wrong tap and the right tap in the same slot share one round', () => {
    // slot 0 right, slot 1 wrong-then-right, slot 2 right
    run().answerRound(sequenceRoundKey(0), true);
    run().answerRound(sequenceRoundKey(1), false);
    run().answerRound(sequenceRoundKey(1), true);
    run().answerRound(sequenceRoundKey(2), true);
    const s = run();
    expect(s.totalCount).toBe(3);
    expect(s.correctCount).toBe(2);
    expect(s.retryCount).toBe(1);
  });

  it('plain index games: each round index is its own round', () => {
    for (let i = 0; i < 5; i += 1) run().answerRound(i, i !== 2);
    run().answerRound(2, true); // retry on round 2
    const s = run();
    expect(s.totalCount).toBe(5);
    expect(s.correctCount).toBe(4);
    expect(s.retryCount).toBe(1);
    expect(s.stars()).toBe(2);
  });

  it('the same key in the next step is a new round', () => {
    run().answerRound(0, true);
    run().markStepComplete();
    run().goNextStep();
    run().answerRound(0, false);
    expect(run().totalCount).toBe(2);
    expect(run().correctCount).toBe(1);
  });
});
