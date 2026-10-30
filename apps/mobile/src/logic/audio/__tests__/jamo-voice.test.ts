import { romanizeWord } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findJamo, jamoAll, jamoKnown, jamoWordBuilder } from '../../../content/jamo';
import { LETTER_QUIZ_JAMO_IDS } from '../../round-builder';
import { PRONOUNCED_FINALS, jamoVoice, toJamoQuestion, type JamoVoice } from '../jamo-voice';
import type { SpokenJamo } from '../spoken';

/**
 * AMENDMENTS-AUDIO-CLIPS section 5, row by row, for all 55 jamo records (`jamoAll` 30 +
 * `jamoWordBuilder` 25), and the JV-A2 rules, with the clips of the section 5 table (row AC-1):
 * a letter question plays the name clip `<id>-name` (ㅇ and every vowel: the sound clip), a
 * sound question the sound clip `<id>`, and the Word Builder finals the clip they share.
 */

const LONE_JAMO = /[\u3131-\u318E\u1100-\u11FF]/u;

const clip = (fileId: string): string => `audio/jamo/${fileId}.mp3`;

function voice(text: string, romanization: string, audioRef: string | undefined, kind: JamoVoice['kind'], shown = text): JamoVoice {
  return audioRef === undefined ? { text, shown, romanization, kind } : { text, shown, romanization, audioRef, kind };
}

function record(id: string): SpokenJamo {
  const j = findJamo(`jamo:${id}`);
  if (j === undefined) throw new Error(`no jamo:${id}`);
  return j;
}

/** Consonants (19): id, name (letter question), its RR, sound (sound question), its RR. */
const CONSONANTS: readonly (readonly [string, string, string, string, string])[] = [
  ['giyeok', '기역', 'giyeok', '가', 'ga'],
  ['nieun', '니은', 'nieun', '나', 'na'],
  ['digeut', '디귿', 'digeut', '다', 'da'],
  ['rieul', '리을', 'rieul', '라', 'ra'],
  ['mieum', '미음', 'mieum', '마', 'ma'],
  ['bieup', '비읍', 'bieup', '바', 'ba'],
  ['siot', '시옷', 'siot', '사', 'sa'],
  ['ieung', '이응', 'ieung', '이응', 'ieung'],
  ['jieut', '지읒', 'jieut', '자', 'ja'],
  ['chieut', '치읓', 'chieut', '차', 'cha'],
  ['kieuk', '키읔', 'kieuk', '카', 'ka'],
  ['tieut', '티읕', 'tieut', '타', 'ta'],
  ['pieup', '피읖', 'pieup', '파', 'pa'],
  ['hieut', '히읗', 'hieut', '하', 'ha'],
  ['ssanggiyeok', '쌍기역', 'ssanggiyeok', '까', 'kka'],
  ['ssangdigeut', '쌍디귿', 'ssangdigeut', '따', 'tta'],
  ['ssangbieup', '쌍비읍', 'ssangbieup', '빠', 'ppa'],
  ['ssangsiot', '쌍시옷', 'ssangsiot', '싸', 'ssa'],
  ['ssangjieut', '쌍지읒', 'ssangjieut', '짜', 'jja'],
];

/** Vowels (21): id (= its RR) and the text both question types say. */
const VOWELS: readonly (readonly [string, string])[] = [
  ['a', '아'],
  ['ya', '야'],
  ['eo', '어'],
  ['yeo', '여'],
  ['o', '오'],
  ['yo', '요'],
  ['u', '우'],
  ['yu', '유'],
  ['eu', '으'],
  ['i', '이'],
  ['ae', '애'],
  ['yae', '얘'],
  ['e', '에'],
  ['ye', '예'],
  ['wa', '와'],
  ['wae', '왜'],
  ['oe', '외'],
  ['wo', '워'],
  ['we', '웨'],
  ['wi', '위'],
  ['ui', '의'],
];

