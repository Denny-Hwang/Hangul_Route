import { describe, expect, it } from 'vitest';
import app from '../index';

describe('CORS on /api/* (F-CONSOLE-001 §3.1)', () => {
  it('answers preflight for an allowed origin with the headers a browser needs', async () => {
    const res = await app.request('/api/spaces/lookup', {
      method: 'OPTIONS',
      headers: { origin: 'https://hangulroute.com', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://hangulroute.com');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('authorization');
    expect(res.headers.get('access-control-max-age')).toBe('86400');
  });

  it('honours ALLOWED_ORIGINS from the environment and withholds the header otherwise', async () => {
    const env = { ALLOWED_ORIGINS: 'https://console.example' };
    const ok = await app.request('/health', { headers: { origin: 'https://console.example' } }, env);
    expect(ok.headers.get('access-control-allow-origin')).toBeNull(); // /health is outside /api/*
    const api = await app.request('/api/spaces/lookup', { method: 'OPTIONS', headers: { origin: 'https://console.example', 'access-control-request-method': 'POST' } }, env);
    expect(api.headers.get('access-control-allow-origin')).toBe('https://console.example');
    const blocked = await app.request('/api/spaces/lookup', { method: 'OPTIONS', headers: { origin: 'https://hangulroute.com', 'access-control-request-method': 'POST' } }, env);
    expect(blocked.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('allows PATCH, which the console uses to save space settings (BUG-1)', async () => {
    const res = await app.request('/api/spaces/space:abc/settings', {
      method: 'OPTIONS',
      headers: { origin: 'https://hangulroute.com', 'access-control-request-method': 'PATCH', 'access-control-request-headers': 'authorization,content-type' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://hangulroute.com');
    expect(allowedMethods(res)).toContain('PATCH');
  });

  it('passes preflight for every method of every registered /api route', async () => {
    const routes = new Map<string, { method: string; path: string }>();
    for (const r of app.routes) {
      if (r.method === 'ALL' || !r.path.startsWith('/api/')) continue; // middleware, or outside the CORS scope
      const path = r.path.replace(/:[^/]+/g, 'x').replace(/\*/g, 'x');
      routes.set(`${r.method} ${path}`, { method: r.method, path });
    }
    // Sanity: the walk sees the real surface, PATCH included (any verb missing from allowMethods fails below).
    expect(routes.size).toBeGreaterThan(20);
    expect(new Set([...routes.values()].map((r) => r.method))).toContain('PATCH');

    for (const { method, path } of routes.values()) {
      const res = await app.request(path, {
        method: 'OPTIONS',
        headers: { origin: 'https://app.hangulroute.com', 'access-control-request-method': method, 'access-control-request-headers': 'authorization,content-type' },
      });
      expect(res.status, `${method} ${path}`).toBe(204);
      expect(res.headers.get('access-control-allow-origin'), `${method} ${path}`).toBe('https://app.hangulroute.com');
      expect(allowedMethods(res), `${method} ${path}`).toContain(method);
    }
  });
});

function allowedMethods(res: Response): string[] {
  return (res.headers.get('access-control-allow-methods') ?? '').split(',').map((m) => m.trim().toUpperCase());
}
