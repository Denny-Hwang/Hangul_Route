import { describe, expect, it, vi } from 'vitest';
import { accountApiBase, accountUrl, createAccountApi, type FetchLike } from '../api';

/**
 * F-AUTH-004 sections 8.1, 8.8 and 11 (row NS-2; CS-N8): the native account client. The `X-HR-Client: native` header,
 * a fresh token per call, no cache, an `https` base only, the learner's sync and restore paths refused, and a null
 * token short-circuits to `unauthorized` with no request.
 */

const BASE = 'https://api.hangulroute.com';

function answer(status: number, body: unknown, extra: { url?: string; type?: ResponseType } = {}) {
  return { status, url: extra.url ?? '', type: extra.type ?? ('basic' as ResponseType), json: async () => body };
}

function client(over: { fetch?: FetchLike; token?: () => Promise<string | null>; base?: string; dev?: boolean } = {}) {
  const fetch = vi.fn(over.fetch ?? (async (url: string) => answer(200, { data: { ok: url } }, { url })));
  let n = 0;
  const getToken = vi.fn(over.token ?? (async () => `token-${(n += 1)}`));
  const api = createAccountApi({ baseUrl: over.base ?? BASE, dev: over.dev ?? false, getToken, fetch });
  return { api, fetch, getToken };
}

describe('the base: https only (a development build may use http://localhost)', () => {
  it('accepts an https origin, with or without a trailing slash', () => {
    expect(accountApiBase(BASE, false)).toBe(BASE);
    expect(accountApiBase(`${BASE}/`, false)).toBe(BASE);
  });

  it('refuses http, a path, a user, a query, a fragment, spaces or nothing', () => {
    for (const raw of [undefined, '', 'http://api.hangulroute.com', `${BASE}/v1`, 'https://u:p@api.hangulroute.com', `${BASE}?x=1`, `${BASE}#x`, ` ${BASE}`, 'not a url', 'ftp://x.com']) {
      expect(accountApiBase(raw, false), String(raw)).toBeNull();
    }
  });

  it('http://localhost only in a development build', () => {
    expect(accountApiBase('http://localhost:8787', true)).toBe('http://localhost:8787');
    expect(accountApiBase('http://127.0.0.1:8787', true)).toBe('http://127.0.0.1:8787');
    expect(accountApiBase('http://localhost:8787', false)).toBeNull();
    expect(accountApiBase('http://192.168.0.2:8787', true)).toBeNull();
  });

  it('a refused base sends nothing', async () => {
    const { api, fetch, getToken } = client({ base: 'http://api.hangulroute.com' });
    expect(await api.spaces()).toEqual({ ok: false, error: 'refused', status: 0 });
    expect(fetch).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });
});

