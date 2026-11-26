import { describe, expect, it } from 'vitest';
import {
  ROMANIZATION_EXCEPTIONS,
  normalizeRomanization,
  romanize,
  romanizeReviewed,
  type RomanizationException,
} from '../index';

/** AMENDMENTS-ROMANIZER-GAPS §3.3: one reviewed romanization for every value that is composed. */

const entry = (ko: string, allowed: string[]): RomanizationException => ({ ko, allowed, reason: 'test entry' });

describe('romanizeReviewed: a whole-string entry', () => {
  it('gives the entry value for the exact string, in the shape romanize() returns', () => {
    expect(romanizeReviewed('송편은 솔잎을 깔고 쪄요.')).toEqual({ text: 'songpyeoneun sollipeul kkalgo jjyeoyo', unknown: [] });
    expect(romanizeReviewed('왜 기록할까요?')).toEqual({ text: 'wae girokalkkayo', unknown: [] });
  });

  it('trims the text before it looks for an entry', () => {
    expect(romanizeReviewed('  왜 기록할까요?  ').text).toBe('wae girokalkkayo');
  });

  it('normalises the value: lower case, no sentence marks, hyphens or apostrophes, single spaces', () => {
    const exceptions = [entry('호두가 딱딱해요!', ["  Hoduga   Ttak-ttak'aeyo!  ", 'second value'])];
    expect(romanizeReviewed('호두가 딱딱해요!', exceptions)).toEqual({ text: 'hoduga ttakttakaeyo', unknown: [] });
  });

  it('uses the first allowed value', () => {
    const exceptions = [entry('꽃잎 한 장', ['kkonnip han jang', 'kkochip han jang'])];
    expect(romanizeReviewed('꽃잎 한 장', exceptions).text).toBe('kkonnip han jang');
  });

  it('compares a whole-string entry on edge-stripped text, both sides: with or without the end mark or a quote', () => {
    expect(romanizeReviewed('송편은 솔잎을 깔고 쪄요').text).toBe('songpyeoneun sollipeul kkalgo jjyeoyo');
    expect(romanizeReviewed('송편은 솔잎을 깔고 쪄요!').text).toBe('songpyeoneun sollipeul kkalgo jjyeoyo');
    expect(romanizeReviewed('"왜 기록할까요?"').text).toBe('wae girokalkkayo');
    expect(romanizeReviewed('왜 기록할까요').text).toBe('wae girokalkkayo');
    const exceptions = [entry('"꽃잎 한 장"…', ['kkonnip han jang'])];
    expect(romanizeReviewed('꽃잎 한 장', exceptions).text).toBe('kkonnip han jang');
    expect(romanizeReviewed('꽃잎 한 장.', exceptions).text).toBe('kkonnip han jang');
    // Inside the sentence a mark is not an edge: the converter reads it as it always did.
    expect(romanizeReviewed('꽃잎, 한 장', exceptions).text).toBe(romanize('꽃잎, 한 장').text);
  });

  it('matches a whole string only: a longer or shorter string is not the entry', () => {
    const exceptions = [entry('꽃잎 한 장', ['kkonnip han jang'])];
    expect(romanizeReviewed('꽃잎 한', exceptions).text).toBe(romanize('꽃잎 한').text);
    expect(romanizeReviewed('꽃잎 한 장 주세요', exceptions).text).toBe(romanize('꽃잎 한 장 주세요').text);
  });

  it('is the shipped value of every shipped whole-string entry, normalised as the checker does', () => {
    expect(ROMANIZATION_EXCEPTIONS).toHaveLength(8);
    for (const e of ROMANIZATION_EXCEPTIONS) {
      const result = romanizeReviewed(e.ko);
      expect(result.text, e.ko).toBe(normalizeRomanization(e.allowed[0] as string).replace(/-/g, ''));
      expect(result.unknown, e.ko).toEqual([]);
    }
  });

  it('keeps the eight corrections the spec names: each differs from the converter, nothing else is added', () => {
    const changed = ROMANIZATION_EXCEPTIONS.filter((e) => romanizeReviewed(e.ko).text !== romanize(e.ko).text).map((e) => e.ko);
    expect(changed).toEqual(ROMANIZATION_EXCEPTIONS.map((e) => e.ko));
  });
});

describe('romanizeReviewed: a word entry', () => {
  const exceptions = [entry('꽃잎', ['kkonnip']), entry('솔잎', ['sollip'])];

  it('replaces that token inside a sentence and leaves the other tokens to the converter', () => {
    expect(romanizeReviewed('저는 꽃잎 먹어요', exceptions)).toEqual({ text: `${romanize('저는').text} kkonnip ${romanize('먹어요').text}`, unknown: [] });
  });

  it('matches the token after sentence marks are stripped, as romanize() strips them', () => {
    expect(romanizeReviewed('꽃잎! 솔잎, 꽃잎.', exceptions).text).toBe('kkonnip sollip kkonnip');
  });

  it('works on a frame piece with spaces around it', () => {
    expect(romanizeReviewed(' 꽃잎 ', exceptions)).toEqual({ text: 'kkonnip', unknown: [] });
  });

  it('does not match a token that only contains the word', () => {
    expect(romanizeReviewed('꽃잎을', exceptions).text).toBe(romanize('꽃잎을').text);
  });

  it('ignores an entry whose first allowed value is missing', () => {
    expect(romanizeReviewed('꽃잎', [entry('꽃잎', [])]).text).toBe(romanize('꽃잎').text);
  });

  it('lets the first of two entries for one word win', () => {
    expect(romanizeReviewed('꽃잎', [entry('꽃잎', ['kkonnip']), entry('꽃잎', ['kkochip'])]).text).toBe('kkonnip');
  });

  it('gives a word entry in a text with a token the converter cannot read: that token stays in unknown', () => {
    expect(romanizeReviewed('꽃잎 abc', exceptions)).toEqual({ text: 'kkonnip abc', unknown: ['abc'] });
  });

  it('serves a second call from the same list and a call with another list separately', () => {
    expect(romanizeReviewed('꽃잎', exceptions).text).toBe('kkonnip');
    expect(romanizeReviewed('꽃잎', exceptions).text).toBe('kkonnip');
    expect(romanizeReviewed('꽃잎', [entry('꽃잎', ['other'])]).text).toBe('other');
  });
});

describe('romanizeReviewed: no matching entry', () => {
  const SAMPLES = [
    '',
    '   ',
    '한글',
    '안녕하세요',
    '저는 한글을 배워요.',
    '읽고 맑게 좁히다',
    '오늘은 날씨가 좋아요!',
    '"한글", 쉬워요?',
    '한글 abc 123 가나다',
    'abc',
    '~ ... ·',
    '가-나 다',
    // every character romanize() strips, so the copy in reviewed.ts cannot drift from rr.ts
    '가-! 나? 다. 라, 마~ 바· 사… "아" \'자\' “차” ‘카’ 타’',
  ];

  it.each(SAMPLES)('is identical to romanize(%j)', (text) => {
    expect(romanizeReviewed(text)).toEqual(romanize(text));
    expect(romanizeReviewed(text, [])).toEqual(romanize(text));
  });

  it('is identical to romanize for every shipped entry string with the entries removed', () => {
    for (const e of ROMANIZATION_EXCEPTIONS) expect(romanizeReviewed(e.ko, [])).toEqual(romanize(e.ko));
  });

  it('is identical to romanize for a text the shipped entries do not name', () => {
    expect(romanizeReviewed('솔잎을 깔아요')).toEqual(romanize('솔잎을 깔아요'));
  });
});
