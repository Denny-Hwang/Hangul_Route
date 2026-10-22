import { MemorySummarySchema, type MemoryItemState, type ProgressSnapshot, type VocabItemState } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import type { MemoryRow } from '../memory-file';
import { MEMORY_SUMMARY_COUNT_MAX, WORDS_KNOWN_BOX, memorySummaryOf, weekStartOf } from '../summary';

/**
 * F-CURR-002 sections 4.4 and 4.8, row CM-16: the `memory` block of the progress summary, computed on the device.
 * Words known reads only monotonic fields (best box `s`, reps `n`, the word slice's `bestBox` and `seen`) and never
 * counts a seeded box alone; Ready to refresh is the due pool; mastery counts come from `cellBest`; week points from
 * `dayLog` (0 without it); `topDue` the 8 due items in selection order.
 */

const TODAY = '2026-10-22'; // a Thursday
const state = (over: Partial<MemoryItemState> = {}): MemoryItemState => ({ b: 2, d: '2026-10-25', c: 1, r: 3, n: 2, f: '2026-10-01', s: 2, at: '2026-10-20T10:00:00.000Z', ...over });
const row = (over: Partial<MemoryItemState> = {}, sh = 'stage2'): MemoryRow => ({ sh, st: state(over) });
const word = (id: string, over: Partial<VocabItemState> = {}): VocabItemState => ({ id, first: '2026-10-01', seen: 2, right: 2, bestBox: 2, last: '2026-10-20', box: 2, due: '2026-10-25', at: '2026-10-20T10:00:00.000Z', ...over }) as VocabItemState;
type Snap = Pick<ProgressSnapshot, 'cellBest' | 'stageCheckAt' | 'dayLog' | 'vocab'>;
const snap = (over: Partial<Snap> = {}): Snap => ({ ...over });
const vocab = (items: VocabItemState[]): Snap['vocab'] => ({ v: 1, items: [...items].sort((a, b) => (a.id < b.id ? -1 : 1)), topics: [] }) as Snap['vocab'];

const of = (rows: Record<string, MemoryRow>, s: Snap = snap(), retired: ReadonlySet<string> = new Set()) => memorySummaryOf({ rows, retired, snapshot: s, today: TODAY });

describe('memorySummaryOf: words known (section 4.4)', () => {
  it('counts lex items at best box 2 or higher with at least one real answer, and topic words the same way', () => {
    const m = of(
      {
        'lex:sagwa': row({ s: 2, n: 1 }),
        'lex:bae~pear': row({ s: 5, b: 1, n: 7 }),
        'lex:mul': row({ s: 1, n: 3 }),
        'pat:n-juseyo': row({ s: 4, n: 2 }),
        'sym:bieup': row({ s: 3, n: 2 }, 'stage1'),
      },
      snap({ vocab: vocab([word('vocab:bap'), word('vocab:sagwa', { bestBox: 1, box: 1 }), word('vocab:uyu', { seen: 0, right: 0, bestBox: 2 })]) }),
    );
    // sagwa and bae (lessons), bap (a topic word); a box that fell (bae, now b 1) still counts on its best box.
    expect(m.wordsKnown).toBe(3);
    expect(WORDS_KNOWN_BOX).toBe(2);
  });

  it('never counts a seeded box alone (n 0), nor a topic word nobody answered', () => {
    const m = of({ 'lex:sagwa': row({ s: 2, b: 2, n: 0 }) }, snap({ vocab: vocab([word('vocab:bap', { seen: 0, right: 0 })]) }));
    expect(m.wordsKnown).toBe(0);
  });

  it('never counts a seeded box followed only by wrong answers: box 2 came from seeding, not from an answer', () => {
    // Seeded at box 2 (a 3-star quest), then one wrong answer: n 1, r 0, s still 2.
    expect(of({ 'lex:sagwa': row({ s: 2, b: 1, n: 1, r: 0, c: 0 }) }).wordsKnown).toBe(0);
    // The first right answer after it counts.
    expect(of({ 'lex:sagwa': row({ s: 2, b: 2, n: 2, r: 1 }) }).wordsKnown).toBe(1);
  });

  it('keeps a retired word it knew: the counter only grows', () => {
    expect(of({ 'lex:old': row({ s: 3, n: 2 }) }, snap(), new Set(['lex:old'])).wordsKnown).toBe(1);
  });
});

