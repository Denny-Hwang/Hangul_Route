import type { QuestProgress } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { questById } from '../../../content';
import { awardWorld } from '../../../content/award-world';
import { episodeById } from '../../../content/episodes';
import { cardById } from '../../../content/heritage-cards';
import { completesEpisode } from '../reward-card-note';

/** Whether finishing a quest finishes its episode (OW-3): the reward step then never calls the quest's card waiting. */
const done = (questId: string, episodeId: string): QuestProgress => ({
  questId,
  episodeId,
  startedAt: '2026-10-05T10:00:00.000Z',
  completedAt: '2026-10-05T10:00:00.000Z',
  stars: 1,
  attempts: 1,
  accuracy: 0.4,
});

describe('completesEpisode', () => {
  const RITES = 'episode:stage1-rites';
  const [q1, q2, q3] = ['quest:stage1-rites-q1', 'quest:stage1-rites-q2', 'quest:stage1-rites-q3'] as const;

  it('is false while another required quest of the episode is open', () => {
    expect(completesEpisode({ quests: [] }, RITES, q1)).toBe(false);
    expect(completesEpisode({ quests: [done(q2, RITES)] }, RITES, q1)).toBe(false);
  });

  it('is true for the last open quest of the episode, and when the quest is already recorded as done', () => {
    expect(completesEpisode({ quests: [done(q1, RITES), done(q2, RITES)] }, RITES, q3)).toBe(true);
    expect(completesEpisode({ quests: [done(q1, RITES), done(q2, RITES), done(q3, RITES)] }, RITES, q3)).toBe(true);
  });

  it('is false with no snapshot yet, an unknown episode, or a quest that is not in the episode', () => {
    expect(completesEpisode(undefined, RITES, q1)).toBe(false);
    expect(completesEpisode({ quests: [] }, 'episode:nope', q1)).toBe(false);
    expect(completesEpisode({ quests: [done(q1, RITES), done(q2, RITES)] }, RITES, 'quest:stage1-life-q1')).toBe(false);
  });

  it('is true for a one-quest shelf episode: its quest is the whole episode', () => {
    const quest = questById('quest:story-sun-and-moon-listen');
    expect(quest?.rewardCardId).toBeDefined();
    const card = cardById(quest!.rewardCardId!);
    const episode = episodeById(card!.unlockedBy);
    expect(episode?.questIds).toEqual([quest!.id]);
    expect(completesEpisode(undefined, episode!.id, quest!.id)).toBe(true);
  });

  it('holds for every shipped quest card: a quest alone in its episode completes it', () => {
    for (const quest of awardWorld.quests) {
      const card = quest.rewardCardId === undefined ? undefined : cardById(quest.rewardCardId);
      const episode = card && episodeById(card.unlockedBy);
      if (!episode || episode.questIds.length !== 1) continue;
      expect(completesEpisode({ quests: [] }, episode.id, quest.id), quest.id).toBe(true);
    }
  });
});
