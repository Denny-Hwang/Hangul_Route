import { describe, expect, it } from 'vitest';
import {
  QUICK_CHECK_SIZE,
  cardsSessionEvent,
  chunkSize,
  chunkTally,
  chunksFor,
  currentId,
  dotsFilled,
  flashEvents,
  flashReducer,
  initFlash,
  quickCheckEvent,
  quickCheckItems,
  suggestedChunk,
  summaryPrimary,
  type FlashEvent,
  type FlashState,
} from '../flashcards';
import { progress, state, word } from './fixtures';

const ids = (chunks: readonly (readonly { id: string }[])[]) => chunks.map((c) => c.map((i) => i.id.slice(6)));
const words = (n: number, level: (i: number) => 1 | 2 | 3 = () => 1) =>
  Array.from({ length: n }, (_, i) => word(`w${String(i + 1).padStart(2, '0')}`, { level: level(i) }));

function run(s: FlashState, events: readonly FlashEvent[]): FlashState {
  return events.reduce(flashReducer, s);
}

describe('chunkSize (T4)', () => {
  it('follows the level order, never an age', () => {
    expect(chunkSize(0)).toBe(4);
    expect(chunkSize(1)).toBe(4);
    expect(chunkSize(2)).toBe(6);
    expect(chunkSize(null)).toBe(4);
  });
});

