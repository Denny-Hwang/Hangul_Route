import { CATALOG, LECTURE_PRESETS, LectureDeckSchema, PRESET_LENGTHS, encodeDeck, resolvePreset, type LectureBlock, type LectureDeck } from '@hangul-route/content-schema';
import { getMessages, LOCALES } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { UNKNOWN_CAPABILITY } from '../../audio/capability';
import { lectureBundle } from '../content';
import { expandDeck } from '../deck-builder';
import {
  REVISIT_MAX_LETTERS,
  WORD_REVIEW_MIN_WORDS,
  firstStageOf,
  presetPreview,
  presenterPresetContext,
  presenterPresetOrder,
  presetLectureDeck,
  presetTitle,
  resolveOnPresenter,
  somethingToFollow,
} from '../preset-source';
import { emptyRecent, parseRecent, rememberDeck, type RecentList } from '../recent';
import { homeStart, resolveBoot, runDeck, startPayload } from '../shell';
import { blockMinutesOn, blockTitleIn, wordReviewWordsOn } from '../quick-source';
import { presetBlockMinutes } from '@hangul-route/content-schema';

/**
 * AMENDMENTS-LECTURE-V2 row LV-3 (sections 4.2, 4.3 and 11): the presenter's preset context from
 * Recent (the 60-day and 7-day windows by `savedAt`, corrupt items ignored), the deck a resolved
 * preset becomes (v1 with `source: 'quick'` unless it holds a Word review), no name field anywhere,
 * and the `lecture.start` source of a preset start.
 */

const NOW = new Date('2026-10-17T12:00:00.000Z');
const daysAgo = (n: number): string => new Date(NOW.getTime() - n * 86_400_000).toISOString();

let n = 0;
const deck = (blocks: LectureBlock[], title = 'Week 3 letters'): LectureDeck =>
  LectureDeckSchema.parse({ v: 1, id: `lecture:recent${String((n += 1)).padStart(4, '0')}`, title, createdAt: '2026-10-01T09:00:00.000Z', seed: 3, blocks, source: 'quick' });

/** Recent with the newest first, as the presenter saves it. */
function recentOf(items: { blocks: LectureBlock[]; savedAt: string; title?: string }[]): RecentList {
  let list = emptyRecent();
  for (const item of [...items].reverse()) list = rememberDeck(list, deck(item.blocks, item.title), item.savedAt);
  return list;
}

const q = (id: string): LectureBlock => ({ kind: 'quest', id });

