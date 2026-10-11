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

  it('pin is an outlined drop with a solid centre dot (the "You started here" tag)', () => {
    expect(strokes('pin')).toHaveLength(1);
    expect(strokes('pin')[0]?.d).toMatch(/Z$/);
    expect(fills('pin')).toHaveLength(1);
  });

  it('check-circle is the plain check inside a closed ring, never the bare check (the Complete badge)', () => {
    const [ring, mark] = strokes('check-circle');
    expect(ring?.d).toMatch(/A9 9 0 1 0 .*A9 9 0 1 0 .*Z$/);
    expect(mark?.d).toMatch(/^M\S+ \S+ L\S+ \S+ L\S+ \S+$/);
    expect(JSON.stringify(iconGlyphs['check-circle'])).not.toEqual(JSON.stringify(iconGlyphs.check));
    expect(fills('check-circle')).toHaveLength(0);
  });

  it('book, ear and pencil are line drawings with no solid parts (Read, Listen, Write)', () => {
    for (const name of ['book', 'ear', 'pencil'] as const) expect(fills(name), name).toHaveLength(0);
    // the open book has a spine; the pencil a separate tip and ferrule line; the ear a sound wave
    expect(strokes('book')).toHaveLength(2);
    expect(strokes('pencil')).toHaveLength(3);
    expect(strokes('ear')).toHaveLength(3);
  });

  it('none of them repeats an older glyph (journey stays the route, card stays the card)', () => {
    const older = iconNames.filter((name) => !ROUTE_GLYPHS.includes(name)).map((name) => JSON.stringify(iconGlyphs[name]));
    for (const name of ROUTE_GLYPHS) expect(older, name).not.toContain(JSON.stringify(iconGlyphs[name]));
  });
});
