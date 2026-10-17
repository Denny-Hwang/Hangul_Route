import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  LECTURE_MAX_BLOCKS,
  LECTURE_PRESETS,
  LectureDeckSchema,
  PRESET_DEFAULT_MINUTES,
  PRESET_LENGTHS,
  StageKeySchema,
  WARM_UP_DEFAULT_CHARS,
  WARM_UP_MIN_LETTERS,
  WORD_REVIEW_ROLLUP_MAX,
  classPosition,
  consoleRecentWords,
  decodeDeck,
  deckVersion,
  encodeDeck,
  fillToLength,
  presetBlockMinutes,
  presetDeck,
  presetLength,
  presetMinutesOf,
  presetOrder,
  learnerPosition,
  questIdsOfBlocks,
  resolvePreset,
  storyIdsOfBlocks,
  warmUpChars,
  wordReviewCardCap,
  type Catalog,
  type JourneySummary,
  type LectureBlock,
  type LecturePreset,
  type PresetContext,
  type ResolvedPreset,
  type StageKey,
} from '../index';

/**
 * AMENDMENTS-LECTURE-V2 section 4 (row LV-1): the presets, the fill rule, N2
 * `classPosition`, W1 and the deck a resolved preset becomes, against the shipped
 * `CATALOG`. The tables are explicit on purpose: a catalogue change that moves a
 * preset's lesson shows up here as a reviewed diff.
 */

/** One block as a short line: quest ids without `quest:`, `story:<slug>@level+checks`, `quiz n`, `<activity> n`. */
const short = (b: LectureBlock): string => {
  switch (b.kind) {
    case 'quest':
      return b.id.slice('quest:'.length);
    case 'story':
      return `story:${b.storyId.slice('story:'.length)}${b.level ? `@${b.level}` : ''}${b.checks ? '+checks' : ''}`;
    case 'quiz':
      return `quiz ${b.rounds}`;
    case 'activity':
      return `${b.preset} ${b.minutes}`;
    case 'revisit':
      return `revisit ${b.chars.join('')}`;
    case 'word-review':
      return `word-review ${b.questIds.length}q ${b.vocabIds.length}w ${b.rounds}r`;
    default:
      return b.kind;
  }
};
const outline = (r: ResolvedPreset): string => r.blocks.map(short).join(' · ');
const minutesOf = (r: ResolvedPreset): number => presetMinutesOf(r.blocks, CATALOG);

const empty: PresetContext = { catalog: CATALOG };

const journey = (here: string | null, stages: [stage: string, done: number, known: number][]): JourneySummary => ({
  v: 1,
  here,
  stages: stages.map(([stage, done, known]) => ({ stage, state: 'open', done, known, total: 15 })),
});

describe('constants', () => {
  it('defaults and length chips are the section 4.1 table', () => {
    expect(PRESET_DEFAULT_MINUTES).toEqual({
      'next-lesson': 20,
      'hangul-week-1': 20,
      'by-stage': 20,
      'story-time': 20,
      'word-review': 10,
      'warm-up': 10,
    });
    expect(PRESET_LENGTHS).toEqual({
      'next-lesson': [10, 20, 30],
      'hangul-week-1': [10, 20, 30],
      'by-stage': [10, 20, 30],
      'story-time': [10, 20, 30],
      'word-review': [10, 20],
      'warm-up': [10],
    });
    for (const p of LECTURE_PRESETS) expect(PRESET_LENGTHS[p]).toContain(PRESET_DEFAULT_MINUTES[p]);
    expect(WARM_UP_DEFAULT_CHARS).toEqual(['ㄱ', 'ㄴ', 'ㄷ', 'ㅏ', 'ㅓ', 'ㅗ']);
  });

  it('order: the table order, or next-lesson last with nothing to follow', () => {
    expect(presetOrder(true)).toEqual(['next-lesson', 'hangul-week-1', 'by-stage', 'story-time', 'word-review', 'warm-up']);
    expect(presetOrder(false)).toEqual(['hangul-week-1', 'by-stage', 'story-time', 'word-review', 'warm-up', 'next-lesson']);
  });

  it('a length the preset does not offer builds its default', () => {
    expect(presetLength('warm-up', 30)).toBe(10);
    expect(presetLength('word-review', 30)).toBe(10);
    expect(presetLength('story-time', 15)).toBe(20);
    expect(presetLength('by-stage', 30)).toBe(30);
    expect(resolvePreset('word-review', 30, { catalog: CATALOG, recentWords: { questIds: ['quest:stage2-life-q1'], vocabIds: [] } }).minutes).toBe(10);
    expect(resolvePreset('warm-up', 20, empty).minutes).toBe(10);
  });
});

