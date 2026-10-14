import { describe, expect, it } from 'vitest';
import {
  ALLOMORPH_PAIRS,
  BACKSPACE,
  JAMO_SOUND_VALUES,
  MEDIAL_JAMO,
  MEDIAL_RR,
  SINGLE_FORMS,
  SLOT_MARKER,
  allomorph,
  allomorphOrBoth,
  checkJamoRomanization,
  composeTyped,
  endsWithFinal,
  fillFrame,
  keysFor,
  slotEndingIssues,
} from '../index';

const keys = (s: string) => [...s];

describe('composeTyped (two-set keyboard, F-CURR-001 §3.7)', () => {
  it('lists the 21 medials in Unicode order', () => {
    expect(MEDIAL_JAMO).toHaveLength(MEDIAL_RR.length);
    expect(MEDIAL_JAMO.map((m) => m.charCodeAt(0) - 'ㅏ'.charCodeAt(0))).toEqual([...Array(21).keys()]);
  });

  it('composes every syllable shape: CV, CVC, joined vowels, double finals, tense initials', () => {
    expect(composeTyped(keys('ㄱㅏ'))).toBe('가');
    expect(composeTyped(keys('ㅎㅏㄴ'))).toBe('한');
    expect(composeTyped(keys('ㄱㅗㅏ'))).toBe('과');
    expect(composeTyped(keys('ㅇㅜㅔ'))).toBe('웨');
    expect(composeTyped(keys('ㅇㅡㅣ'))).toBe('의');
    expect(composeTyped(keys('ㄷㅏㄹㄱ'))).toBe('닭');
    expect(composeTyped(keys('ㄱㅏㅂㅅ'))).toBe('값');
    expect(composeTyped(keys('ㄲㅗㅊ'))).toBe('꽃');
    expect(composeTyped(keys('ㄷㅗㅐㅈㅣ'))).toBe('돼지');
  });

  it('hands a final over to the next syllable when a vowel follows', () => {
    expect(composeTyped(keys('ㅇㅗㅅㅇㅣ'))).toBe('옷이');
    expect(composeTyped(keys('ㄱㅏㄱㅏ'))).toBe('가가');
    expect(composeTyped(keys('ㄷㅏㄹㄱㅇㅣ'))).toBe('닭이');
    // A double final splits: its first half stays, the second starts the next syllable.
    expect(composeTyped(keys('ㄱㅏㄹㄱㅗ'))).toBe('갈고');
    expect(composeTyped(keys('ㄱㅏㄱㅅㅏ'))).toBe('각사');
  });

  it('starts a new syllable when a consonant cannot be a final or cannot join', () => {
    expect(composeTyped(keys('ㅇㅏㄸㅏ'))).toBe('아따');
    expect(composeTyped(keys('ㅂㅏㄴㄱㅏ'))).toBe('반가');
    expect(composeTyped(keys('ㄷㅏㄹㄱㄷㅗ'))).toBe('닭도');
  });

  it('shows lone jamo while a syllable is incomplete', () => {
    expect(composeTyped(keys('ㄱ'))).toBe('ㄱ');
    expect(composeTyped(keys('ㄱㄴ'))).toBe('ㄱㄴ');
    expect(composeTyped(keys('ㅏ'))).toBe('ㅏ');
    expect(composeTyped(keys('ㅗㅏ'))).toBe('ㅘ');
    expect(composeTyped(keys('ㅏㅓ'))).toBe('ㅏㅓ');
    expect(composeTyped(keys('ㅏㄱ'))).toBe('ㅏㄱ');
    expect(composeTyped(keys('ㄱㅏㅓ'))).toBe('가ㅓ');
    expect(composeTyped([])).toBe('');
  });

  it('passes spaces and other characters through and closes the syllable', () => {
    expect(composeTyped(keys('ㄱㅣㅁㅂㅏㅂ ㅎㅏㄴㅏ'))).toBe('김밥 하나');
    expect(composeTyped(keys('ㄴㅔ?'))).toBe('네?');
  });

  it('deletes by jamo: backspace drops the last key and composes again', () => {
    expect(composeTyped([...keys('ㄱㅗㅏ'), BACKSPACE])).toBe('고');
    expect(composeTyped([...keys('ㄷㅏㄹㄱ'), BACKSPACE])).toBe('달');
    expect(composeTyped([...keys('ㄱㅏㄱㅏ'), BACKSPACE])).toBe('각');
    expect(composeTyped([...keys('ㄱㅏ'), BACKSPACE, BACKSPACE, BACKSPACE])).toBe('');
    expect(composeTyped([...keys('ㄱㅏ'), BACKSPACE, 'ㅗ'])).toBe('고');
  });

  it('keysFor splits joined vowels and double finals into their keys', () => {
    expect(keysFor('닭')).toEqual(['ㄷ', 'ㅏ', 'ㄹ', 'ㄱ']);
    expect(keysFor('왜')).toEqual(['ㅇ', 'ㅗ', 'ㅐ']);
    expect(keysFor('까 a')).toEqual(['ㄲ', 'ㅏ', ' ', 'a']);
  });

  it('round-trips every syllable block, alone and after each other', () => {
    for (let code = 0xac00; code <= 0xd7a3; code += 1) {
      const ch = String.fromCharCode(code);
      expect(composeTyped(keysFor(ch))).toBe(ch);
    }
    // A seeded sample of pairs and triples (every final against every next initial is covered by the stride).
    let seed = 7;
    const next = () => (seed = (seed * 48271) % 2147483647);
    for (let i = 0; i < 20000; i += 1) {
      const text = [next(), next(), next()].map((n) => String.fromCharCode(0xac00 + (n % 11172))).join('');
      expect(composeTyped(keysFor(text))).toBe(text);
    }
  });
});

