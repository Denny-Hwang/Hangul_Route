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
    // a broad open shape (the no-fill rule above keeps it from reading as a game "life")
    const xs = path.map(([x]) => x);
    const width = Math.max(...xs) - Math.min(...xs);
    expect(width).toBeGreaterThanOrEqual(14);
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
