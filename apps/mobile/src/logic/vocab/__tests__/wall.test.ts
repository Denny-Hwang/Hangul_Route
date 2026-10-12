import { describe, expect, it } from 'vitest';
import { wallTiles } from '../wall';
import { progress, state, word } from './fixtures';

const ITEMS = [word('c'), word('a'), word('b')];

describe('wallTiles (F-VOC-003 section 3.4)', () => {
  it('keeps the file order and marks collected and new words', () => {
    expect(wallTiles(ITEMS, progress([state('b')]))).toEqual([
      { id: 'vocab:c', state: 'new' },
      { id: 'vocab:a', state: 'new' },
      { id: 'vocab:b', state: 'collected' },
    ]);
  });

  it('never reorders by progress: a strong word stays where it was', () => {
    const p = progress([state('a', { box: 5, bestBox: 5 }), state('c')]);
    expect(wallTiles(ITEMS, p).map((t) => t.id)).toEqual(['vocab:c', 'vocab:a', 'vocab:b']);
  });

  it('is empty for no words', () => {
    expect(wallTiles([], progress())).toEqual([]);
  });
});
