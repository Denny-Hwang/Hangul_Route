import AsyncStorage from '@react-native-async-storage/async-storage';

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

export async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  await AsyncStorage.removeItem(KEY_PREFIX + key);
}

export async function listKeys(): Promise<string[]> {
  const all = await AsyncStorage.getAllKeys();
  return all
    .filter((k): k is string => typeof k === 'string' && k.startsWith(KEY_PREFIX))
    .map((k) => k.slice(KEY_PREFIX.length));
}
