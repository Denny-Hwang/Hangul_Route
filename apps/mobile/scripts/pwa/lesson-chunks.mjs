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
  // The start bundle must not grow: its size after CM-8 moved the stories out (6,345,469 B raw / 1,573,399 B gzip, the
  // release build of CM-8's final code on CM-5's head, no recorded clips; 7,337,815 B after CM-5, 8,321,783 B before
  // CM-5) plus a 4,531 B rounding margin. A row that adds to it raises this line with its measurement; the es / ko story
  // overlays still in the start bundle leave it with row CM-8b, before CM-46a adds narration. The phase-0 integration
  // (#802: CM-1 to CM-8, CM-70a, CM-70b on one branch) measures 6,371,165 B raw / 1,582,440 B gzip, so the line is that
  // measurement plus an 8,835 B rounding margin. [OA] The one-account integration (#801: OA-0b to OA-9 on main
  // 34e8f85d5) adds the chooser, PIN v2, people-on-this-device and the face or fingerprint shortcut to the shell:
  // 6,487,010 B raw / 1,616,887 B gzip, so the line was that measurement plus a 7,990 B rounding margin. SN-2 (#804) adds
  // the site page titles and descriptions, the share-card caption, the 404 lines and the longer privacy text to the
  // bundled `landing` messages: 6,495,681 B raw / 1,618,867 B gzip (release) and 6,495,837 B raw / 1,618,965 B gzip
  // (app-host) on 8eba8de96, against 6,491,702 B raw on main 52403c87b, so the line was 6,495,837 B plus an 8,163 B margin.
  // The final integration (integrate/final-oa-site: OA-7b #798, SN-1 #813 and SN-2 #804 on main 7eb5bad61) adds Who is
  // joining? to the shell and the site-entry strings to the bundled `landing` messages: 6,518,688 B raw / 1,624,797 B
  // gzip (release `build:web`), so the line was that measurement plus a 6,312 B rounding margin (6,525,000 B).
  // The start bundle shrink (F-CURR-002 §10 decision record) makes the es / ko messages and content overlays a precached
  // chunk per locale and the presenter and All lessons chunks of their own: 4,712,987 B raw / 1,237,660 B gzip on main
  // 7eb5bad61 (6,491,546 B before; 4,713,416 B raw after its review fixes); merged onto the final integration (main fc580beed, release `build:web`) it measures
  // 4,732,797 B raw / 1,243,089 B gzip, so the line is that measurement plus a 7,203 B rounding margin.
  // [GU] Row GU-2 adds the always-on guest rules (the gates, the marker, the anonymous telemetry, the boot sweep):
  // 4,744,234 B raw / 1,246,930 B gzip (release `build:web`; 4,734,519 B raw on GU-1), so the line is that plus 5,766 B;
  // 4,747,423 B raw / 1,247,894 B gzip with its review fixes (2,577 B left under the line; later GU rows load lazily).
  startBundleRaw: 4_750_000,
  // Each locale chunk (the es or ko UI messages and content overlays; src/content/locale-chunks): a Spanish or Korean
  // learner waits for theirs before the first screen, and every es / ko string and story overlay grows it. Measured at
  // the start bundle shrink: ko 901,191 B, es 527,438 B raw (ko 905,927 B, es 530,463 B with the final integration's
  // strings, main fc580beed). The line leaves about 94 KB for the stories and strings
  // ahead (CM-46a, CM-46); a PR that crosses it raises it as a reviewed one-line change with its measurement, or moves
  // text out (CM-8b's story overlay split).
  localeChunkRaw: 1_000_000,
  // Each grown-up root chunk (the presenter, All lessons): measured at the start bundle shrink: PresenterApp 245,964 B,
  // BrowseApp 111,404 B raw. The line is the presenter plus about 54 KB.
  rootChunkRaw: 300_000,
  // The learner precache measured after CM-5 (8,787,329 B, 35 files, the release build, no recorded clips) + 2.5 MB;
  // crossing it triggers CM-5B (Save for offline). The jamo recordings re-measure it when they land (F-CURR-002 §10).
  learnerPrecacheRaw: 11_287_329,
  // The story lines of scripts/build-stories.mjs `BUDGET` (perStoryRaw, totalRaw, totalGzip), held on the built story
  // bundles too, which are what the service worker caches: a built bundle is about 13% larger than its generated
  // module (CM-8: 983,601 B built against 869,644 B of modules). The test keeps the two sets of lines equal.
  storyChunkRaw: 70_000,
  storiesRaw: 2_000_000,
  storiesGzip: 510_000,
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
 * The locale chunks of the learner PWA (F-CURR-002 §10): one web bundle per UI locale but English, holding that
 * locale's UI messages and content overlays (`src/content/locale-chunks/locale-<locale>.ts`), reached only through
 * the literal `import()`s of `src/platform/locale-packs.web.ts`. Each exports its marker (`LOCALE_PACK`), which
 * the start bundle must never carry.
 */
