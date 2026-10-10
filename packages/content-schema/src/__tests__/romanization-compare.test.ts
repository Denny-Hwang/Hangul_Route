import { describe, expect, it } from 'vitest';
import {
  JAMO_NAME_VALUES,
  JAMO_SOUND_VALUES,
  ROMANIZATION_EXCEPTIONS,
  a11yRomanization,
  checkConsistency,
  checkExceptions,
  checkJamoRomanization,
  checkProse,
  checkRomanization,
  normalizeRomanization,
  type RomanizationException,
} from '../index';

const rules = (ko: string, given: string, exceptions?: readonly RomanizationException[]): string[] =>
  checkRomanization(ko, given, exceptions ? { exceptions } : undefined).map((i) => i.rule);

describe('normalizeRomanization', () => {
  it('lower-cases, removes apostrophes, strips punctuation and quotes, collapses whitespace', () => {
    expect(normalizeRomanization("  Geo-ui!  Da   Hae'sseo… ")).toBe('geo-ui da haesseo');
    expect(normalizeRomanization('“Jal”, ‘meogeosseoyo’? ·~.')).toBe('jal meogeosseoyo');
    expect(normalizeRomanization('Han’geul')).toBe('hangeul');
  });

  it('normalises to NFC', () => {
    expect(normalizeRomanization('é')).toBe('é');
  });
});

describe('checkRomanization', () => {
  it('passes a correct romanization (case, punctuation and spacing in the value are free)', () => {
    expect(checkRomanization('윷놀이', 'yunnori')).toEqual([]);
    expect(checkRomanization('서울', 'Seoul')).toEqual([]);
    expect(checkRomanization('거의 다 했어!', 'Geoui da haesseo')).toEqual([]);
  });

  it('R1: reports the Revised Romanization on a mismatch', () => {
    const [found, ...rest] = checkRomanization('윷놀이', 'yutnori');
    expect(rest).toEqual([]);
    expect(found).toMatchObject({
      rule: 'romanization-mismatch',
      severity: 'error',
      ko: '윷놀이',
      given: 'yutnori',
      message: '윷놀이: given "yutnori", Revised Romanization is "yunnori"',
    });
  });

  it('R1: the known audit strings fail with the right suggestion', () => {
    const msg = (ko: string, given: string): string | undefined => checkRomanization(ko, given)[0]?.message;
    expect(msg('한글날', 'hangeulnal')).toContain('"hangeullal"');
    expect(msg('케이팝', 'kpop')).toContain('"keipap"');
    expect(msg('금속활자', 'geumsokwalja')).toContain('"geumsokhwalja"');
  });

  it('R2: a hyphenated but correct value gives exactly one finding', () => {
    const found = checkRomanization('강아지', 'gang-a-ji');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      rule: 'romanization-hyphen',
      severity: 'error',
      message: 'gang-a-ji: remove hyphens → "gangaji"',
    });
  });

  it('R2 and R1 both fire for a hyphenated wrong value', () => {
    expect(rules('윷놀이', 'yut-no-ri')).toEqual(['romanization-hyphen', 'romanization-mismatch']);
  });

  it('R3: the number of words must match the Korean', () => {
    const found = checkRomanization('손 씻기', 'sonssitgi');
    expect(found.map((f) => f.rule)).toEqual(['romanization-spacing']);
    expect(found[0]?.message).toBe('손 씻기 / sonssitgi: 2 Korean words, 1 romanized');
    expect(checkRomanization('가족식탁', 'gajok siktak')[0]?.message).toBe(
      '가족식탁 / gajok siktak: 1 Korean word, 2 romanized',
    );
    expect(rules('가족 식탁', 'gajok siktak')).toEqual([]);
  });

  it('R4: an empty romanization is missing', () => {
    expect(checkRomanization('손 씻기', '  ')).toEqual([
      {
        rule: 'romanization-missing',
        severity: 'error',
        message: '손 씻기: romanization is missing',
        ko: '손 씻기',
        given: '  ',
      },
    ]);
    expect(rules('가', '?!')).toEqual(['romanization-missing']);
  });

  it('reports "unchecked" (a warning, never a false mismatch) when the Korean cannot be read by rule', () => {
    const found = checkRomanization('Build 가', 'build ga');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ rule: 'romanization-unchecked', severity: 'warning' });
    expect(rules('ㄱ', 'g')).toEqual(['romanization-unchecked']);
  });

  it('known limits are mismatches until an exception allows them', () => {
    expect(rules('꽃잎', 'kkonnip')).toEqual(['romanization-mismatch']);
    expect(rules('솔잎', 'sollip')).toEqual(['romanization-mismatch']);
    expect(rules('밟다', 'bapda')).toEqual(['romanization-mismatch']);
    const exceptions: RomanizationException[] = [{ ko: '꽃잎', allowed: ['kkonnip'], reason: 'n-insertion' }];
    expect(rules('꽃잎', 'kkonnip', exceptions)).toEqual([]);
    expect(rules('꽃잎', 'KKonnip', exceptions)).toEqual([]);
    expect(rules('꽃잎', 'kkochip', exceptions)).toEqual([]);
    expect(rules('꽃잎', 'kkotnip', exceptions)).toEqual(['romanization-mismatch']);
    expect(rules('솔잎', 'sollip', exceptions)).toEqual(['romanization-mismatch']);
  });

  it('the shipped exception list is empty', () => {
    expect(ROMANIZATION_EXCEPTIONS).toEqual([]);
  });
});

