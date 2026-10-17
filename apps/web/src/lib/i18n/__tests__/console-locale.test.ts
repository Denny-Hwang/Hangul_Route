import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KeyValueStorage } from '../safe-storage';
import {
  CONSOLE_LOCALE_KEY,
  CONSOLE_TEXT_SIZE_KEY,
  browserLanguages,
  clearStoredLocale,
  firstPaintLocale,
  queryLocale,
  readStoredLocale,
  readStoredTextSize,
  resolveConsoleDisplay,
  writeStoredLocale,
  writeStoredTextSize,
} from '../console-locale';

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

const NO_MIRROR = { locale: null, textSize: null } as const;
/** A readable record on a device with learner profiles (the learner app is in use), unless said otherwise. */
const readable = (value: Record<string, unknown> = {}, hasProfiles = true) => ({ readable: true as const, value, hasProfiles });
const UNREADABLE = { readable: false as const };

describe('resolveConsoleDisplay: the device record wins (owner items 6 and 7)', () => {
  it('the device language wins over ?lang=, the mirror (an old console choice) and the browser', () => {
    const picked = resolveConsoleDisplay({ device: readable({ uiLocale: 'en' }), mirror: { locale: 'ko', textSize: 'largest' }, query: 'es', languages: ['ko-KR'], available: ALL });
    expect(picked).toEqual({ locale: 'en', textSize: 'standard', seed: null, mirror: 'en' });
    // Also on a device with no learner profiles: a choice in the record is never folded over.
    expect(resolveConsoleDisplay({ device: readable({ uiLocale: 'en' }, false), mirror: { locale: 'ko', textSize: null }, query: null, languages: [], available: ALL }).locale).toBe('en');
  });

  it('an English learner app with a console that stored ko opens the console in English', () => {
    // The learner app chose English, or handed off lang=en: the console's old stored ko is only a mirror.
    expect(resolveConsoleDisplay({ device: readable({ uiLocale: 'en', uiLocaleAt: '2026-10-16T00:00:00.000Z' }), mirror: { locale: 'ko', textSize: null }, query: null, languages: ['ko-KR'], available: ALL }).locale).toBe('en');
    expect(resolveConsoleDisplay({ device: readable({}), mirror: { locale: 'ko', textSize: null }, query: queryLocale('?lang=en'), languages: ['ko-KR'], available: ALL })).toEqual({
      locale: 'en',
      textSize: 'standard',
      seed: 'en',
      mirror: 'en',
    });
  });

  it('a device with no learner profiles keeps the console choice stored before the record existed: folded into the record', () => {
    // A teacher laptop that never ran the learner app, where 한국어 was picked in the old Language select.
    expect(resolveConsoleDisplay({ device: readable({}, false), mirror: { locale: 'ko', textSize: null }, query: null, languages: ['en-US'], available: ALL })).toEqual({
      locale: 'ko',
      textSize: 'standard',
      seed: 'ko',
      mirror: 'ko',
    });
    // It comes before a ?lang= hand-off (Welcome's "I'm a teacher" on a browser in English carries the detected lang=en).
    expect(resolveConsoleDisplay({ device: readable({}, false), mirror: { locale: 'ko', textSize: null }, query: 'en', languages: ['en-US'], available: ALL }).seed).toBe('ko');
    // A hidden one is not folded.
    expect(resolveConsoleDisplay({ device: readable({}, false), mirror: { locale: 'ko', textSize: null }, query: null, languages: [], available: ['en'] }).seed).toBeNull();
  });

  it('the record\'s text size applies; standard when it has none', () => {
    expect(resolveConsoleDisplay({ device: readable({ textSize: 'larger' }), mirror: NO_MIRROR, query: null, languages: [], available: ALL }).textSize).toBe('larger');
    expect(resolveConsoleDisplay({ device: readable({}), mirror: { locale: null, textSize: 'large' }, query: null, languages: [], available: ALL }).textSize).toBe('standard');
  });

  it('?lang= seeds only a device that never chose', () => {
    expect(resolveConsoleDisplay({ device: readable({}), mirror: NO_MIRROR, query: 'ko', languages: ['en'], available: ALL })).toEqual({ locale: 'ko', textSize: 'standard', seed: 'ko', mirror: 'ko' });
    expect(resolveConsoleDisplay({ device: readable({ uiLocale: 'es' }), mirror: NO_MIRROR, query: 'ko', languages: [], available: ALL })).toEqual({ locale: 'es', textSize: 'standard', seed: null, mirror: 'es' });
  });

  it('a device with learner profiles that never chose, and no ?lang=: the browser languages, then English; the mirror is cleared', () => {
    expect(resolveConsoleDisplay({ device: readable({}), mirror: { locale: 'ko', textSize: null }, query: null, languages: ['fr', 'es-MX'], available: ALL })).toEqual({
      locale: 'es',
      textSize: 'standard',
      seed: null,
      mirror: 'clear',
    });
    expect(resolveConsoleDisplay({ device: readable({}), mirror: NO_MIRROR, query: null, languages: ['fr'], available: ALL }).locale).toBe('en');
    expect(resolveConsoleDisplay({ device: readable({}, false), mirror: NO_MIRROR, query: null, languages: ['fr'], available: ALL }).mirror).toBe('clear');
  });

  it('a record that cannot be read: ?lang= > the mirror > the browser, the mirrored size; nothing is seeded and the mirror is kept', () => {
    expect(resolveConsoleDisplay({ device: UNREADABLE, mirror: { locale: 'ko', textSize: 'large' }, query: 'es', languages: [], available: ALL })).toEqual({ locale: 'es', textSize: 'large', seed: null, mirror: 'keep' });
    expect(resolveConsoleDisplay({ device: UNREADABLE, mirror: { locale: 'ko', textSize: null }, query: null, languages: ['es'], available: ALL })).toEqual({ locale: 'ko', textSize: 'standard', seed: null, mirror: 'keep' });
    expect(resolveConsoleDisplay({ device: UNREADABLE, mirror: NO_MIRROR, query: null, languages: ['es'], available: ALL }).locale).toBe('es');
  });

  it('never picks a hidden locale at any step', () => {
    expect(resolveConsoleDisplay({ device: readable({ uiLocale: 'ko' }), mirror: NO_MIRROR, query: 'es', languages: ['ko'], available: ['en'] })).toEqual({ locale: 'en', textSize: 'standard', seed: null, mirror: 'clear' });
    expect(resolveConsoleDisplay({ device: UNREADABLE, mirror: { locale: 'ko', textSize: null }, query: 'es', languages: [], available: ['en'] }).locale).toBe('en');
  });
});

