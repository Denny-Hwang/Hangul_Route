/**
 * Guarded browser storage — the web stand-in for the missing `packages/hooks`
 * (CLAUDE.md §8, F-I18N-001 §3.2). Nothing else in the web app touches
 * `localStorage` / `sessionStorage` directly. Every access is wrapped: SSR (no
 * `window`), private windows and blocked storage read as `null`, writes report
 * `false`, and nothing ever throws.
 */
export interface KeyValueStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export type StorageArea = 'local' | 'session';

/** The browser's storage for `area`, or null where there is none or reading it throws. */
export function browserStorage(area: StorageArea): KeyValueStorage | null {
  try {
    if (typeof window === 'undefined') return null;
    const storage = area === 'local' ? window.localStorage : window.sessionStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

export function readItem(storage: KeyValueStorage | null, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** True when the value was stored; false when there is no storage or it refused (quota, blocked). */
export function writeItem(storage: KeyValueStorage | null, key: string, value: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeItem(storage: KeyValueStorage | null, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // nothing to remove
  }
}

/**
 * Whether the browser offers IndexedDB (F-APP-001: the console reads the learner's device
 * marker and keeps the shell store there). False under SSR, in node and where touching it throws.
 */
export function indexedDbAvailable(): boolean {
  try {
    return Boolean((globalThis as { indexedDB?: unknown }).indexedDB);
  } catch {
    return false;
  }
}
