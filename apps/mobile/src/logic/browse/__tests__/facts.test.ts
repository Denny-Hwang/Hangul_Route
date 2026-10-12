import type { Quest, Story, StoryLevel } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { localizeQuest, localizeScope, localizeStory } from '../../content-locale';
import { lp, type MinigameScope } from '../../minigame-config';
import { recapWords } from '../../story/recap';
import { storyMinigameRef } from '../../story/story-ref';
import { localizedGloss } from '../../vocab/catalog';
import { questTeaches } from '../../stage1/curriculum';
import { bookEpisode, story, storyQuest } from '../../story/__tests__/shelf-fixture';
import { entryForQuest, type StoryIndexEntry } from '../../story/story-index';
import { buildBrowseBundle, isOpenableEpisode } from '../bundle';
import { episodeOutline, itemFacts, type QuestFacts, type QuestPlace, type StoryFacts, type TopicFacts } from '../facts';
import { CULTURE_ID, DRAFT_ID, TALE_ID, fixtureBundle, fixtureInput, fixtureStories } from './browse-fixture';

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
/** The first lesson of the curriculum (F-QUEST-002): its id is the curriculum's anchor; every value below is read from the bundle. */
const Q1 = 'quest:stage1-letters-q1';
const LETTERS_1 = ['jamo:eo', 'jamo:a', 'jamo:giyeok', 'jamo:nieun'];
const asWord = (t: { ko: string; romanization?: string; en: string }) => ({ ko: t.ko, romanization: t.romanization ?? '', gloss: t.en });
const koKey = (ko: string): string => ko.replace(/[!?.]+$/u, '');
/** The bundled game scopes a quest plays, with their refs. */
const scopesOf = (q: Quest): { ref: string; scope: MinigameScope }[] =>
  q.steps.flatMap((step) => {
    const scope = step.minigameRef ? bundle.scopeFor(step.minigameRef) : undefined;
    return scope && step.minigameRef ? [{ ref: step.minigameRef, scope }] : [];
  });
/** The first bundled lesson (not a story quest) with a scope like this, and that scope: real content, picked by what it holds, never by name. */
function lessonWith(has: (scope: MinigameScope) => boolean): { quest: Quest; ref: string; scope: MinigameScope } {
  for (const q of bundle.quests) {
    if (entryForQuest(bundle.storyIndex, q.id)) continue;
    const found = scopesOf(q).find(({ scope }) => has(scope));
    if (found) return { quest: q, ...found };
  }
  throw new Error('the bundle holds no lesson with such a scope');
}
/** The facts of a one-step lesson that plays `scope` (a scope the bundled content does not hold). */
function withScope(scope: MinigameScope): QuestFacts {
  const ref = 'minigame:browse-facts-test';
  const base = quest(Q1);
  const one: Quest = { ...base, id: 'quest:one-game', steps: [{ id: 's1', kind: 'practice', titleEn: 'Play', minigameKind: scope.kind, minigameRef: ref }] };
  const scopeFor = (r: string): MinigameScope | undefined => (r === ref ? scope : bundle.scopeFor(r));
  return itemFacts({ kind: 'quest', id: one.id }, { ...bundle, quests: [...bundle.quests, one], scopeFor }) as QuestFacts;
}

