import { clear, del, get, keys, set } from 'idb-keyval';
import { writePasses } from './storage-fence';

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

/**
 * Like `readJson`, but a failed read of the IndexedDB throws instead of looking
 * like a missing key, so a read-modify-write can skip its write rather than
 * overwrite data it could not see. A missing or unparsable value is null.
 */
export async function readJsonStrict<T>(key: string): Promise<T | null> {
  const raw = await get<string>(KEY_PREFIX + key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Like `readJsonStrict`, but only a missing key is null: a failed read and a stored value that
 * does not parse both throw. For reads that must not take damaged data for "nothing stored"
 * (the device gate marker, F-APP-001 section 3.9).
 */
export async function readJsonExact<T>(key: string): Promise<T | null> {
  const raw = await get<string>(KEY_PREFIX + key);
  if (raw === null || raw === undefined || raw === '') return null;
  return JSON.parse(raw) as T;
}

/** Stores `value`; a key the write fence rejects is left untouched (F-BROWSE-001 section 4.10). */
export async function writeJson<T>(key: string, value: T): Promise<void> {
  if (!writePasses(key, 'write')) return;
  await set(KEY_PREFIX + key, JSON.stringify(value));
}

/** Removes `key`; a key the write fence rejects is left untouched. */
export async function removeKey(key: string): Promise<void> {
  if (!writePasses(key, 'remove')) return;
  await del(KEY_PREFIX + key);
}

export { setWriteFence } from './storage-fence';

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
