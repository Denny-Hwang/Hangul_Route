/**
 * The WordArt source budget (F-VOC-002 W7, §3.8): all WordArt source
 * (`src/word-art/**`, tests excluded) stays within 120 KB raw and 30 KB
 * gzipped. One definition, read by `word-art/__tests__/budget.test.ts` and by
 * the web contact sheet's totals line, so raising the budget (§8.1 (b)) moves
 * both. It sits outside `src/word-art/` so it does not count against itself,
 * and is pure: the caller passes the file reads and the gzip.
 */

export const BUDGET_RAW = 120 * 1024;
export const BUDGET_GZIP = 30 * 1024;

export interface WordArtSize {
  raw: number;
  gzip: number;
}

/** The file-system reads the walk and the measurement need (node:fs and node:zlib in both callers). */
export interface WordArtSourceReader {
  list(dir: string): readonly string[];
  isDirectory(path: string): boolean;
  join(dir: string, name: string): string;
  read(path: string): Uint8Array;
  gzip(data: Uint8Array): Uint8Array;
}

const SOURCE_FILE = /\.[cm]?[jt]sx?$/;

/** Source files under `dir`, sorted by name at each level; `__tests__` folders and non-source files are left out. */
export function wordArtSourceFiles(dir: string, fs: Pick<WordArtSourceReader, 'list' | 'isDirectory' | 'join'>): string[] {
  return [...fs.list(dir)].sort().flatMap((name) => {
    const path = fs.join(dir, name);
    if (fs.isDirectory(path)) return name === '__tests__' ? [] : wordArtSourceFiles(path, fs);
    return SOURCE_FILE.test(name) ? [path] : [];
  });
}

/** Raw and gzip bytes of the source files concatenated in walk order. */
export function measureWordArtSource(dir: string, fs: WordArtSourceReader): WordArtSize & { files: number } {
  const files = wordArtSourceFiles(dir, fs);
  const parts = files.map((f) => fs.read(f));
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return { files: files.length, raw: all.length, gzip: fs.gzip(all).length };
}

/** The message when over (behaviour 7), or null. */
export function overBudget(size: WordArtSize): string | null {
  if (size.raw <= BUDGET_RAW && size.gzip <= BUDGET_GZIP) return null;
  return `WordArt source is ${size.raw} B raw / ${size.gzip} B gzip; the budget is ${BUDGET_RAW} / ${BUDGET_GZIP}`;
}
