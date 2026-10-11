import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

/**
 * F-VOC-002 W7 / §3.8 and behaviour 7: all WordArt source (`src/word-art/**`,
 * tests excluded) stays within 120 KB raw and 30 KB gzipped. The measured
 * numbers go in each PR description.
 */

export const BUDGET_RAW = 120 * 1024;
export const BUDGET_GZIP = 30 * 1024;

const WORD_ART_DIR = join(__dirname, '..');

export function wordArtSources(dir: string = WORD_ART_DIR): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === '__tests__' ? [] : wordArtSources(path);
      return /\.[cm]?[jt]sx?$/.test(name) ? [path] : [];
    });
}

export function measure(files: readonly string[]): { raw: number; gzip: number } {
  const all = Buffer.concat(files.map((f) => readFileSync(f)));
  return { raw: all.length, gzip: gzipSync(all, { level: 9 }).length };
}

export function overBudget(size: { raw: number; gzip: number }): string | null {
  if (size.raw <= BUDGET_RAW && size.gzip <= BUDGET_GZIP) return null;
  return `WordArt source is ${size.raw} B raw / ${size.gzip} B gzip; the budget is ${BUDGET_RAW} / ${BUDGET_GZIP}`;
}

describe('WordArt budget (W7)', () => {
  const files = wordArtSources();

  it('counts the shipped source and leaves the tests out', () => {
    const rel = files.map((f) => relative(WORD_ART_DIR, f));
    expect(rel).toContain('index.ts');
    expect(rel).toContain('registry.ts');
    expect(rel.some((f) => f.startsWith('glyphs'))).toBe(true);
    expect(rel.some((f) => f.includes('__tests__'))).toBe(false);
  });

  it('is within 120 KB raw and 30 KB gzip', () => {
    const size = measure(files);
    expect(overBudget(size)).toBeNull();
  });

  it('reports the measured sizes when over (behaviour 7)', () => {
    expect(overBudget({ raw: BUDGET_RAW + 1, gzip: 10 })).toBe(`WordArt source is ${BUDGET_RAW + 1} B raw / 10 B gzip; the budget is 122880 / 30720`);
    expect(overBudget({ raw: 10, gzip: BUDGET_GZIP + 1 })).toMatch(/30721 B gzip/);
    expect(overBudget({ raw: BUDGET_RAW, gzip: BUDGET_GZIP })).toBeNull();
  });
});
