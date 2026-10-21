import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = new Map<string, unknown>();
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  readJsonStrict: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, JSON.parse(JSON.stringify(v)));
  }),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
}));
const visibility = vi.hoisted(() => ({ listeners: [] as ((visible: boolean) => void)[] }));
vi.mock('../../platform/app-visibility', () => ({
  subscribeAppVisibility: vi.fn((l: (visible: boolean) => void) => {
    visibility.listeners.push(l);
    return () => undefined;
  }),
  isAppVisible: () => true,
}));
const api = vi.hoisted(() => ({ base: null as string | null }));
vi.mock('../../platform/sync-api', () => ({ apiBaseUrl: () => api.base }));

import { bucketOf, REFETCH_MIN_AGE_MS } from '../../logic/remote-config/remote-config';
import { useProfileStore } from '../profile-store';
import { CONFIG_PATH, REMOTE_CONFIG_KEY, currFlagOn, resetRemoteConfigForTests, startRemoteConfig, useRemoteConfigStore } from '../remote-config-store';

/**
 * The remote config shell (F-CURR-002 section 12.2, row CM-2): fetch without an identifier, keep the last copy through
 * the storage wrapper, fall back in the right order, and refetch on foreground by age.
 */
const ENDPOINT = 'https://api.test';
const MIN = 60 * 1000;

function answer(flags: Record<string, unknown>, init: { status?: number; cacheControl?: string } = {}): Response {
  return new Response(JSON.stringify({ ok: (init.status ?? 200) < 400, data: { flags } }), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', 'cache-control': init.cacheControl ?? 'public, max-age=300' },
  });
}

function fetchReturning(...responses: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses.length > 1 ? responses.shift() : responses[0];
    if (next instanceof Error) throw next;
    return (next as Response).clone();
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

beforeEach(() => {
  mem.clear();
  resetRemoteConfigForTests();
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
});

describe('refresh · a request with no identifier', () => {
  it('GETs /api/config with no credentials, no identifying header and no query', async () => {
    const f = fetchReturning(answer({}));
    await useRemoteConfigStore.getState().refresh({ endpoint: ENDPOINT, fetchImpl: f.impl, now: () => 0 });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]?.url).toBe(`${ENDPOINT}${CONFIG_PATH}`);
    expect(f.calls[0]?.url).not.toContain('?');
    expect(f.calls[0]?.init?.method).toBe('GET');
    expect(f.calls[0]?.init?.credentials).toBe('omit');
    expect(f.calls[0]?.init?.headers).toEqual({ Accept: 'application/json' });
  });

  it('even with an active profile, the request names nobody', async () => {
    useProfileStore.setState({ activeId: 'k7f3x9qa' });
    const f = fetchReturning(answer({}));
    await useRemoteConfigStore.getState().refresh({ endpoint: ENDPOINT, fetchImpl: f.impl, now: () => 0 });
    expect(JSON.stringify(f.calls)).not.toContain('k7f3x9qa');
  });

  it('no API configured: nothing is fetched', async () => {
    const f = fetchReturning(answer({}));
    expect(await useRemoteConfigStore.getState().refresh({ endpoint: null, fetchImpl: f.impl })).toBe(false);
    expect(f.calls).toHaveLength(0);
  });

  it('keeps the copy in memory and through the storage wrapper, with its max-age', async () => {
    const f = fetchReturning(answer({ goals: { on: true, pct: 10 } }, { cacheControl: 'public, max-age=600' }));
    expect(await useRemoteConfigStore.getState().refresh({ endpoint: ENDPOINT, fetchImpl: f.impl, now: () => 1234 })).toBe(true);
    const expected = { v: 1, fetchedAt: 1234, maxAgeS: 600, flags: { goals: { on: true, pct: 10 } } };
    expect(useRemoteConfigStore.getState().cache).toEqual(expected);
    expect(mem.get(REMOTE_CONFIG_KEY)).toEqual(expected);
  });

  it('a response without max-age keeps the server default of 300', async () => {
    const f = fetchReturning(new Response(JSON.stringify({ ok: true, data: { flags: {} } }), { status: 200 }));
    await useRemoteConfigStore.getState().refresh({ endpoint: ENDPOINT, fetchImpl: f.impl, now: () => 0 });
    expect(useRemoteConfigStore.getState().cache?.maxAgeS).toBe(300);
  });

  it('one fetch at a time', async () => {
    const f = fetchReturning(answer({}));
    const a = useRemoteConfigStore.getState().refresh({ endpoint: ENDPOINT, fetchImpl: f.impl, now: () => 0 });
    const b = useRemoteConfigStore.getState().refresh({ endpoint: ENDPOINT, fetchImpl: f.impl, now: () => 0 });
    expect(a).toBe(b);
    await a;
    expect(f.calls).toHaveLength(1);
  });
});

