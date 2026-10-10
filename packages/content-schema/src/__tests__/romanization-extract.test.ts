import { describe, expect, it } from 'vitest';
import { extractKoreanPairs, extractProsePairs } from '../index';

const pairs = (src: string) => extractKoreanPairs(src, 'x.ts').map((p) => [p.line, p.kind, p.ko, p.romanization]);

describe('extractKoreanPairs: object literals', () => {
  it('finds a single-line object literal', () => {
    expect(pairs("const a = { ko: '윷놀이', en: 'Yut game', romanization: 'yutnori' };")).toEqual([
      [1, 'object', '윷놀이', 'yutnori'],
    ]);
  });

  it('finds a multi-line literal, either key order, with the line of the Korean string', () => {
    const src = [
      'export const cards = [',
      '  {',
      "    id: 'a',",
      '    ko: "한글날",',
      '    en: "Hangul Day",',
      '    romanization: "hangeul-nal",',
      '  },',
      '  {',
      "    romanization: 'horangi',",
      '    ko: `호랑이`,',
      '  },',
      '];',
    ].join('\n');
    expect(pairs(src)).toEqual([
      [4, 'object', '한글날', 'hangeul-nal'],
      [10, 'object', '호랑이', 'horangi'],
    ]);
  });

  it('accepts quoted (JSON-style) keys and unescapes simple escapes', () => {
    expect(pairs('{ "ko": "그건 \\"좋아\\"", "romanization": "geugeon joa" }')).toEqual([
      [1, 'object', '그건 "좋아"', 'geugeon joa'],
    ]);
  });

  it('pairs keys at the top level of their own object only', () => {
    const src = "{ ko: '밥', options: [{ ko: '물', romanization: 'mul' }], romanization: 'bap' }";
    expect(pairs(src)).toEqual([
      [1, 'object', '물', 'mul'],
      [1, 'object', '밥', 'bap'],
    ]);
  });

  it('keeps the first of a repeated key', () => {
    expect(pairs("{ ko: '밥', ko: '물', romanization: 'bap', romanization: 'mul' }")).toEqual([[1, 'object', '밥', 'bap']]);
  });

  it('ignores objects missing either side, non-Hangul ko, and non-string values', () => {
    expect(pairs("{ ko: '밥' }")).toEqual([]);
    expect(pairs("{ romanization: 'bap' }")).toEqual([]);
    expect(pairs("{ ko: 'abc', romanization: 'abc' }")).toEqual([]);
    expect(pairs("{ ko: word, romanization: 'bap' }")).toEqual([]);
    expect(pairs("{ npcKo: '밥', npcRomanization: 'bap' }")).toEqual([]);
  });

  it('ignores keys outside any object and stray closing braces', () => {
    expect(pairs("} ko: '밥', romanization: 'bap'")).toEqual([]);
    expect(pairs("{ ko: '밥', romanization: 'bap'")).toEqual([]);
  });

  it('is not confused by braces inside strings', () => {
    expect(pairs("{ en: '}{', ko: '밥', romanization: 'bap' }")).toEqual([[1, 'object', '밥', 'bap']]);
  });

  it('is not confused by a lone apostrophe in JSX text', () => {
    const src = ["<p>Let's go</p>", "{ ko: '밥', romanization: 'bap' }"].join('\n');
    expect(pairs(src)).toEqual([[2, 'object', '밥', 'bap']]);
  });
});

describe('extractKoreanPairs: comments', () => {
  it('finds nothing inside line or block comments', () => {
    const src = [
      "// { ko: '밥', romanization: 'bap' }",
      "/* { ko: '물', romanization: 'mul' } */",
      '/**',
      " * 거의! · geo-eui · almost!",
      ' */',
      "{ ko: '불', romanization: 'bul' } // trailing 국 (guk)",
    ].join('\n');
    expect(pairs(src)).toEqual([[6, 'object', '불', 'bul']]);
  });

  it('keeps comment markers inside strings', () => {
    const src = "{ en: 'https://x.dev/a', ko: '밥', romanization: 'bap' }";
    expect(pairs(src)).toEqual([[1, 'object', '밥', 'bap']]);
  });
});

describe('extractKoreanPairs: middot JSX pattern', () => {
  it('finds `한글 · romanized · gloss`', () => {
    const src = ['<p>', '  거의! · geo-eui · almost!', '</p>'].join('\n');
    expect(pairs(src)).toEqual([[2, 'middot', '거의!', 'geo-eui']]);
    expect(pairs('<b>거의 다 했어! · geoui da haesseo · almost there!</b>')).toEqual([
      [1, 'middot', '거의 다 했어!', 'geoui da haesseo'],
    ]);
  });

  it('needs Korean first and romanized second', () => {
    expect(pairs('<b>almost · 거의 · geo-eui</b>')).toEqual([]);
    expect(pairs('<b>거의 · 거의 · almost</b>')).toEqual([]);
  });
});

describe('extractKoreanPairs: prose', () => {
  it('finds `romanized (한글)` and `한글 (romanized)`', () => {
    expect(pairs("blurbEn: 'We play yutnori (윷놀이) and 한글날 (hangeul-nal).'")).toEqual([
      [1, 'prose', '윷놀이', 'yutnori'],
      [1, 'prose', '한글날', 'hangeul-nal'],
    ]);
  });

  it('extractProsePairs reports offsets', () => {
    expect(extractProsePairs('say gangaji (강아지)')).toEqual([{ ko: '강아지', romanization: 'gangaji', index: 4 }]);
    expect(extractProsePairs('강아지 (gangaji)')).toEqual([{ ko: '강아지', romanization: 'gangaji', index: 0 }]);
    expect(extractProsePairs('(가) 없음')).toEqual([]);
  });

  it('finds nothing in comments', () => {
    expect(pairs('// yutnori (윷놀이)')).toEqual([]);
  });
});

describe('extractKoreanPairs: ordering and labels', () => {
  it('orders by line and carries the file label', () => {
    const src = ["<p>밥 (bap)</p>", "{ ko: '물', romanization: 'mul' }"].join('\n');
    const found = extractKoreanPairs(src, 'apps/web/x.tsx');
    expect(found.map((p) => p.line)).toEqual([1, 2]);
    expect(found.every((p) => p.file === 'apps/web/x.tsx')).toBe(true);
  });
});
