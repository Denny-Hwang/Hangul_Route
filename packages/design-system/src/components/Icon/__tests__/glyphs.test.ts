import { describe, expect, it } from 'vitest';
import { iconGlyphs, iconNames } from '../glyphs';
import type { IconGlyphPart } from '../glyphs';
import type { IconName } from '../types';

const EXPECTED_NAMES: IconName[] = [
  'play',
  'pause',
  'speaker',
  'speaker-off',
  'replay',
  'check',
  'close',
  'arrow-left',
  'arrow-right',
  'lock',
  'star',
  'card',
  'home',
  'journey',
  'library',
  'parent',
  'settings',
  'profile',
  'plus',
  'sparkle',
  'pin',
  'check-circle',
  'book',
  'ear',
  'pencil',
  'dash',
  'note',
  'heart',
  'route',
  'flag',
  'shift',
  'shift-on',
  'backspace',
];

describe('icon glyphs', () => {
  it('covers every IconName with at least one part', () => {
    expect([...iconNames].sort()).toEqual([...EXPECTED_NAMES].sort());
    for (const name of EXPECTED_NAMES) {
      expect(iconGlyphs[name].length, name).toBeGreaterThan(0);
    }
  });

  it('every part has valid path data', () => {
    for (const name of iconNames) {
      for (const part of iconGlyphs[name]) {
        expect(part.d, name).toMatch(/^M/);
        expect(part.d.trim().length, name).toBeGreaterThan(5);
      }
    }
  });

  it('every glyph is visually distinct (no copy-paste placeholders)', () => {
    // Guards against the v1 placeholder regression where `parent` and
    // `settings` were the same bare circle.
    const serialized = iconNames.map((name) => JSON.stringify(iconGlyphs[name]));
    expect(new Set(serialized).size).toBe(iconNames.length);
  });

  it('all coordinates stay inside the 24x24 viewBox', () => {
    for (const name of iconNames) {
      for (const part of iconGlyphs[name]) {
        // Strip arc rotation/flag triplets ("0 0 1" / "0 1 0") before checking
        // coordinates; remaining numbers must land in the canvas.
        const coords = part.d
          .replace(/A\s*([\d.]+)\s+([\d.]+)\s+\d+\s+\d\s+\d/g, 'A $1 $2')
          .match(/-?\d+(\.\d+)?/g);
        expect(coords, name).not.toBeNull();
        for (const raw of coords ?? []) {
          const value = Number(raw);
          expect(value, `${name}: ${raw}`).toBeGreaterThanOrEqual(0);
          expect(value, `${name}: ${raw}`).toBeLessThanOrEqual(24);
        }
      }
    }
  });

  it('stroke widths stay in the readable 1.5–3 band', () => {
    for (const name of iconNames) {
      for (const part of iconGlyphs[name]) {
        if (part.kind === 'stroke' && part.width !== undefined) {
          expect(part.width, name).toBeGreaterThanOrEqual(1.5);
          expect(part.width, name).toBeLessThanOrEqual(3);
        }
      }
    }
  });

  it('speaker-off keeps the speaker body and swaps the waves for a cross (a mute sign, not a miss)', () => {
    const body = iconGlyphs.speaker[0];
    expect(iconGlyphs['speaker-off'][0]).toEqual(body);
    const strokes = iconGlyphs['speaker-off'].filter((part) => part.kind === 'stroke');
    expect(strokes).toHaveLength(2);
  });
});

