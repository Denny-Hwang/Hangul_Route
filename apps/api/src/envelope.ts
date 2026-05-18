import type { Context } from 'hono';

export interface ApiMeta {
  serverTime: string;
  version: string;
}

const VERSION = '0.1.0';

export function ok<T>(c: Context, data: T, status: 200 | 201 = 200): Response {
  return c.json({ ok: true, data, meta: meta() }, status);
}

export function fail(
  c: Context,
  code: string,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 422 | 500 = 400,
  details?: Record<string, unknown>,
): Response {
  return c.json({ ok: false, error: { code, message, details }, meta: meta() }, status);
}

function meta(): ApiMeta {
  return { serverTime: new Date().toISOString(), version: VERSION };
}
