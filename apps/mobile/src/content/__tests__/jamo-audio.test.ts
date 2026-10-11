import { describe, expect, it } from 'vitest';
import {
  AUDIO_REF_PATTERN,
  JamoSchema,
  composeSyllable,
  romanizeWord,
} from '@hangul-route/content-schema';
import { jamoAll, jamoBatchim, jamoConsonants, jamoVowels } from '../jamo';

/**
 * F-AUDIO-004 PR A-2: the 30 spoken forms (§3.2 table), typed out independently
 * of jamo.ts so a slip in either place fails. Format: id -> [spokenKo, spokenRomanization, nameKo].
 */
const SPEC_TABLE: Record<string, readonly [string, string, string | undefined]> = {
  'jamo:giyeok': ['가', 'ga', '기역'],
  'jamo:nieun': ['나', 'na', '니은'],
  'jamo:digeut': ['다', 'da', '디귿'],
  'jamo:rieul': ['라', 'ra', '리을'],
  'jamo:mieum': ['마', 'ma', '미음'],
  'jamo:bieup': ['바', 'ba', '비읍'],
  'jamo:siot': ['사', 'sa', '시옷'],
  'jamo:ieung': ['이응', 'ieung', '이응'],
  'jamo:jieut': ['자', 'ja', '지읒'],
  'jamo:chieut': ['차', 'cha', '치읓'],
  'jamo:kieuk': ['카', 'ka', '키읔'],
  'jamo:tieut': ['타', 'ta', '티읕'],
  'jamo:pieup': ['파', 'pa', '피읖'],
  'jamo:hieut': ['하', 'ha', '히읗'],
  'jamo:a': ['아', 'a', '아'],
  'jamo:ya': ['야', 'ya', '야'],
  'jamo:eo': ['어', 'eo', '어'],
  'jamo:yeo': ['여', 'yeo', '여'],
  'jamo:o': ['오', 'o', '오'],
  'jamo:yo': ['요', 'yo', '요'],
  'jamo:u': ['우', 'u', '우'],
  'jamo:yu': ['유', 'yu', '유'],
  'jamo:eu': ['으', 'eu', '으'],
  'jamo:i': ['이', 'i', '이'],
  'jamo:giyeok-batchim': ['악', 'ak', undefined],
  'jamo:nieun-batchim': ['안', 'an', undefined],
  'jamo:rieul-batchim': ['알', 'al', undefined],
  'jamo:mieum-batchim': ['암', 'am', undefined],
  'jamo:bieup-batchim': ['압', 'ap', undefined],
  'jamo:ieung-batchim': ['앙', 'ang', undefined],
};

/** Medial index (MEDIAL_RR order) of each vowel jamo. */
const VOWEL_MEDIAL: Record<string, number> = {
  ㅏ: 0, ㅑ: 2, ㅓ: 4, ㅕ: 6, ㅗ: 8, ㅛ: 12, ㅜ: 13, ㅠ: 17, ㅡ: 18, ㅣ: 20,
};

describe('jamo spoken forms (F-AUDIO-004 §3.2)', () => {
  it('has exactly the 30 spec records, in order', () => {
    expect(jamoAll.map((j) => j.id)).toEqual(Object.keys(SPEC_TABLE));
  });

  it('every record matches the spec table (spokenKo, spokenRomanization, nameKo)', () => {
    for (const j of jamoAll) {
      const [spokenKo, spokenRomanization, nameKo] = SPEC_TABLE[j.id] as readonly [string, string, string | undefined];
      expect(j.spokenKo, j.id).toBe(spokenKo);
      expect(j.spokenRomanization, j.id).toBe(spokenRomanization);
      expect(j.nameKo, j.id).toBe(nameKo);
    }
  });

  it('every record parses with JamoSchema', () => {
    for (const j of jamoAll) {
      expect(JamoSchema.safeParse(j).success, j.id).toBe(true);
    }
  });

  it('spokenKo is unique across all 30 (two tiles are never correct by ear for one prompt)', () => {
    const forms = jamoAll.map((j) => j.spokenKo);
    expect(new Set(forms).size).toBe(30);
  });

  it('audioRef is unique and matches the grammar (initial vs batchim never collide)', () => {
    const refs = jamoAll.map((j) => j.audioRef as string);
    expect(new Set(refs).size).toBe(30);
    for (const ref of refs) expect(ref).toMatch(AUDIO_REF_PATTERN);
    for (const j of jamoAll) {
      const stem = j.id.replace('jamo:', '');
      expect(j.audioRef).toBe(`audio/jamo/${stem}.mp3`);
    }
  });

  it('consonants except initial ㅇ are consonant + ㅏ (carrier rule, AD2)', () => {
    for (const j of jamoConsonants) {
      if (j.id === 'jamo:ieung') continue;
      expect(j.spokenKo, j.id).toBe(composeSyllable({ initial: j.char, medial: 0, final: '' }));
      expect(j.spokenKind, j.id).toBe('sound');
    }
  });

  it('vowels are ㅇ + vowel, and the vowel name equals its sound', () => {
    for (const j of jamoVowels) {
      expect(j.spokenKo, j.id).toBe(composeSyllable({ initial: 'ㅇ', medial: VOWEL_MEDIAL[j.char] as number, final: '' }));
      expect(j.nameKo, j.id).toBe(j.spokenKo);
      expect(j.spokenKind, j.id).toBe('sound');
    }
  });

  it('batchim are ㅇ + ㅏ + the final, with no letter name', () => {
    for (const j of jamoBatchim) {
      expect(j.spokenKo, j.id).toBe(composeSyllable({ initial: 'ㅇ', medial: 0, final: j.char }));
      expect(j.nameKo, j.id).toBeUndefined();
      expect(j.nameAudioRef, j.id).toBeUndefined();
      expect(j.spokenKind, j.id).toBe('sound');
    }
  });

  it('initial ㅇ is spoken by its name 이응 (spokenKind name)', () => {
    const ieung = jamoAll.find((j) => j.id === 'jamo:ieung');
    expect(ieung?.spokenKind).toBe('name');
    expect(ieung?.spokenKo).toBe('이응');
    expect(ieung?.spokenKo).toBe(ieung?.nameKo);
    expect(jamoAll.filter((j) => j.spokenKind === 'name').map((j) => j.id)).toEqual(['jamo:ieung']);
  });

  it('spokenRomanization === romanizeWord(spokenKo) (Revised Romanization, D13)', () => {
    for (const j of jamoAll) {
      expect(j.spokenRomanization, j.id).toBe(romanizeWord(j.spokenKo as string));
    }
  });

  it('nameKo of the 14 consonants is the standard set', () => {
    expect(jamoConsonants.map((j) => j.nameKo)).toEqual([
      '기역', '니은', '디귿', '리을', '미음', '비읍', '시옷',
      '이응', '지읒', '치읓', '키읔', '티읕', '피읖', '히읗',
    ]);
  });

  it('nameAudioRef is not set yet (optional batch 2, A-10)', () => {
    for (const j of jamoAll) expect(j.nameAudioRef, j.id).toBeUndefined();
  });
});
