// F-CURR-002 §10 item 4 and row CM-5B: Save for offline. The learner precache holds Volume 1, Stage 1 and every
// start-up chunk; the later volumes (a lesson cell's Volume 2, `lessons-cell-stage<n>-<theme>-v2`, and the tales only a
// book 2 holds, `story-<slug>`) leave it. A later chunk is runtime-cached the first time it is used (`hr-later-v1`,
// cache-first: its name carries the md5 of its content), and a grown-up can save a stage's later chunks, with the
// stage's audio pack (AMENDMENTS-AUDIO-CLIPS AC-B6, "the Save for offline pack of CM-5B includes the stage's audio
// pack"), for offline ahead of time. The build writes what the app needs for that to `offline-packs.json` (precached):
// each stage's files, their bytes (the storage estimate) and the cache each one belongs in.
// Pure: pwa-postbuild.mjs feeds it the manifests, the built bundles and the built clips.

import { refOfBuiltClip, SAY_AUDIO_GROUP, REF_RUNTIME_CACHE, SAY_RUNTIME_CACHE } from '../audio/lib.mjs';

/** The runtime cache of the later chunks. Its name never changes with a build: the app saves into it, and a service worker update keeps it. */
export const LATER_CACHE = 'hr-later-v1';
/** The index the app reads (precached, at the site root). */
export const OFFLINE_PACKS_FILE = 'offline-packs.json';
/** The index's shape version; the app ignores an index of another version (an older or newer build). */
export const OFFLINE_PACKS_VERSION = 1;

const WEB_JS = '_expo/static/js/web';
const NAMED = /^_expo\/static\/js\/web\/(.+)-([0-9a-f]{32})\.js$/;
/** A lesson cell chunk of a later volume: `lessons-cell-stage<n>-<theme>-v<k>`, k at least 2. */
const LATER_CELL = /^lessons-cell-(stage[1-7])-[a-z]+-v([2-9])$/;

/** The stage a book holds its tales in (F-STORY-005: the books are Stage 5). */
export const BOOK_STAGE = 'stage5';

/** Strips `//` and block comments (book definitions hold no URL or string with `//`). */
const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/**
 * The tales only a book 2 holds (F-CURR-002 §5.1, row CM-46): every story id of a `volume: 2` book that no book 1
 * holds, read from the text of `src/content/books.ts` (`BOOK_DEFINITIONS`), the way the clip packs read jamo.ts. The
 * app derives the same set from the definitions themselves (`laterStoryIds`, `src/content/later-content.ts`), and a
 * test holds the two equal.
 * @param {string} booksSource the text of apps/mobile/src/content/books.ts
 * @returns {string[]} sorted
 */
export function laterStoryIds(booksSource) {
  const text = withoutComments(booksSource);
  const at = text.indexOf('BOOK_DEFINITIONS');
  if (at < 0) throw new Error('offline-packs: BOOK_DEFINITIONS not found in books.ts');
  const open = text.indexOf('[', text.indexOf('=', at));
  const books = [];
  let depth = 0;
  let start = -1;
  for (let i = open + 1; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) books.push(text.slice(start, i + 1));
    } else if (ch === ']' && depth === 0) break;
  }
  const read = (book) => {
    const volume = Number(/\bvolume\s*:\s*(\d)/.exec(book)?.[1] ?? 1);
    const list = /\bstoryIds\s*:\s*\[([^\]]*)\]/.exec(book)?.[1] ?? '';
    const ids = [...list.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
    return { volume, ids };
  };
  const parsed = books.map(read);
  const first = new Set(parsed.filter((b) => b.volume === 1).flatMap((b) => b.ids));
  return [...new Set(parsed.filter((b) => b.volume >= 2).flatMap((b) => b.ids))].filter((id) => !first.has(id)).sort();
}

/**
 * The later chunks of a build, by name, with their stage: the lesson manifest's Volume 2 cells and the story
 * manifest's book 2 tales. Every other chunk stays in the precache.
 * @param {{ lessons: readonly { name: string }[], stories: readonly { name: string }[], laterStories: readonly string[] }} input
 * @returns {{ name: string, stage: string }[]} sorted by name
 */
