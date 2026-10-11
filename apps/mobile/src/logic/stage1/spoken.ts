/**
 * Interim spoken forms of the 30 symbols (F-QUEST-002 §3.12). What the voice
 * says for a symbol is its SOUND, not its letter name: a lone consonant read
 * by the iOS / Safari ko-KR voice comes out as 기역, 니은 ... (audit F01).
 * A consonant is spoken on the carrier vowel ㅏ, a vowel as its ㅇ-syllable and
 * a batchim as a short closed syllable. The one exception is the initial ㅇ:
 * 아 is the same audio as the vowel ㅏ, so ㅇ is spoken by its name 이응
 * (F-AUDIO-004 AD2, `spokenKind: 'name'`).
 *
 * This file is replaced by data on `JamoSchema` (`spokenKo`, `spokenRomanization`,
 * `spokenKind`) in F-AUDIO-004 PR A-2: the values are the same, the shape is not.
 * Holds Hangul syllables, so it is listed with F-CNT-002's class B1 files.
 */
export interface SpokenForm {
  /** What the voice says. */
  ko: string;
  /** Revised Romanization of `ko`, unhyphenated (D13). */
  romanization: string;
  /** `sound`: the symbol's sound; `name`: the letter name (initial ㅇ only). */
  kind: 'sound' | 'name';
}

const sound = (ko: string, romanization: string): SpokenForm => ({ ko, romanization, kind: 'sound' });

export const INTERIM_SPOKEN: Readonly<Record<string, SpokenForm>> = {
  // Consonants on the carrier vowel ㅏ
  'jamo:giyeok': sound('가', 'ga'),
  'jamo:nieun': sound('나', 'na'),
  'jamo:digeut': sound('다', 'da'),
  'jamo:rieul': sound('라', 'ra'),
  'jamo:mieum': sound('마', 'ma'),
  'jamo:bieup': sound('바', 'ba'),
  'jamo:siot': sound('사', 'sa'),
  'jamo:ieung': { ko: '이응', romanization: 'ieung', kind: 'name' },
  'jamo:jieut': sound('자', 'ja'),
  'jamo:chieut': sound('차', 'cha'),
  'jamo:kieuk': sound('카', 'ka'),
  'jamo:tieut': sound('타', 'ta'),
  'jamo:pieup': sound('파', 'pa'),
  'jamo:hieut': sound('하', 'ha'),
  // Vowels as their ㅇ-syllables
  'jamo:a': sound('아', 'a'),
  'jamo:ya': sound('야', 'ya'),
  'jamo:eo': sound('어', 'eo'),
  'jamo:yeo': sound('여', 'yeo'),
  'jamo:o': sound('오', 'o'),
  'jamo:yo': sound('요', 'yo'),
  'jamo:u': sound('우', 'u'),
  'jamo:yu': sound('유', 'yu'),
  'jamo:eu': sound('으', 'eu'),
  'jamo:i': sound('이', 'i'),
  // Batchim as short closed syllables
  'jamo:giyeok-batchim': sound('악', 'ak'),
  'jamo:nieun-batchim': sound('안', 'an'),
  'jamo:rieul-batchim': sound('알', 'al'),
  'jamo:mieum-batchim': sound('암', 'am'),
  'jamo:bieup-batchim': sound('압', 'ap'),
  'jamo:ieung-batchim': sound('앙', 'ang'),
};

/** The interim spoken form of a symbol, or `undefined` for an unknown id. */
export function interimSpokenFor(jamoId: string): SpokenForm | undefined {
  return INTERIM_SPOKEN[jamoId];
}
