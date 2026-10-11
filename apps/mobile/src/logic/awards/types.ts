import type { Episode, HeritageCard, Quest, StageKey } from '@hangul-route/content-schema';

/**
 * The card award model (F-STORY-006 §3.1-§3.2). Every card has one primary
 * rule, written in its `unlockedBy`; the quest card (`quest.rewardCardId` at
 * 2+ stars) is the one secondary path.
 */
export type AwardSource = 'quest' | 'episode' | 'stage' | 'welcome' | 'set';

export type UnlockRule =
  | { kind: 'episode'; episodeId: string }
  | { kind: 'stage'; stage: StageKey }
  | { kind: 'welcome' }
  | { kind: 'set'; setId: string }
  | { kind: 'unknown'; raw: string };

/** A collection of story cards; its own card arrives when every member is owned. */
export interface CardSet {
  id: string;
  cardId: string;
  /** The collection's name, for the earn hint (§3.7). */
  titleEn: string;
  memberCardIds: readonly string[];
}

/** Everything the rules read from the content bundle. */
export interface AwardWorld {
  cards: readonly HeritageCard[];
  episodes: readonly Episode[];
  quests: readonly Pick<Quest, 'id' | 'rewardCardId'>[];
  sets: readonly CardSet[];
}

export interface DerivedAward {
  cardId: string;
  source: AwardSource;
  /** episodeId | stage key | questId | setId | 'welcome' */
  via: string;
  /** Deterministic: two devices with the same progress derive the same time. */
  unlockedAt: string;
}

export interface EarnHint {
  kind: 'episode' | 'story' | 'stage' | 'welcome' | 'set';
  text: string;
}
