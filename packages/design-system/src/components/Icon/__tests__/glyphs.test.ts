import { describe, expect, it } from 'vitest';
import { iconGlyphs, iconNames } from '../glyphs';
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
