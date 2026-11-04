// F-CURR-002 §10 item 4, row CM-5B: the later chunks leave the learner precache; offline-packs.json says what a
// grown-up can save for offline.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOOK_STAGE,
  LATER_CACHE,
  OFFLINE_PACKS_FILE,
  OFFLINE_PACKS_VERSION,
  laterBundles,
  laterChunkProblems,
  laterChunks,
  laterGlobIgnores,
  laterRuntimeCaching,
  laterStoryIds,
  laterTotals,
  offlinePacksIndex,
} from '../pwa/offline-packs.mjs';
import { REF_RUNTIME_CACHE, SAY_RUNTIME_CACHE } from '../audio/lib.mjs';
import { PRECACHE_BUDGET, md5 } from '../pwa/lesson-chunks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const WEB = '_expo/static/js/web';
const bundle = (name, size = 10) => {
  const text = `x`.repeat(size) + name;
  return { url: `${WEB}/${name}-${md5(text)}.js`, text };
};

const BOOKS = `
import { x } from './y';
/** The books. A comment that says volume: 2 is not a book. */
export const BOOK_DEFINITIONS: readonly BookDefinition[] = [
  {
    id: 'episode:stage5-nature',
    storyIds: ['story:sun-and-moon', 'story:angbuilgu-sundial'],
  },
  // Book 2 of Nature: volume: 2 in a comment too.
  {
    id: 'episode:stage5-nature-v2',
    storyIds: ['story:jeju-volcanic-island', "story:sun-and-moon"],
    volume: 2,
  },
  {
    id: 'episode:stage5-crafts-v2',
    storyIds: ['story:hahoe-mask-dance', 'story:hanji-korean-paper'],
    volume: 2,
  },
];
export const OTHER = [{ storyIds: ['story:not-a-book'], volume: 2 }];
`;

describe('laterStoryIds (the tales only a book 2 holds)', () => {
  it('reads the volume 2 books, leaves out a tale a book 1 holds and ignores comments and other lists', () => {
    expect(laterStoryIds(BOOKS)).toEqual(['story:hahoe-mask-dance', 'story:hanji-korean-paper', 'story:jeju-volcanic-island']);
  });

  it('is empty for the shipped books.ts with no book 2, and fails loudly on a file without the definitions', () => {
    const real = readFileSync(join(here, '..', '..', 'src', 'content', 'books.ts'), 'utf8');
    expect(Array.isArray(laterStoryIds(real))).toBe(true);
    expect(() => laterStoryIds('export const NOTHING = 1;')).toThrow(/BOOK_DEFINITIONS/);
  });
});

describe('laterChunks and their bundles', () => {
  const lessons = [
    { name: 'lessons-cell-stage2-nature' },
    { name: 'lessons-cell-stage2-nature-v2' },
    { name: 'lessons-cell-stage7-letters-v2' },
    { name: 'lessons-titles-es' },
    { name: 'lessons-headers-en' },
  ];
  const stories = [{ name: 'story-sun-and-moon' }, { name: 'story-jeju-volcanic-island' }];
  const later = laterChunks({ lessons, stories, laterStories: ['story:jeju-volcanic-island'] });

  it('takes each Volume 2 cell with its stage and each book 2 tale on Stage 5; Volume 1, titles, headers and shelf tales stay', () => {
    expect(later).toEqual([
      { name: 'lessons-cell-stage2-nature-v2', stage: 'stage2' },
      { name: 'lessons-cell-stage7-letters-v2', stage: 'stage7' },
      { name: 'story-jeju-volcanic-island', stage: BOOK_STAGE },
    ]);
  });

  it('finds each later bundle by its exact name (a Volume 1 bundle of the same cell is not one) and measures it', () => {
    const v1 = bundle('lessons-cell-stage2-nature');
    const v2 = bundle('lessons-cell-stage2-nature-v2', 100);
    const tale = bundle('story-jeju-volcanic-island', 50);
    const built = laterBundles(later, [v1, v2, tale, { url: `${WEB}/index-abc.js`, text: '' }]);
    expect(built.map((b) => b.name)).toEqual(['lessons-cell-stage2-nature-v2', 'story-jeju-volcanic-island']);
    expect(built[0]).toMatchObject({ stage: 'stage2', url: v2.url, bytes: Buffer.byteLength(v2.text) });
    expect(laterGlobIgnores(built)).toEqual([v2.url, tale.url]);
    expect(laterTotals(built)).toEqual({ count: 2, raw: built[0].bytes + built[1].bytes });
  });
});

