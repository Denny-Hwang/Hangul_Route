import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOOK_DEFINITIONS, VOLUME_TWO_STORY_IDS } from '../../../content/books';
import {
  LATER_CACHE,
  availableChunks,
  cellChunkName,
  chunkNameOfUrl,
  filesToRemove,
  filesToSave,
  fits,
  freeBytes,
  indexUrls,
  isLaterCellId,
  laterStoryIdsOf,
  megabytes,
  parseOfflinePacks,
  stagePackRows,
  staleLaterUrls,
  storyChunkName,
  type OfflinePacksIndex,
} from '../offline-packs';
// The web build's reader of the same set (scripts/pwa/offline-packs.mjs), held equal to the app's below.
// @ts-expect-error -- a plain .mjs build script with no type declarations
import { laterStoryIds, LATER_CACHE as BUILD_LATER_CACHE, OFFLINE_PACKS_VERSION as BUILD_VERSION } from '../../../../scripts/pwa/offline-packs.mjs';

const md = (c: string): string => c.repeat(32);
const V2 = `/_expo/static/js/web/lessons-cell-stage2-nature-v2-${md('a')}.js`;
const SAY = '/assets/assets/audio/say/0123456789abcdef.mp3';
const SHARED = '/assets/assets/audio/say/fedcba9876543210.mp3';
const TALE = `/_expo/static/js/web/story-jeju-volcanic-island-${md('b')}.js`;

const RAW = {
  version: 1,
  stages: [
    {
      stage: 'stage2',
      bytes: 999, // recomputed from the files
      files: [
        { url: V2, bytes: 40_000, cache: LATER_CACHE },
        { url: SAY, bytes: 3_000, cache: 'hr-audio-say-v1' },
        { url: SHARED, bytes: 1_000, cache: 'hr-audio-say-v1' },
      ],
    },
    { stage: 'stage5', bytes: 45_000, files: [{ url: TALE, bytes: 45_000, cache: LATER_CACHE }, { url: SHARED, bytes: 1_000, cache: 'hr-audio-say-v1' }] },
  ],
};
const INDEX = parseOfflinePacks(RAW) as OfflinePacksIndex;

describe('parseOfflinePacks', () => {
  it('reads the build index and recomputes each stage total', () => {
    expect(INDEX.stages.map((s) => [s.stage, s.bytes])).toEqual([
      ['stage2', 44_000],
      ['stage5', 46_000],
    ]);
    expect(indexUrls(INDEX)).toEqual([V2, SAY, SHARED, TALE, SHARED]);
  });

  it('refuses another version, an HTML answer and any malformed entry', () => {
    expect(parseOfflinePacks({ ...RAW, version: 2 })).toBeNull();
    expect(parseOfflinePacks('<!doctype html>')).toBeNull();
    expect(parseOfflinePacks(null)).toBeNull();
    expect(parseOfflinePacks({ version: 1, stages: {} })).toBeNull();
    expect(parseOfflinePacks({ version: 1, stages: [{ stage: 'stage9', files: [] }] })).toBeNull();
    expect(parseOfflinePacks({ version: 1, stages: [{ stage: 'stage2', files: [{ url: 'http://x/a.js', bytes: 1, cache: 'c' }] }] })).toBeNull();
    expect(parseOfflinePacks({ version: 1, stages: [{ stage: 'stage2', files: [{ url: '/a.js', bytes: -1, cache: 'c' }] }] })).toBeNull();
    expect(parseOfflinePacks({ version: 1, stages: [{ stage: 'stage2', files: [{ url: '/a.js', bytes: 1 }] }] })).toBeNull();
    expect(parseOfflinePacks({ version: 1, stages: [null] })).toBeNull();
    expect(parseOfflinePacks({ version: 1, stages: [] })).toEqual({ version: 1, stages: [] });
  });
});

