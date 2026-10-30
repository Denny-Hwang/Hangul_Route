import type { MemoryItemState } from '@hangul-route/content-schema';
import type { ReviewFormat, ReviewItem, ReviewItemKind } from '@hangul-route/content-schema/review-items';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyAnswer, type DayFacts } from '../../memory/spacing';
import {
  CHECK_PRODUCE_SHARE,
  DAILY_REVIEW_DUE_CAP,
  DAILY_REVIEW_SIZE,
  KEEP_GOING_ROUNDS_PER_DAY,
  MAX_FORMAT_RUN,
  MAX_THEME_RUN,
  REVIEW_FIRST_FACTOR,
  TRY_AGAIN_MAX,
  WARMUP_SIZE,
  buildCheck,
  buildDailyReview,
  buildKeepGoing,
  buildTryAgain,
  buildWarmup,
  canKeepGoing,
  cellVisible,
  dueCount,
  duePool,
  engineStates,
  gradeTyped,
  jamoOf,
  jitter,
  reviewFirst,
  rungToAsk,
  typedAnswer,
  withSentenceCredit,
  wordsInside,
  type EngineContext,
  type EngineRow,
  type ReviewQuestion,
} from '../engine';

/**
 * F-CURR-002 sections 4.3 and 4.5 (row CM-13): the review engine. Selection order, the
 * interleaving caps when the pool allows, rungs by kind with the r/c split and the miss at produce,
 * the two-rung ladder with no device voice, `dictation-unambiguous`, typing tolerance, credit
 * inside sentences, the session builders and their end-early rule, the hidden-source skip, and
 * determinism under a seed. The 60-day simulation gate is `engine-simulation.test.ts`.
 */

const TODAY = '2026-11-10';
const AT = '2026-11-10T09:00:00.000Z';

const ALL_FORMATS: Readonly<Record<ReviewItemKind, readonly ReviewFormat[]>> = {
  sym: ['hear-pick', 'read-pick', 'syllable-build', 'match-shape'],
  syl: ['hear-pick', 'read-pick', 'syllable-build'],
  lex: ['hear-pick', 'read-pick', 'type-see', 'dictation', 'syllable-build'],
  pat: ['hear-pick', 'read-pick', 'cloze-pick', 'sentence-builder'],
  exc: ['hear-pick', 'read-pick', 'sentence-builder'],
  rea: ['read-pick', 'cloze-pick'],
};

function mk(id: string, over: Partial<ReviewItem> = {}): ReviewItem {
  const kind = (id.startsWith('vocab:') ? 'lex' : id.slice(0, 3)) as ReviewItemKind;
  return {
    id,
    kind,
    ko: over.ko ?? '가',
    romanization: 'ga',
    home: 'life',
    stage: 2,
    volume: 1,
    cells: ['episode:stage2-life'],
    asked: [],
    formats: [...ALL_FORMATS[kind]],
    soundChange: false,
    homophoneOf: [],
    ...over,
  };
}

const st = (over: Partial<MemoryItemState> = {}): MemoryItemState => ({ b: 1, d: TODAY, c: 0, r: 0, n: 1, f: '2026-11-01', s: 1, at: '2026-11-09T09:00:00.000Z', ...over });

function ctxOf(items: readonly ReviewItem[], states: Record<string, EngineRow>, over: Partial<EngineContext> = {}): EngineContext {
  return { index: { items, byId: new Map(items.map((i) => [i.id, i])), retired: new Set() }, states, today: TODAY, voice: true, seed: 's', ...over };
}

const ids = (qs: readonly ReviewQuestion[]): string[] => qs.map((q) => q.itemId);