describe('every preset at every length against CATALOG', () => {
  // A first visit: no plan, no position, nothing shown, no recent words (the presenter at /present).
  const firstVisit: [LecturePreset, number, resolved: LecturePreset, minutes: number, outline: string, fallback: string | null][] = [
    ['next-lesson', 10, 'hangul-week-1', 10, 'stage1-letters-q1 · stage1-letters-q2', 'zero'],
    ['next-lesson', 20, 'hangul-week-1', 19, 'stage1-letters-q1 · stage1-letters-q2 · stage1-letters-q3 · quiz 4', 'zero'],
    ['next-lesson', 30, 'hangul-week-1', 24, 'stage1-letters-q1 · stage1-letters-q2 · stage1-letters-q3 · quiz 4 · air-write 5', 'zero'],
    // Section 4.2 H: 10 min q1 + q2 (10); 20 min q1-q3 + quiz (19); 30 min q1-q3 + quiz + air-write 5 (24).
    ['hangul-week-1', 10, 'hangul-week-1', 10, 'stage1-letters-q1 · stage1-letters-q2', null],
    ['hangul-week-1', 20, 'hangul-week-1', 19, 'stage1-letters-q1 · stage1-letters-q2 · stage1-letters-q3 · quiz 4', null],
    ['hangul-week-1', 30, 'hangul-week-1', 24, 'stage1-letters-q1 · stage1-letters-q2 · stage1-letters-q3 · quiz 4 · air-write 5', null],
    ['by-stage', 10, 'by-stage', 10, 'stage1-letters-q1 · stage1-letters-q2', null],
    ['by-stage', 20, 'by-stage', 19, 'stage1-letters-q1 · stage1-letters-q2 · stage1-letters-q3 · stage1-life-q1', null],
    ['by-stage', 30, 'by-stage', 30, 'stage1-letters-q1 · stage1-letters-q2 · stage1-letters-q3 · stage1-life-q1 · stage1-life-q2 · stage1-life-q3 · air-write 3', null],
    // Section 4.2 T: ready stories by order, filled to the length (4 to 6 minutes each); checks from 20 min.
    ['story-time', 10, 'story-time', 9, 'story:sejong-new-letters · story:shapes-of-hangeul', null],
    [
      'story-time',
      20,
      'story-time',
      20,
      'story:sejong-new-letters+checks · story:shapes-of-hangeul+checks · story:hangeul-day+checks · story:tripitaka-koreana+checks · copy-on-paper 2',
      null,
    ],
    [
      'story-time',
      30,
      'story-time',
      30,
      'story:sejong-new-letters+checks · story:shapes-of-hangeul+checks · story:hangeul-day+checks · story:tripitaka-koreana+checks · story:sillok-royal-historians+checks · story:kim-hongdo-genre-paintings+checks · copy-on-paper 3',
      null,
    ],
    ['word-review', 10, 'warm-up', 10, 'revisit ㄱㄴㄷㅏㅓㅗ · air-write 3', 'warm-up'],
    ['word-review', 20, 'warm-up', 10, 'revisit ㄱㄴㄷㅏㅓㅗ · air-write 3', 'warm-up'],
    ['warm-up', 10, 'warm-up', 10, 'revisit ㄱㄴㄷㅏㅓㅗ · air-write 3', null],
  ];

  it('covers every preset at every length', () => {
    const keys = firstVisit.map(([p, m]) => `${p}/${m}`);
    expect(keys).toEqual(LECTURE_PRESETS.flatMap((p) => PRESET_LENGTHS[p].map((m) => `${p}/${m}`)));
  });

  it.each(firstVisit)('%s %i min, first visit', (preset, minutes, resolved, total, line, fallback) => {
    const r = resolvePreset(preset, minutes, empty);
    expect([r.preset, minutesOf(r), outline(r), r.fallback]).toEqual([resolved, total, line, fallback]);
  });

  // With something to follow: a position (N2 / N3), recent words (W2), a story shown before (T).
  const followed: [LecturePreset, number, PresetContext, minutes: number, outline: string][] = [
    ['next-lesson', 10, { catalog: CATALOG, position: { questId: 'quest:stage3-life-q2' } }, 10, 'stage3-life-q2 · stage3-life-q3'],
    ['next-lesson', 20, { catalog: CATALOG, position: { questId: 'quest:stage3-life-q2' } }, 20, 'stage3-life-q2 · stage3-life-q3 · stage3-rites-q1 · stage3-rites-q2'],
    [
      'next-lesson',
      30,
      { catalog: CATALOG, position: { questId: 'quest:stage3-life-q2' } },
      30,
      'stage3-life-q2 · stage3-life-q3 · stage3-rites-q1 · stage3-rites-q2 · stage3-rites-q3 · stage3-nature-q1',
    ],
    ['next-lesson', 20, { catalog: CATALOG, position: { questId: 'quest:stage1-life-q3' } }, 20, 'stage1-life-q3 · stage1-rites-q1 · stage1-rites-q2 · stage1-rites-q3 · air-write 2'],
    [
      'story-time',
      20,
      { catalog: CATALOG, shown: { questIds: [], storyIds: ['story:sejong-new-letters'] } },
      20,
      'story:shapes-of-hangeul+checks · story:hangeul-day+checks · story:tripitaka-koreana+checks · story:sillok-royal-historians+checks · copy-on-paper 2',
    ],
    // W: 10 min = ceil(10 cards / 2) + 5 rounds; 20 min = ceil(20 / 2) + 10 (section 4.2 W, rule 12).
    ['word-review', 10, { catalog: CATALOG, recentWords: { questIds: ['quest:stage2-life-q1'], vocabIds: ['vocab:apple'] } }, 10, 'word-review 1q 1w 5r'],
    ['word-review', 20, { catalog: CATALOG, recentWords: { questIds: ['quest:stage2-life-q1'], vocabIds: [] } }, 20, 'word-review 1q 0w 10r'],
    // U: 2 letters topped up to 4 = 2 + 4 + 3 = 9.
    ['warm-up', 10, { catalog: CATALOG, revisitChars: ['ㅓ', 'ㄹ'] }, 9, 'revisit ㅓㄹㄱㄴ · air-write 3'],
  ];

  it.each(followed)('%s %i min with something to follow', (preset, minutes, ctx, total, line) => {
    const r = resolvePreset(preset, minutes, ctx);
    expect([minutesOf(r), outline(r), r.fallback]).toEqual([total, line, null]);
  });

  // S at every stage and length (Stage 5, the book, plays its stories at the read level).
  const byStage: [StageKey, number, minutes: number, outline: string][] = [
    ['stage1', 10, 10, 'stage1-letters-q1 · stage1-letters-q2'],
    ['stage1', 20, 19, 'stage1-letters-q1 · stage1-letters-q2 · stage1-letters-q3 · stage1-life-q1'],
    ['stage1', 30, 30, 'stage1-letters-q1 · stage1-letters-q2 · stage1-letters-q3 · stage1-life-q1 · stage1-life-q2 · stage1-life-q3 · air-write 3'],
    ['stage2', 10, 10, 'stage2-letters-q1 · stage2-letters-q2 · copy-on-paper 2'],
    ['stage2', 20, 20, 'stage2-letters-q1 · stage2-letters-q2 · stage2-letters-q3 · stage2-letters-q4 · stage2-letters-q5'],
    ['stage2', 30, 30, 'stage2-letters-q1 · stage2-letters-q2 · stage2-letters-q3 · stage2-letters-q4 · stage2-letters-q5 · stage2-letters-q6 · stage2-life-q1 · copy-on-paper 2'],
    ['stage3', 10, 10, 'stage3-letters-q1 · stage3-letters-q2'],
    ['stage3', 20, 20, 'stage3-letters-q1 · stage3-letters-q2 · stage3-letters-q3 · stage3-life-q1'],
    ['stage3', 30, 30, 'stage3-letters-q1 · stage3-letters-q2 · stage3-letters-q3 · stage3-life-q1 · stage3-life-q2 · stage3-life-q3'],
    ['stage4', 10, 10, 'stage4-letters-q1 · stage4-letters-q2 · copy-on-paper 2'],
    ['stage4', 20, 20, 'stage4-letters-q1 · stage4-letters-q2 · stage4-letters-q3 · stage4-life-q1 · copy-on-paper 4'],
    ['stage4', 30, 29, 'stage4-letters-q1 · stage4-letters-q2 · stage4-letters-q3 · stage4-life-q1 · stage4-life-q2 · stage4-life-q3 · stage4-rites-q1'],
    ['stage5', 10, 9, 'story:sejong-new-letters@read+checks · story:shapes-of-hangeul@read+checks'],
    [
      'stage5',
      20,
      20,
      'story:sejong-new-letters@read+checks · story:shapes-of-hangeul@read+checks · story:hangeul-day@read+checks · story:gimjang-arirang@read+checks · copy-on-paper 2',
    ],
    [
      'stage5',
      30,
      30,
      'story:sejong-new-letters@read+checks · story:shapes-of-hangeul@read+checks · story:hangeul-day@read+checks · story:gimjang-arirang@read+checks · story:kim-hongdo-genre-paintings@read+checks · story:donguibogam@read+checks · copy-on-paper 2',
    ],
    ['stage6', 10, 10, 'stage6-letters-q1 · stage6-letters-q2'],
    ['stage6', 20, 20, 'stage6-letters-q1 · stage6-letters-q2 · stage6-letters-q3 · stage6-life-q1'],
    ['stage6', 30, 30, 'stage6-letters-q1 · stage6-letters-q2 · stage6-letters-q3 · stage6-life-q1 · stage6-life-q2 · stage6-life-q3'],
    ['stage7', 10, 10, 'stage7-letters-q1 · stage7-letters-q2'],
    ['stage7', 20, 20, 'stage7-letters-q1 · stage7-letters-q2 · stage7-letters-q3 · stage7-life-q1'],
    ['stage7', 30, 30, 'stage7-letters-q1 · stage7-letters-q2 · stage7-letters-q3 · stage7-life-q1 · stage7-life-q2 · stage7-life-q3'],
  ];

  it('covers every stage at every length', () => {
    expect(byStage.map(([s, m]) => `${s}/${m}`)).toEqual(StageKeySchema.options.flatMap((s) => [10, 20, 30].map((m) => `${s}/${m}`)));
  });

  it.each(byStage)('by-stage %s %i min', (stage, minutes, total, line) => {
    const r = resolvePreset('by-stage', minutes, { catalog: CATALOG, stage });
    expect([minutesOf(r), outline(r), r.titleKey, r.stageNumber]).toEqual([total, line, 'stage.chip', StageKeySchema.options.indexOf(stage) + 1]);
  });

  it('no preset outline runs over its length (word-review and warm-up included), never a class-code, at most 30 blocks', () => {
    for (const p of LECTURE_PRESETS) {
      for (const m of PRESET_LENGTHS[p]) {
        for (const stage of StageKeySchema.options) {
          const r = resolvePreset(p, m, { catalog: CATALOG, stage });
          expect(r.blocks.length).toBeLessThanOrEqual(LECTURE_MAX_BLOCKS);
          expect(r.blocks.some((b) => b.kind === 'class-code')).toBe(false);
          expect(minutesOf(r)).toBeLessThanOrEqual(r.minutes);
        }
      }
    }
  });
});

