import { describe, expect, it } from 'vitest';
import { iconGlyphs, iconNames } from '../glyphs';
import type { IconName } from '../types';

const EXPECTED_NAMES: IconName[] = [
  'play',
  'pause',
  'speaker',
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
});