describe('firstPaintLocale: before the record is read', () => {
  it('the mirror, else the browser languages; never a hidden locale', () => {
    expect(firstPaintLocale({ mirror: 'ko', languages: ['es'], available: ALL })).toBe('ko');
    expect(firstPaintLocale({ mirror: null, languages: ['es-MX'], available: ALL })).toBe('es');
    expect(firstPaintLocale({ mirror: 'ko', languages: [], available: ['en'] })).toBe('en');
  });
});

describe('queryLocale: the ?lang= of a URL', () => {
  it('reads a UI locale from the query, with or without the leading ?', () => {
    expect(queryLocale('?lang=es')).toBe('es');
    expect(queryLocale('persona=parent&lang=ko')).toBe('ko');
  });

  it('ignores a missing, empty or unknown value', () => {
    expect(queryLocale('')).toBeNull();
    expect(queryLocale('?lang=')).toBeNull();
    expect(queryLocale('?lang=fr')).toBeNull();
    expect(queryLocale('?lang=ES')).toBeNull();
    expect(queryLocale('?next=%2Fteach')).toBeNull();
  });
});

describe('the mirrors (hr:console:uiLocale, hr:console:textSize)', () => {
  it('uses the documented keys', () => {
    expect(CONSOLE_LOCALE_KEY).toBe('hr:console:uiLocale');
    expect(CONSOLE_TEXT_SIZE_KEY).toBe('hr:console:textSize');
  });

  it('round-trips a text size and ignores a value that is not a step', () => {
    const storage = fakeStorage();
    expect(readStoredTextSize(storage)).toBeNull();
    expect(writeStoredTextSize('largest', storage)).toBe(true);
    expect(readStoredTextSize(storage)).toBe('largest');
    expect(readStoredTextSize(fakeStorage({ [CONSOLE_TEXT_SIZE_KEY]: 'huge' }))).toBeNull();
    expect(readStoredTextSize(blocked)).toBeNull();
    expect(writeStoredTextSize('large', blocked)).toBe(false);
    expect(readStoredTextSize()).toBeNull();
    expect(writeStoredTextSize('large')).toBe(false);
  });

  it('round-trips a locale', () => {
    const storage = fakeStorage();
    expect(readStoredLocale(storage)).toBeNull();
    expect(writeStoredLocale('es', storage)).toBe(true);
    expect(storage.map.get(CONSOLE_LOCALE_KEY)).toBe('es');
    expect(readStoredLocale(storage)).toBe('es');
    clearStoredLocale(storage);
    expect(storage.map.has(CONSOLE_LOCALE_KEY)).toBe(false);
    expect(() => clearStoredLocale(blocked)).not.toThrow();
    expect(() => clearStoredLocale()).not.toThrow();
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
