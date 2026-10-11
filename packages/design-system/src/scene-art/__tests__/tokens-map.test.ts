import { describe, expect, it } from 'vitest';
import { borderWidth, colors } from '../../tokens';
import { COLOR_TOKENS, isColorToken, resolveColor, resolveStroke } from '../tokens-map';
import { OPACITY_STEPS } from '../types';

describe('resolveColor', () => {
  it('reads colors[group][name]', () => {
    expect(resolveColor('theme.rites')).toBe(colors.theme.rites);
    expect(resolveColor('hoya.fur')).toBe(colors.hoya.fur);
    expect(resolveColor('brand.primary')).toBe(colors.brand.primary);
  });

  it('throws on an unknown token', () => {
    expect(() => resolveColor('theme.nope' as never)).toThrow(/Unknown colour token/);
    expect(() => resolveColor('nope.fur' as never)).toThrow(/Unknown colour token/);
    expect(() => resolveColor('#ff0000' as never)).toThrow(/Unknown colour token/);
    expect(() => resolveColor('constructor.name' as never)).toThrow(/Unknown colour token/);
  });

  it('refuses the reserved tokens even though they exist in colors', () => {
    for (const t of ['feedback.danger', 'surface.overlay', 'surface.inkScrim']) {
      expect(() => resolveColor(t as never)).toThrow(/Unknown colour token/);
    }
  });
});

describe('COLOR_TOKENS / isColorToken', () => {
  it('lists every leaf of colors except the reserved three', () => {
    const all = Object.entries(colors).flatMap(([g, v]) => Object.keys(v).map((k) => `${g}.${k}`));
    expect(COLOR_TOKENS).toHaveLength(all.length - 3);
    expect(new Set(COLOR_TOKENS).size).toBe(COLOR_TOKENS.length);
    for (const t of all) {
      const reserved = ['feedback.danger', 'surface.overlay', 'surface.inkScrim'].includes(t);
      expect(COLOR_TOKENS.includes(t as never)).toBe(!reserved);
    }
  });

  it('guards unknown input', () => {
    expect(isColorToken('theme.rites')).toBe(true);
    expect(isColorToken('feedback.danger')).toBe(false);
    expect(isColorToken('#fff')).toBe(false);
    expect(isColorToken(42)).toBe(false);
    expect(isColorToken(undefined)).toBe(false);
  });
});

describe('resolveStroke', () => {
  it('maps the three stroke names to borderWidth', () => {
    expect(resolveStroke('thin')).toBe(borderWidth.thin);
    expect(resolveStroke('base')).toBe(borderWidth.base);
    expect(resolveStroke('thick')).toBe(borderWidth.thick);
  });

  it('defaults to base and throws on junk', () => {
    expect(resolveStroke(undefined)).toBe(borderWidth.base);
    expect(() => resolveStroke('huge' as never)).toThrow(/Unknown stroke token/);
  });
});

describe('OPACITY_STEPS', () => {
  it('is the fixed ladder', () => {
    expect(OPACITY_STEPS).toEqual([0.08, 0.15, 0.2, 0.35, 0.6, 0.85, 1]);
  });
});
