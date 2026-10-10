import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLocales = vi.hoisted(() => vi.fn());
vi.mock('expo-localization', () => ({ getLocales }));

import { deviceLanguages, setDocumentLang, takeLangHandoff } from '../locale';

describe('platform/locale (native, expo-localization)', () => {
  beforeEach(() => getLocales.mockReset());

  it('returns the language tags in the device preference order', () => {
    getLocales.mockReturnValue([{ languageTag: 'es-MX' }, { languageTag: 'en-US' }]);
    expect(deviceLanguages()).toEqual(['es-MX', 'en-US']);
  });

  it('returns [] when the native module throws or returns nothing usable', () => {
    getLocales.mockImplementation(() => {
      throw new Error('native module missing');
    });
    expect(deviceLanguages()).toEqual([]);
    getLocales.mockReset();
    getLocales.mockReturnValue(undefined);
    expect(deviceLanguages()).toEqual([]);
  });

  it('skips entries without a language tag', () => {
    getLocales.mockReturnValue([{ languageTag: 'ko-KR' }, { languageTag: null }, {}]);
    expect(deviceLanguages()).toEqual(['ko-KR']);
  });

  it('has no ?lang= hand-off and no document to update on native', () => {
    expect(takeLangHandoff()).toBeNull();
    expect(() => setDocumentLang('es')).not.toThrow();
  });
});