describe('presenterPresetContext: Recent read through its windows', () => {
  it('with no Recent (or storage off) the context is empty: nothing shown, no words, no letters', () => {
    for (const recent of [null, emptyRecent()]) {
      const ctx = presenterPresetContext(recent, NOW);
      expect(ctx.catalog).toBe(CATALOG);
      expect(ctx.shown).toEqual({ questIds: [], storyIds: [] });
      expect(ctx.recentWords).toEqual({ questIds: [], vocabIds: [] });
      expect(ctx.revisitChars).toEqual([]);
      expect(ctx.plan).toBeUndefined();
      expect(ctx.position).toBeUndefined();
    }
  });

  it('shown holds the quests (an episode as its cell quests) and stories of the last 60 days, and nothing older', () => {
    const recent = recentOf([
      { blocks: [q('quest:stage2-life-q2'), { kind: 'story', storyId: 'story:hangeul-day', checks: true }], savedAt: daysAgo(1) },
      { blocks: [{ kind: 'episode', id: 'episode:stage1-letters' }], savedAt: daysAgo(59) },
      { blocks: [q('quest:stage3-life-q1'), { kind: 'story', storyId: 'story:seollal-new-year', checks: true }], savedAt: daysAgo(61) },
    ]);
    const ctx = presenterPresetContext(recent, NOW);
    expect(ctx.shown).toEqual({
      questIds: ['quest:stage2-life-q2', 'quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3'],
      storyIds: ['story:hangeul-day'],
    });
  });

  it('recent words are the quests of the last 7 days, newest lesson first, at most 12, with no word ids (W2)', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ blocks: [q(`quest:stage2-life-q${(i % 3) + 1}`), q(`quest:stage2-rites-q${(i % 3) + 1}`), q(`quest:stage2-nature-q${(i % 3) + 1}`)], savedAt: daysAgo(i * 0.5) }));
    const recent = recentOf([{ blocks: [q('quest:stage1-letters-q2')], savedAt: daysAgo(0) }, ...many, { blocks: [q('quest:stage2-crafts-q1')], savedAt: daysAgo(8) }]);
    const ctx = presenterPresetContext(recent, NOW);
    expect(ctx.recentWords?.vocabIds).toEqual([]);
    expect(ctx.recentWords?.questIds[0]).toBe('quest:stage1-letters-q2');
    expect(ctx.recentWords?.questIds.length).toBeLessThanOrEqual(12);
    expect(new Set(ctx.recentWords?.questIds).size).toBe(ctx.recentWords?.questIds.length);
    // A lesson started 8 days ago is outside the week.
    expect(ctx.recentWords?.questIds).not.toContain('quest:stage2-crafts-q1');
  });

  it('orders by savedAt, newest first, whatever the stored order', () => {
    const list = recentOf([
      { blocks: [q('quest:stage2-life-q1')], savedAt: daysAgo(3) },
      { blocks: [q('quest:stage2-life-q2')], savedAt: daysAgo(1) },
    ]);
    expect(presenterPresetContext(list, NOW).recentWords?.questIds).toEqual(['quest:stage2-life-q2', 'quest:stage2-life-q1']);
  });

  it('letters to revisit are the plain letters the week\'s quests teach, de-duplicated, at most 6; finals like ㄴ/final are left out', () => {
    const recent = recentOf([
      { blocks: [q('quest:stage1-rites-q1'), q('quest:stage1-rites-q2')], savedAt: daysAgo(2) },
      { blocks: [q('quest:stage1-letters-q1'), q('quest:stage1-letters-q2')], savedAt: daysAgo(3) },
      { blocks: [q('quest:stage1-letters-q3')], savedAt: daysAgo(30) },
    ]);
    const chars = presenterPresetContext(recent, NOW).revisitChars ?? [];
    expect(chars).toEqual(['ㅑ', 'ㅕ', 'ㅍ', 'ㅏ', 'ㅓ', 'ㄱ']);
    expect(chars.length).toBeLessThanOrEqual(REVISIT_MAX_LETTERS);
    expect(chars.some((c) => c.includes('/'))).toBe(false);
    // The resolved warm-up is a deck the schema accepts, with at least 4 letters.
    const r = resolvePreset('warm-up', 10, presenterPresetContext(recent, NOW));
    const block = r.blocks[0];
    expect(block?.kind === 'revisit' && block.chars.length >= 4).toBe(true);
  });

  it('ignores corrupt items: a damaged savedAt or deck never reaches the context', () => {
    const good = deck([q('quest:stage2-life-q1')]);
    const parsed = parseRecent({
      v: 1,
      items: [
        { deck: good, savedAt: daysAgo(1) },
        { deck: { ...good, id: 'lecture:broken0001', blocks: 'nope' }, savedAt: daysAgo(1) },
        { deck: deck([q('quest:stage2-rites-q1')]), savedAt: 'yesterday' },
        'garbage',
      ],
    });
    const ctx = presenterPresetContext(parsed, NOW);
    expect(ctx.shown?.questIds).toEqual(['quest:stage2-life-q1']);
  });

  it('has no field that can carry a name: a deck title with a name never reaches the context', () => {
    const recent = recentOf([{ blocks: [q('quest:stage2-life-q1')], savedAt: daysAgo(1), title: 'Minho and Suni' }]);
    const ctx = presenterPresetContext(recent, NOW);
    expect(Object.keys(ctx).sort()).toEqual(['catalog', 'recentWords', 'revisitChars', 'shown']);
    expect(JSON.stringify({ ...ctx, catalog: undefined })).not.toMatch(/Minho|Suni/);
  });
});

