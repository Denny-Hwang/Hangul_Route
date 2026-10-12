import { VocabProgressSchema, type VocabItemState, type VocabProgress } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../listen-pick';
import { applyVocabEvents, emptyVocab, type VocabEvent } from '../progress';
import { recordReviewAnswer, vocabPools } from '../review-pools';
import { addDays, isDue } from '../srs';

const TODAY = '2026-10-20';

function st(slug: string, over: Partial<VocabItemState> = {}): VocabItemState {
  return {
    id: `vocab:${slug}`,
    first: '2026-09-01',
    seen: 3,
    right: 2,
    bestBox: 3,
    last: '2026-10-01',
    box: 1,
    due: TODAY,
    at: '2026-10-01T10:00:00.000Z',
    ...over,
  };
}
const slice = (items: VocabItemState[]): VocabProgress => ({ v: 1, items, topics: [] });

describe('vocabPools (F-VOC-005 section 3.6)', () => {
  it('puts due words in Pool A (box 1), B (box 2) and D (box 3 and up)', () => {
    const v = slice([
      st('a1', { box: 1 }),
      st('b1', { box: 2 }),
      st('d3', { box: 3 }),
      st('d4', { box: 4, bestBox: 4 }),
      st('d5', { box: 5, bestBox: 5 }),
    ]);
    expect(vocabPools(v, TODAY)).toEqual({
      a: ['vocab:a1'],
      b: ['vocab:b1'],
      d: ['vocab:d3', 'vocab:d4', 'vocab:d5'],
    });
  });

  it('leaves out words not yet due and words with no schedule', () => {
    const v = slice([
      st('later', { due: '2026-10-21' }),
      st('unscheduled', { due: null }),
      st('today', { due: TODAY }),
      st('past', { due: '2026-09-01' }),
      st('unmet', { box: 0, bestBox: 0, due: TODAY }),
    ]);
    expect(vocabPools(v, TODAY)).toEqual({ a: ['vocab:past', 'vocab:today'], b: [], d: [] });
  });

  it('orders each pool oldest due first, then by id', () => {
    const v = slice([
      st('zeta', { box: 2, due: '2026-10-10' }),
      st('alpha', { box: 2, due: '2026-10-15' }),
      st('beta', { box: 2, due: '2026-10-10' }),
    ]);
    expect(vocabPools(v, TODAY).b).toEqual(['vocab:beta', 'vocab:zeta', 'vocab:alpha']);
  });

  it('returns empty pools for an empty slice', () => {
    expect(vocabPools(emptyVocab(), TODAY)).toEqual({ a: [], b: [], d: [] });
  });

  it('never derives Pool C (the last test misses belong to the review engine)', () => {
    expect(Object.keys(vocabPools(emptyVocab(), TODAY)).sort()).toEqual(['a', 'b', 'd']);
  });
});

describe('recordReviewAnswer (P7: one scheduler)', () => {
  it('builds an answer event with source review', () => {
    expect(recordReviewAnswer('vocab:sagwa-apple', true)).toEqual({
      type: 'answer',
      id: 'vocab:sagwa-apple',
      correct: true,
      source: 'review',
    });
    expect(recordReviewAnswer('vocab:nun-eye', false)).toEqual({
      type: 'answer',
      id: 'vocab:nun-eye',
      correct: false,
      source: 'review',
    });
  });

  it('moves the same box as any other answer through applyVocabEvents', () => {
    const now = new Date(2026, 9, 20, 12);
    const v = applyVocabEvents(emptyVocab(), [{ type: 'introduced', id: 'vocab:sagwa-apple' }], now);
    const after = applyVocabEvents(v, [recordReviewAnswer('vocab:sagwa-apple', true)], now);
    expect(after.items[0]).toMatchObject({ box: 2, bestBox: 2, seen: 1, right: 1 });
  });
});

