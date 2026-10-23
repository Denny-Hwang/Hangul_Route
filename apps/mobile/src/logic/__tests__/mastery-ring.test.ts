import { borderWidth, colors, layout, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { journeyCellLayout, journeyCellMetrics } from '../journey-cell-layout';
import { journeyCellSize } from '../layout/pane-sizes';
import { GLOW_OPACITY, circleRing, outlinePath, ringLayers, ringSegments, segmentDash } from '../mastery-ring';

/**
 * F-CURR-002 section 4.4 and section 14, row CM-20 (wireframe journey/mastery-ring.md A to D): the ring's three
 * segments have equal arc lengths at 320, 768 and wide, the first gap is centred on the top edge, the track sits in the
 * 3 dp border box the cell already reserves (no extra width), and its keyline token, not the theme token, carries the
 * 3:1 non-text contrast.
 */

const TOKENS = { radius: radii.md, gap: spacing.xs, track: borderWidth.thick, keyline: borderWidth.thin, outside: borderWidth.base };
const CELL = journeyCellMetrics({ spacing, borderWidth, typography });

/** The cell's border box at a window width, the way JourneyGrid sizes it (one pane, the compact glyph and ring). */
function cellAt(gridWidth: number, scale = 1): { width: number; height: number } {
  const width = journeyCellSize(gridWidth, spacing.xs, layout.columns.journeyCellMax);
  const l = journeyCellLayout(CELL, CELL.glyph * scale, CELL.ring * scale, { placedOut: false, isStart: false });
  return { width, height: Math.max(width, l.minHeight) };
}

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe('the mastery ring geometry', () => {
  it('matches the mock on the 54 x 76 cell at 320: a 223.7 dp keyline, three 70.56 dp segments, the first gap centred on top', () => {
    const k = outlinePath(54, 76, 2.5, radii.md);
    expect(k.length).toBeCloseTo(223.69, 1);
    const segs = ringSegments(k.length, spacing.xs);
    expect(segs.map((s) => s.arc)).toEqual([segs[0]?.arc, segs[0]?.arc, segs[0]?.arc]);
    expect(segs[0]?.arc).toBeCloseTo(70.563, 2);
    expect(segs[0]?.start).toBe(spacing.xs / 2);
    // The last segment ends half a gap before the start: the gap round the top centre is whole.
    const last = segs[2];
    expect((last?.start ?? 0) + (last?.arc ?? 0)).toBeCloseTo(k.length - spacing.xs / 2, 6);
    expect(k.d.startsWith('M27 2.5 H')).toBe(true);
    expect(segmentDash(segs[1] as (typeof segs)[number], k.length)).toEqual({ strokeDasharray: `70.563 ${Math.round(k.length * 1000) / 1000}`, strokeDashoffset: -(segs[1]?.start ?? 0) });
    expect(segs[1]?.start).toBeCloseTo(2 + 70.563 + 4, 2);
  });

  it.each([
    ['320', 320 - 2 * layout.gutter.compact, 1],
    ['768', 768 - 2 * layout.gutter.regular, layout.mediaScale.regular],
    ['wide master pane', layout.pane.master - 2 * layout.gutter.wide, layout.mediaScale.wide],
  ])('at %s the three arcs are equal within 0.5 dp on every outline, and the track is the 3 dp border box', (_name, grid, scale) => {
    const { width, height } = cellAt(grid, scale);
    const l = ringLayers(width, height, TOKENS);
    for (const layer of [l.band, l.keyline]) {
      const arcs = layer.segments.map((s) => s.arc);
      expect(Math.max(...arcs) - Math.min(...arcs)).toBeLessThan(0.5);
      expect(arcs.reduce((a, b) => a + b, 0) + 3 * spacing.xs).toBeCloseTo(layer.length, 6);
    }
    // Band (2 dp) outside the keyline (1 dp): the two fill the thick border the cell reserves, so no width is added.
    expect(l.band.width + l.keyline.width).toBe(borderWidth.thick);
    expect(CELL.maxEdge).toBe(borderWidth.thick);
    // The halo and the focus outline sit in the grid gap: 2 dp a side, 4 dp between two glowing neighbours.
    expect(2 * l.outside.width).toBeLessThanOrEqual(spacing.xs);
    expect(l.margin).toBe(borderWidth.base);
  });

  it('keeps the cells 54 dp wide at 320 (at least the 48 dp target)', () => {
    expect(cellAt(320 - 2 * layout.gutter.compact).width).toBe(54);
  });

  it('a corner radius larger than the inset box never goes negative', () => {
    expect(outlinePath(4, 4, 1, 99).length).toBeCloseTo(2 * Math.PI * 1, 6);
    expect(outlinePath(54, 76, 20, 12).length).toBeCloseTo(2 * (54 - 40) + 2 * (76 - 40), 6);
  });

  it('the level-up circle splits into three equal arcs with the same gaps', () => {
    const c = circleRing(spacing.xxxl, { gap: spacing.xs, track: borderWidth.thick });
    expect(c.r).toBe(spacing.xxxl / 2 - borderWidth.thick / 2);
    expect(new Set(c.segments.map((s) => s.arc.toFixed(6))).size).toBe(1);
    expect(ringSegments(1, 4).every((s) => s.arc === 0)).toBe(true);
  });
});

describe('theme-token contrast (section 14; mastery-ring.md Contrast)', () => {
  it('the keyline (border.shape) carries 3:1 non-text contrast on paper, canvas and sunken, so colour is never the only cue', () => {
    for (const ground of [colors.surface.paper, colors.surface.canvas, colors.surface.sunken]) {
      expect(contrast(colors.border.shape, ground), ground).toBeGreaterThanOrEqual(3);
    }
    // The theme tokens are accents: at least one is under 3:1 on paper, which is why the keyline is always drawn.
    expect(Object.values(colors.theme).some((t) => contrast(t, colors.surface.paper) < 3)).toBe(true);
    // The New volume plus: text.onSecondary on brand.secondary reads at 4.5:1.
    expect(contrast(colors.text.onSecondary, colors.brand.secondary)).toBeGreaterThanOrEqual(4.5);
    expect(GLOW_OPACITY).toBe(0.4);
  });
});
