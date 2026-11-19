import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeMirror as nativeWriteMirror } from '../storage-mirror';
import { writeMirror } from '../storage-mirror.web';
import { setWriteFence } from '../storage-fence';

/** AMENDMENTS-FINISH-2026-11 FN-2: the synchronous copy the static splash reads, best effort and fenced. */
function fakeLocal(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  setWriteFence(null);
});

describe('platform/storage-mirror.web', () => {
  it('writes the value under the hr: prefix', () => {
    const local = fakeLocal();
    vi.stubGlobal('localStorage', local);
    writeMirror('console:uiLocale', 'ko');
    expect(local.map.get('hr:console:uiLocale')).toBe('ko');
    writeMirror('console:uiLocale', 'es');
    expect(local.map.get('hr:console:uiLocale')).toBe('es');
  });

  it('never throws: no localStorage, a storage that refuses, a getter that throws', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => writeMirror('console:uiLocale', 'ko')).not.toThrow();
    vi.stubGlobal('localStorage', { ...fakeLocal(), setItem: () => { throw new Error('QuotaExceededError'); } });
    expect(() => writeMirror('console:uiLocale', 'ko')).not.toThrow();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('SecurityError'); } });
    expect(() => writeMirror('console:uiLocale', 'en')).not.toThrow();
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('keeps out of a key the write fence rejects (All lessons allows only its own keys)', () => {
    const local = fakeLocal();
    vi.stubGlobal('localStorage', local);
    setWriteFence((key) => key === 'device:settings');
    writeMirror('console:uiLocale', 'es');
    expect(local.map.size).toBe(0);
    setWriteFence((key) => key === 'console:uiLocale');
    writeMirror('console:uiLocale', 'es');
    expect(local.map.get('hr:console:uiLocale')).toBe('es');
  });

  it('is a no-op on native (no HTML shell)', () => {
    const local = fakeLocal();
    vi.stubGlobal('localStorage', local);
    nativeWriteMirror('console:uiLocale', 'ko');
    expect(local.map.size).toBe(0);
  });
});
