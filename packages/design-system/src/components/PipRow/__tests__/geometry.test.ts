import { describe, expect, it } from 'vitest';
import pipSource from '../Pip.tsx?raw';
import pipRowSource from '../PipRow.tsx?raw';
import geometrySource from '../geometry.ts?raw';
import typesSource from '../types.ts?raw';
import indexSource from '../index.ts?raw';
import segmentsSource from '../StageSegments.tsx?raw';
import { WCAG_AA_LARGE, contrastRatio } from '../../../contrast';
import { colors } from '../../../tokens';
import {
  LATER_DASHES,
  PIP_SIZE,
  PIP_STATES,
  cursorMarkerParts,
  markerBand,
  pipInk,
  pipParts,
  pipRowBands,
  pipRowCells,
  pipRowLines,
  pipStrokeWidth,
  STAGE_SEGMENT_STATES,
  stageSegmentParts,
  startBand,
  startMarkerParts,
  type PipPart,
  type PipState,
} from '../geometry';

/**
 * F-ROUTE-001 R-2b (section 3.4, 3.14; design/components/PipRow/spec.md):
 * five drawn pip shapes, a cursor marker and a start marker. Pure geometry,
 * so it is tested here without a renderer.
 */

const SIZES = [PIP_SIZE.stage, PIP_SIZE.cell, 30] as const;

function circles(parts: readonly PipPart[]): Extract<PipPart, { kind: 'circle' }>[] {
  return parts.filter((p): p is Extract<PipPart, { kind: 'circle' }> => p.kind === 'circle');
}

function paths(parts: readonly PipPart[]): Extract<PipPart, { kind: 'path' }>[] {
  return parts.filter((p): p is Extract<PipPart, { kind: 'path' }> => p.kind === 'path');
}