/** Finals (15; sound question only): id, shown (spelled), text (pronounced, M12), RR, clip (section 5; shared). */
const FINALS: readonly (readonly [string, string, string, string, string])[] = [
  ['giyeok-batchim', '악', '악', 'ak', 'giyeok-batchim'],
  ['nieun-batchim', '안', '안', 'an', 'nieun-batchim'],
  ['rieul-batchim', '알', '알', 'al', 'rieul-batchim'],
  ['mieum-batchim', '암', '암', 'am', 'mieum-batchim'],
  ['bieup-batchim', '압', '압', 'ap', 'bieup-batchim'],
  ['ieung-batchim', '앙', '앙', 'ang', 'ieung-batchim'],
  ['siot-batchim', '앗', '앋', 'at', 'digeut-batchim'],
  ['jieut-batchim', '앚', '앋', 'at', 'digeut-batchim'],
  ['chieut-batchim', '앛', '앋', 'at', 'digeut-batchim'],
  ['tieut-batchim', '앝', '앋', 'at', 'digeut-batchim'],
  ['digeut-batchim', '앋', '앋', 'at', 'digeut-batchim'],
  ['ssangsiot-batchim', '았', '앋', 'at', 'digeut-batchim'],
  ['kieuk-batchim', '앜', '악', 'ak', 'giyeok-batchim'],
  ['ssanggiyeok-batchim', '앆', '악', 'ak', 'giyeok-batchim'],
  ['pieup-batchim', '앞', '압', 'ap', 'bieup-batchim'],
];

