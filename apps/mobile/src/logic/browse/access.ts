import type { BrowseScope, Episode, Quest } from '@hangul-route/content-schema';
import { browseQuestOpen, isContentLocked } from '../content-access';
import { entryForQuest } from '../story/story-index';
import { defaultBrowseBundle, episodeOfQuest, isOpenableEpisode, vocabTopicKey, type BrowseBundle } from './bundle';

/**
 * Who can open what in All lessons (F-BROWSE-001 section 4.2). `full` opens
 * every shipped lesson; `sampler` opens exactly what a new free learner can,
 * through the learner's own predicates and the one switch, passed in as
 * `gatingEnabled` (the effective switch `gatingActive` of F-ENT-003 E3-2, read
 * once at boot, never the raw env flag); `none` sends every item to the
 * Access screen. With the switch off, sampler equals full. A story's own quest
 * and its episode follow the story rule, never the lesson rule.
 */

export type AccessItemKind = 'episode' | 'quest' | 'story' | 'vocab-topic' | 'card';

/** `later`: a preview or unshipped item ("Coming later"); `access`: no active pass. */
export type ItemAccess = 'open' | 'closed' | 'later' | 'access';

/**
 * Whether a new free learner (no finished quest) may start this lesson. The
 * default is F-ENT-003's own adapter, `browseQuestOpen('sampler',
 * gatingEnabled)` (section 3.3), so the sampler never drifts from the learner
 * rule; tests pass their own.
 */
export type FreeQuestOpen = (questId: string) => boolean;

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

/** A new free learner's story rule, with the free set of the bundle that lists the story. */
function storyOpen(storyId: string, bundle: BrowseBundle): boolean {
  return !isContentLocked({ kind: 'story', id: storyId, tier: 'free', gatingEnabled: true, registry: bundle.freeRegistry });
}

/** A quest under the sampler: a story quest opens with its story (F-ENT-003 leaves stories to `isContentLocked`), a lesson by the lesson rule. */
function questOpen(questId: string, ctx: AccessContext): boolean {
  const story = entryForQuest(ctx.bundle.storyIndex, questId);
  return story ? storyOpen(story.storyId, ctx.bundle) : ctx.freeQuestOpen(questId);
}

/** A shipped item under a sampler pass with the switch on. */
function samplerOpen(item: { kind: AccessItemKind; id: string }, ctx: AccessContext): boolean {
  switch (item.kind) {
    case 'quest':
      return questOpen(item.id, ctx);
    case 'episode': {
      // Open when any of its quests opens: a shelf episode with its story, a grid episode with any lesson.
      const episode = ctx.bundle.episodes.find((e) => e.id === item.id) as Episode;
      return questsOf(ctx.bundle, episode).some((q) => questOpen(q.id, ctx));
    }
    case 'story':
      return storyOpen(item.id, ctx.bundle);
    case 'vocab-topic':
      return !isContentLocked({ kind: 'vocab-topic', id: vocabTopicKey(item.id), tier: 'free', gatingEnabled: true, registry: ctx.bundle.freeRegistry });
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
  const ctx: AccessContext = {
    bundle: context.bundle ?? defaultBrowseBundle(),
    freeQuestOpen: context.freeQuestOpen ?? browseQuestOpen('sampler', gatingEnabled),
  };
  if (shippedState(item, ctx.bundle) === 'later') return 'later';
  if (scope === 'full' || !gatingEnabled) return 'open';
  return samplerOpen(item, ctx) ? 'open' : 'closed';
}
