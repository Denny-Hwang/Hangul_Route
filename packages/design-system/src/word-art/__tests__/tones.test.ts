import { describe, expect, it } from 'vitest';
import { colors } from '../../tokens';
import { WORD_ART_TONES, isWordArtTone, resolveTone } from '../tones';
import type { WordArtTone } from '../types';

/** F-VOC-002 §3.3: the tone vocabulary is every colour token minus the reserved ones. */

const EXCLUDED = ['feedback.danger', 'feedback.dangerLight', 'surface.overlay', 'surface.inkScrim'];

describe('WORD_ART_TONES', () => {
  it('is every colors leaf in table order, minus danger, scrims and rarity', () => {
    const expected = Object.entries(colors)
      .flatMap(([group, values]) => Object.keys(values).map((key) => `${group}.${key}`))
      .filter((path) => !EXCLUDED.includes(path) && !path.startsWith('rarity.'));
    expect(WORD_ART_TONES).toEqual(expected);
  });

  it.each([...EXCLUDED, 'rarity.common', 'rarity.uncommon', 'rarity.rare', 'rarity.legendary'])('excludes %s', (tone) => {
    expect(WORD_ART_TONES).not.toContain(tone);
    expect(isWordArtTone(tone)).toBe(false);
  });

  it('includes the twelve vocab content colours, the ink and the outline greys', () => {
    for (const key of Object.keys(colors.vocab)) expect(WORD_ART_TONES).toContain(`vocab.${key}`);
    expect(WORD_ART_TONES).toEqual(expect.arrayContaining(['text.primary', 'border.strong', 'surface.paper', 'hoya.furDark', 'brand.secondary']));
  });

  it('holds only opaque hex values (no rgba scrim slips in)', () => {
    for (const tone of WORD_ART_TONES) expect(resolveTone(tone)).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe('isWordArtTone', () => {
  it('rejects hex literals, unknown paths and non-strings (behaviour 2)', () => {
    expect(isWordArtTone('#ff0000')).toBe(false);
    expect(isWordArtTone('vocab.magenta')).toBe(false);
    expect(isWordArtTone('vocab')).toBe(false);
    expect(isWordArtTone('')).toBe(false);
  });

  it('accepts a token path', () => {
    expect(isWordArtTone('vocab.red')).toBe(true);
  });
});

describe('resolveTone', () => {
  it('equals the colors value for every tone', () => {
    for (const tone of WORD_ART_TONES) {
      const [group, key] = tone.split('.') as [keyof typeof colors, string];
      expect(resolveTone(tone)).toBe((colors[group] as Record<string, string>)[key]);
    }
  });

  it('throws on an unknown or reserved tone', () => {
    expect(() => resolveTone('feedback.danger' as WordArtTone)).toThrow(/tone/);
    expect(() => resolveTone('#ff0000' as WordArtTone)).toThrow(/tone/);
  });
});