describe('titles', () => {
  it('each preset names its title key; the stage travels as a number; Story time is never a story title', () => {
    expect(resolvePreset('hangul-week-1', 20, empty).titleKey).toBe('zero.short');
    expect(resolvePreset('warm-up', 10, empty).titleKey).toBe('warmup.short');
    expect(resolvePreset('next-lesson', 20, { catalog: CATALOG, position: { questId: 'quest:stage2-life-q1' } }).titleKey).toBe('next.title');
    const story = resolvePreset('story-time', 20, empty);
    expect(story.titleKey).toBe('story.title');
    expect(story).not.toHaveProperty('storyId');
    const words = resolvePreset('word-review', 10, { catalog: CATALOG, recentWords: { questIds: [], vocabIds: ['vocab:apple'] } });
    expect(words.titleKey).toBe('words.title');
  });

  it('N1: the plan title only when the caller title check (titleProblem) accepts it and it is a valid deck title, else the preset name', () => {
    const blocks: LectureBlock[] = [{ kind: 'quest', id: 'quest:stage1-life-q1' }];
    const ok = (): boolean => true;
    const named = resolvePreset('next-lesson', 20, { catalog: CATALOG, plan: { title: '  Week 3: food  ', blocks }, planTitleOk: ok });
    expect([named.titleKey, named.planTitle]).toEqual(['plan', 'Week 3: food']);
    // No check given: never the plan title.
    const unchecked = resolvePreset('next-lesson', 20, { catalog: CATALOG, plan: { title: 'Week 3: food', blocks } });
    expect([unchecked.titleKey, unchecked.planTitle]).toEqual(['next.title', undefined]);
    // A roster name in the plan title: the console's titleProblem rejects it, so the preset name.
    const roster = ['Minho', 'Ji-woo'];
    const titleOk = (t: string): boolean => !roster.some((n) => t.toLowerCase().includes(n.toLowerCase()));
    for (const title of ["Minho's week", 'Ji-woo review']) {
      const r = resolvePreset('next-lesson', 20, { catalog: CATALOG, plan: { title, blocks }, planTitleOk: titleOk });
      expect([r.titleKey, r.planTitle]).toEqual(['next.title', undefined]);
    }
    for (const title of ['Week 🐯', '', 'x'.repeat(61), '第三週']) {
      const r = resolvePreset('next-lesson', 20, { catalog: CATALOG, plan: { title, blocks }, planTitleOk: ok });
      expect([r.titleKey, r.planTitle]).toEqual(['next.title', undefined]);
    }
  });
});