/** Every number in a path string. */
function coords(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

/** The shape with every ink replaced by one colour: what a greyscale or colour-blind reader is left with. */
function silhouette(parts: readonly PipPart[]): string {
  return JSON.stringify(
    parts.map((p) => ({
      ...p,
      fill: p.fill === 'none' ? 'none' : 'ink',
      ...(p.stroke === undefined ? {} : { stroke: 'ink' }),
    })),
  );
}

describe('sizes (section 3.4)', () => {
  it('is 20 dp in a stage row and 24 dp in a cell row', () => {
    expect(PIP_SIZE).toEqual({ stage: 20, cell: 24 });
  });

  it('strokes at 2 dp at 20 dp and never thinner', () => {
    expect(pipStrokeWidth(20)).toBe(2);
    expect(pipStrokeWidth(24)).toBeCloseTo(2.4, 5);
    expect(pipStrokeWidth(12)).toBe(2);
  });
});

describe('the five pip shapes', () => {
  it('has exactly the five states of the spec', () => {
    expect([...PIP_STATES]).toEqual(['done', 'known', 'open', 'new', 'later']);
  });

  it.each(SIZES)('every part fits inside the %i dp box, stroke included', (size) => {
    for (const state of PIP_STATES) {
      for (const c of circles(pipParts(state, size))) {
        const half = (c.strokeWidth ?? 0) / 2;
        expect(c.cx - c.r - half, state).toBeGreaterThanOrEqual(-1e-9);
        expect(c.cx + c.r + half, state).toBeLessThanOrEqual(size + 1e-9);
        expect(c.cy - c.r - half, state).toBeGreaterThanOrEqual(-1e-9);
        expect(c.cy + c.r + half, state).toBeLessThanOrEqual(size + 1e-9);
      }
      for (const p of paths(pipParts(state, size))) {
        for (const n of coords(p.d)) {
          expect(n, state).toBeGreaterThanOrEqual(0);
          expect(n, state).toBeLessThanOrEqual(size);
        }
      }
    }
  });

  it.each(SIZES)('done: a filled disc in the accent, edged in the mark colour, with a check drawn inside it in ink (%i dp)', (size) => {
    const [disc, check, ...rest] = pipParts('done', size);
    expect(rest).toEqual([]);
    expect(disc).toMatchObject({ kind: 'circle', cx: size / 2, cy: size / 2, fill: 'accent', stroke: 'mark' });
    expect(check).toMatchObject({ kind: 'path', fill: 'none', stroke: 'ink' });
    if (disc?.kind !== 'circle' || check?.kind !== 'path') throw new Error('disc and path expected');
    // An open stroke of three points (no Z): a check, not a closed sparkle or a disc.
    expect(check.d).not.toMatch(/Z/);
    const xy = coords(check.d);
    expect(xy).toHaveLength(6);
    expect(check.strokeWidth).toBeGreaterThanOrEqual(pipStrokeWidth(size) * 0.9);
    // Every point plus half the stroke stays inside the disc, clear of its edge.
    const fillEdge = disc.r - (disc.strokeWidth ?? 0) / 2;
    for (let i = 0; i < xy.length; i += 2) {
      expect(Math.hypot(xy[i]! - size / 2, xy[i + 1]! - size / 2) + (check.strokeWidth ?? 0) / 2).toBeLessThan(fillEdge);
    }
    // Wide enough to read as a mark at 20 dp, not a speck.
    const xs = xy.filter((_, i) => i % 2 === 0);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(size * 0.4);
  });

  it('open: one ring, 2 dp stroke, no fill', () => {
    const parts = pipParts('open', 20);
    expect(parts).toEqual([{ kind: 'circle', cx: 10, cy: 10, r: 9, fill: 'none', stroke: 'mark', strokeWidth: 2 }]);
  });

  it.each(SIZES)('known: the ring plus a solid inner disc half the diameter, with a visible gap (%i dp)', (size) => {
    const [ring, inner, ...rest] = pipParts('known', size);
    expect(rest).toEqual([]);
    expect(ring).toMatchObject({ kind: 'circle', fill: 'none', stroke: 'mark' });
    expect(inner).toMatchObject({ kind: 'circle', fill: 'mark', cx: size / 2, cy: size / 2 });
    if (ring?.kind !== 'circle' || inner?.kind !== 'circle') throw new Error('circles expected');
    expect(inner.r * 2).toBeCloseTo(size / 2, 5);
    const ringInnerEdge = ring.r - (ring.strokeWidth ?? 0) / 2;
    expect(ringInnerEdge - inner.r).toBeGreaterThanOrEqual(1);
  });

  it.each(SIZES)('new: the ring plus a four-point sparkle drawn inside it (%i dp)', (size) => {
    const [ring, sparkle, ...rest] = pipParts('new', size);
    expect(rest).toEqual([]);
    expect(ring).toMatchObject({ kind: 'circle', fill: 'none', stroke: 'mark' });
    expect(sparkle).toMatchObject({ kind: 'path', fill: 'mark' });
    if (ring?.kind !== 'circle' || sparkle?.kind !== 'path') throw new Error('ring and path expected');
    const ringInnerEdge = ring.r - (ring.strokeWidth ?? 0) / 2;
    const xy = coords(sparkle.d);
    const points: Array<[number, number]> = [];
    for (let i = 0; i < xy.length; i += 2) points.push([xy[i]!, xy[i + 1]!]);
    expect(points).toHaveLength(8); // four tips and four waists
    const reach = Math.max(...points.map(([x, y]) => Math.hypot(x - size / 2, y - size / 2)));
    expect(reach).toBeLessThan(ringInnerEdge - 0.5);
    expect(reach).toBeGreaterThan(size / 5); // large enough to read as a sparkle, not a dot
  });

  it.each(SIZES)('later: a dotted ring of at least 4 visible dashes, each longer than the stroke is wide (%i dp)', (size) => {
    const parts = pipParts('later', size);
    expect(parts).toHaveLength(1);
    const ring = parts[0];
    if (ring?.kind !== 'circle' || ring.dash === undefined) throw new Error('dashed ring expected');
    expect(ring).toMatchObject({ fill: 'none', stroke: 'mark' });
    const [on, off] = ring.dash;
    const dashes = (2 * Math.PI * ring.r) / (on + off);
    expect(LATER_DASHES).toBeGreaterThanOrEqual(4);
    expect(dashes).toBeCloseTo(LATER_DASHES, 5);
    expect(on).toBeGreaterThan(ring.strokeWidth ?? 0);
    expect(off).toBeGreaterThan(1);
  });

  it.each(SIZES)('the five shapes differ in geometry, not in ink: outline and interior mark, accent ignored (%i dp)', (size) => {
    const signatures = PIP_STATES.map((state) => {
      const [outer, ...inside] = pipParts(state, size);
      if (outer?.kind !== 'circle') throw new Error('outer circle expected');
      // The outline with the fill treated as unknown: a greyscale or colour-blind reader may not see the accent.
      const outline = outer.dash !== undefined ? 'dashed ring' : 'ring';
      const interior = inside.map((p) => (p.kind === 'circle' ? 'disc' : p.fill === 'none' ? 'stroke' : 'filled path'));
      return { state, key: `${outline}|${interior.join('+')}`, inside };
    });
    expect(new Set(signatures.map((s) => s.key)).size).toBe(PIP_STATES.length);
    // Every interior mark is drawn in a non-accent ink, so the mark (not the colour) carries the state.
    for (const { state, inside } of signatures) {
      for (const p of inside) {
        expect(p.fill === 'accent' || p.stroke === 'accent', state).toBe(false);
        expect(p.fill === 'paper' || p.stroke === 'paper', state).toBe(false);
      }
    }
    // done is told from open by its check, which open does not have, not by the fill alone.
    expect(signatures.find((s) => s.state === 'done')!.inside.length).toBeGreaterThan(0);
    expect(signatures.find((s) => s.state === 'open')!.inside).toEqual([]);
  });

  // Spec 3.14: the stage colour decorates. Whatever accent fills a done disc
  // (every stage colour, or the default), the check that carries "done" holds
  // 3:1 against that fill, and the edge holds 3:1 against every surface.
  const accents = { ...Object.fromEntries(Object.entries(colors.stage).map(([k, v]) => [`stage.${k}`, v])), 'default (border.shape)': colors.border.shape };
  it.each(Object.entries(accents))('done on a %s fill: the check holds 3:1 against the fill (non-text)', (_name, accent) => {
    const marks = pipParts('done', 20).slice(1);
    expect(marks.length).toBeGreaterThan(0);
    for (const p of marks) {
      const ink = p.stroke ?? p.fill;
      if (ink === 'none') throw new Error('a mark needs an ink');
      expect(contrastRatio(pipInk(ink, accent), accent)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    }
  });

  it.each([colors.surface.paper, colors.surface.canvas, colors.surface.sunken, colors.brand.primaryLight])(
    'done: the disc edge holds 3:1 against the surface %s whatever the fill',
    (surface) => {
      const [disc] = pipParts('done', 20);
      expect(disc).toMatchObject({ stroke: 'mark' });
      expect(contrastRatio(pipInk('mark', colors.stage.stage2), surface)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    },
  );

  it('only a done pip uses the accent: the stage colour decorates, the shape carries the meaning', () => {
    for (const state of PIP_STATES.filter((s): s is Exclude<PipState, 'done'> => s !== 'done')) {
      const inks = pipParts(state, 20).flatMap((p) => [p.fill, p.stroke]);
      expect(inks, state).not.toContain('accent');
    }
  });
});

describe('inks resolve to tokens', () => {
  it('mark is the shape border token, ink is the primary text colour, paper is the card surface', () => {
    expect(pipInk('mark', colors.stage.stage1)).toBe(colors.border.shape);
    expect(pipInk('ink', colors.stage.stage1)).toBe(colors.text.primary);
    expect(pipInk('paper', colors.stage.stage1)).toBe(colors.surface.paper);
    expect(pipInk('accent', colors.stage.stage4)).toBe(colors.stage.stage4);
    expect(pipInk('none', colors.stage.stage4)).toBe('none');
  });
});

describe('cursor and start markers', () => {
  it.each(SIZES)('the cursor band is under half the pip; the start band is taller but under the pip (%i dp)', (size) => {
    expect(markerBand(size)).toBeGreaterThan(0);
    expect(markerBand(size)).toBeLessThan(size / 2 + 1);
    expect(startBand(size)).toBeGreaterThan(markerBand(size));
    expect(startBand(size)).toBeLessThan(size);
  });

  it.each(SIZES)('cursor: a solid triangle centred over the pip, pointing down at it (%i dp)', (size) => {
    const parts = cursorMarkerParts(size);
    expect(parts).toHaveLength(1);
    const [tri] = paths(parts);
    expect(tri).toMatchObject({ fill: 'ink' });
    const xy = coords(tri!.d);
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < xy.length; i += 2) pts.push([xy[i]!, xy[i + 1]!]);
    expect(pts).toHaveLength(3);
    const tip = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
    expect(tip[0]).toBeCloseTo(size / 2, 5);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(size);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(markerBand(size));
    }
    // The tip is the lowest point and stops short of the band edge, so it never touches the pip.
    expect(tip[1]).toBeLessThan(markerBand(size));
  });

  it.each(SIZES)('start: a solid map-pin drop with a paper dot, inside its band (%i dp)', (size) => {
    const parts = startMarkerParts(size);
    const [drop] = paths(parts);
    const [dot] = circles(parts);
    expect(drop).toMatchObject({ fill: 'ink' });
    expect(dot).toMatchObject({ fill: 'paper' });
    for (const n of coords(drop!.d)) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(Math.max(size, startBand(size)));
    }
    const ys = coords(drop!.d).filter((_, i) => i % 2 === 1);
    // At least 12 dp tall at a 20 dp pip, so the pin reads (design pass, spec assumption a).
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(size * 0.6);
    expect(dot!.cx).toBeCloseTo(size / 2, 5);
    expect(dot!.cy + dot!.r).toBeLessThanOrEqual(startBand(size));
  });

  it('cursor and start markers are different shapes', () => {
    expect(silhouette(cursorMarkerParts(20))).not.toBe(silhouette(startMarkerParts(20)));
  });
});

