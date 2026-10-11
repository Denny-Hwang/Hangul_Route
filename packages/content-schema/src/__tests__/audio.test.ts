import { describe, expect, it } from 'vitest';
import {
  AUDIO_REF_PATTERN,
  AudioRefSchema,
  DeviceAudioPrefsSchema,
  JamoSchema,
  SPEECH_LANGS,
  SpeechLangSchema,
} from '../index';

describe('AudioRefSchema (F-AUDIO-004 §3.2)', () => {
  it.each(['audio/jamo/giyeok.mp3', 'audio/jamo/giyeok-batchim.mp3', 'audio/vocab/ice-cream.mp3', 'audio/story/ep-01/line-3.mp3'])(
    'accepts %s',
    (ref) => {
      expect(AudioRefSchema.safeParse(ref).success).toBe(true);
      expect(AUDIO_REF_PATTERN.test(ref)).toBe(true);
    },
  );

  it.each([
    'giyeok.mp3',
    'audio/jamo/ㄱ.mp3',
    'audio/jamo/Giyeok.mp3',
    'audio/jamo/giyeok.wav',
    'audio/other/giyeok.mp3',
    'audio/jamo/-giyeok.mp3',
    '/audio/jamo/giyeok.mp3',
    '',
  ])('rejects %s', (ref) => {
    expect(AudioRefSchema.safeParse(ref).success).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(AudioRefSchema.safeParse(42).success).toBe(false);
  });
});

describe('SpeechLangSchema', () => {
  it('lists the three speech languages in order', () => {
    expect([...SPEECH_LANGS]).toEqual(['ko-KR', 'en-US', 'es-US']);
  });

  it('accepts the listed tags and rejects others', () => {
    for (const lang of SPEECH_LANGS) expect(SpeechLangSchema.safeParse(lang).success).toBe(true);
    expect(SpeechLangSchema.safeParse('ko').success).toBe(false);
    expect(SpeechLangSchema.safeParse('es-ES').success).toBe(false);
  });
});

describe('DeviceAudioPrefsSchema (§3.7)', () => {
  it('defaults muted to false', () => {
    expect(DeviceAudioPrefsSchema.parse({})).toEqual({ muted: false });
  });

  it('keeps an explicit value and rejects a non-boolean', () => {
    expect(DeviceAudioPrefsSchema.parse({ muted: true })).toEqual({ muted: true });
    expect(DeviceAudioPrefsSchema.safeParse({ muted: 'yes' }).success).toBe(false);
  });
});

describe('JamoSchema audio fields (F-AUDIO-004 §3.2)', () => {
  const base = {
    id: 'jamo:giyeok',
    char: 'ㄱ',
    romanization: 'g/k',
    nameEn: 'giyeok',
    kind: 'consonant',
    order: 1,
  } as const;

  it('keeps existing fixtures parsing and defaults spokenKind to sound', () => {
    const parsed = JamoSchema.parse(base);
    expect(parsed.spokenKind).toBe('sound');
    expect(parsed.spokenKo).toBeUndefined();
  });

  it('accepts the full row for ㄱ', () => {
    const result = JamoSchema.safeParse({
      ...base,
      spokenKo: '가',
      spokenRomanization: 'ga',
      nameKo: '기역',
      audioRef: 'audio/jamo/giyeok.mp3',
      nameAudioRef: 'audio/jamo/giyeok-name.mp3',
    });
    expect(result.success).toBe(true);
  });

  it('accepts the two-syllable name 이응 as spokenKo with spokenKind name', () => {
    const result = JamoSchema.safeParse({ ...base, spokenKo: '이응', spokenRomanization: 'ieung', spokenKind: 'name' });
    expect(result.success).toBe(true);
  });

  it('rejects spokenKo that is empty, three syllables, or not Hangul syllables', () => {
    for (const spokenKo of ['', '가나다', 'a', 'ㄱ']) {
      expect(JamoSchema.safeParse({ ...base, spokenKo }).success).toBe(false);
    }
  });

  it('rejects nameKo longer than three syllables or not Hangul syllables', () => {
    expect(JamoSchema.safeParse({ ...base, nameKo: '기역기역' }).success).toBe(false);
    expect(JamoSchema.safeParse({ ...base, nameKo: 'giyeok' }).success).toBe(false);
    expect(JamoSchema.safeParse({ ...base, nameKo: '' }).success).toBe(false);
  });

  it('bounds spokenRomanization to 1..8 characters', () => {
    expect(JamoSchema.safeParse({ ...base, spokenKo: '가', spokenRomanization: '' }).success).toBe(false);
    expect(JamoSchema.safeParse({ ...base, spokenKo: '가', spokenRomanization: 'a'.repeat(8) }).success).toBe(true);
    expect(JamoSchema.safeParse({ ...base, spokenKo: '가', spokenRomanization: 'a'.repeat(9) }).success).toBe(false);
  });

  it('requires spokenKo when spokenRomanization is present', () => {
    const result = JamoSchema.safeParse({ ...base, spokenRomanization: 'ga' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['spokenRomanization']);
  });

  it('requires nameKo when nameAudioRef is present', () => {
    const bad = JamoSchema.safeParse({ ...base, nameAudioRef: 'audio/jamo/giyeok-name.mp3' });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0]?.path).toEqual(['nameAudioRef']);
    expect(JamoSchema.safeParse({ ...base, nameKo: '기역', nameAudioRef: 'audio/jamo/giyeok-name.mp3' }).success).toBe(true);
  });

  it('reports both refinement issues when both are violated', () => {
    const result = JamoSchema.safeParse({ ...base, spokenRomanization: 'ga', nameAudioRef: 'audio/jamo/giyeok-name.mp3' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((i) => i.path[0]).sort()).toEqual(['nameAudioRef', 'spokenRomanization']);
  });

  it('tightens audioRef to the audio grammar', () => {
    expect(JamoSchema.safeParse({ ...base, audioRef: 'audio/jamo/giyeok.mp3' }).success).toBe(true);
    expect(JamoSchema.safeParse({ ...base, audioRef: 'giyeok.mp3' }).success).toBe(false);
    expect(JamoSchema.safeParse({ ...base, nameAudioRef: 'x.mp3', nameKo: '기역' }).success).toBe(false);
  });

  it('rejects an unknown spokenKind', () => {
    expect(JamoSchema.safeParse({ ...base, spokenKind: 'letter' }).success).toBe(false);
  });
});
