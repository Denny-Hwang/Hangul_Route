#!/usr/bin/env node
// One host, two bundles, one Worker (F-APP-001 section 3.1 AD-1, option B2; section 3.3; A-3).
//
// Step 3 of `build:web` (audio map, `expo export`, this, `pwa-postbuild.mjs`): app.hangulroute.com is
// served only by `hangul-route-app`, so the grown-up console of apps/web is built in its console role
// (`pnpm --filter @hangul-route/web build:console` writes apps/web/out-console/) and copied into the learner
// export under the reserved grown-up prefixes (GROWN_UP_PREFIXES, R-1) and `_next/`. The learner Worker
// stays assets-only; the console pages and chunks are never precached (pwa-postbuild.mjs, A-2), so a
// console-only change never changes sw.js and learners see no update banner for it (behaviour 18).
//
// - SKIP_CONSOLE=1: builds nothing and writes nothing (a local learner-only build). The fixture build
//   (build:web:fixtures) never runs this step.
// - The console build gets NEXT_PUBLIC_API_BASE_URL from EXPO_PUBLIC_API_BASE_URL when it has none of its
//   own; NEXT_PUBLIC_APP_URL keeps the console default (https://app.hangulroute.com, lib/console/config.ts).
// - Fails the build, before writing anything, if a console file would land on a path that already exists
//   in dist (collision guard), is neither a grown-up path nor under `_next/`, or is `index.html`.
// - Appends the grown-up `_headers` block (section 3.17), generated from GROWN_UP_PREFIXES.
//
//   node scripts/app-host/merge-console.mjs [dist]
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CONSOLE_ASSET_DIR } from '../pwa/grown-ups.mjs';
import { GROWN_UP_HEADERS_MARKER, grownUpHeadersBlock, longCacheConsoleRules, parseHeaders } from './headers.mjs';

/** `pnpm` arguments of the console role build (apps/web `build:console`, section 3.3). */
export const CONSOLE_BUILD_ARGS = ['--filter', '@hangul-route/web', 'build:console'];

const SKIP_MESSAGE = 'SKIP_CONSOLE=1: learner-only build, nothing merged';

/** Only `SKIP_CONSOLE=1` skips the console (local learner-only builds); anything else builds it. */
export function skipConsole(env) {
  return env.SKIP_CONSOLE === '1';
}

const blank = (value) => value === undefined || value.trim() === '';

/**
 * The environment of the console build: the build's own, plus the learner build's API base when the
 * console has none (section 3.3), so owner step S-1 only adds the Clerk key. Never changes its input.
 * @param {Record<string, string | undefined>} env
 */
export function consoleBuildEnv(env) {
  const out = { ...env };
  if (blank(env.NEXT_PUBLIC_API_BASE_URL) && !blank(env.EXPO_PUBLIC_API_BASE_URL)) {
    out.NEXT_PUBLIC_API_BASE_URL = env.EXPO_PUBLIC_API_BASE_URL;
  }
  return out;
}

/**
 * How to call pnpm: the pnpm that runs `build:web` (`npm_execpath`; a script file runs under this node),
 * else `pnpm` on the PATH.
 * @param {Record<string, string | undefined>} env
 * @param {string} [execPath]
 * @returns {{ command: string, args: string[] }}
 */
export function pnpmInvocation(env, execPath = process.execPath) {
  const own = env.npm_execpath;
  if (own && /pnpm/i.test(basename(own))) {
    return /\.[cm]?js$/i.test(own) ? { command: execPath, args: [own] } : { command: own, args: [] };
  }
  return { command: 'pnpm', args: [] };
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
      return entry.isDirectory() ? walk(full) : [relative(dir, full).split('\\').join('/')];
    });
  return walk(dir).sort();
}

const isPage = (rel) => rel.endsWith('.html') && !rel.startsWith(`${CONSOLE_ASSET_DIR}/`);

/**
 * The copy plan, with every refusal of section 3.3 named at once. Throws before anything is written.
 * @param {readonly string[]} files the console output's files, relative to it
 * @param {{ isGrownUpPath: (pathname: string) => boolean, occupied: (rel: string) => boolean }} checks
 *   `occupied(rel)`: something already stands at that path of dist (the file, or a file where a folder must go)
 * @returns {string[]} the files to copy, sorted
 */
export function planMerge(files, { isGrownUpPath, occupied }) {
  const problems = [];
  for (const rel of files) {
    const path = `/${rel}`;
    if (rel === 'index.html') problems.push(`${rel} would replace the learner shell`);
    else if (!isGrownUpPath(path) && !path.startsWith(`/${CONSOLE_ASSET_DIR}/`)) problems.push(`${rel} is not a grown-up path or under ${CONSOLE_ASSET_DIR}/`);
    else if (occupied(rel)) problems.push(`${rel} collides with a file already in dist`);
  }
  if (problems.length === 0 && !files.some((rel) => isPage(rel) && isGrownUpPath(`/${rel}`))) {
    problems.push('the console output holds no grown-up page');
  }
  if (problems.length > 0) throw new Error(`refused: ${problems.join('; ')}`);
  return [...files].sort();
}

