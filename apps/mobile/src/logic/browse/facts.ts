import {
  StoryLevelSchema,
  localize,
  type Episode,
  type KoText,
  type Quest,
  type QuestStepKind,
  type StageKey,
  type StoryLevel,
  type ThemeKey,
  type UiLocale,
} from '@hangul-route/content-schema';
import { localizeEpisode, localizeQuest, localizeScope, localizeStory } from '../content-locale';
import { SKILLS, questSkills } from '../my-route/skills';
import type { Skill } from '../my-route/types';
import { questTeaches } from '../stage1/curriculum';
import { homeCellOf } from '../story/home-cell';
import { entryForStory, type StoryIndexEntry } from '../story/story-index';
import { localizedGloss } from '../vocab/catalog';
import { episodeOfQuest, isOpenableEpisode, vocabTopicKey, type BrowseBundle } from './bundle';

/**
 * "What this teaches" (F-BROWSE-001 section 4.6): the facts an item page and
 * the episode outline show, read from the bundle only. Taught Korean always
 * travels with its romanization and a gloss in the UI language; skills are
 * read, listen and write (`questSkills`), never speaking. Step names are the
 * player's own (`questStepLabel` turns the kinds into words on screen).
 */

export interface LetterFact {
  jamoId: string;
  char: string;
  romanization: string;
}

export interface WordFact {
  ko: string;
  romanization: string;
  /** In the UI language. */
  gloss: string;
}

export interface SyllableFact {
  ko: string;
  romanization: string;
}

/** "Stage 1 · Letters · lesson 2 of 3". */
export interface QuestPlace {
  stage: StageKey;
  theme: ThemeKey;
  episodeId: string;
  position: number;
  count: number;
}

export interface QuestFacts {
  kind: 'quest';
  id: string;
  title: string;
  minutes: number;
  /** The letters its Discover step introduces, in page order. */
  letters: LetterFact[];
  /** Words met in Discover and in the game scopes, once each. */
  words: WordFact[];
  /** Syllables its games build, once each and none already in `words` (a syllable has no gloss). */
  syllables: SyllableFact[];
  /** A lesson that introduces no letter (a taste quest) shows its first three words instead. */
  tasteWords: WordFact[];
  skills: Skill[];
  steps: QuestStepKind[];
  rewardCardId: string | null;
  where: QuestPlace | null;
  /** The focus line ("Taught here: ㄴ (n)") when opened for a letter this lesson introduces. */
  focus: LetterFact | null;
}

export interface StoryFacts {
  kind: 'story';
  id: string;
  title: WordFact;
  minutes: number;
  /** Levels offered, lowest first, with their scene counts. */
  levels: { level: StoryLevel; scenes: number }[];
  /** The level the preview opens at unless the grown-up picks another: the lowest. */
  defaultLevel: StoryLevel;
  keywords: WordFact[];
  /** The story's quest ([ Preview the questions ]). */
  questId: string;
  /** The grid cell the map shows it in: a shelf story's home cell, a book's own cell. */
  where: { stage: StageKey; theme: ThemeKey };
}

export interface TopicWordFact extends WordFact {
  id: string;
  /** Picture ref (`card:` or `word:`). */
  visual: string;
}

export interface TopicFacts {
  kind: 'vocab-topic';
  id: string;
  key: string;
  title: string;
  titleKo: WordFact;
  count: number;
  words: TopicWordFact[];
}

export type ItemFacts = QuestFacts | StoryFacts | TopicFacts;

const wordOf = (text: Pick<KoText, 'ko' | 'romanization' | 'en'>): WordFact => ({ ko: text.ko, romanization: text.romanization, gloss: text.en });

function uniqueByKo<T extends { ko: string }>(list: readonly T[]): T[] {
  const seen = new Set<string>();
  return list.filter((item) => (seen.has(item.ko) ? false : (seen.add(item.ko), true)));
}

function lettersOf(quest: Quest, bundle: BrowseBundle): LetterFact[] {
  return questTeaches(quest).flatMap((jamoId) => {
    const jamo = bundle.jamo.find((j) => j.id === jamoId);
    return jamo ? [{ jamoId, char: jamo.char, romanization: jamo.romanization }] : [];
  });
}

/** Words and syllables of a quest already in the UI language. */
function wordsOf(quest: Quest, bundle: BrowseBundle, locale: UiLocale): { words: WordFact[]; syllables: SyllableFact[] } {
  const local = localizeQuest(quest, locale);
  const words: WordFact[] = [];
  const syllables: SyllableFact[] = [];
  for (const step of local.steps) {
    for (const page of step.discover?.pages ?? []) {
      for (const item of page.items) words.push(wordOf(item.type === 'jamo' ? item.example : item.word));
    }
  }
  for (const { minigameRef: ref } of local.steps) {
    const scope = ref ? bundle.scopeFor(ref) : undefined;
    if (!ref || !scope) continue;
    const localScope = localizeScope(scope, ref, locale);
    for (const pair of localScope.cardPairs ?? []) {
      if (pair.romanization) words.push({ ko: pair.ko, romanization: pair.romanization, gloss: pair.en });
    }
    for (const s of localScope.syllables ?? []) syllables.push({ ko: s.ko, romanization: s.romanization });
  }
  const uniqueWords = uniqueByKo(words);
  // A syllable that is also a word (ga, "the sound ga") is listed once, as the word.
  const wordKo = new Set(uniqueWords.map((w) => w.ko));
  return { words: uniqueWords, syllables: uniqueByKo(syllables).filter((s) => !wordKo.has(s.ko)) };
}

function skillsOf(quest: Pick<Quest, 'steps'>): Skill[] {
  const skills = questSkills(quest);
  return SKILLS.filter((s) => skills.has(s));
}