export function laterChunks({ lessons, stories, laterStories }) {
  const out = [];
  for (const { name } of lessons) {
    const m = LATER_CELL.exec(name);
    if (m !== null) out.push({ name, stage: m[1] });
  }
  const tales = new Set(laterStories.map((id) => `story-${id.replace(/^story:/, '')}`));
  for (const { name } of stories) if (tales.has(name)) out.push({ name, stage: BOOK_STAGE });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const bytes = (text) => Buffer.byteLength(text, 'utf8');

/**
 * The built bundles of the later chunks: `{ name, stage, url, bytes }` for each bundle named after one (the chunk
 * checks of lesson-chunks.mjs fail a chunk with no bundle or more than one).
 * @param {readonly { name: string, stage: string }[]} later `laterChunks`
 * @param {readonly { url: string, text: string }[]} bundles every JS file of the web folder
 */
export function laterBundles(later, bundles) {
  const stageOf = new Map(later.map((c) => [c.name, c.stage]));
  return bundles
    .map((b) => ({ b, name: NAMED.exec(b.url)?.[1] }))
    .filter(({ name }) => name !== undefined && stageOf.has(name))
    .map(({ b, name }) => ({ name, stage: stageOf.get(name), url: b.url, bytes: bytes(b.text) }))
    .sort((a, b) => a.url.localeCompare(b.url));
}

/** Workbox `globIgnores` for the later bundles: each by its own path, so no other chunk can match by accident. */
export const laterGlobIgnores = (built) => built.map((b) => b.url);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The Workbox runtime rule of the later chunks: cache-first into `LATER_CACHE` (a chunk's name is the md5 of its
 * content, so a cached one is never stale), with no expiry (a saved stage stays saved), same-origin, and only a
 * real script: the host's single-page fallback answers a chunk of another build with its HTML page and status 200,
 * which the app reads as a newer build and which must never be cached as the chunk.
 * @param {readonly { name: string }[]} later `laterChunks`
 * @returns {object | null} null when the build has no later chunk
 */
export function laterRuntimeCaching(later) {
  if (later.length === 0) return null;
  const names = [...new Set(later.map((c) => c.name))].sort().map(escape);
  return {
    urlPattern: new RegExp(`/${escape(WEB_JS)}/(?:${names.join('|')})-[0-9a-f]{32}\\.js$`),
    handler: 'CacheFirst',
    options: {
      cacheName: LATER_CACHE,
      plugins: [
        {
          cacheWillUpdate: async ({ response }) =>
            response && response.status === 200 && !/text\/html/i.test(response.headers.get('content-type') || '') ? response : null,
        },
      ],
    },
  };
}

/** The runtime cache a built clip belongs in (the rules of audio/lib.mjs `audioRuntimeCaching`). */
const clipCache = (ref) => (ref.startsWith(`audio/${SAY_AUDIO_GROUP}/`) ? SAY_RUNTIME_CACHE.cacheName : REF_RUNTIME_CACHE.cacheName);

/**
 * The index the app reads (`offline-packs.json`): for each stage with later content, its files (the later chunks and
 * the clips of the stage's audio pack, `stage<n>`), each with its bytes and its cache, and the stage's total. A stage
 * with clips and no later chunk is left out: its lessons are precached and its clips warm on first use (AC-6), so
 * there is nothing a grown-up needs to save.
 * @param {{ later: readonly { stage: string, url: string, bytes: number }[], clips?: readonly { url: string, bytes: number }[], packOf?: (ref: string) => string | undefined }} input
 */
export function offlinePacksIndex({ later, clips = [], packOf = () => undefined }) {
  const stages = new Map();
  const add = (stage, file) => {
    const list = stages.get(stage) ?? [];
    list.push(file);
    stages.set(stage, list);
  };
  for (const c of later) add(c.stage, { url: `/${c.url}`, bytes: c.bytes, cache: LATER_CACHE });
  for (const clip of clips) {
    const ref = refOfBuiltClip(clip.url);
    const pack = ref === null ? undefined : packOf(ref);
    if (ref === null || pack === undefined || !/^stage[1-7]$/.test(pack) || !stages.has(pack)) continue;
    add(pack, { url: `/${clip.url.replace(/^\/+/, '')}`, bytes: clip.bytes, cache: clipCache(ref) });
  }
  return {
    version: OFFLINE_PACKS_VERSION,
    stages: [...stages.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([stage, files]) => {
        const sorted = [...files].sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
        return { stage, bytes: sorted.reduce((s, f) => s + f.bytes, 0), files: sorted };
      }),
  };
}

/**
 * Problems with the later chunks of one build (empty = sound): none of them may be precached (they are the bytes
 * CM-5B takes out of the precache), the index must name each one, and the index itself must be precached (the app
 * reads it offline to know what is saved).
 * @param {{ built: readonly { url: string }[], precached: readonly string[], index: { stages: { files: { url: string }[] }[] } }} input
 */
export function laterChunkProblems({ built, precached, index }) {
  const problems = [];
  const listed = new Set(precached.map((u) => u.replace(/^\/+/, '').split('?')[0]));
  const named = new Set(index.stages.flatMap((s) => s.files.map((f) => f.url.replace(/^\/+/, ''))));
  for (const b of built) {
    if (listed.has(b.url)) problems.push(`${b.url} is a later chunk in the learner precache: it is runtime-cached and saved for offline on request (CM-5B)`);
    if (!named.has(b.url)) problems.push(`${b.url} is missing from ${OFFLINE_PACKS_FILE}: Save for offline could not fetch it`);
  }
  if (!listed.has(OFFLINE_PACKS_FILE)) problems.push(`${OFFLINE_PACKS_FILE} is missing from the precache: the app could not tell what is saved for offline`);
  return problems;
}

/** The later chunks' totals for the precache report. */
export function laterTotals(built) {
  return { count: built.length, raw: built.reduce((s, b) => s + b.bytes, 0) };
}
