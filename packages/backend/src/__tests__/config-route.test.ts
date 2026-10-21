import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import type { D1Like } from '../db/d1';
import { clampPct, MemoryDb, publicFlags, readOn, REMOTE_FLAG_NAME, type RemoteConfigRow } from '../db';
import { CONFIG_CACHE_CONTROL, CONFIG_MAX_AGE_SECONDS } from '../routes/config';
import { testDb } from './helpers/db';
import { openSqliteD1 } from './helpers/sqlite';

/**
 * GET /api/config (F-CURR-002 section 12.2, row CM-2): public, read-only remote config. No auth, no identifier read,
 * `{ flags: { name: { on, pct } } }` only, `Cache-Control: public, max-age=300`, a 503 with `no-store` when D1 cannot
 * be read, and one fixed edge-cache key. Runs on the memory Db and, with HR_TEST_DB=sqlite, on the real migrations.
 */
type Reply = { ok: boolean; data?: { flags: Record<string, { on: boolean; pct: number }> }; error?: { code: string } };
const T = '2026-10-21T00:00:00.000Z';
const row = (flag: string, on: boolean, pct: number, reason: string | null = null): RemoteConfigRow => ({ flag, on, pct, updatedAt: T, reason });

async function get(path = '/api/config', init: RequestInit = {}, env?: Record<string, unknown>) {
  const res = await app.request(path, init, env);
  const text = await res.text();
  return { res, text, body: JSON.parse(text) as Reply };
}

/** A Cache API look-alike: one Map, and a count of what was stored. */
function fakeEdgeCache() {
  const store = new Map<string, { body: string; headers: Headers }>();
  const cache = {
    puts: [] as string[],
    async match(key: string): Promise<Response | undefined> {
      const hit = store.get(key);
      return hit ? new Response(hit.body, { headers: hit.headers }) : undefined;
    },
    async put(key: string, response: Response): Promise<void> {
      cache.puts.push(key);
      store.set(key, { body: await response.text(), headers: new Headers(response.headers) });
    },
    store,
  };
  return cache;
}

/** A D1 binding that counts reads of `remote_config` and serves the given rows. */
function countingD1(rows: Record<string, unknown>[] = []): D1Like & { reads: number } {
  const d1 = {
    reads: 0,
    prepare(sql: string) {
      const stmt = {
        bind: () => stmt,
        async first() {
          return null;
        },
        async all() {
          if (/remote_config/.test(sql)) d1.reads += 1;
          return { results: rows };
        },
        async run() {
          return { meta: { changes: 0 } };
        },
      };
      return stmt;
    },
    async batch() {
      return [];
    },
  };
  return d1 as unknown as D1Like & { reads: number };
}

const globalWithCaches = globalThis as { caches?: unknown };
const originalCaches = globalWithCaches.caches;

beforeEach(async () => {
  await testDb.reset();
});

afterEach(() => {
  globalWithCaches.caches = originalCaches;
});

describe('GET /api/config · shape', () => {
  it('serves an empty flag set while the table has no rows, cacheable for 300 seconds', async () => {
    const r = await get();
    expect(r.res.status).toBe(200);
    expect(r.res.headers.get('cache-control')).toBe('public, max-age=300');
    expect(CONFIG_CACHE_CONTROL).toBe(`public, max-age=${CONFIG_MAX_AGE_SECONDS}`);
    expect(r.res.headers.get('content-type')).toMatch(/^application\/json/);
    expect(r.body.ok).toBe(true);
    expect(r.body.data).toEqual({ flags: {} });
  });

  it('serves on and pct per flag and never reason or updated_at', async () => {
    await testDb.putRemoteConfig(row('dailyReview', true, 10, 'ramp step 2'));
    await testDb.putRemoteConfig(row('pack.k-food', false, 100));
    await testDb.putRemoteConfig(row('game.cloze_pick', true, 0));
    const r = await get();
    expect(r.body.data).toEqual({ flags: { dailyReview: { on: true, pct: 10 }, 'game.cloze_pick': { on: true, pct: 0 }, 'pack.k-food': { on: false, pct: 100 } } });
    expect(r.text).not.toMatch(/ramp step|updated_at|updatedAt|reason/);
  });

  it('an upsert replaces the row', async () => {
    await testDb.putRemoteConfig(row('mastery', true, 50));
    await testDb.putRemoteConfig(row('mastery', true, 10, 'lowered'));
    expect((await get()).body.data?.flags).toEqual({ mastery: { on: true, pct: 10 } });
    expect(await testDb.remoteConfig()).toEqual([row('mastery', true, 10, 'lowered')]);
  });

  it('is read-only: no other method is served', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await app.request('/api/config', { method, headers: { 'content-type': 'application/json' }, body: '{}' });
      expect(res.status, method).toBe(404);
    }
  });
});