describe('paths: an allow list of account paths of the base; never sync, recovery or money (CS-N8)', () => {
  it('builds the account paths on the base origin', () => {
    expect(accountUrl(BASE, '/api/spaces')).toBe(`${BASE}/api/spaces`);
    expect(accountUrl(BASE, '/api/spaces/space%3Aa/roster')).toBe(`${BASE}/api/spaces/space%3Aa/roster`);
    expect(accountUrl(BASE, '/api/spaces/s/learners/l/report?period=week')).toBe(`${BASE}/api/spaces/s/learners/l/report?period=week`);
    expect(accountUrl(BASE, '/api/billing/summary?view=status')).toBe(`${BASE}/api/billing/summary?view=status`);
    // Row NS-6: the class report's past window, a day key after the period.
    expect(accountUrl(BASE, '/api/spaces/s/class-report?period=week&at=2026-11-01')).toBe(`${BASE}/api/spaces/s/class-report?period=week&at=2026-11-01`);
  });

  it('refuses every other route, money routes included, and any other query', () => {
    for (const path of [
      '/api/entitlements',
      '/api/entitlements/stripe/checkout',
      '/api/billing/receipts',
      '/api/billing/receipt-link',
      '/api/billing/summary',
      '/api/billing/summary?view=full',
      '/api/billing/summary?view=status&x=1',
      '/api/telemetry',
      '/api//sync/push',
      '/api/sync;x',
      '/api/spaces;x',
      '/api/spaces//roster',
      '/api/spaces?debug=1',
      '/api/spaces/s/class-report?period=year',
      '/api/spaces/s/class-report?at=2026-11-01',
      '/api/spaces/s/class-report?period=week&at=soon',
      '/api/spaces/s/class-report?period=week&at=2026-11-01&x=1',
      '/api/spaces/s/class-report?period=week&at=2026-11-01T00:00',
      '/api/spaces/s/class-report?period=week&learner=l',
      '/api/spaces/s/roster?period=week&at=2026-11-01',
      '/api/spaces/s/learners/l/report?period=week&at=2026-11-01',
      '/api/spaces/s/class-report/x?period=week&at=2026-11-01',
      '/api/spaces/%2e%2e/billing/receipts',
    ]) {
      expect(accountUrl(BASE, path), path).toBeNull();
    }
  });

  it('refuses sync and recovery, in any spelling', () => {
    for (const path of [
      '/api/sync',
      '/api/sync/learners',
      '/api/SYNC/x',
      '/api/recovery/issue',
      '/api/spaces/../sync/x',
      '/api/spaces/%2e%2e/sync/x',
      '/api/spaces/%2E%2E/recovery',
      '/api/%73ync/x',
      '/api/spaces%2F..%2Fsync',
    ]) {
      expect(accountUrl(BASE, path), path).toBeNull();
    }
  });

  it('refuses anything that is not an /api/ path of this origin', () => {
    for (const path of ['/health', 'api/spaces', '//evil.example/api/spaces', 'https://evil.example/api/spaces', '/api/spaces#x', '/api\\spaces', '/api/%E0%A4%A']) {
      expect(accountUrl(BASE, path), path).toBeNull();
    }
  });

  it('a refused path sends nothing', async () => {
    const { api, fetch, getToken } = client();
    expect(await api.request('GET', '/api/sync/learners')).toEqual({ ok: false, error: 'refused', status: 0 });
    expect(await api.request('POST', '/api/recovery/issue')).toEqual({ ok: false, error: 'refused', status: 0 });
    expect(fetch).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });

  it('ids are encoded, and `.` or `..` ids are refused', async () => {
    const { api, fetch } = client();
    await api.roster('space:a b/c');
    expect(fetch.mock.calls[0]![0]).toBe(`${BASE}/api/spaces/space%3Aa%20b%2Fc/roster`);
    expect(await api.roster('..')).toEqual({ ok: false, error: 'refused', status: 0 });
    expect(await api.learnerReport('space:a', '.', 'week')).toEqual({ ok: false, error: 'refused', status: 0 });
    expect(await api.school('')).toEqual({ ok: false, error: 'refused', status: 0 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('every request', () => {
  it('a fresh token per call, the native header, no cache, no cookies, no redirects followed', async () => {
    const { api, fetch, getToken } = client();
    await api.spaces();
    await api.planStatus();
    expect(getToken).toHaveBeenCalledTimes(2);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(`${BASE}/api/spaces`);
    expect(init).toEqual({
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: 'Bearer token-1', 'Cache-Control': 'no-store', 'X-HR-Client': 'native' },
      cache: 'no-store',
      redirect: 'manual',
      credentials: 'omit',
    });
    expect((fetch.mock.calls[1]![1].headers as Record<string, string>).Authorization).toBe('Bearer token-2');
  });

  it('the named calls', async () => {
    const { api, fetch } = client();
    await api.roster('space:f');
    await api.makeCode('space:f');
    await api.learnerReport('space:f', 'learner:1', 'week');
    await api.classReport('space:c', 'all');
    // Row NS-6: a past window travels as `at` (a day key only, and never with `all`).
    await api.classReport('space:c', 'week', '2026-11-01');
    await api.classReport('space:c', 'all', '2026-11-01');
    await api.classReport('space:c', 'month', 'nope');
    await api.classReport('space:c', 'day', null);
    await api.school('space:s');
    await api.planStatus();
    expect(fetch.mock.calls.map(([url, init]) => `${init.method} ${url.replace(BASE, '')}`)).toEqual([
      'GET /api/spaces/space%3Af/roster',
      'POST /api/spaces/space%3Af/code',
      'GET /api/spaces/space%3Af/learners/learner%3A1/report?period=week',
      'GET /api/spaces/space%3Ac/class-report?period=all',
      'GET /api/spaces/space%3Ac/class-report?period=week&at=2026-11-01',
      'GET /api/spaces/space%3Ac/class-report?period=all',
      'GET /api/spaces/space%3Ac/class-report?period=month',
      'GET /api/spaces/space%3Ac/class-report?period=day',
      'GET /api/spaces/space%3As/school',
      'GET /api/billing/summary?view=status',
    ]);
  });

  it('no token (signed out mid-flight): unauthorized, and no request leaves', async () => {
    const { api, fetch } = client({ token: async () => null });
    expect(await api.spaces()).toEqual({ ok: false, error: 'unauthorized', status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('a token call that fails for the network is offline, never a sign-out (section 8.8)', async () => {
    const { api, fetch } = client({
      token: async () => {
        throw Object.assign(new Error('Network request failed'), { code: 'network_error' });
      },
    });
    expect(await api.spaces()).toEqual({ ok: false, error: 'offline', status: -1 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('a token call that throws for another reason is an error, never a sign-out', async () => {
    const { api, fetch } = client({
      token: async () => {
        throw new Error('network');
      },
    });
    expect(await api.spaces()).toEqual({ ok: false, error: 'error', status: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('answers (section 8.8)', () => {
  const run = async (status: number, body: unknown, extra: { url?: string; type?: ResponseType } = {}) =>
    client({ fetch: async () => answer(status, body, extra) }).api.spaces();

  it('the data of a 2xx envelope', async () => {
    expect(await run(200, { data: { spaces: [] } })).toEqual({ ok: true, data: { spaces: [] } });
    expect(await run(200, { data: { spaces: [] } }, { url: `${BASE}/api/spaces` })).toEqual({ ok: true, data: { spaces: [] } });
  });

  it('401 is unauthorized; 403 native_off is the Worker switch; any other 403 is forbidden; 404 not found', async () => {
    expect(await run(401, { error: { code: 'unauthorized' } })).toEqual({ ok: false, error: 'unauthorized', status: 401 });
    expect(await run(403, { error: { code: 'native_off' } })).toEqual({ ok: false, error: 'native_off', status: 403 });
    expect(await run(403, { error: { code: 'forbidden' } })).toEqual({ ok: false, error: 'forbidden', status: 403 });
    expect(await run(404, null)).toEqual({ ok: false, error: 'not_found', status: 404 });
  });

  it('a 5xx, a 2xx without data or a body that is not JSON is an error', async () => {
    expect(await run(500, { error: { code: 'internal' } })).toEqual({ ok: false, error: 'error', status: 500 });
    expect(await run(200, { nope: 1 })).toEqual({ ok: false, error: 'error', status: 200 });
    const notJson = client({ fetch: async () => ({ status: 200, url: '', type: 'basic' as ResponseType, json: async () => Promise.reject(new Error('bad json')) }) });
    expect(await notJson.api.spaces()).toEqual({ ok: false, error: 'error', status: 200 });
  });

  it('a redirect, or an answer from another URL, is an error', async () => {
    expect(await run(302, null)).toEqual({ ok: false, error: 'error', status: 302 });
    expect(await run(0, null, { type: 'opaqueredirect' })).toEqual({ ok: false, error: 'error', status: 0 });
    expect(await run(200, { data: {} }, { url: 'https://evil.example/api/spaces' })).toEqual({ ok: false, error: 'error', status: 200 });
    expect(await run(200, { data: {} }, { url: `${BASE}/api/other` })).toEqual({ ok: false, error: 'error', status: 200 });
    expect(await run(200, { data: {} }, { url: 'not a url' })).toEqual({ ok: false, error: 'error', status: 200 });
  });

  it('a fetch that throws is offline', async () => {
    const { api } = client({
      fetch: async () => {
        throw new TypeError('Network request failed');
      },
    });
    expect(await api.spaces()).toEqual({ ok: false, error: 'offline', status: -1 });
  });
});
