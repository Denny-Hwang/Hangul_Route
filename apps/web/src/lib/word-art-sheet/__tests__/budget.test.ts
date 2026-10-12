import * as designSystemBudget from '@hangul-route/design-system/word-art-budget';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { BUDGET_GZIP, BUDGET_RAW, measureWordArtSource, wordArtDir, wordArtSourceFiles } from '../budget';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'word-art-'));
  dirs.push(dir);
  return dir;
}

function fixture(): string {
  const dir = tempDir();
  mkdirSync(join(dir, 'glyphs'));
  mkdirSync(join(dir, '__tests__'));
  writeFileSync(join(dir, 'index.ts'), 'export {};\n');
  writeFileSync(join(dir, 'glyphs', 'food.ts'), 'export const FOOD = {};\n');
  writeFileSync(join(dir, '__tests__', 'x.test.ts'), 'not counted');
  writeFileSync(join(dir, 'README.md'), 'not source');
  return dir;
}

/** A workspace root (it has pnpm-workspace.yaml) with an apps/web folder. */
function workspace(): string {
  const root = tempDir();
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
  mkdirSync(join(root, 'apps', 'web', 'src'), { recursive: true });
  return root;
}

describe('the WordArt source budget on the contact sheet (F-VOC-002 W7, §3.8)', () => {
  it("uses the design system's limits, the ones budget.test.ts enforces", () => {
    expect(BUDGET_RAW).toBe(designSystemBudget.BUDGET_RAW);
    expect(BUDGET_GZIP).toBe(designSystemBudget.BUDGET_GZIP);
  });

  it('finds packages/design-system/src/word-art from the workspace root, wherever it runs', () => {
    const root = workspace();
    const expected = resolve(root, 'packages/design-system/src/word-art');
    expect(wordArtDir(join(root, 'apps', 'web'))).toBe(expected);
    expect(wordArtDir(join(root, 'apps', 'web', 'src'))).toBe(expected);
    expect(wordArtDir(root)).toBe(expected);
  });

  it('finds the same folder from apps/web and from the repo root', () => {
    const fromWeb = wordArtDir();
    expect(wordArtDir(resolve(fromWeb, '../../../..'))).toBe(fromWeb);
    expect(wordArtSourceFiles(fromWeb).length).toBeGreaterThan(10);
  });

  it('falls back to the apps/web relative path when no workspace root is above', () => {
    expect(wordArtDir('/')).toBe(resolve('/', '../../packages/design-system/src/word-art'));
  });

  it('counts source files, sorted, and leaves the tests and non-source files out', () => {
    const dir = fixture();
    expect(wordArtSourceFiles(dir).map((f) => relative(dir, f))).toEqual([join('glyphs', 'food.ts'), 'index.ts']);
  });

  it('measures raw and gzip bytes of the concatenated source', () => {
    const dir = fixture();
    const all = Buffer.from('export const FOOD = {};\nexport {};\n');
    expect(measureWordArtSource(dir)).toEqual({ files: 2, raw: all.length, gzip: gzipSync(all, { level: 9 }).length });
  });

  it('measures the shipped source within the budget', () => {
    const size = measureWordArtSource();
    expect(size.files).toBeGreaterThan(10);
    expect(size.raw).toBeLessThanOrEqual(BUDGET_RAW);
    expect(size.gzip).toBeLessThanOrEqual(BUDGET_GZIP);
  });
});
