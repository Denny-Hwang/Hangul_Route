import type { EdgeInsets } from '@hangul-route/design-system';
import { layout, spacing, touchTarget } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { overlayFrame } from '../overlay-frame';

const NO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
/** `tabBarMetrics(34).height` (design-system layout.ts): the tab row over a 34 pt home indicator. */
const TAB_BAR_OVER_INDICATOR = spacing.xs + touchTarget.min + 34;

/**
 * F-LAYOUT-001 §3.3 / §3.5 (audit UX-26): window-level overlays (PWA banners,
 * install guide) sit in a centred `maxWidth.reading` column, clear the side
 * insets, and sit above the home indicator, or above the tab bar when it shows.
 */
describe('overlayFrame', () => {
  it('a phone with no insets and no tab bar keeps the gap on every side', () => {
    expect(overlayFrame({ insets: NO_INSETS, tabBarHeight: 0, gap: spacing.md })).toEqual({
      bottom: spacing.md,
      left: spacing.md,
      right: spacing.md,
      maxWidth: layout.maxWidth.reading,
    });
  });

  it('adds the bottom inset when the tab bar is hidden', () => {
    const f = overlayFrame({ insets: { top: 47, right: 0, bottom: 34, left: 0 }, tabBarHeight: 0, gap: spacing.md });
    expect(f.bottom).toBe(34 + spacing.md);
  });

  it('sits above the tab bar when it shows (its height already includes the bottom inset)', () => {
    const f = overlayFrame({
      insets: { top: 47, right: 0, bottom: 34, left: 0 },
      tabBarHeight: TAB_BAR_OVER_INDICATOR,
      gap: spacing.md,
    });
    expect(f.bottom).toBe(TAB_BAR_OVER_INDICATOR + spacing.md);
    expect(f.bottom).toBeGreaterThan(34 + touchTarget.min);
  });

  it('clears a landscape notch on either side', () => {
    const f = overlayFrame({ insets: { top: 0, right: 47, bottom: 21, left: 0 }, tabBarHeight: 0, gap: spacing.md });
    expect(f.left).toBe(spacing.md);
    expect(f.right).toBe(47 + spacing.md);
  });

  it('caps the column at the reading width', () => {
    expect(overlayFrame({ insets: NO_INSETS, tabBarHeight: 0, gap: 0 }).maxWidth).toBe(720);
  });

  it('treats negative, NaN or infinite numbers as 0', () => {
    expect(
      overlayFrame({
        insets: { top: 0, right: Number.NaN, bottom: -5, left: Number.POSITIVE_INFINITY },
        tabBarHeight: Number.NaN,
        gap: spacing.sm,
      }),
    ).toEqual({ bottom: spacing.sm, left: spacing.sm, right: spacing.sm, maxWidth: layout.maxWidth.reading });
  });
});

