import { describe, expect, it } from 'vitest';
import { findJamo, jamoAll } from '../../../content/jamo';
import { CONFUSABLES, checkOptionIds, confusablesOf } from '../confusables';

const NON_BATCHIM = jamoAll.filter((j) => j.kind !== 'batchim');

describe('CONFUSABLES (F-QUEST-002 §3.9)', () => {
  it('has one key for each of the 24 consonants and vowels', () => {
    expect(Object.keys(CONFUSABLES)).toHaveLength(24);
    for (const j of NON_BATCHIM) expect(CONFUSABLES[j.char], j.char).toBeDefined();
  });

  it('keeps three same-kind distractors per key, none equal to the key, no repeats', () => {
    for (const j of NON_BATCHIM) {
      const list = CONFUSABLES[j.char]!;
      expect(list, j.char).toHaveLength(3);
      expect(new Set(list).size).toBe(3);
      for (const ch of list) {
        expect(ch).not.toBe(j.char);
        const other = NON_BATCHIM.find((x) => x.char === ch);
        expect(other, `${j.char} -> ${ch}`).toBeDefined();
        expect(other!.kind).toBe(j.kind);
      }
    }
  });

  it('keeps the spec order for a few well-known pairs', () => {
    expect(CONFUSABLES['ㄱ']).toEqual(['ㅋ', 'ㄴ', 'ㄷ']);
    expect(CONFUSABLES['ㅋ']).toEqual(['ㄱ', 'ㅌ', 'ㅍ']);
    expect(CONFUSABLES['ㅡ']).toEqual(['ㅜ', 'ㅣ', 'ㅓ']);
    expect(CONFUSABLES['ㅜ']).toEqual(['ㅗ', 'ㅡ', 'ㅠ']);
    expect(CONFUSABLES['ㅣ']).toEqual(['ㅡ', 'ㅏ', 'ㅓ']);
  });
});

describe('confusablesOf', () => {
  it('returns jamo ids in the spec order', () => {
    expect(confusablesOf('jamo:giyeok')).toEqual(['jamo:kieuk', 'jamo:nieun', 'jamo:digeut']);
  });

  it('returns an empty list for a batchim or an unknown id', () => {
    expect(confusablesOf('jamo:giyeok-batchim')).toEqual([]);
    expect(confusablesOf('jamo:nope')).toEqual([]);
  });
});

describe('checkOptionIds', () => {
  const taughtTo4 = ['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun'];

  it('starts with the target and keeps the confusable order among taught symbols', () => {
    const taught = [...taughtTo4, 'jamo:o', 'jamo:u', 'jamo:mieum', 'jamo:ieung'];
    // ㅜ -> ㅗ ㅡ ㅠ ; only ㅗ is taught, so ㅏ ㅓ pad the list (jamo order)
    expect(checkOptionIds('jamo:u', taught)).toEqual(['jamo:u', 'jamo:o', 'jamo:a', 'jamo:eo']);
  });

  it('pads from the taught symbols of the same kind, in jamo order', () => {
    const taught = ['jamo:a', 'jamo:eo', 'jamo:o', 'jamo:u', 'jamo:eu', 'jamo:i'];
    // ㅡ -> ㅜ ㅣ ㅓ are all taught: no padding needed
    expect(checkOptionIds('jamo:eu', taught)).toEqual(['jamo:eu', 'jamo:u', 'jamo:i', 'jamo:eo']);
    // ㅏ -> ㅓ ㅑ ㅣ ; only ㅓ ㅣ taught, pad with the next taught vowel (ㅗ)
    expect(checkOptionIds('jamo:a', taught)).toEqual(['jamo:a', 'jamo:eo', 'jamo:i', 'jamo:o']);
  });

  it('never mixes kinds', () => {
    const ids = checkOptionIds('jamo:giyeok', [...taughtTo4, 'jamo:kieuk']);
    for (const id of ids) expect(findJamo(id)!.kind).toBe('consonant');
  });

  it('gives only two options when only two symbols of that kind are taught', () => {
    expect(checkOptionIds('jamo:eo', taughtTo4)).toEqual(['jamo:eo', 'jamo:a']);
  });

  it('ignores the target when it appears in the taught list and repeats nothing', () => {
    const ids = checkOptionIds('jamo:giyeok', ['jamo:giyeok', 'jamo:nieun', 'jamo:nieun', 'jamo:digeut']);
    expect(ids).toEqual(['jamo:giyeok', 'jamo:nieun', 'jamo:digeut']);
  });

  it('honours a smaller size', () => {
    expect(checkOptionIds('jamo:giyeok', [...taughtTo4, 'jamo:digeut'], { size: 2 })).toEqual([
      'jamo:giyeok',
      'jamo:nieun',
    ]);
  });

  it('throws when fewer than two options are possible', () => {
    expect(() => checkOptionIds('jamo:giyeok', ['jamo:a', 'jamo:eo'])).toThrow(/two options/);
  });

  it('throws for a target that has no confusable list', () => {
    expect(() => checkOptionIds('jamo:giyeok-batchim', taughtTo4)).toThrow(/confusable/);
    expect(() => checkOptionIds('jamo:nope', taughtTo4)).toThrow(/confusable/);
  });
});
