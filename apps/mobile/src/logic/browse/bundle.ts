import type { Episode, HeritageCard, Jamo, Quest, RuntimeVocabItem, StageDef, Story, ThemeDef, VocabTopic } from '@hangul-route/content-schema';
import { episodesAll } from '../../content/episodes';
import { heritageCardsAll } from '../../content/heritage-cards';
import { jamoAll } from '../../content/jamo';
import { questsAll } from '../../content/quests';
import { stages, themes } from '../../content/stages';
import { storiesAll } from '../../content/stories';
import { VOCAB_ITEMS, VOCAB_TOPICS } from '../../content/__generated__/vocab';
import { scopeFor, type MinigameScope } from '../minigame-config';
import { buildStoryIndex, type StoryIndexEntry } from '../story/story-index';
import { createVocabCatalog } from '../vocab/catalog';
import { visibleTopics } from '../vocab/topics';

/**
 * The content All lessons shows (F-BROWSE-001 section 4.5), read from the
 * learner bundle and nothing else: no learner store, no profile, no tier.
 * Production gates only: the story index keeps the review gate and never
 * honours the dev-only widening (`showUnreviewedStories`), and draft or
 * preview word topics are left out whatever the dev flags say.
 */
export interface BrowseBundle {
  stages: readonly StageDef[];
  themes: readonly ThemeDef[];
  /** Every bundled episode, grid and shelf. */
  episodes: readonly Episode[];
  quests: readonly Quest[];
  jamo: readonly Jamo[];
  cards: readonly HeritageCard[];
  /** Reviewed story quests only (D14), in index order. */
  storyIndex: readonly StoryIndexEntry[];
  /** Word topics a learner may open (`ready` or `shipped`, with words), by topic order. */
  vocabTopics: readonly VocabTopic[];
  topicItems: (key: string) => readonly RuntimeVocabItem[];
  scopeFor: (ref: string) => MinigameScope | undefined;
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
}

export function buildBrowseBundle(i: BrowseBundleInput): BrowseBundle {
  const vocab = createVocabCatalog(i.vocabTopics, i.vocabItems, { showDrafts: false });
  return {
    stages: i.stages,
    themes: i.themes,
    episodes: i.episodes,
    quests: i.quests,
    jamo: i.jamo,
    cards: i.cards,
    storyIndex: buildStoryIndex({ stories: i.stories, episodes: i.episodes, quests: i.quests, showUnreviewed: false }),
    vocabTopics: visibleTopics(vocab.vocabTopics, vocab.topicItems, () => true),
    topicItems: vocab.topicItems,
    scopeFor: i.scopeFor,
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