describe('the presenter home order and its decks', () => {
  it('Next lesson is first only when it has something to follow (section 4.1)', () => {
    const empty = presenterPresetContext(null, NOW);
    expect(somethingToFollow(empty)).toBe(false);
    expect(presenterPresetOrder(empty)).toEqual(['hangul-week-1', 'by-stage', 'story-time', 'word-review', 'warm-up', 'next-lesson']);
    const followed = presenterPresetContext(recentOf([{ blocks: [q('quest:stage1-letters-q1')], savedAt: daysAgo(2) }]), NOW);
    expect(somethingToFollow(followed)).toBe(true);
    expect(presenterPresetOrder(followed)).toEqual([...LECTURE_PRESETS]);
    // A Recent lesson older than 60 days is not something to follow.
    expect(somethingToFollow(presenterPresetContext(recentOf([{ blocks: [q('quest:stage1-letters-q1')], savedAt: daysAgo(70) }]), NOW))).toBe(false);
  });

  it('every preset at every length, in every UI locale, gives a deck the schema accepts, v1 with source quick unless it holds a Word review', () => {
    const contexts = [
      presenterPresetContext(null, NOW),
      presenterPresetContext(
        recentOf([
          { blocks: [q('quest:stage1-life-q1'), q('quest:stage1-life-q2'), { kind: 'story', storyId: 'story:hangeul-day', checks: true }], savedAt: daysAgo(1) },
          { blocks: [{ kind: 'episode', id: 'episode:stage1-letters' }], savedAt: daysAgo(4) },
        ]),
        NOW,
      ),
    ];
    for (const locale of LOCALES) {
      const words = getMessages(locale).learner.presenter.presets;
      for (const ctx of contexts) {
        for (const preset of LECTURE_PRESETS) {
          for (const minutes of PRESET_LENGTHS[preset]) {
            const resolved = resolvePreset(preset, minutes, { ...ctx, stage: 'stage3' });
            const built = presetLectureDeck(resolved, { title: presetTitle(resolved, words), now: NOW, rng: () => 0.42 });
            expect(built, `${locale} ${preset} ${minutes}`).not.toBeNull();
            const d = built!;
            expect(d.picker).toBeNull();
            expect(d.source).toBe('quick');
            expect(d.options.uiLocale).toBeUndefined();
            const hasReview = d.blocks.some((b) => b.kind === 'word-review');
            expect(d.v).toBe(hasReview ? 2 : 1);
            expect(d.preset).toBe(hasReview ? resolved.preset : undefined);
            expect(d.blocks.some((b) => b.kind === 'class-code')).toBe(false);
            // It travels as a link and reads back the same.
            expect(encodeDeck(d).startsWith(`${d.v}.`)).toBe(true);
          }
        }
      }
    }
  });

  it('titles a deck by the preset in the presenter language, never a story title', () => {
    const en = getMessages('en').learner.presenter.presets;
    const ko = getMessages('ko').learner.presenter.presets;
    const ctx = presenterPresetContext(null, NOW);
    expect(presetTitle(resolvePreset('story-time', 20, ctx), en)).toBe('Story time');
    expect(presetTitle(resolvePreset('hangul-week-1', 20, ctx), en)).toBe('Hangul week 1');
    expect(presetTitle(resolvePreset('by-stage', 20, { ...ctx, stage: 'stage4' }), en)).toBe('Stage 4');
    expect(presetTitle(resolvePreset('by-stage', 20, { ...ctx, stage: 'stage4' }), ko)).toBe('4단계');
    // Nothing to follow: Next lesson falls back to Hangul week 1, titled as such.
    expect(presetTitle(resolvePreset('next-lesson', 20, ctx), en)).toBe('Hangul week 1');
    // No words this week: Word review falls back to the warm-up.
    expect(presetTitle(resolvePreset('word-review', 10, ctx), en)).toBe('Quick warm-up');
    expect(presetTitle({ titleKey: 'plan', planTitle: 'Minho' }, en)).toBe('Next lesson');
    expect(presetTitle({ titleKey: 'words.title' }, en)).toBe('Word review');
    expect(presetTitle({ titleKey: 'next.title' }, en)).toBe('Next lesson');
    expect(presetTitle({ titleKey: 'stage.chip' }, en)).toBe('Stage 1');
  });

  it('builds the 20-minute Hangul week 1 deck the preview shows: 3 lessons and a 4-question quiz, about 19 minutes', () => {
    const resolved = resolvePreset('hangul-week-1', 20, presenterPresetContext(null, NOW));
    const d = presetLectureDeck(resolved, { title: 'Hangul week 1', now: NOW, rng: () => 0.1 })!;
    const run = runDeck(d, expandDeck(d, lectureBundle('en'), { canPlayKorean: true }));
    expect(d.blocks.map((b) => b.kind)).toEqual(['quest', 'quest', 'quest', 'quiz']);
    expect(run.minutes).toBe(19);
  });

  it('names the stage of a deck\'s first lesson for the chooser, or null without one', () => {
    expect(firstStageOf(resolvePreset('by-stage', 20, { ...presenterPresetContext(null, NOW), stage: 'stage4' }).blocks)).toBe('stage4');
    expect(firstStageOf([{ kind: 'episode', id: 'episode:stage2-life' }])).toBe('stage2');
    expect(firstStageOf(resolvePreset('warm-up', 10, presenterPresetContext(null, NOW)).blocks)).toBeNull();
    expect(firstStageOf([q('quest:nope'), q('quest:stage3-life-q1')])).toBe('stage3');
    expect(firstStageOf([{ kind: 'episode', id: 'episode:stage9-none' }])).toBeNull();
  });

  it('names Stage 5 for a Stage by stage deck at Stage 5 (its lessons are stories read at the read level)', () => {
    const stage5 = resolvePreset('by-stage', 20, { ...presenterPresetContext(null, NOW), stage: 'stage5' });
    expect(stage5.blocks[0]).toMatchObject({ kind: 'story', level: 'read' });
    expect(firstStageOf(stage5.blocks)).toBe('stage5');
    // A story at another level is not a lesson of the catalogue.
    expect(firstStageOf([{ kind: 'story', storyId: 'story:sun-and-moon', checks: true }])).toBeNull();
  });

  it('returns null for blocks the schema refuses', () => {
    expect(presetLectureDeck({ blocks: [], preset: 'warm-up' }, { title: 'Quick warm-up', now: NOW, rng: () => 0.1 })).toBeNull();
  });
});