function placeOf(questId: string, bundle: BrowseBundle): QuestPlace | null {
  const episode = episodeOfQuest(bundle, questId);
  if (!episode) return null;
  return { stage: episode.stage, theme: episode.theme, episodeId: episode.id, position: episode.questIds.indexOf(questId) + 1, count: episode.questIds.length };
}

function questFacts(quest: Quest, bundle: BrowseBundle, locale: UiLocale, focusJamoId: string | undefined): QuestFacts {
  const letters = lettersOf(quest, bundle);
  const { words, syllables } = wordsOf(quest, bundle, locale);
  return {
    kind: 'quest',
    id: quest.id,
    title: localizeQuest(quest, locale).titleEn,
    minutes: quest.estimatedMinutes,
    letters,
    words,
    syllables,
    tasteWords: letters.length === 0 ? words.slice(0, 3) : [],
    skills: skillsOf(quest),
    steps: quest.steps.map((s) => s.kind),
    rewardCardId: quest.rewardCardId ?? null,
    where: placeOf(quest.id, bundle),
    focus: letters.find((l) => l.jamoId === focusJamoId) ?? null,
  };
}

function storyPlace(entry: StoryIndexEntry, bundle: BrowseBundle): { stage: StageKey; theme: ThemeKey } {
  if (entry.placement === 'shelf') return homeCellOf(entry.story);
  const episode = bundle.episodes.find((e) => e.id === entry.episodeId);
  return episode ? { stage: episode.stage, theme: episode.theme } : { stage: entry.stage, theme: entry.theme };
}

function storyFacts(entry: StoryIndexEntry, bundle: BrowseBundle, locale: UiLocale): StoryFacts {
  const story = localizeStory(entry.story, locale);
  const levels = StoryLevelSchema.options.flatMap((level) => {
    const tier = story.tiers.find((t) => t.level === level);
    return tier ? [{ level, scenes: tier.scenes.length }] : [];
  });
  return {
    kind: 'story',
    id: entry.storyId,
    title: wordOf(story.title),
    minutes: entry.minutes,
    levels,
    // The schema keeps at least one tier, and the index only lists a story with the quest's level.
    defaultLevel: (levels[0] as { level: StoryLevel }).level,
    keywords: story.keywords.map(wordOf),
    questId: entry.questId,
    where: storyPlace(entry, bundle),
  };
}

function topicFacts(id: string, bundle: BrowseBundle, locale: UiLocale): TopicFacts | null {
  const topic = bundle.vocabTopics.find((t) => t.id === id);
  if (!topic) return null;
  const local = localize(topic, topic.id, locale);
  const items = bundle.topicItems(vocabTopicKey(id));
  return {
    kind: 'vocab-topic',
    id,
    key: topic.key,
    title: local.titleEn,
    titleKo: wordOf(local.titleKo),
    count: items.length,
    words: items.map((i) => ({ id: i.id, ko: i.ko, romanization: i.romanization, gloss: localizedGloss(i, locale), visual: i.visual })),
  };
}

/** The facts of one item, or `null` when the bundle does not hold it (resolution sends that link home). */
export function itemFacts(
  item: { kind: 'quest' | 'story' | 'vocab-topic'; id: string; focusJamoId?: string },
  bundle: BrowseBundle,
  locale: UiLocale = 'en',
): ItemFacts | null {
  switch (item.kind) {
    case 'quest': {
      const quest = bundle.quests.find((q) => q.id === item.id);
      return quest ? questFacts(quest, bundle, locale, item.focusJamoId) : null;
    }
    case 'story': {
      const entry = entryForStory(bundle.storyIndex, item.id);
      return entry ? storyFacts(entry, bundle, locale) : null;
    }
    case 'vocab-topic':
      return topicFacts(item.id, bundle, locale);
  }
}

export interface OutlineQuestRow {
  id: string;
  title: string;
  minutes: number;
  letters: LetterFact[];
  tasteWords: WordFact[];
  skills: Skill[];
}

export interface EpisodeOutline {
  /** The episode in the UI language (title, subtitle, Hoya's intro as the learner page shows them). */
  episode: Episode;
  /** "About N minutes": the sum of its quests' minutes. */
  minutes: number;
  /** A preview placeholder or an episode with no quests: "Coming later", no rows, no cards. */
  comingLater: boolean;
  /** Lesson rows in `questIds` order (a story episode lists its stories instead). */
  quests: OutlineQuestRow[];
  stories: StoryIndexEntry[];
  rewardCardIds: string[];
}

export function episodeOutline(episodeId: string, bundle: BrowseBundle, locale: UiLocale = 'en'): EpisodeOutline | null {
  const episode = bundle.episodes.find((e) => e.id === episodeId);
  if (!episode || episode.status === 'draft') return null;
  const quests = episode.questIds.flatMap((id) => bundle.quests.filter((q) => q.id === id));
  const comingLater = !isOpenableEpisode(episode) || quests.length === 0;
  const local = localizeEpisode(episode, locale);
  if (comingLater) return { episode: local, minutes: 0, comingLater, quests: [], stories: [], rewardCardIds: [] };
  const isStory = episode.format === 'story';
  return {
    episode: local,
    minutes: quests.reduce((sum, q) => sum + q.estimatedMinutes, 0),
    comingLater,
    quests: isStory
      ? []
      : quests.map((q) => {
          const facts = questFacts(q, bundle, locale, undefined);
          return { id: q.id, title: facts.title, minutes: facts.minutes, letters: facts.letters, tasteWords: facts.tasteWords, skills: facts.skills };
        }),
    stories: isStory ? bundle.storyIndex.filter((e) => e.episodeId === episode.id) : [],
    rewardCardIds: [...episode.rewardCardIds],
  };
}
