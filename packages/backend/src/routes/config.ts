import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { dbFor, publicFlags, type PublicRemoteFlag } from '../db';
import { fail, meta } from '../envelope';

/**
 * GET /api/config: the public remote config (F-CURR-002 section 12.2, row CM-2). Public and read-only: no auth, and
 * it reads no header, cookie or query value, so it never sees who is asking and the answer is the same for every
 * caller. It serves `{ flags: { name: { on, pct } } }` and nothing else (never `reason` or `updated_at`).
 *
 * A device only ever uses it to reduce a feature: `on: false` or a lower `pct` narrows it, and a flag a build has off
 * stays off whatever this says (apps/mobile/src/config/flags.ts).
 *
 * Caching: `Cache-Control: public, max-age=300`, and on a Cloudflare zone (the custom domain) the body is also kept in
 * the edge cache under one fixed key for 300 seconds, so D1 is read about once per 5 minutes per edge location. The
 * stored copy carries no CORS header; the `/api/*` middleware adds the caller's own on every answer. For an urgent
 * off the owner purges that key (docs/launch/owner-runbook.md section K). When D1 cannot be read the answer is a 503
 * with `no-store`, so no device and no cache ever takes an outage for "no overrides"; the device keeps its last value.
 */
export const configRoutes = new Hono();

export const CONFIG_MAX_AGE_SECONDS = 300;
export const CONFIG_CACHE_CONTROL = `public, max-age=${CONFIG_MAX_AGE_SECONDS}`;
/** The path of the one edge-cache entry, whatever query string or header a request carries. */
export const CONFIG_CACHE_PATH = '/api/config';

const JSON_TYPE = 'application/json; charset=UTF-8';

/** The slice of the Workers Cache API used here (absent in tests and outside Cloudflare). */
export interface EdgeCacheLike {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
}

function edgeCache(): EdgeCacheLike | null {
  const caches = (globalThis as { caches?: { default?: EdgeCacheLike } }).caches;
  const cache = caches?.default;
  return cache && typeof cache.match === 'function' && typeof cache.put === 'function' ? cache : null;
}

/** The fixed cache key: this deployment's origin and the route path, never the request's query. */
function cacheKey(c: Context): string {
  return new URL(CONFIG_CACHE_PATH, new URL(c.req.url).origin).toString();
}

/** Hands a promise to the Worker's `waitUntil` when there is one; otherwise waits for it here. */
async function afterResponse(c: Context, work: Promise<unknown>): Promise<void> {
  let ctx: { waitUntil(p: Promise<unknown>): void } | null = null;
  try {
    ctx = c.executionCtx;
  } catch {
    ctx = null;
  }
  if (ctx) ctx.waitUntil(work.catch(() => undefined));
  else await work.catch(() => undefined);
}

function cachedAnswer(c: Context, body: string): Response {
  return c.body(body, 200, { 'Content-Type': JSON_TYPE, 'Cache-Control': CONFIG_CACHE_CONTROL });
}

configRoutes.get('/', async (c) => {
  const cache = edgeCache();
  const key = cache ? cacheKey(c) : '';
  if (cache) {
    const hit = await cache.match(key).catch(() => undefined);
    if (hit && hit.ok) {
      const text = await hit.text().catch(() => null);
      if (text) return cachedAnswer(c, text);
    }
  }

  let flags: Record<string, PublicRemoteFlag>;
  try {
    flags = publicFlags(await dbFor(c).remoteConfig());
  } catch (err) {
    // A deployment without D1 keeps its own 503 (`db_not_configured`); a failed read gets this one.
    if (err instanceof HTTPException) throw err;
    c.header('Cache-Control', 'no-store');
    return fail(c, 'config_unavailable', 'Remote config could not be read', 503);
  }

  const body = JSON.stringify({ ok: true, data: { flags }, meta: meta() });
  if (cache) {
    const stored = new Response(body, { headers: { 'Content-Type': JSON_TYPE, 'Cache-Control': CONFIG_CACHE_CONTROL } });
    await afterResponse(c, cache.put(key, stored));
  }
  return cachedAnswer(c, body);
});
