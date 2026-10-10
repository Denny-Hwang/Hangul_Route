import { describe, expect, it } from 'vitest';
import { ALL_SCREEN_EDGES, NO_INSETS, TAB_SCREEN_EDGES, screenPadding, tabBarMetrics } from '../layout';
import { spacing, touchTarget } from '../tokens';

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