describe('My route glyphs (F-ROUTE-001 R-2a; design/components/Icon/spec.md)', () => {
  const ROUTE_GLYPHS: IconName[] = ['pin', 'check-circle', 'book', 'ear', 'pencil'];
  const strokes = (name: IconName) => iconGlyphs[name].filter((part) => part.kind === 'stroke');
  const fills = (name: IconName) => iconGlyphs[name].filter((part) => part.kind === 'fill');
  /** Every on-path point of a path, in order (arc radii, rotation and flags dropped). */
  const points = (d: string): [number, number][] => {
    const numbers = d.replace(/A\s*[\d.]+\s+[\d.]+\s+\d+\s+\d\s+\d/g, ' ').match(/-?\d+(\.\d+)?/g) ?? [];
    const out: [number, number][] = [];
    for (let i = 0; i + 1 < numbers.length; i += 2) out.push([Number(numbers[i]), Number(numbers[i + 1])]);
    return out;
  };
  /** Centre and radius of a half-turn arc `x1 y1 A r r 0 f s x2 y2` (the circle() helper and the pin top). */
  const arc = (d: string) => {
    const match = /(-?[\d.]+) (-?[\d.]+) A([\d.]+) [\d.]+ 0 \d \d (-?[\d.]+) (-?[\d.]+)/.exec(d);
    if (!match) throw new Error(`no arc in ${d}`);
    const [x1, y1, r, x2, y2] = match.slice(1).map(Number) as [number, number, number, number, number];
    return { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, r };
  };
  const GAP = 0.5; // visible gap between two drawn parts at 20 dp

  it('adds the five glyphs the page, the placement start pin and the skill rows use', () => {
    for (const name of ROUTE_GLYPHS) expect(iconNames, name).toContain(name);
  });

  it('draws them as outlines at the hairline-safe stroke width (2 to 2.6) so they hold at 20 dp', () => {
    for (const name of ROUTE_GLYPHS) {
      expect(strokes(name).length, name).toBeGreaterThan(0);
      for (const part of strokes(name)) {
        const width = part.width ?? 2;
        expect(width, name).toBeGreaterThanOrEqual(2);
        expect(width, name).toBeLessThanOrEqual(2.6);
      }
    }
  });

  it('pin is a closed outlined drop with a solid dot that sits inside it with a gap (the "You started here" tag)', () => {
    const [drop] = strokes('pin');
    const [dot] = fills('pin');
    expect(strokes('pin')).toHaveLength(1);
    expect(fills('pin')).toHaveLength(1);
    expect(drop?.d).toMatch(/Z$/);
    const outline = points(drop?.d ?? '');
    expect(outline[0]).toEqual(outline[outline.length - 1]);
    const head = arc(drop?.d ?? '');
    const centre = arc(dot?.d ?? '');
    const halfStroke = (drop?.kind === 'stroke' ? drop.width ?? 2 : 2) / 2;
    expect(Math.hypot(centre.cx - head.cx, centre.cy - head.cy) + centre.r + halfStroke + GAP).toBeLessThanOrEqual(head.r);
  });

  it('check-circle is a check mark inside a closed ring with a visible gap, not the bare check (the Complete badge)', () => {
    const [ring, mark] = strokes('check-circle');
    expect(strokes('check-circle')).toHaveLength(2);
    expect(fills('check-circle')).toHaveLength(0);
    expect(ring?.d).toMatch(/A9 9 0 1 0 .*A9 9 0 1 0 .*Z$/);
    expect(mark?.d).toMatch(/^M\S+ \S+ L\S+ \S+ L\S+ \S+$/);
    expect(mark?.d).not.toEqual(iconGlyphs.check[0]?.d);
    const { cx, cy, r } = arc(ring?.d ?? '');
    const ringInner = r - (ring?.width ?? 2) / 2;
    const markHalf = (mark?.width ?? 2) / 2;
    for (const [x, y] of points(mark?.d ?? '')) {
      expect(Math.hypot(x - cx, y - cy) + markHalf, `${x},${y}`).toBeLessThanOrEqual(ringInner - GAP);
    }
  });

  it('ear is a rim, an inner curl that closes on itself and two sound waves, so no part ends in a question-mark tail (Listen)', () => {
    const [rim, curl, ...waves] = strokes('ear');
    expect(rim).toBeDefined();
    expect(waves).toHaveLength(2);
    const loop = points(curl?.d ?? '');
    const [sx, sy] = loop[0] ?? [0, 0];
    const [ex, ey] = loop[loop.length - 1] ?? [99, 99];
    // the curl ends back against its own start (within one stroke width), not on a free downward hook
    expect(Math.hypot(ex - sx, ey - sy)).toBeLessThanOrEqual(curl?.width ?? 2);
  });

  it('book, ear and pencil are line drawings with no solid parts (Read, Listen, Write)', () => {
    for (const name of ['book', 'ear', 'pencil'] as const) expect(fills(name), name).toHaveLength(0);
    // the open book has a spine; the pencil a separate tip and ferrule line
    expect(strokes('book')).toHaveLength(2);
    expect(strokes('pencil')).toHaveLength(3);
  });
});