/** Something already stands at `rel` in dist: the file itself, or a file where one of its folders must go. */
function occupiedIn(dist) {
  return (rel) => {
    if (existsSync(join(dist, rel))) return true;
    const parts = rel.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      const folder = join(dist, ...parts.slice(0, i));
      if (existsSync(folder) && !statSync(folder).isDirectory()) return true;
    }
    return false;
  };
}

function assertLearnerExport(dist) {
  if (!existsSync(join(dist, 'index.html'))) throw new Error(`no learner export at ${join(dist, 'index.html')} (run expo export first)`);
}

/**
 * Copies the console output into the learner export and appends the grown-up `_headers` block.
 * Every check runs before the first write.
 * @param {{ dist: string, consoleOut: string, isGrownUpPath: (pathname: string) => boolean, prefixes: readonly string[] }} input
 * @returns {{ files: string[], pages: number }}
 */
export function mergeConsole({ dist, consoleOut, isGrownUpPath, prefixes }) {
  assertLearnerExport(dist);
  if (!existsSync(consoleOut) || !statSync(consoleOut).isDirectory()) {
    throw new Error(`no console output at ${consoleOut} (run pnpm --filter @hangul-route/web build:console)`);
  }
  const files = planMerge(listFiles(consoleOut), { isGrownUpPath, occupied: occupiedIn(dist) });

  const headersPath = join(dist, '_headers');
  const learnerHeaders = existsSync(headersPath) ? readFileSync(headersPath, 'utf8') : '';
  if (learnerHeaders.includes(GROWN_UP_HEADERS_MARKER)) throw new Error(`${headersPath} already holds the grown-up block (merged twice?)`);
  const risky = longCacheConsoleRules(parseHeaders(learnerHeaders));
  if (risky.length > 0) {
    throw new Error(
      `${headersPath} lets a browser keep /_next/ files, but the single-page fallback answers a missing chunk with index.html, which a browser would then keep under the chunk URL (section 3.3): ${risky.join(', ')}`,
    );
  }
  const block = grownUpHeadersBlock(prefixes);

  for (const rel of files) {
    const target = join(dist, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(consoleOut, rel), target);
  }
  const separator = learnerHeaders === '' ? '' : learnerHeaders.endsWith('\n') ? '\n' : '\n\n';
  writeFileSync(headersPath, `${learnerHeaders}${separator}${block}`);
  return { files, pages: files.filter(isPage).length };
}

/**
 * `SKIP_CONSOLE=1`: nothing. Otherwise checks the learner export, builds the console role once and merges it.
 * @param {{
 *   dist: string,
 *   env: Record<string, string | undefined>,
 *   consoleOut: string,
 *   build: (env: Record<string, string | undefined>) => number,
 *   isGrownUpPath: (pathname: string) => boolean,
 *   prefixes: readonly string[],
 *   log: (line: string) => void,
 * }} input
 * @returns {{ files: string[], pages: number } | null}
 */
export function runMerge({ dist, env, consoleOut, build, isGrownUpPath, prefixes, log }) {
  if (skipConsole(env)) {
    log(SKIP_MESSAGE);
    return null;
  }
  assertLearnerExport(dist);
  log(`building the console role of apps/web (pnpm ${CONSOLE_BUILD_ARGS.join(' ')}; SKIP_CONSOLE=1 skips it)`);
  const status = build(consoleBuildEnv(env));
  if (status !== 0) throw new Error(`the console build failed (exit ${status})`);
  return mergeConsole({ dist, consoleOut, isGrownUpPath, prefixes });
}

// Real paths on both sides: Node resolves symlinks in import.meta.url but not in argv[1], and a build step
// that compared them as they are would skip itself without a word in a symlinked checkout.
const isMain = Boolean(process.argv[1]) && existsSync(process.argv[1]) && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

if (isMain) {
  const log = (line) => process.stdout.write(`merge-console: ${line}\n`);
  try {
    if (skipConsole(process.env)) {
      log(SKIP_MESSAGE);
    } else {
      if (typeof nodeModule.register !== 'function') throw new Error(`needs Node 20.6+ (module.register); this is ${process.version}`);
      const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
      // The prefix list and the R-1 predicate exist once, in packages/content-schema (precedent: pwa-postbuild.mjs).
      nodeModule.register(pathToFileURL(join(repo, 'scripts', 'ts-loader.mjs')));
      const { GROWN_UP_PREFIXES, isGrownUpPath } = await import(pathToFileURL(join(repo, 'packages', 'content-schema', 'src', 'schemas', 'app-shell.ts')).href);
      const dist = resolve(process.argv[2] ?? 'dist');
      const result = runMerge({
        dist,
        env: process.env,
        consoleOut: join(repo, 'apps', 'web', 'out-console'),
        build: (env) => {
          const { command, args } = pnpmInvocation(env);
          const run = spawnSync(command, [...args, ...CONSOLE_BUILD_ARGS], { cwd: repo, env, stdio: 'inherit' });
          if (run.error) throw run.error;
          return run.status ?? 1;
        },
        isGrownUpPath,
        prefixes: GROWN_UP_PREFIXES,
        log,
      });
      if (result) log(`merged ${result.pages} grown-up pages (${result.files.length} files) and the grown-up _headers block into ${dist}`);
    }
  } catch (err) {
    process.stderr.write(`merge-console: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
