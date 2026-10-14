import {
  StoryLevelSchema,
  decomposeSyllable,
  discoverItemTexts,
  localize,
  type Episode,
  type KoText,
  type ListenPickRound,
  type Quest,
  type QuestStepKind,
  type StageKey,
  type StoryLevel,
  type ThemeKey,
  type UiLocale,
} from '@hangul-route/content-schema';
import { localizeEpisode, localizeQuest, localizeScope, localizeStory } from '../content-locale';
import type { MinigameScope } from '../minigame-config';
import { SKILLS, questSkills } from '../my-route/skills';
import type { Skill } from '../my-route/types';
import { questTeaches } from '../stage1/curriculum';
import { homeCellOf } from '../story/home-cell';
import { recapWords } from '../story/recap';
import { entryForQuest, entryForStory, type StoryIndexEntry } from '../story/story-index';
import { parseStoryMinigameRef, type StoryRef } from '../story/story-ref';
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

/**
 * "Where it sits". A lesson (or a book's story quest) sits in its grid cell's
 * episode: "Stage 1 · Letters · lesson 2 of 3". A shelf story's own quest
 * sits where its story does, the story's home cell (F-STORY-005 section 3.2),
 * with no lesson position: its shelf episode is not a grid cell, so it never
 * names the place, and [ See on the Journey ] goes where the story page goes.
 */
export type QuestPlace =
  | { kind: 'episode'; stage: StageKey; theme: ThemeKey; episodeId: string; position: number; count: number }
  | { kind: 'story-home'; stage: StageKey; theme: ThemeKey; storyId: string };

export interface QuestFacts {
  kind: 'quest';
  id: string;
  title: string;
  minutes: number;
  /** The letters its Discover step introduces, in page order. */
  letters: LetterFact[];
  /** Words met in Discover and in every game scope (a story step: its level's recap words), once each. */
  words: WordFact[];
  /**
   * Syllables its games build, once each and none already in `words` (a syllable has no gloss). A
   * built block that is a bundle word is listed under `words` with its gloss instead.
   */
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
  /**
   * What Hear plays, as the learner hears the word (section 4.7, BR-9): its recording when it has one,
   * else the device voice says its spoken form, else its Korean (`playPrompt`'s fallback).
   */
  speech: { text: string; audioRef?: string };
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

/** The same Korean with or without a closing mark ("Hello!" and its reply "Hello") is one entry. */
const koKey = (ko: string): string => ko.trim().replace(/[!?.]+$/u, '');

function uniqueByKo<T extends { ko: string }>(list: readonly T[]): T[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const key = koKey(item.ko);
    return seen.has(key) ? false : (seen.add(key), true);
  });
}

/** Taught Korean is never shown without its romanization: an item that has none is left out. */
function glossed(ko: string, romanization: string | undefined, gloss: string): WordFact[] {
  return romanization ? [{ ko, romanization, gloss }] : [];
}

/** Jamo ids are `jamo:<name>` (`JamoSchema`). */
const isLetterId = (id: string): boolean => id.startsWith('jamo:');

/** `lp.syl` with no meaning gives its prompt this English line (`scope-builders.ts`); with one, the meaning. */
const isBareSyllable = (round: ListenPickRound): boolean => round.prompt.en === `the syllable ${round.prompt.romanization}`;

/**
 * What a Listen & Pick round practises (F-QUEST-002 section 3.10), read from
 * the English source round. The builder's id says it first: `lp.sym` a letter
 * (the letters row lists it), `lp.syl` a syllable, or the word it means when
 * it was built with a meaning, `lp.word` and `lp.pic` a word, whatever their
 * options look like. A hand-written round is read by its shape: a picture
 * answer or options that are not all one final apart make it a word. Only the
 * answer is taught; the other options are not.
 */
function listenPickTarget(round: ListenPickRound): 'letter' | 'syllable' | 'word' {
  if (round.id.startsWith('lp:sym:')) return 'letter';
  if (round.id.startsWith('lp:syl:')) return isBareSyllable(round) ? 'syllable' : 'word';
  if (round.id.startsWith('lp:word:') || round.id.startsWith('lp:pic:')) return 'word';
  const answer = round.options.find((o) => o.id === round.answerId);
  if (answer?.pictureRef) return 'word';
  if (isLetterId(round.answerId)) return 'letter';
  const prompt = decomposeSyllable(round.prompt.ko);
  const oneFinalApart = round.options.every((o) => {
    const parts = decomposeSyllable(o.text?.ko ?? '');
    return prompt !== null && parts !== null && parts.initial === prompt.initial && parts.medial === prompt.medial;
  });
  return oneFinalApart ? 'syllable' : 'word';
}

/**
 * The Korean one game scope practises, in the UI language (`scope` is the
 * localized scope, `source` its English source, which classifies Listen &
 * Pick rounds; localizing keeps every list in order): card pairs, Build a
 * Letter syllables, every Pic-Word board word, the answer of each Listen &
 * Pick round, each dialogue line with its right reply, and the Korean labels
 * of Story Order steps.
 */