describe('laterRuntimeCaching (the service worker rule)', () => {
  it('is null with no later chunk', () => {
    expect(laterRuntimeCaching([])).toBeNull();
  });

  it('is cache-first into the stable later cache, matches only the later bundles, and never caches an HTML answer', async () => {
    const rule = laterRuntimeCaching([{ name: 'lessons-cell-stage2-nature-v2' }, { name: 'story-jeju-volcanic-island' }]);
    expect(rule.handler).toBe('CacheFirst');
    expect(rule.options.cacheName).toBe(LATER_CACHE);
    const md = 'a'.repeat(32);
    expect(rule.urlPattern.test(`https://app.example/${WEB}/lessons-cell-stage2-nature-v2-${md}.js`)).toBe(true);
    expect(rule.urlPattern.test(`https://app.example/${WEB}/story-jeju-volcanic-island-${md}.js`)).toBe(true);
    expect(rule.urlPattern.test(`https://app.example/${WEB}/lessons-cell-stage2-nature-${md}.js`)).toBe(false);
    expect(rule.urlPattern.test(`https://app.example/${WEB}/story-sun-and-moon-${md}.js`)).toBe(false);
    const [plugin] = rule.options.plugins;
    const answer = (status, type) => ({ status, headers: new Headers({ 'content-type': type }) });
    const js = answer(200, 'application/javascript; charset=utf-8');
    expect(await plugin.cacheWillUpdate({ response: js })).toBe(js);
    expect(await plugin.cacheWillUpdate({ response: answer(200, 'text/html; charset=utf-8') })).toBeNull();
    expect(await plugin.cacheWillUpdate({ response: answer(404, 'application/javascript') })).toBeNull();
    expect(await plugin.cacheWillUpdate({ response: null })).toBeNull();
  });

  it('serializes as Workbox does (a function written into sw.js keeps its body)', () => {
    const rule = laterRuntimeCaching([{ name: 'lessons-cell-stage2-nature-v2' }]);
    expect(String(rule.options.plugins[0].cacheWillUpdate)).toMatch(/text\\\/html/);
  });
});

