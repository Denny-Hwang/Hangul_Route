import type { Episode, HeritageCard, Jamo, Quest, RuntimeVocabItem, StageDef, Story, ThemeDef, VocabTopic } from '@hangul-route/content-schema';
import { episodesAll } from '../../content/episodes';
import { heritageCardsAll } from '../../content/heritage-cards';
import { jamoAll } from '../../content/jamo';
import { questsAll } from '../../content/quests';
import { stages, themes } from '../../content/stages';
import { storiesAll } from '../../content/stories';
import { VOCAB_ITEMS, VOCAB_TOPICS } from '../../content/__generated__/vocab';
import { freeContentRegistryFor, type FreeContentRegistry } from '../content-access';
import { scopeFor, type MinigameScope } from '../minigame-config';
import { buildStoryIndex, type StoryIndexEntry } from '../story/story-index';
import { storyReadStep } from '../story/story-ref';
import { createVocabCatalog } from '../vocab/catalog';
import { visibleTopics } from '../vocab/topics';

/**
 * The content All lessons shows (F-BROWSE-001 section 4.5), read from the
 * learner bundle and nothing else: no learner store, no profile, no tier.
 * Production gates only: the story index keeps the review gate and never
 * honours the dev-only widening (`showUnreviewedStories`), and draft or
 * preview word topics are left out whatever the dev flags say. The review
 * gate (F-STORY-004 D14) holds on every path: an unreviewed story's own
 * quest and its shelf or book episode are left out too, so no quest or
 * episode id can reach a story the index keeps out.
 */
export interface BrowseBundle {
  stages: readonly StageDef[];
  themes: readonly ThemeDef[];
  /** Every bundled episode, grid and shelf, minus story episodes with no reviewed story; `questIds` lists kept quests only. */
  episodes: readonly Episode[];
  /** Every bundled quest, minus story quests the reviewed index does not list. */
  quests: readonly Quest[];
  jamo: readonly Jamo[];
  cards: readonly HeritageCard[];
  /** Reviewed story quests only (D14), in index order. */
  storyIndex: readonly StoryIndexEntry[];
  /** Word topics a learner may open (`ready` or `shipped`, with words), by topic order. */
  vocabTopics: readonly VocabTopic[];
  topicItems: (key: string) => readonly RuntimeVocabItem[];
  scopeFor: (ref: string) => MinigameScope | undefined;
  /** The free set this bundle's sampler reads: the learner's, with the sampler stories of these stories (section 4.13). */
  freeRegistry: FreeContentRegistry;
}

export interface BrowseBundleInput {
  stages: readonly StageDef[];
  themes: readonly ThemeDef[];
  episodes: readonly Episode[];
  quests: readonly Quest[];
  jamo: readonly Jamo[];
  cards: readonly HeritageCard[];
  stories: readonly Story[];
  vocabTopics: readonly VocabTopic[];
  vocabItems: readonly RuntimeVocabItem[];
  scopeFor: (ref: string) => MinigameScope | undefined;
  /**
   * Whether a word picture can be drawn (F-VOC-003 T8: a topic with one blank
   * tile is skipped). Default: every picture. The browse root passes the same
   * check the learner topic picker uses once F-VOC-003's picker ships.
   */
  canRender?: (visual: string) => boolean;
}

const isStoryEpisode = (episode: Pick<Episode, 'format' | 'placement'>): boolean => episode.format === 'story' || episode.placement === 'shelf';

/**
 * The review gate on quests and episodes: a story quest stays only when the
 * reviewed index lists it; an episode loses the quests left out; a shelf
 * episode, or an openable book episode, with no reviewed story is left out.
 * A preview book episode stays, as the learner Journey's "Coming later" cell.
 */
function reviewedOnly(i: Pick<BrowseBundleInput, 'episodes' | 'quests'>, index: readonly StoryIndexEntry[]): { episodes: Episode[]; quests: Quest[] } {
  const indexedQuests = new Set(index.map((e) => e.questId));
  const indexedEpisodes = new Set(index.map((e) => e.episodeId));
  const left = new Set(i.quests.filter((q) => storyReadStep(q) !== null && !indexedQuests.has(q.id)).map((q) => q.id));
  const episodes = i.episodes.flatMap((episode): Episode[] => {
    if (isStoryEpisode(episode) && !indexedEpisodes.has(episode.id) && (episode.placement === 'shelf' || isOpenableEpisode(episode))) return [];
    const questIds = episode.questIds.filter((id) => !left.has(id));
    return [questIds.length === episode.questIds.length ? episode : { ...episode, questIds }];
  });
  return { episodes, quests: i.quests.filter((q) => !left.has(q.id)) };
}

export function buildBrowseBundle(i: BrowseBundleInput): BrowseBundle {
  const vocab = createVocabCatalog(i.vocabTopics, i.vocabItems, { showDrafts: false });
  const storyIndex = buildStoryIndex({ stories: i.stories, episodes: i.episodes, quests: i.quests, showUnreviewed: false });
  const { episodes, quests } = reviewedOnly(i, storyIndex);
  return {
    stages: i.stages,
    themes: i.themes,
    episodes,
    quests,
    jamo: i.jamo,
    cards: i.cards,
    storyIndex,
    vocabTopics: visibleTopics(vocab.vocabTopics, vocab.topicItems, i.canRender ?? (() => true)),
    topicItems: vocab.topicItems,
    scopeFor: i.scopeFor,
    freeRegistry: freeContentRegistryFor(i.stories),
  };
}

let cached: BrowseBundle | undefined;

/** The learner bundle as All lessons sees it, built once. */
export function defaultBrowseBundle(): BrowseBundle {
  cached ??= buildBrowseBundle({
    stages,
    themes,
    episodes: episodesAll,
    quests: questsAll,
    jamo: jamoAll,
    cards: heritageCardsAll,
    stories: storiesAll,
    vocabTopics: VOCAB_TOPICS,
    vocabItems: VOCAB_ITEMS,
    scopeFor,
  });
  return cached;
}

/** A learner can open an episode that is `shipped` or `ready` (as `playableEpisodes` counts it). */
export function isOpenableEpisode(episode: Pick<Episode, 'status'>): boolean {
  return episode.status === 'shipped' || episode.status === 'ready';
}

/**
 * The episode a quest belongs to: the first openable grid episode listing it,
 * else the first openable shelf episode (a story quest). `undefined` when no
 * openable episode lists it (a preview placeholder, a draft, an unknown id).
 */
export function episodeOfQuest(bundle: Pick<BrowseBundle, 'episodes'>, questId: string): Episode | undefined {
  const listing = bundle.episodes.filter((e) => isOpenableEpisode(e) && e.questIds.includes(questId));
  return listing.find((e) => e.placement !== 'shelf') ?? listing[0];
}

/** `vocab-topic:food` -> `food` (the key the free registry and `topicItems` use). */
export function vocabTopicKey(id: string): string {
  return id.replace(/^vocab-topic:/, '');
}
