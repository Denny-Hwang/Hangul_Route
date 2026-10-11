import type { Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../content';
import { cardEarnHint } from '../card-earn';
import { CARD_UNLOCK_MIN_STARS } from '../reward';
import { episodeOf, plainQuest } from '../stage1/__tests__/fixtures';

const reward = (id: string, cardId: string, title = `Title ${id}`): Quest => ({ ...plainQuest(id), titleEn: title, rewardCardId: cardId });

const QUESTS: Quest[] = [
  plainQuest('quest:a'),
  reward('quest:b', 'card:book', 'Meet the book'),
  reward('quest:c', 'card:book', 'Second book quest'),
  reward('quest:soon', 'card:soon'),
];
const EPISODES = [
  episodeOf('episode:one', ['quest:a', 'quest:b', 'quest:c']),
  episodeOf('episode:soon', ['quest:soon'], { theme: 'rites', status: 'preview' }),
];

/** F-LAYOUT-001 §3.6: a locked card in the Library pane says how it is earned (wireframe layout/wide D). */
describe('cardEarnHint', () => {
  it('names the first playable quest that awards the card, and the stars it takes', () => {
    expect(cardEarnHint('card:book', QUESTS, EPISODES)).toEqual({
      kind: 'quest',
      questId: 'quest:b',
      questTitle: 'Meet the book',
      minStars: CARD_UNLOCK_MIN_STARS,
    });
  });

  it('says "later" for a card no quest awards yet', () => {
    expect(cardEarnHint('card:nobody', QUESTS, EPISODES)).toEqual({ kind: 'later' });
  });

  it('never points at a quest inside a preview placeholder episode', () => {
    expect(cardEarnHint('card:soon', QUESTS, EPISODES)).toEqual({ kind: 'later' });
  });

  it('never points a learner at a quest in a stage they cannot open (no implicit paywall, D5)', () => {
    const premiumOnly = [episodeOf('episode:prem', ['quest:b', 'quest:c'], { stage: 'stage2' })];
    expect(cardEarnHint('card:book', QUESTS, premiumOnly, (stage) => stage === 'stage1')).toEqual({ kind: 'later' });
    expect(cardEarnHint('card:book', QUESTS, premiumOnly, () => true)).toMatchObject({ kind: 'quest', questId: 'quest:b' });
  });

  it('matches the shipped content: the Book card comes from the first Letters quest', () => {
    const hint = cardEarnHint('card:book', questsAll, episodesAll);
    expect(hint).toMatchObject({ kind: 'quest', questId: 'quest:stage1-letters-q1', minStars: 2 });
  });
});
