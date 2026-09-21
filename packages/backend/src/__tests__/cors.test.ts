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
});
