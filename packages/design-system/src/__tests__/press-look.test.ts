import { describe, expect, it } from 'vitest';
import { PRESS_SCALE, pressInset, pressLook, pressTransform } from '../press-look';
import { borderWidth, colors } from '../tokens';

/**
 * The press look of docs/specs/AMENDMENTS-TOUCH.md section 4.3 (KT-D11, row KT-2): a "pushed in" look, a thick
 * `border.shape` outline and a slight shrink, never a state look. ChoiceCard and Tile paint exactly this.
 */
describe('pressLook (AMENDMENTS-TOUCH 4.3)', () => {
  it('is a thick border.shape outline with a 0.97 shrink', () => {
    expect(PRESS_SCALE).toBe(0.97);
    expect(pressLook(false)).toEqual({ borderColor: colors.border.shape, borderWidth: borderWidth.thick, scale: 0.97 });
  });

  it('under reduced motion keeps the outline and drops the shrink', () => {
    expect(pressLook(true)).toEqual({ borderColor: colors.border.shape, borderWidth: borderWidth.thick, scale: 1 });
  });

  it('is never a state colour: not focus (hint and focus ring), brand (selection), sunken (disabled) or feedback', () => {
    const banned = [
      colors.border.focus,
      colors.brand.primary,
      colors.brand.primaryLight,
      colors.surface.sunken,
      ...Object.values(colors.feedback),
    ];
    expect(banned).not.toContain(pressLook(false).borderColor);
  });

  it('pressTransform: a scale transform only when it shrinks, so an idle card and a reduced-motion press carry none', () => {
    expect(pressTransform(null)).toBeUndefined();
    expect(pressTransform(pressLook(true))).toBeUndefined();
    expect(pressTransform(pressLook(false))).toEqual([{ scale: 0.97 }]);
  });

  it('pressInset: the padding the thicker outline takes, so a pressed box keeps its size; none at rest or on a thick ring', () => {
    expect(pressInset(null, borderWidth.base)).toBe(0);
    expect(pressInset(pressLook(false), borderWidth.base)).toBe(borderWidth.thick - borderWidth.base);
    expect(pressInset(pressLook(true), borderWidth.base)).toBe(1);
    expect(pressInset(pressLook(false), borderWidth.thick)).toBe(0);
  });
});
