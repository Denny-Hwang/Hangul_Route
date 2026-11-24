#!/usr/bin/env node
// Postbuild bundle check of the console (AMENDMENTS-FINISH-2026-11 FN-6, finding F5 of
// docs/launch/performance-review-2026-11.md): no grown-up page (`/teach`, `/parent`, `/signin`, `/start`,
// `/account/*`, every exported page of a grown-up path, R-1 `isGrownUpPath`) loads Spanish or Korean messages
// at start. The browser build carries English only (`next.config.js` resolves the i18n package's
// `bundled-messages` to its `.web` twin) and loads the language it shows as a chunk of its own
// (`src/lib/i18n/message-overlays.ts`); before FN-6 one shared chunk of every grown-up page held all three.
//
// A page's start chunks are the `<script src="/_next/static/chunks/...">` of its HTML. Probes are translated
// strings of the es and ko overlays (`localeProbes`); the check fails when a start chunk holds one, and also when
// no chunk of the export holds them (the language chunks are gone, or the probes no longer match the bundle).
// A string the content data also holds is no probe: the grown-up start chunks legitimately carry the generated
// content (the vocabulary catalogue's es / ko glosses, the catalogue titles, the content overlays), and a phrase
// both a UI message and a gloss use ("alfabeto coreano") would fail the build for text that belongs there
// (`contentTexts`; the picks move on to the next candidate, so the count stays).
//
// `build` and `build:console` run it after `next build`. The probes come from packages/i18n through
// scripts/ts-loader.mjs, as console-split.mjs reads the R-1 list.
//
//   node scripts/console-locale-check.mjs [out]
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CONSOLE_ASSET_DIR, consoleFiles, listFiles } from './console-split.mjs';

/** How many probes per language: spread over the whole dictionary, enough that any namespace left in shows. */
export const PROBES_PER_LOCALE = 60;
/** Shorter strings ("Sí", "확인") can occur by chance; these are whole translated phrases. */
export const MIN_PROBE_LENGTH = 16;