describe('fallback order: last known when offline, built-in pct when never fetched', () => {
  it('never fetched: the built-in pct (0), so every F-CURR-002 flag is off', () => {
    useProfileStore.setState({ activeId: 'p1' });
    for (const flag of ['dailyReview', 'mastery', 'goals', 'pack.k-food', 'game.cloze'] as const) expect(currFlagOn(flag), flag).toBe(false);
  });

  it('a fetched copy turns a ramped flag on for its share of profiles', async () => {
    const f = fetchReturning(answer({ goals: { on: true, pct: 100 }, dailyReview: { on: true, pct: 40 } }));
    await useRemoteConfigStore.getState().refresh({ endpoint: ENDPOINT, fetchImpl: f.impl, now: () => 0 });
    expect(currFlagOn('goals', 'p1')).toBe(true);
    for (const id of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6']) expect(currFlagOn('dailyReview', id), id).toBe(bucketOf(id, 'dailyReview') < 40);
    expect(currFlagOn('mastery', 'p1')).toBe(false);
  });

  it('offline (a failed fetch, a 5xx, an unreadable body): the last known copy stays', async () => {
    const ok = fetchReturning(answer({ goals: { on: true, pct: 100 } }));
    await useRemoteConfigStore.getState().refresh({ endpoint: ENDPOINT, fetchImpl: ok.impl, now: () => 0 });
    for (const bad of [new Error('offline'), answer({}, { status: 503 }), new Response('not json', { status: 200 }), new Response(JSON.stringify({ ok: true }), { status: 200 })]) {
      const f = fetchReturning(bad);
      expect(await useRemoteConfigStore.getState().refresh({ endpoint: ENDPOINT, fetchImpl: f.impl, now: () => 99 })).toBe(false);
      expect(currFlagOn('goals', 'p1')).toBe(true);
      expect(useRemoteConfigStore.getState().cache?.fetchedAt).toBe(0);
    }
  });

  it('after a restart while offline: the stored copy', async () => {
    mem.set(REMOTE_CONFIG_KEY, { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { goals: { on: true, pct: 100 } } });
    await useRemoteConfigStore.getState().hydrate();
    expect(currFlagOn('goals', 'p1')).toBe(true);
  });

  it('a damaged stored copy counts as never fetched', async () => {
    mem.set(REMOTE_CONFIG_KEY, { v: 7, junk: true });
    await useRemoteConfigStore.getState().hydrate();
    expect(useRemoteConfigStore.getState().cache).toBeNull();
    expect(currFlagOn('goals', 'p1')).toBe(false);
  });

  it('a copy fetched while the stored one is still loading wins', async () => {
    mem.set(REMOTE_CONFIG_KEY, { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { goals: { on: false, pct: 0 } } });
    useRemoteConfigStore.setState({ cache: { v: 1, fetchedAt: 5, maxAgeS: 300, flags: { goals: { on: true, pct: 100 } } } });
    await useRemoteConfigStore.getState().hydrate();
    expect(useRemoteConfigStore.getState().cache?.fetchedAt).toBe(5);
  });

  it('a pack also needs topicPacks', async () => {
    const f = fetchReturning(answer({ topicPacks: { on: true, pct: 100 }, 'pack.k-food': { on: true, pct: 100 }, 'pack.space': { on: false, pct: 100 } }));
    await useRemoteConfigStore.getState().refresh({ endpoint: ENDPOINT, fetchImpl: f.impl, now: () => 0 });
    expect(currFlagOn('pack.k-food', 'p1')).toBe(true);
    expect(currFlagOn('pack.space', 'p1')).toBe(false);
    const off = fetchReturning(answer({ topicPacks: { on: false, pct: 100 }, 'pack.k-food': { on: true, pct: 100 } }));
    await useRemoteConfigStore.getState().refresh({ endpoint: ENDPOINT, fetchImpl: off.impl, now: () => 1 });
    expect(currFlagOn('pack.k-food', 'p1')).toBe(false);
  });
});

describe('startRemoteConfig · foreground refetch by age', () => {
  it('fetches at start when never fetched, then on foreground only once the copy is 15 minutes old', async () => {
    let t = 1_000_000;
    let listener: ((visible: boolean) => void) | null = null;
    const unsubscribe = vi.fn();
    const subscribe = vi.fn((l: (visible: boolean) => void) => {
      listener = l;
      return unsubscribe;
    });
    const f = fetchReturning(answer({}));
    const stop = startRemoteConfig({ endpoint: ENDPOINT, fetchImpl: f.impl, now: () => t, subscribe });
    await vi.waitFor(() => expect(f.calls).toHaveLength(1));
    await vi.waitFor(() => expect(useRemoteConfigStore.getState().cache?.fetchedAt).toBe(1_000_000));

    t += 5 * MIN;
    listener!(true);
    await Promise.resolve();
    expect(f.calls).toHaveLength(1);

    t = 1_000_000 + REFETCH_MIN_AGE_MS;
    listener!(false);
    await Promise.resolve();
    expect(f.calls).toHaveLength(1);
    listener!(true);
    await vi.waitFor(() => expect(f.calls).toHaveLength(2));

    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('by default it reads the configured API and follows app visibility', async () => {
    api.base = ENDPOINT;
    visibility.listeners.length = 0;
    const f = fetchReturning(answer({}));
    const original = globalThis.fetch;
    globalThis.fetch = f.impl;
    try {
      const stop = startRemoteConfig();
      await vi.waitFor(() => expect(f.calls).toHaveLength(1));
      expect(f.calls[0]?.url).toBe(`${ENDPOINT}${CONFIG_PATH}`);
      expect(visibility.listeners).toHaveLength(1);
      visibility.listeners[0]?.(true); // fresh copy: no second fetch
      await Promise.resolve();
      expect(f.calls).toHaveLength(1);
      stop();
    } finally {
      globalThis.fetch = original;
      api.base = null;
    }
  });

  it('a fresh stored copy is not refetched at start', async () => {
    mem.set(REMOTE_CONFIG_KEY, { v: 1, fetchedAt: 1000, maxAgeS: 300, flags: {} });
    const f = fetchReturning(answer({}));
    const stop = startRemoteConfig({ endpoint: ENDPOINT, fetchImpl: f.impl, now: () => 1000 + MIN, subscribe: () => () => undefined });
    await vi.waitFor(() => expect(useRemoteConfigStore.getState().hydrated).toBe(true));
    await new Promise((r) => setTimeout(r, 0));
    expect(f.calls).toHaveLength(0);
    stop();
  });
});
