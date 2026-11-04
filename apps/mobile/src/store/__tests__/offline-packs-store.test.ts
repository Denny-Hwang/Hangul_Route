import type { StageKey } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';
import { LATER_CACHE, type OfflineFile } from '../../logic/offline/offline-packs';
import { createOfflinePacksStore, type OfflinePacksDeps } from '../offline-packs-store';

const md = (c: string): string => c.repeat(32);
const V2 = `/_expo/static/js/web/lessons-cell-stage2-nature-v2-${md('a')}.js`;
const V2_NEW = `/_expo/static/js/web/lessons-cell-stage2-nature-v2-${md('d')}.js`;
const CLIP = '/assets/assets/audio/say/0123456789abcdef.mp3';
const TALE = `/_expo/static/js/web/story-jeju-volcanic-island-${md('b')}.js`;
const OLD = `/_expo/static/js/web/lessons-cell-stage3-life-v2-${md('c')}.js`;

const indexWith = (v2: string) => ({
  version: 1,
  stages: [
    { stage: 'stage2', bytes: 0, files: [{ url: v2, bytes: 40_000, cache: LATER_CACHE }, { url: CLIP, bytes: 3_000, cache: 'hr-audio-say-v1' }] },
    { stage: 'stage5', bytes: 0, files: [{ url: TALE, bytes: 45_000, cache: LATER_CACHE }] },
  ],
});

function fakeDevice(over: Partial<OfflinePacksDeps> = {}, start: { cached?: string[]; chosen?: StageKey[] | null; laterKeys?: string[] } = {}) {
  const disk = new Set(start.cached ?? []);
  let chosen = start.chosen ?? null;
  const later = [...(start.laterKeys ?? [])];
  const deps: OfflinePacksDeps = {
    native: false,
    supported: () => true,
    readIndex: async (fresh) => (fresh ? indexWith(V2_NEW) : indexWith(V2)),
    cachedUrls: async (urls) => new Set(urls.filter((u) => disk.has(u))),
    saveFile: vi.fn(async (f: OfflineFile) => {
      disk.add(f.url);
    }),
    removeFiles: vi.fn(async (files: readonly OfflineFile[]) => {
      for (const f of files) disk.delete(f.url);
    }),
    laterCacheUrls: async () => later,
    dropLaterUrls: vi.fn(async (urls: readonly string[]) => {
      for (const u of urls) disk.delete(u);
    }),
    spaceEstimate: async () => ({ quota: 1_000_000, usage: 100_000 }),
    online: () => true,
    readChosen: async () => chosen,
    writeChosen: async (s) => {
      chosen = [...s];
    },
    ...over,
  };
  return { deps, disk, chosen: () => chosen };
}

