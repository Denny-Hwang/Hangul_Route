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
    expect(s.attempts).toBe(0);
    expect(s.stepIndex).toBe(0);
  });

  it('recordRound(true) bumps correct + total, leaves attempts', () => {
    const { beginQuest, recordRound } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    recordRound(true);
    const s = useQuestRunStore.getState();
    expect(s.correctCount).toBe(1);
    expect(s.totalCount).toBe(1);
    expect(s.attempts).toBe(0);
  });

  it('recordRound(false) bumps total + attempts, leaves correct', () => {
    const { beginQuest, recordRound } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    recordRound(false);
    const s = useQuestRunStore.getState();
    expect(s.correctCount).toBe(0);
    expect(s.totalCount).toBe(1);
    expect(s.attempts).toBe(1);
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
    const { beginQuest, recordRound, stars } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    for (let i = 0; i < 5; i++) recordRound(true);
    expect(stars()).toBe(3);
  });

  it('stars returns 0 with no rounds played', () => {
    useQuestRunStore.getState().beginQuest('q', 'e');
    expect(useQuestRunStore.getState().stars()).toBe(0);
  });

  it('reset clears all run state', () => {
    const { beginQuest, recordRound, reset } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    recordRound(true);
    reset();
    const s = useQuestRunStore.getState();
    expect(s.questId).toBeNull();
    expect(s.correctCount).toBe(0);
    expect(s.totalCount).toBe(0);
  });
});