describe('offlinePacksIndex', () => {
  const later = [
    { stage: 'stage2', url: `${WEB}/lessons-cell-stage2-nature-v2-${'a'.repeat(32)}.js`, bytes: 40_000 },
    { stage: 'stage5', url: `${WEB}/story-jeju-volcanic-island-${'b'.repeat(32)}.js`, bytes: 45_000 },
  ];
  const packs = new Map([
    ['audio/say/0123456789abcdef.mp3', 'stage2'],
    ['audio/dialogue/s2-hello.mp3', 'stage2'],
    ['audio/say/fedcba9876543210.mp3', 'stage3'],
    ['audio/jamo/giyeok.mp3', 'jamo-s1'],
  ]);
  const clips = [
    { url: 'assets/assets/audio/say/0123456789abcdef.1a2b.mp3', bytes: 3_000 },
    { url: '/assets/assets/audio/dialogue/s2-hello.mp3', bytes: 2_000 },
    { url: 'assets/assets/audio/say/fedcba9876543210.mp3', bytes: 1_000 },
    { url: 'assets/assets/audio/jamo/giyeok.mp3', bytes: 9_000 },
    { url: 'assets/icon.png', bytes: 9_000 },
  ];
  const index = offlinePacksIndex({ later, clips, packOf: (ref) => packs.get(ref) });

  it('lists each stage with later content, its later chunks and its own audio pack, each file with its bytes and cache', () => {
    expect(index.version).toBe(OFFLINE_PACKS_VERSION);
    expect(index.stages.map((s) => s.stage)).toEqual(['stage2', 'stage5']);
    const [s2, s5] = index.stages;
    expect(s2.bytes).toBe(45_000);
    expect(s2.files).toEqual([
      { url: `/${later[0].url}`, bytes: 40_000, cache: LATER_CACHE },
      { url: '/assets/assets/audio/dialogue/s2-hello.mp3', bytes: 2_000, cache: REF_RUNTIME_CACHE.cacheName },
      { url: '/assets/assets/audio/say/0123456789abcdef.1a2b.mp3', bytes: 3_000, cache: SAY_RUNTIME_CACHE.cacheName },
    ]);
    // Stage 3 has clips but no later chunk: nothing to save. jamo-s1 is precached; an image is no clip.
    expect(s5).toEqual({ stage: 'stage5', bytes: 45_000, files: [{ url: `/${later[1].url}`, bytes: 45_000, cache: LATER_CACHE }] });
  });

  it('is empty with no later content (a build before any Volume 2 ships)', () => {
    expect(offlinePacksIndex({ later: [] })).toEqual({ version: OFFLINE_PACKS_VERSION, stages: [] });
  });

  it('laterChunkProblems: a later bundle in the precache, one the index leaves out, and an index not precached all fail', () => {
    const built = later.map((l) => ({ url: l.url }));
    expect(laterChunkProblems({ built, precached: [OFFLINE_PACKS_FILE], index })).toEqual([]);
    expect(laterChunkProblems({ built, precached: [`/${later[0].url}`], index })).toEqual([
      expect.stringMatching(/is a later chunk in the learner precache/),
      expect.stringMatching(/offline-packs\.json is missing from the precache/),
    ]);
    expect(laterChunkProblems({ built, precached: [OFFLINE_PACKS_FILE], index: { stages: [] } })).toEqual([
      expect.stringMatching(/missing from offline-packs\.json/),
      expect.stringMatching(/missing from offline-packs\.json/),
    ]);
  });
});

describe('the precache line holds as later content grows (F-CURR-002 §10, CM-5B)', () => {
  // The Volume 2 integration (integrate/cm-1103) measured the learner precache at 11,590,564 B with every Volume 2
  // cell and both books 2 in it (12,110,564 B with the whole jamo-s1 pack), over the 11,287,329 B line. With those
  // chunks runtime-cached, every cell of the plan's Volume 2 (25 cells, 5 themes x Stages 2, 3, 4, 6, 7) and every
  // book 2 tale is out of the precache, so what is left is Volume 1, Stage 1 and the start-up chunks.
  const themes = ['letters', 'life', 'rites', 'nature', 'crafts'];
  const stages = ['stage2', 'stage3', 'stage4', 'stage6', 'stage7'];
  const v2 = stages.flatMap((s) => themes.map((t) => ({ name: `lessons-cell-${s}-${t}-v2` })));
  const v1 = stages.flatMap((s) => themes.map((t) => ({ name: `lessons-cell-${s}-${t}` })));
  const tales = ['jeju-volcanic-island', 'jirisan-national-park', 'suncheon-bay-wetland', 'hahoe-mask-dance', 'hanji-korean-paper'];

  it('every Volume 2 cell of the plan and every book 2 tale are later chunks; no Volume 1 cell is', () => {
    const later = laterChunks({
      lessons: [...v1, ...v2, { name: 'lessons-titles-ko' }, { name: 'lessons-headers-ko' }],
      stories: [...tales, 'sun-and-moon'].map((t) => ({ name: `story-${t}` })),
      laterStories: tales.map((t) => `story:${t}`),
    });
    expect(later.map((c) => c.name).sort()).toEqual([...v2.map((c) => c.name), ...tales.map((t) => `story-${t}`)].sort());
  });

  it('the integration measurement minus its later bundles is under the line, with the whole jamo-s1 pack, at the plan size', () => {
    // CM-40's measured average (13,800 B a quest as emitted, built bundles about 10% over) for the plan's 75 Volume 2
    // quests, and 5 book 2 tales at the story line's measured average (983,601 B / 24 bundles).
    const volumeTwo = Math.round(75 * 13_800 * 1.1);
    const books = Math.round(5 * (983_601 / 24));
    const withPack = 12_110_564 - volumeTwo - books;
    expect(withPack).toBeLessThan(PRECACHE_BUDGET.learnerPrecacheRaw);
  });
});
