import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import pkgJson from '../../package.json?raw';
import { impureImports } from './impure-imports';
import { BUDGET_GZIP, BUDGET_RAW, measureWordArtSource, overBudget, wordArtSourceFiles, type WordArtSourceReader } from '../word-art-budget';

/**
 * F-VOC-002 W7 / §3.8: the WordArt source budget has one definition, read by
 * the design system's `word-art/__tests__/budget.test.ts` and by the web
 * contact sheet's totals line, so raising the budget moves both.
 */

/** An in-memory tree: a path ending in `/` is a folder. */
function reader(files: Record<string, string>): WordArtSourceReader {
  const enc = new TextEncoder();
  return {
    join: (dir, name) => `${dir}/${name}`,
    list: (dir) => [...new Set(Object.keys(files).filter((p) => p.startsWith(`${dir}/`)).map((p) => p.slice(dir.length + 1).split('/')[0]!))].reverse(),
    isDirectory: (path) => Object.keys(files).some((p) => p.startsWith(`${path}/`)),
    read: (path) => enc.encode(files[path] ?? ''),
    gzip: (data) => data.subarray(0, Math.ceil(data.length / 2)),
  };
}

const TREE = reader({
  'w/index.ts': 'AA',
  'w/glyphs/food.ts': 'BBBB',
  'w/__tests__/x.test.ts': 'not counted',
  'w/README.md': 'not source',
  'w/generated/halo.ts': 'CC',
});

describe('the WordArt budget module (W7)', () => {
  it('is 160 KB raw and 48 KB gzip (raised at W-5 under the §8.1 (b) decision)', () => {
    expect(BUDGET_RAW).toBe(160 * 1024);
    expect(BUDGET_GZIP).toBe(48 * 1024);
  });

  it('is a package entry, outside src/word-art so it does not count against itself', () => {
    const pkg = JSON.parse(pkgJson) as { exports: Record<string, string> };
    expect(pkg.exports['./word-art-budget']).toBe('./src/word-art-budget.ts');
  });

  it('imports nothing impure and no node module (the caller passes the file reads)', () => {
    const source = readFileSync(join(__dirname, '..', 'word-art-budget.ts'), 'utf8');
    expect(impureImports(source)).toEqual([]);
    expect(source).not.toMatch(/from\s+'node:/);
  });

  it('lists source files sorted, leaving out __tests__ folders and non-source files', () => {
    expect(wordArtSourceFiles('w', TREE)).toEqual(['w/generated/halo.ts', 'w/glyphs/food.ts', 'w/index.ts']);
  });

  it('measures the concatenated source, raw and gzip, in file order', () => {
    expect(measureWordArtSource('w', TREE)).toEqual({ files: 3, raw: 8, gzip: 4 });
  });

  it('reports the measured sizes when over (behaviour 7)', () => {
    expect(overBudget({ raw: BUDGET_RAW + 1, gzip: 10 })).toBe(`WordArt source is ${BUDGET_RAW + 1} B raw / 10 B gzip; the budget is 163840 / 49152`);
    expect(overBudget({ raw: 10, gzip: BUDGET_GZIP + 1 })).toMatch(/49153 B gzip/);
    expect(overBudget({ raw: BUDGET_RAW, gzip: BUDGET_GZIP })).toBeNull();
  });
});