describe('GET /api/config · no identifier, no auth', () => {
  it('answers the same whatever identifying header, cookie or query a request carries', async () => {
    await testDb.putRemoteConfig(row('cellCheck', true, 50));
    const bare = await get();
    const loaded = await get('/api/config?profileId=profile:abc&deviceId=d1', {
      headers: { Authorization: 'Bearer dev:mom', Cookie: '__session=abc; hr_profile=profile:abc', 'x-device-id': 'device:1', 'x-learner-secret': 's' },
    });
    expect(loaded.res.status).toBe(200);
    expect(loaded.body.data).toEqual(bare.body.data);
    expect(loaded.res.headers.get('set-cookie')).toBeNull();
    expect(loaded.text).not.toMatch(/profile:abc|device:1|mom/);
  });

  it('needs no auth on a production-shaped deployment (ENVIRONMENT unset, no Clerk key, D1 bound)', async () => {
    const d1 = openSqliteD1();
    await d1.prepare('INSERT INTO remote_config (flag, "on", pct, updated_at, reason) VALUES (?, ?, ?, ?, ?)').bind('goals', 1, 100, T, null).run();
    const r = await get('/api/config', {}, { DB: d1 });
    expect(r.res.status).toBe(200);
    expect(r.body.data).toEqual({ flags: { goals: { on: true, pct: 100 } } });
    d1.close();
  });

  it('the route source reads no header, cookie, query, param or auth', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../routes/config.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(src).not.toMatch(/req\.header|req\.query|req\.queries|req\.param|getCookie|cookie|req\.json|req\.text|authOf|requireAuth|clerk|deviceAuth/i);
  });
});

describe('GET /api/config · failure keeps devices on their last value', () => {
  it('a D1 read that fails is a 503 with no-store, never an empty flag set', async () => {
    const broken = { prepare: () => ({ bind() { return this; }, first: async () => null, all: async () => { throw new Error('no such table: remote_config'); }, run: async () => ({ meta: { changes: 0 } }) }), batch: async () => [] };
    const r = await get('/api/config', {}, { DB: broken });
    expect(r.res.status).toBe(503);
    expect(r.res.headers.get('cache-control')).toBe('no-store');
    expect(r.body).toMatchObject({ ok: false, error: { code: 'config_unavailable' } });
  });

  it('production without D1 keeps the deployment 503 (db_not_configured)', async () => {
    const r = await get('/api/config', {}, { ENVIRONMENT: 'production' });
    expect(r.res.status).toBe(503);
    expect(r.body.error?.code).toBe('db_not_configured');
  });

  it('a failed answer is never put in the edge cache', async () => {
    const cache = fakeEdgeCache();
    globalWithCaches.caches = { default: cache };
    const broken = { prepare: () => ({ bind() { return this; }, first: async () => null, all: async () => { throw new Error('D1 down'); }, run: async () => ({ meta: { changes: 0 } }) }), batch: async () => [] };
    await get('/api/config', {}, { DB: broken });
    expect(cache.puts).toEqual([]);
  });
});

