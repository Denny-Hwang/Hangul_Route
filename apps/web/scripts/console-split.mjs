#!/usr/bin/env node
// Console role of the static export (F-APP-001 sections 3.1 and 3.3, A-3).
//
// `build:console` = `next build && node scripts/console-split.mjs out`. The same `next build` as the site
// role, then this copies into `out-console/` only what app.hangulroute.com serves from this app: every
// exported file of a grown-up path (R-1, `isGrownUpPath`: the `.html` pages and their React Server
// Component `.txt` payloads) and the whole `_next/` folder. The landing, Next's 404 page, the legal,
// persona, locale and preview pages never go there. `apps/mobile/scripts/app-host/merge-console.mjs`
// then copies `out-console/` into the learner Worker's dist (`hangul-route-app`); the site role (`build`,
// `out/`, `hangul-route-web`) is unchanged, and `hangul-route-web` never serves the app host.
//
// The prefix list exists once: the CLI reads `isGrownUpPath` from packages/content-schema through
// scripts/ts-loader.mjs (precedent: scripts/check-i18n.mjs, apps/mobile/scripts/pwa-postbuild.mjs).
//
//   node scripts/console-split.mjs [out] [dest]     (dest defaults to `<out>-console`)
import { copyFileSync, existsSync, mkdirSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Next's asset folder: copied whole, because every console page loads its code from it. */
export const CONSOLE_ASSET_DIR = '_next';

/**
 * Starts of first names (before the first `/` or `.`) the console role never copies, whatever the prefix
 * list says (section 3.3: `index.html`, `404.html`, `about*`, `privacy*`, ...): the landing, Next's 404 page,
 * legal, persona, locale and preview pages. A second guard after the R-1 selection, so a mistaken prefix
 * can never publish a site page on the app host.
 */
export const NEVER_COPIED = ['index', '404', 'about', 'privacy', 'terms', 'learners', 'parents', 'teachers', 'es', 'ko', 'design-preview'];

const toPosix = (rel) => rel.split('\\').join('/');

/**
 * Whether an exported file (a path relative to the export folder) belongs to the console role.
 * @param {string} rel
 * @param {(pathname: string) => boolean} isGrownUpPath the R-1 predicate of packages/content-schema
 */
export function isConsoleFile(rel, isGrownUpPath) {
  const path = `/${toPosix(rel)}`;
  return path.startsWith(`/${CONSOLE_ASSET_DIR}/`) || isGrownUpPath(path);
}

/**
 * The console role's files among the export's, sorted. Throws if the selection holds a never-copied page.
 * @param {readonly string[]} relPaths
 * @param {(pathname: string) => boolean} isGrownUpPath
 * @returns {string[]}
 */
export function consoleFiles(relPaths, isGrownUpPath) {
  const selected = relPaths.map(toPosix).filter((rel) => isConsoleFile(rel, isGrownUpPath));
  const site = selected.filter((rel) => {
    const first = rel.split(/[/.]/)[0];
    return NEVER_COPIED.some((name) => first.startsWith(name));
  });
  if (site.length > 0) throw new Error(`the console role never copies site pages, but selected ${site.join(', ')}`);
  return selected.sort();
}

/**
 * Every file under `dir` as POSIX paths relative to it, sorted.
 * @param {string} dir
 * @returns {string[]}
 */
export function listFiles(dir) {
  const walk = (current) =>
    readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
      const full = join(current, entry.name);
      return entry.isDirectory() ? walk(full) : [toPosix(relative(dir, full))];
    });
  return walk(dir).sort();
}

const inside = (child, parent) => child === parent || child.startsWith(parent + sep);

/**
 * Writes the console role of the export at `outDir` into `destDir` (replaced whole, so a page that left the
 * export never ships). Throws before writing anything when the export is missing or holds no grown-up page.
 * @param {string} outDir the `next build` export
 * @param {string} destDir the console output (`out-console`)
 * @param {(pathname: string) => boolean} isGrownUpPath
 * @returns {string[]} the files written, relative to `destDir`, sorted
 */
export function splitConsole(outDir, destDir, isGrownUpPath) {
  const out = resolve(outDir);
  const dest = resolve(destDir);
  if (!existsSync(out) || !statSync(out).isDirectory()) throw new Error(`no export folder at ${outDir} (run next build first)`);
  if (inside(dest, out) || inside(out, dest)) throw new Error(`the console output ${destDir} must be outside the export ${outDir}`);
  const files = consoleFiles(listFiles(out), isGrownUpPath);
  if (!files.some((rel) => rel.endsWith('.html') && !rel.startsWith(`${CONSOLE_ASSET_DIR}/`))) {
    throw new Error(`no grown-up page in the export at ${outDir}`);
  }
  rmSync(dest, { recursive: true, force: true });
  for (const rel of files) {
    const target = join(dest, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(out, rel), target);
  }
  return files;
}

// Real paths on both sides: Node resolves symlinks in import.meta.url but not in argv[1], and a CLI that
// compared them as they are would skip itself without a word in a symlinked checkout.
const isMain = Boolean(process.argv[1]) && existsSync(process.argv[1]) && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

if (isMain) {
  try {
    if (typeof nodeModule.register !== 'function') {
      throw new Error(`needs Node 20.6+ (module.register); this is ${process.version}`);
    }
    const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
    nodeModule.register(pathToFileURL(join(repo, 'scripts', 'ts-loader.mjs')));
    const { isGrownUpPath } = await import(pathToFileURL(join(repo, 'packages', 'content-schema', 'src', 'schemas', 'app-shell.ts')).href);
    const out = resolve(process.argv[2] ?? 'out');
    const dest = resolve(process.argv[3] ?? `${out}-console`);
    const files = splitConsole(out, dest, isGrownUpPath);
    const pages = files.filter((rel) => rel.endsWith('.html') && !rel.startsWith(`${CONSOLE_ASSET_DIR}/`)).length;
    process.stdout.write(`console-split: ${pages} pages, ${files.length} files in ${relative(process.cwd(), dest) || dest}\n`);
  } catch (err) {
    process.stderr.write(`console-split: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
