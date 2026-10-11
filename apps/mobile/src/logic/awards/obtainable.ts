import type { HeritageCard } from '@hangul-route/content-schema';
import { stageCanComplete } from './derive';
import { parseUnlockedBy } from './rules';
import type { AwardWorld } from './types';

/**
 * The cards the Library may list (F-STORY-006 §3.7): owned cards, plus cards
 * whose rule can still fire. A held or unreviewed story never inflates the
 * collection; a card already owned always stays visible (rule 1).
 */
export function obtainableCards(world: AwardWorld, ownedIds: ReadonlySet<string>): HeritageCard[] {
  const canFire = (card: HeritageCard): boolean => {
    const rule = parseUnlockedBy(card.unlockedBy);
    switch (rule.kind) {
      case 'episode': {
        const e = world.episodes.find((x) => x.id === rule.episodeId);
        return e !== undefined && (e.status === 'shipped' || e.status === 'ready') && e.questIds.length > 0;
      }
      case 'stage':
        return stageCanComplete(rule.stage, world);
      case 'welcome':
        return true;
      default:
        // A set card is decided below, from its members; an unknown rule never fires.
        return false;
    }
  };
  const visible = new Set(world.cards.filter((c) => ownedIds.has(c.id) || canFire(c)).map((c) => c.id));
  const setVisible = (card: HeritageCard): boolean => {
    const rule = parseUnlockedBy(card.unlockedBy);
    if (rule.kind !== 'set') return false;
    const set = world.sets.find((s) => s.id === rule.setId);
    return set !== undefined && set.memberCardIds.length > 0 && set.memberCardIds.every((id) => visible.has(id));
  };
  return world.cards.filter((c) => visible.has(c.id) || setVisible(c));
}
