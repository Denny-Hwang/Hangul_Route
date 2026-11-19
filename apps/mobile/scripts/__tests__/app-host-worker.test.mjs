// AMENDMENTS-FINISH-2026-11 FN-3: the app host answers a missing app chunk with 404, so the chunks carry a year-long
// cache. The Worker (wrangler.toml `main`) runs only for misses that are not navigations; these tests drive it with a
// stand-in assets binding, check the wrangler config that puts it behind the assets, and the `_headers` rules.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import worker from '../app-host/worker.mjs';
import { CHUNK_NOT_FOUND_HEADERS, CHUNK_PREFIX, chunkNotFound, isChunkPath } from '../app-host/chunk-not-found.mjs';
import { headersFor, parseHeaders } from '../app-host/headers.mjs';
import { nosniffLessonChunks } from '../pwa/lesson-chunks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..', '..');
const YEAR = 'public, max-age=31536000, immutable';

function assets() {
  return { fetch: vi.fn(async () => new Response('<html>learner shell</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })) };
}

describe('the app host Worker', () => {
  it('answers a chunk the host does not have with 404, never the shell', async () => {
    const env = { ASSETS: assets() };
    for (const path of ['/_expo/static/js/web/index-ffffffffffffffffffffffffffffffff.js', '/_expo/static/js/web/lessons-cell-stage1-letters-0123.js', '/_expo/static/js/']) {
      const res = await worker.fetch(new Request(`https://app.hangulroute.com${path}`), env);
      expect(res.status, path).toBe(404);
      expect(await res.text()).toBe('Not found\n');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    }
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it('hands every other miss back to the assets (their single-page fallback answers it as before)', async () => {
    const env = { ASSETS: assets() };
    for (const path of ['/journey', '/data/missing.json', '/_next/static/chunks/gone.js', '/_expo/static/jsx/a.js', '/assets/assets/audio/gone.mp3']) {
      const request = new Request(`https://app.hangulroute.com${path}`);
      const res = await worker.fetch(request, env);
      expect(res.status, path).toBe(200);
      expect(env.ASSETS.fetch).toHaveBeenLastCalledWith(request);
    }
  });

  it('gives the 404 the baseline headers of every path (a Worker response does not get the _headers rules)', () => {
    const rules = parseHeaders(readFileSync(join(app, 'public', '_headers'), 'utf8'));
    const all = rules.find((rule) => rule.pattern === '/*');
    expect(all).toBeDefined();
    const sent = Object.fromEntries(CHUNK_NOT_FOUND_HEADERS.map(([name, value]) => [name.toLowerCase(), value]));
    for (const [name, value] of all.headers) expect(sent[name.toLowerCase()], name).toBe(value);
    expect(chunkNotFound().status).toBe(404);
  });

  it('sees through encoded and dotted paths', () => {
    expect(CHUNK_PREFIX).toBe('/_expo/static/js/');
    expect(isChunkPath('/_expo/static/js/web/a.js')).toBe(true);
    expect(isChunkPath('/x/..%2F_expo%2Fstatic%2Fjs%2Fweb%2Fa.js')).toBe(true);
    expect(isChunkPath('/_expo/static/js/x/../../../index.html')).toBe(false);
    expect(isChunkPath('/%E0%A4%A')).toBe(false);
    expect(isChunkPath('/_expo/static/json')).toBe(false);
  });
});

describe('wrangler.toml puts the Worker behind the static assets', () => {
  const toml = readFileSync(join(app, 'wrangler.toml'), 'utf8');
  const line = (key) => new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm').exec(toml)?.[1]?.trim();

  it('names the Worker and binds the assets for it', () => {
    expect(line('main')).toBe('"scripts/app-host/worker.mjs"');
    expect(line('binding')).toBe('"ASSETS"');
    expect(line('directory')).toBe('"./dist"');
  });

  it('keeps the single-page fallback for navigations, which the assets layer answers before the Worker', () => {
    expect(line('not_found_handling')).toBe('"single-page-application"');
    expect(line('html_handling')).toBe('"auto-trailing-slash"');
    // assets_navigation_prefers_asset_serving is on by default from 2025-04-01, and nothing turns it off.
    expect(line('compatibility_date') >= '"2025-04-01"').toBe(true);
    expect(toml).not.toMatch(/assets_navigation_has_no_effect/);
    // The Worker never runs ahead of the assets: real files and navigations never cost an invocation.
    expect(toml).not.toMatch(/^\s*run_worker_first/m);
  });
});

describe('public/_headers caches the app chunks for a year (FN-3)', () => {
  const rules = parseHeaders(readFileSync(join(app, 'public', '_headers'), 'utf8'));

  it('sends exactly one Cache-Control, the year-long one, on every chunk', () => {
    for (const path of ['/_expo/static/js/web/index-797f0ad5d73d98fe02cee11b578fa71c.js', '/_expo/static/js/web/lessons-headers-en-0123456789abcdef0123456789abcdef.js']) {
      expect(headersFor(rules, path)['cache-control'], path).toBe(YEAR);
    }
  });

  it('keeps nosniff off the chunks (the new-build reload check) and the shell revalidating', () => {
    expect(nosniffLessonChunks(readFileSync(join(app, 'public', '_headers'), 'utf8'), ['_expo/static/js/web/a.js'])).toEqual([]);
    expect(headersFor(rules, '/_expo/static/js/web/a.js')['x-content-type-options']).toBeUndefined();
    expect(headersFor(rules, '/index.html')['cache-control']).toBe('no-cache');
    expect(headersFor(rules, '/journey')['cache-control']).toBeUndefined();
  });
});