describe('allomorph and fillFrame (F-CURR-001 §3.7)', () => {
  it('reads the batchim of the last syllable', () => {
    expect(endsWithFinal('책')).toBe(true);
    expect(endsWithFinal('학교')).toBe(false);
    expect(endsWithFinal('ABC')).toBeNull();
    expect(endsWithFinal('')).toBeNull();
  });

  it('picks the form that fits the word, for every pair', () => {
    expect(ALLOMORPH_PAIRS).toContain('이에요/예요');
    const cases: Array<[string, string, string]> = [
      ['책', '이/가', '이'],
      ['친구', '이/가', '가'],
      ['밥', '을/를', '을'],
      ['우유', '을/를', '를'],
      ['저', '은/는', '는'],
      ['이름', '은/는', '은'],
      ['책', '이에요/예요', '이에요'],
      ['학교', '이에요/예요', '예요'],
      ['떡', '과/와', '과'],
      ['사과', '과/와', '와'],
      ['밥', '이었어요/였어요', '이었어요'],
      ['비', '이었어요/였어요', '였어요'],
      ['빵', '이랑/랑', '이랑'],
      ['우유', '이랑/랑', '랑'],
      ['집', '으로/로', '으로'],
      ['학교', '으로/로', '로'],
      ['서울', '으로/로', '로'],
      ['민준', '아/야', '아'],
      ['호야', '아/야', '야'],
    ];
    for (const [word, pair, form] of cases) expect(allomorph(word, pair), `${word} ${pair}`).toBe(form);
  });

  it('returns a single form as it is', () => {
    expect(allomorph('학교', '에')).toBe('에');
    expect(allomorph('anything', '하고')).toBe('하고');
  });

  it('throws on an unknown pair or a word without a final syllable block', () => {
    expect(() => allomorph('책', '를/을')).toThrow('unknown allomorph pair');
    expect(() => allomorph('ABC', '이/가')).toThrow('does not end in a Hangul syllable block');
  });

  it('fills each slot and its ending, so the sentence is always correct Korean', () => {
    expect(fillFrame('저는 ___을/를 좋아해요', ['사과'])).toBe('저는 사과를 좋아해요');
    expect(fillFrame('저는 ___을/를 좋아해요', ['떡'])).toBe('저는 떡을 좋아해요');
    expect(fillFrame('제가 좋아하는 날은 ___이에요/예요', ['설날'])).toBe('제가 좋아하는 날은 설날이에요');
    expect(fillFrame('제가 좋아하는 날은 ___이에요/예요', ['추석'])).toBe('제가 좋아하는 날은 추석이에요');
    expect(fillFrame('제가 좋아하는 동물은 ___이에요/예요', ['호랑이'])).toBe('제가 좋아하는 동물은 호랑이예요');
    expect(fillFrame('오늘 ___에 가요', ['학교'])).toBe('오늘 학교에 가요');
    expect(fillFrame('___에 ___을/를 먹었어요', ['설날', '떡국'])).toBe('설날에 떡국을 먹었어요');
    expect(fillFrame('___ 좋아요', ['네'])).toBe('네 좋아요');
  });

  it('throws when the picks do not match the slots', () => {
    expect(() => fillFrame('저는 ___을/를 좋아해요', [])).toThrow('1 slot(s) but 0 pick(s)');
  });

  it('allomorphOrBoth never throws on a half-typed word (Write Your Name free entry)', () => {
    expect(allomorphOrBoth('민준', '이에요/예요')).toBe('이에요');
    expect(allomorphOrBoth('호야', '이에요/예요')).toBe('예요');
    expect(allomorphOrBoth('민ㅈ', '이에요/예요')).toBe('이에요/예요');
    expect(allomorphOrBoth('', '을/를')).toBe('을/를');
    expect(allomorphOrBoth('ㅎ', '에')).toBe('에');
    expect(() => allomorphOrBoth('책', '를/을')).toThrow('unknown allomorph pair');
  });

  it('slotEndingIssues accepts known pairs, single forms and a bare slot', () => {
    expect(SINGLE_FORMS).toContain('에');
    for (const frame of ['저는 ___을/를 좋아해요', '___에 ___을/를 먹었어요', '제 이름은 ___이에요/예요.', '___ 좋아요', '___', '___하고 ___?']) {
      expect(slotEndingIssues(frame), frame).toEqual([]);
    }
  });

  it('slotEndingIssues flags a reversed pair, an unknown ending and a missing space', () => {
    expect(slotEndingIssues('저는 ___를/을 좋아해요')[0]).toContain('"를/을"');
    expect(slotEndingIssues('저는 ___좋아해요')[0]).toContain('"좋아해요"');
    expect(slotEndingIssues('___에 ___을/를먹었어요')).toEqual(['slot 2: "을/를먹었어요" after ___ is not a known particle or ending pair']);
    expect(slotEndingIssues('___을/를x')).toEqual(['slot 1: the ending after ___ runs into the next word']);
  });

  it('uses the same slot marker as the quest schema', () => {
    expect(SLOT_MARKER).toBe('___');
  });
});

describe('JAMO_SOUND_VALUES on the two-set keyboard (F-CURR-001 §3.7, type-hangul.md open question 1)', () => {
  it('lists the nine letters only a keyboard key shows, with their Revised Romanization values', () => {
    const typedOnly: Record<string, string> = {
      'ㄲ': 'kk', 'ㄸ': 'tt', 'ㅃ': 'pp', 'ㅆ': 'ss', 'ㅉ': 'jj', 'ㅐ': 'ae', 'ㅔ': 'e', 'ㅒ': 'yae', 'ㅖ': 'ye',
    };
    for (const [char, value] of Object.entries(typedOnly)) {
      expect(JAMO_SOUND_VALUES[char], char).toEqual([value]);
      expect(checkJamoRomanization(char, value), char).toEqual([]);
    }
  });

  it('keeps the 24 basic letters as they were', () => {
    expect(JAMO_SOUND_VALUES['ㄱ']).toEqual(['g/k', 'k']);
    expect(JAMO_SOUND_VALUES['ㅇ']).toEqual(['silent/ng', 'ng']);
    expect(Object.keys(JAMO_SOUND_VALUES)).toHaveLength(33);
  });
});