describe('fill rule', () => {
  const q = (id: string): LectureBlock => ({ kind: 'quest', id: `quest:${id}` });

  it('the first candidate is always taken, even past the length', () => {
    // Word Builder is a 25-minute cell.
    expect(fillToLength([{ kind: 'episode', id: 'episode:stage2-letters' }, q('stage1-letters-q1')], 10, true, CATALOG)).toEqual([
      { kind: 'episode', id: 'episode:stage2-letters' },
    ]);
  });

  it('the review quiz only with review and at least 5 minutes left', () => {
    // 5 + 5 = 10 of 15: 5 left, quiz (4), then 1 left: no activity.
    expect(fillToLength([q('stage1-letters-q1'), q('stage1-letters-q2')], 15, true, CATALOG).map(short)).toEqual([
      'stage1-letters-q1',
      'stage1-letters-q2',
      'quiz 4',
    ]);
    // 4 left: no quiz, an activity of 4.
    expect(fillToLength([q('stage1-letters-q1'), q('stage1-letters-q2')], 14, true, CATALOG).map(short)).toEqual([
      'stage1-letters-q1',
      'stage1-letters-q2',
      'air-write 4',
    ]);
    // review off: no quiz however much is left.
    expect(fillToLength([q('stage1-letters-q1')], 30, false, CATALOG).map(short)).toEqual(['stage1-letters-q1', 'air-write 5']);
  });

  it('the activity: air-write when every taken block is Stage 1, else copy-on-paper; at least 2 minutes left, at most 5', () => {
    expect(fillToLength([{ kind: 'episode', id: 'episode:stage1-life' }], 15, false, CATALOG).map(short)).toEqual(['episode', 'air-write 3']);
    expect(fillToLength([q('stage1-letters-q1'), q('stage2-life-q1')], 20, false, CATALOG).map(short)).toEqual([
      'stage1-letters-q1',
      'stage2-life-q1',
      'copy-on-paper 5',
    ]);
    expect(fillToLength([{ kind: 'story', storyId: 'story:sun-and-moon', checks: true }], 8, false, CATALOG).map(short)).toEqual([
      'story:sun-and-moon+checks',
      'copy-on-paper 3',
    ]);
    // 1 minute left: nothing.
    expect(fillToLength([q('stage1-letters-q1')], 6, false, CATALOG).map(short)).toEqual(['stage1-letters-q1']);
    // No candidate at all: the activity alone, never air-write by default.
    expect(fillToLength([], 10, false, CATALOG).map(short)).toEqual(['copy-on-paper 5']);
  });

  it('never a class-code block, never more than 30 blocks', () => {
    expect(fillToLength([{ kind: 'class-code', code: 'ABC234' }, q('stage1-letters-q1')], 5, true, CATALOG).map(short)).toEqual(['stage1-letters-q1']);
    // Unknown ids count 0 minutes, so only the block cap stops them.
    const many = Array.from({ length: 40 }, (_, i) => q(`unknown-${i}`));
    const filled = fillToLength(many, 10, true, CATALOG);
    expect(filled).toHaveLength(LECTURE_MAX_BLOCKS);
    expect(filled.every((b) => b.kind === 'quest')).toBe(true);
    const almost = fillToLength(many.slice(0, 29), 10, true, CATALOG);
    expect(almost.map(short).slice(28)).toEqual(['unknown-28', 'quiz 4']);
  });

  it('minutes per block (section 4.2 m(block), rule 12 as amended)', () => {
    const m = (b: LectureBlock): number => presetBlockMinutes(b, CATALOG);
    expect(m({ kind: 'quest', id: 'quest:stage1-letters-q1' })).toBe(5);
    expect(m({ kind: 'quest', id: 'quest:nope' })).toBe(0);
    expect(m({ kind: 'episode', id: 'episode:stage2-letters' })).toBe(25);
    expect(m({ kind: 'episode', id: 'episode:nope' })).toBe(0);
    expect(m({ kind: 'story', storyId: 'story:pansori-tales', checks: true })).toBe(6);
    expect(m({ kind: 'story', storyId: 'story:nope', checks: true })).toBe(0);
    expect(m({ kind: 'vocab', topicId: 'vocab-topic:food' })).toBe(5);
    expect(m({ kind: 'vocab', topicId: 'vocab-topic:nope' })).toBe(0);
    expect(m({ kind: 'jamo-set', jamoIds: ['jamo:a', 'jamo:b', 'jamo:c'] })).toBe(2);
    expect(m({ kind: 'cards', cardIds: ['card:a'] })).toBe(1);
    expect(m({ kind: 'revisit', chars: ['ㄱ', 'ㄴ', 'ㄷ', 'ㅏ', 'ㅓ', 'ㅗ'] })).toBe(7);
    expect(m({ kind: 'revisit', chars: ['ㄱ', 'ㄴ'] })).toBe(3);
    expect(m({ kind: 'word-review', questIds: ['quest:a'], vocabIds: [], rounds: 5 })).toBe(10);
    expect(m({ kind: 'word-review', questIds: ['quest:a'], vocabIds: [], rounds: 10 })).toBe(20);
    expect(m({ kind: 'quiz', from: 'all', rounds: 6 })).toBe(6);
    expect(m({ kind: 'activity', preset: 'stretch-break', minutes: 2 })).toBe(2);
    expect(m({ kind: 'class-code', code: 'ABC234' })).toBe(0);
    expect([wordReviewCardCap(5), wordReviewCardCap(10), wordReviewCardCap(1)]).toEqual([10, 20, 10]);
  });
});

describe('next-lesson', () => {
  it('N1: the plan blocks, then the fill rule (class-code dropped)', () => {
    const plan = {
      title: 'Week 2',
      blocks: [{ kind: 'class-code', code: 'ABC234' }, { kind: 'quest', id: 'quest:stage1-life-q1' }, { kind: 'quest', id: 'quest:stage1-life-q2' }] as LectureBlock[],
    };
    expect(outline(resolvePreset('next-lesson', 20, { catalog: CATALOG, plan, position: { questId: 'quest:stage4-life-q1' } }))).toBe(
      'stage1-life-q1 · stage1-life-q2 · quiz 4 · air-write 5',
    );
  });

  it('a plan with no usable block falls through to the position', () => {
    const plan = { title: 'Week 2', blocks: [{ kind: 'class-code', code: 'ABC234' }] as LectureBlock[] };
    expect(outline(resolvePreset('next-lesson', 10, { catalog: CATALOG, plan, position: { questId: 'quest:stage4-life-q1' } }))).toBe(
      'stage4-life-q1 · stage4-life-q2',
    );
  });

  it('N4: after the furthest route quest this screen showed, by route order', () => {
    const shown = { questIds: ['quest:stage2-life-q2', 'quest:stage1-letters-q1', 'quest:story-sun-and-moon-listen'], storyIds: [] };
    const r = resolvePreset('next-lesson', 10, { catalog: CATALOG, shown });
    expect([outline(r), r.fallback]).toEqual(['stage2-life-q3 · stage2-rites-q1 · copy-on-paper 2', null]);
  });

  it('a position that is not a route quest uses what was shown; shown at the very end, or nothing, is Hangul week 1', () => {
    const r = resolvePreset('next-lesson', 10, {
      catalog: CATALOG,
      position: { questId: 'quest:story-sun-and-moon-listen' },
      shown: { questIds: ['quest:stage1-letters-q2'], storyIds: [] },
    });
    expect(outline(r)).toBe('stage1-letters-q3 · stage1-life-q1');
    const end = resolvePreset('next-lesson', 10, { catalog: CATALOG, shown: { questIds: ['quest:stage7-crafts-q3'], storyIds: [] } });
    expect([end.preset, end.fallback]).toEqual(['hangul-week-1', 'zero']);
    const unknown = resolvePreset('next-lesson', 10, { catalog: CATALOG, position: { questId: 'quest:nope' } });
    expect([unknown.preset, unknown.fallback]).toEqual(['hangul-week-1', 'zero']);
  });
});

describe('by-stage', () => {
  it('starts at the position when it is in the chosen stage, else at the first lesson not shown, else the first lesson', () => {
    const at = resolvePreset('by-stage', 10, { catalog: CATALOG, stage: 'stage3', position: { questId: 'quest:stage3-rites-q2' } });
    expect(outline(at)).toBe('stage3-rites-q2 · stage3-rites-q3');
    const elsewhere = resolvePreset('by-stage', 10, { catalog: CATALOG, stage: 'stage3', position: { questId: 'quest:stage2-life-q1' } });
    expect(outline(elsewhere)).toBe('stage3-letters-q1 · stage3-letters-q2');
    const shown = resolvePreset('by-stage', 10, {
      catalog: CATALOG,
      stage: 'stage7',
      shown: { questIds: ['quest:stage7-letters-q1', 'quest:stage7-letters-q2'], storyIds: [] },
    });
    expect(outline(shown)).toBe('stage7-letters-q3 · stage7-life-q1');
    const all = CATALOG.cells.filter((c) => c.stage === 'stage7').flatMap((c) => c.questIds);
    const restart = resolvePreset('by-stage', 10, { catalog: CATALOG, stage: 'stage7', shown: { questIds: all, storyIds: [] } });
    expect([outline(restart), restart.fallback]).toEqual(['stage7-letters-q1 · stage7-letters-q2', null]);
  });

  it('continues through the chosen stage only', () => {
    const r = resolvePreset('by-stage', 30, { catalog: CATALOG, stage: 'stage7', position: { questId: 'quest:stage7-crafts-q2' } });
    expect(outline(r)).toBe('stage7-crafts-q2 · stage7-crafts-q3 · quiz 4 · copy-on-paper 5');
  });
});

