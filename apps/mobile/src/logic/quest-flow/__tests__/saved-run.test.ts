import { describe, expect, it } from 'vitest';
import { SAVED_RUN_MAX_AGE_MS, resumableRun, savedRunOf, stepsSignature, type RunToSave } from '../saved-run';

/** [AU] AMENDMENTS-AUDIT-2026-11 row AU-12: a quest left by a reload continues where it stopped. */
const steps = [
  { id: 's1', kind: 'intro' },
  { id: 's2', kind: 'discover' },
  { id: 's3', kind: 'practice', minigameRef: 'minigame:a' },
  { id: 's4', kind: 'apply', minigameRef: 'minigame:b' },
  { id: 's5', kind: 'check', minigameRef: 'minigame:c' },
  { id: 's6', kind: 'reward' },
] as const;
const quest = { id: 'quest:q1', steps };
const STARTED = '2026-11-16T09:00:00.000Z';
const NOW = Date.parse('2026-11-16T10:00:00.000Z');

const run: RunToSave = {
  questId: 'quest:q1',
  episodeId: 'episode:e1',
  stepIndex: 4,
  correctCount: 3,
  totalCount: 4,
  retryCount: 2,
  scoredRounds: ['2:0', '2:1', '2:2', '2:3'],
  skippedSteps: [3],
  startedAt: STARTED,
};
const saved = savedRunOf(run, steps)!;

describe('stepsSignature', () => {
  it('names every step with its kind and game, in order', () => {
    expect(stepsSignature(steps)).toBe('s1:intro:|s2:discover:|s3:practice:minigame:a|s4:apply:minigame:b|s5:check:minigame:c|s6:reward:');
  });

  it('changes when a step is added, removed, moved or plays another game', () => {
    const base = stepsSignature(steps);
    expect(stepsSignature(steps.slice(1))).not.toBe(base);
    expect(stepsSignature([...steps, { id: 's7', kind: 'reward' }])).not.toBe(base);
    expect(stepsSignature([steps[1], steps[0], ...steps.slice(2)])).not.toBe(base);
    expect(stepsSignature(steps.map((s) => (s.id === 's3' ? { ...s, minigameRef: 'minigame:z' } : s)))).not.toBe(base);
  });
});

describe('savedRunOf', () => {
  it('keeps the least a run needs to go on: quest, step, tallies, scored rounds, skips and its start', () => {
    expect(saved).toEqual({
      v: 1,
      questId: 'quest:q1',
      episodeId: 'episode:e1',
      steps: stepsSignature(steps),
      stepIndex: 4,
      correctCount: 3,
      totalCount: 4,
      retryCount: 2,
      scoredRounds: ['2:0', '2:1', '2:2', '2:3'],
      skippedSteps: [3],
      startedAt: STARTED,
    });
  });

  it('copies the lists, so a later answer never changes what was stored', () => {
    expect(saved.scoredRounds).not.toBe(run.scoredRounds);
    expect(saved.skippedSteps).not.toBe(run.skippedSteps);
  });

  it('a store with no run stores nothing', () => {
    expect(savedRunOf({ ...run, questId: null }, steps)).toBeNull();
    expect(savedRunOf({ ...run, episodeId: null }, steps)).toBeNull();
    expect(savedRunOf({ ...run, startedAt: null }, steps)).toBeNull();
  });
});

