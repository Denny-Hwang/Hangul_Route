import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { measureWordArtSource, overBudget, wordArtSourceFiles, type WordArtSourceReader } from '../../word-art-budget';

/**
 * F-VOC-002 W7 / §3.8 and behaviour 7: all WordArt source (`src/word-art/**`,
 * tests excluded) stays within the W7 budget: 160 KB raw and 48 KB gzipped
 * since W-5 (120 / 30 KB before; the §8.1 (b) decision). The limits and
 * the walk live in `src/word-art-budget.ts`, shared with the web contact
 * sheet. The measured numbers go in each PR description.
 */

const WORD_ART_DIR = join(__dirname, '..');

const NODE_FS: WordArtSourceReader = {
  list: (dir) => readdirSync(dir),
  isDirectory: (path) => statSync(path).isDirectory(),
  join,
  read: (path) => readFileSync(path),
  gzip: (data) => gzipSync(data, { level: 9 }),
};

describe('WordArt budget (W7)', () => {
  it('counts the shipped source and leaves the tests out', () => {
    const rel = wordArtSourceFiles(WORD_ART_DIR, NODE_FS).map((f) => relative(WORD_ART_DIR, f));
    expect(rel).toContain('index.ts');
    expect(rel).toContain('registry.ts');
    expect(rel.some((f) => f.startsWith('glyphs'))).toBe(true);
    expect(rel.some((f) => f.includes('__tests__'))).toBe(false);
  });

  it('is within the W7 budget, 160 KB raw and 48 KB gzip', () => {
    expect(overBudget(measureWordArtSource(WORD_ART_DIR, NODE_FS))).toBeNull();
  });
});