describe('stage rows and what to save or remove', () => {
  it('a stage is saved with every file in, partly with some (a lesson opened online once), else not saved', () => {
    expect(stagePackRows(INDEX, new Set(), ['stage5'])).toEqual([
      { stage: 'stage2', bytes: 44_000, missingBytes: 44_000, state: 'notSaved', chosen: false },
      { stage: 'stage5', bytes: 46_000, missingBytes: 46_000, state: 'notSaved', chosen: true },
    ]);
    const rows = stagePackRows(INDEX, new Set([V2, TALE, SHARED]), []);
    expect(rows.map((r) => [r.state, r.missingBytes])).toEqual([
      ['partly', 3_000],
      ['saved', 0],
    ]);
  });

  it('filesToSave lists each missing file of the chosen stages once', () => {
    expect(filesToSave(INDEX, ['stage2', 'stage5'], new Set([SAY])).map((f) => f.url)).toEqual([V2, SHARED, TALE]);
    expect(filesToSave(INDEX, [], new Set())).toEqual([]);
  });

  it('filesToRemove keeps a file another kept stage shares', () => {
    expect(filesToRemove(INDEX, 'stage2', ['stage5']).map((f) => f.url)).toEqual([V2, SAY]);
    expect(filesToRemove(INDEX, 'stage2', []).map((f) => f.url)).toEqual([V2, SAY, SHARED]);
    expect(filesToRemove(INDEX, 'stage7', [])).toEqual([]);
  });

  it('availableChunks names the later bundles on the device; a clip is no chunk', () => {
    expect([...availableChunks(INDEX, new Set([V2, SAY]))]).toEqual(['lessons-cell-stage2-nature-v2']);
    expect(chunkNameOfUrl(TALE)).toBe('story-jeju-volcanic-island');
    expect(chunkNameOfUrl(SAY)).toBeUndefined();
  });

  it('staleLaterUrls drops what an older build cached and this one does not name', () => {
    const old = `/_expo/static/js/web/lessons-cell-stage2-nature-v2-${md('c')}.js`;
    expect(staleLaterUrls([V2, old], INDEX)).toEqual([old]);
  });
});

describe('space and sizes', () => {
  it('free bytes and whether a pack fits; unknown space never blocks', () => {
    expect(freeBytes(null)).toBeNull();
    expect(freeBytes({ quota: 0, usage: 0 })).toBeNull();
    expect(freeBytes({ quota: 10, usage: 15 })).toBe(0);
    expect(freeBytes({ quota: 100, usage: 40 })).toBe(60);
    expect(fits({ quota: 100, usage: 40 }, 60)).toBe(true);
    expect(fits({ quota: 100, usage: 40 }, 61)).toBe(false);
    expect(fits(null, 1e12)).toBe(true);
  });

  it('megabytes: one decimal, never 0 for a real pack', () => {
    expect(megabytes(0)).toBe(0);
    expect(megabytes(1)).toBe(0.1);
    expect(megabytes(1_049_000)).toBe(1);
    expect(megabytes(12_345_678)).toBe(12.3);
  });
});

describe('later content ids', () => {
  it('a later cell is a volume 2 id; chunk names follow the build scripts', () => {
    expect(isLaterCellId('episode:stage2-nature-v2')).toBe(true);
    expect(isLaterCellId('episode:stage2-nature')).toBe(false);
    expect(cellChunkName('episode:stage2-nature-v2')).toBe('lessons-cell-stage2-nature-v2');
    expect(storyChunkName('story:sun-and-moon')).toBe('story-sun-and-moon');
  });

  it('the tales only a book 2 holds: a tale a book 1 also holds stays', () => {
    expect(
      laterStoryIdsOf([
        { storyIds: ['story:a', 'story:b'] },
        { storyIds: ['story:b', 'story:c'], volume: 2 },
      ]),
    ).toEqual(['story:c']);
    // A shelf story that joined a book 2 through its read tier (the Letters book 2, row CM-46) is not a new tale.
    expect(
      laterStoryIdsOf(
        [
          { storyIds: ['story:a'] },
          { storyIds: ['story:shelf', 'story:new'], volume: 2 },
        ],
        (id) => id === 'story:new',
      ),
    ).toEqual(['story:new']);
  });

  it('the app and the web build read the same tales from the shipped books.ts, and the same cache and version', () => {
    const source = readFileSync(join(__dirname, '..', '..', '..', 'content', 'books.ts'), 'utf8');
    expect(laterStoryIds(source)).toEqual(laterStoryIdsOf(BOOK_DEFINITIONS));
    // With the new-tale rule both apply (the post-build reads `addedIn` from the story files): the later tales are the
    // app's Volume 2 stories, and none of the Letters book 2's shelf stories is one.
    const storiesDir = join(__dirname, '..', '..', '..', '..', '..', '..', 'content', 'stories');
    const newTales = new Set(
      readdirSync(storiesDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(storiesDir, f), 'utf8')) as { id: string; addedIn?: number })
        .filter((s) => s.addedIn !== undefined)
        .map((s) => s.id),
    );
    expect(laterStoryIds(source, (id: string) => newTales.has(id))).toEqual([...VOLUME_TWO_STORY_IDS].sort());
    expect(VOLUME_TWO_STORY_IDS.has('story:tripitaka-koreana')).toBe(false);
    expect(BUILD_LATER_CACHE).toBe(LATER_CACHE);
    expect(BUILD_VERSION).toBe(1);
  });
});
