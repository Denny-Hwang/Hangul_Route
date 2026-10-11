import { describe, expect, it } from 'vitest';
import { VOCAB_FORMATS, formatFor, formatsForLevel, repeatFormat, type VocabFormat } from '../format-for';

const ALL: readonly VocabFormat[] = ['word-to-image', 'audio-to-image', 'image-to-word'];
const PICTURES_FIRST: readonly VocabFormat[] = ['word-to-image', 'audio-to-image'];

describe('formatsForLevel (F-VOC-004 §3.2 level ladder)', () => {
  it('lists the three formats in ladder order', () => {
    expect([...VOCAB_FORMATS]).toEqual(['word-to-image', 'audio-to-image', 'image-to-word']);
  });

  it('Pictures first gets word-to-image and audio-to-image, never image-to-word (it needs reading)', () => {
    expect(formatsForLevel(0, true)).toEqual(PICTURES_FIRST);
  });

  it('Some reading and Reads easily get all three', () => {
    expect(formatsForLevel(1, true)).toEqual(ALL);
    expect(formatsForLevel(2, true)).toEqual(ALL);
  });

  it('drops audio-to-image when no voice can play (S7)', () => {
    expect(formatsForLevel(0, false)).toEqual(['word-to-image']);
    expect(formatsForLevel(1, false)).toEqual(['word-to-image', 'image-to-word']);
    expect(formatsForLevel(2, false)).toEqual(['word-to-image', 'image-to-word']);
  });
});

describe('formatFor (box x level x canPlay, §3.2)', () => {
  it('box 0 and 1 ask word-to-image at every level', () => {
    for (const box of [0, 1]) {
      for (const allowed of [ALL, PICTURES_FIRST, ['word-to-image'] as const]) {
        for (const canPlay of [true, false]) expect(formatFor(box, allowed, canPlay)).toBe('word-to-image');
      }
    }
  });

  it('box 2 asks audio-to-image, falling back to word-to-image without a voice', () => {
    expect(formatFor(2, ALL, true)).toBe('audio-to-image');
    expect(formatFor(2, PICTURES_FIRST, true)).toBe('audio-to-image');
    expect(formatFor(2, ALL, false)).toBe('word-to-image');
    expect(formatFor(2, PICTURES_FIRST, false)).toBe('word-to-image');
    expect(formatFor(2, ['word-to-image', 'image-to-word'], true)).toBe('word-to-image');
  });

  it('box 3 and above ask image-to-word, then fall back image-to-word -> audio-to-image -> word-to-image', () => {
    for (const box of [3, 4, 5]) {
      expect(formatFor(box, ALL, true)).toBe('image-to-word');
      expect(formatFor(box, ALL, false)).toBe('image-to-word');
      // Pictures first: no image-to-word, so the sound question, or the word when there is no voice.
      expect(formatFor(box, PICTURES_FIRST, true)).toBe('audio-to-image');
      expect(formatFor(box, PICTURES_FIRST, false)).toBe('word-to-image');
    }
  });

  it('never returns audio-to-image when canPlay is false, even if the caller allowed it', () => {
    for (const box of [0, 1, 2, 3, 4, 5]) expect(formatFor(box, ALL, false)).not.toBe('audio-to-image');
  });

  it('reads out-of-range boxes as the nearest box and an empty allow-list as word-to-image', () => {
    expect(formatFor(-1, ALL, true)).toBe('word-to-image');
    expect(formatFor(Number.NaN, ALL, true)).toBe('word-to-image');
    expect(formatFor(9, ALL, true)).toBe('image-to-word');
    expect(formatFor(2.5, ALL, true)).toBe('audio-to-image');
    expect(formatFor(3, [], true)).toBe('word-to-image');
  });
});

describe('repeatFormat (a word asked again uses a different format)', () => {
  it('returns the first unused format of the ladder that is allowed and playable', () => {
    expect(repeatFormat(['word-to-image'], ALL, true)).toBe('audio-to-image');
    expect(repeatFormat(['word-to-image', 'audio-to-image'], ALL, true)).toBe('image-to-word');
    expect(repeatFormat(['image-to-word'], ALL, true)).toBe('word-to-image');
    expect(repeatFormat(['word-to-image'], ALL, false)).toBe('image-to-word');
    expect(repeatFormat(['audio-to-image'], PICTURES_FIRST, true)).toBe('word-to-image');
  });

  it('returns null when every usable format was already used', () => {
    expect(repeatFormat(['word-to-image', 'audio-to-image', 'image-to-word'], ALL, true)).toBeNull();
    expect(repeatFormat(['word-to-image'], PICTURES_FIRST, false)).toBeNull();
    expect(repeatFormat(['word-to-image', 'audio-to-image'], PICTURES_FIRST, true)).toBeNull();
  });
});
