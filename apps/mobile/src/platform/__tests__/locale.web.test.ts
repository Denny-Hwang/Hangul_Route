import { afterEach, describe, expect, it, vi } from 'vitest';
import { deviceLanguages, setDocumentLang, takeLangHandoff } from '../locale.web';

function fakeLocation(search: string, hash = ''): { pathname: string; search: string; hash: string } {
  return { pathname: '/play', search, hash };
}

describe('platform/locale.web (navigator.languages)', () => {
  it('reads navigator.languages in order', () => {
    expect(deviceLanguages({ languages: ['ko-KR', 'en'], language: 'ko-KR' })).toEqual(['ko-KR', 'en']);
  });

  it('falls back to navigator.language when languages is missing or empty', () => {
    expect(deviceLanguages({ language: 'es-MX' })).toEqual(['es-MX']);
    expect(deviceLanguages({ languages: [], language: 'es-MX' })).toEqual(['es-MX']);
  });

  it('returns [] when there is no navigator or it throws', () => {
    expect(deviceLanguages({})).toEqual([]);
    expect(deviceLanguages(null)).toEqual([]);
    const hostile = {
      get languages(): string[] {
        throw new Error('blocked');
      },
    };
    expect(deviceLanguages(hostile as unknown as { languages?: readonly string[] })).toEqual([]);
  });
});

describe('platform/locale.web takeLangHandoff (?lang= from the landing page)', () => {
  it('returns an available locale and cleans the parameter, keeping other params and the hash', () => {
    const replaceState = vi.fn();
    const result = takeLangHandoff({
      location: fakeLocation('?lang=ko&ref=site', '#top'),
      history: { replaceState, state: { a: 1 } },
      available: ['en', 'es', 'ko'],
    });
    expect(result).toBe('ko');
    expect(replaceState).toHaveBeenCalledWith({ a: 1 }, '', '/play?ref=site#top');
  });

  it('drops the whole query string when lang was the only parameter', () => {
    const replaceState = vi.fn();
    takeLangHandoff({ location: fakeLocation('?lang=es'), history: { replaceState, state: null }, available: ['en', 'es'] });
    expect(replaceState).toHaveBeenCalledWith(null, '', '/play');
  });

  it('ignores a locale that is not available but still cleans the URL', () => {
    const replaceState = vi.fn();
    const result = takeLangHandoff({
      location: fakeLocation('?lang=es'),
      history: { replaceState, state: null },
      available: ['en'],
    });
    expect(result).toBeNull();
    expect(replaceState).toHaveBeenCalledTimes(1);
  });

  it('ignores unknown or malformed values', () => {
    expect(takeLangHandoff({ location: fakeLocation('?lang=fr'), history: { replaceState: vi.fn(), state: null }, available: ['en', 'es', 'ko'] })).toBeNull();
    expect(takeLangHandoff({ location: fakeLocation('?lang='), history: { replaceState: vi.fn(), state: null }, available: ['en'] })).toBeNull();
  });

  it('does nothing when there is no lang parameter', () => {
    const replaceState = vi.fn();
    expect(takeLangHandoff({ location: fakeLocation('?ref=site'), history: { replaceState, state: null }, available: ['en', 'es'] })).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('never throws: no window, or a history that refuses', () => {
    expect(takeLangHandoff({ location: null, history: null, available: ['en'] })).toBeNull();
    const result = takeLangHandoff({
      location: fakeLocation('?lang=ko'),
      history: {
        replaceState: () => {
          throw new Error('SecurityError');
        },
        state: null,
      },
      available: ['en', 'ko'],
    });
    expect(result).toBe('ko');
  });
});

describe('platform/locale.web setDocumentLang', () => {
  it('sets <html lang>', () => {
    const el = { lang: 'en' };
    setDocumentLang('ko', { documentElement: el });
    expect(el.lang).toBe('ko');
  });

  it('does nothing without a document', () => {
    expect(() => setDocumentLang('ko', null)).not.toThrow();
  });
});

describe('platform/locale.web against the browser globals', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads navigator, location and history from the page, taking a shipped locale from the hand-off', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('navigator', { languages: ['es-MX'], language: 'es-MX' });
    vi.stubGlobal('location', { pathname: '/', search: '?lang=es', hash: '' });
    vi.stubGlobal('history', { replaceState, state: null });
    expect(deviceLanguages()).toEqual(['es-MX']);
    // Spanish ships (row 15b), so the hand-off applies and the URL is cleaned.
    expect(takeLangHandoff()).toBe('es');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  it('sets lang on the page document', () => {
    const documentElement = { lang: 'en' };
    vi.stubGlobal('document', { documentElement });
    setDocumentLang('es');
    expect(documentElement.lang).toBe('es');
  });

  it('copes with a missing window entirely', () => {
    vi.stubGlobal('navigator', undefined);
    vi.stubGlobal('location', undefined);
    vi.stubGlobal('history', undefined);
    vi.stubGlobal('document', undefined);
    expect(deviceLanguages()).toEqual([]);
    expect(takeLangHandoff()).toBeNull();
    expect(() => setDocumentLang('es')).not.toThrow();
  });

  it('survives a location whose search cannot be read', () => {
    const hostile = {
      get search(): string {
        throw new Error('blocked');
      },
      pathname: '/',
      hash: '',
    };
    expect(takeLangHandoff({ location: hostile, history: null, available: ['en'] })).toBeNull();
  });

  it('survives a document that refuses the write', () => {
    const doc = {
      documentElement: {
        set lang(_v: string) {
          throw new Error('frozen');
        },
        get lang(): string {
          return 'en';
        },
      },
    };
    expect(() => setDocumentLang('es', doc)).not.toThrow();
  });
});
