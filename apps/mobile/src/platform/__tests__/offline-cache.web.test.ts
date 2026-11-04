import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EVERY_CHUNK_ON_DEVICE,
  SaveFailed,
  cachedUrls,
  dropLaterUrls,
  laterCacheUrls,
  offlineCacheSupported,
  readOfflineIndex,
  removeFiles,
  saveFile,
  spaceEstimate,
} from '../offline-cache.web';
import * as native from '../offline-cache';

const JS = '/_expo/static/js/web/lessons-cell-stage2-nature-v2-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.js';

function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    const m = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, m);
    return {
      match: async (url: string) => m.get(url),
      put: async (url: string, r: Response) => {
        m.set(url, r);
      },
      delete: async (url: string) => m.delete(url),
      keys: async () => [...m.keys()].map((u) => ({ url: `https://app.example${u}` })),
    };
  };
  return {
    stores,
    api: {
      open,
      has: async (name: string) => stores.has(name),
      match: async (url: string) => {
        for (const m of stores.values()) if (m.has(url)) return m.get(url);
        return undefined;
      },
    },
  };
}

const js = (status = 200, type = 'application/javascript') => new Response('x', { status, headers: { 'content-type': type } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('offline cache on the web (row CM-5B)', () => {
  it('is supported only with Cache Storage, fetch and a worker in control', () => {
    expect(EVERY_CHUNK_ON_DEVICE).toBe(false);
    vi.stubGlobal('caches', fakeCaches().api);
    vi.stubGlobal('navigator', { serviceWorker: { controller: null } });
    expect(offlineCacheSupported()).toBe(false);
    vi.stubGlobal('navigator', { serviceWorker: { controller: {} } });
    expect(offlineCacheSupported()).toBe(true);
  });

  it('reads the precached index, or the network one with a fresh query; HTML or a failure is null', async () => {
    const fetch = vi.fn(async (url: string, _init?: RequestInit) => (url.includes('?build=') ? new Response('{"version":1,"stages":[]}', { headers: { 'content-type': 'application/json' } }) : js(200, 'application/json')));
    vi.stubGlobal('fetch', fetch);
    expect(await readOfflineIndex(true)).toEqual({ version: 1, stages: [] });
    expect(fetch.mock.calls[0]?.[1]).toEqual({ cache: 'no-store' });
    expect(await readOfflineIndex()).toBeNull(); // 'x' is no JSON
    vi.stubGlobal('fetch', async () => js(200, 'text/html'));
    expect(await readOfflineIndex()).toBeNull();
    vi.stubGlobal('fetch', async () => Promise.reject(new Error('offline')));
    expect(await readOfflineIndex()).toBeNull();
    vi.stubGlobal('fetch', undefined);
    expect(await readOfflineIndex()).toBeNull();
  });

  it('saves a real file into its cache, finds it, lists and drops later-cache entries', async () => {
    const c = fakeCaches();
    vi.stubGlobal('caches', c.api);
    vi.stubGlobal('location', { origin: 'https://app.example' });
    vi.stubGlobal('fetch', async () => js());
    await saveFile({ url: JS, bytes: 1, cache: 'hr-later-v1' });
    expect([...(await cachedUrls([JS, '/other.js']))]).toEqual([JS]);
    expect(await laterCacheUrls()).toEqual([JS]);
    await dropLaterUrls([JS]);
    expect(await laterCacheUrls()).toEqual([]);
    await saveFile({ url: '/a.mp3', bytes: 1, cache: 'hr-offline-audio-v1' });
    expect([...(await cachedUrls(['/a.mp3']))]).toEqual(['/a.mp3']);
    // An older build's saved clip is listed and dropped like a chunk.
    expect(await laterCacheUrls()).toEqual(['/a.mp3']);
    await dropLaterUrls(['/a.mp3']);
    expect((await cachedUrls(['/a.mp3'])).size).toBe(0);
    await saveFile({ url: '/a.mp3', bytes: 1, cache: 'hr-offline-audio-v1' });
    await removeFiles([{ url: '/a.mp3', bytes: 1, cache: 'hr-offline-audio-v1' }]);
    expect((await cachedUrls(['/a.mp3'])).size).toBe(0);
  });

  it('counts a file as on the device only in a saved cache: a clip only in a bounded clip cache may be pushed out', async () => {
    const c = fakeCaches();
    vi.stubGlobal('caches', c.api);
    vi.stubGlobal('fetch', async () => js());
    await saveFile({ url: '/b.mp3', bytes: 1, cache: 'hr-audio-say-v1' });
    expect((await cachedUrls(['/b.mp3'])).size).toBe(0);
    // Reading never creates a saved cache.
    expect([...c.stores.keys()]).toEqual(['hr-audio-say-v1']);
  });

  it('never keeps an HTML page or an error as the file, and names a full disk', async () => {
    vi.stubGlobal('caches', fakeCaches().api);
    vi.stubGlobal('fetch', async () => js(200, 'text/html; charset=utf-8'));
    await expect(saveFile({ url: JS, bytes: 1, cache: 'hr-later-v1' })).rejects.toMatchObject({ reason: 'notFile' });
    vi.stubGlobal('fetch', async () => js(404));
    await expect(saveFile({ url: JS, bytes: 1, cache: 'hr-later-v1' })).rejects.toMatchObject({ reason: 'notFile' });
    vi.stubGlobal('fetch', async () => Promise.reject(new Error('offline')));
    await expect(saveFile({ url: JS, bytes: 1, cache: 'hr-later-v1' })).rejects.toBeInstanceOf(SaveFailed);
    vi.stubGlobal('fetch', async () => js());
    vi.stubGlobal('caches', {
      open: async () => ({
        put: async () => {
          throw new DOMException('full', 'QuotaExceededError');
        },
      }),
    });
    await expect(saveFile({ url: JS, bytes: 1, cache: 'hr-later-v1' })).rejects.toMatchObject({ reason: 'space' });
    vi.stubGlobal('caches', undefined);
    await expect(saveFile({ url: JS, bytes: 1, cache: 'hr-later-v1' })).rejects.toMatchObject({ reason: 'network' });
    expect((await cachedUrls([JS])).size).toBe(0);
    expect(await laterCacheUrls()).toEqual([]);
    await removeFiles([{ url: JS, bytes: 1, cache: 'x' }]);
  });

  it('gives the storage estimate when the browser has one', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ quota: 100, usage: 10 }) } });
    expect(await spaceEstimate()).toEqual({ quota: 100, usage: 10 });
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({}) } });
    expect(await spaceEstimate()).toBeNull();
    vi.stubGlobal('navigator', { storage: { estimate: async () => Promise.reject(new Error('x')) } });
    expect(await spaceEstimate()).toBeNull();
  });

  it('native: everything is in the bundle, nothing to save', async () => {
    expect(native.EVERY_CHUNK_ON_DEVICE).toBe(true);
    expect(native.offlineCacheSupported()).toBe(false);
    expect(await native.readOfflineIndex()).toBeNull();
    expect((await native.cachedUrls(['/a'])).size).toBe(0);
    await expect(native.saveFile({ url: '/a', bytes: 1, cache: 'c' })).rejects.toBeInstanceOf(native.SaveFailed);
    await native.removeFiles([]);
    await native.dropLaterUrls([]);
    expect(await native.laterCacheUrls()).toEqual([]);
    expect(await native.spaceEstimate()).toBeNull();
  });
});
