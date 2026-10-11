import { describe, expect, it } from 'vitest';
import {
  ALL_SCREEN_EDGES,
  NO_INSETS,
  TAB_SCREEN_EDGES,
  screenFrame,
  screenMaxWidth,
  screenPadding,
  tabBarMetrics,
} from '../layout';
import { layout, spacing, touchTarget } from '../tokens';

const notch = { top: 47, right: 0, bottom: 34, left: 0 };
const landscape = { top: 0, right: 47, bottom: 21, left: 47 };

describe('screenPadding (Screen safe-area padding)', () => {
  it('adds every inset to the base padding by default', () => {
    expect(screenPadding(spacing.lg, notch)).toEqual({
      paddingTop: spacing.lg + 47,
      paddingRight: spacing.lg,
      paddingBottom: spacing.lg + 34,
      paddingLeft: spacing.lg,
    });
  });

  it('keeps landscape left/right insets clear of the notch and home indicator', () => {
    expect(screenPadding(spacing.lg, landscape)).toEqual({
      paddingTop: spacing.lg,
      paddingRight: spacing.lg + 47,
      paddingBottom: spacing.lg + 21,
      paddingLeft: spacing.lg + 47,
    });
  });

  it('skips edges a parent already handles (a tab screen leaves the bottom to the tab bar)', () => {
    expect(screenPadding(spacing.lg, notch, TAB_SCREEN_EDGES)).toEqual({
      paddingTop: spacing.lg + 47,
      paddingRight: spacing.lg,
      paddingBottom: spacing.lg,
      paddingLeft: spacing.lg,
    });
  });

  it('pads insets only when the screen is unpadded', () => {
    expect(screenPadding(0, notch)).toEqual({
      paddingTop: 47,
      paddingRight: 0,
      paddingBottom: 34,
      paddingLeft: 0,
    });
  });

  it('is just the base padding without a safe-area provider', () => {
    expect(screenPadding(spacing.lg, NO_INSETS, ALL_SCREEN_EDGES)).toEqual({
      paddingTop: spacing.lg,
      paddingRight: spacing.lg,
      paddingBottom: spacing.lg,
      paddingLeft: spacing.lg,
    });
  });

  it('never lets a bogus negative inset eat into the base padding', () => {
    expect(screenPadding(spacing.lg, { top: -5, right: -1, bottom: -10, left: -2 }).paddingBottom).toBe(spacing.lg);
  });
});

describe('tabBarMetrics (bottom tab bar over the home indicator)', () => {
  it('lifts the tab row above the home indicator', () => {
    const m = tabBarMetrics(34);
    expect(m.paddingBottom).toBe(34);
    expect(m.height).toBe(m.paddingTop + touchTarget.min + 34);
  });

  it('keeps a small breathing gap where there is no inset (web, Android, older iPhones)', () => {
    const m = tabBarMetrics(0);
    expect(m.paddingBottom).toBe(spacing.sm);
    expect(m.height).toBe(m.paddingTop + touchTarget.min + spacing.sm);
  });

  it('gives each tab the 64pt touch-target floor', () => {
    for (const inset of [0, 20, 34]) {
      const m = tabBarMetrics(inset);
      expect(m.height - m.paddingTop - m.paddingBottom).toBeGreaterThanOrEqual(touchTarget.min);
    }
  });
});

describe('tabBarMetrics side insets and centring (F-LAYOUT-001 §3.2)', () => {
  it('is unchanged for existing one-argument callers, with no side padding', () => {
    expect(tabBarMetrics(34)).toEqual({
      height: spacing.xs + touchTarget.min + 34,
      paddingTop: spacing.xs,
      paddingBottom: 34,
      paddingLeft: 0,
      paddingRight: 0,
    });
  });

  it('clears a landscape notch with the side inset', () => {
    const m = tabBarMetrics(21, { left: 47, right: 47 }, 844);
    expect(m.paddingLeft).toBe(47);
    expect(m.paddingRight).toBe(47);
  });

  it('centres the tab row inside maxWidth.full on a wide window', () => {
    const m = tabBarMetrics(0, { left: 0, right: 0 }, 1480);
    expect(m.paddingLeft).toBe((1480 - layout.maxWidth.full) / 2);
    expect(m.paddingRight).toBe((1480 - layout.maxWidth.full) / 2);
  });

  it('takes the larger of the inset and the centring margin, per side', () => {
    const m = tabBarMetrics(0, { left: 200, right: 10 }, 1180);
    const margin = (1180 - layout.maxWidth.full) / 2;
    expect(m.paddingLeft).toBe(Math.max(200, margin));
    expect(m.paddingRight).toBe(Math.max(10, margin));
  });

  it('adds no centring margin on a window narrower than the cap, and ignores a bogus window or inset', () => {
    expect(tabBarMetrics(0, { left: 0, right: 0 }, 1000).paddingLeft).toBe(0);
    expect(tabBarMetrics(0, { left: -4, right: -9 }, Number.NaN)).toMatchObject({ paddingLeft: 0, paddingRight: 0 });
  });

  it('keeps the 64 touch-target floor in the tab row', () => {
    const m = tabBarMetrics(34, { left: 47, right: 47 }, 1400);
    expect(m.height - m.paddingTop - m.paddingBottom).toBeGreaterThanOrEqual(touchTarget.min);
  });
});