export const LOCALE_CHUNKS = Object.freeze([
  Object.freeze({ name: 'locale-es', marker: 'locale-pack:es' }),
  Object.freeze({ name: 'locale-ko', marker: 'locale-pack:ko' }),
]);

/**
 * The grown-up roots of the learner web build (F-CURR-002 §10): the presenter (`/present`) and All lessons
 * (`/browse`) are bundles of their own, reached only through the literal `import()`s of `index.ts`, so a
 * learner's start bundle carries neither. Each root module exports its marker (`ROOT_CHUNK`).
 */
export const ROOT_CHUNKS = Object.freeze([
  Object.freeze({ name: 'PresenterApp', marker: 'root-chunk:presenter' }),
  Object.freeze({ name: 'BrowseApp', marker: 'root-chunk:browse' }),
]);

/**
 * Problems with the marked chunks of one web build (the locale chunks and the grown-up roots; empty = sound): each
 * has exactly one bundle, named after it, whose file name is the md5 of its content, that carries its marker and is
 * precached, and no start bundle carries a marker (a static import would pull the chunk back in: Metro then leaves
 * an empty bundle behind).
 * @param {{ chunks?: readonly { name: string, marker: string }[], bundles: { url: string, text: string }[], precached: string[] }} input
 */
export function markedChunkProblems({ chunks = [...LOCALE_CHUNKS, ...ROOT_CHUNKS], bundles, precached }) {
  const problems = [];
  const listed = new Set(precached.map((u) => u.replace(/^\/+/, '')));
  const starts = bundles.filter((b) => isStartBundle(b.url));
  for (const { name, marker } of chunks) {
    const quoted = [`"${marker}"`, `'${marker}'`];
    for (const start of starts) {
      if (quoted.some((q) => start.text.includes(q))) problems.push(`${name} is in the start bundle ${start.url}: a static import pulled it in`);
    }
    const own = bundles.filter((b) => !isStartBundle(b.url) && NAMED.exec(b.url)?.[1] === name);
    if (own.length === 0) {
      problems.push(`${name} has no web bundle: the chunk is missing from the build`);
      continue;
    }
    if (own.length > 1) problems.push(`${name} has ${own.length} web bundles: ${own.map((b) => b.url).join(', ')}`);
    for (const bundle of own) {
      if (!quoted.some((q) => bundle.text.includes(q))) problems.push(`${bundle.url} does not carry ${marker}: it is not ${name}'s chunk (or it is empty)`);
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

/** Count, raw and gzip bytes of the bundles of these manifest entries, and the largest of them (null when none). */
function chunkTotals(manifest, bundles) {
  const names = new Set(manifest.map((m) => m.name));
  const chunks = bundles.filter((b) => !isStartBundle(b.url) && names.has(NAMED.exec(b.url)?.[1] ?? ''));
  let largest = null;
  for (const b of chunks) {
    const raw = bytes(b.text);
    if (largest === null || raw > largest.raw) largest = { url: b.url, raw };
  }
  return { count: chunks.length, raw: chunks.reduce((s, b) => s + bytes(b.text), 0), gzip: chunks.reduce((s, b) => s + gzipSize(b.text), 0), largest };
}

/**
 * The precache report: the start bundle, the lesson chunks, the story chunks (row CM-8), the locale chunks, the grown-up
 * root chunks and the whole learner precache.
 * @param {{ manifest: { name: string }[], stories?: { name: string }[], locales?: readonly { name: string }[], roots?: readonly { name: string }[], bundles: { url: string, text: string }[], precache: { count: number, size: number } }} input
 */
export function precacheReport({ manifest, stories = [], locales = [], roots = [], bundles, precache }) {
  const start = bundles.find((b) => isStartBundle(b.url));
  return {
    start: start === undefined ? null : { url: start.url, raw: bytes(start.text), gzip: gzipSize(start.text) },
    lessonChunks: chunkTotals(manifest, bundles),
    storyChunks: chunkTotals(stories, bundles),
    localeChunks: chunkTotals(locales, bundles),
    rootChunks: chunkTotals(roots, bundles),
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
  if (report.localeChunks !== undefined && report.localeChunks.count > 0) {
    lines.push(
      `  locale chunks  ${report.localeChunks.count} bundles  ${report.localeChunks.raw} B raw  ${report.localeChunks.gzip} B gzip  (largest ${report.localeChunks.largest?.raw ?? 0} B raw, ceiling ${budget.localeChunkRaw} B each)`,
    );
  }
  if (report.rootChunks !== undefined && report.rootChunks.count > 0) {
    lines.push(
      `  grown-up root chunks  ${report.rootChunks.count} bundles  ${report.rootChunks.raw} B raw  ${report.rootChunks.gzip} B gzip  (largest ${report.rootChunks.largest?.raw ?? 0} B raw, ceiling ${budget.rootChunkRaw} B each)`,
    );
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
  const stories = report.storyChunks;
  if (stories !== undefined) {
    const raise = '(raise it in scripts/build-stories.mjs BUDGET and PRECACHE_BUDGET together, as a reviewed one-line change with the measured numbers in the PR)';
    if (stories.largest !== null && stories.largest !== undefined && stories.largest.raw > budget.storyChunkRaw) {
      problems.push(`the story bundle ${stories.largest.url} is ${stories.largest.raw} B raw, over the per-story ceiling of ${budget.storyChunkRaw} B ${raise}`);
    }
    if (stories.raw > budget.storiesRaw) {
      problems.push(`the story bundles are ${stories.raw} B raw, over the stories ceiling of ${budget.storiesRaw} B ${raise}`);
    }
    if (stories.gzip > budget.storiesGzip) {
      problems.push(`the story bundles are ${stories.gzip} B gzip, over the stories ceiling of ${budget.storiesGzip} B gzip ${raise}`);
    }
  }
  const ceilings = [
    [report.localeChunks, budget.localeChunkRaw, 'locale', 'localeChunkRaw'],
    [report.rootChunks, budget.rootChunkRaw, 'grown-up root', 'rootChunkRaw'],
  ];
  for (const [chunks, ceiling, kind, line] of ceilings) {
    const largest = chunks?.largest;
    if (largest !== null && largest !== undefined && largest.raw > ceiling) {
      problems.push(
        `the ${kind} bundle ${largest.url} is ${largest.raw} B raw, over the per-${kind} ceiling of ${ceiling} B ` +
          `(raise PRECACHE_BUDGET.${line} in apps/mobile/scripts/pwa/lesson-chunks.mjs as a reviewed one-line change with the measured numbers in the PR)`,
      );
    }
  }
  if (report.precache.raw > budget.learnerPrecacheRaw) {
    problems.push(
      `the learner precache is ${report.precache.raw} B, over its ceiling of ${budget.learnerPrecacheRaw} B: row CM-5B (Save for offline) is triggered`,
    );
  }
  return problems;
}
