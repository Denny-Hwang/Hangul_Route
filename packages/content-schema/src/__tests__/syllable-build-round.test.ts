import { describe, expect, it } from 'vitest';
import { FINAL_JAMO, REPRESENTATIVE_FINALS, RoundSchema, SyllableBuildRoundSchema, blockParts, finalSoundOf, isOneLetterFinal, romanize, syllableBuildIssues } from '../index';

/**
 * F-CURR-002 section 7.1 F3, row CM-32 (design/wireframes/minigame/syllable-build.md): the `syllable-build` round of
 * `RoundSchema`, its parts and the `syllable-build-final-distinct` rule (a heard round never offers two finals that
 * sound the same, and only the seven final sounds, except the target's own with its meaning shown).
 */
const bap = {
  id: 'sb:bap',
  target: { ko: '밥', romanization: romanize('밥').text, en: 'rice, a meal' },
  firstTiles: ['ㄱ', 'ㅂ', 'ㅁ', 'ㄷ'],
  vowelTiles: ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ'],
  finalTiles: ['ㅂ', 'ㄴ', 'ㅇ'],
};
const messages = (round: unknown): string[] => {
  const r = SyllableBuildRoundSchema.safeParse(round);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('SyllableBuildRoundSchema (row CM-32)', () => {
  it('accepts the wireframe round (밥 with ㅂ ㄴ ㅇ and No final) and takes its place in RoundSchema', () => {
    expect(messages(bap)).toEqual([]);
    expect(RoundSchema.safeParse({ kind: 'syllable-build', data: bap }).success).toBe(true);
    expect(bap.target.romanization).toBe('bap');
  });

  it('a block that is not a word carries no meaning, so no meaning line is shown', () => {
    expect(messages({ ...bap, target: { ko: '가', romanization: 'ga' }, finalTiles: ['ㄴ', 'ㅇ'] })).toEqual([]);
  });

  it('the target is one block whose parts are tiles of their rows', () => {
    const notOne = 'the target is one block with a one-letter final or none';
    expect(messages({ ...bap, target: { ko: '밥밥', romanization: 'bapbap' } })).toContain(notOne);
    expect(messages({ ...bap, target: { ko: 'ㅂ', romanization: 'b' } })).toContain(notOne);
    expect(messages({ ...bap, target: { ko: '닭', romanization: 'dak', en: 'chicken' } })).toContain(notOne);
    expect(messages({ ...bap, firstTiles: ['ㄱ', 'ㄴ', 'ㅁ'] })).toContain("the target's ㅂ is not a tile");
    expect(messages({ ...bap, vowelTiles: ['ㅓ', 'ㅗ', 'ㅜ'] })).toContain("the target's ㅏ is not a tile");
    expect(messages({ ...bap, finalTiles: ['ㄴ', 'ㅇ'] })).toEqual(["the target's ㅂ is not a tile"]);
  });

  it('each row holds letters of its kind, once, in its size', () => {
    expect(messages({ ...bap, firstTiles: ['ㄱ', 'ㅂ', 'ㅏ'] })).toContain('ㅏ is not a letter of this row');
    expect(messages({ ...bap, vowelTiles: ['ㅏ', 'ㅓ', 'ㄱ'] })).toContain('ㄱ is not a letter of this row');
    expect(messages({ ...bap, finalTiles: ['ㅂ', 'ㄸ'] })).toContain('ㄸ is not a letter of this row');
    expect(messages({ ...bap, finalTiles: ['ㅂ', 'ㄺ'] })).toContain('ㄺ is not a letter of this row');
    expect(messages({ ...bap, firstTiles: ['ㅂ', 'ㅂ', 'ㄱ'] })).toContain('a tile is listed once in its row');
    expect(SyllableBuildRoundSchema.safeParse({ ...bap, firstTiles: ['ㅂ', 'ㄱ'] }).success).toBe(false);
    expect(SyllableBuildRoundSchema.safeParse({ ...bap, finalTiles: ['ㅂ', 'ㄴ', 'ㅇ', 'ㄹ'] }).success).toBe(false);
  });

  it('syllable-build-final-distinct: never two finals with the same sound (밥 never offers ㅂ and ㅍ)', () => {
    expect(messages({ ...bap, finalTiles: ['ㅂ', 'ㅍ'] })).toEqual(['syllable-build-final-distinct: ㅍ is heard as ㅂ']);
    expect(messages({ ...bap, finalTiles: ['ㅂ', 'ㄴ', 'ㄴ'] }).length).toBeGreaterThan(0);
    expect(messages({ ...bap, target: { ko: '낫', romanization: 'nat', en: 'sickle' }, firstTiles: ['ㄴ', 'ㄱ', 'ㅁ'], finalTiles: ['ㅅ', 'ㄷ'] }).length).toBeGreaterThan(0);
  });

  it('syllable-build-final-distinct: a final outside the seven sounds only as the target own, with its meaning shown', () => {
    const but = { ...bap, target: { ko: '붓', romanization: 'but', en: 'writing brush' }, vowelTiles: ['ㅜ', 'ㅏ', 'ㅗ'], finalTiles: ['ㅅ', 'ㄴ', 'ㅇ'] };
    expect(messages(but)).toEqual([]);
    const noMeaning = { ...but, target: { ko: '붓', romanization: 'but' } };
    expect(messages(noMeaning).some((m) => m.includes('ㅅ is heard as ㄷ'))).toBe(true);
    expect(messages({ ...bap, finalTiles: ['ㅂ', 'ㅅ'] }).some((m) => m.includes('ㅅ is heard as ㄷ'))).toBe(true);
  });

  it('a fixed final zone needs a final', () => {
    expect(messages({ ...bap, fixedZone: 'final' })).toEqual([]);
    expect(messages({ ...bap, target: { ko: '바', romanization: 'ba' }, fixedZone: 'final' })).toContain('a fixed final zone needs a final');
    expect(SyllableBuildRoundSchema.safeParse({ ...bap, fixedZone: 'middle' }).success).toBe(false);
  });
});

describe('block parts and final sounds', () => {
  it('splits a block into first letter, vowel and final', () => {
    expect(blockParts('밥')).toEqual({ first: 'ㅂ', vowel: 'ㅏ', final: 'ㅂ' });
    expect(blockParts('아')).toEqual({ first: 'ㅇ', vowel: 'ㅏ', final: null });
    expect(blockParts('왜')).toEqual({ first: 'ㅇ', vowel: 'ㅙ', final: null });
    expect(blockParts('닭')).toBeNull();
    expect(blockParts('ab')).toBeNull();
  });

  it('every one-letter final has one of the seven sounds; a two-letter final is not one', () => {
    const one = FINAL_JAMO.filter(isOneLetterFinal);
    expect(one).toHaveLength(16);
    for (const f of one) expect(REPRESENTATIVE_FINALS, f).toContain(finalSoundOf(f));
    for (const f of ['ㄳ', 'ㄺ', 'ㅄ', '', 'ㄸ']) expect(isOneLetterFinal(f), f).toBe(false);
    expect(finalSoundOf('ㅍ')).toBe('ㅂ');
    expect(finalSoundOf('ㅅ')).toBe('ㄷ');
    expect(finalSoundOf('ㅏ')).toBeUndefined();
    expect(finalSoundOf('ㄱㄴ')).toBeUndefined();
  });

  it('syllableBuildIssues reads plain objects too (the review and sprint rounds the app builds)', () => {
    expect(syllableBuildIssues({ target: { ko: '산' }, firstTiles: ['ㅅ', 'ㄱ', 'ㅂ'], vowelTiles: ['ㅏ', 'ㅓ', 'ㅗ'], finalTiles: ['ㄴ', 'ㅁ'] })).toEqual([]);
  });
});
