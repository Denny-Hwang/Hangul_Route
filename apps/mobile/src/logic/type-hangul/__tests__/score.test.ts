import { describe, expect, it } from 'vitest';
import { normalizeTyped, scoreTyped } from '../score';

describe('normalizeTyped (type-hangul.md "Space")', () => {
  it('trims and reads runs of spaces as one', () => {
    expect(normalizeTyped('  저는   호야예요 ')).toBe('저는 호야예요');
    expect(normalizeTyped('')).toBe('');
  });
});

describe('scoreTyped (by syllable, after Done)', () => {
  it('a match: every block the same', () => {
    const s = scoreTyped('호야', '호야');
    expect(s.verdict).toBe('match');
    expect(s.blocks).toEqual([
      { typed: '호', target: '호', status: 'same' },
      { typed: '야', target: '야', status: 'same' },
    ]);
    expect(s.differing).toEqual([]);
  });

  it('spacing never decides: extra, missing or doubled spaces still match', () => {
    expect(scoreTyped(' 저는  호야예요 ', '저는 호야예요').verdict).toBe('match');
    expect(scoreTyped('저는호야예요', '저는 호야예요').verdict).toBe('match');
  });

  it('a near miss: one block different', () => {
    const s = scoreTyped('호여', '호야');
    expect(s.verdict).toBe('near');
    expect(s.blocks[1]).toEqual({ typed: '여', target: '야', status: 'different' });
    expect(s.differing).toEqual([2]);
  });

  it('a near miss: one block missing or one extra', () => {
    const missing = scoreTyped('김', '김밥');
    expect(missing.verdict).toBe('near');
    expect(missing.blocks).toEqual([
      { typed: '김', target: '김', status: 'same' },
      { typed: null, target: '밥', status: 'missing' },
    ]);
    const extra = scoreTyped('호호야', '호야');
    expect(extra.verdict).toBe('near');
    expect(extra.blocks.filter((b) => b.status === 'extra')).toHaveLength(1);
    expect(extra.differing).toHaveLength(1);
  });

  it('an open block (a lone jamo) is a block that differs', () => {
    const s = scoreTyped('호ㅇ', '호야');
    expect(s.verdict).toBe('near');
    expect(s.blocks[1]).toEqual({ typed: 'ㅇ', target: '야', status: 'different' });
  });

  it('a far miss: more than one block differs', () => {
    const s = scoreTyped('하나', '호야');
    expect(s.verdict).toBe('far');
    expect(s.differing).toEqual([1, 2]);
  });

  it('a missing block in the middle lines the rest up', () => {
    const s = scoreTyped('이에요', '이름이에요');
    expect(s.blocks.map((b) => b.status)).toEqual(['missing', 'missing', 'same', 'same', 'same']);
    expect(s.verdict).toBe('far');
  });

  it('nothing typed against a one-block word is a near miss; against a longer one, far', () => {
    expect(scoreTyped('', '밥').verdict).toBe('near');
    expect(scoreTyped('   ', '김밥').verdict).toBe('far');
  });
});
