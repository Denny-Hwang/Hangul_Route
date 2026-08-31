import type { Episode } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { isLearnerSafe } from '../banned-text';
import { canAssignQuest } from '../gating';

function episode(
  id: string,
  stage: Episode['stage'],
  questIds: string[],
  status: Episode['status'] = 'shipped',
): Episode {
  return {
    id,
    stage,
    theme: 'letters',
    order: 1,
    titleEn: 'Ep',
    hoyaIntroEn: 'Hi',
    questIds,
    rewardCardIds: [],
    estimatedMinutes: 10,
    status,
  };
}

const EPISODES = [
  episode('episode:s1', 'stage1', ['quest:a']),
  episode('episode:s2', 'stage2', ['quest:b']),
  episode('episode:s1-draft', 'stage1', ['quest:c'], 'preview'),
];

const base = { episodes: EPISODES, unlockedStages: ['stage1'], learnerName: 'Suni' };

describe('canAssignQuest (F-HW-001 §3.4)', () => {
  it('allows a quest in an unlocked, shipped episode', () => {
    expect(canAssignQuest({ ...base, questId: 'quest:a' })).toEqual({ allowed: true });
  });

  it('rejects a quest in a stage the learner has not reached', () => {
    const result = canAssignQuest({ ...base, questId: 'quest:b' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('stage-locked');
    expect(result.message).toBe("Suni hasn't reached this quest yet.");
  });

  it('rejects a quest in an episode that is still a placeholder', () => {
    const result = canAssignQuest({ ...base, questId: 'quest:c' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('episode-not-shipped');
  });

  it('rejects an unknown quest id', () => {
    const result = canAssignQuest({ ...base, questId: 'quest:nope' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('unknown-quest');
  });

  it('names the learner so the caregiver knows who is blocked', () => {
    const result = canAssignQuest({ ...base, questId: 'quest:b', learnerName: 'Jin' });
    expect(result.message).toContain('Jin');
  });

  it('caregiver messages are English and carry no shaming word', () => {
    for (const questId of ['quest:b', 'quest:c', 'quest:nope']) {
      const { message } = canAssignQuest({ ...base, questId });
      expect(message).toBeDefined();
      // CLAUDE.md §8 — UI copy is English, never Korean.
      expect(message!).not.toMatch(/[가-힣]/);
      expect(isLearnerSafe(message!)).toBe(true);
    }
  });
});
