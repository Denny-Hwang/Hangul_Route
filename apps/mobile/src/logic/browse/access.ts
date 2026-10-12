import type { BrowseScope, Episode, Quest } from '@hangul-route/content-schema';
import { browseQuestOpen, isContentLocked } from '../content-access';
import { entryForQuest, entryForStory, type StoryIndexEntry } from '../story/story-index';
import { storyLockFor } from '../story/story-pick';
import { episodeOfQuest, isOpenableEpisode, vocabTopicKey, type BrowseBundle } from './bundle';

/**
 * Who can open what in All lessons (F-BROWSE-001 section 4.2). `full` opens
 * every shipped lesson; `sampler` opens exactly what a new free learner can,
 * through the learner's own predicates and the one switch, passed in as
 * `gatingEnabled` (the effective switch `gatingActive` of F-ENT-003 E3-2, read
 * once at boot, never the raw env flag); `none` sends every item to the
 * Access screen. With the switch off, sampler equals full. A story quest and
 * its episode follow the learner's story rule (`storyLockFor`: the story's
 * sampler mark, and for a Stage 5 book also the stage), never the lesson rule.
 * The bundle is always passed in, so access, the catalogue, targets and facts
 * read one bundle (F-VOC-003 T8's picture check is part of it).
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

/** What a caller passes: the bundle always; the lesson rule only as a test seam. */
export type AccessInput = Pick<AccessContext, 'bundle'> & Partial<Pick<AccessContext, 'freeQuestOpen'>>;

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

/**
 * A new free learner's story rule for one index entry, with the free set of
 * the bundle that lists it: the learner's own `storyLockFor` (the story's
 * sampler mark through `isContentLocked`; a book entry also needs its stage,
 * which a free learner's Stage 5 is not).
 */
function storyEntryOpen(entry: StoryIndexEntry, bundle: BrowseBundle): boolean {
  return !storyLockFor({ tier: 'free', gatingEnabled: true, episodes: bundle.episodes, registry: bundle.freeRegistry })(entry);
}

/** A quest under the sampler: a story quest opens with its story entry (F-ENT-003 leaves stories to `isContentLocked`), a lesson by the lesson rule. */
function questOpen(questId: string, ctx: AccessContext): boolean {
  const story = entryForQuest(ctx.bundle.storyIndex, questId);
  return story ? storyEntryOpen(story, ctx.bundle) : ctx.freeQuestOpen(questId);
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
      // The page shows the story's shelf entry when it has one (`entryForStory`); a shipped story always has an entry.
      return storyEntryOpen(entryForStory(ctx.bundle.storyIndex, item.id) as StoryIndexEntry, ctx.bundle);
    case 'vocab-topic':
      return !isContentLocked({ kind: 'vocab-topic', id: vocabTopicKey(item.id), tier: 'free', gatingEnabled: true, registry: ctx.bundle.freeRegistry });
    case 'card':
      return true; // front and back for every adult (OD-7)
  }
}

export function itemAccess(item: { kind: AccessItemKind; id: string }, scope: BrowseScope, gatingEnabled: boolean, context: AccessInput): ItemAccess {
  if (scope === 'none') return 'access';
  const ctx: AccessContext = {
    bundle: context.bundle,
    freeQuestOpen: context.freeQuestOpen ?? browseQuestOpen('sampler', gatingEnabled),
  };
  if (shippedState(item, ctx.bundle) === 'later') return 'later';
  if (scope === 'full' || !gatingEnabled) return 'open';
  return samplerOpen(item, ctx) ? 'open' : 'closed';
}
