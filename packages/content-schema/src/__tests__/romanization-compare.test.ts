import { describe, expect, it } from 'vitest';
import {
  JAMO_SOUND_VALUES,
  ROMANIZATION_EXCEPTIONS,
  a11yRomanization,
  romanizeWord,
  type RomanizationException,
} from '../index';
import {
  JAMO_NAME_VALUES,
  checkConsistency,
  checkExceptions,
  checkFrameRomanization,
  checkJamoRomanization,
  checkProse,
  checkRomanization,
  entryWithNote,
  normalizeRomanization,
  type ExceptionEntry,
  type RomanizationGap,
} from '../romanization/lint';

const rules = (ko: string, given: string, exceptions?: readonly ExceptionEntry[]): string[] =>
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

  it('R3 in a frame: a sentence mark right after a slot belongs to the slot, not to the next word (CM-45 S3)', () => {
    expect(checkFrameRomanization('___, 새해 복 많이 받으세요.', '___, saehae bok mani badeuseyo')).toEqual([]);
    expect(checkFrameRomanization('저는 ___을/를 좋아해요.', 'jeoneun ___eul/reul joahaeyo')).toEqual([]);
    expect(checkFrameRomanization('___, 새해 복 많이 받으세요.', '___, saehae bongmani badeuseyo').map((i) => i.rule)).toEqual([
      'romanization-spacing',
      'romanization-mismatch',
    ]);
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

  it('an entry replaces the converter value: the entry value passes, the converter value fails (R1 compares with the reviewed value)', () => {
    const exceptions: RomanizationException[] = [{ ko: '꽃잎', allowed: ['kkonnip'], reason: 'n-insertion (표준 발음법 제29항)', gap: 'n-insertion' }];
    expect(rules('꽃잎', 'kkonnip', exceptions)).toEqual([]);
    expect(rules('꽃잎', 'KKonnip', exceptions)).toEqual([]);
    expect(rules('꽃잎', 'kkochip', exceptions)).toEqual(['romanization-mismatch']);
    expect(rules('꽃잎', 'kkotnip', exceptions)).toEqual(['romanization-mismatch']);
    // A word entry applies inside a sentence too.
    expect(rules('꽃잎 예뻐요', 'kkonnip yeppeoyo', exceptions)).toEqual([]);
    expect(rules('꽃잎 예뻐요', 'kkochip yeppeoyo', exceptions)).toEqual(['romanization-mismatch']);
  });

  it('a whole-string entry keeps its alternates', () => {
    const exceptions: RomanizationException[] = [
      { ko: '꽃잎 한 장', allowed: ['kkonnip han jang', 'kkochip han jang'], reason: '표준 발음법 제29항', gap: 'n-insertion' },
    ];
    expect(rules('꽃잎 한 장', 'kkonnip han jang', exceptions)).toEqual([]);
    expect(rules('꽃잎 한 장', 'kkochip han jang', exceptions)).toEqual([]);
    expect(rules('꽃잎 한 장', 'kkotnip han jang', exceptions)).toEqual(['romanization-mismatch']);
  });

  it('with no ctx the shipped list applies; { exceptions: [] } means none', () => {
    expect(checkRomanization('솔잎', 'sollip')).toEqual([]);
    expect(checkRomanization('솔잎', 'sorip')[0]?.rule).toBe('romanization-mismatch');
    expect(checkRomanization('솔잎', 'sollip', {})).toEqual([]);
    expect(rules('솔잎', 'sollip', [])).toEqual(['romanization-mismatch']);
    expect(rules('솔잎', 'sorip', [])).toEqual(['romanization-gap']);
  });

  it('every shipped entry fails without the list (a confirmation only for the detector) and passes with it', () => {
    expect(ROMANIZATION_EXCEPTIONS.length).toBeGreaterThan(0);
    for (const e of ROMANIZATION_EXCEPTIONS.map(entryWithNote)) {
      expect(e.reason.trim(), e.ko).not.toBe('');
      const without = rules(e.ko, e.allowed[0] ?? '', []);
      if (e.reason.includes('the entry only confirms')) {
        // A confirmation (북한산): the converter was right, the entry clears the detector.
        expect(without, e.ko).toEqual(['romanization-gap']);
      } else {
        expect(without, e.ko).toContain('romanization-mismatch');
      }
      expect(rules(e.ko, e.allowed[0] ?? '', ROMANIZATION_EXCEPTIONS), e.ko).toEqual([]);
    }
  });
});