describe('Stage 5 in Recent (section 4.3): a story read at the read level is its book quest', () => {
  it('Stage by stage at Stage 5 moves past the stories a Recent Stage 5 deck read, and Next lesson follows them', () => {
    const first = resolvePreset('by-stage', 10, { ...presenterPresetContext(null, NOW), stage: 'stage5' });
    const recent = recentOf([{ blocks: first.blocks, savedAt: daysAgo(1) }]);
    const ctx = presenterPresetContext(recent, NOW);
    expect(ctx.shown?.questIds).toEqual(['quest:story-sejong-new-letters-read', 'quest:story-shapes-of-hangeul-read']);
    const again = resolvePreset('by-stage', 10, { ...ctx, stage: 'stage5' });
    expect(again.blocks[0]).toEqual({ kind: 'story', storyId: 'story:hangeul-day', level: 'read', checks: true });
    expect(somethingToFollow(ctx)).toBe(true);
    expect(resolvePreset('next-lesson', 10, ctx).blocks[0]).toEqual({ kind: 'quest', id: 'quest:story-hangeul-day-read' });
  });
});

describe('Word review with fewer than 4 words once expanded (section 4.2 W)', () => {
  const bundle = lectureBundle('en');
  const wordsOf = (block: Parameters<typeof wordReviewWordsOn>[1]): number => wordReviewWordsOn(bundle, block);
  const ctxOf = (questIds: string[]) => presenterPresetContext(recentOf([{ blocks: questIds.map(q), savedAt: daysAgo(1) }]), NOW);

  it('Hangul week 1 in Recent this week teaches 3 words: the warm-up, with its fallback line, at 10 and 20 minutes', () => {
    for (const recent of [['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3'], ['quest:stage1-letters-q1'], ['quest:stage1-rites-q1']]) {
      const ctx = ctxOf(recent);
      // The resolver alone (catalogue only) still builds the word review ...
      expect(resolvePreset('word-review', 10, ctx).preset).toBe('word-review');
      for (const minutes of [10, 20]) {
        const r = resolveOnPresenter('word-review', minutes, ctx, wordsOf);
        expect([r.preset, r.fallback, r.titleKey, r.minutes], recent.join()).toEqual(['warm-up', 'warm-up', 'warmup.short', 10]);
        // ... and the presenter gives the same warm-up the no-ids fallback gives.
        expect(r.blocks).toEqual(resolvePreset('warm-up', 10, ctx).blocks);
      }
    }
  });

  it('4 or more words stays a Word review; no ids still gives the warm-up; other presets pass through', () => {
    const ctx = ctxOf(['quest:stage1-life-q1']);
    expect(wordsOf({ kind: 'word-review', questIds: ['quest:stage1-life-q1'], vocabIds: [], rounds: 5 })).toBeGreaterThanOrEqual(WORD_REVIEW_MIN_WORDS);
    const r = resolveOnPresenter('word-review', 20, ctx, wordsOf);
    expect([r.preset, r.fallback, r.minutes]).toEqual(['word-review', null, 20]);
    const none = resolveOnPresenter('word-review', 10, presenterPresetContext(null, NOW), wordsOf);
    expect([none.preset, none.fallback]).toEqual(['warm-up', 'warm-up']);
    let counted = 0;
    const counting = (): number => (counted += 1);
    expect(resolveOnPresenter('hangul-week-1', 20, ctx, counting)).toEqual(resolvePreset('hangul-week-1', 20, ctx));
    expect(counted).toBe(0);
  });
});

