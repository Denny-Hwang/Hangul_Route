import { afterEach, describe, expect, it, vi } from 'vitest';
import { reloadForNewBuild as nativeReload } from '../new-build-reload';
import { RELOAD_GAP_MS, RELOAD_KEY, reloadForNewBuild, type ReloadEnv } from '../new-build-reload.web';

function env(over: Partial<ReloadEnv> & { store?: Map<string, string> | null; at?: number } = {}) {
  const store = over.store === undefined ? new Map<string, string>() : over.store;
  let reloads = 0;
  let at = over.at ?? 1_000_000;
  const e: ReloadEnv = {
    onLine: over.onLine ?? (() => true),
    now: () => at,
    session: over.session ?? (() => (store === null ? null : { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) })),
    reload: () => {
      reloads += 1;
    },
  };
  return { e, store, reloads: () => reloads, advance: (ms: number) => (at += ms) };
}

describe('reloadForNewBuild (F-CURR-002 §10: a page older than its lesson chunks)', () => {
  it('reloads once, then not again within a minute, then again after it', () => {
    const t = env();
    expect(reloadForNewBuild(t.e)).toBe(true);
    expect(t.store?.get(RELOAD_KEY)).toBe('1000000');
    expect(reloadForNewBuild(t.e)).toBe(false);
    t.advance(RELOAD_GAP_MS - 1);
    expect(reloadForNewBuild(t.e)).toBe(false);
    t.advance(1);
    expect(reloadForNewBuild(t.e)).toBe(true);
    expect(t.reloads()).toBe(2);
  });

  it('never reloads offline, where the reload could not reach the new build', () => {
    const t = env({ onLine: () => false });
    expect(reloadForNewBuild(t.e)).toBe(false);
    expect(t.reloads()).toBe(0);
  });

  it('never reloads without session storage (no guard against a loop), or when it refuses', () => {
    const none = env({ store: null });
    expect(reloadForNewBuild(none.e)).toBe(false);
    const refusing = env({
      session: () => ({
        getItem: () => null,
        setItem: () => {
          throw new Error('quota');
        },
      }),
    });
    expect(reloadForNewBuild(refusing.e)).toBe(false);
    expect(none.reloads() + refusing.reloads()).toBe(0);
  });

  it('a mark from the future (a clock moved back) does not block it', () => {
    const t = env({ store: new Map([[RELOAD_KEY, String(5_000_000)]]) });
    expect(reloadForNewBuild(t.e)).toBe(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('by default reads the page: navigator.onLine, sessionStorage and location.reload', () => {
    const store = new Map<string, string>();
    const reload = vi.fn();
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    vi.stubGlobal('location', { reload });
    expect(reloadForNewBuild()).toBe(true);
    expect(reloadForNewBuild()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.stubGlobal('navigator', { onLine: false });
    store.clear();
    expect(reloadForNewBuild()).toBe(false);
  });

  it('by default, blocked site data (the sessionStorage getter throws) means no reload', () => {
    vi.stubGlobal('navigator', { onLine: true });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    try {
      expect(reloadForNewBuild()).toBe(false);
    } finally {
      delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    }
  });

  it('the native build never reloads', () => {
    expect(nativeReload()).toBe(false);
  });
});