describe('story-time', () => {
  const ready = CATALOG.stories.filter((st) => st.status === 'ready').sort((x, y) => x.order - y.order);
  const storiesOf = (r: ResolvedPreset): string[] => r.blocks.flatMap((bl) => (bl.kind === 'story' ? [bl.storyId] : []));

  it('the catalogue has ready stories enough to fill 30 minutes', () => {
    expect(ready.length).toBeGreaterThanOrEqual(8);
  });

  // Section 14: at 10 / 20 / 30, minutes no more than T and no less than T - 5, with 0, 1 and all stories in Recent.
  const recents: [string, string[]][] = [
    ['nothing shown', []],
    ['one story shown', [ready[0]?.id as string]],
    ['every story shown', ready.map((st) => st.id)],
  ];
  for (const [label, storyIds] of recents) {
    it.each([10, 20, 30])(`${label}: %i min fills to the length, each story once, copy-on-paper`, (minutes) => {
      const r = resolvePreset('story-time', minutes, { catalog: CATALOG, shown: { questIds: [], storyIds } });
      expect(minutesOf(r)).toBeLessThanOrEqual(minutes);
      expect(minutesOf(r)).toBeGreaterThanOrEqual(minutes - 5);
      const ids = storiesOf(r);
      expect(new Set(ids).size).toBe(ids.length);
      expect(r.blocks.some((bl) => bl.kind === 'activity' && bl.preset === 'air-write')).toBe(false);
      expect(r.blocks.every((bl) => bl.kind !== 'story' || bl.checks === minutes >= 20)).toBe(true);
      expect(r.fallback).toBe(storyIds.length === ready.length ? 'restart' : null);
      expect(r.titleKey).toBe('story.title');
    });
  }

  it('the stories not shown come first, then the shown ones by order', () => {
    const shown = ready.slice(0, 22).map((st) => st.id);
    const r = resolvePreset('story-time', 20, { catalog: CATALOG, shown: { questIds: [], storyIds: shown } });
    expect(storiesOf(r).slice(0, 3)).toEqual([ready[22]?.id, ready[23]?.id, ready[0]?.id]);
    expect(r.fallback).toBeNull();
  });

  it('every story shown: from the first story again, with the restart line', () => {
    const r = resolvePreset('story-time', 10, { catalog: CATALOG, shown: { questIds: [], storyIds: CATALOG.stories.map((st) => st.id) } });
    expect([outline(r), r.fallback]).toEqual(['story:sejong-new-letters · story:shapes-of-hangeul', 'restart']);
  });

  it('the console (a class position with stage S) never takes a story more than one stage above S; the app position has no bound', () => {
    const position = classPosition([{ journey: journey('stage1', [['stage1', 3, 0]]) }], CATALOG);
    expect(position?.stage).toBe('stage1');
    const shown = ready.filter((st) => st.recommendedStage <= 1).map((st) => st.id);
    const console = resolvePreset('story-time', 30, { catalog: CATALOG, position, shown: { questIds: [], storyIds: shown } });
    const levels = storiesOf(console).map((id) => ready.find((st) => st.id === id)?.recommendedStage);
    expect(levels.every((n) => n !== undefined && n <= 2)).toBe(true);
    expect(storiesOf(console)[0]).toBe('story:sillok-mountain-archives');
    // A class past the end of Stage 1: the quest is in Stage 2, the bound stays Stage 1 + 1.
    const past = classPosition([{ journey: journey('stage1', [['stage1', 15, 0]]) }], CATALOG);
    expect(past).toEqual({ questId: 'quest:stage2-letters-q1', stage: 'stage1' });
    const all = resolvePreset('story-time', 30, { catalog: CATALOG, position: past, shown: { questIds: [], storyIds: ready.filter((st) => st.recommendedStage <= 2).map((st) => st.id) } });
    expect(all.fallback).toBe('restart');
    expect(storiesOf(all).every((id) => (ready.find((st) => st.id === id)?.recommendedStage ?? 9) <= 2)).toBe(true);
    // The app's position (N3) carries no stage: every ready story is a candidate.
    const app = resolvePreset('story-time', 10, { catalog: CATALOG, position: { questId: 'quest:stage1-life-q1' }, shown: { questIds: [], storyIds: ready.slice(0, 23).map((st) => st.id) } });
    expect(storiesOf(app)[0]).toBe('story:joseon-records-today');
  });

  // Section 14: every ready story in every UI locale builds a deck the schema accepts, titled "Story time" (section 12.2 presets.story.title).
  const STORY_TITLE = { en: 'Story time', es: 'Hora del cuento', ko: '이야기 시간' } as const;
  it.each(Object.entries(STORY_TITLE))('every ready story, %s', (uiLocale, title) => {
    for (const [i, st] of ready.entries()) {
      for (const minutes of [10, 20, 30]) {
        const shownBefore = ready.slice(0, i).map((x) => x.id);
        const r = resolvePreset('story-time', minutes, { catalog: CATALOG, shown: { questIds: [], storyIds: shownBefore } });
        expect(storiesOf(r)[0]).toBe(st.id);
        const deck = presetDeck(r, { id: 'lecture:story001', title, createdAt: '2026-10-15T09:00:00.000Z', seed: 3, options: { uiLocale: uiLocale as 'en' | 'es' | 'ko' }, source: 'quick' });
        expect(LectureDeckSchema.safeParse(deck).success).toBe(true);
        expect(deck.v).toBe(1);
      }
    }
  });
});

describe('word-review (W1-W3)', () => {
  it('quest ids at most 12, catalogue quests only, de-duplicated; word ids by grammar, at most 24', () => {
    const questIds = [...CATALOG.cells.flatMap((c) => c.questIds).slice(0, 14), 'quest:stage1-life-q1', 'quest:nope', 'Minho'];
    const vocabIds = [...Array.from({ length: 26 }, (_, i) => `vocab:w${i}`), 'vocab:w0', 'Sora'];
    const r = resolvePreset('word-review', 20, { catalog: CATALOG, recentWords: { questIds, vocabIds } });
    const block = r.blocks[0];
    if (block?.kind !== 'word-review') throw new Error('expected a word-review block');
    expect(block.questIds).toEqual(CATALOG.cells.flatMap((c) => c.questIds).slice(0, 12));
    expect(block.vocabIds).toEqual(Array.from({ length: 24 }, (_, i) => `vocab:w${i}`));
    expect(block.rounds).toBe(10);
  });

  it('no usable id: the warm-up, with its line, from the letters to revisit', () => {
    const r = resolvePreset('word-review', 10, { catalog: CATALOG, recentWords: { questIds: ['quest:nope'], vocabIds: ['nope'] }, revisitChars: ['ㅎ'] });
    expect([r.preset, outline(r), r.fallback, r.titleKey]).toEqual(['warm-up', 'revisit ㅎㄱㄴㄷ · air-write 3', 'warm-up', 'warmup.short']);
  });

  it('W1: plan quests this week first then last week (at most 12); rollup words only with at least 2 vocab summaries (at most 3)', () => {
    const thisWeek = ['quest:stage2-life-q1', 'quest:stage2-life-q2'];
    const lastWeek = [...Array.from({ length: 12 }, (_, i) => `quest:q${i}`), 'quest:stage2-life-q1', 'Minho'];
    const vocabRevisit = ['vocab:apple', 'vocab:rice', 'vocab:apple', 'vocab:kimchi', 'vocab:tiger', 'Sora'];
    expect(WORD_REVIEW_ROLLUP_MAX).toBe(3);
    const one = consoleRecentWords({ thisWeek, lastWeek, vocabRevisit, vocabSummaries: 1 });
    expect(one).toEqual({ questIds: [...thisWeek, ...Array.from({ length: 10 }, (_, i) => `quest:q${i}`)], vocabIds: [] });
    expect(consoleRecentWords({ thisWeek, lastWeek, vocabRevisit, vocabSummaries: 0 }).vocabIds).toEqual([]);
    expect(consoleRecentWords({ thisWeek, lastWeek, vocabRevisit, vocabSummaries: 2 }).vocabIds).toEqual(['vocab:apple', 'vocab:rice', 'vocab:kimchi']);
  });
});

