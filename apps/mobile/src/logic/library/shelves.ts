import type { HeritageCard } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { earnHint } from '../awards/earn-hint';
import { parseUnlockedBy } from '../awards/rules';
import type { AwardWorld } from '../awards/types';

/**
 * The Library's Cards section as two shelves (owner request 2026-10-16, item 8; F-STORY-006 §3.7 rules kept):
 * "Your cards" first, then "Cards to find", grouped by what earns them (an episode or story, a stage, a set),
 * one row per group, with one "Next card" hint for the whole shelf instead of the same hint on every locked tile.
 * Never a count of what is left and never a fraction (D3): a group lists its cards, nothing says how many remain.
 * Pure; the words come from the dictionary.
 */

export interface ToFindGroup {
  /** `episode:<id>`, `stage:<n>`, `set:<id>` or `welcome`. */
  key: string;
  /** The episode or story title, "Stage 1", the set's name, or the welcome words. */
  title: string;
  cardIds: string[];
}

export interface LibraryShelves {
  /** Cards the learner holds, most recently earned first (`cards[].unlockedAt`, spec section 9.3); ties in gallery order. */
  yours: HeritageCard[];
  /** Cards still to find, by what earns them, in gallery order of their first card. */
  toFind: ToFindGroup[];
  /** The first card to find and how to earn it; null when every listed card is held. */
  next: { cardId: string; hint: string } | null;
}

type LibraryMessages = Messages['learner']['library'];
type LearnerMessages = Messages['learner'];

/** The group a locked card sits in, and its title. */
function groupOf(card: HeritageCard, world: AwardWorld, m: LibraryMessages): { key: string; title: string } {
  const rule = parseUnlockedBy(card.unlockedBy);
  switch (rule.kind) {
    case 'episode': {
      const episode = world.episodes.find((e) => e.id === rule.episodeId);
      return { key: `episode:${rule.episodeId}`, title: episode?.titleEn ?? m.toFind.other };
    }
    case 'stage': {
      const n = Number(rule.stage.slice('stage'.length));
      return { key: `stage:${n}`, title: m.toFind.stage(n) };
    }
    case 'set': {
      const set = world.sets.find((s) => s.id === rule.setId);
      return { key: `set:${rule.setId}`, title: set?.titleEn ?? m.toFind.other };
    }
    case 'welcome':
      return { key: 'welcome', title: m.earnHint.welcome };
    default:
      return { key: 'other', title: m.toFind.other };
  }
}

/**
 * Newest first by when each card was earned (an ISO time); a card with no time keeps its gallery place after the dated
 * ones. Stable, so cards earned at the same moment (a catch-up) stay in gallery order.
 */
function newestFirst(cards: readonly HeritageCard[], earnedAt: ReadonlyMap<string, string>): HeritageCard[] {
  return cards
    .map((card, index) => ({ card, index, at: earnedAt.get(card.id) ?? null }))
    .sort((a, b) => {
      if (a.at !== b.at) {
        if (a.at === null) return 1;
        if (b.at === null) return -1;
        return a.at < b.at ? 1 : -1;
      }
      return a.index - b.index;
    })
    .map((entry) => entry.card);
}

/**
 * `listed` is the gallery (obtainable cards, after the theme filter), `world` the award world with episode titles
 * in the UI language, `earnedAt` each held card's `unlockedAt`. A locked card with no explainable rule still sits in
 * a group ("More cards"), never a lock.
 */
export function libraryShelves(
  listed: readonly HeritageCard[],
  ownedIds: ReadonlySet<string>,
  world: AwardWorld,
  learner: LearnerMessages,
  earnedAt: ReadonlyMap<string, string> = new Map(),
): LibraryShelves {
  const m = learner.library;
  const yours = newestFirst(listed.filter((c) => ownedIds.has(c.id)), earnedAt);
  const locked = listed.filter((c) => !ownedIds.has(c.id));
  const groups = new Map<string, ToFindGroup>();
  for (const card of locked) {
    const { key, title } = groupOf(card, world, m);
    const group = groups.get(key) ?? { key, title, cardIds: [] };
    group.cardIds.push(card.id);
    groups.set(key, group);
  }
  const first = locked[0];
  return {
    yours,
    toFind: [...groups.values()],
    next: first === undefined ? null : { cardId: first.id, hint: earnHint(first, world, m.earnHint)?.text ?? learner.cardDetail.earn.later },
  };
}