const giyeok: SpokenJamo = {
  id: 'jamo:giyeok',
  kind: 'consonant',
  char: 'ㄱ',
  romanization: 'g/k',
  nameEn: 'giyeok',
  spokenKo: '가',
  spokenRomanization: 'ga',
  spokenKind: 'sound',
  nameKo: '기역',
  audioRef: 'audio/jamo/giyeok.mp3',
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A release build: NODE_ENV production and Metro's `__DEV__` false. */
function asRelease(): void {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubGlobal('__DEV__', false);
}

/** A development build: NODE_ENV development and `__DEV__` true. */
function asDevelopment(): void {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubGlobal('__DEV__', true);
}

describe('jamoVoice: the section 5 table covers every jamo record', () => {
  it('has a row for each of the 55 records (jamoAll 30 + jamoWordBuilder 25), no more', () => {
    const rows = [...CONSONANTS.map((r) => r[0]), ...VOWELS.map((r) => r[0]), ...FINALS.map((r) => r[0])].map((id) => `jamo:${id}`);
    expect(jamoAll).toHaveLength(30);
    expect(jamoWordBuilder).toHaveLength(25);
    expect(rows).toHaveLength(55);
    expect([...rows].sort()).toEqual(jamoKnown.map((j) => j.id).sort());
  });
});

describe('jamoVoice: consonants (19)', () => {
  it.each(CONSONANTS)('%s: letter says the name %s (%s), sound says %s (%s)', (id, name, nameRr, sound, soundRr) => {
    const j = record(id);
    // The name clip is `nameAudioRef` (section 5, row AC-1), or the sound clip when the name is the sound (ㅇ only).
    const nameClip = name === sound ? clip(id) : clip(`${id}-name`);
    expect(jamoVoice(j, 'letter')).toEqual(voice(name, nameRr, nameClip, 'name'));
    expect(jamoVoice(j, 'sound')).toEqual(voice(sound, soundRr, clip(id), 'sound'));
  });

  it('returns the name clips of section 5: 18 consonants other than ㅇ, each <id>-name, never the sound clip', () => {
    const named = CONSONANTS.filter(([id]) => id !== 'ieung');
    expect(named).toHaveLength(18);
    for (const [id] of named) {
      const letter = jamoVoice(record(id), 'letter');
      expect(letter.audioRef).toBe(clip(`${id}-name`));
      expect(letter.audioRef).not.toBe(jamoVoice(record(id), 'sound').audioRef);
    }
  });

  it('ㅇ: the letter and the sound are both 이응, one clip audio/jamo/ieung.mp3', () => {
    const ieung = record('ieung');
    expect(jamoVoice(ieung, 'letter')).toEqual(voice('이응', 'ieung', 'audio/jamo/ieung.mp3', 'name'));
    expect(jamoVoice(ieung, 'sound')).toEqual(voice('이응', 'ieung', 'audio/jamo/ieung.mp3', 'sound'));
  });

  it('a consonant letter returns its nameAudioRef when the record carries one', () => {
    const withName = { ...giyeok, nameAudioRef: 'audio/jamo/giyeok-name.mp3' };
    expect(jamoVoice(withName, 'letter')).toEqual(voice('기역', 'giyeok', 'audio/jamo/giyeok-name.mp3', 'name'));
    expect(jamoVoice(withName, 'sound').audioRef).toBe('audio/jamo/giyeok.mp3');
  });

  it('a consonant letter never borrows the sound clip: no name clip means the device voice', () => {
    expect(jamoVoice(giyeok, 'letter').audioRef).toBeUndefined();
    expect('audioRef' in jamoVoice(giyeok, 'letter')).toBe(false);
  });
});

describe('jamoVoice: vowels (21)', () => {
  it.each(VOWELS)('%s: both question types say %s; the name clip is the sound clip', (id, text) => {
    const j = record(id);
    expect(jamoVoice(j, 'letter')).toEqual(voice(text, id, clip(id), 'name'));
    expect(jamoVoice(j, 'sound')).toEqual(voice(text, id, clip(id), 'sound'));
    expect(jamoVoice(j, 'letter').audioRef).toBe(jamoVoice(j, 'sound').audioRef);
  });
});

describe('jamoVoice: finals (15; sound question only)', () => {
  it.each(FINALS)('%s: shown %s, spoken %s (%s), clip %s', (id, shown, text, rr, fileId) => {
    expect(jamoVoice(record(id), 'sound')).toEqual(voice(text, rr, clip(fileId), 'sound', shown));
  });

  it('the clip a final plays says its spoken text: every final with one clip says one text', () => {
    const textByClip = new Map<string, Set<string>>();
    for (const [id] of FINALS) {
      const v = jamoVoice(record(id), 'sound');
      const texts = textByClip.get(v.audioRef as string) ?? new Set<string>();
      texts.add(v.text);
      textByClip.set(v.audioRef as string, texts);
    }
    for (const [ref, texts] of textByClip) expect([...texts], ref).toHaveLength(1);
  });

  it.each(FINALS)('%s: a letter question throws (a final is asked only by its sound)', (id) => {
    expect(() => jamoVoice(record(id), 'letter')).toThrow(/final/);
  });

  it('a letter question on a final throws in a release build too', () => {
    asRelease();
    expect(() => jamoVoice(record('nieun-batchim'), 'letter')).toThrow(/final/);
  });

  it('shown differs from text for exactly the 8 Word Builder finals not spelled as they sound (M12)', () => {
    const differing = jamoKnown.filter((j) => {
      const v = jamoVoice(j, 'sound');
      return v.shown !== v.text;
    });
    expect(differing.map((j) => j.id).sort()).toEqual(
      [
        'jamo:siot-batchim',
        'jamo:jieut-batchim',
        'jamo:chieut-batchim',
        'jamo:tieut-batchim',
        'jamo:ssangsiot-batchim',
        'jamo:kieuk-batchim',
        'jamo:ssanggiyeok-batchim',
        'jamo:pieup-batchim',
      ].sort(),
    );
    // 디귿 at the bottom is spelled 앋 and said 앋: in the pronounced table, but shown equals text.
    const digeut = jamoVoice(record('digeut-batchim'), 'sound');
    expect(digeut.shown).toBe('앋');
    expect(digeut.text).toBe('앋');
    expect(Object.keys(PRONOUNCED_FINALS).sort()).toEqual([...differing.map((j) => j.id), 'jamo:digeut-batchim'].sort());
  });

  it('the pronounced form applies by record id only: a Stage 1 final is unchanged', () => {
    expect(jamoVoice(record('giyeok-batchim'), 'sound').shown).toBe('악');
    const { id: _id, ...noId } = record('jieut-batchim');
    expect(jamoVoice(noId, 'sound')).toEqual(voice('앚', 'at', clip('digeut-batchim'), 'sound'));
  });
});

describe('jamoVoice: invariants over all 55 records', () => {
  const voices = jamoKnown.flatMap((j) => [
    ...(j.kind === 'batchim' ? [] : [{ j, v: jamoVoice(j, 'letter') }]),
    { j, v: jamoVoice(j, 'sound') },
  ]);

  it('no returned text is a compatibility or conjoining jamo', () => {
    for (const { v } of voices) {
      expect(v.text).not.toMatch(LONE_JAMO);
      expect(v.shown).not.toMatch(LONE_JAMO);
    }
  });

  it('romanization is romanizeWord(text) (F-CNT-002): the authored RR agrees with the converter', () => {
    for (const { v } of voices) expect(v.romanization).toBe(romanizeWord(v.text));
  });

  it('kind is name for every letter question and sound for every sound question', () => {
    for (const j of jamoKnown) {
      if (j.kind !== 'batchim') expect(jamoVoice(j, 'letter').kind).toBe('name');
      expect(jamoVoice(j, 'sound').kind).toBe('sound');
    }
  });

  it('letter-question texts are unique across LETTER_QUIZ_JAMO_IDS', () => {
    const texts = [...LETTER_QUIZ_JAMO_IDS].map((id) => jamoVoice(findJamo(id)!, 'letter').text);
    expect(texts).toHaveLength(24);
    expect(new Set(texts).size).toBe(24);
  });

  it('이응 differs from 이: the ㅇ letter is never the ㅣ letter', () => {
    expect(jamoVoice(record('ieung'), 'letter').text).toBe('이응');
    expect(jamoVoice(record('i'), 'letter').text).toBe('이');
    expect(jamoVoice(record('ieung'), 'letter').text).not.toBe(jamoVoice(record('i'), 'letter').text);
  });
});

describe('jamoVoice: records with missing fields', () => {
  const noName: SpokenJamo = {
    id: 'jamo:test-noname',
    kind: 'consonant',
    char: 'ㄴ',
    romanization: 'n',
    nameEn: 'nieun',
    spokenKo: '나',
    spokenRomanization: 'na',
    spokenKind: 'sound',
    audioRef: 'audio/jamo/nieun.mp3',
  };
  const noSound: SpokenJamo = { char: 'ㄴ', romanization: 'n', nameEn: 'nieun', spokenKind: 'sound' };

  it('a letter question on a record with no nameKo throws in tests', () => {
    expect(() => jamoVoice(noName, 'letter')).toThrow(/nameKo/);
  });

  it('in a release build it falls back to the sound, silently', () => {
    asRelease();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(jamoVoice(noName, 'letter')).toEqual(voice('나', 'na', 'audio/jamo/nieun.mp3', 'sound'));
    expect(warn).not.toHaveBeenCalled();
  });

  it('in a development build it falls back to the sound with a console warning', () => {
    asDevelopment();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(jamoVoice(noName, 'letter')).toEqual(voice('나', 'na', 'audio/jamo/nieun.mp3', 'sound'));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/jamo:test-noname.*nameKo/);
  });

  it('a record with no spokenKo throws in tests (it would speak a lone jamo)', () => {
    expect(() => jamoVoice(noSound, 'sound')).toThrow(/spokenKo/);
    expect(() => jamoVoice(noSound, 'letter')).toThrow(/nameKo/);
  });

  it('in a release build a record with no spokenKo keeps the old fallback to char', () => {
    asRelease();
    expect(jamoVoice(noSound, 'sound')).toEqual(voice('ㄴ', 'n', undefined, 'sound'));
  });

  it('a missing spokenRomanization is computed from the text', () => {
    const { spokenRomanization: _drop, ...noRr } = noName;
    expect(jamoVoice(noRr, 'sound').romanization).toBe('na');
  });

  it('a text the converter cannot read keeps the tile romanization', () => {
    const latin: SpokenJamo = { ...noName, spokenKo: 'na' };
    delete (latin as { spokenRomanization?: string }).spokenRomanization;
    expect(jamoVoice(latin, 'sound').romanization).toBe('n');
  });
});

describe('toJamoQuestion: the adapter for callers of the old playJamo(jamo, mode)', () => {
  const final = record('nieun-batchim');
  const vowel = record('a');

  it('the default and the legacy sound mode are sound questions', () => {
    expect(toJamoQuestion(giyeok)).toBe('sound');
    expect(toJamoQuestion(giyeok, 'sound')).toBe('sound');
    expect(toJamoQuestion(final, 'sound')).toBe('sound');
  });

  it('the new letter question passes through', () => {
    expect(toJamoQuestion(giyeok, 'letter')).toBe('letter');
  });

  it('legacy name mode is a letter question for a consonant or a vowel', () => {
    expect(toJamoQuestion(giyeok, 'name')).toBe('letter');
    expect(toJamoQuestion(vowel, 'name')).toBe('letter');
  });

  it('legacy name mode on a final, or on a record with no name, keeps the old sound fallback', () => {
    expect(toJamoQuestion(final, 'name')).toBe('sound');
    const { nameKo: _drop, ...noName } = giyeok;
    expect(toJamoQuestion(noName, 'name')).toBe('sound');
  });
});