describe('checkExceptions (R8)', () => {
  const ok: RomanizationException = { ko: '꽃잎', allowed: ['kkonnip'], reason: 'n-insertion' };

  it('passes an exception with a reason that matches a source', () => {
    expect(checkExceptions([ok], ['꽃잎', '밥'])).toEqual([]);
    expect(checkExceptions([], [])).toEqual([]);
  });

  it('fails an exception that matches nothing', () => {
    const found = checkExceptions([ok], ['밥']);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ rule: 'romanization-exception-stale', message: 'exception 꽃잎 matched no source' });
  });

  it('fails an exception with no reason', () => {
    const found = checkExceptions([{ ...ok, reason: '  ' }], ['꽃잎']);
    expect(found.map((f) => f.message)).toEqual(['exception 꽃잎 has no reason']);
  });
});

describe('checkConsistency (R5)', () => {
  const entry = (ko: string, romanization: string, where: string) => ({ ko, romanization, where });

  it('reports one finding when the same Korean is spelled differently', () => {
    const found = checkConsistency([
      entry('호랑이', 'horangi', 'heritage-cards.ts:94'),
      entry('호랑이', 'ho-rang-i', 'cards.json:175'),
      entry('호랑이', 'horani', 'other.ts:1'),
      entry('호랑이', 'horangi', 'later.ts:2'),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      rule: 'romanization-inconsistent',
      message: '호랑이: "horangi" (heritage-cards.ts:94) vs "ho-rang-i" (cards.json:175)',
    });
  });

  it('passes spellings that differ only by case or punctuation, and distinct words', () => {
    expect(
      checkConsistency([
        entry('서울', 'Seoul', 'a'),
        entry('서울', 'seoul', 'b'),
        entry('밥', 'bap', 'a'),
        entry('물', 'mul', 'a'),
      ]),
    ).toEqual([]);
  });
});