describe('offline packs store (row CM-5B)', () => {
  it('native and a page with no worker in control are unsupported; native opens every later chunk', async () => {
    const native = createOfflinePacksStore(fakeDevice({ native: true }).deps);
    await native.getState().init();
    expect(native.getState().status).toBe('unsupported');
    expect(native.getState().opensOffline('lessons-cell-stage2-nature-v2')).toBe(true);
    const noWorker = createOfflinePacksStore(fakeDevice({ supported: () => false }).deps);
    await noWorker.getState().init();
    expect(noWorker.getState().status).toBe('unsupported');
    expect(noWorker.getState().opensOffline('lessons-cell-stage2-nature-v2')).toBe(false);
  });

  it('an unreadable index is unsupported, and init runs once', async () => {
    const readIndex = vi.fn(async () => '<html>');
    const store = createOfflinePacksStore(fakeDevice({ readIndex }).deps);
    await Promise.all([store.getState().init(), store.getState().init()]);
    expect(store.getState().status).toBe('unsupported');
    expect(readIndex).toHaveBeenCalledTimes(1);
  });

  it('a failed init (a cache that throws) is unsupported, never a crash', async () => {
    const store = createOfflinePacksStore(fakeDevice({ cachedUrls: async () => Promise.reject(new Error('boom')) }).deps);
    await store.getState().init();
    expect(store.getState().status).toBe('unsupported');
  });

  it('reads what is on the device: a lesson opened online once opens offline, and its stage is partly saved', async () => {
    const { deps } = fakeDevice({}, { cached: [V2] });
    const store = createOfflinePacksStore(deps);
    await store.getState().init();
    expect(store.getState().status).toBe('ready');
    expect(store.getState().opensOffline('lessons-cell-stage2-nature-v2')).toBe(true);
    expect(store.getState().opensOffline('story-jeju-volcanic-island')).toBe(false);
    expect(store.getState().rows().map((r) => [r.stage, r.state, r.missingBytes])).toEqual([
      ['stage2', 'partly', 3_000],
      ['stage5', 'notSaved', 45_000],
    ]);
  });

  it('save keeps the choice, fetches each missing file once, counts progress and makes the stage saved', async () => {
    const { deps, chosen } = fakeDevice({}, { cached: [V2] });
    const store = createOfflinePacksStore(deps);
    await store.getState().init();
    const seen: number[] = [];
    const unsub = store.subscribe((s) => {
      if (s.progress) seen.push(s.progress.done);
    });
    await store.getState().save('all');
    unsub();
    expect(deps.saveFile).toHaveBeenCalledTimes(2);
    expect(chosen()).toEqual(['stage2', 'stage5']);
    expect(store.getState().rows().every((r) => r.state === 'saved' && r.chosen)).toBe(true);
    expect(store.getState().opensOffline('story-jeju-volcanic-island')).toBe(true);
    expect(store.getState().busy).toBeNull();
    expect(Math.max(...seen)).toBe(48_000);
  });

  it('a save that does not fit stops before fetching; a failed file says why and keeps what was saved', async () => {
    const full = createOfflinePacksStore(fakeDevice({ spaceEstimate: async () => ({ quota: 50_000, usage: 40_000 }) }).deps);
    await full.getState().init();
    await full.getState().save('stage5');
    expect(full.getState().problem).toEqual({ stage: 'stage5', reason: 'space' });
    expect(full.getState().chosen).toEqual([]);

    const failing = fakeDevice({
      saveFile: vi.fn(async (f: OfflineFile) => {
        if (f.url === CLIP) throw Object.assign(new Error('x'), { reason: 'notFile' });
      }),
    });
    const store = createOfflinePacksStore(failing.deps);
    await store.getState().init();
    await store.getState().save('stage2');
    expect(store.getState().problem).toEqual({ stage: 'stage2', reason: 'notFile' });
    expect(store.getState().busy).toBeNull();
    const quota = createOfflinePacksStore(fakeDevice({ saveFile: async () => Promise.reject(Object.assign(new Error('q'), { reason: 'space' })) }).deps);
    await quota.getState().init();
    await quota.getState().save('stage5');
    expect(quota.getState().problem?.reason).toBe('space');
    const net = createOfflinePacksStore(fakeDevice({ saveFile: async () => Promise.reject(new Error('offline')) }).deps);
    await net.getState().init();
    await net.getState().save('stage5');
    expect(net.getState().problem?.reason).toBe('network');
  });

  it('remove forgets the choice and takes the files out', async () => {
    const { deps, chosen, disk } = fakeDevice({}, { cached: [V2, CLIP, TALE], chosen: ['stage2', 'stage5'] });
    const store = createOfflinePacksStore(deps);
    await store.getState().init();
    await store.getState().remove('stage2');
    expect(chosen()).toEqual(['stage5']);
    expect([...disk].sort()).toEqual([TALE]);
    expect(store.getState().rows().map((r) => r.state)).toEqual(['notSaved', 'saved']);
  });

  it('a new build: init drops an older build’s later chunks and saves a chosen stage again; offline it waits', async () => {
    const online = fakeDevice({}, { cached: [OLD, CLIP], chosen: ['stage2'], laterKeys: [OLD, V2] });
    const store = createOfflinePacksStore(online.deps);
    await store.getState().init();
    expect(online.deps.dropLaterUrls).toHaveBeenCalledWith([OLD]);
    expect(online.disk.has(V2)).toBe(true);
    expect(store.getState().rows()[0]?.state).toBe('saved');

    const offline = fakeDevice({ online: () => false }, { chosen: ['stage2'] });
    const quiet = createOfflinePacksStore(offline.deps);
    await quiet.getState().init();
    expect(offline.deps.saveFile).not.toHaveBeenCalled();
    expect(quiet.getState().rows()[0]?.state).toBe('notSaved');
  });

  it('refreshForUpdate saves the waiting build’s files of the chosen stages, and nothing without a choice', async () => {
    const { deps, disk } = fakeDevice({}, { cached: [V2, CLIP], chosen: ['stage2'] });
    const store = createOfflinePacksStore(deps);
    await store.getState().init();
    await store.getState().refreshForUpdate();
    expect(disk.has(V2_NEW)).toBe(true);
    expect(disk.has(TALE)).toBe(false);
    const none = fakeDevice();
    const plain = createOfflinePacksStore(none.deps);
    await plain.getState().init();
    await plain.getState().refreshForUpdate();
    expect(none.deps.saveFile).not.toHaveBeenCalled();
  });

  it('a choice stored for a stage the index no longer has is dropped; busy blocks a second action', async () => {
    const { deps } = fakeDevice({}, { chosen: ['stage7', 'stage5'] });
    const store = createOfflinePacksStore(deps);
    await store.getState().init();
    expect(store.getState().chosen).toEqual(['stage5']);
    const first = store.getState().save('stage2');
    await store.getState().save('stage5');
    await store.getState().remove('stage5');
    await first;
    // The chosen Stage 5 tale topped up at init, then Stage 2's two files; the second save and the remove did nothing.
    expect(deps.saveFile).toHaveBeenCalledTimes(3);
    expect(store.getState().chosen).toEqual(['stage5', 'stage2']);
  });
});