describe("the preview: What's in this lesson (design presets.md V4)", () => {
  const en = getMessages('en');
  const labels = {
    quiz: en.learner.presenter.presets.preview.quiz,
    words: en.learner.presenter.presets.preview.words,
    letters: en.learner.presenter.home.quick.letters,
    activity: (p: Parameters<typeof en.learner.presenter.activity extends Record<infer K, string> ? (k: K) => void : never>[0]) => en.learner.presenter.activity[p],
  };
  const bundle = lectureBundle('en');
  const minutesOf = (block: LectureBlock): number =>
    block.kind === 'word-review' || block.kind === 'revisit' || block.kind === 'jamo-set' || block.kind === 'vocab' ? blockMinutesOn(bundle, block) : presetBlockMinutes(block, CATALOG);
  const previewOf = (d: LectureDeck) => presetPreview(d, expandDeck(d, bundle, { canPlayKorean: true }).slides, labels, blockTitleIn('en'), minutesOf);

  it('Hangul week 1 at 20 minutes: the three lessons and the quiz, with their minutes', () => {
    const d = presetLectureDeck(resolvePreset('hangul-week-1', 20, presenterPresetContext(null, NOW)), { title: 'Hangul week 1', now: NOW, rng: () => 0.1 })!;
    expect(previewOf(d)).toEqual([
      { title: 'Meet a, eo, g, n', minutes: 5 },
      { title: 'Meet o, u, m and the circle', minutes: 5 },
      { title: 'Meet eu, i, d, r', minutes: 5 },
      { title: 'Quick quiz: 4 questions', minutes: 4 },
    ]);
  });

  it('names the warm-up\'s letters and activity, a Word review by its word cards, and a story by its title', () => {
    const warm = presetLectureDeck(resolvePreset('warm-up', 10, presenterPresetContext(null, NOW)), { title: 'Quick warm-up', now: NOW, rng: () => 0.1 })!;
    expect(previewOf(warm)).toEqual([
      { title: '6 letters', minutes: 7 },
      { title: 'Write it in the air', minutes: 3 },
    ]);
    const recent = recentOf([{ blocks: [q('quest:stage1-life-q1'), q('quest:stage1-life-q2'), q('quest:stage1-life-q3')], savedAt: daysAgo(1) }]);
    const review = presetLectureDeck(resolvePreset('word-review', 10, presenterPresetContext(recent, NOW)), { title: 'Word review', now: NOW, rng: () => 0.1 })!;
    const rows = previewOf(review);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toMatch(/^\d+ words$/);
    expect(rows[0]!.minutes).toBeLessThanOrEqual(10);
    const story = presetLectureDeck(resolvePreset('story-time', 10, presenterPresetContext(null, NOW)), { title: 'Story time', now: NOW, rng: () => 0.1 })!;
    const first = story.blocks[0]!;
    expect(previewOf(story)[0]!.title).toBe(first.kind === 'story' ? CATALOG.stories.find((s) => s.id === first.storyId)!.title : '');
  });

  it('leaves out a part with no title (an id this build does not know)', () => {
    const d = LectureDeckSchema.parse({ v: 1, id: 'lecture:preview001', title: 'x', createdAt: '2026-10-01T09:00:00.000Z', seed: 1, blocks: [q('quest:nope'), { kind: 'class-code', code: 'ABC234' }, { kind: 'cards', cardIds: ['card:hanbok'] }] });
    expect(presetPreview(d, [], labels, blockTitleIn('en'), () => 1)).toEqual([]);
  });
});

describe('lecture.start source of a preset (section 11)', () => {
  const ctx = presenterPresetContext(null, NOW);
  const resolved = resolvePreset('hangul-week-1', 10, ctx);
  const d = presetLectureDeck(resolved, { title: 'Hangul week 1', now: NOW, rng: () => 0.2 })!;
  const run = runDeck(d, expandDeck(d, lectureBundle('en'), { canPlayKorean: true }));

  it('a preset the presenter resolved is a preset start with its id', () => {
    const start = homeStart({ kind: 'preset', deck: d, preset: resolved.preset });
    expect(start.source).toBe('preset');
    expect(startPayload({ deck: d, run, source: start.source, preset: start.preset, capability: UNKNOWN_CAPABILITY, offlineReady: false })).toMatchObject({
      source: 'preset',
      preset: 'hangul-week-1',
    });
  });

  it('an E5-style v1 fragment with source quick is a quick start (no preset id rides in a v1 link)', () => {
    const booted = resolveBoot({ raw: encodeDeck(d), reloaded: false }, emptyRecent());
    expect(booted).toMatchObject({ kind: 'deck', source: 'quick' });
    const payload = startPayload({ deck: d, run, source: 'quick', capability: UNKNOWN_CAPABILITY, offlineReady: false });
    expect(payload.source).toBe('quick');
    expect('preset' in payload).toBe(false);
  });
});
