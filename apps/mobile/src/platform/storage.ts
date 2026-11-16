import AsyncStorage from '@react-native-async-storage/async-storage';
import { writePasses } from './storage-fence';

/**
 * AsyncStorage wrapper — CLAUDE.md §8 forbids direct AsyncStorage use.
 * This is the only sanctioned read/write surface.
 */

const KEY_PREFIX = 'hr:';

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Like `readJson`, but a failed read of the storage throws instead of looking
 * like a missing key, so a read-modify-write can skip its write rather than
 * overwrite data it could not see. A missing or unparsable value is null.
 */
export async function readJsonStrict<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(KEY_PREFIX + key);
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
  const raw = await AsyncStorage.getItem(KEY_PREFIX + key);
  if (raw === null || raw === undefined || raw === '') return null;
  return JSON.parse(raw) as T;
}

/**
 * [OA] `readJsonExact` on a fresh connection, for the one retry of a read that failed (AMENDMENTS-ONE-ACCOUNT-MANY-
 * USERS section 13.2, `hr:profiles:locks`). AsyncStorage holds no connection, so this is the same read again.
 */
export async function readJsonExactFresh<T>(key: string): Promise<T | null> {
  return readJsonExact<T>(key);
}

/** Stores `value`; a key the write fence rejects is left untouched (F-BROWSE-001 section 4.10). */
export async function writeJson<T>(key: string, value: T): Promise<void> {
  if (!writePasses(key, 'write')) return;
  await AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
}

/** The `updateJson` calls in flight, one after another, so no two read the same value and both write. */
let updates: Promise<unknown> = Promise.resolve();

/**
 * Read-modify-write of one key, one call at a time (the web variant does it in one IndexedDB
 * transaction; here the app is the only writer, so the calls only need to queue). `next` gets the
 * stored value (null when missing or unparsable) and returns the value to store, or `undefined` to
 * store nothing. A failed read rejects and writes nothing, so a write is never made over data that
 * could not be read. With `exact`, a stored value that does not parse rejects too (as `readJsonExact`), so
 * `next` gets null only for a missing key. A key the write fence rejects is left untouched (`next` is not
 * called). Resolves to whether a value was stored.
 */
export function updateJson<T>(key: string, next: (current: T | null) => T | undefined, options?: { exact?: boolean }): Promise<boolean> {
  const run = updates.then(async () => {
    if (!writePasses(key, 'write')) return false;
    const value = next(await (options?.exact ? readJsonExact<T>(key) : readJsonStrict<T>(key)));
    if (value === undefined) return false;
    await AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
    return true;
  });
  updates = run.catch(() => undefined);
  return run;
}

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-3: keeps a stored value that cannot be used (the same contract as the web
 * variant). The raw stored string of `from` is copied to `to` exactly as it is, unless `to` already holds one (the
 * first copy is the one kept). With `onlyUnparsable`, a value that parses is not copied. Resolves to whether `from`
 * held such a value and `to` holds a copy now; false when there was nothing to keep or the write fence rejects `to`.
 * A failed read or write rejects, so the caller writes nothing over a value it could not keep.
 */
export async function keepRawCopy(from: string, to: string, options?: { onlyUnparsable?: boolean }): Promise<boolean> {
  if (!writePasses(to, 'write')) return false;
  const raw = await AsyncStorage.getItem(KEY_PREFIX + from);
  if (raw === null || raw === undefined || raw === '') return false;
  if (options?.onlyUnparsable && parses(raw)) return false;
  if (!(await AsyncStorage.getItem(KEY_PREFIX + to))) await AsyncStorage.setItem(KEY_PREFIX + to, raw);
  return true;
}

function parses(raw: string): boolean {
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

/** Removes `key`; a key the write fence rejects is left untouched. */
export async function removeKey(key: string): Promise<void> {
  if (!writePasses(key, 'remove')) return;
  await AsyncStorage.removeItem(KEY_PREFIX + key);
}

export { setWriteFence } from './storage-fence';

/** Persistent storage is a web request (`storage.web.ts`); native storage is not evicted, so there is nothing to ask. */
export async function requestPersistence(): Promise<boolean> {
  return false;
}

export async function listKeys(): Promise<string[]> {
  const all = await AsyncStorage.getAllKeys();
  return all
    .filter((k): k is string => typeof k === 'string' && k.startsWith(KEY_PREFIX))
    .map((k) => k.slice(KEY_PREFIX.length));
}
