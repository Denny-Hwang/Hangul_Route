import { getMessages, type DeepPartial, type Messages, type MessageLocale } from '@hangul-route/i18n';
import { es } from '@hangul-route/i18n/messages-es';
import { ko } from '@hangul-route/i18n/messages-ko';
import { describe, expect, it, vi } from 'vitest';
import { loadMessageOverlay, withMessages, type OverlayImporters } from '../message-overlays';

/**
 * FN-6 (AMENDMENTS-FINISH-2026-11, finding F5): the browser build of the console carries English only and loads
 * es / ko as chunks of their own. Here the language store is a stand-in, so each path can be driven.
 */
function store(inHand: readonly MessageLocale[] = ['en']) {
  const loaded = new Map<string, DeepPartial<Messages>>();
  const has = (l: MessageLocale) => inHand.includes(l) || loaded.has(l);
  const register = vi.fn((l: string, overlay: DeepPartial<Messages>) => {
    loaded.set(l, overlay);
  });
  return { has, register, loaded };
}

describe('loadMessageOverlay', () => {
  it('English (and a language already in) loads nothing', async () => {
    const s = store(['en', 'es']);
    const importers = { es: vi.fn(), ko: vi.fn() } as unknown as OverlayImporters;
    await expect(loadMessageOverlay('en', { ...s, importers })).resolves.toBe(true);
    await expect(loadMessageOverlay('es', { ...s, importers })).resolves.toBe(true);
    expect(importers.es).not.toHaveBeenCalled();
    expect(s.register).not.toHaveBeenCalled();
  });

  it('loads a language once, hands it to the dictionary, and shares one fetch between callers', async () => {
    const s = store();
    let release: (v: DeepPartial<Messages>) => void = () => undefined;
    const importers: OverlayImporters = {
      es: vi.fn(() => new Promise<DeepPartial<Messages>>((done) => (release = done))),
      ko: vi.fn(async () => ko),
    };
    const first = loadMessageOverlay('es', { ...s, importers });
    const second = loadMessageOverlay('es', { ...s, importers });
    expect(second).toBe(first);
    release(es);
    await expect(first).resolves.toBe(true);
    expect(importers.es).toHaveBeenCalledTimes(1);
    expect(s.register).toHaveBeenCalledWith('es', es);
    // In now: no fetch.
    await expect(loadMessageOverlay('es', { ...s, importers })).resolves.toBe(true);
    expect(importers.es).toHaveBeenCalledTimes(1);
  });

  it('a chunk that cannot load settles false (never rejects), and the next call tries again', async () => {
    const s = store();
    const ko2 = vi.fn<() => Promise<DeepPartial<Messages>>>().mockRejectedValueOnce(new Error('ChunkLoadError')).mockResolvedValueOnce(ko);
    const importers: OverlayImporters = { es: async () => es, ko: ko2 };
    await expect(loadMessageOverlay('ko', { ...s, importers })).resolves.toBe(false);
    expect(s.register).not.toHaveBeenCalled();
    await expect(loadMessageOverlay('ko', { ...s, importers })).resolves.toBe(true);
    expect(s.register).toHaveBeenCalledWith('ko', ko);
  });

  it('by default it reads the real dictionary: the tests (like the server build) carry both languages already', async () => {
    await expect(loadMessageOverlay('ko')).resolves.toBe(true);
    expect(getMessages('ko')).not.toBe(getMessages('en'));
  });

  it('the default importers are the one-language subpaths of the i18n package', async () => {
    // A store with nothing in hand makes the real `import()` run.
    const s = store([]);
    await expect(loadMessageOverlay('es', { has: s.has, register: s.register })).resolves.toBe(true);
    await expect(loadMessageOverlay('ko', { has: s.has, register: s.register })).resolves.toBe(true);
    expect(s.loaded.get('es')).toBe(es);
    expect(s.loaded.get('ko')).toBe(ko);
  });
});

describe('withMessages', () => {
  it('runs at once (synchronously) when the language is in', () => {
    const then = vi.fn();
    withMessages('en', then, store());
    expect(then).toHaveBeenCalledTimes(1);
  });

  it('runs after the load otherwise, also when the load failed', async () => {
    const s = store();
    const then = vi.fn();
    withMessages('es', then, { ...s, importers: { es: async () => es, ko: async () => Promise.reject(new Error('offline')) } });
    expect(then).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(then).toHaveBeenCalledTimes(1));
    const after = vi.fn();
    withMessages('ko', after, { ...s, importers: { es: async () => es, ko: async () => Promise.reject(new Error('offline')) } });
    await vi.waitFor(() => expect(after).toHaveBeenCalledTimes(1));
    expect(s.loaded.has('ko')).toBe(false);
  });
});
