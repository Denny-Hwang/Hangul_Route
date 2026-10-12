/**
 * Build-time measurement for the contact sheet's totals line (F-VOC-002 W7,
 * §3.8): the raw and gzip size of all WordArt source
 * (`packages/design-system/src/word-art/**`, tests excluded). The limits and
 * the walk are the design system's own (`word-art-budget.ts`, the module its
 * `budget.test.ts` enforces), so the two never drift. Server only; read with
 * node:fs while `next build` renders the static page.
 */
import {
  BUDGET_GZIP,
  BUDGET_RAW,
  measureWordArtSource as measure,
  wordArtSourceFiles as walk,
  type WordArtSize,
  type WordArtSourceReader,
} from '@hangul-route/design-system/word-art-budget';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

export { BUDGET_GZIP, BUDGET_RAW };

const NODE_FS: WordArtSourceReader = {
  list: (dir) => readdirSync(dir),
  isDirectory: (path) => statSync(path).isDirectory(),
  join,
  read: (path) => readFileSync(path),
  gzip: (data) => gzipSync(data, { level: 9 }),
};

const WORD_ART_FROM_ROOT = 'packages/design-system/src/word-art';

/**
 * `packages/design-system/src/word-art`, found from the workspace root (the
 * nearest folder above `cwd` with `pnpm-workspace.yaml`), so `next build` and
 * the web tests work from apps/web, the repo root or anywhere inside. Falls
 * back to the path seen from apps/web.
 */
export function wordArtDir(cwd: string = process.cwd()): string {
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return resolve(dir, WORD_ART_FROM_ROOT);
    if (dirname(dir) === dir) return resolve(cwd, '../..', WORD_ART_FROM_ROOT);
  }
}

export function wordArtSourceFiles(dir: string = wordArtDir()): string[] {
  return walk(dir, NODE_FS);
}

export function measureWordArtSource(dir: string = wordArtDir()): WordArtSize & { files: number } {
  return measure(dir, NODE_FS);
}
