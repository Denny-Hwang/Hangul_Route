import { beforeEach, describe, expect, it } from 'vitest';
import { useQuestRunStore } from '../quest-run-store';

describe('quest-run-store', () => {
  beforeEach(() => {
    useQuestRunStore.getState().reset();
  });

  it('beginQuest sets ids and zeroes counters', () => {
    useQuestRunStore.getState().beginQuest('quest:x', 'episode:y');
    const s = useQuestRunStore.getState();
    expect(s.questId).toBe('quest:x');
    expect(s.episodeId).toBe('episode:y');
    expect(s.correctCount).toBe(0);
    expect(s.totalCount).toBe(0);
    expect(s.retryCount).toBe(0);
    expect(s.scoredRounds).toEqual([]);
    expect(s.stepIndex).toBe(0);
  });

  it('a right first answer scores one correct round', () => {
    const { beginQuest, answerRound } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    answerRound(0, true);
    const s = useQuestRunStore.getState();
    expect(s.correctCount).toBe(1);
    expect(s.totalCount).toBe(1);
    expect(s.retryCount).toBe(0);
  });

  it('a wrong first answer scores one missed round', () => {
    const { beginQuest, answerRound } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    answerRound(0, false);
    const s = useQuestRunStore.getState();
    expect(s.correctCount).toBe(0);
    expect(s.totalCount).toBe(1);
    expect(s.retryCount).toBe(0);
  });

  it('re-taps in the same round are retries, never extra failed rounds (F-001 §3.2)', () => {
    const { beginQuest, answerRound } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    answerRound(0, false);
    answerRound(0, false);
    answerRound(0, true);
    answerRound(1, true);
    const s = useQuestRunStore.getState();
    expect(s.totalCount).toBe(2);
    expect(s.correctCount).toBe(1);
    expect(s.retryCount).toBe(2);
  });

  it('the same round number in a later step is a new round', () => {
    const { beginQuest, answerRound, markStepComplete, consumePendingAdvance } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    answerRound(0, true);
    markStepComplete();
    consumePendingAdvance();
    useQuestRunStore.getState().answerRound(0, false);
    const s = useQuestRunStore.getState();
    expect(s.totalCount).toBe(2);
    expect(s.correctCount).toBe(1);
    expect(s.retryCount).toBe(0);
  });

  it('relaunching a game cannot re-roll a round already scored in this step', () => {
    const { beginQuest, answerRound } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    answerRound(0, false);
    // Child backs out of the minigame and taps Play again: round 0 again.
    answerRound(0, true);
    const s = useQuestRunStore.getState();
    expect(s.totalCount).toBe(1);
    expect(s.correctCount).toBe(0);
    expect(s.retryCount).toBe(1);
  });

  it('round keys may be strings (card-match pairs)', () => {
    const { beginQuest, answerRound } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    answerRound('pair-1', false);
    answerRound('pair-2', true);
    answerRound('pair-1', true);
    const s = useQuestRunStore.getState();
    expect(s.totalCount).toBe(2);
    expect(s.correctCount).toBe(1);
    expect(s.retryCount).toBe(1);
  });

  it('markStepComplete then consumePendingAdvance advances one step', () => {
    const { beginQuest, markStepComplete, consumePendingAdvance } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    markStepComplete();
    expect(useQuestRunStore.getState().pendingAdvance).toBe(true);
    consumePendingAdvance();
    const s = useQuestRunStore.getState();
    expect(s.stepIndex).toBe(1);
    expect(s.pendingAdvance).toBe(false);
  });

  it('consumePendingAdvance is a no-op when nothing is pending', () => {
    const { beginQuest, consumePendingAdvance } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    consumePendingAdvance();
    expect(useQuestRunStore.getState().stepIndex).toBe(0);
  });

  it('goNextStep advances and clears pending', () => {
    const { beginQuest, markStepComplete, goNextStep } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    markStepComplete();
    goNextStep();
    const s = useQuestRunStore.getState();
    expect(s.stepIndex).toBe(1);
    expect(s.pendingAdvance).toBe(false);
  });

  it('stars returns 3 on a perfect run', () => {
    const { beginQuest, answerRound, stars } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    for (let i = 0; i < 5; i++) answerRound(i, true);
    expect(stars()).toBe(3);
  });

  it('stars come from first tries: one shaky round of four still earns 2', () => {
    const { beginQuest, answerRound, stars } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    answerRound(0, true);
    for (let i = 0; i < 4; i++) answerRound(1, false);
    answerRound(1, true);
    answerRound(2, true);
    answerRound(3, true);
    expect(stars()).toBe(2);
  });

  it('stars returns 0 with no rounds played', () => {
    useQuestRunStore.getState().beginQuest('q', 'e');
    expect(useQuestRunStore.getState().stars()).toBe(0);
  });

  it('reset clears all run state', () => {
    const { beginQuest, answerRound, reset } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    answerRound(0, false);
    answerRound(0, true);
    reset();
    const s = useQuestRunStore.getState();
    expect(s.questId).toBeNull();
    expect(s.correctCount).toBe(0);
    expect(s.totalCount).toBe(0);
    expect(s.retryCount).toBe(0);
    expect(s.scoredRounds).toEqual([]);
  });

  it('beginQuest after a run starts a fresh tally', () => {
    const { beginQuest, answerRound } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    answerRound(0, false);
    beginQuest('q', 'e');
    useQuestRunStore.getState().answerRound(0, true);
    const s = useQuestRunStore.getState();
    expect(s.totalCount).toBe(1);
    expect(s.correctCount).toBe(1);
  });
});
