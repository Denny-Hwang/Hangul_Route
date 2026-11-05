import type { OfflineFile, SpaceEstimate } from '../logic/offline/offline-packs';
import { SAVED_CACHES } from '../logic/offline/offline-packs';

/**
 * Save for offline on the web (F-CURR-002 row CM-5B): Cache Storage through the page. The service worker reads the
 * same caches (its runtime rule for the later chunks, `hr-later-v1`, and its clip rules, which read the saved clips,
 * `hr-offline-audio-v1`, on a miss), so a file put here plays offline. Neither cache expires, so a file counts as on
 * the device only there: a clip that is only in a bounded clip cache may be pushed out, so Save copies it. The index
 * (`/offline-packs.json`) is precached, so it reads offline too.
 */

interface CacheLike {
  match(url: string): Promise<Response | undefined>;
  put(url: string, response: Response): Promise<void>;
  delete(url: string): Promise<boolean>;
  keys(): Promise<readonly { url: string }[]>;
}
interface CachesLike {
  open(name: string): Promise<CacheLike>;
  match(url: string): Promise<Response | undefined>;
  has(name: string): Promise<boolean>;
}
interface Host {
  caches?: CachesLike;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  navigator?: {
    serviceWorker?: { controller?: unknown; addEventListener?: (type: 'controllerchange', fn: () => void) => void; removeEventListener?: (type: 'controllerchange', fn: () => void) => void };
    storage?: { estimate?: () => Promise<{ quota?: number; usage?: number }> };
  };
  location?: { origin?: string };
}

const host = (): Host => globalThis as unknown as Host;

/** The index's URL (the site root, precached). */
export const OFFLINE_PACKS_URL = '/offline-packs.json';

/** The later chunks and the stage clips are fetched, not bundled. */
export const EVERY_CHUNK_ON_DEVICE = false;

/**
 * Save for offline works here: Cache Storage and a service worker in control (with none, nothing the page saves would
 * be read offline: the open iOS 14 home-screen issue, an in-app webview).
 */
export function offlineCacheSupported(): boolean {
  const h = host();
  return typeof h.caches?.open === 'function' && typeof h.fetch === 'function' && Boolean(h.navigator?.serviceWorker?.controller);
}

/**
 * Calls `fn` when a service worker takes control of the page (a first visit's worker after `clientsClaim`, or an
 * update), so Save for offline can start on a page that opened before one was in control. Returns the unsubscribe.
 */
export function onWorkerChange(fn: () => void): () => void {
  const sw = host().navigator?.serviceWorker;
  if (typeof sw?.addEventListener !== 'function') return () => undefined;
  sw.addEventListener('controllerchange', fn);
  return () => sw.removeEventListener?.('controllerchange', fn);
}

/**
 * The index: the precached one (this build's), or with `fresh` the network's (a waiting service worker's build, so a
 * saved stage is topped up before the update applies). Null when it cannot be read.
 */
export async function readOfflineIndex(fresh = false): Promise<unknown> {
  const h = host();
  if (typeof h.fetch !== 'function') return null;
  try {
    // A query the precache does not hold reaches the network; the plain URL is answered from the precache.
    const res = await h.fetch(fresh ? `${OFFLINE_PACKS_URL}?build=${Date.now()}` : OFFLINE_PACKS_URL, fresh ? { cache: 'no-store' } : undefined);
    if (!res.ok || /text\/html/i.test(res.headers.get('content-type') ?? '')) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/** The saved caches that exist (opening one would create it). */
async function savedCaches(): Promise<CacheLike[]> {
  const caches = host().caches;
  if (caches === undefined) return [];
  const out: CacheLike[] = [];
  for (const name of SAVED_CACHES) {
    try {
      if (await caches.has(name)) out.push(await caches.open(name));
    } catch {
      // An unreadable cache holds nothing saved.
    }
  }
  return out;
}

/** Which of these URLs a saved cache (no expiry) holds. */
export async function cachedUrls(urls: readonly string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const stores = await savedCaches();
  if (stores.length === 0) return out;
  await Promise.all(
    urls.map(async (url) => {
      for (const store of stores) {
        try {
          if ((await store.match(url)) !== undefined) {
            out.add(url);
            return;
          }
        } catch {
          // An unreadable entry counts as not saved.
        }
      }
    }),
  );
  return out;
}

/** A file could not be saved: the network, a full disk, or an answer that is not the file (a newer build's page). */
export class SaveFailed extends Error {
  constructor(
    readonly url: string,
    readonly reason: 'network' | 'space' | 'notFile',
  ) {
    super(`could not save ${url} for offline (${reason})`);
    this.name = 'SaveFailed';
  }
}

const isQuota = (error: unknown): boolean => error instanceof Error && /quota/i.test(`${error.name} ${error.message}`);

/** Fetches one file and puts it in its cache. Rejects with `SaveFailed`. */
export async function saveFile(file: OfflineFile): Promise<void> {
  const h = host();
  if (h.caches === undefined || typeof h.fetch !== 'function') throw new SaveFailed(file.url, 'network');
  let res: Response;
  try {
    res = await h.fetch(file.url, { cache: 'no-store' });
  } catch {
    throw new SaveFailed(file.url, 'network');
  }
  // The host answers a file of another build with its HTML page (status 200): never keep that as the file.
  if (res.status !== 200 || /text\/html/i.test(res.headers.get('content-type') ?? '')) throw new SaveFailed(file.url, 'notFile');
  try {
    const cache = await h.caches.open(file.cache);
    await cache.put(file.url, res);
  } catch (error) {
    throw new SaveFailed(file.url, isQuota(error) ? 'space' : 'network');
  }
}

/** Takes these files out of their caches. */
export async function removeFiles(files: readonly OfflineFile[]): Promise<void> {
  const caches = host().caches;
  if (caches === undefined) return;
  await Promise.all(
    files.map(async (f) => {
      try {
        await (await caches.open(f.cache)).delete(f.url);
      } catch {
        // Already gone.
      }
    }),
  );
}

/** Site-relative URLs the saved caches hold (to drop an older build's chunks and clips). */
export async function laterCacheUrls(): Promise<string[]> {
  const origin = host().location?.origin ?? '';
  const out: string[] = [];
  for (const store of await savedCaches()) {
    try {
      for (const k of await store.keys()) out.push(origin !== '' && k.url.startsWith(origin) ? k.url.slice(origin.length) : new URL(k.url, 'http://x').pathname);
    } catch {
      // An unreadable cache lists nothing.
    }
  }
  return [...new Set(out)];
}

/** Drops these URLs from the saved caches. */
export async function dropLaterUrls(urls: readonly string[]): Promise<void> {
  await removeFiles(SAVED_CACHES.flatMap((cache) => urls.map((url) => ({ url, bytes: 0, cache }))));
}

/** The browser's storage estimate for this site, when it gives one. */
export async function spaceEstimate(): Promise<SpaceEstimate | null> {
  try {
    const e = await host().navigator?.storage?.estimate?.();
    if (e === undefined || typeof e.quota !== 'number' || typeof e.usage !== 'number') return null;
    return { quota: e.quota, usage: e.usage };
  } catch {
    return null;
  }
}