describe('warm-up', () => {
  it('the letters to revisit (compatibility jamo only, at most 6, de-duplicated), else the first six letters', () => {
    expect(outline(resolvePreset('warm-up', 10, { catalog: CATALOG, revisitChars: ['ㄱ', 'ㄱ', 'a', '가', 'ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ'] }))).toBe(
      'revisit ㄱㅏㅓㅗㅜㅡ · air-write 3',
    );
    expect(outline(resolvePreset('warm-up', 10, { catalog: CATALOG, revisitChars: ['Minho'] }))).toBe('revisit ㄱㄴㄷㅏㅓㅗ · air-write 3');
  });

  // Section 4.2 U top-up: Recent with 0, 1, 3 and 6 letters (presenter, app) and a console roll-up of 1 letter with no plan.
  const topUp: [string, readonly string[], letters: string, minutes: number][] = [
    ['presenter, 0 letters', [], 'ㄱㄴㄷㅏㅓㅗ', 10],
    ['presenter, 1 letter', ['ㅎ'], 'ㅎㄱㄴㄷ', 9],
    ['app, 3 letters', ['ㄴ', 'ㅑ', 'ㄱ'], 'ㄴㅑㄱㄷ', 9],
    ['app, 6 letters', ['ㅂ', 'ㅅ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ'], 'ㅂㅅㅈㅊㅋㅌ', 10],
    ['console roll-up, 1 letter, no plan', ['ㄱ'], 'ㄱㄴㄷㅏ', 9],
  ];

  it.each(topUp)('%s: at least 4 different letters, so exactly 4 sound-quiz rounds', (_, chars, letters, minutes) => {
    const r = resolvePreset('warm-up', 10, { catalog: CATALOG, revisitChars: chars, plan: null });
    const revisit = r.blocks[0];
    if (revisit?.kind !== 'revisit') throw new Error('expected a revisit block');
    expect(revisit.chars.join('')).toBe(letters);
    expect(new Set(revisit.chars).size).toBe(revisit.chars.length);
    expect(revisit.chars.length).toBeGreaterThanOrEqual(WARM_UP_MIN_LETTERS);
    // Rule 3: the revisit quiz has min(4, letters) rounds; rule 12 counts them 1 each.
    expect(Math.min(4, revisit.chars.length)).toBe(4);
    expect(minutesOf(r)).toBe(minutes);
    expect(warmUpChars(chars)).toEqual([...letters]);
  });
});

describe('warm-up from a Recent of the Stage 1 rites quests', () => {
  it('keeps only plain jamo (no ㄴ/final entries), tops up to at least 4 and gives a deck the schema accepts', () => {
    const rites = CATALOG.quests.filter((q) => q.id.startsWith('quest:stage1-rites-'));
    const teaches = rites.flatMap((q) => q.teaches);
    expect(teaches.some((t) => t.includes('/'))).toBe(true);
    const r = resolvePreset('warm-up', 10, { catalog: CATALOG, revisitChars: teaches });
    const revisit = r.blocks[0];
    if (revisit?.kind !== 'revisit') throw new Error('expected a revisit block');
    expect(revisit.chars.every((c) => !c.includes('/'))).toBe(true);
    expect(revisit.chars.length).toBeGreaterThanOrEqual(WARM_UP_MIN_LETTERS);
    expect(new Set(revisit.chars).size).toBe(revisit.chars.length);
    const deck = presetDeck(r, { id: 'lecture:warm0001', title: 'Quick warm-up', createdAt: '2026-10-15T09:00:00.000Z', seed: 1, source: 'quick' });
    expect(LectureDeckSchema.safeParse(deck).success).toBe(true);
  });
});

describe('questIdsOfBlocks (section 4.3)', () => {
  it('a quest gives its id, an episode its cell quests in cell order, every other kind none; de-duplicated, first kept', () => {
    const cell = CATALOG.cells.find((c) => c.episodeId === 'episode:stage1-letters');
    const blocks: LectureBlock[] = [
      { kind: 'quest', id: 'quest:stage1-letters-q2' },
      { kind: 'episode', id: 'episode:stage1-letters' },
      { kind: 'episode', id: 'episode:nope' },
      { kind: 'story', storyId: 'story:sun-and-moon', checks: true },
      { kind: 'revisit', chars: ['ㄱ'] },
      { kind: 'jamo-set', jamoIds: ['jamo:giyeok'] },
      { kind: 'cards', cardIds: ['card:book'] },
      { kind: 'vocab', topicId: 'vocab-topic:food' },
      { kind: 'word-review', questIds: ['quest:stage2-life-q1'], vocabIds: [], rounds: 5 },
      { kind: 'activity', preset: 'air-write', minutes: 3 },
      { kind: 'quiz', from: 'previous', rounds: 4 },
      { kind: 'class-code', code: 'ABC234' },
      { kind: 'quest', id: 'quest:stage2-life-q1' },
      { kind: 'story', storyId: 'story:sun-and-moon', checks: false },
    ];
    expect(questIdsOfBlocks(blocks, CATALOG)).toEqual(['quest:stage1-letters-q2', ...(cell?.questIds ?? []).filter((id) => id !== 'quest:stage1-letters-q2'), 'quest:stage2-life-q1']);
    expect(cell?.questIds[0]).toBe('quest:stage1-letters-q1');
    expect(storyIdsOfBlocks(blocks)).toEqual(['story:sun-and-moon']);
    expect(questIdsOfBlocks([], CATALOG)).toEqual([]);
  });

  it('feeds N4 the same way a stored episode deck reads', () => {
    const shown = { questIds: questIdsOfBlocks([{ kind: 'episode', id: 'episode:stage1-letters' }], CATALOG), storyIds: [] };
    expect(outline(resolvePreset('next-lesson', 10, { catalog: CATALOG, shown }))).toBe('stage1-life-q1 · stage1-life-q2 · air-write 2');
  });
});

