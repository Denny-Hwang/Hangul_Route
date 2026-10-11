import { describe, expect, it } from 'vitest';
import { clipRefsOf } from '../clip-refs';

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
});
