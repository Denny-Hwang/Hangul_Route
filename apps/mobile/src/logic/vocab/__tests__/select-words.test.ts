import type { RuntimeVocabItem, VocabItemState, VocabProgress } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { mixFor, selectSpeedWords } from '../select-words';

const TODAY = '2026-10-20';

function word(slug: string): RuntimeVocabItem {
  return {
    id: `vocab:${slug}`,
    ko: '사과',
    romanization: slug,
    en: slug,
    pos: 'noun',
    topics: ['food'],
    level: 1,
    visual: 'word:apple',
    glosses: { en: slug },
  };
}

function st(slug: string, over: Partial<VocabItemState> = {}): VocabItemState {
  return {
    id: `vocab:${slug}`,
    first: '2026-09-01',
    seen: 2,
    right: 1,
    bestBox: 2,
    last: '2026-10-01',
    box: 2,
    due: '2026-10-30',
    at: '2026-10-01T10:00:00.000Z',
    ...over,
  };
}

const slice = (items: VocabItemState[]): VocabProgress => ({ v: 1, items, topics: [] });
const ids = (list: readonly RuntimeVocabItem[]): string[] => list.map((i) => i.id.slice('vocab:'.length));

describe('mixFor (F-VOC-005 section 3.5)', () => {
  it('splits 10 words into 6 due, 3 new and 1 strong', () => {
    expect(mixFor(10)).toEqual({ due: 6, fresh: 3, strong: 1 });
  });

  it('always adds up to the count and never goes negative', () => {
    for (let n = 0; n <= 30; n++) {
      const m = mixFor(n);
      expect(m.due + m.fresh + m.strong).toBe(n);
      expect(Math.min(m.due, m.fresh, m.strong)).toBeGreaterThanOrEqual(0);
    }
    expect(mixFor(1)).toEqual({ due: 1, fresh: 0, strong: 0 });
    expect(mixFor(4)).toEqual({ due: 2, fresh: 1, strong: 1 });
  });

  it('treats a negative, fractional or non-finite count as a whole number of at least 0', () => {
    expect(mixFor(-3)).toEqual({ due: 0, fresh: 0, strong: 0 });
    expect(mixFor(Number.NaN)).toEqual({ due: 0, fresh: 0, strong: 0 });
    expect(mixFor(10.9)).toEqual(mixFor(10));
  });
});

