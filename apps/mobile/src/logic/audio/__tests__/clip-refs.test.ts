import { describe, expect, it } from 'vitest';
import { sayRef } from '@hangul-route/content-schema';
import { clipRefsOf } from '../clip-refs';
import { clipRefsFor } from '../controller';

describe('clipRefsOf (the refs a screen warms on mount, §3.10)', () => {
  it('keeps each audioRef once, in first-seen order, skipping items without one', () => {
    expect(
      clipRefsOf([
        { audioRef: 'audio/jamo/giyeok.mp3' },
        { audioRef: 'audio/jamo/nieun.mp3' },
        {},
        undefined,
        { audioRef: 'audio/jamo/giyeok.mp3' },
        { audioRef: '' },
      ]),
    ).toEqual(['audio/jamo/giyeok.mp3', 'audio/jamo/nieun.mp3']);
  });

  it('is empty for no items', () => {
    expect(clipRefsOf([])).toEqual([]);
  });

  it('adds the say clip of a spec\'s spoken text after its own clip (AMENDMENTS-AUDIO-CLIPS AC-B7), Korean only', () => {
    expect(
      clipRefsOf([
        { text: '안녕하세요.', audioRef: 'audio/vocab/hello.mp3' },
        { text: '가' },
        { text: 'Hello', language: 'en-US' },
        { text: '가', audioRef: 'audio/jamo/giyeok.mp3' },
      ]),
    ).toEqual(['audio/vocab/hello.mp3', sayRef('안녕하세요.'), sayRef('가'), 'audio/jamo/giyeok.mp3']);
  });
});

describe('clipRefsFor (the clips a prompt may play, in AC-B7 order)', () => {
  it('is the record clip, then the say clip of the text', () => {
    expect(clipRefsFor({ text: '니은', audioRef: 'audio/jamo/nieun-name.mp3' })).toEqual(['audio/jamo/nieun-name.mp3', sayRef('니은')]);
  });

  it('has no say clip for another language or a blank text, and never lists one ref twice', () => {
    expect(clipRefsFor({ text: 'Hear it', language: 'en-US' })).toEqual([]);
    expect(clipRefsFor({ text: '  ', audioRef: 'audio/jamo/a.mp3' })).toEqual(['audio/jamo/a.mp3']);
    expect(clipRefsFor({ text: '가', audioRef: sayRef('가') })).toEqual([sayRef('가')]);
    expect(clipRefsFor({ text: '가', audioRef: '' })).toEqual([sayRef('가')]);
  });
});