const START_CHUNK = /<script\b[^>]*\bsrc="(\/_next\/static\/chunks\/[^"]+\.js)"/g;
/** Characters a minifier may escape or re-quote: a probe holding one could hide in the bundle. */
const UNSAFE = /["'`\\\n\r\t]|\$\{|[\u0000-\u001f\u2028\u2029]/;

/**
 * Every string leaf of a message tree with its dotted path, sorted by path.
 * @param {unknown} tree
 * @param {string} [prefix]
 * @returns {Array<[string, string]>}
 */
export function stringLeaves(tree, prefix = '') {
  if (typeof tree === 'string') return [[prefix, tree]];
  if (tree === null || typeof tree !== 'object') return [];
  return Object.keys(tree)
    .sort()
    .flatMap((key) => stringLeaves(/** @type {Record<string, unknown>} */ (tree)[key], prefix === '' ? key : `${prefix}.${key}`));
}

/**
 * Every string of the content data the grown-up start chunks may hold (generated catalogues and overlays), one
 * list for `localeProbes` to keep its probes out of.
 * @param {...unknown} sources trees of strings, as the generated modules export them
 * @returns {string[]}
 */
export function contentTexts(...sources) {
  return [...new Set(sources.flatMap((tree) => stringLeaves(tree).map(([, text]) => text)))];
}

/**
 * Up to `count` translated strings of an overlay that only that language has: not an English string, at least
 * MIN_PROBE_LENGTH long, nothing a minifier would escape, and not inside any of the `content` strings (a start
 * chunk may hold those); picked evenly along the sorted paths of what remains, so a skipped string is replaced by
 * its neighbour and the count holds.
 * @param {unknown} overlay the es or ko overlay
 * @param {unknown} english the English dictionary
 * @param {number} [count]
 * @param {readonly string[]} [content] strings of the content data (`contentTexts`)
 * @returns {string[]}
 */
export function localeProbes(overlay, english, count = PROBES_PER_LOCALE, content = []) {
  const englishText = new Set(stringLeaves(english).map(([, text]) => text));
  const contentBlob = content.join('\n');
  const candidates = [
    ...new Set(
      stringLeaves(overlay)
        .map(([, text]) => text)
        .filter(
          (text) =>
            text.length >= MIN_PROBE_LENGTH && !UNSAFE.test(text) && !englishText.has(text) && !(contentBlob !== '' && contentBlob.includes(text)),
        ),
    ),
  ];
  if (candidates.length <= count) return candidates;
  const step = candidates.length / count;
  return Array.from({ length: count }, (_, i) => /** @type {string} */ (candidates[Math.floor(i * step)]));
}

/**
 * The start chunks of a page: the `/_next/static/chunks/*.js` its HTML loads, as paths under the export.
 * @param {string} html
 * @returns {string[]}
 */
export function startChunks(html) {
  return [...new Set([...html.matchAll(START_CHUNK)].map((m) => /** @type {string} */ (m[1]).slice(1)))].sort();
}

/**
 * @typedef {{ pages: number, startChunks: string[], shared: { file: string, bytes: number } | null,
 *   leaks: Array<{ locale: string, file: string, pages: string[], probe: string }>,
 *   homes: Record<string, string[]>, missing: string[] }} ConsoleLocaleReport
 */

/**
 * Checks the export at `outDir`: which start chunks of the grown-up pages hold a probe of each language, and which
 * chunks of the export hold them at all (the language's own chunk).
 * @param {string} outDir
 * @param {(pathname: string) => boolean} isGrownUpPath
 * @param {Readonly<Record<string, readonly string[]>>} probes language -> probes
 * @returns {ConsoleLocaleReport}
 */
export function checkConsoleLocales(outDir, isGrownUpPath, probes) {
  const out = resolve(outDir);
  if (!existsSync(out) || !statSync(out).isDirectory()) throw new Error(`no export folder at ${outDir} (run next build first)`);
  const files = listFiles(out);
  const pages = consoleFiles(files, isGrownUpPath).filter((rel) => rel.endsWith('.html') && !rel.startsWith(`${CONSOLE_ASSET_DIR}/`));
  if (pages.length === 0) throw new Error(`no grown-up page in the export at ${outDir}`);
  /** @type {Map<string, string[]>} chunk -> pages that load it at start */
  const loadedBy = new Map();
  for (const page of pages) {
    for (const chunk of startChunks(readFileSync(join(out, page), 'utf8'))) loadedBy.set(chunk, [...(loadedBy.get(chunk) ?? []), page]);
  }
  /** @type {Map<string, string>} */
  const text = new Map();
  const read = (/** @type {string} */ rel) => {
    let body = text.get(rel);
    if (body === undefined) {
      body = existsSync(join(out, rel)) ? readFileSync(join(out, rel), 'utf8') : '';
      text.set(rel, body);
    }
    return body;
  };
  const allChunks = files.filter((rel) => rel.startsWith(`${CONSOLE_ASSET_DIR}/static/chunks/`) && rel.endsWith('.js'));
  /** @type {ConsoleLocaleReport['leaks']} */
  const leaks = [];
  /** @type {Record<string, string[]>} */
  const homes = {};
  /** @type {string[]} */
  const missing = [];
  for (const [locale, list] of Object.entries(probes)) {
    for (const [chunk, by] of loadedBy) {
      const probe = list.find((p) => read(chunk).includes(p));
      if (probe !== undefined) leaks.push({ locale, file: chunk, pages: by, probe });
    }
    homes[locale] = allChunks.filter((rel) => list.some((p) => read(rel).includes(p)));
    if (homes[locale].length === 0) missing.push(locale);
  }
  const everywhere = [...loadedBy].filter(([, by]) => by.length === pages.length).map(([file]) => ({ file, bytes: statSync(join(out, file)).size }));
  const shared = everywhere.sort((a, b) => b.bytes - a.bytes)[0] ?? null;
  return { pages: pages.length, startChunks: [...loadedBy.keys()].sort(), shared, leaks, homes, missing };
}

/**
 * The CLI's verdict: null when the export passes, else the reason.
 * @param {ConsoleLocaleReport} report
 * @returns {string | null}
 */
export function verdict(report) {
  if (report.leaks.length > 0) {
    const lines = report.leaks.map((l) => `${l.file} (${l.locale}, loaded at start by ${l.pages.length} grown-up pages, e.g. ${l.pages[0]}) holds "${l.probe}"`);
    return `grown-up pages load ${[...new Set(report.leaks.map((l) => l.locale))].join(' and ')} messages at start:\n  ${lines.join('\n  ')}`;
  }
  if (report.missing.length > 0) return `no chunk of the export holds the ${report.missing.join(' or ')} messages: the language chunks are missing, or the probes no longer match the bundle`;
  return null;
}

const isMain = Boolean(process.argv[1]) && existsSync(process.argv[1]) && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

if (isMain) {
  try {
    if (typeof nodeModule.register !== 'function') throw new Error(`needs Node 20.6+ (module.register); this is ${process.version}`);
    const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
    nodeModule.register(pathToFileURL(join(repo, 'scripts', 'ts-loader.mjs')));
    const messages = join(repo, 'packages', 'i18n', 'src', 'messages');
    const { isGrownUpPath } = await import(pathToFileURL(join(repo, 'packages', 'content-schema', 'src', 'schemas', 'app-shell.ts')).href);
    const { en } = await import(pathToFileURL(join(messages, 'en', 'index.ts')).href);
    const { es } = await import(pathToFileURL(join(messages, 'es', 'index.ts')).href);
    const { ko } = await import(pathToFileURL(join(messages, 'ko', 'index.ts')).href);
    // The content data the start chunks hold: the same generated modules the build bundles (`pnpm generate`).
    const data = join(repo, 'apps', 'web', 'src', 'data');
    const { VOCAB_CATALOG } = await import(pathToFileURL(join(data, 'vocab-catalog.ts')).href);
    const { CATALOGUE_TITLES } = await import(pathToFileURL(join(data, 'catalogue-titles.generated.ts')).href);
    const { LECTURE_STORIES, LECTURE_VOCAB_TOPICS } = await import(pathToFileURL(join(data, 'lecture-catalogue.generated.ts')).href);
    const { OVERLAYS } = await import(pathToFileURL(join(repo, 'packages', 'content-schema', 'src', 'overlay-tables.ts')).href);
    const content = contentTexts(VOCAB_CATALOG, CATALOGUE_TITLES, LECTURE_STORIES, LECTURE_VOCAB_TOPICS, OVERLAYS);
    const report = checkConsoleLocales(process.argv[2] ?? 'out', isGrownUpPath, { es: localeProbes(es, en, PROBES_PER_LOCALE, content), ko: localeProbes(ko, en, PROBES_PER_LOCALE, content) });
    const failure = verdict(report);
    if (failure !== null) throw new Error(failure);
    const shared = report.shared === null ? '' : `; shared chunk ${report.shared.file} ${report.shared.bytes} B`;
    const homes = Object.entries(report.homes)
      .map(([locale, chunks]) => `${locale} in ${chunks.join(', ')}`)
      .join('; ');
    process.stdout.write(`console-locale-check: ${report.pages} grown-up pages, ${report.startChunks.length} start chunks, no es / ko messages at start${shared}; ${homes}\n`);
  } catch (err) {
    process.stderr.write(`console-locale-check: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
