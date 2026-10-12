/**
 * Build-time measurement for the contact sheet's totals line (F-VOC-002 W7,
 * §3.8): the raw and gzip size of all WordArt source
 * (`packages/design-system/src/word-art/**`, tests excluded), the same sum as
 * the design system's `budget.test.ts`. Server only; read with node:fs while
 * `next build` renders the static page.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

export const BUDGET_RAW = 120 * 1024;
export const BUDGET_GZIP = 30 * 1024;

/** `packages/design-system/src/word-art` seen from `apps/web` (the working directory of `next build` and the web tests). */
export function wordArtDir(cwd: string = process.cwd()): string {
  return resolve(cwd, '../../packages/design-system/src/word-art');
}

export function wordArtSourceFiles(dir: string = wordArtDir()): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === '__tests__' ? [] : wordArtSourceFiles(path);
      return /\.[cm]?[jt]sx?$/.test(name) ? [path] : [];
    });
}

export function measureWordArtSource(dir: string = wordArtDir()): { files: number; raw: number; gzip: number } {
  const files = wordArtSourceFiles(dir);
  const all = Buffer.concat(files.map((f) => readFileSync(f)));
  return { files: files.length, raw: all.length, gzip: gzipSync(all, { level: 9 }).length };
}
