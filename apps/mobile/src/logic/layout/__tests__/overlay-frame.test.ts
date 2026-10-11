import type { EdgeInsets } from '@hangul-route/design-system';
import { spacing, touchTarget } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { bannerFrame, overlayFrame } from '../overlay-frame';

const NO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
/** `tabBarMetrics(34).height` (design-system layout.ts): the tab row over a 34 pt home indicator. */
const TAB_BAR_OVER_INDICATOR = spacing.xs + touchTarget.min + 34;

/**
 * F-LAYOUT-001 §3.3 / §3.5 (audit UX-26): window-level overlays (PWA banners,
 * install guide) clear the side insets, and sit above the home indicator, or above the tab bar when it shows.
 */
describe('overlayFrame', () => {
  it('a phone with no insets and no tab bar keeps the gap on every side', () => {
    expect(overlayFrame({ insets: NO_INSETS, tabBarHeight: 0, gap: spacing.md })).toEqual({
      bottom: spacing.md,
      left: spacing.md,
      right: spacing.md,
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

  it('takes a separate bottom gap (the banners keep their 32 pt lift on phones)', () => {
    expect(overlayFrame({ insets: NO_INSETS, tabBarHeight: 0, gap: spacing.md, bottomGap: spacing.xl })).toEqual({
      bottom: spacing.xl,
      left: spacing.md,
      right: spacing.md,
    });
  });

  it('clears a landscape notch on either side', () => {
    const f = overlayFrame({ insets: { top: 0, right: 47, bottom: 21, left: 0 }, tabBarHeight: 0, gap: spacing.md });
    expect(f.left).toBe(spacing.md);
    expect(f.right).toBe(47 + spacing.md);
  });

  it('treats negative, NaN or infinite numbers as 0', () => {
    expect(
      overlayFrame({
        insets: { top: 0, right: Number.NaN, bottom: -5, left: Number.POSITIVE_INFINITY },
        tabBarHeight: Number.NaN,
        gap: spacing.sm,
      }),
    ).toEqual({ bottom: spacing.sm, left: spacing.sm, right: spacing.sm });
  });
});


/**
 * Where the PWA banner slot sits (wireframes pwa/system-banners "banners share a single slot at the
 * top" and layout/wide H "above the tab bar, never over a CTA"): above the tab bar on a tab screen;
 * on a screen with no tab bar (onboarding, quest, PIN) the bottom belongs to the screen's CTA, so the
 * slot moves to the top, under the status bar / notch.
 */
describe('bannerFrame', () => {
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };

  it('sits above the tab bar when it shows, as before', () => {
    expect(bannerFrame({ insets, tabBarHeight: TAB_BAR_OVER_INDICATOR, gap: spacing.md, bottomGap: spacing.xl })).toEqual({
      edge: 'bottom',
      offset: TAB_BAR_OVER_INDICATOR + spacing.xl,
      left: spacing.md,
      right: spacing.md,
    });
  });

  it('moves to the top under the notch when there is no tab bar, so it never covers a bottom CTA', () => {
    expect(bannerFrame({ insets, tabBarHeight: 0, gap: spacing.md, bottomGap: spacing.xl })).toEqual({
      edge: 'top',
      offset: 47 + spacing.md,
      left: spacing.md,
      right: spacing.md,
    });
  });

  it('keeps the side gap clear of a landscape notch at the top too', () => {
    const f = bannerFrame({ insets: { top: 0, right: 0, bottom: 21, left: 47 }, tabBarHeight: 0, gap: spacing.md });
    expect(f).toEqual({ edge: 'top', offset: spacing.md, left: 47 + spacing.md, right: spacing.md });
  });

  it('treats a bad tab-bar height as no tab bar, and bad insets as 0', () => {
    expect(
      bannerFrame({ insets: { top: Number.NaN, right: -1, bottom: 0, left: 0 }, tabBarHeight: Number.NaN, gap: spacing.sm }),
    ).toEqual({ edge: 'top', offset: spacing.sm, left: spacing.sm, right: spacing.sm });
  });
});