describe('learnerPosition (N3)', () => {
  it('the routeNext quest when it is a route quest', () => {
    expect(learnerPosition('quest:stage2-life-q1', [], CATALOG)).toEqual({ questId: 'quest:stage2-life-q1' });
  });

  it('a routeNext quest off the route starts after the furthest done route quest, by route order', () => {
    const done = ['quest:stage1-letters-q1', 'quest:stage1-life-q2', 'quest:stage1-letters-q2', 'quest:story-sun-and-moon-listen'];
    const position = learnerPosition('quest:story-sun-and-moon-listen', done, CATALOG);
    expect(position).toEqual({ questId: 'quest:stage1-life-q3' });
    expect(outline(resolvePreset('next-lesson', 10, { catalog: CATALOG, position }))).toBe('stage1-life-q3 · stage1-rites-q1 · air-write 2');
  });

  it('none done: the first route quest; no routeNext quest reads the same; the last route quest done: null (the fallback)', () => {
    expect(learnerPosition('quest:homework-x', [], CATALOG)).toEqual({ questId: 'quest:stage1-letters-q1' });
    expect(learnerPosition(null, [], CATALOG)).toEqual({ questId: 'quest:stage1-letters-q1' });
    expect(learnerPosition(null, ['quest:stage7-crafts-q3'], CATALOG)).toBeNull();
  });
});

describe('fallbacks on a catalogue missing what a preset needs', () => {
  const withCells = (ready: (stage: StageKey) => boolean): Catalog => ({
    ...CATALOG,
    cells: CATALOG.cells.map((c) => (ready(c.stage) ? c : { ...c, status: 'preview' as const })),
  });

  it('a stage with no ready lesson gives Hangul week 1', () => {
    const r = resolvePreset('by-stage', 20, { catalog: withCells((s) => s !== 'stage6'), stage: 'stage6' });
    expect([r.preset, r.fallback]).toEqual(['hangul-week-1', 'zero']);
  });

  it('no stage chip: Stage 1', () => {
    expect(resolvePreset('by-stage', 10, empty).stageNumber).toBe(1);
  });

  it('no ready story: Hangul week 1; no story near the class level: any ready story', () => {
    const none = resolvePreset('story-time', 20, { catalog: { ...CATALOG, stories: CATALOG.stories.map((s) => ({ ...s, status: 'draft' as const })) } });
    expect([none.preset, none.fallback]).toEqual(['hangul-week-1', 'zero']);
    const high = { ...CATALOG, stories: CATALOG.stories.filter((s) => s.recommendedStage === 6) };
    const far = resolvePreset('story-time', 10, { catalog: high, position: { questId: 'quest:stage1-life-q1', stage: 'stage1' } });
    expect([outline(far), far.fallback]).toEqual(['story:joseon-records-today · quiz 4 · copy-on-paper 2', null]);
    // A stage that is not a stage key reads as no bound.
    const odd = resolvePreset('story-time', 10, { catalog: high, position: { questId: 'quest:stage1-life-q1', stage: 'stage9' as StageKey } });
    expect(outline(odd)).toBe('story:joseon-records-today · quiz 4 · copy-on-paper 2');
  });

  it('no Hangul week 1 cell: the warm-up, named as the warm-up', () => {
    const noCell = { ...CATALOG, cells: CATALOG.cells.map((c) => (c.episodeId === 'episode:stage1-letters' ? { ...c, questIds: [] } : c)) };
    const r = resolvePreset('hangul-week-1', 20, { catalog: noCell });
    expect([r.preset, r.titleKey, outline(r)]).toEqual(['warm-up', 'warmup.short', 'revisit ㄱㄴㄷㅏㅓㅗ · air-write 3']);
    const gone = { ...CATALOG, cells: CATALOG.cells.filter((c) => c.episodeId !== 'episode:stage1-letters') };
    expect(outline(resolvePreset('hangul-week-1', 20, { catalog: gone }))).toBe('revisit ㄱㄴㄷㅏㅓㅗ · air-write 3');
  });

  it('a Stage 5 book quest without its story stays a quest block', () => {
    const noStory = { ...CATALOG, stories: CATALOG.stories.filter((s) => s.id !== 'story:sejong-new-letters') };
    expect(outline(resolvePreset('by-stage', 10, { catalog: noStory, stage: 'stage5' })).split(' · ')[0]).toBe('story-sejong-new-letters-read');
  });
});

describe('classPosition (N2)', () => {
  const at = (rows: { journey?: JourneySummary | null }[], catalog: Catalog = CATALOG) => classPosition(rows, catalog)?.questId ?? null;

  it('the stage most learners are in, at the smallest done + known there', () => {
    const rows = [
      { journey: journey('stage2', [['stage1', 15, 0], ['stage2', 4, 0]]) },
      { journey: journey('stage2', [['stage2', 7, 0]]) },
      { journey: journey('stage3', [['stage3', 1, 0]]) },
    ];
    // Stage 2 route order: letters q1-q6, then life q1-q3 ...; index 4 = letters q5.
    expect(at(rows)).toBe('quest:stage2-letters-q5');
  });

  it('a tie goes to the earlier stage', () => {
    expect(at([{ journey: journey('stage3', [['stage3', 2, 0]]) }, { journey: journey('stage2', [['stage2', 1, 0]]) }])).toBe('quest:stage2-letters-q2');
  });

  it('known counts: a class that placed out of early lessons does not restart at them', () => {
    expect(at([{ journey: journey('stage1', [['stage1', 1, 6]]) }])).toBe('quest:stage1-rites-q2');
  });

  it('a missing entry counts 0; past the end of the stage gives the next stage; past the end of the route gives null', () => {
    expect(at([{ journey: journey('stage4', [['stage3', 15, 0]]) }])).toBe('quest:stage4-letters-q1');
    expect(at([{ journey: journey('stage1', [['stage1', 15, 0]]) }])).toBe('quest:stage2-letters-q1');
    expect(at([{ journey: journey('stage7', [['stage7', 15, 0]]) }])).toBeNull();
  });

  it('no usable summary: null (absent, another version, no here, an unknown stage); bad counts read 0', () => {
    expect(at([])).toBeNull();
    expect(at([{}, { journey: null }, { journey: journey(null, [['stage1', 3, 0]]) }, { journey: journey('stage9', [['stage9', 3, 0]]) }])).toBeNull();
    expect(at([{ journey: { ...journey('stage2', []), v: 2 } as unknown as JourneySummary }])).toBeNull();
    expect(at([{ journey: { v: 1, here: 'stage2', stages: 'x' } as unknown as JourneySummary }])).toBeNull();
    const bad = { v: 1, here: 'stage2', stages: [{ stage: 'stage2', state: 'open', done: -3, known: 1.5, total: 1 }] } as unknown as JourneySummary;
    expect(at([{ journey: bad }])).toBe('quest:stage2-letters-q1');
  });

  it('a stage with no ready lesson: null', () => {
    const catalog = { ...CATALOG, cells: CATALOG.cells.map((c) => (c.stage === 'stage3' ? { ...c, status: 'preview' as const } : c)) };
    expect(at([{ journey: journey('stage3', [['stage3', 0, 0]]) }], catalog)).toBeNull();
  });

  it('feeds next-lesson (N2), and a family of one gives that learner place', () => {
    const position = classPosition([{ journey: journey('stage4', [['stage4', 3, 0]]) }], CATALOG);
    expect(outline(resolvePreset('next-lesson', 10, { catalog: CATALOG, position }))).toBe('stage4-life-q1 · stage4-life-q2');
  });
});

