import { clear, createStore, del, get, keys, set, update } from 'idb-keyval';
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

/** idb-keyval's own database and object store, opened again for a fresh connection. */
const DB_NAME = 'keyval-store';
const STORE_NAME = 'keyval';

/**
 * [OA] `readJsonExact` on a new IndexedDB connection, for the one retry of a read that failed (AMENDMENTS-ONE-
 * ACCOUNT-MANY-USERS section 13.2, `hr:profiles:locks`): a connection the browser closed or broke under the cached
 * one does not fail the retry too. The new connection is closed after the read.
 */
export async function readJsonExactFresh<T>(key: string): Promise<T | null> {
  const store = createStore(DB_NAME, STORE_NAME);
  try {
    const raw = await get<string>(KEY_PREFIX + key, store);
    if (raw === null || raw === undefined || raw === '') return null;
    return JSON.parse(raw) as T;
  } finally {
    await store('readonly', (s) => s.transaction.db.close()).catch(() => undefined);
  }
}

/** Stores `value`; a key the write fence rejects is left untouched (F-BROWSE-001 section 4.10). */
export async function writeJson<T>(key: string, value: T): Promise<void> {
  if (!writePasses(key, 'write')) return;
  await set(KEY_PREFIX + key, JSON.stringify(value));
}

/** Thrown out of an `update` callback to end the transaction without a write. */
const UNCHANGED = Symbol('unchanged');

/**
 * Read-modify-write of one key in one IndexedDB readwrite transaction, so a write another tab or
 * another call makes in between is never lost (AMENDMENTS-DISPLAY-NAV section 3.1). `next` gets
 * the stored value (null when missing or unparsable) and returns the value to store, or
 * `undefined` to store nothing. A failed read rejects and writes nothing, so a write is never made
 * over data that could not be read. A key the write fence rejects is left untouched (`next` is not
 * called). Resolves to whether a value was stored.
 */
export async function updateJson<T>(key: string, next: (current: T | null) => T | undefined): Promise<boolean> {
  if (!writePasses(key, 'write')) return false;
  try {
    await update<string | undefined>(KEY_PREFIX + key, (raw) => {
      let current: T | null = null;
      if (raw) {
        try {
          current = JSON.parse(raw) as T;
        } catch {
          current = null;
        }
      }
      const value = next(current);
      if (value === undefined) throw UNCHANGED;
      return JSON.stringify(value);
    });
  } catch (error) {
    if (error === UNCHANGED) return false;
    throw error;
  }
  return true;
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
