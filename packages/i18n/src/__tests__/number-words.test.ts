import { describe, expect, it } from 'vitest';
import { numberInWords } from '../number-words';

/**
 * [FN] AMENDMENTS-FINISH-2026-11 FN-1: the check before a new PIN shows a number written out in words in the UI
 * language. Cardinal numbers 0 to 999 as a reader says them: en (US, no "and"), es (neutral), ko (Sino-Korean, Hangul).
 */
describe('numberInWords', () => {
  it('English', () => {
    const cases: Array<[number, string]> = [
      [0, 'zero'],
      [7, 'seven'],
      [13, 'thirteen'],
      [20, 'twenty'],
      [42, 'forty-two'],
      [99, 'ninety-nine'],
      [100, 'one hundred'],
      [101, 'one hundred one'],
      [310, 'three hundred ten'],
      [347, 'three hundred forty-seven'],
      [519, 'five hundred nineteen'],
      [800, 'eight hundred'],
      [999, 'nine hundred ninety-nine'],
    ];
    for (const [n, words] of cases) expect(numberInWords('en', n), String(n)).toBe(words);
  });

  it('Spanish', () => {
    const cases: Array<[number, string]> = [
      [0, 'cero'],
      [1, 'uno'],
      [15, 'quince'],
      [16, 'dieciséis'],
      [21, 'veintiuno'],
      [22, 'veintidós'],
      [26, 'veintiséis'],
      [30, 'treinta'],
      [31, 'treinta y uno'],
      [100, 'cien'],
      [101, 'ciento uno'],
      [123, 'ciento veintitrés'],
      [347, 'trescientos cuarenta y siete'],
      [500, 'quinientos'],
      [715, 'setecientos quince'],
      [999, 'novecientos noventa y nueve'],
    ];
    for (const [n, words] of cases) expect(numberInWords('es', n), String(n)).toBe(words);
  });

  it('Korean (Sino-Korean, no 일 before 십 or 백)', () => {
    const cases: Array<[number, string]> = [
      [0, '영'],
      [1, '일'],
      [10, '십'],
      [11, '십일'],
      [20, '이십'],
      [100, '백'],
      [110, '백십'],
      [211, '이백십일'],
      [347, '삼백사십칠'],
      [906, '구백육'],
      [999, '구백구십구'],
    ];
    for (const [n, words] of cases) expect(numberInWords('ko', n), String(n)).toBe(words);
  });

  it('never writes a digit, for every number from 100 to 999 in every locale, and no two numbers share words', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const seen = new Set<string>();
      for (let n = 100; n <= 999; n += 1) {
        const words = numberInWords(locale, n);
        expect(words, `${locale} ${n}`).not.toMatch(/[0-9]/);
        seen.add(words);
      }
      expect(seen.size, locale).toBe(900);
    }
  });

  it('refuses what it cannot say', () => {
    for (const n of [-1, 1000, 1.5, Number.NaN]) expect(() => numberInWords('en', n)).toThrow(RangeError);
  });
});
