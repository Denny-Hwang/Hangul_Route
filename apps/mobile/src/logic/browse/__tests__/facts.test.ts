import type { Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { localizeQuest, localizeScope, localizeStory } from '../../content-locale';
import { localizedGloss } from '../../vocab/catalog';
import { questTeaches } from '../../stage1/curriculum';
import { episodeOutline, itemFacts, type QuestFacts, type StoryFacts, type TopicFacts } from '../facts';
import { CULTURE_ID, TALE_ID, fixtureBundle } from './browse-fixture';

/**
 * F-BROWSE-001 §4.6 (BR-4): "what this teaches" for a lesson, a story and a
 * word topic, and the episode outline. Read from the bundle; taught Korean
 * always with romanization and a gloss in the UI language; skills are read,
 * listen and write, never speaking.
 */
const bundle = fixtureBundle();
const quest = (id: string): Quest => bundle.quests.find((q) => q.id === id) as Quest;
const questFacts = (id: string, locale: 'en' | 'es' | 'ko' = 'en', focusJamoId?: string): QuestFacts =>
  itemFacts({ kind: 'quest', id, ...(focusJamoId ? { focusJamoId } : {}) }, bundle, locale) as QuestFacts;

describe('itemFacts: quest', () => {
  const q1 = questFacts('quest:stage1-letters-q1');

  it('title, minutes, the steps in order and the card it awards', () => {
    expect(q1).toMatchObject({ kind: 'quest', id: 'quest:stage1-letters-q1', title: 'Meet a, eo, g, n', minutes: 5, rewardCardId: 'card:book' });
    expect(q1.steps).toEqual(['intro', 'discover', 'practice', 'apply', 'check', 'reward']);
  });

  it('the letters in Discover order, each with its romanization', () => {
    expect(q1.letters.map((l) => l.jamoId)).toEqual(questTeaches(quest('quest:stage1-letters-q1')));
    expect(q1.letters.map((l) => [l.char, l.romanization])).toEqual([
      ['ㅏ', 'a'],
      ['ㅓ', 'eo'],
      ['ㄱ', 'g/k'],
      ['ㄴ', 'n'],
    ]);
    expect(q1.tasteWords).toEqual([]);
    // a letter this bundle does not hold is left out, never shown blank
    const without = itemFacts({ kind: 'quest', id: 'quest:stage1-letters-q1' }, { ...bundle, jamo: bundle.jamo.filter((j) => j.id !== 'jamo:a') }) as QuestFacts;
    expect(without.letters.map((l) => l.char)).toEqual(['ㅓ', 'ㄱ', 'ㄴ']);
  });

  it('words from Discover and the game scopes, once each, with romanization and gloss', () => {
    expect(q1.words.slice(0, 3)).toEqual([
      { ko: '나', romanization: 'na', gloss: 'I, me' },
      { ko: '너', romanization: 'neo', gloss: 'you' },
      { ko: '가', romanization: 'ga', gloss: 'the sound ga' },
    ]);
    expect(new Set(q1.words.map((w) => w.ko)).size).toBe(q1.words.length);
    for (const word of q1.words) {
      expect(word.romanization.length, word.ko).toBeGreaterThan(0);
      expect(word.gloss.length, word.ko).toBeGreaterThan(0);
    }
    for (const syllable of q1.syllables) expect(syllable.romanization.length, syllable.ko).toBeGreaterThan(0);
    expect(new Set(q1.syllables.map((s) => s.ko)).size).toBe(q1.syllables.length);
  });

  it('a syllable that is also a word is listed once, as the word (never twice under "What this teaches")', () => {
    expect(q1.words.map((w) => w.ko)).toContain('가');
    expect(q1.syllables.map((s) => s.ko)).not.toContain('가');
    for (const q of bundle.quests) {
      const facts = itemFacts({ kind: 'quest', id: q.id }, bundle) as QuestFacts | null;
      if (!facts) continue;
      const words = new Set(facts.words.map((w) => w.ko));
      expect(facts.syllables.filter((s) => words.has(s.ko)), q.id).toEqual([]);
    }
  });

  it('glosses follow the UI language; the Korean and its romanization never change', () => {
    const es = questFacts('quest:stage1-letters-q1', 'es');
    const localized = localizeQuest(quest('quest:stage1-letters-q1'), 'es');
    const discover = localized.steps.find((s) => s.kind === 'discover');
    const first = discover?.discover?.pages[0]?.items[0];
    expect(first?.type).toBe('jamo');
    expect(es.words[0]).toEqual({ ko: '나', romanization: 'na', gloss: first?.type === 'jamo' ? first.example.en : '' });
    expect(es.words.map((w) => [w.ko, w.romanization])).toEqual(q1.words.map((w) => [w.ko, w.romanization]));
  });

  it('skills are read, listen and write in that order, never speaking', () => {
    expect(q1.skills).toEqual(['read', 'listen']);
    for (const q of bundle.quests) {
      const facts = itemFacts({ kind: 'quest', id: q.id }, bundle) as QuestFacts | null;
      if (!facts) continue;
      for (const skill of facts.skills) expect(['read', 'listen', 'write']).toContain(skill);
      expect([...facts.skills]).toEqual(['read', 'listen', 'write'].filter((s) => facts.skills.includes(s as never)));
    }
  });

  it('where it sits: stage, theme and its place in the episode', () => {
    expect(questFacts('quest:stage1-letters-q2').where).toEqual({ stage: 'stage1', theme: 'letters', episodeId: 'episode:stage1-letters', position: 2, count: 3 });
    expect(questFacts('quest:stage4-rites-q1').where).toEqual({ stage: 'stage4', theme: 'rites', episodeId: 'episode:stage4-rites', position: 1, count: 1 });
  });

  it('a taste quest that introduces no letter shows its first three words, glossed in the UI language', () => {
    const taste = questFacts('quest:stage2-life-q1');
    expect(taste.letters).toEqual([]);
    expect(taste.tasteWords).toEqual([
      { ko: '사과', romanization: 'sagwa', gloss: 'Apple' },
      { ko: '우유', romanization: 'uyu', gloss: 'Milk' },
      { ko: '빵', romanization: 'ppang', gloss: 'Bread' },
    ]);
    const es = questFacts('quest:stage2-life-q1', 'es');
    const scope = localizeScope(bundle.scopeFor('minigame:s2-life-card-1') ?? { kind: 'card-match' }, 'minigame:s2-life-card-1', 'es');
    expect(es.tasteWords[0]?.gloss).toBe(scope.cardPairs?.[0]?.en);
  });

  it('the focus line: only for a letter this lesson introduces', () => {
    expect(questFacts('quest:stage1-letters-q1', 'en', 'jamo:nieun').focus).toEqual({ jamoId: 'jamo:nieun', char: 'ㄴ', romanization: 'n' });
    expect(questFacts('quest:stage1-letters-q1', 'en', 'jamo:mieum').focus).toBeNull();
    expect(q1.focus).toBeNull();
  });

  it('a quest no openable episode lists sits nowhere, and an unknown quest has no facts', () => {
    const loose: Quest = { ...quest('quest:stage1-letters-q1'), id: 'quest:loose', rewardCardId: undefined };
    const facts = itemFacts({ kind: 'quest', id: 'quest:loose' }, { ...bundle, quests: [...bundle.quests, loose] }) as QuestFacts;
    expect(facts.where).toBeNull();
    expect(facts.rewardCardId).toBeNull();
    expect(itemFacts({ kind: 'quest', id: 'quest:nope' }, bundle)).toBeNull();
  });

  it('a game step whose scope the bundle lacks adds no words', () => {
    const base = quest('quest:stage2-life-q1');
    const unscoped: Quest = { ...base, id: 'quest:unscoped', steps: base.steps.map((s) => (s.minigameRef ? { ...s, minigameRef: 'minigame:not-bundled' } : s)) };
    const facts = itemFacts({ kind: 'quest', id: 'quest:unscoped' }, { ...bundle, quests: [...bundle.quests, unscoped] }) as QuestFacts;
    expect(facts.words).toEqual([]);
    expect(facts.syllables).toEqual([]);
    expect(facts.tasteWords).toEqual([]);
  });
});

describe('itemFacts: story', () => {
  const tale = itemFacts({ kind: 'story', id: TALE_ID }, bundle) as StoryFacts;
  const entry = bundle.storyIndex.find((e) => e.storyId === TALE_ID);

  it('levels offered with their scene counts, the lowest first and picked by default', () => {
    expect(tale.levels).toEqual(entry?.story.tiers.map((t) => ({ level: t.level, scenes: t.scenes.length })));
    expect(tale.levels.map((l) => l.level)).toEqual(['listen', 'read-along']);
    expect(tale.defaultLevel).toBe('listen');
  });

  it('title, minutes, the story quest and its home cell', () => {
    expect(tale).toMatchObject({ kind: 'story', id: TALE_ID, minutes: entry?.minutes, questId: entry?.questId, where: { stage: 'stage1', theme: 'letters' } });
    expect(tale.title).toEqual({ ko: entry?.story.title.ko, romanization: entry?.story.title.romanization, gloss: entry?.story.title.en });
  });

  it('key words with romanization and gloss in the UI language', () => {
    expect(tale.keywords.map((k) => k.ko)).toEqual(entry?.story.keywords.map((k) => k.ko));
    const es = itemFacts({ kind: 'story', id: TALE_ID }, bundle, 'es') as StoryFacts;
    const local = localizeStory(entry?.story as NonNullable<typeof entry>['story'], 'es');
    expect(es.keywords.map((k) => k.gloss)).toEqual(local.keywords.map((k) => k.en));
    for (const k of tale.keywords) expect(k.romanization.length).toBeGreaterThan(0);
  });

  it('a culture story reads the same way; an unreviewed or unknown story has no facts', () => {
    expect((itemFacts({ kind: 'story', id: CULTURE_ID }, bundle) as StoryFacts).id).toBe(CULTURE_ID);
    expect(itemFacts({ kind: 'story', id: 'story:draft-tale' }, bundle)).toBeNull();
  });

  it('a book story sits in its own grid cell', () => {
    const entryOf = bundle.storyIndex[0] as NonNullable<typeof entry>;
    const book = { ...entryOf, placement: 'grid' as const, episodeId: 'episode:stage1-crafts', stage: 'stage1' as const };
    const facts = itemFacts({ kind: 'story', id: book.storyId }, { ...bundle, storyIndex: [book] }) as StoryFacts;
    expect(facts.where).toEqual({ stage: 'stage1', theme: 'crafts' });
    // a book whose episode this bundle lacks falls back to the entry's own stage and theme
    const orphan = { ...book, episodeId: 'episode:not-bundled', stage: 'stage5' as const };
    expect((itemFacts({ kind: 'story', id: book.storyId }, { ...bundle, storyIndex: [orphan] }) as StoryFacts).where).toEqual({ stage: 'stage5', theme: orphan.theme });
  });
});

describe('itemFacts: word topic', () => {
  it('every word with romanization, gloss in the UI language and its picture', () => {
    const food = itemFacts({ kind: 'vocab-topic', id: 'vocab-topic:food' }, bundle, 'es') as TopicFacts;
    const items = bundle.topicItems('food');
    expect(food).toMatchObject({ kind: 'vocab-topic', id: 'vocab-topic:food', key: 'food', count: items.length });
    expect(food.words).toEqual(items.map((i) => ({ id: i.id, ko: i.ko, romanization: i.romanization, gloss: localizedGloss(i, 'es'), visual: i.visual })));
    expect(food.titleKo.romanization.length).toBeGreaterThan(0);
    expect(itemFacts({ kind: 'vocab-topic', id: 'vocab-topic:space' }, bundle)).toBeNull();
  });
});

describe('episodeOutline', () => {
  it('the episode as its learner page introduces it, its lessons in order and its cards', () => {
    const outline = episodeOutline('episode:stage1-letters', bundle);
    const episode = bundle.episodes.find((e) => e.id === 'episode:stage1-letters');
    expect(outline?.episode.titleEn).toBe(episode?.titleEn);
    expect(outline?.comingLater).toBe(false);
    expect(outline?.quests.map((q) => q.id)).toEqual(episode?.questIds);
    expect(outline?.minutes).toBe(episode?.questIds.reduce((sum, id) => sum + quest(id).estimatedMinutes, 0));
    expect(outline?.quests[0]).toMatchObject({ id: 'quest:stage1-letters-q1', title: 'Meet a, eo, g, n', minutes: 5, skills: ['read', 'listen'] });
    expect(outline?.quests[0]?.letters.map((l) => l.char)).toEqual(['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ']);
    expect(outline?.rewardCardIds).toEqual(episode?.rewardCardIds);
    expect(outline?.stories).toEqual([]);
  });

  it('a taste episode shows first words, a story episode its stories, a placeholder "Coming later"', () => {
    expect(episodeOutline('episode:stage2-life', bundle)?.quests[0]?.tasteWords.map((w) => w.ko)).toEqual(['사과', '우유', '빵']);
    const shelf = bundle.storyIndex.find((e) => e.storyId === TALE_ID);
    expect(episodeOutline(shelf?.episodeId ?? '', bundle)?.stories.map((s) => s.storyId)).toEqual([TALE_ID]);
    const preview = bundle.episodes.find((e) => e.status === 'preview');
    expect(episodeOutline(preview?.id ?? '', bundle)).toMatchObject({ comingLater: true, quests: [], stories: [], rewardCardIds: [], minutes: 0 });
    expect(episodeOutline('episode:nope', bundle)).toBeNull();
    // an unreviewed story's shelf episode is not in this bundle: no title, no minutes
    expect(episodeOutline('episode:shelf-draft-tale', bundle)).toBeNull();
    expect(itemFacts({ kind: 'quest', id: 'quest:story-draft-tale-listen' }, bundle)).toBeNull();
  });

  it('titles follow the UI language', () => {
    const es = episodeOutline('episode:stage1-letters', bundle, 'es');
    expect(es?.quests[0]?.title).toBe(localizeQuest(quest('quest:stage1-letters-q1'), 'es').titleEn);
  });
});