describe('chunksFor (F-VOC-003 section 3.5)', () => {
  it('a 12-word topic is 3 chunks of 4 or 2 chunks of 6', () => {
    expect(chunksFor(words(12), 4, false).map((c) => c.length)).toEqual([4, 4, 4]);
    expect(chunksFor(words(12), 6, false).map((c) => c.length)).toEqual([6, 6]);
  });

  it('24 words are 6 chunks of 4', () => {
    expect(chunksFor(words(24), 4, false).map((c) => c.length)).toEqual([4, 4, 4, 4, 4, 4]);
  });

  it('orders by level with file order inside a level unless the order is fixed', () => {
    const items = [word('a', { level: 2 }), word('b', { level: 1 }), word('c', { level: 3 }), word('d', { level: 1 })];
    expect(ids(chunksFor(items, 4, false))).toEqual([['b', 'd', 'a', 'c']]);
    expect(ids(chunksFor(items, 4, true))).toEqual([['a', 'b', 'c', 'd']]);
    expect(items.map((i) => i.id.slice(6))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('merges a trailing chunk of one word into the previous chunk', () => {
    expect(chunksFor(words(9), 4, false).map((c) => c.length)).toEqual([4, 5]);
    expect(chunksFor(words(13), 6, false).map((c) => c.length)).toEqual([6, 7]);
    expect(chunksFor(words(10), 4, false).map((c) => c.length)).toEqual([4, 4, 2]);
  });

  it('keeps a topic smaller than one chunk whole, even a single word', () => {
    expect(chunksFor(words(3), 4, false).map((c) => c.length)).toEqual([3]);
    expect(chunksFor(words(1), 4, false).map((c) => c.length)).toEqual([1]);
    expect(chunksFor([], 4, false)).toEqual([]);
  });

  it('falls back to 4 for a size that is not a whole number of at least 1', () => {
    for (const bad of [0, -2, 2.5, Number.NaN]) {
      expect(chunksFor(words(8), bad, false).map((c) => c.length)).toEqual([4, 4]);
    }
  });
});

describe('suggestedChunk', () => {
  const chunks = chunksFor(words(12), 4, false);

  it('is the first chunk with a word not yet collected', () => {
    expect(suggestedChunk(chunks, progress())).toBe(0);
    const firstDone = progress(['w01', 'w02', 'w03', 'w04', 'w06'].map((s) => state(s)));
    expect(suggestedChunk(chunks, firstDone)).toBe(1);
  });

  it('is chunk 0 (review) when every word is collected, or there are no chunks', () => {
    const all = progress(words(12).map((w) => state(w.id.slice(6))));
    expect(suggestedChunk(chunks, all)).toBe(0);
    expect(suggestedChunk([], progress())).toBe(0);
  });
});

describe('flashReducer (F-VOC-003 section 3.5)', () => {
  const chunk = [word('a'), word('b'), word('c'), word('d')];

  it('starts on the front of the first card', () => {
    const s = initFlash(chunk);
    expect(s).toMatchObject({ queue: ['vocab:a', 'vocab:b', 'vocab:c', 'vocab:d'], index: 0, face: 'front', heard: 0, phase: 'cards' });
    expect([...s.requeued]).toEqual([]);
    expect([...s.flipped]).toEqual([]);
    expect(s.outcomes).toEqual({});
    expect(currentId(s)).toBe('vocab:a');
  });

  it('a chunk with no words goes straight to the check phase', () => {
    expect(initFlash([]).phase).toBe('check');
    expect(currentId(initFlash([]))).toBeNull();
  });

  it('flip toggles the face and the first back collects the word (T2)', () => {
    const s1 = flashReducer(initFlash(chunk), 'flip');
    expect(s1.face).toBe('back');
    expect([...s1.flipped]).toEqual(['vocab:a']);
    const s2 = flashReducer(s1, 'flip');
    expect(s2.face).toBe('front');
    expect([...s2.flipped]).toEqual(['vocab:a']);
    expect(flashReducer(s2, 'flip').flipped).toBe(s2.flipped);
  });

  it('got-it and again are ignored on the front (T3)', () => {
    const s = initFlash(chunk);
    expect(flashReducer(s, 'got-it')).toBe(s);
    expect(flashReducer(s, 'again')).toBe(s);
  });

  it('got-it records the outcome and moves to the next front', () => {
    const s = run(initFlash(chunk), ['flip', 'got-it']);
    expect(s).toMatchObject({ index: 1, face: 'front', outcomes: { 'vocab:a': 'got-it' } });
    expect(currentId(s)).toBe('vocab:b');
  });

  it('again requeues the word once at the end of the chunk', () => {
    const s = run(initFlash(chunk), ['flip', 'again']);
    expect(s.queue).toEqual(['vocab:a', 'vocab:b', 'vocab:c', 'vocab:d', 'vocab:a']);
    expect([...s.requeued]).toEqual(['vocab:a']);
    expect(s.outcomes).toEqual({ 'vocab:a': 'again' });
    const end = run(s, ['flip', 'got-it', 'flip', 'got-it', 'flip', 'got-it']);
    expect(currentId(end)).toBe('vocab:a');
    const twice = flashReducer(flashReducer(end, 'flip'), 'again');
    expect(twice.queue).toHaveLength(5);
    expect(twice.phase).toBe('check');
    expect(twice.outcomes['vocab:a']).toBe('again');
  });

  it('passing the end of the queue opens the check; flips and marks are ignored there', () => {
    const s = run(initFlash(chunk), ['flip', 'got-it', 'flip', 'got-it', 'flip', 'got-it', 'flip', 'got-it']);
    expect(s.phase).toBe('check');
    expect(currentId(s)).toBeNull();
    expect(flashReducer(s, 'flip')).toBe(s);
    expect(flashReducer(s, 'got-it')).toBe(s);
    expect(flashReducer(s, 'hear')).toBe(s);
  });

  it('check-done finishes only from the check phase', () => {
    const cards = initFlash(chunk);
    expect(flashReducer(cards, 'check-done')).toBe(cards);
    const done = flashReducer(initFlash([]), 'check-done');
    expect(done.phase).toBe('done');
    expect(flashReducer(done, 'check-done')).toBe(done);
  });

  it('hear counts speaker taps on the cards', () => {
    expect(run(initFlash(chunk), ['hear', 'flip', 'hear', 'hear']).heard).toBe(3);
  });

  it('a cards state pointing past its queue has no current card and ignores events', () => {
    const odd: FlashState = { ...initFlash(chunk), index: 9 };
    expect(currentId(odd)).toBeNull();
    expect(flashReducer(odd, 'flip')).toBe(odd);
  });

  it('ignores an unknown event', () => {
    const s = initFlash(chunk);
    expect(flashReducer(s, 'jump' as FlashEvent)).toBe(s);
  });
});

describe('dotsFilled (fill-only meter)', () => {
  const chunk = [word('a'), word('b'), word('c')];

  it('counts the cards shown so far; a requeued card adds no dot', () => {
    const s0 = initFlash(chunk);
    expect(dotsFilled(s0)).toBe(1);
    const s1 = run(s0, ['flip', 'again', 'flip', 'got-it', 'flip', 'got-it']);
    expect(currentId(s1)).toBe('vocab:a');
    expect(dotsFilled(s1)).toBe(3);
    expect(dotsFilled(run(s1, ['flip', 'got-it']))).toBe(3);
    expect(dotsFilled(initFlash([]))).toBe(0);
  });
});

describe('flashEvents (section 3.6: what is written, as it happens)', () => {
  const chunk = [word('a'), word('b')];

  it('the first back writes introduced; later flips write nothing', () => {
    const s = initFlash(chunk);
    expect(flashEvents(s, 'flip')).toEqual([{ type: 'introduced', id: 'vocab:a' }]);
    const back = flashReducer(s, 'flip');
    expect(flashEvents(back, 'flip')).toEqual([]);
    expect(flashEvents(flashReducer(back, 'flip'), 'flip')).toEqual([]);
  });

  it('got-it and again write a self report on the back', () => {
    const back = flashReducer(initFlash(chunk), 'flip');
    expect(flashEvents(back, 'got-it')).toEqual([{ type: 'self', id: 'vocab:a', known: true }]);
    expect(flashEvents(back, 'again')).toEqual([{ type: 'self', id: 'vocab:a', known: false }]);
  });

  it('a mark on a card not yet flipped also writes introduced', () => {
    const odd: FlashState = { ...initFlash(chunk), face: 'back' };
    expect(flashEvents(odd, 'got-it')).toEqual([
      { type: 'introduced', id: 'vocab:a' },
      { type: 'self', id: 'vocab:a', known: true },
    ]);
  });

  it('writes nothing for an ignored event, the speaker or the check', () => {
    const s = initFlash(chunk);
    expect(flashEvents(s, 'got-it')).toEqual([]);
    expect(flashEvents(s, 'hear')).toEqual([]);
    expect(flashEvents(s, 'check-done')).toEqual([]);
    expect(flashEvents(initFlash([]), 'flip')).toEqual([]);
  });

  it('builds the quick-check answer and the session events', () => {
    expect(quickCheckEvent('vocab:a', true)).toEqual({
      type: 'answer',
      id: 'vocab:a',
      correct: true,
      format: 'word-to-image',
      source: 'cards',
    });
    expect(cardsSessionEvent('food')).toEqual({ type: 'session', topicKey: 'food', kind: 'cards' });
  });
});

describe('quickCheckItems', () => {
  const chunk = [word('a'), word('b'), word('c'), word('d')];

  it('takes the again words first, in chunk order, padded with the earliest words', () => {
    expect(QUICK_CHECK_SIZE).toBe(2);
    expect(quickCheckItems(chunk, { 'vocab:d': 'again', 'vocab:b': 'again', 'vocab:c': 'again' }).map((i) => i.id)).toEqual([
      'vocab:b',
      'vocab:c',
    ]);
    expect(quickCheckItems(chunk, { 'vocab:c': 'again', 'vocab:a': 'got-it' }).map((i) => i.id)).toEqual(['vocab:a', 'vocab:c']);
    expect(quickCheckItems(chunk, {}).map((i) => i.id)).toEqual(['vocab:a', 'vocab:b']);
  });

  it('never repeats a word and returns what there is for a short chunk', () => {
    expect(quickCheckItems([word('a')], { 'vocab:a': 'again' }).map((i) => i.id)).toEqual(['vocab:a']);
    expect(quickCheckItems(chunk, {}, 3).map((i) => i.id)).toEqual(['vocab:a', 'vocab:b', 'vocab:c']);
  });
});

describe('chunkTally (vocab.cards.complete counts)', () => {
  it('counts self marks, speaker taps and the words newly collected in this chunk', () => {
    const chunk = [word('a'), word('b'), word('c')];
    const s = run(initFlash(chunk), ['hear', 'flip', 'again', 'flip', 'got-it', 'flip', 'got-it', 'flip', 'got-it']);
    expect(chunkTally(s, new Set(['vocab:b']))).toEqual({ words: 3, gotIt: 3, again: 0, heard: 1, newlyCollected: 2 });
    const t = run(initFlash(chunk), ['flip', 'again', 'flip', 'again']);
    expect(chunkTally(t, new Set())).toEqual({ words: 3, gotIt: 0, again: 2, heard: 0, newlyCollected: 2 });
  });

  it('a chunk opened again after every word was collected has no new words (behaviour 12)', () => {
    const chunk = [word('a'), word('b')];
    const s = run(initFlash(chunk), ['flip', 'got-it', 'flip', 'got-it']);
    expect(chunkTally(s, new Set(['vocab:a', 'vocab:b'])).newlyCollected).toBe(0);
  });
});

describe('summaryPrimary (the chunk summary button)', () => {
  const chunks = chunksFor(words(8), 4, false);

  it('offers the next words while a word of the topic is still to meet', () => {
    expect(summaryPrimary(chunks, 0, new Set(['vocab:w01', 'vocab:w02', 'vocab:w03', 'vocab:w04']))).toEqual({
      kind: 'next',
      chunk: 1,
    });
  });

  it('offers a review of the same chunk once every word is collected', () => {
    const all = new Set(words(8).map((w) => w.id));
    expect(summaryPrimary(chunks, 1, all)).toEqual({ kind: 'review', chunk: 1 });
  });

  it('a chunk index outside the list reviews chunk 0', () => {
    const all = new Set(words(8).map((w) => w.id));
    expect(summaryPrimary(chunks, 7, all)).toEqual({ kind: 'review', chunk: 0 });
  });
});
