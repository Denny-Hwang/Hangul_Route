import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserStorage, indexedDbAvailable, readItem, removeItem, writeItem, type KeyValueStorage } from '../safe-storage';

function fakeStorage(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

const throwing: KeyValueStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('safe storage (F-I18N-001 §3.2, the web stand-in for packages/hooks)', () => {
  it('reads, writes and removes through a working storage', () => {
    const storage = fakeStorage();
    expect(readItem(storage, 'hr:x')).toBeNull();
    expect(writeItem(storage, 'hr:x', 'es')).toBe(true);
    expect(readItem(storage, 'hr:x')).toBe('es');
    removeItem(storage, 'hr:x');
    expect(readItem(storage, 'hr:x')).toBeNull();
  });

  it('never throws: blocked storage reads null, writes false, removes quietly', () => {
    expect(readItem(throwing, 'hr:x')).toBeNull();
    expect(writeItem(throwing, 'hr:x', 'es')).toBe(false);
    expect(() => removeItem(throwing, 'hr:x')).not.toThrow();
  });

  it('treats a missing storage (SSR) as empty', () => {
    expect(readItem(null, 'hr:x')).toBeNull();
    expect(writeItem(null, 'hr:x', 'es')).toBe(false);
    expect(() => removeItem(null, 'hr:x')).not.toThrow();
  });

  it('finds no browser storage without a window (SSR, node)', () => {
    expect(browserStorage('local')).toBeNull();
    expect(browserStorage('session')).toBeNull();
  });

  it('returns the window storage for each area', () => {
    const local = fakeStorage();
    const session = fakeStorage();
    vi.stubGlobal('window', { localStorage: local, sessionStorage: session });
    expect(browserStorage('local')).toBe(local);
    expect(browserStorage('session')).toBe(session);
  });

  it('returns null when the storage is absent or its getter throws (private windows, blocked cookies)', () => {
    vi.stubGlobal('window', {});
    expect(browserStorage('local')).toBeNull();
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    expect(browserStorage('local')).toBeNull();
  });
});

describe('indexedDbAvailable (F-APP-001 section 3.14)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is true when the browser offers IndexedDB and false without it (node, SSR)', () => {
    vi.stubGlobal('indexedDB', {});
    expect(indexedDbAvailable()).toBe(true);
    vi.stubGlobal('indexedDB', undefined);
    expect(indexedDbAvailable()).toBe(false);
  });

  it('is false when touching it throws (a SecurityError on access)', () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    try {
      expect(indexedDbAvailable()).toBe(false);
    } finally {
      Reflect.deleteProperty(globalThis, 'indexedDB');
    }
  });
});
