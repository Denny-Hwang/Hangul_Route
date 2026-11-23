import { describe, expect, it } from 'vitest';
import { strokesForJamo } from '../../../content/jamo-strokes';
import { placeBlockStrokes } from '../block-strokes';
import { letterRomanization } from '../letter-romanization';

const romOf = (syllable: string): string[] =>
  placeBlockStrokes(syllable, strokesForJamo)!.letters.map((l) => letterRomanization(l, syllable, 'X'));

describe('[SO] letterRomanization (Show me label in letter mode)', () => {
  it('reads each letter of a block by its romanization, never a glyph', () => {
    expect(romOf('호')).toEqual(['h', 'o']);
    expect(romOf('곰')).toEqual(['g/k', 'o', 'm']);
    expect(romOf('야')).toEqual(['silent/ng', 'ya']);
    expect(romOf('앙')).toEqual(['silent/ng', 'a', 'ng']);
  });
  it('reads a compound vowel and a double initial as one sound', () => {
    expect(romOf('돼')).toEqual(['d/t', 'wae']);
    expect(romOf('끼')).toEqual(['kk', 'i']);
  });
  it('reads a double final by its parts, in writing order', () => {
    expect(romOf('닭')).toEqual(['d/t', 'a', 'lk']);
  });
  it('falls back to the block when the letter has no symbol', () => {
    expect(letterRomanization({ role: 'initial', char: 'ㅎ', jamoIds: ['jamo:none'] }, '호', 'ho')).toBe('ho');
    expect(letterRomanization({ role: 'vowel', char: 'ㅗ', jamoIds: ['jamo:o'] }, 'x', 'ho')).toBe('ho');
    expect(letterRomanization({ role: 'final', char: 'ㄺ', jamoIds: ['jamo:rieul', 'jamo:none'] }, '닭', 'dak')).toBe('dak');
    expect(letterRomanization({ role: 'initial', char: 'Q', jamoIds: [] }, '닭', 'dak')).toBe('dak');
  });
});