describe('determinism and parity', () => {
  const contexts: PresetContext[] = [
    empty,
    { catalog: CATALOG, position: { questId: 'quest:stage3-life-q2' }, stage: 'stage3' },
    { catalog: CATALOG, shown: { questIds: ['quest:stage2-life-q2'], storyIds: ['story:sejong-new-letters'] }, revisitChars: ['ㅎ', 'ㅑ'] },
    { catalog: CATALOG, recentWords: { questIds: ['quest:stage2-life-q1'], vocabIds: ['vocab:apple'] }, stage: 'stage5' },
    { catalog: CATALOG, plan: { title: 'Week 4', blocks: [{ kind: 'quest', id: 'quest:stage2-rites-q1' }] } },
  ];
  const freeze = <T>(value: T): T => {
    if (typeof value === 'object' && value !== null) {
      for (const v of Object.values(value)) freeze(v);
      Object.freeze(value);
    }
    return value;
  };

  it('the same preset, length and context give identical blocks on the console, the presenter and the app', () => {
    for (const ctx of contexts) {
      // Three callers build the context on their own: fresh objects, frozen, never shared.
      const [consoleCtx, presenterCtx, appCtx] = [0, 1, 2].map(() => freeze({ ...structuredClone({ ...ctx, catalog: undefined }), catalog: CATALOG }) as PresetContext);
      for (const p of LECTURE_PRESETS) {
        for (const m of PRESET_LENGTHS[p]) {
          const a = resolvePreset(p, m, consoleCtx as PresetContext);
          expect(resolvePreset(p, m, presenterCtx as PresetContext)).toEqual(a);
          expect(resolvePreset(p, m, appCtx as PresetContext)).toEqual(a);
          expect(resolvePreset(p, m, consoleCtx as PresetContext)).toEqual(a);
        }
      }
    }
  });
});

describe('the deck a preset becomes', () => {
  const meta = { id: 'lecture:preset01', title: 'Next lesson', createdAt: '2026-10-15T09:00:00.000Z', seed: 7, source: 'quick' as const };
  const contexts: PresetContext[] = [
    empty,
    { catalog: CATALOG, position: { questId: 'quest:stage6-life-q1' }, stage: 'stage5' },
    { catalog: CATALOG, recentWords: { questIds: ['quest:stage2-life-q1'], vocabIds: ['vocab:apple'] } },
  ];

  it('only word-review decks are v2, and only they carry the preset; every deck encodes and decodes', () => {
    for (const ctx of contexts) {
      for (const p of LECTURE_PRESETS) {
        for (const m of PRESET_LENGTHS[p]) {
          const r = resolvePreset(p, m, ctx);
          const deck = presetDeck(r, meta);
          const v2 = r.blocks.some((b) => b.kind === 'word-review');
          expect(v2).toBe(r.preset === 'word-review');
          expect(deck.v).toBe(v2 ? 2 : 1);
          expect(deckVersion(deck)).toBe(deck.v);
          expect('preset' in deck).toBe(v2);
          if (v2) expect(deck.preset).toBe('word-review');
          const fragment = encodeDeck(deck);
          expect(fragment.startsWith(`${deck.v}.`)).toBe(true);
          const decoded = decodeDeck(fragment);
          expect(decoded.ok && decoded.deck.blocks).toEqual(LectureDeckSchema.parse(deck).blocks);
        }
      }
    }
  });

  it('keeps the options it is given and never names a helper picker (LV-H)', () => {
    const r = resolvePreset('hangul-week-1', 10, empty);
    expect(presetDeck(r, meta).picker).toBeNull();
    const deck = presetDeck(r, { ...meta, options: { uiLocale: 'ko' }, source: 'catalogue' });
    expect([deck.options, deck.picker, deck.source]).toEqual([{ uiLocale: 'ko' }, null, 'catalogue']);
  });
});

describe('no output contains a roster string', () => {
  const AWKWARD = ["Minho", 'Ji-woo', "O'Brien", 'Zoë', '김민호', 'Sora K.', '?', 'quest:Minho', 'vocab:Sora', 'story:minho', 'ㄱMinho', 'Ana María', 'x'.repeat(40)];
  // Deterministic pseudo-random draws (no Math.random in tests).
  const draw = (seed: number) => {
    let s = seed;
    return (n: number): number => {
      s = (s * 1_103_515_245 + 12_345) % 2_147_483_648;
      return s % n;
    };
  };

  it('names placed in every context field and in the roster rows never reach the blocks, the title fields or the deck', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const pick = draw(seed);
      const name = AWKWARD[pick(AWKWARD.length)] as string;
      const realQuest = CATALOG.quests[pick(CATALOG.quests.length)]?.id as string;
      const rows = [
        { journey: journey(pick(2) === 0 ? 'stage2' : name, [['stage2', pick(9), pick(3)], [name, 1, 1]]), name, initials: name.slice(0, 2) },
        { journey: journey('stage3', [['stage3', pick(9), 0]]), displayName: name },
      ];
      const ctx: PresetContext = {
        catalog: CATALOG,
        // A name in the plan title: without the console title check it never becomes the deck title.
        plan: pick(2) === 0 ? { title: `${name} week`, blocks: [{ kind: 'quest', id: realQuest }] } : null,
        position: pick(3) === 0 ? { questId: name } : classPosition(rows, CATALOG),
        shown: { questIds: [name, realQuest], storyIds: [name, `story:${name}`] },
        // Word ids pass by grammar (a roll-up's ids, never a name field), so a name is offered raw here.
        recentWords: { questIds: [name, realQuest, `quest:${name}`], vocabIds: [name, 'vocab:apple'] },
        revisitChars: [name, 'ㄱ'],
        stage: pick(2) === 0 ? (name as StageKey) : 'stage2',
      };
      for (const p of LECTURE_PRESETS) {
        for (const m of PRESET_LENGTHS[p]) {
          const r = resolvePreset(p, m, ctx);
          const deck = presetDeck(r, { id: 'lecture:prop0001', title: 'Story time', createdAt: '2026-10-15T09:00:00Z', seed, source: 'quick' });
          const text = JSON.stringify([r, deck]);
          for (const n of AWKWARD) {
            if (n === '?') continue;
            expect(text.includes(n), `${p} ${m} carried ${n}`).toBe(false);
          }
        }
      }
    }
  });
});