function scopeWords(
  scope: MinigameScope,
  source: MinigameScope,
  wordFor: (ko: string) => WordFact | null,
): { words: WordFact[]; syllables: SyllableFact[] } {
  const words: WordFact[] = [];
  const syllables: SyllableFact[] = [];
  for (const pair of scope.cardPairs ?? []) words.push(...glossed(pair.ko, pair.romanization, pair.en));
  for (const s of scope.syllables ?? []) {
    // A built block that is a bundle word (Lunch Box Words: san, gom) is taught as that word, with its gloss.
    const word = wordFor(s.ko);
    if (word) words.push(word);
    else syllables.push({ ko: s.ko, romanization: s.romanization });
  }
  for (const board of scope.picWord?.boards ?? []) words.push(...board.pairs.map((pair) => wordOf(pair.word)));
  const targets = (source.listenPick?.rounds ?? []).map(listenPickTarget);
  for (const [i, round] of (scope.listenPick?.rounds ?? []).entries()) {
    if (targets[i] === 'word') words.push(wordOf(round.prompt));
    if (targets[i] === 'syllable') syllables.push({ ko: round.prompt.ko, romanization: round.prompt.romanization });
  }
  for (const turn of scope.dialogue ?? []) {
    words.push(...glossed(turn.npcKo, turn.npcRomanization, turn.npcEn));
    for (const option of turn.options) if (option.isCorrect) words.push(...glossed(option.ko, option.romanization, option.en));
  }
  for (const step of scope.storySteps ?? []) if (step.labelKo) words.push(...glossed(step.labelKo, step.romanization, step.labelEn));
  return { words, syllables };
}

/** A story step's words: what its level's recap teaches, from the bundle's (reviewed) story only. */
function storyStepWords(ref: StoryRef, bundle: BrowseBundle, locale: UiLocale): WordFact[] {
  const entry = entryForStory(bundle.storyIndex, ref.storyId);
  return entry ? recapWords(localizeStory(entry.story, locale), ref.level).map(wordOf) : [];
}

function lettersOf(quest: Quest, bundle: BrowseBundle): LetterFact[] {
  return questTeaches(quest).flatMap((jamoId) => {
    const jamo = bundle.jamo.find((j) => j.id === jamoId);
    return jamo ? [{ jamoId, char: jamo.char, romanization: jamo.romanization }] : [];
  });
}

/**
 * A built syllable taught as a bundle word (a word of a topic past draft), with its gloss in the UI
 * language; `null` keeps it a syllable. Matching is by Korean only, so it is strict (heritage accuracy):
 * never in Stage 1, where a built block is a sound and not a word (it may spell a word of another
 * topic by chance), and only when exactly one bundle word has that Korean and it is not one sense of
 * a homonym (`senseGroup`), so no block is glossed with a meaning the lesson never meant.
 */
function bundleWord(bundle: BrowseBundle, locale: UiLocale, stage: string | undefined): (ko: string) => WordFact | null {
  return (ko) => {
    if (stage === undefined || stage === 'stage1') return null;
    const items = bundle.vocabItems.filter((i) => koKey(i.ko) === koKey(ko));
    const item = items.length === 1 ? items[0] : undefined;
    if (!item || item.senseGroup !== undefined) return null;
    return { ko: item.ko, romanization: item.romanization, gloss: localizedGloss(item, locale) };
  };
}

/** Words and syllables of a quest already in the UI language. */
function wordsOf(quest: Quest, bundle: BrowseBundle, locale: UiLocale): { words: WordFact[]; syllables: SyllableFact[] } {
  const local = localizeQuest(quest, locale);
  const wordFor = bundleWord(bundle, locale, episodeOfQuest(bundle, quest.id)?.stage);
  const words: WordFact[] = [];
  const syllables: SyllableFact[] = [];
  for (const step of local.steps) {
    for (const page of step.discover?.pages ?? []) {
      for (const item of page.items) words.push(...discoverItemTexts(item).map(wordOf));
    }
  }
  for (const { minigameRef: ref } of local.steps) {
    if (!ref) continue;
    const story = parseStoryMinigameRef(ref);
    if (story) {
      words.push(...storyStepWords(story, bundle, locale));
      continue;
    }
    const scope = bundle.scopeFor(ref);
    if (!scope) continue;
    const found = scopeWords(localizeScope(scope, ref, locale), scope, wordFor);
    words.push(...found.words);
    syllables.push(...found.syllables);
  }
  const uniqueWords = uniqueByKo(words);
  // A syllable that is also a word (ga, "the sound ga") is listed once, as the word.
  const wordKo = new Set(uniqueWords.map((w) => koKey(w.ko)));
  return { words: uniqueWords, syllables: uniqueByKo(syllables).filter((s) => !wordKo.has(koKey(s.ko))) };
}

function skillsOf(quest: Pick<Quest, 'steps'>): Skill[] {
  const skills = questSkills(quest);
  return SKILLS.filter((s) => skills.has(s));
}

function placeOf(questId: string, bundle: BrowseBundle): QuestPlace | null {
  const story = entryForQuest(bundle.storyIndex, questId);
  if (story?.placement === 'shelf') return { kind: 'story-home', ...homeCellOf(story.story), storyId: story.storyId };
  const episode = episodeOfQuest(bundle, questId);
  if (!episode) return null;
  return {
    kind: 'episode',
    stage: episode.stage,
    theme: episode.theme,
    episodeId: episode.id,
    position: episode.questIds.indexOf(questId) + 1,
    count: episode.questIds.length,
  };
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
    words: items.map((i) => ({
      id: i.id,
      ko: i.ko,
      romanization: i.romanization,
      gloss: localizedGloss(i, locale),
      visual: i.visual,
      speech: { text: i.spokenKo ?? i.ko, ...(i.audioRef !== undefined ? { audioRef: i.audioRef } : {}) },
    })),
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