describe('selectSpeedWords (F-VOC-005 section 3.5)', () => {
  // 7 due (oldest due first: d1..d7), 4 new this week, 2 strong, 2 plain.
  const due = Array.from({ length: 7 }, (_, i) => st(`due${i + 1}`, { due: `2026-10-0${i + 1}`, first: '2026-09-01' }));
  const fresh = [
    st('new1', { first: '2026-10-19', due: '2026-10-21', box: 1, bestBox: 1 }),
    st('new2', { first: '2026-10-16', due: '2026-10-22', box: 1, bestBox: 1 }),
    st('new3', { first: '2026-10-13', due: '2026-10-25', box: 2 }),
    st('new4', { first: '2026-10-18', due: '2026-10-23', box: 1, bestBox: 1 }),
  ];
  const strong = [
    st('strong1', { box: 4, bestBox: 4, last: '2026-09-20', due: '2026-11-01' }),
    st('strong2', { box: 5, bestBox: 5, last: '2026-09-10', due: '2026-11-05' }),
  ];
  const plain = [st('plain1', { last: '2026-09-05' }), st('plain2', { last: '2026-08-01' })];
  const all = [...due, ...fresh, ...strong, ...plain];
  const collected = all.map((s) => word(s.id.slice('vocab:'.length)));
  const progress = slice(all);

  it('takes 6 due (oldest due first), 3 new this week (most recent first) and 1 strong (oldest last first) for 10', () => {
    const out = selectSpeedWords({ collected, progress, today: TODAY, count: 10, seed: 1 });
    expect(ids(out)).toEqual(['due1', 'due2', 'due3', 'due4', 'due5', 'due6', 'new1', 'new4', 'new2', 'strong2']);
  });

  it('never returns a word twice, even when the input lists it twice', () => {
    const out = selectSpeedWords({ collected: [...collected, ...collected], progress, today: TODAY, count: 15, seed: 3 });
    expect(new Set(ids(out)).size).toBe(out.length);
    expect(out).toHaveLength(15);
  });

  it('returns every collected word when there are fewer than the count, in priority order', () => {
    const few = [due[1]!, fresh[0]!, plain[1]!];
    const out = selectSpeedWords({
      collected: few.map((s) => word(s.id.slice(6))),
      progress: slice(few),
      today: TODAY,
      count: 10,
      seed: 1,
    });
    expect(ids(out)).toEqual(['due2', 'new1', 'plain2']);
  });

  it('fills a due shortfall from the new words, then the strong, then the oldest practised', () => {
    const items = [due[0]!, ...fresh, ...strong, ...plain];
    const out = selectSpeedWords({
      collected: items.map((s) => word(s.id.slice(6))),
      progress: slice(items),
      today: TODAY,
      count: 6,
      seed: 1,
    });
    // mix for 6: 4 due, 2 new, 0 strong; 1 due -> 3 carried to new (5 wanted, 4 exist) -> 1 carried to strong.
    expect(ids(out)).toEqual(['due1', 'new1', 'new4', 'new2', 'new3', 'strong2']);
  });

  it('fills a new-word shortfall from the strong words, then the oldest practised', () => {
    const items = [...due, ...strong, ...plain];
    const out = selectSpeedWords({
      collected: items.map((s) => word(s.id.slice(6))),
      progress: slice(items),
      today: TODAY,
      count: 10,
      seed: 1,
    });
    // 6 due, 0 new (3 carried) -> 4 strong wanted, 2 exist -> 2 from the oldest `last` of the rest.
    expect(ids(out)).toEqual(['due1', 'due2', 'due3', 'due4', 'due5', 'due6', 'strong2', 'strong1', 'plain2', 'plain1']);
  });

  it('fills the last places from any word with the oldest last, due words included', () => {
    const items = [...due.slice(0, 3), plain[0]!, plain[1]!];
    const late = slice(items.map((s, i) => ({ ...s, last: `2026-09-1${i}` })));
    const out = selectSpeedWords({
      collected: items.map((s) => word(s.id.slice(6))),
      progress: late,
      today: TODAY,
      count: 4,
      seed: 1,
    });
    // mix for 4: 2 due, 1 new, 1 strong; neither new nor strong exist -> 2 from the rest by oldest last.
    expect(ids(out)).toEqual(['due1', 'due2', 'due3', 'plain1']);
  });

  it('reads the week boundary inclusively: first on today minus 7 is new, minus 8 is not', () => {
    const items = [st('edge7', { first: '2026-10-13' }), st('edge8', { first: '2026-10-12', last: '2026-10-19' })];
    const out = selectSpeedWords({
      collected: items.map((s) => word(s.id.slice(6))),
      progress: slice(items),
      today: TODAY,
      count: 1,
      seed: 1,
    });
    expect(mixFor(1)).toEqual({ due: 1, fresh: 0, strong: 0 });
    // nothing due: the one place carries to new, where only edge7 qualifies.
    expect(ids(out)).toEqual(['edge7']);
  });

  it('counts box 4 and 5 as strong, box 3 not', () => {
    const items = [st('b3', { box: 3, bestBox: 3, last: '2026-01-01' }), st('b4', { box: 4, bestBox: 4, last: '2026-05-01' })];
    const out = selectSpeedWords({
      collected: items.map((s) => word(s.id.slice(6))),
      progress: slice(items),
      today: TODAY,
      count: 1,
      seed: 1,
    });
    expect(ids(out)).toEqual(['b4']);
  });

  it('puts a collected word with no saved state among the oldest practised', () => {
    const items = [st('known', { last: '2026-01-01' })];
    const out = selectSpeedWords({
      collected: [word('known'), word('stateless')],
      progress: slice(items),
      today: TODAY,
      count: 1,
      seed: 1,
    });
    expect(ids(out)).toEqual(['stateless']);
  });

  it('breaks ties inside a group by the seed only, deterministically', () => {
    const tied = Array.from({ length: 8 }, (_, i) => st(`tie${i}`, { due: '2026-10-05' }));
    const input = {
      collected: tied.map((s) => word(s.id.slice(6))),
      progress: slice(tied),
      today: TODAY,
      count: 5,
    };
    const a = selectSpeedWords({ ...input, seed: 7 });
    expect(selectSpeedWords({ ...input, seed: 7 })).toEqual(a);
    const orders = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => ids(selectSpeedWords({ ...input, seed })).join(',')));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('returns nothing for a count of 0 or no collected words', () => {
    expect(selectSpeedWords({ collected, progress, today: TODAY, count: 0, seed: 1 })).toEqual([]);
    expect(selectSpeedWords({ collected: [], progress, today: TODAY, count: 10, seed: 1 })).toEqual([]);
  });

  it('given 12 collected words of which 4 are due and count 10 (behaviour 10)', () => {
    const items = [
      ...due.slice(0, 4),
      ...fresh.map((s) => ({ ...s, due: '2026-11-01' })),
      ...strong,
      ...plain,
    ];
    const out = selectSpeedWords({
      collected: items.map((s) => word(s.id.slice(6))),
      progress: slice(items),
      today: TODAY,
      count: 10,
      seed: 1,
    });
    expect(ids(out).slice(0, 4)).toEqual(['due1', 'due2', 'due3', 'due4']);
    expect(ids(out).slice(4, 8)).toEqual(['new1', 'new4', 'new2', 'new3']);
    expect(ids(out).slice(8)).toEqual(['strong2', 'strong1']);
  });
});