const maxRun = (values: readonly string[]): number => {
  let best = 0;
  let run = 0;
  values.forEach((v, i) => {
    run = i > 0 && values[i - 1] === v ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
};

describe('the due pool and selection order', () => {
  it('holds every item with a box and d <= today, overdue included; not met, not due, answered today, retired and unknown items are left out', () => {
    const items = ['lex:a', 'lex:b', 'lex:c', 'lex:d', 'lex:e', 'lex:f'].map((id) => mk(id));
    const ctx = ctxOf(items, {
      'lex:a': { st: st({ d: TODAY }) },
      'lex:b': { st: st({ d: '2026-10-01' }) },
      'lex:c': { st: st({ d: '2026-11-11' }) },
      'lex:d': { st: st({ b: 0, d: null, s: 0 }) },
      'lex:e': { st: st(), l: TODAY },
      'lex:f': { st: st() },
      'lex:zz': { st: st() },
    });
    ctx.index = { ...ctx.index, retired: new Set(['lex:f']) };
    expect(duePool(ctx).map((i) => i.id).sort()).toEqual(['lex:a', 'lex:b']);
    expect(dueCount(ctx)).toBe(2);
  });

  it('takes the lowest box first, then the oldest due day, then a jitter seeded by the item id', () => {
    const items = ['lex:a', 'lex:b', 'lex:c', 'lex:d', 'lex:e'].map((id) => mk(id));
    const states = {
      'lex:a': { st: st({ b: 3, d: '2026-11-01' }) },
      'lex:b': { st: st({ b: 1, d: TODAY }) },
      'lex:c': { st: st({ b: 1, d: '2026-11-05' }) },
      'lex:d': { st: st({ b: 2, d: '2026-11-08' }) },
      'lex:e': { st: st({ b: 2, d: '2026-11-08' }) },
    };
    const order = duePool(ctxOf(items, states)).map((i) => i.id);
    expect(order.slice(0, 2)).toEqual(['lex:c', 'lex:b']);
    expect(order[4]).toBe('lex:a');
    const tie = jitter('s', 'lex:d') < jitter('s', 'lex:e') ? ['lex:d', 'lex:e'] : ['lex:e', 'lex:d'];
    expect(order.slice(2, 4)).toEqual(tie);
  });

  it('is pure: building sessions never changes a state, so a due item is never pushed to another day', () => {
    const items = Array.from({ length: 30 }, (_, i) => mk(`lex:w${i}`));
    const states = Object.fromEntries(items.map((it, i) => [it.id, Object.freeze({ st: Object.freeze(st({ b: 1 + (i % 7), d: '2026-11-0' + (1 + (i % 9)), s: 1 + (i % 7), c: i % 4 })) })]));
    const before = JSON.stringify(states);
    const ctx = ctxOf(items, Object.freeze(states) as Record<string, EngineRow>);
    buildDailyReview(ctx);
    buildKeepGoing(ctx, { dailyDueDrawn: 10, keepGoingRounds: 0 });
    buildWarmup(ctx, { cell: 'episode:stage3-life', stage: 3 });
    buildCheck(ctx, { itemIds: items.map((i) => i.id), size: 10 });
    expect(JSON.stringify(states)).toBe(before);
  });

  it('review first is a suggestion once the pool is larger than 3 Daily Reviews', () => {
    const n = REVIEW_FIRST_FACTOR * DAILY_REVIEW_SIZE;
    const items = Array.from({ length: n + 1 }, (_, i) => mk(`lex:w${i}`));
    const states = Object.fromEntries(items.map((it) => [it.id, { st: st() }]));
    expect(reviewFirst(ctxOf(items, states))).toBe(true);
    delete states['lex:w0'];
    expect(reviewFirst(ctxOf(items, states))).toBe(false);
  });
});

describe('determinism under a seed', () => {
  const arbStates = fc.array(
    fc.record({ b: fc.integer({ min: 0, max: 7 }), due: fc.integer({ min: -9, max: 5 }), c: fc.integer({ min: 0, max: 3 }), theme: fc.constantFrom('life', 'rites', 'nature', 'letters'), kind: fc.constantFrom<ReviewItemKind>('sym', 'syl', 'lex', 'pat', 'exc', 'rea') }),
    { minLength: 0, maxLength: 40 },
  );
  const build = (spec: { b: number; due: number; c: number; theme: string; kind: ReviewItemKind }[]) => {
    const items = spec.map((s, i) => mk(`${s.kind}:x${i}`, { home: s.theme }));
    const states = Object.fromEntries(spec.map((s, i) => [`${s.kind}:x${i}`, { st: st({ b: s.b, d: s.b === 0 ? null : `2026-11-${String(10 + s.due).padStart(2, '0')}`, c: s.c, s: Math.max(s.b, 3) }) }]));
    return { items, states };
  };

  it('the same states and seed give the same sessions', () => {
    fc.assert(
      fc.property(arbStates, fc.string(), fc.boolean(), (spec, seed, voice) => {
        const { items, states } = build(spec);
        const a = ctxOf(items, states, { seed, voice });
        const b = ctxOf([...items], JSON.parse(JSON.stringify(states)) as Record<string, EngineRow>, { seed, voice });
        expect(buildDailyReview(a)).toEqual(buildDailyReview(b));
        expect(buildKeepGoing(a, { dailyDueDrawn: 0, keepGoingRounds: 1 })).toEqual(buildKeepGoing(b, { dailyDueDrawn: 0, keepGoingRounds: 1 }));
        expect(buildCheck(a, { itemIds: items.map((i) => i.id), size: 10 })).toEqual(buildCheck(b, { itemIds: items.map((i) => i.id), size: 10 }));
      }),
      { numRuns: 200 },
    );
  });

  it('the insertion order of the states does not matter', () => {
    fc.assert(
      fc.property(arbStates, (spec) => {
        const { items, states } = build(spec);
        const reversed = Object.fromEntries(Object.entries(states).reverse());
        expect(buildDailyReview(ctxOf(items, states))).toEqual(buildDailyReview(ctxOf(items, reversed)));
      }),
      { numRuns: 100 },
    );
  });

  it('a seed only moves ties: the box order holds under every seed', () => {
    fc.assert(
      fc.property(arbStates, fc.string(), (spec, seed) => {
        const { items, states } = build(spec);
        const boxes = duePool(ctxOf(items, states, { seed })).map((i) => (states[i.id] as EngineRow).st.b);
        expect(boxes).toEqual([...boxes].sort((x, y) => x - y));
      }),
      { numRuns: 100 },
    );
  });
});

describe('interleaving, when the pool allows', () => {
  const themes = ['life', 'rites', 'nature'];

  it('keeps no more than 2 consecutive items of one theme and 3 of one format', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ b: fc.integer({ min: 1, max: 2 }), due: fc.integer({ min: 1, max: 9 }) }), { minLength: 3 * DAILY_REVIEW_SIZE, maxLength: 3 * DAILY_REVIEW_SIZE }),
        fc.string(),
        (spec, seed) => {
          // Every theme has a Daily Review's worth of due items, so the pool always allows.
          const items = spec.map((_, i) => mk(`lex:w${i}`, { home: themes[i % 3] as string }));
          const states = Object.fromEntries(spec.map((s, i) => [`lex:w${i}`, { st: st({ b: s.b, d: `2026-11-0${s.due}` }) }]));
          for (const session of [buildDailyReview(ctxOf(items, states, { seed })), buildKeepGoing(ctxOf(items, states, { seed }), { dailyDueDrawn: 0, keepGoingRounds: 0 })]) {
            const qs = session?.questions ?? [];
            expect(qs).toHaveLength(DAILY_REVIEW_SIZE);
            expect(maxRun(qs.map((q) => q.theme))).toBeLessThanOrEqual(MAX_THEME_RUN);
            expect(maxRun(qs.map((q) => q.format))).toBeLessThanOrEqual(MAX_FORMAT_RUN);
          }
        },
      ),
      { numRuns: 150 },
    );
  });

  it('a lower-priority item moves up only to break a run; the box order holds otherwise', () => {
    const items = [...Array.from({ length: 6 }, (_, i) => mk(`lex:a${i}`, { home: 'life' })), mk('lex:b0', { home: 'rites' }), mk('lex:b1', { home: 'rites' })];
    const states = Object.fromEntries(items.map((it) => [it.id, { st: st({ b: it.home === 'life' ? 1 : 4, c: 1 }) }]));
    const qs = buildDailyReview(ctxOf(items, states)).questions;
    expect(qs.map((q) => q.theme)).toEqual(['life', 'life', 'rites', 'life', 'life', 'rites', 'life', 'life']);
  });

  it('skips the theme cap when every due item is one theme, and still keeps the format cap', () => {
    const items = Array.from({ length: 12 }, (_, i) => mk(`lex:a${i}`, { home: 'life' }));
    const states = Object.fromEntries(items.map((it) => [it.id, { st: st({ b: 1 }) }]));
    const qs = buildDailyReview(ctxOf(items, states)).questions;
    expect(qs).toHaveLength(DAILY_REVIEW_SIZE);
    expect(new Set(qs.map((q) => q.theme))).toEqual(new Set(['life']));
    expect(maxRun(qs.map((q) => q.format))).toBeLessThanOrEqual(MAX_FORMAT_RUN);
    // Boxes 1-2 may be asked at read as well as at recognize, which is what keeps the format cap.
    expect(new Set(qs.map((q) => q.rung))).toEqual(new Set(['recognize', 'read']));
  });

  it('when the pool does not allow, it still asks every item rather than leave a slot empty', () => {
    const items = Array.from({ length: 6 }, (_, i) => mk(`rea:card${i}`, { home: i < 5 ? 'life' : 'rites' }));
    const states = Object.fromEntries(items.map((it) => [it.id, { st: st({ b: 4, c: 1, s: 4 }) }]));
    const qs = buildDailyReview(ctxOf(items, states)).questions;
    expect(qs).toHaveLength(6);
    expect(new Set(qs.map((q) => q.format))).toEqual(new Set(['read-pick']));
  });
});

