import { LectureDeckSchema, type LectureBlock, type Overlays } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodeById, episodesAll, jamoAll, questById, questsAll } from '../../../content';
import { storiesAll } from '../../../content/stories';
import { buildStoryIndex } from '../../story/story-index';
import { scopeFor } from '../../minigame-config';
import { expandDeck } from '../deck-builder';
import { PAUSE_WORD, lectureBundle } from '../content';
import { VOCAB_ITEMS, VOCAB_TOPICS } from '../../../content/__generated__/vocab';
import { bookQuests } from '../../../content/books';
import { supportedCardIds } from '@hangul-route/design-system/heritage-card-ids';
import { WORD_ART_KEYS } from '@hangul-route/design-system/word-art';
import { vocabArt } from '../slide-view';

const deck = (blocks: LectureBlock[]) =>
  LectureDeckSchema.parse({ v: 1, id: 'lecture:ship01', title: 'All of it', createdAt: '2026-10-11T09:00:00Z', seed: 1, blocks });

const listedStoryIds = [
  ...new Set(buildStoryIndex({ stories: storiesAll, episodes: episodesAll, quests: questsAll, showUnreviewed: false }).map((e) => e.storyId)),
];

const shippedEpisodes = episodesAll.filter((e) => e.status !== 'preview' && e.questIds.length > 0);