describe('resumableRun', () => {
  it('the same quest within 24 hours goes on from the saved step with its tallies', () => {
    expect(resumableRun(saved, quest, NOW)).toEqual({
      stepIndex: 4,
      correctCount: 3,
      totalCount: 4,
      retryCount: 2,
      scoredRounds: ['2:0', '2:1', '2:2', '2:3'],
      skippedSteps: [3],
      startedAt: STARTED,
    });
  });

  it('survives the trip through storage (JSON)', () => {
    expect(resumableRun(JSON.parse(JSON.stringify(saved)), quest, NOW)).toMatchObject({ stepIndex: 4, totalCount: 4 });
  });

  it('24 hours after its start is still resumed; a moment later it is not', () => {
    const started = Date.parse(STARTED);
    expect(resumableRun(saved, quest, started + SAVED_RUN_MAX_AGE_MS)).not.toBeNull();
    expect(resumableRun(saved, quest, started + SAVED_RUN_MAX_AGE_MS + 1)).toBeNull();
  });

  it('a clock set back a little keeps the run; a start more than a day ahead does not', () => {
    const started = Date.parse(STARTED);
    expect(resumableRun(saved, quest, started - 60_000)).not.toBeNull();
    expect(resumableRun(saved, quest, started - SAVED_RUN_MAX_AGE_MS - 1)).toBeNull();
  });

  it('a run of another quest is not resumed', () => {
    expect(resumableRun(saved, { id: 'quest:q2', steps }, NOW)).toBeNull();
  });

  it('a content update that changed the step list discards the run', () => {
    expect(resumableRun(saved, { id: 'quest:q1', steps: steps.slice(0, 5) }, NOW)).toBeNull();
    expect(resumableRun(saved, { id: 'quest:q1', steps: steps.map((s) => (s.id === 's5' ? { ...s, minigameRef: 'minigame:new' } : s)) }, NOW)).toBeNull();
  });

  it('nothing stored, or a value that is not a saved run, starts fresh', () => {
    for (const value of [null, undefined, 'x', 3, [], {}, { ...saved, v: 2 }, { ...saved, startedAt: 'soon' }, { ...saved, startedAt: 5 }]) {
      expect(resumableRun(value, quest, NOW), JSON.stringify(value)).toBeNull();
    }
  });

  it('numbers that are not a run are dropped, never repaired', () => {
    const bad = [
      { stepIndex: 6 },
      { stepIndex: -1 },
      { stepIndex: 1.5 },
      { stepIndex: '4' },
      { correctCount: 5 },
      { correctCount: -1 },
      { totalCount: 3 },
      { retryCount: Number.NaN },
      { scoredRounds: ['2:0', '2:1', '2:2'] },
      { scoredRounds: ['2:0', '2:0', '2:1', '2:2'] },
      { scoredRounds: ['2:0', '2:1', '2:2', 3] },
      { scoredRounds: 'x' },
      { skippedSteps: [4] },
      { skippedSteps: [-1] },
      { skippedSteps: 'x' },
    ];
    for (const over of bad) expect(resumableRun({ ...saved, ...over }, quest, NOW), JSON.stringify(over)).toBeNull();
  });

  it('a run saved on its first step is resumed there with nothing scored', () => {
    const first = savedRunOf({ ...run, stepIndex: 0, correctCount: 0, totalCount: 0, retryCount: 0, scoredRounds: [], skippedSteps: [] }, steps);
    expect(resumableRun(first, quest, NOW)).toEqual({ stepIndex: 0, correctCount: 0, totalCount: 0, retryCount: 0, scoredRounds: [], skippedSteps: [], startedAt: STARTED });
  });

  it('a skip listed twice is restored once', () => {
    expect(resumableRun({ ...saved, skippedSteps: [3, 3] }, quest, NOW)?.skippedSteps).toEqual([3]);
  });
});

describe('[QB] the saved run follows the furthest step (AMENDMENTS-QUEST-SOUND-BACK QB-4)', () => {
  it('stores the furthest step, not the step shown after Previous', () => {
    const back = savedRunOf({ ...run, stepIndex: 2, furthestStep: 4 }, steps)!;
    expect(back.stepIndex).toBe(4);
    expect(back).toEqual(saved);
  });

  it('so a reload after going back resumes at the furthest step, with the skipped step still behind it', () => {
    const back = savedRunOf({ ...run, stepIndex: 1, furthestStep: 4 }, steps);
    expect(resumableRun(JSON.parse(JSON.stringify(back)), quest, NOW)).toMatchObject({ stepIndex: 4, skippedSteps: [3], totalCount: 4 });
  });

  it('a run that never went back stores the step on screen, as before', () => {
    expect(savedRunOf({ ...run, furthestStep: 4 }, steps)!.stepIndex).toBe(4);
    expect(savedRunOf(run, steps)!.stepIndex).toBe(4);
  });

  it('a skipped step played after all on a revisit is stored as not skipped, with its rounds', () => {
    const played = savedRunOf({ ...run, stepIndex: 4, furthestStep: 4, skippedSteps: [], correctCount: 5, totalCount: 6, scoredRounds: [...run.scoredRounds, '3:0', '3:1'] }, steps);
    expect(resumableRun(played, quest, NOW)).toMatchObject({ stepIndex: 4, skippedSteps: [], correctCount: 5, totalCount: 6 });
  });

  it('keeps the step events already sent, and leaves the field out while there is none', () => {
    expect('reported' in saved).toBe(false);
    expect('reported' in savedRunOf({ ...run, reported: [] }, steps)!).toBe(false);
    const sent = ['quest.discover_completed:1', 'minigame.finished:2'];
    const withEvents = savedRunOf({ ...run, reported: sent }, steps)!;
    expect(withEvents.reported).toEqual(sent);
    expect(withEvents.reported).not.toBe(sent);
    expect(resumableRun(JSON.parse(JSON.stringify(withEvents)), quest, NOW)?.reported).toEqual(sent);
  });

  it('a value stored before this row (no events field) is still resumed', () => {
    const restored = resumableRun(saved, quest, NOW);
    expect(restored).not.toBeNull();
    expect(restored && 'reported' in restored).toBe(false);
  });

  it('an events field that is not a list of strings is dropped with the run, never repaired', () => {
    for (const reported of ['x', 3, [1], [null], {}]) expect(resumableRun({ ...saved, reported }, quest, NOW), JSON.stringify(reported)).toBeNull();
    expect(resumableRun({ ...saved, reported: ['a:1', 'a:1'] }, quest, NOW)?.reported).toEqual(['a:1']);
  });
});