describe('the miss dash (F-VOC-004 §3.6, §3.8; design/components/Icon/spec.md)', () => {
  it('is one short horizontal stroke across the centre, shorter than the plus bar, with no fill', () => {
    const parts = iconGlyphs.dash;
    expect(parts).toHaveLength(1);
    const [bar] = parts;
    expect(bar?.kind).toBe('stroke');
    const match = /^M(\S+) (\S+) H(\S+)$/.exec(bar?.d ?? '');
    expect(match, bar?.d).not.toBeNull();
    const [x1, y, x2] = (match ?? []).slice(1).map(Number) as [number, number, number];
    expect(y).toBe(12);
    expect(x1 + x2).toBe(24);
    expect(x2 - x1).toBeLessThan(14);
    expect(x2 - x1).toBeGreaterThanOrEqual(8);
    expect(bar?.kind === 'stroke' ? bar.width : undefined).toBeGreaterThanOrEqual(2.4);
  });

  it('never reads as a cross, a close mark or a plus', () => {
    expect(iconGlyphs.dash).not.toEqual(iconGlyphs.close);
    expect(iconGlyphs.dash).not.toEqual(iconGlyphs.plus);
    expect(iconGlyphs.dash.some((part) => /V/.test(part.d))).toBe(false);
  });
});

