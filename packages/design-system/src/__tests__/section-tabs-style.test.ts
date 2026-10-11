import { describe, expect, it } from 'vitest';
import { sectionTabStyle } from '../components/SectionTabs/style';
import { contrastRatio } from '../contrast';
import { borderWidth, colors, radii, spacing, touchTarget, typography } from '../tokens';

const WCAG_AA_NORMAL = 4.5;

describe('sectionTabStyle (F-STORY-004 PR 4.5)', () => {
  it('selected: brand fill and border, on-primary bold label', () => {
    const s = sectionTabStyle(true);
    expect(s.backgroundColor).toBe(colors.brand.primary);
    expect(s.borderColor).toBe(colors.brand.primary);
    expect(s.textColor).toBe(colors.text.onPrimary);
    expect(s.fontWeight).toBe(typography.weight.bold);
  });

  it('unselected: paper fill, strong outline, primary semibold label', () => {
    const s = sectionTabStyle(false);
    expect(s.backgroundColor).toBe(colors.surface.paper);
    expect(s.borderColor).toBe(colors.border.strong);
    expect(s.textColor).toBe(colors.text.primary);
    expect(s.fontWeight).toBe(typography.weight.semibold);
  });

  it('every tab is a pill at least touchTarget.min (64) tall, whatever its state', () => {
    for (const selected of [true, false]) {
      const s = sectionTabStyle(selected);
      expect(s.minHeight).toBe(touchTarget.min);
      expect(s.minHeight).toBeGreaterThanOrEqual(64);
      expect(s.borderRadius).toBe(radii.pill);
      expect(s.borderWidth).toBe(borderWidth.base);
      expect(s.paddingHorizontal).toBe(spacing.xl);
      expect(s.fontSize).toBe(typography.size.body);
    }
  });

  it('both labels meet WCAG AA on their fill', () => {
    for (const selected of [true, false]) {
      const s = sectionTabStyle(selected);
      expect(contrastRatio(s.textColor, s.backgroundColor)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    }
  });

  it('the selected tab differs by more than hue: fill and label weight both change', () => {
    const on = sectionTabStyle(true);
    const off = sectionTabStyle(false);
    expect(on.backgroundColor).not.toBe(off.backgroundColor);
    expect(on.fontWeight).not.toBe(off.fontWeight);
  });

  it('is pure: equal results, fresh objects', () => {
    const a = sectionTabStyle(true);
    expect(sectionTabStyle(true)).toEqual(a);
    expect(sectionTabStyle(true)).not.toBe(a);
  });
});
