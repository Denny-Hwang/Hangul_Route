import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KeyValueStorage } from '../safe-storage';
import { CONSOLE_LOCALE_KEY, browserLanguages, pickConsoleLocale, readStoredLocale, writeStoredLocale } from '../console-locale';

function fakeStorage(initial: Record<string, string> = {}): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
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

const blocked: KeyValueStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

const ALL = ['en', 'es', 'ko'] as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pickConsoleLocale: stored choice > navigator > en (F-I18N-001 §3.2)', () => {
  it('a stored, available choice wins over the browser languages', () => {
    expect(pickConsoleLocale({ stored: 'ko', languages: ['es-MX'], available: ALL })).toBe('ko');
  });

  it('without a stored choice, detection walks the browser languages', () => {
    expect(pickConsoleLocale({ stored: null, languages: ['fr', 'es-MX', 'en'], available: ALL })).toBe('es');
    expect(pickConsoleLocale({ stored: null, languages: ['ko_KR'], available: ALL })).toBe('ko');
  });

  it('falls back to English when nothing matches', () => {
    expect(pickConsoleLocale({ stored: null, languages: [], available: ALL })).toBe('en');
    expect(pickConsoleLocale({ stored: null, languages: ['fr', 'de'], available: ALL })).toBe('en');
  });

  it('never picks a hidden locale: a stored or detected es is ignored while only en ships', () => {
    expect(pickConsoleLocale({ stored: 'es', languages: ['es-MX'], available: ['en'] })).toBe('en');
    expect(pickConsoleLocale({ stored: 'ko', languages: ['es-MX', 'en'], available: ['en', 'es'] })).toBe('es');
  });
});

describe('the stored console locale (hr:console:uiLocale)', () => {
  it('uses the documented key', () => {
    expect(CONSOLE_LOCALE_KEY).toBe('hr:console:uiLocale');
  });

  it('round-trips a locale', () => {
    const storage = fakeStorage();
    expect(readStoredLocale(storage)).toBeNull();
    expect(writeStoredLocale('es', storage)).toBe(true);
    expect(storage.map.get(CONSOLE_LOCALE_KEY)).toBe('es');
    expect(readStoredLocale(storage)).toBe('es');
  });

  it('ignores a value that is not a UI locale (corrupt or a removed locale)', () => {
    expect(readStoredLocale(fakeStorage({ [CONSOLE_LOCALE_KEY]: 'fr' }))).toBeNull();
    expect(readStoredLocale(fakeStorage({ [CONSOLE_LOCALE_KEY]: '{"uiLocale":"es"}' }))).toBeNull();
    expect(readStoredLocale(fakeStorage({ [CONSOLE_LOCALE_KEY]: '' }))).toBeNull();
  });

  it('blocked or missing storage reads null and persists nothing, without throwing', () => {
    expect(readStoredLocale(blocked)).toBeNull();
    expect(writeStoredLocale('ko', blocked)).toBe(false);
    expect(readStoredLocale(null)).toBeNull();
    expect(writeStoredLocale('ko', null)).toBe(false);
    // node has no window: the default storage is null
    expect(readStoredLocale()).toBeNull();
    expect(writeStoredLocale('ko')).toBe(false);
  });
});

describe('browserLanguages', () => {
  it('prefers navigator.languages, then navigator.language', () => {
    expect(browserLanguages({ languages: ['es-MX', 'en'], language: 'es-MX' })).toEqual(['es-MX', 'en']);
    expect(browserLanguages({ languages: [], language: 'ko-KR' })).toEqual(['ko-KR']);
    expect(browserLanguages({ language: 'en-GB' })).toEqual(['en-GB']);
  });

  it('is total: no navigator, no languages or junk entries give a clean list', () => {
    expect(browserLanguages(null)).toEqual([]);
    expect(browserLanguages({})).toEqual([]);
    expect(browserLanguages({ languages: ['es', 3 as unknown as string, ''] })).toEqual(['es']);
    const hostile = {
      get languages(): readonly string[] {
        throw new Error('denied');
      },
    };
    expect(browserLanguages(hostile)).toEqual([]);
  });

  it('reads the global navigator by default', () => {
    vi.stubGlobal('navigator', { languages: ['ko-KR', 'en-US'] });
    expect(browserLanguages()).toEqual(['ko-KR', 'en-US']);
  });
});