describe('the presenter content bundle (F-TCH-004 §3.3, §3.13)', () => {
  it('the Pause word is taught Korean with romanization and a gloss (no Hangul in a UI message)', () => {
    expect(PAUSE_WORD).toEqual({ ko: '잠깐', romanization: 'jamkkan', glossKey: 'learner.presenter.pause.gloss', en: 'wait a moment' });
  });

  it('looks up the bundled content', () => {
    const b = lectureBundle('en');
    expect(b.jamoAll).toBe(jamoAll);
    // Read from the bundled content rather than copied, so a content edit to the quest does not break this test.
    const q1 = questsAll.find((q) => q.id === 'quest:stage1-letters-q1');
    const letters = episodesAll.find((e) => e.id === 'episode:stage1-letters');
    expect(q1?.titleEn).toEqual(expect.any(String));
    expect(letters?.titleEn).toEqual(expect.any(String));
    expect(b.questById('quest:stage1-letters-q1')).toBe(questById('quest:stage1-letters-q1'));
    expect(b.questById('quest:stage1-letters-q1')?.titleEn).toBe(q1?.titleEn);
    expect(b.episodeById('episode:stage1-letters')).toBe(episodeById('episode:stage1-letters'));
    expect(b.episodeById('episode:stage1-letters')?.titleEn).toBe(letters?.titleEn);
    expect(b.cardById('card:book')?.subtitleKo).toBe('책');
    const playRef = q1!.steps.find((s) => s.minigameRef !== undefined)!.minigameRef!;
    expect(b.scopeFor(playRef)).toEqual(scopeFor(playRef));
    expect(b.scopeFor('minigame:s1-letters-q1-play')?.kind).toBe('match-sound');
    expect(b.questById('quest:nope')).toBeUndefined();
    expect(b.episodeById('episode:nope')).toBeUndefined();
    expect(b.cardById('card:nope')).toBeUndefined();
    expect(b.scopeFor('minigame:nope')).toBeUndefined();
    expect(b.hasStrokes('jamo:giyeok')).toBe(true);
    expect(b.hasStrokes('jamo:nope')).toBe(false);
    expect(b.strokeReviewed('jamo:giyeok')).toBe(false);
  });

  it('vocabulary topics come through their adapter (PR 12), in the presenter language', () => {
    const en = lectureBundle('en').vocabTopic?.('vocab-topic:food');
    const es = lectureBundle('es').vocabTopic?.('vocab-topic:food');
    expect(en).toMatchObject({ title: 'Food' });
    expect(es).toMatchObject({ title: 'Comida' });
    expect(lectureBundle('en').vocabTopic?.('vocab-topic:nope')).toBeUndefined();
  });

  it('stories come through the story adapter, behind the review gate (PR 11)', () => {
    const b = lectureBundle('en');
    expect(b.story).toEqual(expect.any(Function));
    for (const id of listedStoryIds) expect(b.story!(id)).toBe(storiesAll.find((s) => s.id === id));
    expect(b.story!('story:nope')).toBeUndefined();
  });

  it.each(['en', 'es', 'ko'] as const)(
    'every story the Library lists expands to title, scenes, order and checks with nothing skipped (%s)',
    (locale) => {
      expect(listedStoryIds.length).toBeGreaterThan(0);
      for (const storyId of listedStoryIds) {
        const story = storiesAll.find((s) => s.id === storyId)!;
        const tier = story.tiers[0]!;
        const { slides, skipped } = expandDeck(deck([{ kind: 'story', storyId, checks: true }]), lectureBundle(locale), { canPlayKorean: true });
        expect(skipped, storyId).toEqual([]);
        expect(slides.map((s) => s.kind), storyId).toEqual([
          'title',
          ...tier.scenes.map(() => 'story'),
          'sequence',
          ...tier.checks.map(() => 'quiz'),
          'end',
        ]);
      }
    },
  );

  it.each(['en', 'es', 'ko'] as const)(
    'every shipped episode and quest expands with no Korean missing its romanization (rule 11, %s)',
    (locale) => {
      const blocks: LectureBlock[] = [
        ...shippedEpisodes.map((e): LectureBlock => ({ kind: 'episode', id: e.id })),
        ...questsAll.map((q): LectureBlock => ({ kind: 'quest', id: q.id })),
      ];
      for (let i = 0; i < blocks.length; i += 30) {
        const { slides, skipped } = expandDeck(deck(blocks.slice(i, i + 30)), lectureBundle(locale), { canPlayKorean: true });
        expect(slides.length).toBeGreaterThan(0);
        expect(skipped.filter((s) => s.reason === 'no-romanization' || s.reason === 'unknown-id')).toEqual([]);
        // A skipped step is always a minigame kind the presenter cannot show, never a step dropped for having no minigame.
        expect(skipped.filter((s) => s.reason === 'unsupported-step' && !s.ref.startsWith('minigame:'))).toEqual([]);
      }
    },
  );

  it.each(['en', 'es', 'ko'] as const)('every ready vocabulary topic expands with no skip, a slide per word and a quiz (PR 12, %s)', (locale) => {
    const ready = VOCAB_TOPICS.filter((t) => t.status === 'ready' || t.status === 'shipped');
    expect(ready.length).toBeGreaterThan(0);
    for (const t of ready) {
      const { slides, skipped } = expandDeck(deck([{ kind: 'vocab', topicId: t.id }]), lectureBundle(locale), { canPlayKorean: true });
      expect(skipped, t.id).toEqual([]);
      const words = slides.filter((s) => s.kind === 'vocab');
      expect(words.length, t.id).toBe(VOCAB_ITEMS.filter((i) => (i.topics as readonly string[]).includes(t.key)).length);
      expect(slides[0], t.id).toMatchObject({ kind: 'title', source: 'topic' });
      if (words.length >= 4) expect(slides.some((s) => s.kind === 'quiz'), t.id).toBe(true);
    }
  });

  it('every ready topic word has a picture the presenter draws: a drawn card or a known WordArt glyph (README D9)', () => {
    const { slides } = expandDeck(
      deck(VOCAB_TOPICS.filter((t) => t.status === 'ready' || t.status === 'shipped').map((t): LectureBlock => ({ kind: 'vocab', topicId: t.id }))),
      lectureBundle('en'),
      { canPlayKorean: true },
    );
    expect(slides.some((s) => s.kind === 'vocab')).toBe(true);
    // Colour words too: their `word:color-*` keys are drawn by the generated colour glyphs.
    const missing = slides.filter((s) => s.kind === 'vocab' && vocabArt(s, supportedCardIds, WORD_ART_KEYS) === undefined).map((s) => s.key);
    expect(missing).toEqual([]);
  });

  it.each(['en', 'es', 'ko'] as const)('within every ready topic each word has its own Korean and its own gloss, so no quiz round has two right answers (%s)', (locale) => {
    const ready = VOCAB_TOPICS.filter((t) => t.status === 'ready' || t.status === 'shipped');
    for (const t of ready) {
      const words = expandDeck(deck([{ kind: 'vocab', topicId: t.id }]), lectureBundle(locale), { canPlayKorean: true }).slides.flatMap((s) =>
        s.kind === 'vocab' ? [s.word] : [],
      );
      const dupes = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i);
      expect(dupes(words.map((w) => w.ko)), t.id).toEqual([]);
      expect(dupes(words.map((w) => w.gloss.trim().toLowerCase())), t.id).toEqual([]);
    }
  });

  it('every quest teaches: at least one slide besides its title and End', () => {
    for (const q of questsAll) {
      const { slides } = expandDeck(deck([{ kind: 'quest', id: q.id }]), lectureBundle('en'), { canPlayKorean: true });
      expect(slides.filter((s) => s.kind !== 'title' && s.kind !== 'end').length, q.id).toBeGreaterThan(0);
    }
  });

  it('every Stage 5 book quest teaches its story through story slides (F-STORY-005 PR 5.6, F-TCH-004 PR 11)', () => {
    expect(bookQuests.length).toBeGreaterThan(0);
    for (const q of bookQuests) {
      const { slides, skipped } = expandDeck(deck([{ kind: 'quest', id: q.id }]), lectureBundle('en'), { canPlayKorean: true });
      expect(skipped.filter((s) => s.ref.startsWith('story:')), q.id).toEqual([]);
      expect(slides.filter((s) => s.kind === 'story').length, q.id).toBeGreaterThan(0);
    }
  });

  it('every quest with a Discover step shows a letter slide for each jamo and a word slide for each word it discovers, before any quiz', () => {
    const discovering = questsAll.filter((q) => q.steps.some((s) => s.kind === 'discover'));
    expect(discovering.length).toBeGreaterThan(0);
    for (const q of discovering) {
      const items = q.steps.flatMap((s) => s.discover?.pages.flatMap((p) => p.items) ?? []);
      const jamoIds = items.flatMap((it) => (it.type === 'jamo' ? [it.jamoId] : []));
      // The reading quests of F-QUEST-002 rule R5 (Q-8) discover words only.
      const words = items.flatMap((it) => (it.type === 'word' ? [it.word.ko] : []));
      expect(jamoIds.length + words.length, q.id).toBeGreaterThan(0);
      const { slides } = expandDeck(deck([{ kind: 'quest', id: q.id }]), lectureBundle('en'), { canPlayKorean: true });
      const letterAt = new Map(slides.flatMap((s, i) => (s.kind === 'letter' ? [[s.jamoId, i] as const] : [])));
      const wordAt = new Map<string, number>();
      slides.forEach((s, i) => {
        if (s.kind === 'vocab' && !wordAt.has(s.word.ko)) wordAt.set(s.word.ko, i);
      });
      const firstQuiz = slides.findIndex((s) => s.kind === 'quiz');
      for (const id of jamoIds) {
        expect(letterAt.has(id), `${q.id} ${id}`).toBe(true);
        if (firstQuiz >= 0) expect(letterAt.get(id)!, `${q.id} ${id}`).toBeLessThan(firstQuiz);
      }
      for (const ko of words) {
        expect(wordAt.has(ko), `${q.id} ${ko}`).toBe(true);
        if (firstQuiz >= 0) expect(wordAt.get(ko)!, `${q.id} ${ko}`).toBeLessThan(firstQuiz);
      }
    }
  });

  it('letters quests 1-3 open on the letters their Discover step teaches, before any quiz (F-QUEST-002 §3.1)', () => {
    for (const id of ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3']) {
      const quest = questsAll.find((q) => q.id === id)!;
      const discover = quest.steps.find((s) => s.kind === 'discover')!;
      const taughtIds = discover.discover!.pages.flatMap((p) => p.items.flatMap((item) => (item.type === 'jamo' ? [item.jamoId] : [])));
      expect(taughtIds.length).toBeGreaterThan(0);
      const { slides, skipped } = expandDeck(deck([{ kind: 'quest', id }]), lectureBundle('en'), { canPlayKorean: true });
      const firstQuiz = slides.findIndex((s) => s.kind === 'quiz');
      const before = slides.slice(1, firstQuiz);
      expect(before.map((s) => (s.kind === 'letter' ? s.jamoId : s.kind))).toEqual(taughtIds);
      expect(before.every((s) => s.key.startsWith(`${id}/${discover.id}/`))).toBe(true);
      // The Check (Listen & Pick) is not a presenter slide yet (§3.3 rule 2): a counted skip, nothing else.
      const check = quest.steps.find((s) => s.kind === 'check')!;
      expect(skipped).toEqual([{ blockIndex: 0, ref: check.minigameRef, reason: 'unsupported-step' }]);
    }
  });

  it('a Pic-Word board teaches its words as vocab slides: life q1 shows the four food words (F-QUEST-002 §3.11)', () => {
    const id = 'quest:stage1-life-q1';
    const quest = questsAll.find((q) => q.id === id)!;
    const apply = quest.steps.find((s) => s.minigameRef === 'minigame:s1-life-q1-apply')!;
    const { slides, skipped, taught } = expandDeck(deck([{ kind: 'quest', id }]), lectureBundle('en'), { canPlayKorean: true });
    const boardWords = slides.flatMap((s) => (s.kind === 'vocab' && s.key.startsWith(`${id}/${apply.id}/`) ? [s.word] : []));
    expect(boardWords).toEqual([
      { ko: '김치', romanization: 'gimchi', gloss: 'kimchi' },
      { ko: '밥', romanization: 'bap', gloss: 'rice' },
      { ko: '김밥', romanization: 'gimbap', gloss: 'kimbap' },
      { ko: '젓가락', romanization: 'jeotgarak', gloss: 'chopsticks' },
    ]);
    expect(taught.filter((t) => t.kind === 'word').map((t) => t.ko)).toEqual(expect.arrayContaining(['김치', '밥', '김밥', '젓가락']));
    expect(skipped.filter((s) => s.ref === 'minigame:s1-life-q1-apply')).toEqual([]);
  });

  it('localizes content text through the overlays, never the Korean or its romanization', () => {
    const overlays: Overlays = {
      es: {
        'quest:stage1-letters-q1': { title: 'Conoce g, n, d, l' },
        'jamo:giyeok': { 'exampleWord.gloss': 'familia' },
        'card:book': { title: 'Libro' },
      },
      ko: {},
    };
    const b = lectureBundle('es', overlays);
    expect(b.questById('quest:stage1-letters-q1')?.titleEn).toBe('Conoce g, n, d, l');
    expect(b.cardById('card:book')).toMatchObject({ titleEn: 'Libro', subtitleKo: '책', romanization: 'chaek' });
    const { slides } = expandDeck(deck([{ kind: 'quest', id: 'quest:stage1-letters-q1' }]), b, { canPlayKorean: true });
    expect(slides[0]).toMatchObject({ kind: 'title', title: 'Conoce g, n, d, l' });
    expect(b.episodeById('episode:stage1-letters')?.titleEn).toBe(episodeById('episode:stage1-letters')!.titleEn);
    expect(b.jamoAll).not.toBe(jamoAll);
    const giyeok = b.jamoAll.find((j) => j.id === 'jamo:giyeok')!;
    expect(giyeok).toMatchObject({ char: 'ㄱ', exampleWordKo: '가족', exampleWordRomanization: 'gajok', exampleWordEn: 'familia' });
  });
});
