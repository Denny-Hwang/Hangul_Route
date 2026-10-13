import { CATALOG, freeRouteQuestIds, gridLessonIds } from '@hangul-route/content-schema';
import { storiesAll } from '../content/stories';
import type { Tier } from './entitlement';

/**
 * Free-content registry (F-STORY-004 §3.9, D5; F-ENT-003 section 3.3). The
 * single place the free set is defined: stage gating, the story sampler, the
 * vocab topics and the free lessons all read it through `isFreeContent`, so no
 * other module keeps its own list.
 *
 * Stage gating is live today and is not behind a flag. Story, vocab-topic and
 * grid-lesson limits are computed by `isContentLocked` and `questAccess` and
 * stay off until the effective switch (`gatingActive`, `config/flags.ts`) is on:
 * the web app only, and only once payments are live.
 */

export type ContentKind = 'stage' | 'story' | 'vocab-topic' | 'quest';

export interface FreeContentRegistry {
  /** Stage keys that never need a subscription. */
  stages: ReadonlySet<string>;
  /** Vocab topic keys (F-VOC-001 ids) that stay free. */
  vocabTopics: ReadonlySet<string>;
  /** Story ids whose `shelf.sampler` is true, built from the bundle. */
  samplerStories: ReadonlySet<string>;
  /** The free lessons: every quest of the Stage 1 route days (OD-1), from the shared catalogue. */
  freeQuests: ReadonlySet<string>;
  /** Every quest of every route day, from the shared catalogue. */
  gridLessons: ReadonlySet<string>;
}

/**
 * Stage keys for the stage-level callers (placement start, card earn hints, the
 * stages a plan reads). Agrees with `FREE_ROUTE_STAGES` since OD-1 (a test pins it).
 */
export const FREE_STAGE_KEYS: readonly string[] = ['stage1'];
export const FREE_VOCAB_TOPIC_IDS: readonly string[] = ['food', 'animals', 'colors', 'numbers'];

let cachedRegistry: FreeContentRegistry | undefined;

function defaultRegistry(): FreeContentRegistry {
  cachedRegistry ??= {
    stages: new Set(FREE_STAGE_KEYS),
    vocabTopics: new Set(FREE_VOCAB_TOPIC_IDS),
    samplerStories: new Set(storiesAll.filter((s) => s.shelf?.sampler === true).map((s) => s.id)),
    freeQuests: freeRouteQuestIds(CATALOG),
    gridLessons: gridLessonIds(CATALOG),
  };
  return cachedRegistry;
}

/**
 * The registry with its story sampler read from another story list, every
 * other set the default one's: All lessons builds the free set from the
 * bundle it shows (F-BROWSE-001 section 4.13), so its story rule and its
 * story list never disagree.
 */
export function freeContentRegistryFor(stories: readonly Pick<(typeof storiesAll)[number], 'id' | 'shelf'>[]): FreeContentRegistry {
  return { ...defaultRegistry(), samplerStories: new Set(stories.filter((s) => s.shelf?.sampler === true).map((s) => s.id)) };
}

/**
 * The What is free list of the Plan screen (F-ENT-003 section 3.9.1): the sampler stories in this
 * build's bundle and the free word topics among the topics this build lists (`vocabTopics` keys).
 */
export function freeExtrasCount(
  topicKeys: readonly string[],
  registry: FreeContentRegistry = defaultRegistry(),
): { stories: number; topics: number } {
  return { stories: registry.samplerStories.size, topics: topicKeys.filter((key) => registry.vocabTopics.has(key)).length };
}

export function isFreeContent(
  kind: ContentKind,
  id: string,
  registry: FreeContentRegistry = defaultRegistry(),
): boolean {
  switch (kind) {
    case 'stage':
      return registry.stages.has(id);
    case 'story':
      return registry.samplerStories.has(id);
    case 'vocab-topic':
      return registry.vocabTopics.has(id);
    case 'quest':
      return registry.freeQuests.has(id);
  }
}

/**
 * True when a free-tier learner would be blocked from a story or vocab topic.
 * Always false while `gatingEnabled` is off, so nothing is locked at launch.
 * Callers pass the effective switch (`gatingActive`), never the raw flag.
 */
export function isContentLocked(i: {
  kind: 'story' | 'vocab-topic';
  id: string;
  tier: Tier;
  gatingEnabled: boolean;
  registry?: FreeContentRegistry;
}): boolean {
  return i.gatingEnabled && i.tier === 'free' && !isFreeContent(i.kind, i.id, i.registry);
}

/**
 * Why a quest is open, or `closed` (F-ENT-003 section 3.3). Kept, free and
 * not-a-lesson quests are open whatever the tier; `closed` exists only for a
 * free learner with the effective switch on.
 */
export type QuestAccess =
  | 'open-premium'
  | 'open-switch-off'
  | 'open-kept'
  | 'open-free'
  | 'open-not-a-lesson'
  | 'closed';

export interface QuestAccessInput {
  questId: string;
  /** The access tier (`accessTier`, `store/tier-store.ts`), never a billing tier. */
  tier: Tier;
  /** The effective switch (`gatingActive`), never the raw env value. */
  gatingEnabled: boolean;
  /** Quests with `completedAt` in the learner's snapshot: they stay open forever. */
  completedQuestIds: ReadonlySet<string>;
  registry?: FreeContentRegistry;
}

/** May this learner start this quest? The one answer every surface reads; first match wins. */
export function questAccess(i: QuestAccessInput): QuestAccess {
  const registry = i.registry ?? defaultRegistry();
  if (i.tier === 'premium') return 'open-premium';
  if (!i.gatingEnabled) return 'open-switch-off';
  if (i.completedQuestIds.has(i.questId)) return 'open-kept';
  if (registry.freeQuests.has(i.questId)) return 'open-free';
  // A story quest or an unknown id: stories are decided by `isContentLocked`, and screens refuse unknown ids.
  if (!registry.gridLessons.has(i.questId)) return 'open-not-a-lesson';
  return 'closed';
}

export function isQuestOpen(i: QuestAccessInput): boolean {
  return questAccess(i) !== 'closed';
}

/** `isQuestOpen` with everything but the quest bound: the shape stores and screens pass around. */
export function questOpenPredicate(i: Omit<QuestAccessInput, 'questId'>): (questId: string) => boolean {
  return (questId) => isQuestOpen({ ...i, questId });
}

/**
 * Grown-up browsing (F-BROWSE-001, item 14): `full` opens every lesson; `sampler`
 * opens what a free learner with no finished quest may start (everything with
 * the switch off, all of Stage 1 with it on). Browse writes no progress.
 */
export function browseQuestOpen(scope: 'full' | 'sampler', gatingEnabled: boolean): (questId: string) => boolean {
  return questOpenPredicate({ tier: scope === 'full' ? 'premium' : 'free', gatingEnabled, completedQuestIds: new Set() });
}
