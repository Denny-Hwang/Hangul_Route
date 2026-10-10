import { describe, expect, it } from 'vitest';
import { completionState, completionTransition, isStageComplete } from '../completion';
import { episodeOf, snapshotWith } from './fixtures';

const E1 = episodeOf('episode:one', ['quest:a', 'quest:b']);
const E2 = episodeOf('episode:two', ['quest:c'], { theme: 'life' });
const E_PREVIEW = episodeOf('episode:soon', ['quest:p'], { theme: 'rites', status: 'preview' });
const E_STAGE2 = episodeOf('episode:s2', ['quest:s2'], { stage: 'stage2', theme: 'life' });
const EPISODES = [E1, E2, E_PREVIEW, E_STAGE2];

const A = { questId: 'quest:a', episodeId: 'episode:one' };
const B = { questId: 'quest:b', episodeId: 'episode:one' };
const C = { questId: 'quest:c', episodeId: 'episode:two' };

describe('isStageComplete', () => {
  it('is false for a fresh learner', () => {
    expect(isStageComplete('stage1', EPISODES, snapshotWith([]))).toBe(false);
  });

  it('is false while any grid episode is unfinished', () => {
    expect(isStageComplete('stage1', EPISODES, snapshotWith([A, B]))).toBe(false);
    expect(isStageComplete('stage1', EPISODES, snapshotWith([A, C]))).toBe(false);
  });

  it('is true once every quest of every grid episode has a completedAt, in any order', () => {
    expect(isStageComplete('stage1', EPISODES, snapshotWith([C, B, A]))).toBe(true);
  });

  it('counts a 1-star completion', () => {
    const snap = snapshotWith([
      { ...A, stars: 1 },
      { ...B, stars: 1 },
      { ...C, stars: 1 },
    ]);
    expect(isStageComplete('stage1', EPISODES, snap)).toBe(true);
  });

  it('does not count a quest that was started but not completed', () => {
    expect(isStageComplete('stage1', EPISODES, snapshotWith([A, B], [C]))).toBe(false);
  });

  it('ignores preview episodes and other stages', () => {
    expect(isStageComplete('stage1', [E1, E_PREVIEW, E_STAGE2], snapshotWith([A, B]))).toBe(true);
  });

  it('is false for a stage with no grid episode', () => {
    expect(isStageComplete('stage3', EPISODES, snapshotWith([A, B, C]))).toBe(false);
    expect(isStageComplete('stage1', [E_PREVIEW], snapshotWith([]))).toBe(false);
  });
});

describe('completionState', () => {
  it('lists completed grid episodes of the stage and the stage flag', () => {
    expect(completionState('stage1', EPISODES, snapshotWith([A, B]))).toEqual({
      completedEpisodeIds: ['episode:one'],
      stageComplete: false,
    });
    expect(completionState('stage1', EPISODES, snapshotWith([A, B, C]))).toEqual({
      completedEpisodeIds: ['episode:one', 'episode:two'],
      stageComplete: true,
    });
  });
});

describe('completionTransition', () => {
  const state = (done: Array<typeof A>) => completionState('stage1', EPISODES, snapshotWith(done));

  it('reports nothing when nothing changed', () => {
    expect(completionTransition(state([A]), state([A]))).toEqual({
      episodesJustCompleted: [],
      stageJustCompleted: false,
    });
  });

  it('reports an episode that completed with this write, but not the stage', () => {
    expect(completionTransition(state([A]), state([A, B]))).toEqual({
      episodesJustCompleted: ['episode:one'],
      stageJustCompleted: false,
    });
  });

  it('reports the stage when the last missing quest completes, out of order', () => {
    expect(completionTransition(state([C, A]), state([C, A, B]))).toEqual({
      episodesJustCompleted: ['episode:one'],
      stageJustCompleted: true,
    });
  });

  it('can complete two episodes and the stage in one write', () => {
    expect(completionTransition(state([]), state([A, B, C]))).toEqual({
      episodesJustCompleted: ['episode:one', 'episode:two'],
      stageJustCompleted: true,
    });
  });

  it('announces nothing when an already finished stage is replayed', () => {
    expect(completionTransition(state([A, B, C]), state([A, B, C]))).toEqual({
      episodesJustCompleted: [],
      stageJustCompleted: false,
    });
  });
});