describe('14-day simulation (F-VOC-005 section 3.6)', () => {
  const DAY0 = '2026-10-01';
  const ids = Array.from({ length: 12 }, (_, i) => `vocab:word-${String.fromCharCode(97 + i)}`);
  /** Word a is scripted: wrong on day 1, right on day 2 (box 2, due day 5), wrong on day 5. */
  const SCRIPT: Record<string, Record<number, boolean>> = { 'vocab:word-a': { 1: false, 2: true, 5: false } };
  const noonOf = (day: string): Date => {
    const [y, m, d] = day.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, d, 12);
  };

  type DayLog = { day: number; pools: ReturnType<typeof vocabPools>; answers: Record<string, boolean>; after: VocabProgress; before: VocabProgress };

  function simulate(seed: number): DayLog[] {
    const rand = seededRandom(seed);
    let v = applyVocabEvents(emptyVocab(), ids.map((id): VocabEvent => ({ type: 'introduced', id })), noonOf(DAY0));
    const log: DayLog[] = [];
    for (let day = 1; day <= 14; day++) {
      const today = addDays(DAY0, day);
      const pools = vocabPools(v, today);
      const answers: Record<string, boolean> = {};
      for (const id of [...pools.a, ...pools.b, ...pools.d]) {
        answers[id] = SCRIPT[id]?.[day] ?? rand() < 0.8;
      }
      const before = v;
      v = applyVocabEvents(
        v,
        Object.entries(answers).map(([id, correct]) => recordReviewAnswer(id, correct)),
        noonOf(today),
      );
      log.push({ day, pools, answers, before, after: v });
    }
    return log;
  }

  const log = simulate(2026);
  const stateOn = (entry: DayLog, id: string, which: 'before' | 'after' = 'after') =>
    entry[which].items.find((s) => s.id === id)!;
  const inPools = (entry: DayLog, id: string): boolean =>
    entry.pools.a.includes(id) || entry.pools.b.includes(id) || entry.pools.d.includes(id);

  it('brings a word answered right on day 1 back on day 4, and not on days 2 or 3', () => {
    const rightDay1 = Object.entries(log[0]!.answers).filter(([, ok]) => ok).map(([id]) => id);
    expect(rightDay1.length).toBeGreaterThan(0);
    for (const id of rightDay1) {
      expect(stateOn(log[0]!, id)).toMatchObject({ box: 2, due: addDays(DAY0, 4) });
      expect(inPools(log[1]!, id)).toBe(false);
      expect(inPools(log[2]!, id)).toBe(false);
      expect(log[3]!.pools.b).toContain(id);
    }
  });

  it('returns a word missed on day 5 to box 1, due on day 6', () => {
    const a = 'vocab:word-a';
    expect(stateOn(log[3]!, a)).toMatchObject({ box: 2, due: addDays(DAY0, 5) });
    expect(log[4]!.pools.b).toContain(a);
    expect(log[4]!.answers[a]).toBe(false);
    expect(stateOn(log[4]!, a)).toMatchObject({ box: 1, due: addDays(DAY0, 6), bestBox: 2 });
    expect(log[5]!.pools.a).toContain(a);
  });

  it('demotes every miss one box (not below 1) and makes it due the next day', () => {
    for (const entry of log) {
      for (const [id, ok] of Object.entries(entry.answers)) {
        if (ok) continue;
        const before = stateOn(entry, id, 'before');
        expect(stateOn(entry, id)).toMatchObject({ box: Math.max(1, before.box - 1), due: addDays(DAY0, entry.day + 1) });
      }
    }
  });

  it('never puts a word that is not yet due in a pool', () => {
    for (const entry of log) {
      const today = addDays(DAY0, entry.day);
      for (const id of [...entry.pools.a, ...entry.pools.b, ...entry.pools.d]) {
        expect(isDue(stateOn(entry, id, 'before'), today)).toBe(true);
      }
    }
  });

  it('never lets bestBox fall and keeps the slice valid every day', () => {
    for (const entry of log) {
      for (const s of entry.before.items) {
        expect(stateOn(entry, s.id).bestBox).toBeGreaterThanOrEqual(s.bestBox);
      }
      expect(VocabProgressSchema.safeParse(entry.after).success).toBe(true);
    }
  });

  it('first fills Pool D on day 11, never earlier', () => {
    const firstD = log.find((entry) => entry.pools.d.length > 0);
    expect(firstD?.day).toBe(11);
  });

  it('keeps Pool D empty before day 11 for any seed', () => {
    for (const seed of [1, 7, 42, 99, 12345]) {
      const firstD = simulate(seed).find((entry) => entry.pools.d.length > 0);
      expect(firstD === undefined || firstD.day >= 11).toBe(true);
    }
  });
});