describe('R9 romanization-gap (AMENDMENTS-ROMANIZER-GAPS §3.5, §3.8)', () => {
  const none = { exceptions: [] as RomanizationException[] };
  /** The nine words of the work order: the converter output as given, with no entry. */
  const nine: ReadonlyArray<readonly [string, string, string]> = [
    ['읽고', 'ilgo', ''],
    ['맑게', 'malge', ''],
    ['좁히다', 'jopida', ''],
    ['깻잎', 'kkaesip', 'saisiot'],
    ['색연필', 'saegyeonpil', 'n-insertion'],
    ['서울역', 'seouryeok', 'n-insertion'],
    ['맛없어요', 'maseopseoyo', 'juncture'],
    ['첫인상', 'cheosinsang', 'juncture'],
    ['못해요', 'mothaeyo', 'predicate-h'],
  ];

  it.each(nine)('%s with the converter output %s: the rule fix (RG-1) or the gap (RG-2b)', (ko, converter, gap) => {
    const found = checkRomanization(ko, converter, none);
    if (gap === '') {
      expect(found).toEqual([]);
    } else {
      expect(found.some((f) => f.rule === 'romanization-gap' && f.message.includes(`: ${gap} (`))).toBe(true);
      expect(found.every((f) => f.rule === 'romanization-gap' && f.severity === 'error')).toBe(true);
    }
  });

  const reviewed: ReadonlyArray<readonly [string, string, string, string]> = [
    ['깻잎', 'kkaennip', 'saisiot', '표준 발음법 제30항 3'],
    ['색연필', 'saengnyeonpil', 'n-insertion', '표준 발음법 제29항'],
    ['서울역', 'seoullyeok', 'n-insertion', '표준 발음법 제29항 붙임 1'],
    ['맛없어요', 'madeopseoyo', 'juncture', '표준 발음법 제15항'],
    ['첫인상', 'cheodinsang', 'juncture', '표준국어대사전 첫인상 [처딘상]'],
    ['못해요', 'motaeyo', 'predicate-h', '로마자 표기법 제3장 제1항 4, 표준 발음법 제12항 붙임 2'],
  ];

  it.each(reviewed)('%s: the correct value %s with no entry is a mismatch that carries the gap hint, with no separate R9', (ko, value, gap) => {
    const found = checkRomanization(ko, value, none);
    expect(found.map((f) => f.rule)).toEqual(['romanization-mismatch']);
    expect(found[0]?.message).toContain('converter gap:');
    expect(found[0]?.message).toContain(gap);
    expect(found[0]?.message).toContain('AMENDMENTS-ROMANIZER-GAPS');
  });

  it.each(reviewed)('%s: with its entry %s passes and the converter value fails R1', (ko, value, gap, reason) => {
    const exceptions: RomanizationException[] = [{ ko, allowed: [value], gap: gap as RomanizationGap, reason }];
    expect(checkRomanization(ko, value, { exceptions })).toEqual([]);
    expect(checkRomanization(ko, romanizeWord(ko) as string, { exceptions }).map((f) => f.rule)).toEqual(['romanization-mismatch']);
  });

  it('the 못해요 entry equals the predicate reading of the converter', () => {
    expect(romanizeWord('못해요', { predicateH: true })).toBe('motaeyo');
  });

  it('the message names the token, the rule, and the line to paste', () => {
    const [found] = checkRomanization('그건 못해요.', 'geugeon mothaeyo', none);
    expect(found).toMatchObject({ rule: 'romanization-gap', severity: 'error', ko: '그건 못해요.', given: 'geugeon mothaeyo' });
    expect(found?.message).toBe(
      "못해요: predicate-h (로마자 표기법 제3장 제1항 4, 표준 발음법 제12항 붙임 2); the converter cannot tell. Check 표준국어대사전 and add { ko: '못해요', allowed: ['…'] } to ROMANIZATION_EXCEPTIONS (exceptions.ts) and { gap: 'predicate-h', reason: '…' } under '못해요' to ROMANIZATION_EXCEPTION_NOTES (exception-notes.ts)",
    );
  });

  it('a covering word entry or whole-string entry clears the detector, and a confirmation passes', () => {
    const word: RomanizationException = { ko: '북한산', allowed: ['bukhansan'], gap: 'predicate-h', reason: 'a noun (체언), 제3장 제1항 4 다만' };
    expect(rules('북한산', 'bukhansan', [word])).toEqual([]);
    expect(rules('북한산에 가요.', 'bukhansane gayo', [word])).toEqual(['romanization-gap']);
    const whole: RomanizationException = { ko: '북한산에 가요.', allowed: ['bukhansane gayo'], gap: 'predicate-h', reason: 'a noun (체언), 제3장 제1항 4 다만' };
    expect(rules('북한산에 가요.', 'bukhansane gayo', [whole])).toEqual([]);
    expect(rules('북한산에 가요', 'bukhansane gayo', [whole])).toEqual([]);
  });

  it('is not reported for a string the converter cannot read, and gives one finding per gap of a token', () => {
    expect(rules('K팝 못해요', 'kpap mothaeyo', [])).toEqual(['romanization-unchecked']);
    expect(rules('첫인상', 'cheosinsang', [])).toEqual(['romanization-gap', 'romanization-gap']);
  });

  it('runs on each piece of a frame between its slots', () => {
    expect(checkFrameRomanization('저는 ___을/를 못해요', 'jeoneun ___eul/reul mothaeyo', none).map((f) => f.rule)).toEqual(['romanization-gap']);
    expect(checkFrameRomanization('저는 ___을/를 못해요', 'jeoneun ___eul/reul motaeyo').map((f) => f.rule)).toEqual(['romanization-mismatch']);
  });

  it('prose pairs never report it (checkProse keeps R1 and R2)', () => {
    expect(checkProse('She says mothaeyo (못해요) a lot.', [])).toEqual([]);
  });
});

