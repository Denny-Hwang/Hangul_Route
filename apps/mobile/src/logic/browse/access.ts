import type { BrowseScope, Episode, Quest } from '@hangul-route/content-schema';
import { isContentLocked } from '../content-access';
import { isStagePlayable } from '../entitlement';
import { defaultBrowseBundle, episodeOfQuest, isOpenableEpisode, vocabTopicKey, type BrowseBundle } from './bundle';

/**
 * Who can open what in All lessons (F-BROWSE-001 section 4.2). `full` opens
 * every shipped lesson; `sampler` opens exactly what a new free learner can,
 * through the learner's own predicates and the one switch
 * (`flags.contentGatingEnabled`, passed in as `gatingEnabled`); `none` sends
 * every item to the Access screen. With the switch off, sampler equals full.
 */

export type AccessItemKind = 'episode' | 'quest' | 'story' | 'vocab-topic' | 'card';

/** `later`: a preview or unshipped item ("Coming later"); `access`: no active pass. */
export type ItemAccess = 'open' | 'closed' | 'later' | 'access';

/** Whether a new free learner (no completions) may start this quest while the switch is on. */
export type FreeQuestOpen = (quest: Pick<Quest, 'id'>, episode: Pick<Episode, 'id' | 'stage'>) => boolean;

/**
 * Today's learner rule: every quest of a playable stage (`isStagePlayable`).
 * F-ENT-003 E3-2 replaces it with `isQuestOpen({ questId, tier: 'free',
 * gatingEnabled, completedQuestIds: none })`; the table does not change.
 */
export const learnerFreeQuestOpen: FreeQuestOpen = (_quest, episode) => isStagePlayable(episode.stage);

export interface AccessContext {
  bundle: BrowseBundle;
  freeQuestOpen: FreeQuestOpen;
}

function questsOf(bundle: BrowseBundle, episode: Episode): Quest[] {
  return episode.questIds.flatMap((id) => bundle.quests.filter((q) => q.id === id));
}

/** Shipped and known, independent of the scope: `open`, or `later` for anything a learner cannot open either. */
function shippedState(item: { kind: AccessItemKind; id: string }, bundle: BrowseBundle): 'open' | 'later' {
  switch (item.kind) {
    case 'episode': {
      const episode = bundle.episodes.find((e) => e.id === item.id);
      return episode && isOpenableEpisode(episode) && questsOf(bundle, episode).length > 0 ? 'open' : 'later';
    }
    case 'quest':
      return episodeOfQuest(bundle, item.id) && bundle.quests.some((q) => q.id === item.id) ? 'open' : 'later';
    case 'story':
      return bundle.storyIndex.some((e) => e.storyId === item.id) ? 'open' : 'later';
    case 'vocab-topic':
      return bundle.vocabTopics.some((t) => t.id === item.id) ? 'open' : 'later';
    case 'card':
      return bundle.cards.some((c) => c.id === item.id) ? 'open' : 'later';
  }
}

/** A shipped item under a sampler pass with the switch on. */
function samplerOpen(item: { kind: AccessItemKind; id: string }, ctx: AccessContext): boolean {
  switch (item.kind) {
    case 'quest': {
      const episode = episodeOfQuest(ctx.bundle, item.id) as Episode;
      return ctx.freeQuestOpen({ id: item.id }, episode);
    }
    case 'episode': {
      const episode = ctx.bundle.episodes.find((e) => e.id === item.id) as Episode;
      return questsOf(ctx.bundle, episode).some((q) => ctx.freeQuestOpen(q, episode));
    }
    case 'story':
      return !isContentLocked({ kind: 'story', id: item.id, tier: 'free', gatingEnabled: true });
    case 'vocab-topic':
      return !isContentLocked({ kind: 'vocab-topic', id: vocabTopicKey(item.id), tier: 'free', gatingEnabled: true });
    case 'card':
      return true; // front and back for every adult (OD-7)
  }
}

export function itemAccess(
  item: { kind: AccessItemKind; id: string },
  scope: BrowseScope,
  gatingEnabled: boolean,
  context: Partial<AccessContext> = {},
): ItemAccess {
  if (scope === 'none') return 'access';
  const ctx: AccessContext = { bundle: context.bundle ?? defaultBrowseBundle(), freeQuestOpen: context.freeQuestOpen ?? learnerFreeQuestOpen };
  if (shippedState(item, ctx.bundle) === 'later') return 'later';
  if (scope === 'full' || !gatingEnabled) return 'open';
  return samplerOpen(item, ctx) ? 'open' : 'closed';
}