describe('itemFacts: quest', () => {
  const q1 = questFacts(Q1);
  const discoverOf = (q: Quest, locale: 'en' | 'es' = 'en') =>
    localizeQuest(q, locale)
      .steps.flatMap((step) => step.discover?.pages ?? [])
      .flatMap((page) => page.items)
      .map((item) => (item.type === 'jamo' ? item.example : item.word));

  it('title, minutes, the steps in order and the card it awards', () => {
    const q = quest(Q1);
    expect(q1).toMatchObject({ kind: 'quest', id: Q1, title: q.titleEn, minutes: q.estimatedMinutes, rewardCardId: q.rewardCardId ?? null });
    expect(q1.steps).toEqual(q.steps.map((step) => step.kind));
    expect(q1.rewardCardId).not.toBeNull();
  });

  it('the letters in Discover order, each with its romanization', () => {
    const teaches = questTeaches(quest(Q1));
    expect(teaches.length).toBeGreaterThan(0);
    const letterOf = (id: string) => {
      const jamo = bundle.jamo.find((j) => j.id === id);
      return { jamoId: id, char: jamo?.char, romanization: jamo?.romanization };
    };
    expect(q1.letters).toEqual(teaches.map(letterOf));
    expect(q1.tasteWords).toEqual([]);
    // a letter this bundle does not hold is left out, never shown blank
    const [dropped, ...rest] = teaches as [string, ...string[]];
    const without = itemFacts({ kind: 'quest', id: Q1 }, { ...bundle, jamo: bundle.jamo.filter((j) => j.id !== dropped) }) as QuestFacts;
    expect(without.letters).toEqual(rest.map(letterOf));
  });

  it("words from Discover first (each letter's example word and every word item), then the game scopes, once each, with romanization and gloss", () => {
    const discover = discoverOf(quest(Q1));
    expect(discover.length).toBeGreaterThan(0);
    expect(q1.words[0]).toEqual(asWord(discover[0] as (typeof discover)[number]));
    for (const d of discover) expect(q1.words.some((w) => koKey(w.ko) === koKey(d.ko)), d.ko).toBe(true);
    expect(new Set(q1.words.map((w) => w.ko)).size).toBe(q1.words.length);
    for (const word of q1.words) {
      expect(word.romanization.length, word.ko).toBeGreaterThan(0);
      expect(word.gloss.length, word.ko).toBeGreaterThan(0);
    }
    for (const syllable of q1.syllables) expect(syllable.romanization.length, syllable.ko).toBeGreaterThan(0);
    expect(new Set(q1.syllables.map((s) => s.ko)).size).toBe(q1.syllables.length);
  });

  it('a Pic-Word board adds every word on it', () => {
    const { quest: board, scope } = lessonWith((sc) => (sc.picWord?.boards.length ?? 0) > 0);
    const words = questFacts(board.id).words;
    for (const pair of scope.picWord?.boards.flatMap((b) => b.pairs) ?? []) expect(words, pair.word.ko).toContainEqual(asWord(pair.word));
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

  it('Listen & Pick reads the round builder first: a word round stays a word whatever its options; a syllable round with a meaning teaches that word', () => {
    const bam = { ko: '밤', romanization: 'bam', en: 'night' };
    const bare = (ko: string, romanization: string) => ({ ko, romanization, en: `the syllable ${romanization}` });
    const facts = withScope({
      kind: 'listen-pick',
      listenPick: {
        rounds: [
          // a one-syllable word whose options happen to be one final apart is still a word, with its gloss
          lp.word(bam, [
            { ko: '반', romanization: 'ban', en: 'half' },
            { ko: '발', romanization: 'bal', en: 'foot' },
          ]),
          // a syllable round built with a meaning teaches the word
          lp.syl('물', ['무', '문'], 'water'),
          // a syllable round with no meaning teaches the syllable
          lp.syl('단', ['다', '달']),
          // a hand-written round (no builder id) is read by its shape
          { id: 'hand', prompt: bare('산', 'san'), options: [{ id: '산', text: bare('산', 'san') }, { id: '사', text: bare('사', 'sa') }], answerId: '산' },
        ],
      },
    });
    expect(facts.words).toEqual([
      { ko: '밤', romanization: 'bam', gloss: 'night' },
      { ko: '물', romanization: 'mul', gloss: 'water' },
    ]);
    expect(facts.syllables).toEqual([
      { ko: '단', romanization: 'dan' },
      { ko: '산', romanization: 'san' },
    ]);
  });

  it('a dialogue adds each line and its right reply, the same Korean once; the wrong replies are not taught', () => {
    const { scope } = lessonWith((sc) => (sc.dialogue?.length ?? 0) > 0);
    const facts = withScope(scope);
    const turns = scope.dialogue ?? [];
    const taught = turns.flatMap((t) => [{ ko: t.npcKo, romanization: t.npcRomanization, en: t.npcEn }, ...t.options.filter((o) => o.isCorrect)]);
    const keys = new Set(facts.words.map((w) => koKey(w.ko)));
    for (const line of taught.filter((t) => t.romanization)) expect(keys.has(koKey(line.ko)), line.ko).toBe(true);
    const wrongOnly = turns.flatMap((t) => t.options.filter((o) => !o.isCorrect)).filter((o) => !taught.some((t) => koKey(t.ko) === koKey(o.ko)));
    expect(wrongOnly.length).toBeGreaterThan(0);
    for (const wrong of wrongOnly) expect(keys.has(koKey(wrong.ko)), wrong.ko).toBe(false);
    expect(keys.size).toBe(facts.words.length);
    // a line and a reply that differ only in the closing mark are one entry, the first one met
    const hello = { ko: '안녕하세요!', romanization: 'annyeonghaseyo', en: 'Hello!' };
    const echo = withScope({ kind: 'tap-respond', dialogue: [{ npcKo: hello.ko, npcRomanization: hello.romanization, npcEn: hello.en, options: [{ ...hello, ko: '안녕하세요', en: 'Hello', isCorrect: true }] }] });
    expect(echo.words).toEqual([asWord(hello)]);
    // a line with no romanization is left out, never shown without it
    const bare = withScope({ kind: 'tap-respond', dialogue: [{ npcKo: '네', npcEn: 'Yes', options: [{ ko: '네', en: 'Yes', isCorrect: true }] }] });
    expect(bare.words).toEqual([]);
  });

  it('story steps add their Korean labels; a label with no Korean or no romanization adds nothing', () => {
    const { quest: order, scope } = lessonWith((sc) => (sc.storySteps ?? []).some((step) => step.labelKo && step.romanization));
    const words = questFacts(order.id).words;
    for (const step of scope.storySteps ?? []) {
      if (step.labelKo && step.romanization) expect(words, step.labelKo).toContainEqual({ ko: step.labelKo, romanization: step.romanization, gloss: step.labelEn });
    }
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
    for (const q of bundle.quests) {
      const en = itemFacts({ kind: 'quest', id: q.id }, bundle, 'en') as QuestFacts | null;
      const es = itemFacts({ kind: 'quest', id: q.id }, bundle, 'es') as QuestFacts | null;
      expect(es?.words.map((w) => [w.ko, w.romanization]), q.id).toEqual(en?.words.map((w) => [w.ko, w.romanization]));
    }
    const { quest: talk, ref } = lessonWith((sc) => (sc.dialogue ?? []).some((t) => t.npcRomanization));
    const turn = localizeScope(bundle.scopeFor(ref) as MinigameScope, ref, 'es').dialogue?.find((t) => t.npcRomanization);
    expect(questFacts(talk.id, 'es').words.find((w) => koKey(w.ko) === koKey(turn?.npcKo ?? ''))).toEqual({ ko: turn?.npcKo, romanization: turn?.npcRomanization, gloss: turn?.npcEn });
  });

  it('every bundled lesson lists every word its boards, word rounds, syllable rounds with a meaning, dialogues and story steps practise', () => {
    for (const q of bundle.quests) {
      const facts = itemFacts({ kind: 'quest', id: q.id }, bundle) as QuestFacts | null;
      if (!facts) continue;
      const listed = new Set(facts.words.map((w) => w.ko.replace(/[!?.]+$/u, '')));
      for (const step of q.steps) {
        const scope = step.minigameRef ? bundle.scopeFor(step.minigameRef) : undefined;
        if (!scope) continue;
        const expected = [
          ...(scope.picWord?.boards ?? []).flatMap((b) => b.pairs.map((p) => p.word.ko)),
          ...(scope.listenPick?.rounds ?? [])
            .filter((r) => /^lp:(word|pic):/.test(r.id) || (/^lp:syl:/.test(r.id) && r.prompt.en !== `the syllable ${r.prompt.romanization}`))
            .map((r) => r.prompt.ko),
          ...(scope.dialogue ?? []).flatMap((t) => [t.npcKo, ...t.options.filter((o) => o.isCorrect).map((o) => o.ko)]),
          ...(scope.storySteps ?? []).flatMap((s) => (s.labelKo ? [s.labelKo] : [])),
        ];
        for (const ko of expected) expect(listed.has(ko.replace(/[!?.]+$/u, '')), `${q.id} ${ko}`).toBe(true);
      }
    }
  });

  it('a syllable that is also a word is listed once, as the word (never twice under "What this teaches")', () => {
    const both = withScope({
      kind: 'syllable-build',
      cardPairs: [{ ko: '가', romanization: 'ga', en: 'the sound ga' }],
      syllables: [
        { ko: '가', romanization: 'ga', jamoChars: ['ㄱ', 'ㅏ'] },
        { ko: '너', romanization: 'neo', jamoChars: ['ㄴ', 'ㅓ'] },
      ],
    });
    expect(both.words).toEqual([{ ko: '가', romanization: 'ga', gloss: 'the sound ga' }]);
    expect(both.syllables).toEqual([{ ko: '너', romanization: 'neo' }]);
    for (const q of bundle.quests) {
      const facts = itemFacts({ kind: 'quest', id: q.id }, bundle) as QuestFacts | null;
      if (!facts) continue;
      const words = new Set(facts.words.map((w) => w.ko));
      expect(facts.syllables.filter((s) => words.has(s.ko)), q.id).toEqual([]);
    }
  });

  it('Discover glosses follow the UI language; the Korean and its romanization never change', () => {
    const es = questFacts(Q1, 'es');
    expect(es.words[0]).toEqual(asWord(discoverOf(quest(Q1), 'es')[0] as { ko: string; romanization: string; en: string }));
    expect(es.words.map((w) => [w.ko, w.romanization])).toEqual(q1.words.map((w) => [w.ko, w.romanization]));
  });

  it('skills are read, listen and write in that order, never speaking', () => {
    expect(q1.skills.length).toBeGreaterThan(0);
    for (const q of bundle.quests) {
      const facts = itemFacts({ kind: 'quest', id: q.id }, bundle) as QuestFacts | null;
      if (!facts) continue;
      for (const skill of facts.skills) expect(['read', 'listen', 'write']).toContain(skill);
      expect([...facts.skills]).toEqual(['read', 'listen', 'write'].filter((s) => facts.skills.includes(s as never)));
    }
  });

  it("where it sits: a lesson's stage, theme and its place in the episode", () => {
    for (const episode of bundle.episodes.filter((e) => e.placement !== 'shelf' && isOpenableEpisode(e))) {
      episode.questIds.forEach((id, i) => {
        expect(questFacts(id).where, id).toEqual({ kind: 'episode', stage: episode.stage, theme: episode.theme, episodeId: episode.id, position: i + 1, count: episode.questIds.length });
      });
    }
  });

  it("a shelf story's own quest sits where its story does: the home cell, with no lesson position", () => {
    const far = story('river-day', { recommendedStage: 3, theme: 'life' });
    const withFar = buildBrowseBundle(fixtureInput([...fixtureStories(), far]));
    const entry = withFar.storyIndex.find((e) => e.storyId === far.id) as StoryIndexEntry;
    // the shelf episode a story quest lives in is not a grid cell, so it never names the place
    expect(withFar.episodes.find((e) => e.id === entry.episodeId)).toMatchObject({ placement: 'shelf', stage: 'stage1' });
    const facts = itemFacts({ kind: 'quest', id: entry.questId }, withFar) as QuestFacts;
    expect(facts.where).toEqual({ kind: 'story-home', stage: 'stage3', theme: 'life', storyId: far.id });
    const storyWhere = (itemFacts({ kind: 'story', id: far.id }, withFar) as StoryFacts).where;
    expect({ stage: facts.where?.stage, theme: facts.where?.theme }).toEqual(storyWhere);
    for (const shelf of bundle.storyIndex) expect((questFacts(shelf.questId).where as QuestPlace).kind, shelf.questId).toBe('story-home');
  });

  it("a book story's quest sits in its book, the grid cell, with its place there", () => {
    const tale = fixtureStories()[0] as Story;
    const bookQuest = { ...storyQuest('hangul-day', 'read-along'), titleEn: 'Read along', estimatedMinutes: 5 } as Quest;
    const book = bookEpisode('episode:stage5-letters', [bookQuest.id]);
    const input = fixtureInput([tale]);
    const withBook = buildBrowseBundle({ ...input, episodes: [...input.episodes.filter((e) => e.id !== book.id), book], quests: [...input.quests, bookQuest] });
    expect(withBook.storyIndex.find((e) => e.questId === bookQuest.id)?.placement).toBe('grid');
    expect((itemFacts({ kind: 'quest', id: bookQuest.id }, withBook) as QuestFacts).where).toEqual({
      kind: 'episode',
      stage: 'stage5',
      theme: 'letters',
      episodeId: book.id,
      position: 1,
      count: 1,
    });
  });

  it('a taste quest that introduces no letter shows its first three words, glossed in the UI language', () => {
    const tastes = bundle.quests.flatMap((q) => {
      const facts = entryForQuest(bundle.storyIndex, q.id) ? null : (itemFacts({ kind: 'quest', id: q.id }, bundle) as QuestFacts | null);
      return facts && facts.letters.length === 0 && facts.words.length >= 3 ? [facts] : [];
    });
    expect(tastes.length).toBeGreaterThan(0);
    for (const taste of tastes) expect(taste.tasteWords, taste.id).toEqual(taste.words.slice(0, 3));
    // in Spanish, its first word's gloss is the localized one of the scope it comes from
    const taste = tastes[0] as QuestFacts;
    const es = questFacts(taste.id, 'es');
    const first = scopesOf(quest(taste.id))
      .map(({ ref, scope }) => localizeScope(scope, ref, 'es'))
      .flatMap((scope) => scope.cardPairs ?? [])
      .find((pair) => pair.ko === es.tasteWords[0]?.ko);
    expect(first).toBeDefined();
    expect(es.tasteWords[0]?.gloss).toBe(first?.en);
  });

  it('the focus line: only for a letter this lesson introduces', () => {
    const focus = q1.letters[q1.letters.length - 1] as QuestFacts['letters'][number];
    expect(questFacts(Q1, 'en', focus.jamoId).focus).toEqual(focus);
    const other = bundle.jamo.find((j) => !questTeaches(quest(Q1)).includes(j.id));
    expect(questFacts(Q1, 'en', other?.id).focus).toBeNull();
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
    const base = quest(Q1);
    const games = base.steps.filter((s) => s.minigameRef);
    expect(games.length).toBeGreaterThan(0);
    const unscoped: Quest = { ...base, id: 'quest:unscoped', steps: games.map((s) => ({ ...s, minigameRef: 'minigame:not-bundled' })) };
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
    const first = questFacts(episode?.questIds[0] ?? '');
    expect(outline?.quests[0]).toEqual({ id: first.id, title: first.title, minutes: first.minutes, letters: first.letters, tasteWords: first.tasteWords, skills: first.skills });
    expect(outline?.quests[0]?.letters.length).toBeGreaterThan(0);
    expect(outline?.rewardCardIds).toEqual(episode?.rewardCardIds);
    expect(outline?.stories).toEqual([]);
  });

  it('a taste episode shows first words, a story episode its stories, a placeholder "Coming later"', () => {
    const taste = bundle.episodes.flatMap((e) => (isOpenableEpisode(e) && e.placement !== 'shelf' ? (episodeOutline(e.id, bundle)?.quests ?? []) : [])).find((row) => row.letters.length === 0 && row.tasteWords.length > 0);
    expect(taste?.tasteWords).toEqual(questFacts(taste?.id ?? '').tasteWords);
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
    expect(es?.quests[0]?.title).toBe(localizeQuest(quest(Q1), 'es').titleEn);
  });
});

describe('production content anchors (change these with the content they name)', () => {
  it('the first lesson introduces a, eo, g and n (F-QUEST-002 section 3.3)', () => {
    expect(questFacts(Q1).letters.map((l) => l.jamoId)).toEqual(['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun']);
  });

  it('the first life lesson lists the food words its Pic-Word board teaches (the case the Codex review of #393 found)', () => {
    expect(questFacts('quest:stage1-life-q1').words.map((w) => w.ko)).toEqual(expect.arrayContaining(['김치', '밥', '김밥', '젓가락']));
  });
});
