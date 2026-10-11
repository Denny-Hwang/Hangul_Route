import { describe, expect, it } from 'vitest';
import pipSource from '../Pip.tsx?raw';
import pipRowSource from '../PipRow.tsx?raw';
import geometrySource from '../geometry.ts?raw';
import typesSource from '../types.ts?raw';
import indexSource from '../index.ts?raw';
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
  pipStrokeWidth,
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

  it('done: one filled disc in the accent, edged in the mark colour so its edge holds 3:1 whatever the accent', () => {
    const parts = pipParts('done', 20);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ kind: 'circle', cx: 10, cy: 10, fill: 'accent', stroke: 'mark' });
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

  it('the five shapes are pairwise distinct with colour taken away (greyscale, protanopia)', () => {
    for (const size of SIZES) {
      const shapes = PIP_STATES.map((state) => silhouette(pipParts(state, size)));
      expect(new Set(shapes).size).toBe(PIP_STATES.length);
    }
  });

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

describe('drawn, never typed (section 3.4)', () => {
  const sources: Record<string, string> = {
    'Pip.tsx': pipSource,
    'PipRow.tsx': pipRowSource,
    'geometry.ts': geometrySource,
    'types.ts': typesSource,
    'index.ts': indexSource,
  };

  it.each(Object.keys(sources))('%s has no arrow, shape, dingbat or emoji-capable character', (name) => {
    const text = sources[name]!;
    // U+25A0-25FF geometric shapes (U+25B6, U+25C0, U+25BC ...), U+2190-21FF arrows,
    // U+2600-27BF symbols and dingbats, U+2B00-2BFF, and anything emoji-capable.
    expect(text).not.toMatch(/[←-⇿■-◿☀-➿⬀-⯿]/u);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('the components draw with svg only and never render text', () => {
    for (const source of [pipSource, pipRowSource]) {
      expect(source).not.toMatch(/\bText\b/);
      expect(source).toMatch(/from 'react-native-svg'/);
    }
  });

  it('the row and the single pip hide their shapes from screen readers on native and web (the stage row label carries the facts)', () => {
    for (const source of [pipRowSource, pipSource]) {
      expect(source).toMatch(/importantForAccessibility="no-hide-descendants"/);
      expect(source).toMatch(/accessibilityElementsHidden/);
      // react-native-web maps only aria-hidden to the DOM, not the two native props.
      expect(source).toMatch(/aria-hidden/);
    }
  });

  it('uses tokens only: no colour literal in the components', () => {
    for (const source of [pipSource, pipRowSource, geometrySource]) {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toMatch(/rgba?\(/);
    }
  });
});
