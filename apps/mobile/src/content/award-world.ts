import type { AwardWorld } from '../logic/awards/types';
import { episodesAll } from './episodes';
import { heritageCardsAll } from './heritage-cards';
import { questsAll } from './quests';

/**
 * The shipped bundle as the award engine reads it (F-STORY-006 §3.2): every
 * card, every grid and shelf episode, every quest. Card sets join with the
 * story cards (PR 6.7, `content/story-sets.ts`); until then there are none.
 */
export const awardWorld: AwardWorld = {
  cards: heritageCardsAll,
  episodes: episodesAll,
  quests: questsAll,
  sets: [],
};

/**
 * Cards every profile is given on its first launch (`unlockedBy:
 * 'first-launch'`, F-STORY-006 §3.3): Hoya's welcome card. They are never a
 * catch-up and never the learner's first earned card (§3.4, §3.5).
 */
export const welcomeCardIds: readonly string[] = heritageCardsAll.filter((c) => c.unlockedBy === 'first-launch').map((c) => c.id);
