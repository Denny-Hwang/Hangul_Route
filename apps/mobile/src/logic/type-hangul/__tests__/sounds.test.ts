import { CONSONANT_ROWS, SHIFTED_KEYS, VOWEL_ROWS } from '@hangul-route/design-system/hangul-keyboard-layout';
import { describe, expect, it } from 'vitest';
import { keySound } from '../sounds';

describe('keySound (the face under a keyboard letter)', () => {
  it('gives the teaching value of every letter on the keyboard, shifted ones too', () => {
    const faces = [...CONSONANT_ROWS.flat(), ...VOWEL_ROWS.flat(), ...Object.values(SHIFTED_KEYS)];
    expect(faces).toHaveLength(33);
    for (const face of faces) expect(keySound(face), face).not.toBe('');
    expect([keySound('ㄱ'), keySound('ㅇ'), keySound('ㄲ'), keySound('ㅖ')]).toEqual(['g/k', 'silent/ng', 'kk', 'ye']);
  });

  it('shows nothing for a character with no value', () => {
    expect(keySound('a')).toBe('');
  });
});
