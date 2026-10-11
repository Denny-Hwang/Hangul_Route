import type { Episode } from '@hangul-route/content-schema';
import { LOCALES, findBannedWord, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { canAssignQuest, type GateRejection } from '../gating';

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
    expect(result.learnerName).toBe('Suni');
    expect(getMessages('en').caregiver.gating['stage-locked'](result.learnerName ?? '')).toBe(
      "Suni hasn't reached this quest yet.",
    );
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

  it('returns codes and the learner name, never prose (F-I18N-001 §3.4 rule 3)', () => {
    const result = canAssignQuest({ ...base, questId: 'quest:b', learnerName: 'Jin' });
    expect(result).toEqual({ allowed: false, reason: 'stage-locked', learnerName: 'Jin' });
    expect(result).not.toHaveProperty('message');
    expect(canAssignQuest({ ...base, questId: 'quest:nope' })).toEqual({
      allowed: false,
      reason: 'unknown-quest',
      learnerName: 'Suni',
    });
  });

  it('the screen renders the reason through the dictionary, naming the learner', () => {
    const result = canAssignQuest({ ...base, questId: 'quest:b', learnerName: 'Jin' });
    expect(getMessages('en').caregiver.gating[result.reason ?? 'unknown-quest']('Jin')).toContain('Jin');
  });

  const REASONS: GateRejection[] = ['unknown-quest', 'episode-not-shipped', 'stage-locked'];

  for (const locale of LOCALES) {
    it(`${locale}: every rejection message is caregiver-safe and has no Hangul outside ko`, () => {
      const gating = getMessages(locale).caregiver.gating;
      for (const reason of REASONS) {
        const message = gating[reason]('Suni');
        expect(message.length).toBeGreaterThan(0);
        expect(findBannedWord(message, locale, 'caregiver'), message).toBeNull();
        // CLAUDE.md §8 and F-I18N-001 §3.4 rule 5: en and es hold no Hangul at all.
        if (locale !== 'ko') expect(message).not.toMatch(/[가-힣]/);
      }
    });
  }
});
