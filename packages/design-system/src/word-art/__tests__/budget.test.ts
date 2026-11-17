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
 *
 * AMENDMENTS-PICTURES-2026-11 row PX-1 (13 new glyphs, five redrawn) measured
 * 157,177 B raw and 46,674 B gzip (141,841 / 41,851 before), inside the
 * budget of 163,840 / 49,152, so the line did not move. About 6.6 KB raw and
 * 2.4 KB gzip are left: the next art batch has to raise it (§8.1 (b)).
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
