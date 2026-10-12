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

  describe('quest access (F-ENT-003 section 3.6)', () => {
    const closedB = (questId: string): boolean => questId !== 'quest:b';
    const allStages = { ...base, unlockedStages: ['stage1', 'stage2'] };

    it('omitted: every quest is open, as before', () => {
      expect(canAssignQuest({ ...allStages, questId: 'quest:b' })).toEqual({ allowed: true });
      expect(canAssignQuest({ ...allStages, questId: 'quest:b', isQuestOpen: undefined })).toEqual({ allowed: true });
    });

    it('rejects a closed quest with `quest-closed` and the learner name', () => {
      expect(canAssignQuest({ ...allStages, questId: 'quest:b', isQuestOpen: closedB })).toEqual({
        allowed: false,
        reason: 'quest-closed',
        learnerName: 'Suni',
      });
    });

    it('allows an open quest', () => {
      expect(canAssignQuest({ ...allStages, questId: 'quest:a', isQuestOpen: closedB })).toEqual({ allowed: true });
    });

    it('names the plan when the learner could reach the stage but the quest is closed (switch on)', () => {
      expect(canAssignQuest({ ...base, questId: 'quest:b', isQuestOpen: closedB }).reason).toBe('quest-closed');
    });

    it('an open quest in a stage the learner has not reached stays `stage-locked` (a kept quest, or the switch off)', () => {
      expect(canAssignQuest({ ...base, questId: 'quest:b', isQuestOpen: () => true }).reason).toBe('stage-locked');
    });

    it('unknown and unbuilt quests keep their own reasons', () => {
      const closed = (): boolean => false;
      expect(canAssignQuest({ ...base, questId: 'quest:nope', isQuestOpen: closed }).reason).toBe('unknown-quest');
      expect(canAssignQuest({ ...base, questId: 'quest:c', isQuestOpen: closed }).reason).toBe('episode-not-shipped');
    });

    it('the caregiver line names the products, with no price', () => {
      const line = getMessages('en').caregiver.gating['quest-closed']('Suni');
      expect(line).toBe('Suni can play this lesson with the Family Plan or a Group License.');
      expect(line).not.toMatch(/[$€£]|\d|premium|buy|trial|locked/i);
    });
  });

  const REASONS: GateRejection[] = ['unknown-quest', 'episode-not-shipped', 'stage-locked', 'quest-closed'];

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
