import { describe, expect, it } from 'vitest';
import colorsDoc from '../../../../design/tokens/colors.v1.md?raw';
import layoutDoc from '../../../../design/tokens/layout.v1.md?raw';
import appJson from '../../../../apps/mobile/app.json?raw';
import manifest from '../../../../apps/mobile/public/manifest.webmanifest?raw';
import { colors, layout } from '../tokens';

/**
 * design/tokens/colors.v1.md is the design source of truth (CLAUDE.md §5).
 * The CI drift check (scripts/check-token-drift.mjs) only proves the
 * `colors` export exists; this pins every value so a palette change has to
 * land in both places in the same PR.
 */
function documented(): Map<string, string> {
  const rows = new Map<string, string>();
  for (const m of colorsDoc.matchAll(/^\|\s*`([a-zA-Z]+\.[a-zA-Z0-9]+)`\s*\|\s*([^|]+?)\s*\|/gm)) {
    rows.set(m[1]!, m[2]!.trim());
  }
  return rows;
}

function implemented(): Map<string, string> {
  const rows = new Map<string, string>();
  for (const [group, values] of Object.entries(colors)) {
    for (const [key, value] of Object.entries(values as Record<string, string>)) {
      rows.set(`${group}.${key}`, value);
    }
  }
  return rows;
}

const norm = (v: string): string => v.replace(/\s+/g, '').toUpperCase();

describe('design/tokens/colors.v1.md ↔ tokens.ts', () => {
  const doc = documented();
  const code = implemented();

  it('documents every color token the package exports', () => {
    expect([...code.keys()].filter((k) => !doc.has(k))).toEqual([]);
  });

  it('exports every color the design doc defines', () => {
    expect([...doc.keys()].filter((k) => !code.has(k))).toEqual([]);
  });

  it('agrees on every value', () => {
    const drift = [...code.entries()]
      .filter(([k, v]) => doc.has(k) && norm(doc.get(k)!) !== norm(v))
      .map(([k, v]) => `${k}: tokens.ts ${v} ≠ design ${doc.get(k)}`);
    expect(drift).toEqual([]);
  });
});

/**
 * Native/PWA config cannot import tokens, so it carries copies of brand.primary
 * and surface.canvas. They must follow the palette (the PWA shell's
 * <meta name="theme-color"> is injected from tokens.ts by pwa-postbuild).
 */
describe('native / PWA config ↔ tokens.ts', () => {
  const app = (JSON.parse(appJson) as {
    expo: { splash: { backgroundColor: string }; android: { adaptiveIcon: { backgroundColor: string } } };
  }).expo;
  const pwa = JSON.parse(manifest) as { theme_color: string; background_color: string };

  it('manifest theme_color is brand.primary and background_color is surface.canvas', () => {
    expect(norm(pwa.theme_color)).toBe(norm(colors.brand.primary));
    expect(norm(pwa.background_color)).toBe(norm(colors.surface.canvas));
  });

  it('app.json splash is surface.canvas and the adaptive icon background is brand.primary', () => {
    expect(norm(app.splash.backgroundColor)).toBe(norm(colors.surface.canvas));
    expect(norm(app.android.adaptiveIcon.backgroundColor)).toBe(norm(colors.brand.primary));
  });
});

/**
 * design/tokens/layout.v1.md (F-LAYOUT-001 §3.1) lists every `layout.<path>`
 * as a `| key | value |` row; the code is flattened to the same dotted paths.
 * Unlike the colour table the paths nest to any depth and the values are numbers.
 */
function documentedLayout(): Map<string, number> {
  const rows = new Map<string, number>();
  for (const m of layoutDoc.matchAll(/^\|\s*`(layout(?:\.[a-zA-Z0-9]+)+)`\s*\|\s*([0-9.]+)\s*\|/gm)) {
    rows.set(m[1]!, Number(m[2]));
  }
  return rows;
}

function flatten(prefix: string, value: unknown, out: Map<string, number>): Map<string, number> {
  if (typeof value === 'number') {
    out.set(prefix, value);
  } else {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) flatten(`${prefix}.${k}`, v, out);
  }
  return out;
}

describe('design/tokens/layout.v1.md ↔ tokens.ts', () => {
  const doc = documentedLayout();
  const code = flatten('layout', layout, new Map());

  it('parses exactly one row per layout value (guards the parser itself)', () => {
    expect(doc.size).toBe(code.size);
  });

  it('documents every layout token the package exports', () => {
    expect([...code.keys()].filter((k) => !doc.has(k))).toEqual([]);
  });

  it('exports every layout token the design doc defines', () => {
    expect([...doc.keys()].filter((k) => !code.has(k))).toEqual([]);
  });

  it('agrees on every value', () => {
    const drift = [...code.entries()]
      .filter(([k, v]) => doc.has(k) && doc.get(k) !== v)
      .map(([k, v]) => `${k}: tokens.ts ${v} ≠ design ${doc.get(k)}`);
    expect(drift).toEqual([]);
  });
});