describe('notes glyphs (F-FEEDBACK-001 FB-6; design/components/Icon/spec.md)', () => {
  const NOTES_GLYPHS: IconName[] = ['note', 'heart'];
  const strokes = (name: IconName) => iconGlyphs[name].filter((part) => part.kind === 'stroke');
  /** Every point of an absolute M / L / C / A / Z path in drawing order, Bezier control points included (arc radii, rotation and flags dropped). */
  const points = (d: string): [number, number][] => {
    expect(d, 'absolute M / L / C / A / Z commands only').toMatch(/^[MLCAZ\d.\s-]+$/);
    const numbers = d.replace(/A\s*[\d.]+\s+[\d.]+\s+\d+\s+\d\s+\d/g, ' ').match(/-?\d+(\.\d+)?/g) ?? [];
    const out: [number, number][] = [];
    for (let i = 0; i + 1 < numbers.length; i += 2) out.push([Number(numbers[i]), Number(numbers[i + 1])]);
    return out;
  };
  const widthOf = (part: IconGlyphPart | undefined): number => (part?.kind === 'stroke' ? part.width ?? 2 : 0);
  const GAP = 1; // clear space between two drawn parts on the 24 grid (about 0.8 dp at 20 dp)

  it('adds the note (Home card, notes list, grown-up rows) and the heart (the Thank you answer)', () => {
    for (const name of NOTES_GLYPHS) expect(iconNames, name).toContain(name);
  });

  it('draws both with the stroke helper only: outline parts, no solid fill, at the hairline-safe width 2 to 2.6', () => {
    for (const name of NOTES_GLYPHS) {
      expect(iconGlyphs[name].length, name).toBeGreaterThan(0);
      for (const part of iconGlyphs[name]) {
        // exactly the shape `stroke(d)` / `stroke(d, width)` returns: no fill part, no extra key
        expect(part.kind, name).toBe('stroke');
        expect(Object.keys(part).sort(), name).toEqual('width' in part ? ['d', 'kind', 'width'] : ['d', 'kind']);
        expect(widthOf(part), name).toBeGreaterThanOrEqual(2);
        expect(widthOf(part), name).toBeLessThanOrEqual(2.6);
      }
    }
  });

  it('heart is one closed outline, mirror-symmetric on the centre line, two round lobes and a tip at the bottom', () => {
    const [outline] = strokes('heart');
    expect(iconGlyphs.heart).toHaveLength(1);
    const d = outline?.d ?? '';
    expect(d).toMatch(/Z$/);
    expect(d.match(/A/g)).toHaveLength(2);
    // each lobe is a level half circle drawn over the top, and the two meet on the centre line
    const chunks = d.split('A');
    const lobes = chunks.slice(1).map((chunk, i) => {
      const before = (chunks[i]?.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      const [rx, ry, , large, sweep, x2, y2] = (chunk.match(/-?\d+(\.\d+)?/g) ?? []).map(Number) as [number, number, number, number, number, number, number];
      return { rx, ry, large, sweep, x1: before[before.length - 2] ?? 0, y1: before[before.length - 1] ?? 0, x2, y2 };
    });
    for (const { rx, ry, large, sweep, x1, y1, x2, y2 } of lobes) {
      expect(rx).toBe(ry);
      expect(y1).toBe(y2);
      expect(Math.hypot(x2 - x1, y2 - y1)).toBe(2 * rx);
      // left to right with a clockwise sweep (y down) bulges upward: the lobe sits over the top, not under it
      expect(x2).toBeGreaterThan(x1);
      expect(sweep).toBe(1);
      expect(large).toBe(0);
    }
    expect(lobes[0]?.x2).toBe(12);
    expect(lobes[1]?.x1).toBe(12);
    const path = points(d);
    expect(path[0]).toEqual(path[path.length - 1]);
    // walking it backwards and mirroring x gives the same path, control points included: the halves match
    const mirrored = [...path].reverse().map(([x, y]) => [24 - x, y]);
    expect(mirrored).toEqual(path);
    // the tip is the one lowest point (the curves stay inside their control points) and sits on the centre line
    const lowest = Math.max(...path.map(([, y]) => y));
    const tips = new Set(path.filter(([, y]) => y === lowest).map(([x]) => x));
    expect([...tips]).toEqual([12]);
    // a broad open shape (the no-fill rule above keeps it from reading as a game "life");
    // this is the span of the path's points (ends and control points), not the drawn outline width
    const xs = path.map(([x]) => x);
    const controlSpan = Math.max(...xs) - Math.min(...xs);
    expect(controlSpan).toBeGreaterThanOrEqual(14);
  });

  it('note is a portrait sheet with a folded corner and two text lines that stay clear of its edges', () => {
    const [sheet, fold, ...lines] = strokes('note');
    expect(lines).toHaveLength(2);
    const outline = points(sheet?.d ?? '');
    expect(sheet?.d).toMatch(/Z$/);
    const xs = outline.map(([x]) => x);
    const ys = outline.map(([, y]) => y);
    const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    // portrait (taller than wide), so it never reads as the landscape `card`
    expect(bottom - top).toBeGreaterThan(right - left);
    expect((left + right) / 2).toBe(12);
    // the cut corner: the only diagonal edge of the sheet, at the top right
    const edges = outline.map((point, i) => [point, outline[(i + 1) % outline.length] ?? point] as const);
    const diagonals = edges.filter(([[x1, y1], [x2, y2]]) => x1 !== x2 && y1 !== y2);
    expect(diagonals).toHaveLength(1);
    const [cutStart, cutEnd] = diagonals[0] ?? [[0, 0], [0, 0]];
    expect(cutStart).toEqual([cutEnd[0] - (cutEnd[1] - cutStart[1]), top]);
    expect(cutEnd).toEqual([right, cutEnd[1]]);
    // the fold runs from one end of the cut to the other through the corner inside the sheet
    const foldPoints = points(fold?.d ?? '');
    expect(foldPoints).toEqual([cutStart, [cutStart[0], cutEnd[1]], cutEnd]);
    // the text lines are level, below the fold, inside the sheet with a visible gap, and apart from each other
    const sheetInset = widthOf(sheet) / 2;
    const ysOfLines: number[] = [];
    for (const line of lines) {
      const [[x1, y1] = [0, 0], [x2, y2] = [0, 0], ...rest] = points(line?.d ?? '');
      expect(rest).toHaveLength(0);
      expect(y1).toBe(y2);
      const half = widthOf(line) / 2;
      expect(Math.min(x1, x2) - half).toBeGreaterThanOrEqual(left + sheetInset + GAP);
      expect(Math.max(x1, x2) + half).toBeLessThanOrEqual(right - sheetInset - GAP);
      expect(y1 - half).toBeGreaterThanOrEqual(cutEnd[1] + widthOf(fold) / 2 + GAP);
      expect(y1 + half).toBeLessThanOrEqual(bottom - sheetInset - GAP);
      ysOfLines.push(y1);
    }
    const [firstY = 0, secondY = 0] = ysOfLines;
    expect(Math.abs(secondY - firstY) - widthOf(lines[0]) / 2 - widthOf(lines[1]) / 2).toBeGreaterThanOrEqual(GAP);
  });
});

describe('Learning Route glyphs (AMENDMENTS-ROUTE-LEARNING-ROUTE LR-2; design/components/Icon/learning-route-glyphs.md)', () => {
  const strokes = (name: IconName) => iconGlyphs[name].filter((part) => part.kind === 'stroke');
  const fills = (name: IconName) => iconGlyphs[name].filter((part) => part.kind === 'fill');
  const widthOf = (part: IconGlyphPart | undefined): number => (part?.kind === 'stroke' ? part.width ?? 2 : 0);
  type Point = [number, number];
  /** Splits a path into its subpaths (each starts at an M). */
  const subpaths = (d: string): string[] => d.split(/(?=M)/).map((chunk) => chunk.trim()).filter(Boolean);
  /** Samples one subpath of absolute M / H / V / L / C / A / Z commands (circular arcs, rotation 0) into points along the drawn outline. */
  const sample = (d: string, steps = 24): Point[] => {
    expect(d, 'absolute M / H / V / L / C / A / Z commands only').toMatch(/^[MHVLCAZ\d.\s-]+$/);
    const tokens = d.match(/[MHVLCAZ]|-?\d+(\.\d+)?/g) ?? [];
    const out: Point[] = [];
    let at: Point = [0, 0];
    let i = 0;
    const num = (): number => Number(tokens[i++]);
    while (i < tokens.length) {
      const command = tokens[i++];
      if (command === 'M' || command === 'L') {
        at = [num(), num()];
        out.push(at);
      } else if (command === 'H') {
        at = [num(), at[1]];
        out.push(at);
      } else if (command === 'V') {
        at = [at[0], num()];
        out.push(at);
      } else if (command === 'C') {
        const p0 = at;
        const p1: Point = [num(), num()];
        const p2: Point = [num(), num()];
        const p3: Point = [num(), num()];
        const bezier = (t: number, k: 0 | 1): number => {
          const u = 1 - t;
          return u ** 3 * p0[k] + 3 * u ** 2 * t * p1[k] + 3 * u * t ** 2 * p2[k] + t ** 3 * p3[k];
        };
        for (let s = 1; s <= steps; s += 1) out.push([bezier(s / steps, 0), bezier(s / steps, 1)]);
        at = p3;
      } else if (command === 'A') {
        const [rx, ry, rotation, large, sweep, x2, y2] = [num(), num(), num(), num(), num(), num(), num()];
        expect(rx).toBe(ry);
        expect(rotation).toBe(0);
        // endpoint to centre parameterisation for a circle (SVG 1.1 F.6.5, rotation 0)
        const [x1, y1] = at;
        const [mx, my] = [(x1 - x2) / 2, (y1 - y2) / 2];
        const chordHalf = Math.hypot(mx, my);
        const r = Math.max(rx, chordHalf);
        const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, r * r - chordHalf * chordHalf)) / (chordHalf || 1);
        const [cx, cy] = [(x1 + x2) / 2 + factor * -my, (y1 + y2) / 2 + factor * mx];
        const start = Math.atan2(y1 - cy, x1 - cx);
        let delta = Math.atan2(y2 - cy, x2 - cx) - start;
        if (sweep === 1 && delta < 0) delta += 2 * Math.PI;
        if (sweep === 0 && delta > 0) delta -= 2 * Math.PI;
        if (Math.abs(delta) < 1e-9) delta = sweep === 1 ? 2 * Math.PI : -2 * Math.PI;
        for (let s = 1; s <= steps; s += 1) {
          const angle = start + (delta * s) / steps;
          out.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
        }
        at = [x2, y2];
      } else if (command !== 'Z') {
        throw new Error(`unexpected command ${command ?? ''} in ${d}`);
      }
    }
    return out;
  };
  /** Shoelace sum over the sampled outline: positive is clockwise on screen (y down), negative counter-clockwise. */
  const signedArea = (points: Point[]): number =>
    points.reduce((sum, [x1, y1], k) => {
      const [x2, y2] = points[(k + 1) % points.length] ?? [x1, y1];
      return sum + (x1 * y2 - x2 * y1) / 2;
    }, 0);
  const bounds = (points: Point[]) => {
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  };
  const inside = (points: Point[], [px, py]: Point): boolean =>
    points.reduce((odd, [x1, y1], k) => {
      const [x2, y2] = points[(k + 1) % points.length] ?? [x1, y1];
      return y1 > py !== y2 > py && px < ((x2 - x1) * (py - y1)) / (y2 - y1) + x1 ? !odd : odd;
    }, false);

  it('adds route (the Route tab) and flag (the goal stage) to IconName, both apart from journey and pin', () => {
    for (const name of ['route', 'flag'] as const) {
      expect(iconNames, name).toContain(name);
      for (const other of ['journey', 'pin'] as const) expect(iconGlyphs[name], `${name} vs ${other}`).not.toEqual(iconGlyphs[other]);
    }
    expect(iconGlyphs.route).not.toEqual(iconGlyphs.flag);
  });

  it('route is one road at stroke 2.2 from a filled start dot to a filled pin', () => {
    expect(strokes('route')).toHaveLength(1);
    expect(widthOf(strokes('route')[0])).toBe(2.2);
    expect(fills('route')).toHaveLength(2);
    const [dot, pin] = fills('route');
    // the start dot: one closed circle at the road's first point
    expect(subpaths(dot?.d ?? '')).toHaveLength(1);
    const dotBox = bounds(sample(dot?.d ?? ''));
    const dotCentre: Point = [(dotBox.left + dotBox.right) / 2, (dotBox.top + dotBox.bottom) / 2];
    const road = sample(strokes('route')[0]?.d ?? '');
    expect(road[0]?.[0]).toBeCloseTo(dotCentre[0], 5);
    expect(road[0]?.[1]).toBeCloseTo(dotCentre[1], 5);
    expect(dotBox.right - dotBox.left).toBeGreaterThanOrEqual(4);
    // the road ends just short of the pin: its round cap stops within 0.5 of the drop's outline
    const drop = sample(subpaths(pin?.d ?? '')[0] ?? '');
    const end = road[road.length - 1] ?? [0, 0];
    expect(inside(drop, end)).toBe(false);
    const nearest = Math.min(...drop.map(([x, y]) => Math.hypot(x - end[0], y - end[1])));
    expect(nearest - widthOf(strokes('route')[0]) / 2).toBeLessThanOrEqual(0.5);
  });

  it('route draws the pin as a solid drop with a hole in the opposite direction, so the hole stays open under nonzero', () => {
    const [, pin] = fills('route');
    const parts = subpaths(pin?.d ?? '');
    expect(parts).toHaveLength(2);
    const [drop, hole] = parts.map((part) => sample(part)) as [Point[], Point[]];
    const [dropArea, holeArea] = [signedArea(drop), signedArea(hole)];
    expect(Math.abs(dropArea)).toBeGreaterThan(Math.abs(holeArea));
    expect(Math.abs(holeArea)).toBeGreaterThan(1);
    expect(Math.sign(dropArea)).toBe(-Math.sign(holeArea));
    // the hole sits wholly inside the drop's head
    for (const point of hole) expect(inside(drop, point), point.join(',')).toBe(true);
    // the drop is a pin: its tip is its one lowest point, below the head
    const box = bounds(drop);
    expect(drop.filter(([, y]) => y === box.bottom)).toHaveLength(drop[0]?.[1] === box.bottom ? 2 : 1);
    expect(box.bottom - box.top).toBeGreaterThan(box.right - box.left);
  });

  it('route stays inside the 24 x 24 box with its stroke caps', () => {
    const half = widthOf(strokes('route')[0]) / 2;
    const all = iconGlyphs.route.flatMap((part) => subpaths(part.d).flatMap((sub) => sample(sub)));
    const box = bounds(all);
    expect(box.left - half).toBeGreaterThanOrEqual(0);
    expect(box.top - half).toBeGreaterThanOrEqual(0);
    expect(box.right + half).toBeLessThanOrEqual(24);
    expect(box.bottom + half).toBeLessThanOrEqual(24);
  });

  it('flag is a vertical pole at stroke 2.2 and one closed solid pennant with a notch in its right edge', () => {
    expect(strokes('flag')).toHaveLength(1);
    expect(fills('flag')).toHaveLength(1);
    const [pole] = strokes('flag');
    const [pennant] = fills('flag');
    expect(widthOf(pole)).toBe(2.2);
    const polePoints = sample(pole?.d ?? '');
    expect(polePoints).toHaveLength(2);
    const [[x1, y1] = [0, 0], [x2, y2] = [0, 0]] = polePoints;
    expect(x1).toBe(x2);
    expect(Math.abs(y2 - y1)).toBeGreaterThanOrEqual(16);
    expect(pennant?.d).toMatch(/Z$/);
    expect(subpaths(pennant?.d ?? '')).toHaveLength(1);
    const outline = sample(pennant?.d ?? '');
    const box = bounds(outline);
    // the pennant hangs from the pole's top on its right side
    expect(box.left).toBe(x1);
    expect(box.top).toBeGreaterThanOrEqual(Math.min(y1, y2));
    expect(box.bottom).toBeLessThan((y1 + y2) / 2 + 3);
    // the swallow-tail notch: one outline point lies strictly inside the box, left of the right edge
    const notch = outline.filter(([x, y]) => x > box.left && x < box.right && y > box.top && y < box.bottom);
    expect(notch).toEqual([[15.5, 8]]);
    expect(box.right - box.left).toBeGreaterThanOrEqual(10);
  });
});
