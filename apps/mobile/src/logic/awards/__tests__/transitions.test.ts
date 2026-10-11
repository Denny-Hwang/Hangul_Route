import { describe, expect, it } from 'vitest';
import * as completion from '../../stage1/completion';
import { completedEpisodes, isStageComplete } from '../derive';
import { completionState, completionTransition, stageCompleteFor } from '../transitions';
import { done, EPISODES, snapshot, T1, T2, T3, WORLD } from './fixtures';

/**
 * F-STORY-006 §3.4: the stage rule has one owner. F-QUEST-002's
 * `logic/stage1/completion.ts` re-exports these, so the Results ceremony and
 * the stage cards can never disagree.
 */

const STAGE1_ALL = snapshot({ quests: [done('quest:l1', 1, T1), done('quest:l2', 3, T3), done('quest:f1', 2, T2)] });

describe('completionState', () => {
  it('lists the complete grid episodes of the stage in content order, never a story shelf episode', () => {
    const s = snapshot({ quests: [done('quest:f1', 3, T2), done('quest:story-sun-and-moon-a1', 3, T1)] });
    expect(completionState('stage1', EPISODES, s)).toEqual({ completedEpisodeIds: ['episode:stage1-life'], stageComplete: false });
    expect(completionState('stage1', EPISODES, STAGE1_ALL)).toEqual({
      completedEpisodeIds: ['episode:stage1-letters', 'episode:stage1-life'],
      stageComplete: true,
    });
  });

  it('stage 2 never completes while it has a placeholder, even when its only shipped episode is done', () => {
    const s = snapshot({ quests: [done('quest:w1', 3)] });
    expect(completionState('stage2', EPISODES, s)).toEqual({ completedEpisodeIds: ['episode:stage2-life'], stageComplete: false });
    expect(stageCompleteFor('stage2', EPISODES, s)).toBe(false);
  });

  it('agrees with the award engine for every stage', () => {
    const map = completedEpisodes(WORLD, STAGE1_ALL);
    for (const stage of ['stage1', 'stage2', 'stage3', 'stage4'] as const) {
      expect(stageCompleteFor(stage, EPISODES, STAGE1_ALL)).toBe(isStageComplete(stage, WORLD, map).complete);
    }
  });
});

describe('completionTransition', () => {
  it('reports the episodes and the stage that one write completed, and nothing on a replay', () => {
    const before = completionState('stage1', EPISODES, snapshot({ quests: [done('quest:l1', 3), done('quest:f1', 3)] }));
    const after = completionState('stage1', EPISODES, STAGE1_ALL);
    expect(completionTransition(before, after)).toEqual({ episodesJustCompleted: ['episode:stage1-letters'], stageJustCompleted: true });
    expect(completionTransition(after, after)).toEqual({ episodesJustCompleted: [], stageJustCompleted: false });
  });
});

describe('logic/stage1/completion.ts', () => {
  it('is a thin re-export of the award transitions (one stage rule)', () => {
    expect(completion.completionState).toBe(completionState);
    expect(completion.completionTransition).toBe(completionTransition);
    expect(completion.isStageComplete).toBe(stageCompleteFor);
  });
});
