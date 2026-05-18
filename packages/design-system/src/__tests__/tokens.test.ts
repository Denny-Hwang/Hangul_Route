import { describe, expect, it } from 'vitest';
import {
  colors,
  motion,
  radii,
  shadows,
  spacing,
  tokens,
  touchTarget,
  typography,
  z,
} from '../tokens';

describe('design tokens v1', () => {
  it('exposes brand / surface / text palettes as readonly objects', () => {
    expect(colors.brand.primary).toBeTruthy();
    expect(colors.surface.canvas).toBeTruthy();
    expect(colors.text.primary).toBeTruthy();
  });

  it('declares 7 stage tints + 5 theme tints', () => {
    expect(Object.keys(colors.stage)).toHaveLength(7);
    expect(Object.keys(colors.theme)).toHaveLength(5);
  });

  it('reserves a danger color but routes child failure to nudge (anti-shame)', () => {
    expect(colors.feedback.danger).toBeTruthy();
    expect(colors.feedback.nudge).toBeTruthy();
    expect(colors.feedback.danger).not.toBe(colors.feedback.nudge);
  });

  it('touch target floor matches CLAUDE.md §4', () => {
    expect(touchTarget.min).toBeGreaterThanOrEqual(64);
    expect(touchTarget.child).toBeGreaterThanOrEqual(touchTarget.min);
    expect(touchTarget.hero).toBeGreaterThanOrEqual(touchTarget.child);
  });

  it('spacing uses 4pt sub-grid floor', () => {
    expect(spacing.xs % 4).toBe(0);
    expect(spacing.sm % 4).toBe(0);
    expect(spacing.md % 4).toBe(0);
    expect(spacing.lg % 4).toBe(0);
  });

  it('typography body floor is ≥18sp (kids 5-7 legibility)', () => {
    expect(typography.size.body).toBeGreaterThanOrEqual(18);
  });

  it('radii are sorted ascending', () => {
    const values = [radii.xs, radii.sm, radii.md, radii.lg, radii.xl, radii.xxl];
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]!);
    }
  });

  it('motion durations are sorted', () => {
    expect(motion.duration.instant).toBeLessThan(motion.duration.fast);
    expect(motion.duration.fast).toBeLessThan(motion.duration.base);
    expect(motion.duration.base).toBeLessThan(motion.duration.slow);
  });

  it('tokens object aggregates all token families', () => {
    expect(tokens.colors).toBe(colors);
    expect(tokens.spacing).toBe(spacing);
    expect(tokens.radii).toBe(radii);
    expect(tokens.typography).toBe(typography);
    expect(tokens.shadows).toBe(shadows);
    expect(tokens.z).toBe(z);
  });

  it('z layers ascend from base to hoyaBubble', () => {
    expect(z.base).toBeLessThan(z.raised);
    expect(z.raised).toBeLessThan(z.modal);
    expect(z.modal).toBeLessThan(z.hoyaBubble);
  });
});