describe('memorySummaryOf: ready to refresh and the items due first', () => {
  it('counts every due item (seeded ones too) and due topic words, never a retired item or one not due', () => {
    const m = of(
      {
        'lex:a': row({ d: '2026-10-22' }),
        'lex:b': row({ d: '2026-10-10', b: 1, n: 0 }),
        'lex:c': row({ d: '2026-10-23' }),
        'lex:gone': row({ d: '2026-10-01' }),
        'sym:x': row({ b: 0, d: null }),
      },
      snap({ vocab: vocab([word('vocab:bap', { due: '2026-10-21', box: 1 }), word('vocab:mul', { due: null })]) }),
      new Set(['lex:gone']),
    );
    expect(m.readyToRefresh).toBe(3);
    expect(new Set(m.topDue)).toEqual(new Set(['lex:a', 'lex:b', 'vocab:bap']));
  });

  it('orders the due items the lowest box first, then the oldest due day, then a jitter seeded by the id, and keeps 8', () => {
    const rows: Record<string, MemoryRow> = {
      'lex:box3': row({ b: 3, d: '2026-10-01' }),
      'lex:box1-late': row({ b: 1, d: '2026-10-20' }),
      'lex:box1-early': row({ b: 1, d: '2026-10-02' }),
      'lex:box2': row({ b: 2, d: '2026-10-21' }),
    };
    for (let i = 0; i < 10; i += 1) rows[`lex:w${i}`] = row({ b: 4, d: '2026-10-22' });
    const m = of(rows);
    expect(m.readyToRefresh).toBe(14);
    expect(m.topDue).toHaveLength(8);
    expect(m.topDue.slice(0, 4)).toEqual(['lex:box1-early', 'lex:box1-late', 'lex:box2', 'lex:box3']);
    // The jitter is a function of the id alone: the same order whatever order the rows were stored in.
    const reversed = Object.fromEntries(Object.entries(rows).reverse());
    expect(of(reversed).topDue).toEqual(m.topDue);
  });
});

describe('memorySummaryOf: mastery counts, Stage Checks and week points', () => {
  it('counts episodes per cellBest level (levels 2 and 3 appear once row CM-20 derives them)', () => {
    const m = of({}, snap({ cellBest: { 'letters-s1': 1, 'life-s1': 1, 'letters-s2': 2, 'nature-s2': 3, 'rites-s1': 0 } as Snap['cellBest'] }));
    expect(m.cellBestCounts).toEqual([2, 1, 1]);
  });

  it('counts the Stage Checks passed', () => {
    expect(of({}, snap({ stageCheckAt: { stage1: '2026-10-01T00:00:00.000Z', stage2: '2026-10-10T00:00:00.000Z' } })).stageChecks).toBe(2);
  });

  it('sums the dayLog points of this ISO week, Monday to today, over every install key; 0 without a dayLog', () => {
    const dayLog = {
      '2026-10-18': { a: 50 }, // Sunday: last week
      '2026-10-19': { a: 4, b: 2 }, // Monday
      '2026-10-22': { a: 3 },
      '2026-10-23': { a: 9 }, // tomorrow: not yet
    };
    expect(of({}, snap({ dayLog })).weekPoints).toBe(9);
    expect(of({}).weekPoints).toBe(0);
    expect(weekStartOf('2026-10-22')).toBe('2026-10-19');
    expect(weekStartOf('2026-10-19')).toBe('2026-10-19');
    expect(weekStartOf('2026-10-25')).toBe('2026-10-19');
  });

  it('an empty store reads zeros everywhere and parses', () => {
    const m = of({});
    expect(m).toEqual({ wordsKnown: 0, readyToRefresh: 0, cellBestCounts: [0, 0, 0], stageChecks: 0, weekPoints: 0, topDue: [] });
    expect(MemorySummarySchema.parse(m)).toEqual(m);
  });

  it('says the review surface is on only when it is (reports show the items ready to refresh only then)', () => {
    expect(of({})).not.toHaveProperty('reviewOn');
    const on = memorySummaryOf({ rows: {}, retired: new Set(), snapshot: snap(), today: TODAY, reviewOn: true });
    expect(on.reviewOn).toBe(true);
    expect(MemorySummarySchema.parse(on)).toEqual(on);
  });

  it('caps every count at the schema bound, so a block always parses', () => {
    const dayLog = { '2026-10-22': { a: MEMORY_SUMMARY_COUNT_MAX * 2 } };
    const m = of({}, snap({ dayLog }));
    expect(m.weekPoints).toBe(MEMORY_SUMMARY_COUNT_MAX);
    expect(MemorySummarySchema.safeParse(m).success).toBe(true);
  });
});