describe('checkExceptions (R8)', () => {
  const ok: RomanizationException = { ko: '꽃잎', allowed: ['kkonnip'], reason: '표준 발음법 제29항', gap: 'n-insertion' };

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
    expect(found.map((f) => f.message)).toContain('exception 꽃잎 has no reason');
  });

  it('a detector-gap entry must cite an article or the dictionary; other gaps need not', () => {
    const found = checkExceptions([{ ...ok, reason: 'n-insertion' }], ['꽃잎']);
    expect(found.map((f) => f.message)).toEqual([expect.stringContaining('cites no article')]);
    expect(checkExceptions([{ ...ok, reason: '표준국어대사전 꽃잎 [꼰닙]' }], ['꽃잎'])).toEqual([]);
    expect(checkExceptions([{ ...ok, reason: '표준 발음법 제 29 항' }], ['꽃잎'])).toEqual([]);
    expect(checkExceptions([{ ...ok, gap: 'proper-noun', reason: 'a name' }], ['꽃잎'])).toEqual([]);
    expect(checkExceptions([{ ...ok, gap: 'other', reason: 'a name' }], ['꽃잎'])).toEqual([]);
  });

  it('a word entry holds exactly one allowed value; a whole-string entry may hold more', () => {
    expect(checkExceptions([{ ...ok, allowed: ['kkonnip', 'kkochip'] }], ['꽃잎']).map((f) => f.message)).toEqual([
      'exception 꽃잎 is a word entry and must hold exactly one allowed value, not 2',
    ]);
    expect(checkExceptions([{ ...ok, allowed: [] }], ['꽃잎']).map((f) => f.message)).toEqual([
      'exception 꽃잎 is a word entry and must hold exactly one allowed value, not 0',
    ]);
    const sentence: RomanizationException = { ...ok, ko: '꽃잎 한 장', allowed: ['kkonnip han jang', 'kkochip han jang'] };
    expect(checkExceptions([sentence], ['꽃잎 한 장'])).toEqual([]);
  });

  describe('a predicate-h entry agrees with the predicate reading, or is a noun that keeps the ㅎ', () => {
    const predicate: RomanizationException = { ko: '못해요', allowed: ['motaeyo'], gap: 'predicate-h', reason: '로마자 표기법 제3장 제1항 4' };
    it('passes the predicate reading, in compact form, whole strings included', () => {
      expect(checkExceptions([predicate], ['못해요'])).toEqual([]);
      expect(checkExceptions([{ ...predicate, allowed: ['Mo-tae yo'] }], ['못해요'])).toEqual([]);
      const sentence: RomanizationException = { ...predicate, ko: '저는 못해요.', allowed: ['jeoneun motaeyo.'] };
      expect(checkExceptions([sentence], ['저는 못해요.'])).toEqual([]);
    });

    it('fails the converter reading of a predicate, and an empty value', () => {
      const wrong = checkExceptions([{ ...predicate, allowed: ['mothaeyo'] }], ['못해요']);
      expect(wrong).toHaveLength(1);
      expect(wrong[0]?.message).toContain('(predicate-h) holds "mothaeyo", the predicate reading is "motaeyo"');
      expect(checkExceptions([{ ...predicate, allowed: [] }], ['못해요']).map((f) => f.message)).toEqual([
        'exception 못해요 is a word entry and must hold exactly one allowed value, not 0',
        expect.stringContaining('holds ""'),
      ]);
    });

    it('passes the converter reading only when the reason says it is a noun (체언)', () => {
      const noun: RomanizationException = { ko: '북한산', allowed: ['bukhansan'], gap: 'predicate-h', reason: 'a noun (체언): 제3장 제1항 4 다만' };
      expect(checkExceptions([noun], ['북한산'])).toEqual([]);
      expect(checkExceptions([{ ...noun, reason: 'a noun: 제3장 제1항 4 다만' }], ['북한산'])).toEqual([]);
      expect(checkExceptions([{ ...noun, reason: '제3장 제1항 4 다만, keeps the ㅎ' }], ['북한산'])).toHaveLength(1);
    });
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
    expect(a11yRomanization('silent/ng', 'or')).toBe('silent or ng');
    expect(a11yRomanization('g/k', 'or')).toBe('g or k');
    expect(a11yRomanization('silent / ng', 'or')).toBe('silent or ng');
  });

  // [SO] AMENDMENTS-STROKE-ORDER-STANDARD OD-SO10 (row SO-1b): the word between the alternatives is the UI locale's
  // (`a11y.romanizationOr` in packages/i18n), never the English word in every locale.
  it('joins the alternatives with the word it is given', () => {
    expect(a11yRomanization('silent/ng', 'o')).toBe('silent o ng');
    expect(a11yRomanization('g/k', '또는')).toBe('g 또는 k');
    expect(a11yRomanization('___eul/reul meogeoyo', 'o')).toBe('___eul o reul meogeoyo');
    expect(a11yRomanization('a/b/c', 'o')).toBe('a o b o c');
  });

  it('leaves values without a slash alone', () => {
    expect(a11yRomanization('eo', 'or')).toBe('eo');
    expect(a11yRomanization('eo', '또는')).toBe('eo');
    expect(a11yRomanization('', 'o')).toBe('');
  });
});
