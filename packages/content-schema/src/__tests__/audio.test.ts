import { describe, expect, it } from 'vitest';
import {
  AUDIO_PACKS,
  AUDIO_REF_PATTERN,
  AUDIO_SOURCE_COUNT_MAX,
  AudioPackSchema,
  AudioRefSchema,
  AudioSourceSummaryPayloadSchema,
  DeviceAudioPrefsSchema,
  JamoSchema,
  SPEECH_LANGS,
  SpeechLangSchema,
} from '../index';

describe('AudioRefSchema (F-AUDIO-004 §3.2)', () => {
  it.each([
    'audio/jamo/giyeok.mp3',
    'audio/jamo/giyeok-name.mp3',
    'audio/jamo/giyeok-batchim.mp3',
    'audio/vocab/ice-cream.mp3',
    'audio/story/ep-01/line-3.mp3',
    // AMENDMENTS-AUDIO-CLIPS AC-B4: the text-keyed group.
    'audio/say/0123456789abcdef.mp3',
  ])(
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
    'audio/say/0123456789abcdef.wav',
    'audio/say/0123456789abcdef.ogg',
    'audio/says/0123456789abcdef.mp3',
    // A say clip is named by its 16-hex key only (isSayRef), never a slug or a folder.
    'audio/say/foo.mp3',
    'audio/say/0123456789ABCDEF.mp3',
    'audio/say/0123456789abcde.mp3',
    'audio/say/0123456789abcdef0.mp3',
    'audio/say/ab/0123456789abcdef.mp3',
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

describe('audio packs (AMENDMENTS-AUDIO-CLIPS AC-B6)', () => {
  it('lists the thirteen packs once, in the order of the AC-B6 table (a shared text belongs to the first)', () => {
    expect([...AUDIO_PACKS]).toEqual([
      'jamo-s1',
      'jamo-wb',
      'stage1',
      'placement',
      'stage2',
      'stage3',
      'stage4',
      'stage6',
      'stage7',
      'vocab',
      'stories',
      'review',
      'cards',
    ]);
    expect(new Set(AUDIO_PACKS).size).toBe(AUDIO_PACKS.length);
  });

  it('every pack id is a valid remote switch key (audioPack.<pack>)', () => {
    for (const pack of AUDIO_PACKS) expect(pack).toMatch(/^[a-z0-9][a-z0-9_-]{0,47}$/);
  });

  it('AudioPackSchema accepts the listed packs only', () => {
    for (const pack of AUDIO_PACKS) expect(AudioPackSchema.safeParse(pack).success).toBe(true);
    for (const bad of ['stage5', 'jamo', 'Jamo-s1', '', 'all']) expect(AudioPackSchema.safeParse(bad).success).toBe(false);
  });
});

describe('audio.source_summary payload (AMENDMENTS-AUDIO-CLIPS AC-B9)', () => {
  const ok = { clip: 3, say: 12, tts: 4, text: 0, appVersion: '1.0.0' };

  it('accepts four whole counts and the app version', () => {
    expect(AudioSourceSummaryPayloadSchema.safeParse(ok).success).toBe(true);
    expect(AudioSourceSummaryPayloadSchema.safeParse({ ...ok, clip: 0, say: 0, tts: 0, text: AUDIO_SOURCE_COUNT_MAX }).success).toBe(true);
  });

  it('rejects an extra field: no text, ref, learner id or URL can ride along', () => {
    for (const extra of [{ ref: 'audio/say/0123456789abcdef.mp3' }, { text0: '가' }, { profileId: 'p1' }, { url: 'https://x' }, { source: 'discover' }]) {
      expect(AudioSourceSummaryPayloadSchema.safeParse({ ...ok, ...extra }).success).toBe(false);
    }
  });

  it('rejects a missing count, a fraction, a negative, a count past the cap and a string count', () => {
    const { text: _drop, ...noText } = ok;
    expect(AudioSourceSummaryPayloadSchema.safeParse(noText).success).toBe(false);
    for (const bad of [1.5, -1, AUDIO_SOURCE_COUNT_MAX + 1, '3', Number.NaN]) {
      expect(AudioSourceSummaryPayloadSchema.safeParse({ ...ok, say: bad }).success).toBe(false);
    }
  });

  it('takes a dotted version only (never free text)', () => {
    for (const appVersion of ['1.0.0', '12.3.45']) expect(AudioSourceSummaryPayloadSchema.safeParse({ ...ok, appVersion }).success).toBe(true);
    for (const appVersion of ['', '1.0', 'v1.0.0', '1.0.0-beta', 'Alice', '1.0.0 ', '12345.0.0']) {
      expect(AudioSourceSummaryPayloadSchema.safeParse({ ...ok, appVersion }).success).toBe(false);
    }
  });
});
