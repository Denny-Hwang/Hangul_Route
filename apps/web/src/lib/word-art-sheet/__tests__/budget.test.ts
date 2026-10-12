import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BUDGET_GZIP, BUDGET_RAW, measureWordArtSource, wordArtDir, wordArtSourceFiles } from '../budget';

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'word-art-'));
  mkdirSync(join(dir, 'glyphs'));
  mkdirSync(join(dir, '__tests__'));
  writeFileSync(join(dir, 'index.ts'), 'export {};\n');
  writeFileSync(join(dir, 'glyphs', 'food.ts'), 'export const FOOD = {};\n');
  writeFileSync(join(dir, '__tests__', 'x.test.ts'), 'not counted');
  writeFileSync(join(dir, 'README.md'), 'not source');
  return dir;
}

describe('the WordArt source budget on the contact sheet (F-VOC-002 W7, §3.8)', () => {
  it('uses the same limits as budget.test.ts: 120 KB raw, 30 KB gzip', () => {
    expect(BUDGET_RAW).toBe(120 * 1024);
    expect(BUDGET_GZIP).toBe(30 * 1024);
  });

  it('finds packages/design-system/src/word-art from apps/web', () => {
    expect(wordArtDir('/repo/apps/web')).toBe(resolve('/repo/packages/design-system/src/word-art'));
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
