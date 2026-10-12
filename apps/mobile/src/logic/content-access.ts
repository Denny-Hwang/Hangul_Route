import { storiesAll } from '../content/stories';
import type { Tier } from './entitlement';

/**
 * Free-content registry (F-STORY-004 §3.9, D5). The single place the free set
 * is defined: stage gating, the story sampler and the vocab topics all read it
 * through `isFreeContent`, so no other module keeps its own list.
 *
 * Stage gating is live today and is not behind a flag. Story and vocab-topic
 * locks are computed by `isContentLocked` and stay off until
 * `flags.contentGatingEnabled` is switched on (payments are not live).
 */

export type ContentKind = 'stage' | 'story' | 'vocab-topic';

export interface FreeContentRegistry {
  /** Stage keys that never need a subscription. */
  stages: ReadonlySet<string>;
  /** Vocab topic keys (F-VOC-001 ids) that stay free. */
  vocabTopics: ReadonlySet<string>;
  /** Story ids whose `shelf.sampler` is true, built from the bundle. */
  samplerStories: ReadonlySet<string>;
}

export const FREE_STAGE_KEYS: readonly string[] = ['stage1'];
export const FREE_VOCAB_TOPIC_IDS: readonly string[] = ['food', 'animals', 'colors', 'numbers'];

let cachedRegistry: FreeContentRegistry | undefined;

function defaultRegistry(): FreeContentRegistry {
  cachedRegistry ??= {
    stages: new Set(FREE_STAGE_KEYS),
    vocabTopics: new Set(FREE_VOCAB_TOPIC_IDS),
    samplerStories: new Set(storiesAll.filter((s) => s.shelf?.sampler === true).map((s) => s.id)),
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
  }
}

/**
 * True when a free-tier learner would be blocked from a story or vocab topic.
 * Always false while `gatingEnabled` is off, so nothing is locked at launch.
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
