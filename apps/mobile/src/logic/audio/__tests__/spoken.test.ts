import { describe, expect, it } from 'vitest';
import { spokenFor, type SpokenJamo } from '../spoken';

const giyeok: SpokenJamo = {
  char: 'ㄱ',
  romanization: 'g/k',
  nameEn: 'giyeok',
  spokenKo: '가',
  spokenRomanization: 'ga',
  spokenKind: 'sound',
  nameKo: '기역',
  audioRef: 'audio/jamo/giyeok.mp3',
  nameAudioRef: 'audio/jamo/giyeok-name.mp3',
};
const ieung: SpokenJamo = {
  char: 'ㅇ',
  romanization: 'silent/ng',
  nameEn: 'ieung',
  spokenKo: '이응',
  spokenRomanization: 'ieung',
  spokenKind: 'name',
  nameKo: '이응',
  audioRef: 'audio/jamo/ieung.mp3',
};
const vowelA: SpokenJamo = {
  char: 'ㅏ',
  romanization: 'a',
  nameEn: 'a',
  spokenKo: '아',
  spokenRomanization: 'a',
  spokenKind: 'sound',
  nameKo: '아',
  audioRef: 'audio/jamo/a.mp3',
};
const batchim: SpokenJamo = {
  char: 'ㄱ',
  romanization: 'k',
  nameEn: 'giyeok-final',
  spokenKo: '악',
  spokenRomanization: 'ak',
  spokenKind: 'sound',
  audioRef: 'audio/jamo/giyeok-batchim.mp3',
};
const bare: SpokenJamo = { char: 'ㄴ', romanization: 'n', nameEn: 'nieun', spokenKind: 'sound' };

describe('spokenFor (F-AUDIO-004 §3.5)', () => {
  it('consonant sound is the carrier syllable, never the name', () => {
    expect(spokenFor(giyeok, 'sound')).toEqual({ text: '가', audioRef: 'audio/jamo/giyeok.mp3', romanization: 'ga' });
  });

  it('consonant name is nameKo with the nameEn romanization and the name clip', () => {
    expect(spokenFor(giyeok, 'name')).toEqual({ text: '기역', audioRef: 'audio/jamo/giyeok-name.mp3', romanization: 'giyeok' });
  });

  it('a consonant name with no name clip has no audioRef (falls to TTS)', () => {
    const { nameAudioRef: _drop, ...noClip } = giyeok;
    expect(spokenFor(noClip, 'name').audioRef).toBeUndefined();
  });

  it('initial ieung: the sound is the name', () => {
    expect(spokenFor(ieung, 'sound')).toEqual({ text: '이응', audioRef: 'audio/jamo/ieung.mp3', romanization: 'ieung' });
    expect(spokenFor(ieung, 'name')).toEqual({ text: '이응', audioRef: 'audio/jamo/ieung.mp3', romanization: 'ieung' });
  });

  it('a vowel name equals its sound and reuses the sound clip and romanization', () => {
    expect(spokenFor(vowelA, 'sound')).toEqual({ text: '아', audioRef: 'audio/jamo/a.mp3', romanization: 'a' });
    expect(spokenFor(vowelA, 'name')).toEqual({ text: '아', audioRef: 'audio/jamo/a.mp3', romanization: 'a' });
  });

  it('batchim plays the closed syllable; asking for a name falls back to it', () => {
    expect(spokenFor(batchim, 'sound')).toEqual({ text: '악', audioRef: 'audio/jamo/giyeok-batchim.mp3', romanization: 'ak' });
    expect(spokenFor(batchim, 'name')).toEqual({ text: '악', audioRef: 'audio/jamo/giyeok-batchim.mp3', romanization: 'ak' });
  });

  it('falls back to char and the tile romanization only when the fields are absent', () => {
    expect(spokenFor(bare, 'sound')).toEqual({ text: 'ㄴ', romanization: 'n' });
    expect(spokenFor(bare, 'name')).toEqual({ text: 'ㄴ', romanization: 'n' });
  });

  it('spokenKo without spokenRomanization falls back to the tile romanization', () => {
    expect(spokenFor({ ...bare, spokenKo: '나' }, 'sound')).toEqual({ text: '나', romanization: 'n' });
  });

  it('a nameKo that differs from a missing spokenKo still resolves the name', () => {
    expect(spokenFor({ ...bare, nameKo: '니은' }, 'name')).toEqual({ text: '니은', romanization: 'nieun' });
  });
});