describe('checkProse (R6)', () => {
  it('flags the syllable-hyphenated form of a registered word', () => {
    const found = checkProse('A friendly gang-a-ji barks.', ['강아지', '밥']);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      rule: 'romanization-prose',
      severity: 'error',
      message: '"gang-a-ji" in prose (use "gangaji")',
    });
  });

  it('is case-insensitive and respects word boundaries', () => {
    expect(checkProse('Gang-a-ji!', ['강아지'])).toHaveLength(1);
    expect(checkProse('our gang-a-jis', ['강아지'])).toEqual([]);
    expect(checkProse('big-gang-a-ji', ['강아지'])).toEqual([]);
  });

  it('ignores unregistered hyphenated English and single-syllable words', () => {
    expect(checkProse('left-to-right and half-moon', ['강아지'])).toEqual([]);
    expect(checkProse('a ba-p', ['밥'])).toEqual([]);
    expect(checkProse('x', ['abc'])).toEqual([]);
  });

  it('flags `romanized (한글)` and `한글 (romanized)` pairs that fail R1 or R2', () => {
    const before = checkProse('We play yutnori (윷놀이) today.', []);
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({ rule: 'romanization-prose', ko: '윷놀이', given: 'yutnori' });
    expect(before[0]?.message).toContain('Revised Romanization is "yunnori"');
    const after = checkProse('윷놀이 (yut-no-ri) is a game.', []);
    expect(after).toHaveLength(1);
    expect(after[0]?.message).toContain('remove hyphens');
  });

  it('accepts correct pairs and does not double-report a pair and its registry word', () => {
    expect(checkProse('We play yunnori (윷놀이) today.', ['윷놀이'])).toEqual([]);
    expect(checkProse('gang-a-ji (강아지)', ['강아지'])).toHaveLength(1);
  });

  it('pair failures other than R1 and R2 are not prose findings', () => {
    expect(checkProse('손 씻기 (sonssitgi)', [])).toEqual([]);
  });
});

describe('checkJamoRomanization (R7)', () => {
  it('accepts every listed sound value', () => {
    for (const [char, values] of Object.entries(JAMO_SOUND_VALUES)) {
      for (const value of values) expect(checkJamoRomanization(char, value)).toEqual([]);
    }
  });

  it('accepts a standard name suffix and tolerates spacing around it', () => {
    expect(checkJamoRomanization('ㄱ', 'g/k (giyeok)')).toEqual([]);
    expect(checkJamoRomanization('ㅇ', 'silent/ng  ( ieung )')).toEqual([]);
    for (const [char, name] of Object.entries(JAMO_NAME_VALUES)) {
      expect(checkJamoRomanization(char, `${JAMO_SOUND_VALUES[char]?.[0]} (${name})`)).toEqual([]);
    }
  });

  it('rejects an unlisted value', () => {
    const found = checkJamoRomanization('ㅇ', '∅/ng');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ rule: 'jamo-value-unknown', severity: 'error' });
    expect(found[0]?.message).toBe('ㅇ: "∅/ng" is not a listed value (silent/ng, ng)');
    expect(checkJamoRomanization('ㅇ', 'silent / ng (ieung)')).toHaveLength(1);
  });

  it('rejects a wrong name suffix and a name on a vowel', () => {
    const wrong = checkJamoRomanization('ㄱ', 'g/k (gieok)');
    expect(wrong).toHaveLength(1);
    expect(wrong[0]?.message).toBe('ㄱ: "gieok" is not the standard letter name');
    expect(checkJamoRomanization('ㅏ', 'a (a)')).toHaveLength(1);
  });

  it('rejects a character that is not a listed jamo', () => {
    expect(checkJamoRomanization('가', 'ga')[0]?.message).toBe('가: not a listed jamo');
    expect(checkJamoRomanization('constructor', 'x')).toHaveLength(1);
  });
});

describe('a11yRomanization', () => {
  it('reads a slash as "or"', () => {
    expect(a11yRomanization('silent/ng')).toBe('silent or ng');
    expect(a11yRomanization('g/k')).toBe('g or k');
    expect(a11yRomanization('silent / ng')).toBe('silent or ng');
  });

  it('leaves values without a slash alone', () => {
    expect(a11yRomanization('eo')).toBe('eo');
    expect(a11yRomanization('')).toBe('');
  });
});