describe('pipRowCells: one wrapping row, a wider gap between groups', () => {
  // The group gap trails the last pip of a group, so a group that starts a
  // new wrapped line starts flush with the lines above (no indent).
  const gaps = { pip: 4, group: 12 };

  it('keeps every pip in order with its state and markers', () => {
    const cells = pipRowCells(
      [
        [
          { key: 'a', state: 'done' },
          { key: 'b', state: 'open', isCursor: true },
        ],
        [{ key: 'c', state: 'later' }],
      ],
      gaps,
    );
    expect(cells).toEqual([
      { key: 'a', state: 'done', isCursor: false, isStart: false, trailingGap: 4 },
      { key: 'b', state: 'open', isCursor: true, isStart: false, trailingGap: 12 },
      { key: 'c', state: 'later', isCursor: false, isStart: false, trailingGap: 0 },
    ]);
  });

  it('skips empty groups, so no doubled gap and no gap after the last pip', () => {
    const cells = pipRowCells([[], [{ key: 'a', state: 'new', isStart: true }], [], [{ key: 'b', state: 'new' }], []], gaps);
    expect(cells.map((c) => [c.key, c.trailingGap, c.isStart])).toEqual([
      ['a', 12, true],
      ['b', 0, false],
    ]);
  });

  it('is empty for no pips', () => {
    expect(pipRowCells([], gaps)).toEqual([]);
    expect(pipRowCells([[]], gaps)).toEqual([]);
  });
});

