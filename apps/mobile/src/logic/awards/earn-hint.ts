import type { HeritageCard } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { parseUnlockedBy } from './rules';
import type { AwardWorld, EarnHint } from './types';

type EarnHintMessages = Messages['learner']['library']['earnHint'];

/**
 * How to earn a card, for a locked Library tile, a locked CardDetail and the
 * episode page (F-STORY-006 §3.7). It says what to do, never how far along
 * the learner is. The words come from `learner.library.earnHint`. Null when
 * the rule cannot be explained (an unknown rule, a missing episode or set).
 */
export function earnHint(card: HeritageCard, world: AwardWorld, m: EarnHintMessages): EarnHint | null {
  const rule = parseUnlockedBy(card.unlockedBy);
  switch (rule.kind) {
    case 'episode': {
      const e = world.episodes.find((x) => x.id === rule.episodeId);
      if (!e) return null;
      return e.format === 'story' ? { kind: 'story', text: m.story(e.titleEn) } : { kind: 'episode', text: m.episode(e.titleEn) };
    }
    case 'stage':
      return { kind: 'stage', text: m.stage(Number(rule.stage.slice('stage'.length))) };
    case 'welcome':
      return { kind: 'welcome', text: m.welcome };
    case 'set': {
      const set = world.sets.find((s) => s.id === rule.setId);
      return set ? { kind: 'set', text: m.set(set.titleEn) } : null;
    }
    default:
      return null;
  }
}
