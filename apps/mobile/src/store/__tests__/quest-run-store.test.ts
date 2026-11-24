import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gameFinishIsReported as finishIsReported } from '../../logic/minigame-finished';
import { savedRunOf } from '../../logic/quest-flow/saved-run';
import { answerAside, setFirstRoundAnswerListener, useQuestRunStore, type FirstRoundAnswer } from '../quest-run-store';

const gameFinishIsReported = (questId: string, stepIndex: number): boolean => finishIsReported(useQuestRunStore.getState(), questId, stepIndex);

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

  it('beginQuest starts at a given step (F-STORY-004 §3.8 resume: the story-read step)', () => {
    const { beginQuest, answerRound, goNextStep } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    goNextStep();
    answerRound(0, true);
    beginQuest('quest:x', 'episode:y', 2);
    const s = useQuestRunStore.getState();
    expect(s.stepIndex).toBe(2);
    expect(s.correctCount).toBe(0);
    expect(s.totalCount).toBe(0);
    expect(s.scoredRounds).toEqual([]);
    expect(s.pendingAdvance).toBe(false);
  });

  it('beginQuest ignores a start step that is negative or not a whole number', () => {
    const { beginQuest } = useQuestRunStore.getState();
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      beginQuest('q', 'e', bad);
      expect(useQuestRunStore.getState().stepIndex).toBe(0);
    }
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

  describe('[AU] skipped game steps (AMENDMENTS-AUDIT-2026-11 row AU-9)', () => {
    const steps = [
      { kind: 'intro' },
      { kind: 'practice', minigameKind: 'listen-pick', minigameRef: 'minigame:a' },
      { kind: 'apply', minigameKind: 'build-letter', minigameRef: 'minigame:b' },
      { kind: 'check', minigameKind: 'listen-pick', minigameRef: 'minigame:c' },
      { kind: 'reward' },
    ] as const;

    it('a new run has skipped nothing', () => {
      useQuestRunStore.getState().beginQuest('q', 'e');
      expect(useQuestRunStore.getState().skippedSteps).toEqual([]);
    });

    it('Skip for now notes the current step once and does not move the run', () => {
      const store = useQuestRunStore.getState();
      store.beginQuest('q', 'e', 1);
      store.markStepSkipped();
      store.markStepSkipped();
      expect(useQuestRunStore.getState().skippedSteps).toEqual([1]);
      expect(useQuestRunStore.getState().stepIndex).toBe(1);
    });

    it('a game ended from inside (its own Skip, or a reader that scores no round) is a completed step, as before', () => {
      const store = useQuestRunStore.getState();
      store.beginQuest('q', 'e', 1);
      store.answerRound(0, false);
      store.markStepComplete();
      store.consumePendingAdvance();
      store.markStepComplete();
      store.consumePendingAdvance();
      const s = useQuestRunStore.getState();
      expect(s.stepIndex).toBe(3);
      expect(s.skippedSteps).toEqual([]);
      expect(s.totalCount).toBe(1);
    });

    it('one perfect game and one skip is 2 stars, not 3', () => {
      const store = useQuestRunStore.getState();
      store.beginQuest('q', 'e', 1);
      for (let i = 0; i < 4; i += 1) store.answerRound(i, true);
      store.goNextStep();
      store.markStepSkipped();
      store.goNextStep();
      store.answerRound(0, true);
      store.answerRound(1, true);
      expect(useQuestRunStore.getState().stars(steps)).toBe(2);
      // Without the steps a noted skip still caps at 2.
      expect(useQuestRunStore.getState().stars()).toBe(2);
    });

    it('every game skipped and a perfect Check is 1 star', () => {
      const store = useQuestRunStore.getState();
      store.beginQuest('q', 'e', 1);
      store.markStepSkipped();
      store.goNextStep();
      store.markStepSkipped();
      store.goNextStep();
      store.answerRound(0, true);
      store.answerRound(1, true);
      expect(useQuestRunStore.getState().stars(steps)).toBe(1);
    });

    it('a run with no skip keeps its stars, and the cap never raises them', () => {
      const store = useQuestRunStore.getState();
      store.beginQuest('q', 'e', 1);
      store.answerRound(0, true);
      expect(useQuestRunStore.getState().stars(steps)).toBe(3);
      store.goNextStep();
      store.markStepSkipped();
      for (let i = 0; i < 9; i += 1) store.answerRound(i, false);
      expect(useQuestRunStore.getState().stars(steps)).toBe(0);
    });

    it('a new run and a reset forget the skips', () => {
      const store = useQuestRunStore.getState();
      store.beginQuest('q', 'e', 1);
      store.markStepSkipped();
      store.beginQuest('q', 'e');
      expect(useQuestRunStore.getState().skippedSteps).toEqual([]);
      store.markStepSkipped();
      store.reset();
      expect(useQuestRunStore.getState().skippedSteps).toEqual([]);
    });
  });

  describe('[AU] a run resumed after a reload (AMENDMENTS-AUDIT-2026-11 row AU-12)', () => {
    const restore = { stepIndex: 3, correctCount: 2, totalCount: 3, retryCount: 1, scoredRounds: ['2:0', '2:1', '3:0'], skippedSteps: [1], startedAt: '2026-11-16T09:00:00.000Z' };

    it('a new run notes when it began', () => {
      const before = Date.now();
      useQuestRunStore.getState().beginQuest('q', 'e');
      const at = Date.parse(useQuestRunStore.getState().startedAt ?? '');
      expect(at).toBeGreaterThanOrEqual(before);
      expect(at).toBeLessThanOrEqual(Date.now());
    });

    it('beginQuest with a saved run restores its step, tallies, scored rounds, skips and first start', () => {
      useQuestRunStore.getState().beginQuest('q', 'e', restore.stepIndex, restore);
      const s = useQuestRunStore.getState();
      expect([s.questId, s.episodeId, s.stepIndex]).toEqual(['q', 'e', 3]);
      expect([s.correctCount, s.totalCount, s.retryCount]).toEqual([2, 3, 1]);
      expect(s.scoredRounds).toEqual(['2:0', '2:1', '3:0']);
      expect(s.skippedSteps).toEqual([1]);
      expect(s.startedAt).toBe('2026-11-16T09:00:00.000Z');
      expect(s.pendingAdvance).toBe(false);
    });

    it('the step starts again, and a round scored before the reload is not scored twice', () => {
      const heard: FirstRoundAnswer[] = [];
      setFirstRoundAnswerListener((answer) => heard.push(answer));
      const store = useQuestRunStore.getState();
      store.beginQuest('q', 'e', restore.stepIndex, restore);
      // Round 0 of step 3 was missed before the reload: playing it again, right this time, is a retry.
      store.answerRound(0, true, { texts: ['배'] });
      store.answerRound(1, true, { texts: ['사과'] });
      const s = useQuestRunStore.getState();
      expect([s.correctCount, s.totalCount, s.retryCount]).toEqual([3, 4, 2]);
      expect(s.scoredRounds).toEqual(['2:0', '2:1', '3:0', '3:1']);
      // Only the new round reaches the memory store.
      expect(heard.map((a) => a.asked)).toEqual([{ texts: ['사과'] }]);
      setFirstRoundAnswerListener(null);
    });

    it('a skipped step restored still caps the stars (row AU-9)', () => {
      useQuestRunStore.getState().beginQuest('q', 'e', 3, { ...restore, correctCount: 3, scoredRounds: ['2:0', '2:1', '3:0'] });
      expect(useQuestRunStore.getState().stars()).toBe(2);
    });

    it('reset forgets the start', () => {
      useQuestRunStore.getState().beginQuest('q', 'e', 3, restore);
      useQuestRunStore.getState().reset();
      expect(useQuestRunStore.getState().startedAt).toBeNull();
      expect(useQuestRunStore.getState().scoredRounds).toEqual([]);
    });
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

  it('keeps what each round missed on the first try asked, in order, for Try these again (F-CURR-002 row CM-15)', () => {
    const store = useQuestRunStore.getState();
    store.beginQuest('quest:x', 'episode:y');
    store.answerRound(1, false, { texts: ['배'] });
    store.answerRound(1, true, { texts: ['배'] });
    store.answerRound(2, true, { texts: ['사과'] });
    store.answerRound(3, false, { jamoIds: ['jamo:g'] });
    // A miss with nothing asked (a game that names no item) leaves nothing to look at again.
    store.answerRound(4, false);
    expect(useQuestRunStore.getState().missed).toEqual([{ texts: ['배'] }, { jamoIds: ['jamo:g'] }]);
    // The score is the one it always was: Try these again never changes it.
    expect(useQuestRunStore.getState().correctCount).toBe(1);
    expect(useQuestRunStore.getState().totalCount).toBe(4);
    store.beginQuest('quest:z', 'episode:y');
    expect(useQuestRunStore.getState().missed).toEqual([]);
  });

  it('keeps every first try with its step, and what a miss asked, for adaptive pacing (F-CURR-002 row CM-24)', () => {
    const store = useQuestRunStore.getState();
    store.beginQuest('quest:x', 'episode:y', 2);
    store.answerRound(1, false, { texts: ['배'] });
    store.answerRound(1, true, { texts: ['배'] });
    store.answerRound(2, true, { texts: ['사과'] });
    store.answerRound(3, false);
    useQuestRunStore.getState().goNextStep();
    useQuestRunStore.getState().answerRound(1, true);
    expect(useQuestRunStore.getState().tries).toEqual([
      { step: 2, correct: false, asked: { texts: ['배'] } },
      { step: 2, correct: true },
      { step: 2, correct: false },
      { step: 3, correct: true },
    ]);
    useQuestRunStore.setState({ short: { step: 3, scope: { kind: 'listen-pick' } } });
    store.beginQuest('quest:z', 'episode:y');
    expect(useQuestRunStore.getState()).toMatchObject({ tries: [], short: null });
  });

  it('a first answer given with a hint showing (Story Order, row CM-34) scores as usual and reaches the memory store hinted when right', () => {
    const heard: FirstRoundAnswer[] = [];
    setFirstRoundAnswerListener((a) => heard.push(a));
    try {
      const store = useQuestRunStore.getState();
      store.beginQuest('quest:x', 'episode:y');
      store.answerRound('so:r1:0', true, { texts: ['먼저 일어나요.'] }, true);
      // Story Order passes the hint with a right answer only (a hinted answer of Dictation, row CM-31, is never wrong),
      // so its miss reaches the store as a plain miss.
      store.answerRound('so:r1:1', false, { texts: ['그다음에 세수해요.'] });
      store.answerRound('so:r1:2', true, { texts: ['그리고 밥을 먹어요.'] });
      expect(heard.map((a) => [a.correct, a.hinted ?? false])).toEqual([
        [true, true],
        [false, false],
        [true, false],
      ]);
      expect(useQuestRunStore.getState()).toMatchObject({ totalCount: 3, correctCount: 2 });
    } finally {
      setFirstRoundAnswerListener(null);
    }
  });

  it('answerAside hands a round beside the steps to the memory store, hinted and unscored', () => {
    const heard: FirstRoundAnswer[] = [];
    setFirstRoundAnswerListener((a) => heard.push(a));
    try {
      answerAside({ texts: ['배'] }, true);
      expect(heard).toEqual([]);
      useQuestRunStore.getState().beginQuest('quest:x', 'episode:y');
      answerAside({ texts: ['배'] }, true);
      expect(heard).toMatchObject([{ questId: 'quest:x', episodeId: 'episode:y', correct: true, hinted: true, asked: { texts: ['배'] } }]);
      expect(useQuestRunStore.getState()).toMatchObject({ totalCount: 0, correctCount: 0, tries: [] });
      // A wrong answer is a plain miss: a hinted answer is never wrong (logic/memory/spacing.ts).
      answerAside({ texts: ['배'] }, false);
      expect(heard[1]).toMatchObject({ correct: false });
      expect(heard[1]).not.toHaveProperty('hinted');
      setFirstRoundAnswerListener(() => {
        throw new Error('store down');
      });
      expect(() => answerAside({ texts: ['배'] }, false)).not.toThrow();
    } finally {
      setFirstRoundAnswerListener(null);
    }
  });

  it('a hinted first answer (Dictation, row CM-31) scores as given and reaches the memory store as a hinted right answer', () => {
    const heard: FirstRoundAnswer[] = [];
    setFirstRoundAnswerListener((a) => heard.push(a));
    try {
      const store = useQuestRunStore.getState();
      store.beginQuest('quest:x', 'episode:y');
      // One letter off: a missed round for the stars, a hinted answer for the memory store.
      store.answerRound(0, false, { texts: ['사과'] }, true);
      // A right answer after the hint.
      store.answerRound(1, true, { texts: ['우유'] }, true);
      // A plain answer, and a retry of round 0 that is never recorded.
      store.answerRound(2, true, { texts: ['물'] });
      store.answerRound(0, true, { texts: ['사과'] }, true);
      expect(useQuestRunStore.getState()).toMatchObject({ totalCount: 3, correctCount: 2 });
      expect(heard.map((a) => [a.correct, a.hinted])).toEqual([[true, true], [true, true], [true, undefined]]);
      expect(useQuestRunStore.getState().missed).toEqual([{ texts: ['사과'] }]);
    } finally {
      setFirstRoundAnswerListener(null);
    }
  });

  it('a first answer given with a hint showing reaches the memory store hinted when right, as a plain miss when wrong (row CM-35)', () => {
    const heard: FirstRoundAnswer[] = [];
    setFirstRoundAnswerListener((a) => heard.push(a));
    try {
      const store = useQuestRunStore.getState();
      store.beginQuest('quest:x', 'episode:y');
      store.answerRound('t1', true, { texts: ['안녕하세요!'], hinted: true });
      store.answerRound('t2', false, { texts: ['무슨 책을 찾아요?'], hinted: true });
      store.answerRound('t3', true, { texts: ['또 오세요!'] });
      expect(heard.map((a) => a.hinted)).toEqual([true, undefined, undefined]);
      expect(useQuestRunStore.getState()).toMatchObject({ totalCount: 3, correctCount: 2 });
    } finally {
      setFirstRoundAnswerListener(null);
    }
  });
});

describe('[QB] taking a step back (AMENDMENTS-QUEST-SOUND-BACK QB-2)', () => {
  beforeEach(() => {
    useQuestRunStore.getState().reset();
  });

  it('goPrevStep shows the step before and keeps the furthest step', () => {
    const { beginQuest, goNextStep, goPrevStep } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    goNextStep();
    goNextStep();
    expect(useQuestRunStore.getState()).toMatchObject({ stepIndex: 2, furthestStep: 2, cameBack: false });
    goPrevStep();
    expect(useQuestRunStore.getState()).toMatchObject({ stepIndex: 1, furthestStep: 2, cameBack: true });
    goPrevStep();
    expect(useQuestRunStore.getState()).toMatchObject({ stepIndex: 0, furthestStep: 2, cameBack: true });
  });

  it('never goes under the first step', () => {
    const { beginQuest, goPrevStep } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    goPrevStep();
    expect(useQuestRunStore.getState()).toMatchObject({ stepIndex: 0, furthestStep: 0, cameBack: false });
  });

  it('forward from a revisit is the normal step forward; the furthest step grows only past itself', () => {
    const { beginQuest, goNextStep, goPrevStep } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    goNextStep();
    goNextStep();
    goPrevStep();
    goPrevStep();
    goNextStep();
    expect(useQuestRunStore.getState()).toMatchObject({ stepIndex: 1, furthestStep: 2, cameBack: false });
    goNextStep();
    goNextStep();
    expect(useQuestRunStore.getState()).toMatchObject({ stepIndex: 3, furthestStep: 3 });
  });

  it('Previous drops a pending advance, so a game that ended a moment ago does not move the step again', () => {
    const { beginQuest, goNextStep, markStepComplete, goPrevStep, consumePendingAdvance } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    goNextStep();
    markStepComplete();
    goPrevStep();
    expect(useQuestRunStore.getState().pendingAdvance).toBe(false);
    consumePendingAdvance();
    expect(useQuestRunStore.getState().stepIndex).toBe(0);
  });

  it('a game finished on a revisit moves one step forward as usual', () => {
    const { beginQuest, goNextStep, goPrevStep, markStepComplete, consumePendingAdvance } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    goNextStep();
    goNextStep();
    goNextStep();
    goPrevStep();
    goPrevStep();
    markStepComplete();
    consumePendingAdvance();
    expect(useQuestRunStore.getState()).toMatchObject({ stepIndex: 2, furthestStep: 3, cameBack: false });
  });

  it('nothing tallied changes when a step is taken back', () => {
    const { beginQuest, goNextStep, answerRound, markStepSkipped, goPrevStep } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    goNextStep();
    answerRound(0, true);
    answerRound(1, false);
    answerRound(1, true);
    goNextStep();
    markStepSkipped();
    goNextStep();
    const before = useQuestRunStore.getState();
    goPrevStep();
    goPrevStep();
    const after = useQuestRunStore.getState();
    for (const key of ['correctCount', 'totalCount', 'retryCount', 'scoredRounds', 'skippedSteps', 'missed', 'tries'] as const) {
      expect(after[key]).toEqual(before[key]);
    }
    expect(after.stars()).toBe(before.stars());
  });

  it('a run that starts past the first step (a story bookmark) has that step as its furthest', () => {
    useQuestRunStore.getState().beginQuest('q', 'e', 2);
    expect(useQuestRunStore.getState()).toMatchObject({ stepIndex: 2, furthestStep: 2, cameBack: false });
  });

  it('a new run forgets the furthest step of the last one', () => {
    const { beginQuest, goNextStep, goPrevStep } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    goNextStep();
    goNextStep();
    goPrevStep();
    beginQuest('q2', 'e');
    expect(useQuestRunStore.getState()).toMatchObject({ stepIndex: 0, furthestStep: 0, cameBack: false });
  });
});

describe('[QB] going back changes no score (AMENDMENTS-QUEST-SOUND-BACK QB-3)', () => {
  const heard: FirstRoundAnswer[] = [];
  const asked = (id: string) => ({ texts: [id], rung: 'read' as const });
  const tallies = () => {
    const s = useQuestRunStore.getState();
    return { correct: s.correctCount, total: s.totalCount, retries: s.retryCount, scored: s.scoredRounds, missed: s.missed, tries: s.tries, skipped: s.skippedSteps, stars: s.stars() };
  };
  /** Step 1 played (2 right of 3, one retry), step 2 skipped, the run now on step 3. */
  const playedRun = (): void => {
    const { beginQuest, goNextStep, answerRound, markStepComplete, consumePendingAdvance, markStepSkipped } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    goNextStep();
    answerRound(0, true, asked('a'));
    answerRound(1, false, asked('b'));
    answerRound(1, true, asked('b'));
    answerRound(2, true, asked('c'));
    markStepComplete();
    consumePendingAdvance();
    markStepSkipped();
    goNextStep();
    heard.length = 0;
  };

  beforeEach(() => {
    useQuestRunStore.getState().reset();
    heard.length = 0;
    setFirstRoundAnswerListener((answer) => heard.push(answer));
  });
  afterEach(() => {
    setFirstRoundAnswerListener(null);
  });

  it('a game played again on a step shown after Previous adds nothing: no right answer, no miss, no retry, no memory event', () => {
    playedRun();
    const before = tallies();
    expect(before).toMatchObject({ correct: 2, total: 3, retries: 1, skipped: [2] });
    const { goPrevStep, answerRound, markStepComplete, consumePendingAdvance } = useQuestRunStore.getState();
    goPrevStep();
    goPrevStep();
    expect(useQuestRunStore.getState().stepIndex).toBe(1);
    // The same rounds again (all wrong this time, with second taps), and a round key the first play never used.
    answerRound(0, false, asked('a'));
    answerRound(0, true, asked('a'));
    answerRound(1, false, asked('b'));
    answerRound(2, false, asked('c'));
    answerRound('extra', false, asked('d'));
    answerRound('extra-2', true, asked('e'));
    markStepComplete();
    consumePendingAdvance();
    expect(tallies()).toEqual(before);
    expect(heard).toEqual([]);
    expect(useQuestRunStore.getState()).toMatchObject({ stepIndex: 2, furthestStep: 3 });
  });

  it('a better replay does not raise the stars either: the first play is the score', () => {
    const { beginQuest, goNextStep, answerRound, markStepComplete, consumePendingAdvance, goPrevStep } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    goNextStep();
    answerRound(0, false);
    answerRound(1, false);
    markStepComplete();
    consumePendingAdvance();
    const stars = useQuestRunStore.getState().stars();
    goPrevStep();
    answerRound(0, true);
    answerRound(1, true);
    expect(useQuestRunStore.getState().stars()).toBe(stars);
    expect(useQuestRunStore.getState()).toMatchObject({ correctCount: 0, totalCount: 2, retryCount: 0 });
  });

  it('a skipped step stays skipped while it is only looked at again', () => {
    playedRun();
    const { goPrevStep, goNextStep } = useQuestRunStore.getState();
    goPrevStep();
    goNextStep();
    expect(useQuestRunStore.getState().skippedSteps).toEqual([2]);
    // Any skip caps a run at 2 stars (row AU-9).
    expect(useQuestRunStore.getState().stars()).toBe(2);
  });

  it('a skipped step played on the revisit scores as a first play and is no longer skipped once it ends', () => {
    playedRun();
    const { goPrevStep, answerRound, markStepComplete, consumePendingAdvance } = useQuestRunStore.getState();
    goPrevStep();
    expect(useQuestRunStore.getState().stepIndex).toBe(2);
    answerRound(0, true, asked('x'));
    answerRound(1, false, asked('y'));
    answerRound(1, true, asked('y'));
    // Not ended yet: still a skipped step.
    expect(useQuestRunStore.getState().skippedSteps).toEqual([2]);
    markStepComplete();
    expect(useQuestRunStore.getState().skippedSteps).toEqual([]);
    consumePendingAdvance();
    expect(tallies()).toMatchObject({ correct: 3, total: 5, retries: 2, skipped: [] });
    expect(heard.map((a) => [a.asked.texts?.[0], a.correct])).toEqual([
      ['x', true],
      ['y', false],
    ]);
    expect(useQuestRunStore.getState().missed).toHaveLength(2);
    expect(useQuestRunStore.getState()).toMatchObject({ stepIndex: 3, furthestStep: 3 });
  });

  it('once it was played, the step that had been skipped scores nothing on a second replay', () => {
    playedRun();
    const { goPrevStep, answerRound, markStepComplete, consumePendingAdvance } = useQuestRunStore.getState();
    goPrevStep();
    answerRound(0, true);
    markStepComplete();
    consumePendingAdvance();
    const before = tallies();
    goPrevStep();
    answerRound(0, false);
    answerRound(5, true);
    expect(tallies()).toEqual(before);
  });

  it('the furthest step itself still scores after a look back: a game left open is taken up again', () => {
    const { beginQuest, goNextStep, answerRound, goPrevStep } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    goNextStep();
    answerRound(0, true);
    goPrevStep();
    answerRound(9, true);
    expect(useQuestRunStore.getState().totalCount).toBe(1);
    goNextStep();
    answerRound(1, false);
    answerRound(0, true);
    expect(useQuestRunStore.getState()).toMatchObject({ correctCount: 1, totalCount: 2, retryCount: 1 });
  });

  it('markStepComplete leaves the skipped steps alone when the step on screen was not one', () => {
    const { beginQuest, goNextStep, markStepSkipped, markStepComplete } = useQuestRunStore.getState();
    beginQuest('q', 'e');
    markStepSkipped();
    goNextStep();
    const before = useQuestRunStore.getState().skippedSteps;
    markStepComplete();
    expect(useQuestRunStore.getState().skippedSteps).toBe(before);
  });

  describe('step events once per step per run', () => {
    it('reportOnce answers yes the first time for an event of a step, then no', () => {
      const { beginQuest, reportOnce } = useQuestRunStore.getState();
      beginQuest('q', 'e');
      expect(reportOnce('quest.discover_completed', 1)).toBe(true);
      expect(reportOnce('quest.discover_completed', 1)).toBe(false);
      expect(reportOnce('quest.discover_completed', 2)).toBe(true);
      expect(reportOnce('minigame.finished', 1)).toBe(true);
      expect(useQuestRunStore.getState().reported).toEqual(['quest.discover_completed:1', 'quest.discover_completed:2', 'minigame.finished:1']);
    });

    it('a new run reports again; with no run nothing is noted', () => {
      const { beginQuest, reportOnce, reset } = useQuestRunStore.getState();
      beginQuest('q', 'e');
      reportOnce('minigame.finished', 2);
      beginQuest('q', 'e');
      expect(useQuestRunStore.getState().reportOnce('minigame.finished', 2)).toBe(true);
      reset();
      expect(useQuestRunStore.getState().reportOnce('minigame.finished', 2)).toBe(true);
      expect(useQuestRunStore.getState().reportOnce('minigame.finished', 2)).toBe(true);
      expect(useQuestRunStore.getState().reported).toEqual([]);
    });

    it('minigame.finished: sent on the first play, not for a game played again, and for a skipped game played after all', () => {
      const { beginQuest, goNextStep, goPrevStep, markStepSkipped } = useQuestRunStore.getState();
      beginQuest('q', 'e');
      goNextStep();
      expect(gameFinishIsReported('q', 1)).toBe(true);
      goNextStep();
      markStepSkipped();
      goNextStep();
      goPrevStep();
      goPrevStep();
      expect(gameFinishIsReported('q', 1)).toBe(false);
      expect(gameFinishIsReported('q', 2)).toBe(true);
      expect(gameFinishIsReported('q', 2)).toBe(false);
    });

    it('minigame.finished on the furthest step is sent each time, as before (a story told in parts)', () => {
      const { beginQuest, goNextStep } = useQuestRunStore.getState();
      beginQuest('q', 'e');
      goNextStep();
      expect(gameFinishIsReported('q', 1)).toBe(true);
      expect(gameFinishIsReported('q', 1)).toBe(true);
    });

    it('a game of another quest than the run in the store is not counted', () => {
      useQuestRunStore.getState().beginQuest('q', 'e');
      expect(gameFinishIsReported('other', 0)).toBe(true);
      expect(gameFinishIsReported('other', 0)).toBe(true);
      expect(useQuestRunStore.getState().reported).toEqual([]);
    });
  });

  // [LR] AMENDMENTS-QUEST-LEAVE-RESUME LR-1 (section 3.1): the counter a game's back guard reads. Never saved, scored or sent.
  describe('answersGiven', () => {
    it('rises on a first try, a retry and a hinted answer', () => {
      const { beginQuest, answerRound } = useQuestRunStore.getState();
      beginQuest('q', 'e');
      expect(useQuestRunStore.getState().answersGiven).toBe(0);
      answerRound('a', false);
      expect(useQuestRunStore.getState().answersGiven).toBe(1);
      answerRound('a', true);
      expect(useQuestRunStore.getState().answersGiven).toBe(2);
      answerRound('b', true, undefined, true);
      expect(useQuestRunStore.getState().answersGiven).toBe(3);
    });

    it('rises on an answer given on a revisit, which scores nothing', () => {
      const { beginQuest, answerRound, goNextStep, goPrevStep } = useQuestRunStore.getState();
      beginQuest('q', 'e');
      answerRound('a', true);
      goNextStep();
      goPrevStep();
      const before = useQuestRunStore.getState();
      answerRound('a', false);
      const after = useQuestRunStore.getState();
      expect(after.answersGiven).toBe(before.answersGiven + 1);
      expect(after.totalCount).toBe(before.totalCount);
    });

    it('beginQuest and reset set it to 0', () => {
      const { beginQuest, answerRound, reset } = useQuestRunStore.getState();
      beginQuest('q', 'e');
      answerRound('a', true);
      beginQuest('q2', 'e');
      expect(useQuestRunStore.getState().answersGiven).toBe(0);
      answerRound('a', true);
      reset();
      expect(useQuestRunStore.getState().answersGiven).toBe(0);
    });

    it('is never saved with the run', () => {
      const { beginQuest, answerRound } = useQuestRunStore.getState();
      beginQuest('q', 'e');
      answerRound('a', true);
      const saved = savedRunOf(useQuestRunStore.getState(), [{ id: 's0', kind: 'discover' }]);
      expect(saved).not.toBeNull();
      expect(JSON.stringify(saved)).not.toContain('answersGiven');
    });
  });
});
