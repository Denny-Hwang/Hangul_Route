import type { OfflineFile, SpaceEstimate } from '../logic/offline/offline-packs';
import { LATER_CACHE } from '../logic/offline/offline-packs';

/**
 * Save for offline on the web (F-CURR-002 row CM-5B): Cache Storage through the page. The service worker reads the
 * same caches (its runtime rules for the later chunks, `hr-later-v1`, and for the clips), so a file put here plays
 * offline. The index (`/offline-packs.json`) is precached, so it reads offline too.
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
  navigator?: { serviceWorker?: { controller?: unknown }; storage?: { estimate?: () => Promise<{ quota?: number; usage?: number }> } };
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

/** Which of these URLs a cache holds. */
export async function cachedUrls(urls: readonly string[]): Promise<Set<string>> {
  const caches = host().caches;
  const out = new Set<string>();
  if (caches === undefined) return out;
  await Promise.all(
    urls.map(async (url) => {
      try {
        if ((await caches.match(url)) !== undefined) out.add(url);
      } catch {
        // An unreadable entry counts as not saved.
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

/** Site-relative URLs the later cache holds (to drop an older build's chunks). */
export async function laterCacheUrls(): Promise<string[]> {
  const h = host();
  try {
    if (h.caches === undefined || !(await h.caches.has(LATER_CACHE))) return [];
    const keys = await (await h.caches.open(LATER_CACHE)).keys();
    const origin = h.location?.origin ?? '';
    return keys.map((k) => (origin !== '' && k.url.startsWith(origin) ? k.url.slice(origin.length) : new URL(k.url, 'http://x').pathname));
  } catch {
    return [];
  }
}

/** Drops these later-cache URLs. */
export async function dropLaterUrls(urls: readonly string[]): Promise<void> {
  await removeFiles(urls.map((url) => ({ url, bytes: 0, cache: LATER_CACHE })));
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