describe('rungs by kind and the modality ladder', () => {
  it('asks boxes 1-2 at recognize or read and box 3 and higher at the next rung c', () => {
    expect(rungToAsk({ b: 1, c: 0 })).toBe('recognize');
    expect(rungToAsk({ b: 2, c: 1 })).toBe('read');
    expect(rungToAsk({ b: 2, c: 2 })).toBe('read');
    expect(rungToAsk({ b: 3, c: 0 })).toBe('recognize');
    expect(rungToAsk({ b: 3, c: 1 })).toBe('read');
    expect(rungToAsk({ b: 4, c: 2 })).toBe('produce');
    expect(rungToAsk({ b: 7, c: 3 })).toBe('produce');
  });

  it('picks a format the kind allows at that rung (section 4.3 table)', () => {
    const kinds: ReviewItemKind[] = ['sym', 'syl', 'lex', 'pat', 'exc', 'rea'];
    const produce: Record<ReviewItemKind, ReviewFormat[]> = {
      sym: ['syllable-build', 'match-shape'],
      syl: ['syllable-build'],
      lex: ['type-see', 'dictation', 'syllable-build'],
      pat: ['cloze-pick', 'sentence-builder'],
      exc: ['sentence-builder'],
      rea: ['cloze-pick'],
    };
    for (const kind of kinds) {
      const item = mk(`${kind}:x`);
      const ask = (s: Partial<MemoryItemState>) => buildDailyReview(ctxOf([item], { [item.id]: { st: st(s) } })).questions[0] as ReviewQuestion;
      const heard = ask({ b: 3, c: 0, s: 3 });
      expect(heard.format).toBe(kind === 'rea' ? 'read-pick' : 'hear-pick');
      expect(heard.rung).toBe(kind === 'rea' ? 'read' : 'recognize');
      expect(ask({ b: 3, c: 1, s: 3 }).format).toBe('read-pick');
      const made = ask({ b: 4, c: 2, s: 4 });
      expect(made.rung).toBe('produce');
      expect(produce[kind]).toContain(made.format);
    }
  });

  it('falls back to read for an item with no produce format (a one-word reply)', () => {
    const item = mk('exc:short', { formats: ['hear-pick', 'read-pick'] });
    const q = buildDailyReview(ctxOf([item], { [item.id]: { st: st({ b: 5, c: 2, s: 5 }) } })).questions[0] as ReviewQuestion;
    expect(q).toMatchObject({ rung: 'read', format: 'read-pick' });
  });

  it('promotes through the ladder with the r/c split, and a miss at produce sets c back to read and keeps the produce bit', () => {
    const item = mk('lex:sagwa');
    let state = st({ b: 3, c: 1, r: 1, s: 3 });
    let facts: DayFacts = {};
    const askAndAnswer = (day: string, correct: boolean) => {
      const q = buildDailyReview(ctxOf([item], { [item.id]: { st: state, ...facts } }, { today: day })).questions[0] as ReviewQuestion;
      const out = applyAnswer(state, facts, { correct, rung: q.rung }, day, `${day}T09:00:00.000Z`);
      state = out.state;
      facts = out.facts;
      return q;
    };
    expect(askAndAnswer(TODAY, true).rung).toBe('read');
    expect(state).toMatchObject({ b: 4, c: 2, r: 0b011 });
    expect(askAndAnswer(state.d as string, true).rung).toBe('produce');
    expect(state).toMatchObject({ b: 5, c: 3, r: 0b111 });
    expect(askAndAnswer(state.d as string, false).rung).toBe('produce');
    expect(state).toMatchObject({ b: 4, c: 1, r: 0b111 });
    expect(askAndAnswer(state.d as string, true).rung).toBe('read');
  });

  it('with no device voice the ladder has two rungs: recognize is asked at read, with the sound notice, and nothing is heard', () => {
    const item = mk('lex:sagwa');
    const new1 = buildDailyReview(ctxOf([item], { [item.id]: { st: st({ b: 1, c: 0 }) } }, { voice: false }));
    expect(new1.questions[0]).toMatchObject({ rung: 'read', format: 'read-pick', voiceFallback: true });
    expect(new1.soundNotice).toBe(true);
    // A right answer at read passes recognize too, so the next rung is produce.
    const out = applyAnswer(st({ b: 3, c: 0, s: 3 }), {}, { correct: true, rung: 'read' }, TODAY, AT);
    expect(out.state).toMatchObject({ c: 2, r: 0b011 });
    const atProduce = buildDailyReview(ctxOf([item], { [item.id]: { st: st({ b: 4, c: 2, s: 4 }) } }, { voice: false }));
    expect(atProduce.questions[0]?.format).not.toBe('dictation');
    expect(atProduce.soundNotice).toBe(false);
    fc.assert(
      fc.property(fc.array(fc.record({ b: fc.integer({ min: 1, max: 7 }), c: fc.integer({ min: 0, max: 3 }), kind: fc.constantFrom<ReviewItemKind>('sym', 'syl', 'lex', 'pat', 'exc', 'rea') }), { maxLength: 20 }), (spec) => {
        const items = spec.map((s, i) => mk(`${s.kind}:x${i}`));
        const states = Object.fromEntries(spec.map((s, i) => [`${s.kind}:x${i}`, { st: st({ b: s.b, c: s.c, s: s.b }) }]));
        const qs = buildDailyReview(ctxOf(items, states, { voice: false })).questions;
        for (const q of qs) {
          expect(q.rung).not.toBe('recognize');
          expect(['hear-pick', 'dictation']).not.toContain(q.format);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('the stretch rung is the next rung of a held item', () => {
    const item = mk('pat:x');
    const q = buildDailyReview(ctxOf([item], { [item.id]: { st: st({ b: 4, c: 2, s: 4, d: '2026-11-20' }) } })).questions[0] as ReviewQuestion;
    expect(q).toMatchObject({ stretch: true, rung: 'produce' });
  });

  it('a stretch item that fell back to box 1-2 is asked at recognize or read, like any box 1-2 item', () => {
    const item = mk('pat:fell');
    const q = buildDailyReview(ctxOf([item], { [item.id]: { st: st({ b: 2, c: 2, s: 4, d: '2026-11-12' }) } })).questions[0] as ReviewQuestion;
    expect(q.stretch).toBe(true);
    expect(['recognize', 'read']).toContain(q.rung);
  });

  it('with no device voice, the sound notice shows only for an item that would have been heard', () => {
    // A realia item has no recognize rung, and a homophone with no picture or gloss is never heard.
    const rea = mk('rea:menu');
    const homophone = mk('lex:nat', { homophoneOf: ['lex:nat~2'] });
    for (const item of [rea, homophone]) {
      const s = buildDailyReview(ctxOf([item], { [item.id]: { st: st({ b: 1, c: 0 }) } }, { voice: false }));
      expect(s.questions[0]).toMatchObject({ rung: 'read', voiceFallback: false });
      expect(s.soundNotice).toBe(false);
    }
    const heard = mk('lex:nat', { homophoneOf: ['lex:nat~2'], en: 'day' });
    expect(buildDailyReview(ctxOf([heard], { [heard.id]: { st: st({ b: 1, c: 0 }) } }, { voice: false })).soundNotice).toBe(true);
  });
});

describe('listening never depends on telling homophones apart (dictation-unambiguous)', () => {
  it('never asks dictation of an item with a homophone or a sound change, whatever its formats say', () => {
    for (const over of [{ homophoneOf: ['lex:nat~2'] }, { soundChange: true }]) {
      const item = mk('lex:nat', { ...over, formats: ['hear-pick', 'read-pick', 'dictation'] });
      for (const seed of ['a', 'b', 'c', 'd']) {
        const q = buildDailyReview(ctxOf([item], { [item.id]: { st: st({ b: 4, c: 2, s: 4 }) } }, { seed })).questions[0] as ReviewQuestion;
        expect(q.format).not.toBe('dictation');
        expect(q.rung).toBe('read');
      }
    }
  });

  it('a heard round of an item with a homophone shows its picture or gloss; with neither it is not heard', () => {
    const withPicture = mk('lex:nat', { homophoneOf: ['lex:nat~2'], picture: 'word:sickle' });
    const withGloss = mk('lex:nat~2', { homophoneOf: ['lex:nat'], en: 'day' });
    const bare = mk('lex:nat~3', { homophoneOf: ['lex:nat'], formats: ['hear-pick', 'read-pick'] });
    const states = { 'lex:nat': { st: st({ b: 3, c: 0, s: 3 }) }, 'lex:nat~2': { st: st({ b: 3, c: 0, s: 3 }) }, 'lex:nat~3': { st: st({ b: 3, c: 0, s: 3 }) } };
    const qs = buildDailyReview(ctxOf([withPicture, withGloss, bare], states)).questions;
    const by = (id: string) => qs.find((q) => q.itemId === id) as ReviewQuestion;
    expect(by('lex:nat')).toMatchObject({ format: 'hear-pick', cue: 'picture' });
    expect(by('lex:nat~2')).toMatchObject({ format: 'hear-pick', cue: 'gloss' });
    expect(by('lex:nat~3')).toMatchObject({ format: 'read-pick', rung: 'read', voiceFallback: false });
    expect(by('lex:nat~3').cue).toBeUndefined();
  });

  it('a sound-change item keeps the heard pick (the device voice says the standard pronunciation)', () => {
    const item = mk('lex:gachi', { soundChange: true, formats: ['hear-pick', 'read-pick', 'type-see'] });
    const q = buildDailyReview(ctxOf([item], { [item.id]: { st: st({ b: 3, c: 0, s: 3 }) } })).questions[0];
    expect(q?.format).toBe('hear-pick');
  });
});

describe('typing tolerance at the produce rung', () => {
  it('compares after NFC with spaces ignored', () => {
    expect(gradeTyped('사과', '사과')).toBe('right');
    expect(gradeTyped('사과 주세요.', '사과주세요')).toBe('right');
    expect(gradeTyped('사과', '사과'.normalize('NFD'))).toBe('right');
    expect(gradeTyped('사과', ' 사 과 ')).toBe('right');
  });

  it('one jamo away is hinted: a missing 받침, a wrong vowel stroke, one letter too many', () => {
    expect(gradeTyped('책', '채')).toBe('hinted');
    expect(gradeTyped('가방', '거방')).toBe('hinted');
    expect(gradeTyped('물', '물ㄹ')).toBe('hinted');
    expect(gradeTyped('사과', '사고')).toBe('hinted');
  });

  it('two or more jamo away is a miss, and so is an empty answer', () => {
    expect(gradeTyped('책', '체')).toBe('miss');
    expect(gradeTyped('사과', '사')).toBe('miss');
    expect(gradeTyped('사과', '')).toBe('miss');
    expect(gradeTyped('사과', '   ')).toBe('miss');
    expect(gradeTyped('책이', '채기')).toBe('miss');
  });

  it('decomposes blocks into their letters, and a lone letter stands in its place', () => {
    expect(jamoOf('닭')).toEqual(['iㄷ', 'mㅏ', 'fㄺ']);
    expect(jamoOf('ㅂㅏ')).toEqual(['iㅂ', 'mㅏ']);
    expect(gradeTyped('바', 'ㅂ')).toBe('hinted');
  });

  it('a hinted answer is neither promoted nor demoted; a miss is demoted', () => {
    const hinted = typedAnswer('lex:chaek', '책', '채');
    expect(hinted).toEqual({ itemId: 'lex:chaek', rung: 'produce', correct: true, hinted: true });
    const before = st({ b: 4, c: 2, s: 4 });
    expect(applyAnswer(before, {}, hinted, TODAY, AT).state.b).toBe(4);
    const miss = typedAnswer('lex:chaek', '책', '체');
    expect(miss).toEqual({ itemId: 'lex:chaek', rung: 'produce', correct: false });
    expect(applyAnswer(before, {}, miss, TODAY, AT).state).toMatchObject({ b: 3, c: 1 });
    expect(typedAnswer('lex:chaek', '책', '책')).toEqual({ itemId: 'lex:chaek', rung: 'produce', correct: true });
  });
});

describe('credit inside sentences', () => {
  const chaek = mk('lex:chaek', { ko: '책' });
  const gabang = mk('lex:gabang', { ko: '가방' });
  const hakgyo = mk('vocab:hakgyo', { ko: '학교' });
  const bae1 = mk('lex:bae~pear', { ko: '배' });
  const bae2 = mk('vocab:bae-boat', { ko: '배' });
  const pat = mk('pat:chaegi-isseoyo', { ko: '책이 있어요.' });
  const frame = mk('pat:n-ieyo', { ko: '___이에요.' });
  const exc = mk('exc:ige-mwoyeyo', { ko: '이게 뭐예요?', reply: { ko: '가방이에요.', romanization: 'gabangieyo' } });
  const twoWords = mk('pat:hakgyo-bae', { ko: '학교에 배가 있어요.' });
  const items = [chaek, gabang, hakgyo, bae1, bae2, pat, frame, exc, twoWords];
  const dueRow = (): EngineRow => ({ st: st({ b: 2, d: TODAY, s: 2 }) });
  const states = (): Record<string, EngineRow> => ({ 'lex:chaek': dueRow(), 'lex:gabang': dueRow(), 'vocab:hakgyo': dueRow(), 'lex:bae~pear': dueRow(), 'vocab:bae-boat': dueRow() });

  it('strips only an ending that fits the word before it, so a compound is not read as a shorter word', () => {
    const mul = mk('lex:mul', { ko: '물' });
    const cha = mk('lex:cha', { ko: '차' });
    const index = ctxOf([mul, cha, chaek], {}).index;
    // 물가 (prices) is not 물 with 가, which follows a vowel; 물을 and 물로 are 물.
    expect(wordsInside(mk('pat:mulga', { ko: '물가가 비싸요.' }), index)).toEqual([]);
    expect(wordsInside(mk('pat:mureul', { ko: '물을 마셔요.' }), index)).toEqual(['lex:mul']);
    expect(wordsInside(mk('pat:mullo', { ko: '물로 씻어요.' }), index)).toEqual(['lex:mul']);
    // 차가 is 차 with 가; 차이 is not 차 with 이, which follows a final consonant.
    expect(wordsInside(mk('pat:chaga', { ko: '차가 와요.' }), index)).toEqual(['lex:cha']);
    expect(wordsInside(mk('pat:chai', { ko: '차이가 있어요.' }), index)).toEqual([]);
    // 책으로 and 책은 fit 책; 책는 and 책로 do not.
    expect(wordsInside(mk('pat:chaegeuro', { ko: '책으로 배워요. 책은 좋아요.' }), index)).toEqual(['lex:chaek']);
    expect(wordsInside(mk('pat:bad', { ko: '책는 책로' }), index)).toEqual([]);
  });

  it('finds the taught words inside a sentence, a frame and an exchange, through particles and the copula', () => {
    const index = ctxOf(items, {}).index;
    expect(wordsInside(pat, index)).toEqual(['lex:chaek']);
    expect(wordsInside(exc, index)).toEqual(['lex:gabang']);
    expect(wordsInside(frame, index)).toEqual([]);
    // 배 names two words, so the sentence credits neither.
    expect(wordsInside(twoWords, index)).toEqual(['vocab:hakgyo']);
    expect(wordsInside(chaek, index)).toEqual([]);
  });

  it('a first-try right sentence at read or produce counts as a read answer for each due word inside it', () => {
    for (const rung of ['read', 'produce'] as const) {
      const out = withSentenceCredit(ctxOf(items, states()), [{ itemId: pat.id, correct: true, rung }, { itemId: exc.id, correct: true, rung }]);
      expect(out).toEqual([
        { itemId: pat.id, correct: true, rung },
        { itemId: 'lex:chaek', correct: true, rung: 'read' },
        { itemId: exc.id, correct: true, rung },
        { itemId: 'lex:gabang', correct: true, rung: 'read' },
      ]);
    }
  });

  it('credits nothing for a miss, a hinted answer, a heard answer, a word not due, answered today, asked in the session, retired, or with the knob off', () => {
    const ctx = ctxOf(items, states());
    const none = (answers: Parameters<typeof withSentenceCredit>[1], c: EngineContext = ctx, enabled = true) => expect(withSentenceCredit(c, answers, enabled)).toEqual(answers);
    none([{ itemId: pat.id, correct: false, rung: 'read' }]);
    none([{ itemId: pat.id, correct: true, hinted: true, rung: 'produce' }]);
    none([{ itemId: pat.id, correct: true, rung: 'recognize' }]);
    none([{ itemId: pat.id, correct: true, rung: 'read' }], ctxOf(items, { ...states(), 'lex:chaek': { st: st({ b: 2, d: '2026-11-12' }) } }));
    none([{ itemId: pat.id, correct: true, rung: 'read' }], ctxOf(items, { ...states(), 'lex:chaek': { ...dueRow(), l: TODAY } }));
    none([{ itemId: pat.id, correct: true, rung: 'read' }], ctxOf(items, { 'lex:gabang': dueRow() }));
    none([
      { itemId: pat.id, correct: true, rung: 'read' },
      { itemId: 'lex:chaek', correct: false, rung: 'recognize' },
    ]);
    const retired = ctxOf(items, states());
    retired.index = { ...retired.index, retired: new Set(['lex:chaek']) };
    none([{ itemId: pat.id, correct: true, rung: 'read' }], retired);
    none([{ itemId: pat.id, correct: true, rung: 'read' }], ctx, false);
  });

  it('credits a word once a session, however many sentences hold it', () => {
    const pat2 = mk('pat:chaegi-eopseoyo', { ko: '책이 없어요.' });
    const out = withSentenceCredit(ctxOf([...items, pat2], states()), [
      { itemId: pat.id, correct: true, rung: 'read' },
      { itemId: pat2.id, correct: true, rung: 'read' },
    ]);
    expect(out.filter((a) => a.itemId === 'lex:chaek')).toHaveLength(1);
  });

  it('under the spacing rule a word rises at most once a day, through any mix of credits and answers (S-d)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 7 }),
        fc.boolean(),
        fc.array(fc.record({ sentence: fc.boolean(), correct: fc.boolean(), hinted: fc.boolean(), rung: fc.constantFrom('recognize', 'read', 'produce' as const) }), { minLength: 1, maxLength: 12 }),
        (box, due, steps) => {
          let row: { st: MemoryItemState } & DayFacts = { st: st({ b: box, s: box, d: due ? TODAY : '2026-11-30', c: 1 }) };
          const before = row.st.b;
          for (const step of steps) {
            const answer = { itemId: step.sentence ? pat.id : 'lex:chaek', correct: step.correct, hinted: step.hinted && step.correct, rung: step.rung };
            for (const a of withSentenceCredit(ctxOf(items, { 'lex:chaek': row }), [answer])) {
              if (a.itemId !== 'lex:chaek') continue;
              const out = applyAnswer(row.st, row, a, TODAY, AT);
              row = { st: out.state, ...out.facts };
            }
          }
          expect(row.st.b - before).toBeLessThanOrEqual(1);
          expect(before - row.st.b).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('the sessions', () => {
  const pool = (n: number, over: Partial<MemoryItemState> = {}, theme = (i: number) => ['life', 'rites', 'nature'][i % 3] as string) => {
    const items = Array.from({ length: n }, (_, i) => mk(`lex:w${i}`, { home: theme(i) }));
    return { items, states: Object.fromEntries(items.map((it) => [it.id, { st: st(over) }])) as Record<string, EngineRow> };
  };

  it('Daily Review asks 10 due items in selection order', () => {
    const { items, states } = pool(25);
    const s = buildDailyReview(ctxOf(items, states));
    expect(s.kind).toBe('daily');
    expect(s.questions).toHaveLength(DAILY_REVIEW_SIZE);
    expect(s.endsEarly).toBe(false);
    expect(s.questions.every((q) => !q.stretch)).toBe(true);
  });

  it('ends early when there is nothing to ask ("All refreshed today")', () => {
    const empty = buildDailyReview(ctxOf([], {}));
    expect(empty).toMatchObject({ questions: [], endsEarly: true, soundNotice: false });
    const { items, states } = pool(4);
    const short = buildDailyReview(ctxOf(items, states));
    expect(short.questions).toHaveLength(4);
    expect(short.endsEarly).toBe(true);
  });

  it('stretch items only fill the slots the pool cannot, after every due item', () => {
    const { items, states } = pool(4);
    const held = Array.from({ length: 10 }, (_, i) => mk(`pat:h${i}`, { home: ['crafts', 'letters'][i % 2] as string }));
    for (const h of held) states[h.id] = { st: st({ b: 4, s: 4, c: 2, d: '2026-11-20' }) };
    states['pat:done'] = { st: st({ b: 5, s: 5, c: 3, d: '2026-11-20' }) };
    states['pat:low'] = { st: st({ b: 2, s: 2, c: 1, d: '2026-11-20' }) };
    states['pat:today'] = { st: st({ b: 4, s: 4, c: 2, d: '2026-11-20' }), l: TODAY };
    const all = [...items, ...held, mk('pat:done'), mk('pat:low'), mk('pat:today')];
    const s = buildDailyReview(ctxOf(all, states));
    expect(s.questions).toHaveLength(DAILY_REVIEW_SIZE);
    expect(s.endsEarly).toBe(false);
    expect(s.questions.slice(0, 4).every((q) => !q.stretch)).toBe(true);
    expect(s.questions.slice(4).every((q) => q.stretch && q.itemId.startsWith('pat:h'))).toBe(true);
    const full = pool(30);
    for (const h of held) full.states[h.id] = { st: st({ b: 4, s: 4, c: 2, d: '2026-11-20' }) };
    expect(buildDailyReview(ctxOf([...full.items, ...held], full.states)).questions.some((q) => q.stretch)).toBe(false);
  });

  it('draws at most 20 due items a day before Keep going, seeded items included, and fills no stretch while the cap holds the pool back', () => {
    const { items, states } = pool(40, { n: 0 });
    const held = mk('pat:held', { home: 'crafts' });
    states[held.id] = { st: st({ b: 4, s: 4, c: 2, d: '2026-11-20' }) };
    const ctx = ctxOf([...items, held], states);
    const second = buildDailyReview(ctx, { dailyDueDrawn: DAILY_REVIEW_DUE_CAP - 4, keepGoingRounds: 0 });
    expect(second.questions).toHaveLength(4);
    expect(second.endsEarly).toBe(false);
    expect(second.capped).toBe(true);
    const third = buildDailyReview(ctx, { dailyDueDrawn: DAILY_REVIEW_DUE_CAP, keepGoingRounds: 0 });
    expect(third.questions).toHaveLength(0);
    expect(third.endsEarly).toBe(false);
    // Not an empty session to play and not "All refreshed today": the surface offers Keep going.
    expect(third.capped).toBe(true);
    expect(canKeepGoing(ctx, { dailyDueDrawn: DAILY_REVIEW_DUE_CAP, keepGoingRounds: 0 })).toBe(true);
    // The session size, not the cap, stops a first Daily Review of a large pool; one that runs out ends early.
    expect(buildDailyReview(ctx).capped).toBe(false);
    const few = pool(3);
    expect(buildDailyReview(ctxOf(few.items, few.states), { dailyDueDrawn: 15, keepGoingRounds: 0 })).toMatchObject({ capped: false, endsEarly: true });
  });

  it('Keep going asks 10 more due items, up to 3 rounds a day, and is not offered when nothing is due', () => {
    const { items, states } = pool(50);
    const ctx = ctxOf(items, states);
    const first = buildDailyReview(ctx).questions;
    const kg = buildKeepGoing(ctx, { dailyDueDrawn: 10, keepGoingRounds: 0 }, new Set(ids(first)));
    expect(kg?.kind).toBe('keep-going');
    expect(kg?.questions).toHaveLength(10);
    expect(ids(kg?.questions ?? []).some((id) => ids(first).includes(id))).toBe(false);
    expect(kg?.questions.every((q) => !q.stretch)).toBe(true);
    expect(buildKeepGoing(ctx, { dailyDueDrawn: 10, keepGoingRounds: KEEP_GOING_ROUNDS_PER_DAY })).toBeNull();
    expect(canKeepGoing(ctx, { dailyDueDrawn: 10, keepGoingRounds: KEEP_GOING_ROUNDS_PER_DAY })).toBe(false);
    expect(buildKeepGoing(ctxOf([], {}), { dailyDueDrawn: 0, keepGoingRounds: 0 })).toBeNull();
    expect(canKeepGoing(ctxOf([], {}), { dailyDueDrawn: 0, keepGoingRounds: 0 })).toBe(false);
    const few = pool(3);
    expect(buildKeepGoing(ctxOf(few.items, few.states), { dailyDueDrawn: 0, keepGoingRounds: 0 })?.endsEarly).toBe(true);
  });

  it('the warm-up asks up to 3 due items from earlier cells before a Stage 2+ quest, and nothing before Stage 1 or when none are due', () => {
    const own = mk('lex:own', { cells: ['episode:stage3-life'] });
    const recycled = mk('lex:recycled', { cells: ['episode:stage2-life'], asked: ['episode:stage3-life'] });
    const earlier = Array.from({ length: 5 }, (_, i) => mk(`lex:e${i}`, { cells: ['episode:stage2-rites'], home: 'rites' }));
    const states = Object.fromEntries([own, recycled, ...earlier].map((i) => [i.id, { st: st() }]));
    const ctx = ctxOf([own, recycled, ...earlier], states);
    const w = buildWarmup(ctx, { cell: 'episode:stage3-life', stage: 3 });
    expect(w.kind).toBe('warmup');
    expect(w.questions).toHaveLength(WARMUP_SIZE);
    expect(ids(w.questions).every((id) => id.startsWith('lex:e'))).toBe(true);
    expect(buildWarmup(ctx, { cell: 'episode:stage1-life', stage: 1 }).questions).toEqual([]);
    expect(buildWarmup(ctxOf([own], { [own.id]: { st: st() } }), { cell: 'episode:stage3-life', stage: 3 }).questions).toEqual([]);
  });

  it('the warm-up never asks a later cell’s items: a replay of an early quest asks only what came before it', () => {
    const early = mk('lex:early', { cells: ['episode:stage2-letters'], stage: 2, home: 'letters' });
    const sameStageLater = mk('lex:later', { cells: ['episode:stage2-crafts'], stage: 2, home: 'crafts' });
    const laterStage = Array.from({ length: 3 }, (_, i) => mk(`lex:s6-${i}`, { cells: ['episode:stage6-life'], stage: 6 }));
    const items = [early, sameStageLater, ...laterStage];
    const ctx = ctxOf(items, Object.fromEntries(items.map((i) => [i.id, { st: st() }])));
    // By stage when the route order is not given.
    expect(ids(buildWarmup(ctx, { cell: 'episode:stage2-life', stage: 2 }).questions).sort()).toEqual(['lex:early', 'lex:later']);
    // By route order when the quest player gives it.
    const route = ['episode:stage2-letters', 'episode:stage2-life', 'episode:stage2-crafts', 'episode:stage6-life'];
    const earlier = (cell: string) => route.indexOf(cell) >= 0 && route.indexOf(cell) < route.indexOf('episode:stage2-life');
    expect(ids(buildWarmup(ctx, { cell: 'episode:stage2-life', stage: 2, earlier }).questions)).toEqual(['lex:early']);
  });

  it('Try these again asks the misses of the session, each once, at most 8, and skips unknown and unmet items', () => {
    const items = Array.from({ length: 12 }, (_, i) => mk(`lex:m${i}`, { home: ['life', 'rites'][i % 2] as string }));
    const states: Record<string, EngineRow> = Object.fromEntries(items.map((it) => [it.id, { st: st({ d: '2026-11-11' }), l: TODAY }]));
    states['lex:m1'] = { st: st({ b: 0, d: null, s: 0 }) };
    const missed = ['lex:m0', 'lex:m0', 'lex:m1', 'lex:zz', ...items.slice(2).map((i) => i.id)];
    const s = buildTryAgain(ctxOf(items, states), missed);
    expect(s.kind).toBe('again');
    expect(s.questions).toHaveLength(TRY_AGAIN_MAX);
    expect(new Set(ids(s.questions)).size).toBe(TRY_AGAIN_MAX);
    expect(ids(s.questions)).not.toContain('lex:m1');
    expect(ids(s.questions)[0]).toBe('lex:m0');
    expect(buildTryAgain(ctxOf(items, states), []).questions).toEqual([]);
  });

  it('the Check selector asks met and unmet items of the request, at least 30% at produce, interleaved', () => {
    const items = Array.from({ length: 14 }, (_, i) => mk(`${['lex', 'pat', 'sym'][i % 3]}:c${i}`, { home: ['life', 'rites'][i % 2] as string }));
    const states: Record<string, EngineRow> = {};
    items.slice(0, 6).forEach((it, i) => (states[it.id] = { st: st({ b: 1 + i, s: 1 + i, c: i % 3, d: '2026-11-30' }) }));
    const s = buildCheck(ctxOf(items, states), { itemIds: items.map((i) => i.id), size: 10 });
    expect(s.kind).toBe('check');
    expect(s.questions).toHaveLength(10);
    expect(s.questions.filter((q) => q.rung === 'produce').length).toBeGreaterThanOrEqual(Math.ceil(10 * CHECK_PRODUCE_SHARE));
    expect(ids(s.questions).filter((id) => states[id] === undefined).length).toBeGreaterThan(0);
    expect(maxRun(s.questions.map((q) => q.theme))).toBeLessThanOrEqual(MAX_THEME_RUN);
    const stage = buildCheck(ctxOf(items, states), { itemIds: items.map((i) => i.id), size: 20, produceShare: 0.5 });
    expect(stage.questions).toHaveLength(14);
    expect(stage.questions.filter((q) => q.rung === 'produce').length).toBeGreaterThanOrEqual(7);
    // Only items that allow production can be asked there: a realia card has its cloze, an exchange of one word none.
    const fewProduce = [mk('exc:a', { formats: ['hear-pick', 'read-pick'] }), mk('exc:b', { formats: ['hear-pick', 'read-pick'] }), mk('rea:c')];
    const small = buildCheck(ctxOf(fewProduce, {}), { itemIds: fewProduce.map((i) => i.id), size: 10 });
    expect(small.questions.filter((q) => q.rung === 'produce').map((q) => q.itemId)).toEqual(['rea:c']);
  });

  it('row CM-21: when the first items cannot hold the produce share, items of the request that allow it take the places of the last ones that do not', () => {
    // Twelve symbols with no produce round sort first (box 1), four words that allow typing come after (box 3).
    const syms = Array.from({ length: 12 }, (_, i) => mk(`sym:s${i}`, { formats: ['read-pick'] }));
    const words = Array.from({ length: 4 }, (_, i) => mk(`lex:t${i}`));
    const states: Record<string, EngineRow> = {};
    syms.forEach((it) => (states[it.id] = { st: st({ b: 1, s: 1, d: '2026-11-30' }) }));
    words.forEach((it) => (states[it.id] = { st: st({ b: 3, s: 3, d: '2026-11-30' }) }));
    const all = [...syms, ...words];
    const s = buildCheck(ctxOf(all, states), { itemIds: all.map((i) => i.id), size: 10 });
    expect(s.questions).toHaveLength(10);
    expect(s.questions.filter((q) => q.rung === 'produce').length).toBeGreaterThanOrEqual(3);
    expect(ids(s.questions).filter((id) => id.startsWith('lex:')).length).toBe(3);
    // The swap only replaces items that cannot produce, and never adds more than the share needs.
    const enough = buildCheck(ctxOf(words, states), { itemIds: words.map((i) => i.id), size: 10 });
    expect(enough.questions).toHaveLength(4);
  });
});

describe('what the engine never selects', () => {
  it('a retired item, in any session', () => {
    const items = [mk('lex:keep'), mk('lex:gone'), mk('pat:gone-too')];
    const states = Object.fromEntries(items.map((i) => [i.id, { st: st({ b: 4, s: 4, c: 2 }) }]));
    const ctx = ctxOf(items, states);
    ctx.index = { ...ctx.index, retired: new Set(['lex:gone', 'pat:gone-too']) };
    for (const s of [buildDailyReview(ctx), buildKeepGoing(ctx, { dailyDueDrawn: 0, keepGoingRounds: 0 }), buildWarmup(ctx, { cell: 'episode:stage3-life', stage: 3 }), buildTryAgain(ctx, ['lex:gone']), buildCheck(ctx, { itemIds: ['lex:gone', 'lex:keep'], size: 10 })]) {
      expect(ids(s?.questions ?? []).filter((id) => id !== 'lex:keep')).toEqual([]);
    }
  });

  it('an item whose only source is hidden: Volume 2 with volumes off, a pack with topicPacks or pack.<key> off', () => {
    const v1 = mk('lex:v1', { cells: ['episode:stage2-life'] });
    const v2only = mk('lex:v2', { cells: ['episode:stage2-life-v2'], volume: 2 });
    const both = mk('lex:both', { cells: ['episode:stage2-life'], asked: ['episode:stage2-life-v2'] });
    const pack = mk('lex:pk', { cells: ['episode:pack-numbers-time-s3'], home: 'pack:numbers-time' });
    const other = mk('lex:pk2', { cells: ['episode:pack-family-s2'], home: 'pack:family' });
    const story = mk('lex:story', { cells: ['episode:pack-family-s2', 'story:sun-and-moon'], home: 'pack:family' });
    const items = [v1, v2only, both, pack, other, story];
    const states = Object.fromEntries(items.map((i) => [i.id, { st: st() }]));
    const pooled = (visibility: EngineContext['visibility']) => duePool(ctxOf(items, states, { visibility })).map((i) => i.id).sort();
    expect(pooled(undefined)).toEqual(items.map((i) => i.id).sort());
    expect(pooled({ volumes: false, topicPacks: true })).toEqual(['lex:both', 'lex:pk', 'lex:pk2', 'lex:story', 'lex:v1']);
    expect(pooled({ volumes: true, topicPacks: false })).toEqual(['lex:both', 'lex:story', 'lex:v1', 'lex:v2']);
    expect(pooled({ volumes: true, topicPacks: true, pack: (key) => key !== 'numbers-time' })).toEqual(['lex:both', 'lex:pk2', 'lex:story', 'lex:v1', 'lex:v2']);
    const hidden = ctxOf(items, states, { visibility: { volumes: false, topicPacks: false } });
    expect(ids(buildCheck(hidden, { itemIds: items.map((i) => i.id), size: 10 }).questions).sort()).toEqual(['lex:both', 'lex:story', 'lex:v1']);
    expect(ids(buildTryAgain(hidden, ['lex:v2', 'lex:pk', 'lex:v1']).questions)).toEqual(['lex:v1']);
    expect(cellVisible('episode:pack-numbers-time-s3-v2', { volumes: false, topicPacks: true })).toBe(false);
    expect(cellVisible('story:sun-and-moon', { volumes: false, topicPacks: false })).toBe(true);
  });

  it('a Stage 5 book 2 story is Volume 2: its only-taught items hide with volumes off, once the shelf names its volume', () => {
    const book2 = mk('lex:eongan', { cells: ['story:eongan-letters'], stage: 5, volume: 2 });
    const book1 = mk('lex:sun', { cells: ['story:sun-and-moon'], stage: 5 });
    const cellVolume = (cell: string) => (cell === 'story:eongan-letters' ? 2 : undefined);
    const states = { [book2.id]: { st: st() }, [book1.id]: { st: st() } };
    const pooled = (visibility: EngineContext['visibility']) => duePool(ctxOf([book2, book1], states, { visibility })).map((i) => i.id).sort();
    expect(pooled({ volumes: false, topicPacks: true, cellVolume })).toEqual(['lex:sun']);
    expect(pooled({ volumes: true, topicPacks: true, cellVolume })).toEqual(['lex:eongan', 'lex:sun']);
    expect(cellVisible('episode:stage2-life-v2', { volumes: false, topicPacks: true, cellVolume })).toBe(false);
  });

  it('row CM-48: with weeklyDrop off an item whose only source is a week drop is skipped; one the route teaches too stays', () => {
    const weekOnly = mk('lex:ipdong', { cells: ['week:2026-11-02'], stage: 2 });
    const shared = mk('lex:mu', { cells: ['episode:stage2-life', 'week:2026-11-02'], stage: 2 });
    const states = { [weekOnly.id]: { st: st() }, [shared.id]: { st: st() } };
    const pooled = (visibility: EngineContext['visibility']) => duePool(ctxOf([weekOnly, shared], states, { visibility })).map((i) => i.id).sort();
    expect(pooled({ volumes: true, topicPacks: true, weeklyDrop: false })).toEqual(['lex:mu']);
    expect(pooled({ volumes: true, topicPacks: true, weeklyDrop: true })).toEqual(['lex:ipdong', 'lex:mu']);
    // Absent, the drops show (the surfaces that never ask a week item leave it out).
    expect(pooled({ volumes: true, topicPacks: true })).toEqual(['lex:ipdong', 'lex:mu']);
    expect(cellVisible('week:2026-11-02', { volumes: false, topicPacks: false })).toBe(true);
    expect(cellVisible('week:2026-11-02', { volumes: true, topicPacks: true, weeklyDrop: false })).toBe(false);
  });
});

describe('topic words, read where they are (section 4.8 step 4)', () => {
  it('reads the vocab slice beside the memory rows, at the read rung', () => {
    const rows = { 'lex:a': { st: st() } };
    const vocab = {
      items: [
        { id: 'vocab:namu', first: '2026-11-01', seen: 3, right: 2, bestBox: 3, last: '2026-11-07', box: 3, due: TODAY, at: '2026-11-07T09:00:00.000Z' },
        { id: 'vocab:new', first: TODAY, seen: 0, right: 0, bestBox: 0, last: TODAY, box: 0, due: null, at: '2026-11-10T09:00:00.000Z' },
      ],
    };
    const states = engineStates(rows, vocab);
    expect(states['vocab:namu']).toEqual({ st: { b: 3, d: TODAY, c: 1, r: 0, n: 3, f: '2026-11-01', s: 3, at: '2026-11-07T09:00:00.000Z' }, l: '2026-11-07' });
    const items = [mk('lex:a'), mk('vocab:namu'), mk('vocab:new')];
    const qs = buildDailyReview(ctxOf(items, states)).questions;
    expect(ids(qs).sort()).toEqual(['lex:a', 'vocab:namu']);
    expect(qs.find((q) => q.itemId === 'vocab:namu')?.rung).toBe('read');
    expect(engineStates({ 'vocab:namu': { st: st({ b: 5 }) } }, vocab)['vocab:namu']?.st.b).toBe(5);
    expect(Object.keys(engineStates({ 'lex:x': undefined }))).toEqual([]);
  });
});

describe('a session that asks no higher than a rung (row CM-15: the quick warm-up and Try these again)', () => {
  it('asks an item the ladder would ask at produce at read instead, keeps recognize and read as they are, and the voice rule still holds', () => {
    const held = mk('lex:held', { home: 'rites', cells: ['episode:stage2-rites'] });
    const fresh = mk('lex:fresh', { home: 'nature', cells: ['episode:stage2-nature'] });
    const states = { 'lex:held': { st: st({ b: 4, s: 4, c: 2, r: 3 }) }, 'lex:fresh': { st: st({ b: 1, c: 0 }) } };
    const quest = { cell: 'episode:stage3-life', stage: 3 };
    expect(buildWarmup(ctxOf([held, fresh], states), quest).questions.find((q) => q.itemId === 'lex:held')?.rung).toBe('produce');
    const capped = buildWarmup(ctxOf([held, fresh], states, { maxRung: 'read' }), quest).questions;
    expect(capped.map((q) => [q.itemId, q.rung, q.format])).toEqual(
      expect.arrayContaining([
        ['lex:held', 'read', 'read-pick'],
        ['lex:fresh', expect.stringMatching(/^(recognize|read)$/), expect.stringMatching(/^(hear-pick|read-pick)$/)],
      ]),
    );
    const quiet = buildTryAgain(ctxOf([held, fresh], states, { maxRung: 'read', voice: false }), ['lex:held', 'lex:fresh']).questions;
    expect(quiet.every((q) => q.rung === 'read' && q.format === 'read-pick')).toBe(true);
  });
});
