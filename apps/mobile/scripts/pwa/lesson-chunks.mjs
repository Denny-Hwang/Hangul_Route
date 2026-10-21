// F-CURR-002 §10 (row CM-5): the lesson chunks in the PWA build, and the precache report.
//
// scripts/build-lessons.mjs writes a start-loaded manifest and one content-hashed chunk per
// lesson cell (plus one title chunk per locale), each reached only through a literal `import()`.
// Metro web emits each chunk as its own bundle, `_expo/static/js/web/<name>-<md5>.js`, and the
// learner precache keeps every JS file. This module checks the result, the way the letter-clip
// gaps check (audio/lib.mjs `precacheGaps`) guards the clips:
//   - every manifest entry has exactly one bundle, named after it, that carries the manifest's
//     hash (`CHUNK_HASH`), whose file name is the md5 of its content, and that is precached;
//   - the start bundle names every hash (it was built from the same manifest) and carries no
//     chunk (a static import would pull one back in: Metro then leaves an empty bundle behind);
// and reports the start bundle, the chunks and the learner precache against their budget lines.
// Row CM-8 puts the story chunks of scripts/build-stories.mjs (one per story, the same hashing) through
// the same checks: pwa-postbuild.mjs passes both manifests, and the report counts each apart.
// Pure, apart from `md5`/`gzipSize` helpers; pwa-postbuild.mjs feeds it the built files.

import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { headersFor, parseHeaders } from '../app-host/headers.mjs';

/** The web bundle folder of an Expo export, relative to dist. */
export const WEB_JS_DIR = '_expo/static/js/web';
const ENTRY = /^_expo\/static\/js\/web\/index-[0-9a-f]+\.js$/;
const NAMED = /^_expo\/static\/js\/web\/(.+)-([0-9a-f]{32})\.js$/;

/**
 * Budget lines of the learner build (F-CURR-002 §10 ceilings table and OD-5). Each is a reviewed
 * one-line change with the measured numbers in its PR.
 */
export const PRECACHE_BUDGET = Object.freeze({
  // The start bundle must not grow: its size after CM-8 moved the stories out (CM8_RAW B raw / CM8_GZ B gzip, the
  // release build, no recorded clips; 7,337,815 B after CM-5, 8,321,783 B before CM-5) plus a CM8_MARGIN B rounding
  // margin. A row that adds to it raises this line with its measurement.
  startBundleRaw: CM8_LINE,
  // The learner precache measured after CM-5 (8,787,329 B, 35 files, the release build, no recorded clips) + 2.5 MB;
  // crossing it triggers CM-5B (Save for offline). The jamo recordings re-measure it when they land (F-CURR-002 §10).
  learnerPrecacheRaw: 11_287_329,
});

export const md5 = (text) => createHash('md5').update(text, 'utf8').digest('hex');
export const gzipSize = (text) => gzipSync(text).length;

export const isStartBundle = (url) => ENTRY.test(url);

const carries = (text, hash) => new RegExp(`CHUNK_HASH\\s*=\\s*["']${hash}["']`).test(text);

/**
 * Problems with the lesson chunks of one web build (empty = sound).
 * @param {{ manifest: { name: string, hash: string }[], bundles: { url: string, text: string }[], precached: string[] }} input
 *   `manifest`: build-lessons.mjs `chunkManifest`; `bundles`: every JS file of WEB_JS_DIR; `precached`: the precache URLs.
 */
export function lessonChunkProblems({ manifest, bundles, precached }) {
  const problems = [];
  const listed = new Set(precached.map((u) => u.replace(/^\/+/, '')));
  const starts = bundles.filter((b) => isStartBundle(b.url));
  if (starts.length !== 1) problems.push(`expected one start bundle (${WEB_JS_DIR}/index-<hash>.js), found ${starts.length}`);
  for (const { name, hash } of manifest) {
    for (const start of starts) {
      if (carries(start.text, hash)) problems.push(`${name} is in the start bundle ${start.url}: a static import pulled the chunk in`);
      if (!start.text.includes(`"${hash}"`)) problems.push(`the start bundle ${start.url} does not name ${name}'s hash ${hash}: the shell and the chunk come from other content`);
    }
    const own = bundles.filter((b) => !isStartBundle(b.url) && NAMED.exec(b.url)?.[1] === name);
    if (own.length === 0) {
      problems.push(`${name} has no web bundle: the chunk is missing from the build`);
      continue;
    }
    if (own.length > 1) problems.push(`${name} has ${own.length} web bundles: ${own.map((b) => b.url).join(', ')}`);
    for (const bundle of own) {
      if (!carries(bundle.text, hash)) problems.push(`${bundle.url} does not carry ${hash}, the hash the manifest names for ${name}`);
      if (NAMED.exec(bundle.url)?.[2] !== md5(bundle.text)) problems.push(`${bundle.url}: its file name is not the md5 of its content`);
      if (!listed.has(bundle.url)) problems.push(`${bundle.url} is missing from the precache`);
    }
  }
  return problems;
}

