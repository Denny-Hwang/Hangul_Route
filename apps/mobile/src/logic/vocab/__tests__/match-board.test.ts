import { PicWordRoundSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { VOCAB_ITEMS } from '../../../content/__generated__/vocab';
import { MATCH_MAX_PAIRS, matchBoard, matchPlayable, matchScope } from '../match-board';
import { progress, state, word } from './fixtures';

const food = VOCAB_ITEMS.filter((item) => item.topics.includes('food'));
const collectedAll = progress(food.map((item) => state(item.id.slice(6))));
const base = { seed: 5, canRender: () => true, glossOf: (item: { en: string }) => item.en };

describe('matchBoard (F-VOC-003 section 3.9: a board from the collected words)', () => {
  it('3 to 5 pairs of collected words only, each a valid Pic-Word round', () => {
    const board = matchBoard(food, collectedAll, base);
    expect(board).not.toBeNull();
    expect(board!.pairs.length).toBe(MATCH_MAX_PAIRS);
    expect(PicWordRoundSchema.safeParse(board).success).toBe(true);
    const some = progress(['sagwa-apple', 'uyu', 'ppang'].map((s) => state(s)));
    const small = matchBoard(food, some, base);
    expect(small!.pairs.map((p) => p.id).sort()).toEqual(['vocab:ppang', 'vocab:sagwa-apple', 'vocab:uyu']);
  });

  it('a pair is the word with its picture, the romanization and the meaning in the UI language', () => {
    const board = matchBoard(food, progress([state('uyu'), state('ppang'), state('bap')]), { ...base, glossOf: () => 'leche' });
    const milk = board!.pairs.find((p) => p.id === 'vocab:uyu')!;
    const item = food.find((i) => i.id === 'vocab:uyu')!;
    expect(milk).toEqual({ id: 'vocab:uyu', pictureRef: item.visual, word: { ko: item.ko, romanization: item.romanization, en: 'leche' } });
  });

  it('keeps the spoken form and the clip when the word has them', () => {
    const items = [word('a', { ko: 'a1', spokenKo: 'a2', audioRef: 'audio/vocab/a.mp3' }), word('b', { ko: 'b1' }), word('c', { ko: 'c1' })];
    const board = matchBoard(items, progress([state('a'), state('b'), state('c')]), base);
    expect(board!.pairs.find((p) => p.id === 'vocab:a')!.word).toEqual(expect.objectContaining({ spokenKo: 'a2', audioRef: 'audio/vocab/a.mp3' }));
  });

  it('is null below 3 playable words (the topic page hides Match then)', () => {
    expect(matchBoard(food, progress([state('uyu'), state('ppang')]), base)).toBeNull();
    expect(matchBoard(food, collectedAll, { ...base, canRender: () => false })).toBeNull();
    expect(matchBoard([], collectedAll, base)).toBeNull();
  });

  it('never puts two words with the same Korean, the same sense or the same picture on one board', () => {
    const items = [
      word('a', { ko: 'x' }),
      word('b', { ko: 'x' }),
      word('c', { ko: 'y', visual: 'word:food-same' }),
      word('d', { ko: 'z', visual: 'word:food-same' }),
      word('e', { ko: 'w', senseGroup: 'g' }),
      word('f', { ko: 'v', senseGroup: 'g' }),
    ];
    const board = matchBoard(items, progress(items.map((i) => state(i.id.slice(6)))), base);
    expect(board!.pairs).toHaveLength(3);
    expect(PicWordRoundSchema.safeParse(board).success).toBe(true);
  });

  it('finds a board whenever 3 words fit together, whatever the seed (a word that clashes with two others is left out)', () => {
    // a clashes with b (the same Korean) and with c (the same picture); b, c and d fit together.
    const items = [
      word('a', { ko: 'x', visual: 'word:food-same' }),
      word('b', { ko: 'x' }),
      word('c', { ko: 'y', visual: 'word:food-same' }),
      word('d', { ko: 'z' }),
    ];
    // A first pick of a would leave a and d only; the board is b, c and d for every seed.
    const all = progress(items.map((i) => state(i.id.slice(6))));
    for (let seed = 1; seed <= 30; seed += 1) expect(matchBoard(items, all, { ...base, seed })?.pairs).toHaveLength(3);
  });

  it('is the same board for the same seed and may differ for another', () => {
    const ids = (seed: number) => matchBoard(food, collectedAll, { ...base, seed })!.pairs.map((p) => p.id);
    expect(ids(5)).toEqual(ids(5));
    const seen = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => ids(s).join()));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('matchScope', () => {
  it('wraps one board as a pic-word-match scope', () => {
    const board = matchBoard(food, collectedAll, base)!;
    expect(matchScope(board)).toEqual({ kind: 'pic-word-match', picWord: { boards: [board] } });
  });
});

describe('matchPlayable (the topic page draws Match only when a board can be dealt)', () => {
  const nature = VOCAB_ITEMS.filter((item) => item.topics.includes('nature'));

  it('false for 3 collected words that cannot share a board (excluded pairs): no Match that goes nowhere', () => {
    const clash = progress(['gureum', 'bi-rain', 'haneul'].map((s) => state(s)));
    expect(nature.some((i) => i.id === 'vocab:gureum')).toBe(true);
    expect(matchPlayable(nature, clash, () => true)).toBe(false);
    for (let seed = 1; seed <= 10; seed += 1) expect(matchBoard(nature, clash, { ...base, seed })).toBeNull();
  });

  it('true exactly when matchBoard deals a board', () => {
    expect(matchPlayable(food, collectedAll, () => true)).toBe(true);
    expect(matchPlayable(food, progress([state('uyu'), state('ppang')]), () => true)).toBe(false);
    expect(matchPlayable(food, collectedAll, () => false)).toBe(false);
  });
});