describe('pipRowBands: marker room is reserved only when a marker is drawn', () => {
  it('reserves the top band for a cursor and the bottom band for a start', () => {
    expect(pipRowBands([[{ key: 'a', state: 'open' }]])).toEqual({ top: false, bottom: false });
    expect(pipRowBands([[{ key: 'a', state: 'open', isCursor: true }]])).toEqual({ top: true, bottom: false });
    expect(pipRowBands([[{ key: 'a', state: 'known' }], [{ key: 'b', state: 'open', isStart: true }]])).toEqual({ top: false, bottom: true });
  });
});

describe('pipRowLines: the lines a measured row wraps into, each with only the marker bands its own pips use', () => {
  const gaps = { pip: 4, group: 12 };
  const open = (key: string, extra: { isCursor?: boolean; isStart?: boolean } = {}) => ({ key, state: 'open' as const, ...extra });

  it('fits as many pips on a line as the width holds, gaps between them, and wraps the rest', () => {
    // 15 pips of 20 with 4 between: 10 fit in 236 (10 x 20 + 9 x 4), the 11th would need 260.
    const cells = pipRowCells([Array.from({ length: 15 }, (_, i) => open(`q${i}`, i === 1 ? { isCursor: true } : i === 0 ? { isStart: true } : {}))], gaps);
    const lines = pipRowLines(cells, 236, 20, gaps.pip);
    expect(lines.map((l) => l.cells.length)).toEqual([10, 5]);
    expect(lines.map((l) => l.cells.map((c) => c.key)).flat()).toEqual(cells.map((c) => c.key));
    // The cursor and the start sit on the first line: the second line reserves no band.
    expect(lines.map((l) => l.bands)).toEqual([
      { top: true, bottom: true },
      { top: false, bottom: false },
    ]);
    expect(pipRowLines(cells, 235, 20, gaps.pip).map((l) => l.cells.length)).toEqual([9, 6]);
  });

  it('counts the group gap that trails a pip, so a group that wraps starts flush left', () => {
    const cells = pipRowCells([[open('a'), open('b')], [open('c', { isCursor: true })]], gaps);
    // a (20) + 4 + b (20 + the extra 8 of the group gap) = 52; c needs 4 + 20 more.
    expect(pipRowLines(cells, 75, 20, gaps.pip).map((l) => [l.cells.map((c) => c.key), l.bands])).toEqual([
      [['a', 'b'], { top: false, bottom: false }],
      [['c'], { top: true, bottom: false }],
    ]);
    expect(pipRowLines(cells, 76, 20, gaps.pip).map((l) => l.cells.length)).toEqual([3]);
  });

  it('puts a pip wider than the width on a line of its own, and gives no line for no pips', () => {
    expect(pipRowLines(pipRowCells([[open('a'), open('b')]], gaps), 10, 20, gaps.pip).map((l) => l.cells.length)).toEqual([1, 1]);
    expect(pipRowLines([], 236, 20, gaps.pip)).toEqual([]);
  });
});

