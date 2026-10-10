import { describe, expect, it, vi } from 'vitest';
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
