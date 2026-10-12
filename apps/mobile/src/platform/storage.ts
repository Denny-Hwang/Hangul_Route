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

/** Stores `value`; a key the write fence rejects is left untouched (F-BROWSE-001 section 4.10). */
export async function writeJson<T>(key: string, value: T): Promise<void> {
  if (!writePasses(key, 'write')) return;
  await AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
}

/** Removes `key`; a key the write fence rejects is left untouched. */
export async function removeKey(key: string): Promise<void> {
  if (!writePasses(key, 'remove')) return;
  await AsyncStorage.removeItem(KEY_PREFIX + key);
}

export { setWriteFence } from './storage-fence';

export async function listKeys(): Promise<string[]> {
  const all = await AsyncStorage.getAllKeys();
  return all
    .filter((k): k is string => typeof k === 'string' && k.startsWith(KEY_PREFIX))
    .map((k) => k.slice(KEY_PREFIX.length));
}
