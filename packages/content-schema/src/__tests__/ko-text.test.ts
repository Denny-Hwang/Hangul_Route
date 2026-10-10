import { describe, expect, it } from 'vitest';
import { KoTextSchema, PictureRefSchema } from '../index';

const base = { ko: '아버지', romanization: 'abeoji', en: 'father' };

describe('KoTextSchema (the shared taught-Korean shape, F-QUEST-002 §3.1)', () => {
  it('accepts the minimal shape: Korean, romanization and a gloss', () => {
    expect(KoTextSchema.parse(base)).toEqual(base);
  });

  it('accepts every optional field', () => {
    const full = {
      ...base,
      spokenKo: '아버지',
      audioRef: 'audio/abeoji.mp3',
      syllables: ['a', 'beo', 'ji'],
    };
    expect(KoTextSchema.parse(full)).toEqual(full);
  });

  it.each(['ko', 'romanization', 'en'] as const)('requires a non-empty %s', (field) => {
    const { [field]: _omitted, ...rest } = base;
    expect(KoTextSchema.safeParse(rest).success).toBe(false);
    expect(KoTextSchema.safeParse({ ...base, [field]: '' }).success).toBe(false);
  });

  it('rejects an empty spokenKo and an empty syllable', () => {
    expect(KoTextSchema.safeParse({ ...base, spokenKo: '' }).success).toBe(false);
    expect(KoTextSchema.safeParse({ ...base, syllables: ['a', '', 'ji'] }).success).toBe(false);
  });

  it('requires the syllables to join to the romanization', () => {
    const bad = KoTextSchema.safeParse({ ...base, syllables: ['a', 'bo', 'ji'] });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues[0]?.path).toEqual(['syllables']);
    }
  });

  it('allows a one-syllable word to repeat its romanization as its only syllable', () => {
    expect(
      KoTextSchema.safeParse({ ko: '너', romanization: 'neo', en: 'you', syllables: ['neo'] }).success,
    ).toBe(true);
  });
});

describe('PictureRefSchema', () => {
  it.each(['card:kimchi', 'word:tiger-2', 'swatch:primary'])('accepts %s', (ref) => {
    expect(PictureRefSchema.safeParse(ref).success).toBe(true);
  });

  it.each(['kimchi', 'card:', 'card:Kimchi', 'emoji:kimchi', 'card:kim chi', 'xcard:kimchi', 'card:kimchi!'])(
    'rejects %s',
    (ref) => {
      expect(PictureRefSchema.safeParse(ref).success).toBe(false);
    },
  );
});
