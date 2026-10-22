import type { OverlayLocale } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LocalePackMismatch,
  LocalePackTimeout,
  PACK_LOCALES,
  createLocalePackStore,
  localePackBundleName,
  localePackMarker,
  type LocalePackChunk,
} from '../locale-pack-store';

const chunk = (locale: OverlayLocale): LocalePackChunk => ({
  LOCALE_PACK: localePackMarker(locale),
  LOCALE_MESSAGES: { common: { buttons: { ok: locale === 'es' ? 'Vale' : '확인' } } },
  LOCALE_CONTENT: { 'card:a': { title: locale === 'es' ? 'A es' : 'A ko' } },
});

/** A loader whose loads resolve when the test says, so the in-flight state can be seen. */
function deferredLoader() {
  const asked: OverlayLocale[] = [];
  const pending = new Map<OverlayLocale, { resolve: (c: LocalePackChunk) => void; reject: (e: unknown) => void }>();
  return {
    asked,
    load: (locale: OverlayLocale): Promise<LocalePackChunk> => {
      asked.push(locale);
      return new Promise<LocalePackChunk>((resolve, reject) => pending.set(locale, { resolve, reject }));
    },
    resolve: (locale: OverlayLocale, value: LocalePackChunk = chunk(locale)) => pending.get(locale)?.resolve(value),
    reject: (locale: OverlayLocale, error: unknown = new Error('offline')) => pending.get(locale)?.reject(error),
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

afterEach(() => {
  vi.useRealTimers();
});

describe('createLocalePackStore: a bundled build (native, tests)', () => {
  it('has every locale from the start and loads nothing', async () => {
    const install = vi.fn();
    const store = createLocalePackStore(null, { install });
    expect(store.bundled).toBe(true);
    for (const locale of ['en', 'es', 'ko'] as const) {
      expect(store.isLoaded(locale)).toBe(true);
      expect(store.settled(locale)).toBe(true);
    }
    await expect(store.ensure('es')).resolves.toBeUndefined();
    await expect(store.ensureAll()).resolves.toBeUndefined();
    await expect(store.untilSettled('ko')).resolves.toBeUndefined();
    const heard = vi.fn();
    store.onContent(heard);
    expect(heard).not.toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();
    expect(store.version()).toBe(0);
  });
});

describe('createLocalePackStore: the web build', () => {
  it('English needs no chunk; another locale loads once, installs, and tells its listeners', async () => {
    const loader = deferredLoader();
    const install = vi.fn();
    const store = createLocalePackStore(loader.load, { install });
    expect(store.bundled).toBe(false);
    expect(store.isLoaded('en')).toBe(true);
    expect(store.settled('en')).toBe(true);
    await store.ensure('en');
    expect(loader.asked).toEqual([]);

    expect(store.isLoaded('es')).toBe(false);
    expect(store.settled('es')).toBe(false);
    const changes = vi.fn();
    const off = store.subscribe(changes);
    const heard: [OverlayLocale, unknown][] = [];
    store.onContent((locale, table) => heard.push([locale, table]));
    const first = store.ensure('es');
    const again = store.ensure('es');
    expect(again).toBe(first);
    expect(loader.asked).toEqual(['es']);
    loader.resolve('es');
    await first;
    expect(install).toHaveBeenCalledWith('es', chunk('es'));
    expect(store.isLoaded('es')).toBe(true);
    expect(store.settled('es')).toBe(true);
    expect(heard).toEqual([['es', chunk('es').LOCALE_CONTENT]]);
    expect(changes).toHaveBeenCalledTimes(1);
    expect(store.version()).toBe(1);
    // Loaded: never asked again; a late listener hears what is in.
    await store.ensure('es');
    expect(loader.asked).toEqual(['es']);
    const late = vi.fn();
    const offLate = store.onContent(late);
    expect(late).toHaveBeenCalledWith('es', chunk('es').LOCALE_CONTENT);
    offLate();
    off();
    expect(store.isLoaded('ko')).toBe(false);
  });

  it('a failed load settles the locale without its text, reports the error, and the next ensure tries again', async () => {
    const loader = deferredLoader();
    const install = vi.fn();
    const onFailure = vi.fn();
    const store = createLocalePackStore(loader.load, { install, onFailure });
    const boot = store.untilSettled('ko');
    const error = new Error('offline');
    loader.reject('ko', error);
    await boot;
    expect(store.settled('ko')).toBe(true);
    expect(store.isLoaded('ko')).toBe(false);
    expect(onFailure).toHaveBeenCalledWith(error);
    expect(install).not.toHaveBeenCalled();
    // A settled locale does not hold the boot again while its retry runs.
    await store.untilSettled('ko');
    expect(loader.asked).toEqual(['ko', 'ko']);
    loader.resolve('ko');
    await flush();
    expect(store.isLoaded('ko')).toBe(true);
    expect(install).toHaveBeenCalledWith('ko', chunk('ko'));
  });

  it('ensure rejects on a failure; ensureAll loads both and rejects with the first failure once both settle', async () => {
    const loader = deferredLoader();
    const store = createLocalePackStore(loader.load, { install: () => undefined });
    const one = store.ensure('es');
    loader.reject('es');
    await expect(one).rejects.toThrow('offline');
    const all = store.ensureAll();
    expect(loader.asked).toEqual(['es', ...PACK_LOCALES]);
    loader.resolve('es');
    loader.reject('ko', new Error('ko offline'));
    await expect(all).rejects.toThrow('ko offline');
    expect(store.isLoaded('es')).toBe(true);
    expect(store.isLoaded('ko')).toBe(false);
    const both = store.ensureAll();
    loader.resolve('ko');
    await expect(both).resolves.toBeUndefined();
  });

  it('a loader that throws is a failed load', async () => {
    const store = createLocalePackStore(
      () => {
        throw new Error('no loader');
      },
      { install: () => undefined },
    );
    await expect(store.ensure('es')).rejects.toThrow('no loader');
    expect(store.settled('es')).toBe(true);
  });

  it('refuses a chunk of another locale or another build', async () => {
    const loader = deferredLoader();
    const install = vi.fn();
    const store = createLocalePackStore(loader.load, { install });
    const load = store.ensure('es');
    loader.resolve('es', chunk('ko'));
    await expect(load).rejects.toBeInstanceOf(LocalePackMismatch);
    await expect(load).rejects.toThrow('the es locale chunk carries locale-pack:ko');
    expect(install).not.toHaveBeenCalled();
    expect(store.isLoaded('es')).toBe(false);
  });

  it('a load that hangs past the timeout fails, gives up its pending script, and a late answer changes nothing', async () => {
    vi.useFakeTimers();
    const loader = deferredLoader();
    const abandon = vi.fn();
    const install = vi.fn();
    const store = createLocalePackStore(loader.load, { install, timeoutMs: 15_000, abandon });
    const load = store.ensure('ko');
    const settled = load.catch((error: unknown) => error);
    vi.advanceTimersByTime(14_999);
    expect(abandon).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    const error = await settled;
    expect(error).toBeInstanceOf(LocalePackTimeout);
    expect((error as LocalePackTimeout).locale).toBe('ko');
    expect((error as Error).message).toBe('the ko locale chunk did not load within 15000 ms');
    expect(abandon).toHaveBeenCalledWith('locale-ko');
    loader.resolve('ko');
    await flush();
    expect(install).not.toHaveBeenCalled();
    // In time, the timer is cleared and the chunk installs; a failure in time is a plain failure.
    const retry = store.ensure('ko');
    loader.resolve('ko');
    await retry;
    expect(install).toHaveBeenCalledTimes(1);
    const es = store.ensure('es');
    loader.reject('es', new Error('refused'));
    await expect(es).rejects.toThrow('refused');
    vi.advanceTimersByTime(20_000);
    expect(abandon).toHaveBeenCalledTimes(1);
  });

  it('names the bundles and markers the post-build check matches', () => {
    expect(PACK_LOCALES).toEqual(['es', 'ko']);
    expect(localePackBundleName('es')).toBe('locale-es');
    expect(localePackMarker('ko')).toBe('locale-pack:ko');
  });
});
