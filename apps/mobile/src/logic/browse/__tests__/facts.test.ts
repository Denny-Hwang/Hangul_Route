import type { Quest, Story, StoryLevel } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { localizeQuest, localizeScope, localizeStory } from '../../content-locale';
import { lp, type MinigameScope } from '../../minigame-config';
import { recapWords } from '../../story/recap';
import { storyMinigameRef } from '../../story/story-ref';
import { localizedGloss } from '../../vocab/catalog';
import { questTeaches } from '../../stage1/curriculum';
import { episodeOutline, itemFacts, type QuestFacts, type StoryFacts, type TopicFacts } from '../facts';
import { CULTURE_ID, DRAFT_ID, TALE_ID, fixtureBundle } from './browse-fixture';

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
const LETTERS_1 = ['jamo:eo', 'jamo:a', 'jamo:giyeok', 'jamo:nieun'];
/** The facts of a one-step lesson that plays `scope` (a scope the bundled content does not hold). */
function withScope(scope: MinigameScope): QuestFacts {
  const ref = 'minigame:browse-facts-test';
  const base = quest('quest:stage2-life-q1');
  const one: Quest = { ...base, id: 'quest:one-game', steps: [{ id: 's1', kind: 'practice', titleEn: 'Play', minigameKind: scope.kind, minigameRef: ref }] };
  const scopeFor = (r: string): MinigameScope | undefined => (r === ref ? scope : bundle.scopeFor(r));
  return itemFacts({ kind: 'quest', id: one.id }, { ...bundle, quests: [...bundle.quests, one], scopeFor }) as QuestFacts;
}

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

  it('a Pic-Word board adds every word on it (quest 4 teaches its food words only there)', () => {
    const life = questFacts('quest:stage1-life-q1');
    expect(life.words).toEqual(
      expect.arrayContaining([
        { ko: '김치', romanization: 'gimchi', gloss: 'kimchi' },
        { ko: '밥', romanization: 'bap', gloss: 'rice' },
        { ko: '김밥', romanization: 'gimbap', gloss: 'kimbap' },
        { ko: '젓가락', romanization: 'jeotgarak', gloss: 'chopsticks' },
      ]),
    );
  });

  it('Listen & Pick adds what each round asks for: a word or picture round its word, a syllable round its syllable; never a letter round or a wrong option', () => {
    const namu = { ko: '나무', romanization: 'namu', en: 'tree' };
    const neo = { ko: '너', romanization: 'neo', en: 'you' };
    const gimchi = { ko: '김치', romanization: 'gimchi', en: 'kimchi' };
    const dal = { ko: '달', romanization: 'dal', en: 'moon' };
    const facts = withScope({
      kind: 'listen-pick',
      listenPick: {
        rounds: [
          lp.sym('jamo:eo', LETTERS_1, { optionIds: LETTERS_1 }),
          lp.syl('단', ['다', '달']),
          lp.word(namu, [
            { ko: '너무', romanization: 'neomu', en: 'too much' },
            { ko: '가구', romanization: 'gagu', en: 'furniture' },
          ]),
          // a one-syllable word whose options are not one final apart is still a word
          lp.word(neo, [
            { ko: '가', romanization: 'ga', en: 'the sound ga' },
            { ko: '나', romanization: 'na', en: 'I, me' },
          ]),
          lp.pic(gimchi, ['card:kimchi', 'card:rice']),
          // one block, but a picture among the options: not a syllable round
          { id: 'mixed', prompt: dal, options: [{ id: '달', text: dal }, { id: 'card:rice', pictureRef: 'card:rice', labelEn: 'Rice' }], answerId: '달' },
        ],
      },
    });
    expect(facts.words).toEqual([namu, neo, gimchi, dal].map(({ ko, romanization, en }) => ({ ko, romanization, gloss: en })));
    expect(facts.syllables).toEqual([{ ko: '단', romanization: 'dan' }]);
  });

  it('a dialogue adds each line and its right reply, the same Korean once; the wrong replies are not taught', () => {
    const greet = questFacts('quest:stage4-rites-q1');
    expect(greet.words).toEqual(
      expect.arrayContaining([
        { ko: '이름이 뭐예요?', romanization: 'ireumi mwoyeyo', gloss: "What's your name?" },
        { ko: '저는 호야예요', romanization: 'jeoneun hoyayeyo', gloss: 'I am Hoya' },
        { ko: '저도 반가워요', romanization: 'jeodo bangawoyo', gloss: 'Nice to meet you too' },
      ]),
    );
    expect(greet.words.map((w) => w.ko)).not.toContain('잘 가요');
    // "안녕하세요!" and the reply "안녕하세요" differ only in the mark
    expect(greet.words.filter((w) => w.ko.startsWith('안녕하세요'))).toEqual([{ ko: '안녕하세요!', romanization: 'annyeonghaseyo', gloss: 'Hello!' }]);
    // the taste words still come first from the opening card pairs
    expect(greet.tasteWords.map((w) => w.ko)).toEqual(['안녕', '감사', '친구']);
    // a line with no romanization is left out, never shown without it
    const bare = withScope({ kind: 'tap-respond', dialogue: [{ npcKo: '네', npcEn: 'Yes', options: [{ ko: '네', en: 'Yes', isCorrect: true }] }] });
    expect(bare.words).toEqual([]);
  });

  it('story steps add their Korean labels; a label with no Korean or no romanization adds nothing', () => {
    const crafts = questFacts('quest:stage1-crafts-q1');
    expect(crafts.words).toEqual(
      expect.arrayContaining([
        { ko: '편 가르기', romanization: 'pyeon gareugi', gloss: 'Pick teams' },
        { ko: '윷 던지기', romanization: 'yut deonjigi', gloss: 'Throw the yut' },
      ]),
    );
    const bare = withScope({ kind: 'story-sequence', storySteps: [{ id: 'a', labelEn: 'Wake up' }, { id: 'b', labelEn: 'Eat', labelKo: '먹기' }] });
    expect(bare.words).toEqual([]);
  });

  it("a story quest adds the words its level recaps, from the bundle's reviewed story", () => {
    const entry = bundle.storyIndex.find((e) => e.storyId === TALE_ID);
    const facts = questFacts(entry?.questId ?? '');
    const recap = recapWords(entry?.story as Story, entry?.level as StoryLevel);
    expect(recap.length).toBeGreaterThan(0);
    expect(facts.words).toEqual(recap.map((w) => ({ ko: w.ko, romanization: w.romanization, gloss: w.en })));
    // a step that names a story the bundle does not list (unreviewed or not shipped) adds nothing
    const base = quest('quest:stage2-life-q1');
    const elsewhere: Quest = {
      ...base,
      id: 'quest:story-elsewhere',
      steps: [{ id: 's1', kind: 'practice', titleEn: 'Read', minigameKind: 'story-read', minigameRef: storyMinigameRef('read', 'listen', DRAFT_ID) }],
    };
    const none = itemFacts({ kind: 'quest', id: elsewhere.id }, { ...bundle, quests: [...bundle.quests, elsewhere] }) as QuestFacts;
    expect(none.words).toEqual([]);
  });

  it('game glosses follow the UI language; the Korean and its romanization never change', () => {
    for (const id of ['quest:stage1-life-q1', 'quest:stage4-rites-q1', 'quest:stage1-crafts-q1']) {
      const en = questFacts(id);
      const es = questFacts(id, 'es');
      expect(es.words.map((w) => [w.ko, w.romanization]), id).toEqual(en.words.map((w) => [w.ko, w.romanization]));
    }
    const ref = 'minigame:s4-rites-respond-1';
    const turn = localizeScope(bundle.scopeFor(ref) ?? { kind: 'tap-respond' }, ref, 'es').dialogue?.[1];
    expect(questFacts('quest:stage4-rites-q1', 'es').words).toContainEqual({ ko: turn?.npcKo, romanization: turn?.npcRomanization, gloss: turn?.npcEn });
  });

  it('every bundled lesson lists every word its boards, word rounds, dialogues and story steps practise', () => {
    for (const q of bundle.quests) {
      const facts = itemFacts({ kind: 'quest', id: q.id }, bundle) as QuestFacts | null;
      if (!facts) continue;
      const listed = new Set(facts.words.map((w) => w.ko.replace(/[!?.]+$/u, '')));
      for (const step of q.steps) {
        const scope = step.minigameRef ? bundle.scopeFor(step.minigameRef) : undefined;
        if (!scope) continue;
        const expected = [
          ...(scope.picWord?.boards ?? []).flatMap((b) => b.pairs.map((p) => p.word.ko)),
          ...(scope.listenPick?.rounds ?? []).filter((r) => /^lp:(word|pic):/.test(r.id)).map((r) => r.prompt.ko),
          ...(scope.dialogue ?? []).flatMap((t) => [t.npcKo, ...t.options.filter((o) => o.isCorrect).map((o) => o.ko)]),
          ...(scope.storySteps ?? []).flatMap((s) => (s.labelKo ? [s.labelKo] : [])),
        ];
        for (const ko of expected) expect(listed.has(ko.replace(/[!?.]+$/u, '')), `${q.id} ${ko}`).toBe(true);
      }
    }
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
