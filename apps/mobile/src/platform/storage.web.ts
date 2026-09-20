import { clear, del, get, keys, set } from 'idb-keyval';

/**
 * Web variant of the storage wrapper (roadmap web-pwa-offline §2): IndexedDB
 * through idb-keyval instead of AsyncStorage's localStorage backend, so
 * progress is not capped at ~5 MB and survives better on iOS Safari. Same
 * surface as `storage.ts`; Metro picks this file for the web platform.
 */
const KEY_PREFIX = 'hr:';

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await get<string>(KEY_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  await set(KEY_PREFIX + key, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  await del(KEY_PREFIX + key);
}

export async function listKeys(): Promise<string[]> {
  const all = await keys<string>();
  return all
    .filter((k): k is string => typeof k === 'string' && k.startsWith(KEY_PREFIX))
    .map((k) => k.slice(KEY_PREFIX.length));
}

/** Ask the browser not to evict our data under storage pressure (best effort). */
export async function requestPersistence(): Promise<boolean> {
  try {
    const storage = (globalThis.navigator as Navigator | undefined)?.storage;
    if (!storage?.persist) return false;
    return await storage.persist();
  } catch {
    return false;
  }
}

export { clear as clearAllForTests };