describe('GET /api/config · edge cache', () => {
  it('stores one fixed key without CORS headers and serves later requests from it, any query string', async () => {
    const cache = fakeEdgeCache();
    globalWithCaches.caches = { default: cache };
    const d1 = countingD1([{ flag: 'volumes', on: 1, pct: 50, updated_at: T, reason: 'x' }]);
    const origin = { Origin: 'https://app.hangulroute.com' };
    const first = await get('/api/config', { headers: origin }, { DB: d1 });
    expect(first.body.data).toEqual({ flags: { volumes: { on: true, pct: 50 } } });
    expect(cache.puts).toEqual(['http://localhost/api/config']);
    const stored = cache.store.get('http://localhost/api/config');
    expect(stored?.headers.get('access-control-allow-origin')).toBeNull();
    expect(stored?.headers.get('cache-control')).toBe('public, max-age=300');

    const second = await get('/api/config?bust=1', { headers: origin }, { DB: d1 });
    expect(d1.reads).toBe(1);
    expect(second.res.status).toBe(200);
    expect(second.res.headers.get('cache-control')).toBe('public, max-age=300');
    expect(second.res.headers.get('access-control-allow-origin')).toBe('https://app.hangulroute.com');
    expect(second.body.data).toEqual(first.body.data);
  });

  it('a cache that fails to answer falls through to D1', async () => {
    globalWithCaches.caches = { default: { match: async () => { throw new Error('cache down'); }, put: async () => { throw new Error('cache down'); } } };
    const d1 = countingD1([{ flag: 'goals', on: 0, pct: 100, updated_at: T, reason: null }]);
    const r = await get('/api/config', {}, { DB: d1 });
    expect(r.res.status).toBe(200);
    expect(r.body.data).toEqual({ flags: { goals: { on: false, pct: 100 } } });
  });
});

describe('remote config values', () => {
  it('only exactly 1 is on; pct is an integer in 0-100, and a value outside it or a non-number is 0 (off)', () => {
    expect([1, true, '1'].map(readOn)).toEqual([true, true, true]);
    expect([0, 2, -1, null, undefined, 'on', 'true'].map(readOn)).toEqual([false, false, false, false, false, false, false]);
    expect([0, 10, 99.9, 100, 101, -5, '25', '', ' ', 'x', null, Number.NaN, Number.POSITIVE_INFINITY].map(clampPct)).toEqual([0, 10, 99, 100, 0, 0, 25, 0, 0, 0, 0, 0, 0]);
    expect([250, 1000, 100.5, '250'].map(clampPct)).toEqual([0, 0, 0, 0]);
  });

  it('serves valid names only', () => {
    const good = ['dailyReview', 'memoryRecord', 'fsrsShadow', 'pack.k-food', 'game.cloze_pick', 'pack.a1'];
    const bad = ['', 'DailyReview', '__proto__', 'pack.', 'pack.K-Food', 'a.b.c', 'daily review', 'pack.-x', `a${'b'.repeat(60)}`];
    for (const name of good) expect(REMOTE_FLAG_NAME.test(name), name).toBe(true);
    for (const name of bad) expect(REMOTE_FLAG_NAME.test(name), name).toBe(false);
    expect(publicFlags([row('dailyReview', true, 5), row('__proto__', true, 100), row('Bad Name', true, 100)])).toEqual({ dailyReview: { on: true, pct: 5 } });
  });

  it('the table refuses a value outside the rules (CHECK), so a console typo never reaches a device', async () => {
    const d1 = openSqliteD1();
    const put = (flag: string, on: unknown, pct: unknown) => d1.prepare('INSERT INTO remote_config (flag, "on", pct, updated_at, reason) VALUES (?, ?, ?, ?, ?)').bind(flag, on, pct, T, null).run();
    await expect(put('dailyReview', 2, 50)).rejects.toThrow(/CHECK/i);
    await expect(put('mastery', 1, 250)).rejects.toThrow(/CHECK/i);
    await expect(put('goals', 1, -3)).rejects.toThrow(/CHECK/i);
    await put('volumes', 1, 100);
    await put('cellCheck', 0, 0);
    const r = await get('/api/config', {}, { DB: d1 });
    expect(r.body.data).toEqual({ flags: { cellCheck: { on: false, pct: 0 }, volumes: { on: true, pct: 100 } } });
    d1.close();
  });

  it('a stored value outside the rules (a database without the CHECK) reads toward off', async () => {
    const db = new MemoryDb();
    await db.putRemoteConfig({ flag: 'mastery', on: true, pct: 250, updatedAt: T, reason: null });
    await db.putRemoteConfig({ flag: 'goals', on: true, pct: -3, updatedAt: T, reason: null });
    expect(publicFlags(await db.remoteConfig())).toEqual({ goals: { on: true, pct: 0 }, mastery: { on: true, pct: 0 } });
  });
});