/**
 * Lesson chunk bundles that the host's `_headers` rules would serve with `X-Content-Type-Options: nosniff`
 * (empty = none). A page of an older build that asks for a chunk the host no longer has gets the app's HTML
 * page (the single-page fallback, 200); without nosniff the browser runs it, Metro finds no module in it and
 * the page reloads onto the new build. With nosniff the browser refuses it as a script error, which the app
 * then has to tell from a network failure by asking the URL again (`platform/new-build-reload.web.ts`). The
 * check keeps the plain path the one in use: a `/*` or `/_expo/*` nosniff rule fails the build.
 * @param {string} headersText the content of `dist/_headers` ('' when there is none)
 * @param {string[]} chunkUrls the lesson chunk bundles, relative to dist (`_expo/static/js/web/<name>-<md5>.js`)
 */
export function nosniffLessonChunks(headersText, chunkUrls) {
  const rules = parseHeaders(headersText);
  return chunkUrls.filter((url) => /\bnosniff\b/i.test(headersFor(rules, `/${url.replace(/^\/+/, '')}`)['x-content-type-options'] ?? ''));
}

/** The lesson chunk bundles of a build: every bundle named after a manifest entry. */
export function lessonChunkUrls(manifest, bundles) {
  const names = new Set(manifest.map((m) => m.name));
  return bundles.filter((b) => !isStartBundle(b.url) && names.has(NAMED.exec(b.url)?.[1] ?? '')).map((b) => b.url);
}

const bytes = (text) => Buffer.byteLength(text, 'utf8');

/** Count, raw and gzip bytes of the bundles of these manifest entries. */
function chunkTotals(manifest, bundles) {
  const names = new Set(manifest.map((m) => m.name));
  const chunks = bundles.filter((b) => !isStartBundle(b.url) && names.has(NAMED.exec(b.url)?.[1] ?? ''));
  return { count: chunks.length, raw: chunks.reduce((s, b) => s + bytes(b.text), 0), gzip: chunks.reduce((s, b) => s + gzipSize(b.text), 0) };
}

/**
 * The precache report: the start bundle, the lesson chunks, the story chunks (row CM-8) and the whole learner precache.
 * @param {{ manifest: { name: string }[], stories?: { name: string }[], bundles: { url: string, text: string }[], precache: { count: number, size: number } }} input
 */
export function precacheReport({ manifest, stories = [], bundles, precache }) {
  const start = bundles.find((b) => isStartBundle(b.url));
  return {
    start: start === undefined ? null : { url: start.url, raw: bytes(start.text), gzip: gzipSize(start.text) },
    lessonChunks: chunkTotals(manifest, bundles),
    storyChunks: chunkTotals(stories, bundles),
    precache: { count: precache.count, raw: precache.size },
  };
}

/** The report as printed lines. */
export function reportLines(report, budget = PRECACHE_BUDGET) {
  const lines = ['pwa-postbuild: precache report (F-CURR-002 §10)'];
  if (report.start !== null) {
    lines.push(`  start bundle  ${report.start.url}  ${report.start.raw} B raw  ${report.start.gzip} B gzip  (ceiling ${budget.startBundleRaw} B raw)`);
  }
  lines.push(`  lesson chunks  ${report.lessonChunks.count} bundles  ${report.lessonChunks.raw} B raw  ${report.lessonChunks.gzip} B gzip`);
  if (report.storyChunks !== undefined) {
    lines.push(`  story chunks  ${report.storyChunks.count} bundles  ${report.storyChunks.raw} B raw  ${report.storyChunks.gzip} B gzip`);
  }
  lines.push(`  learner precache  ${report.precache.count} files  ${report.precache.raw} B  (ceiling ${budget.learnerPrecacheRaw} B)`);
  return lines;
}

/**
 * True on the deploy's own build (Cloudflare Workers Builds sets `WORKERS_CI`, Pages `CF_PAGES`):
 * there `--budget` only warns. A budget line is a review gate on the pull request (web-app.yml runs
 * the same `build:web` before a merge); it must never stop a deploy, a hotfix least of all. The chunk
 * checks above always fail the build, deploy or not: a broken chunk would break the app.
 */
export const budgetIsAdvisory = (env) => Boolean(env.WORKERS_CI || env.CF_PAGES);

/** Budget problems of the report (empty = within budget). */
export function precacheBudgetProblems(report, budget = PRECACHE_BUDGET) {
  const problems = [];
  if (report.start === null) problems.push('no start bundle to measure');
  else if (report.start.raw > budget.startBundleRaw) {
    problems.push(
      `the start bundle is ${report.start.raw} B raw, over its ceiling of ${budget.startBundleRaw} B: it must not grow ` +
        '(move the code out of the start bundle, or raise PRECACHE_BUDGET.startBundleRaw in apps/mobile/scripts/pwa/lesson-chunks.mjs as a reviewed one-line change with the measured numbers in the PR)',
    );
  }
  if (report.precache.raw > budget.learnerPrecacheRaw) {
    problems.push(
      `the learner precache is ${report.precache.raw} B, over its ceiling of ${budget.learnerPrecacheRaw} B: row CM-5B (Save for offline) is triggered`,
    );
  }
  return problems;
}
