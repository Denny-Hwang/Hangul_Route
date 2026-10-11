import type { Episode, HeritageCard, ProgressSnapshot, QuestProgress } from '@hangul-route/content-schema';
import type { AwardWorld, CardSet } from '../types';

/**
 * A small award world for the engine tests (F-STORY-006 §5): two stage 1 grid
 * episodes, a stage 1 story shelf episode (which never counts toward the
 * stage), a shipped stage 2 episode beside a stage 2 placeholder (so stage 2
 * never completes), a stage 3 placeholder with a card on it, a welcome card,
 * stage cards and one set.
 */
export const PROFILE = { createdAt: '2026-09-01T00:00:00.000Z' };
export const T1 = '2026-09-10T00:00:00.000Z';
export const T2 = '2026-09-11T00:00:00.000Z';
export const T3 = '2026-09-12T00:00:00.000Z';
export const T4 = '2026-09-13T00:00:00.000Z';
export const NOW = '2026-10-11T00:00:00.000Z';

const episode = (over: Partial<Episode> & Pick<Episode, 'id' | 'stage' | 'theme' | 'questIds' | 'rewardCardIds'>): Episode => ({
  order: 1,
  titleEn: over.id,
  hoyaIntroEn: 'Hi!',
  estimatedMinutes: 10,
  status: 'shipped',
  ...over,
});

export const EPISODES: Episode[] = [
  episode({ id: 'episode:stage1-letters', stage: 'stage1', theme: 'letters', titleEn: 'Meet the Letters', questIds: ['quest:l1', 'quest:l2'], rewardCardIds: ['card:book', 'card:hanji'] }),
  episode({ id: 'episode:stage1-life', stage: 'stage1', theme: 'life', titleEn: 'Around the Korean Table', questIds: ['quest:f1'], rewardCardIds: ['card:rice'] }),
  episode({
    id: 'episode:shelf-sun-and-moon',
    stage: 'stage1',
    theme: 'nature',
    titleEn: 'The Sun and the Moon',
    questIds: ['quest:story-sun-and-moon-a1'],
    rewardCardIds: ['card:story-sun-and-moon'],
    status: 'ready',
    format: 'story',
    placement: 'shelf',
  }),
  episode({ id: 'episode:stage2-life', stage: 'stage2', theme: 'life', titleEn: 'Lunch Box Words', questIds: ['quest:w1'], rewardCardIds: ['card:apple'] }),
  episode({ id: 'episode:stage2-nature', stage: 'stage2', theme: 'nature', questIds: [], rewardCardIds: [], status: 'preview' }),
  episode({ id: 'episode:stage3-letters', stage: 'stage3', theme: 'letters', questIds: [], rewardCardIds: [], status: 'preview' }),
];

export const QUESTS = [
  { id: 'quest:l1', rewardCardId: 'card:book' },
  { id: 'quest:l2' },
  { id: 'quest:f1', rewardCardId: 'card:rice' },
  { id: 'quest:story-sun-and-moon-a1', rewardCardId: 'card:story-sun-and-moon' },
  { id: 'quest:w1' },
];

const card = (id: string, unlockedBy: string, over: Partial<HeritageCard> = {}): HeritageCard => ({
  id,
  titleEn: id.replace('card:', ''),
  blurbEn: 'x',
  theme: 'life',
  stage: 'stage1',
  rarity: 'common',
  unlockedBy,
  ...over,
});

export const CARDS: HeritageCard[] = [
  card('card:book', 'episode:stage1-letters'),
  card('card:hanji', 'episode:stage1-letters'),
  card('card:rice', 'episode:stage1-life'),
  card('card:lantern', 'stage1-complete', { rarity: 'legendary' }),
  card('card:tiger', 'first-launch', { rarity: 'legendary' }),
  card('card:story-sun-and-moon', 'episode:shelf-sun-and-moon', { storyId: 'story:sun-and-moon' }),
  card('card:apple', 'episode:stage2-life', { stage: 'stage2' }),
  card('card:stage2-prize', 'stage2-complete', { stage: 'stage2', rarity: 'legendary' }),
  card('card:soon', 'episode:stage3-letters', { stage: 'stage3' }),
  card('card:set-tales', 'set:tales', { rarity: 'legendary' }),
];

export const SETS: CardSet[] = [{ id: 'set:tales', cardId: 'card:set-tales', titleEn: 'Tales', memberCardIds: ['card:story-sun-and-moon', 'card:rice'] }];

export const WORLD: AwardWorld = { cards: CARDS, episodes: EPISODES, quests: QUESTS, sets: SETS };

const EPISODE_OF: Record<string, string> = Object.fromEntries(EPISODES.flatMap((e) => e.questIds.map((q) => [q, e.id])));

/** A quest run; `completedAt: null` is a run that started and never finished. */
export function done(questId: string, stars: 0 | 1 | 2 | 3, completedAt: string | null = T1): QuestProgress {
  const run: QuestProgress = { questId, episodeId: EPISODE_OF[questId] ?? 'episode:unknown', startedAt: T1, stars, attempts: 1, accuracy: 0.8 };
  return completedAt === null ? run : { ...run, completedAt };
}

export function snapshot(over: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    profileId: 'profile:a',
    updatedAt: T1,
    episodes: [],
    quests: [],
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
    ...over,
  };
}

export const owned = (cardId: string, unlockedAt = T1, newSinceLastView = false) => ({ cardId, unlockedAt, newSinceLastView });
