import type { OfflineFile, SpaceEstimate } from '../logic/offline/offline-packs';

/**
 * Save for offline, native stub (F-CURR-002 row CM-5B): a native build keeps every chunk in its one bundle and
 * bundles its clips, so everything is on the device already and there is nothing to save. The web variant is
 * `offline-cache.web.ts`.
 */
export const OFFLINE_PACKS_URL = '/offline-packs.json';

/** Every chunk and clip is in the app's own bundle. */
export const EVERY_CHUNK_ON_DEVICE = true;

export function offlineCacheSupported(): boolean {
  return false;
}

/** No service worker on native. */
export function onWorkerChange(_fn: () => void): () => void {
  return () => undefined;
}

export async function readOfflineIndex(_fresh = false): Promise<unknown> {
  return null;
}

export async function cachedUrls(_urls: readonly string[]): Promise<Set<string>> {
  return new Set();
}

export class SaveFailed extends Error {
  constructor(
    readonly url: string,
    readonly reason: 'network' | 'space' | 'notFile',
  ) {
    super(`could not save ${url} for offline (${reason})`);
    this.name = 'SaveFailed';
  }
}

export async function saveFile(file: OfflineFile): Promise<void> {
  throw new SaveFailed(file.url, 'network');
}

export async function removeFiles(_files: readonly OfflineFile[]): Promise<void> {}

export async function laterCacheUrls(): Promise<string[]> {
  return [];
}

export async function dropLaterUrls(_urls: readonly string[]): Promise<void> {}

export async function spaceEstimate(): Promise<SpaceEstimate | null> {
  return null;
}
