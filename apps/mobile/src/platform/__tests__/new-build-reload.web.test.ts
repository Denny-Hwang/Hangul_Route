import { afterEach, describe, expect, it, vi } from 'vitest';
import { isNewBuildAnswer as nativeAnswer, reloadForNewBuild as nativeReload } from '../new-build-reload';
import { RELOAD_GAP_MS, RELOAD_KEY, failedChunkUrl, isNewBuildAnswer, reloadForNewBuild, type ProbeEnv, type ReloadEnv } from '../new-build-reload.web';

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

describe('isNewBuildAnswer (F-CURR-002 §10: a chunk script error is asked again before it counts as a network failure)', () => {
  const ORIGIN = 'https://app.example.test';
  const CHUNK = `${ORIGIN}/_expo/static/js/web/lessons-cell-stage2-letters-0123456789abcdef0123456789abcdef.js`;
  const scriptError = (request: unknown = CHUNK): Error =>
    Object.assign(new Error(`Loading module ${String(request)} failed.`), { name: 'AsyncRequireError', type: 'error', request });
  const answer = (status: number, type: string | null) => ({ status, headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? type : null) } });
  function probe(over: Partial<ProbeEnv> = {}) {
    const asked: string[] = [];
    const env: ProbeEnv = {
      onLine: over.onLine ?? (() => true),
      origin: over.origin ?? (() => ORIGIN),
      fetch:
        over.fetch ??
        (async (url) => {
          asked.push(url);
          return answer(200, 'text/html; charset=utf-8');
        }),
    };
    return { env, asked };
  }

  it('is a newer build when the URL now answers with the HTML page (the single-page fallback) or 404 / 410', async () => {
    const p = probe();
    expect(await isNewBuildAnswer(scriptError(), p.env)).toBe(true);
    expect(p.asked).toEqual([CHUNK]);
    for (const status of [404, 410]) expect(await isNewBuildAnswer(scriptError(), probe({ fetch: async () => answer(status, 'text/plain') }).env)).toBe(true);
  });

  it('is a network failure when the URL answers with the script, a server error, or not at all', async () => {
    expect(await isNewBuildAnswer(scriptError(), probe({ fetch: async () => answer(200, 'application/javascript') }).env)).toBe(false);
    expect(await isNewBuildAnswer(scriptError(), probe({ fetch: async () => answer(503, 'text/html') }).env)).toBe(false);
    expect(await isNewBuildAnswer(scriptError(), probe({ fetch: async () => Promise.reject(new TypeError('Failed to fetch')) }).env)).toBe(false);
  });

  it('never asks offline, for another host, for a file that is not a lesson chunk, or for another error', async () => {
    for (const [error, over] of [
      [scriptError(), { onLine: () => false }],
      [scriptError('https://elsewhere.test/_expo/static/js/web/lessons-cell-stage2-letters-0123456789abcdef0123456789abcdef.js'), {}],
      [scriptError(`${ORIGIN}/_expo/static/js/web/index-0123456789abcdef0123456789abcdef.js`), {}],
      [scriptError(42), {}],
      [new Error('Loading module failed.'), {}],
      ['AsyncRequireError', {}],
    ] as const) {
      const p = probe(over);
      expect(await isNewBuildAnswer(error, p.env)).toBe(false);
      expect(p.asked).toEqual([]);
    }
    expect(failedChunkUrl(scriptError(), undefined)).toBeUndefined();
    expect(failedChunkUrl(scriptError('/_expo/static/js/web/lessons-titles-ko-0123456789abcdef0123456789abcdef.js'), ORIGIN)).toBe(
      `${ORIGIN}/_expo/static/js/web/lessons-titles-ko-0123456789abcdef0123456789abcdef.js`,
    );
  });

  it('is never a newer build on native, where the chunks are in the one bundle', async () => {
    expect(await nativeAnswer()).toBe(false);
  });
});