describe('stageSegmentParts: the seven-segment overview (section 3.x coming-later rows; the Home strip and the console strip)', () => {
  const signature = (parts: PipPart[]): string =>
    parts.map((p) => (p.kind === 'circle' ? `c:${p.fill}:${p.stroke ?? ''}:${p.dash ? 'dash' : ''}` : `p:${p.fill}:${p.stroke ?? ''}`)).join('|');

  it('maps complete, known, open and later to the pip shapes of the same meaning', () => {
    expect(stageSegmentParts('complete', 20)).toEqual(pipParts('done', 20));
    expect(stageSegmentParts('known', 20)).toEqual(pipParts('known', 20));
    expect(stageSegmentParts('open', 20)).toEqual(pipParts('open', 20));
    expect(stageSegmentParts('later', 20)).toEqual(pipParts('later', 20));
  });

  it('draws explored as the check of a done pip without its disc, so it never reads as complete', () => {
    const explored = stageSegmentParts('explored', 20);
    expect(explored).toEqual(pipParts('done', 20).filter((p) => p.kind === 'path'));
    expect(explored.some((p) => p.kind === 'circle' && p.fill === 'accent')).toBe(false);
  });

  it('gives every state its own geometry (meaning in the shape, not the colour)', () => {
    const signatures = STAGE_SEGMENT_STATES.map((state) => signature(stageSegmentParts(state, 20)));
    expect(new Set(signatures).size).toBe(STAGE_SEGMENT_STATES.length);
    expect([...STAGE_SEGMENT_STATES]).toEqual(['complete', 'known', 'explored', 'open', 'later']);
  });
});

describe('drawn, never typed (section 3.4)', () => {
  const sources: Record<string, string> = {
    'Pip.tsx': pipSource,
    'PipRow.tsx': pipRowSource,
    'geometry.ts': geometrySource,
    'types.ts': typesSource,
    'index.ts': indexSource,
    'StageSegments.tsx': segmentsSource,
  };

  it.each(Object.keys(sources))('%s has no arrow, shape, dingbat or emoji-capable character', (name) => {
    const text = sources[name]!;
    // U+25A0-25FF geometric shapes (U+25B6, U+25C0, U+25BC ...), U+2190-21FF arrows,
    // U+2600-27BF symbols and dingbats, U+2B00-2BFF, and anything emoji-capable.
    expect(text).not.toMatch(/[←-⇿■-◿☀-➿⬀-⯿]/u);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('the components draw with svg only and never render text', () => {
    for (const source of [pipSource, pipRowSource, segmentsSource]) {
      expect(source).not.toMatch(/\bText\b/);
      expect(source).toMatch(/from 'react-native-svg'/);
    }
  });

  it('the row and the single pip hide their shapes from screen readers on native and web (the stage row label carries the facts)', () => {
    for (const source of [pipRowSource, pipSource, segmentsSource]) {
      expect(source).toMatch(/importantForAccessibility="no-hide-descendants"/);
      expect(source).toMatch(/accessibilityElementsHidden/);
      // react-native-web maps only aria-hidden to the DOM, not the two native props.
      expect(source).toMatch(/aria-hidden/);
    }
  });

  it('uses tokens only: no colour literal in the components', () => {
    for (const source of [pipSource, pipRowSource, geometrySource, segmentsSource]) {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toMatch(/rgba?\(/);
    }
  });
});