describe('screenMaxWidth', () => {
  it('reading 720, full 1120, bleed has no cap', () => {
    expect(screenMaxWidth('reading')).toBe(layout.maxWidth.reading);
    expect(screenMaxWidth('full')).toBe(layout.maxWidth.full);
    expect(screenMaxWidth('bleed')).toBeUndefined();
  });
});

describe('screenFrame (Screen padding, gutter and footer)', () => {
  const base = { width: 'reading', padded: true, insets: NO_INSETS, edges: ALL_SCREEN_EDGES, hasFooter: false } as const;

  it('compact keeps today: gutter is spacing.lg, no footer, 720 cap', () => {
    const f = screenFrame({ ...base, widthClass: 'compact' });
    expect(f.body).toEqual(screenPadding(spacing.lg, NO_INSETS));
    expect(f.footer).toBeNull();
    expect(f.maxWidth).toBe(layout.maxWidth.reading);
  });

  it('padded uses the gutter of the width class', () => {
    expect(screenFrame({ ...base, widthClass: 'regular' }).body.paddingLeft).toBe(spacing.xl);
    expect(screenFrame({ ...base, widthClass: 'wide' }).body.paddingLeft).toBe(spacing.xxl);
  });

  it('unpadded screens pad only the insets, whatever the class', () => {
    const f = screenFrame({ ...base, widthClass: 'wide', padded: false, insets: notch });
    expect(f.body).toEqual(screenPadding(0, notch));
  });

  it('insets stack on the gutter, outside the cap', () => {
    const f = screenFrame({ ...base, widthClass: 'regular', insets: landscape });
    expect(f.body).toEqual(screenPadding(spacing.xl, landscape));
  });

  it('width picks the cap; bleed has none', () => {
    expect(screenFrame({ ...base, widthClass: 'wide', width: 'full' }).maxWidth).toBe(layout.maxWidth.full);
    expect(screenFrame({ ...base, widthClass: 'wide', width: 'bleed' }).maxWidth).toBeUndefined();
  });

  it('a footer takes the bottom inset; the body keeps only the gutter below it', () => {
    const f = screenFrame({ ...base, widthClass: 'compact', insets: notch, hasFooter: true });
    expect(f.body.paddingBottom).toBe(spacing.lg);
    expect(f.footer).toEqual({
      paddingTop: 0,
      paddingRight: spacing.lg,
      paddingBottom: spacing.lg + 34,
      paddingLeft: spacing.lg,
    });
  });

  it('a footer clears landscape side insets like the body does', () => {
    const f = screenFrame({ ...base, widthClass: 'regular', insets: landscape, hasFooter: true });
    expect(f.footer).toMatchObject({
      paddingLeft: spacing.xl + 47,
      paddingRight: spacing.xl + 47,
      paddingBottom: spacing.xl + 21,
    });
    expect(f.body.paddingLeft).toBe(spacing.xl + 47);
  });

  it('a tab screen with a footer leaves the bottom inset to the tab bar', () => {
    const f = screenFrame({ ...base, widthClass: 'compact', insets: notch, edges: TAB_SCREEN_EDGES, hasFooter: true });
    expect(f.footer?.paddingBottom).toBe(spacing.lg);
    expect(f.body.paddingBottom).toBe(spacing.lg);
  });

  it('an unpadded screen with a footer pads only the inset below it', () => {
    const f = screenFrame({ ...base, widthClass: 'compact', padded: false, insets: notch, hasFooter: true });
    expect(f.body.paddingBottom).toBe(0);
    expect(f.footer).toEqual({ paddingTop: 0, paddingRight: 0, paddingBottom: 34, paddingLeft: 0 });
  });
});
