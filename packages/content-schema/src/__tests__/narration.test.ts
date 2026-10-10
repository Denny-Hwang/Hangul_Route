import { describe, expect, it } from 'vitest';
import { narrationTokenIds, narrationWordCount, parseNarration } from '../index';

const keywords = [
  { id: 'sagwan', ko: '사관' },
  { id: 'jamo-g', ko: 'ㄱ' },
  { id: 'jamo-n', ko: 'ㄴ' },
];

describe('parseNarration (F-STORY-001 §3.4)', () => {
  it('returns one text part when there is no token', () => {
    expect(parseNarration('Hoya says hello.', keywords)).toEqual([{ text: 'Hoya says hello.' }]);
  });

  it('returns nothing for an empty string', () => {
    expect(parseNarration('', keywords)).toEqual([]);
  });

  it('splits text around a token and returns the whole keyword entry', () => {
    expect(parseNarration('These were the {kw:sagwan}, the royal historians.', keywords)).toEqual([
      { text: 'These were the ' },
      { kw: keywords[0] },
      { text: ', the royal historians.' },
    ]);
  });

  it('handles a token at the start and at the end', () => {
    expect(parseNarration('{kw:sagwan} wrote.', keywords)).toEqual([
      { kw: keywords[0] },
      { text: ' wrote.' },
    ]);
    expect(parseNarration('A historian: {kw:sagwan}', keywords)).toEqual([
      { text: 'A historian: ' },
      { kw: keywords[0] },
    ]);
  });

  it('keeps adjacent tokens as separate parts without empty text between them', () => {
    expect(parseNarration('{kw:jamo-g}{kw:jamo-n}', keywords)).toEqual([
      { kw: keywords[1] },
      { kw: keywords[2] },
    ]);
  });

  it('throws on a token that names no keyword', () => {
    expect(() => parseNarration('See {kw:missing}.', keywords)).toThrow(
      'narration-token-unknown: missing',
    );
  });

  it.each(['A stray { brace', 'A stray } brace', 'Half {kw:sagwan', '{kw:Sagwan}', '{kw:}', '{kw: sagwan}'])(
    'throws on a brace outside a token: %s',
    (text) => {
      expect(() => parseNarration(text, keywords)).toThrow('narration-brace');
    },
  );
});

describe('narrationTokenIds', () => {
  it('lists the token ids in order, repeats included', () => {
    expect(narrationTokenIds('{kw:a} and {kw:b-2} and {kw:a}')).toEqual(['a', 'b-2', 'a']);
  });

  it('returns an empty list when there is no token', () => {
    expect(narrationTokenIds('plain')).toEqual([]);
  });
});

describe('narrationWordCount', () => {
  it('counts whitespace-separated words', () => {
    expect(narrationWordCount('Hoya has one more question.')).toBe(5);
    expect(narrationWordCount('  spaced   out  ')).toBe(2);
    expect(narrationWordCount('')).toBe(0);
  });

  it('counts a token as one word, even with punctuation attached', () => {
    expect(narrationWordCount('These were the {kw:sagwan}, the royal historians.')).toBe(7);
  });

  it('counts each of several adjacent tokens as a word', () => {
    expect(narrationWordCount('Letters {kw:jamo-g}{kw:jamo-n} here')).toBe(4);
  });
});
