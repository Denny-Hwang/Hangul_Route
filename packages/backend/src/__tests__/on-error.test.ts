import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { waitlistLimiter } from '../routes/waitlist';
import { testDb } from './helpers/db';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-2 (audit PROD-1): an error a route does not handle answers the standard 500
 * envelope and writes one structured line to the log, with nothing of the request in it.
 */
type Envelope = { ok: boolean; error?: { code: string; message: string }; meta?: { serverTime: string } };

const SECRET_EMAIL = 'private.person@example.com';

async function signUp(headers: Record<string, string> = {}) {
  const res = await app.request('/api/waitlist', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.9', ...headers },
    body: JSON.stringify({ email: SECRET_EMAIL }),
  });
  return { res, status: res.status, text: await res.text() };
}

describe('app.onError', () => {
  let logged: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    waitlistLimiter.reset();
    logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers 500 with the code `internal` in the standard envelope, and never the error text', async () => {
    vi.spyOn(testDb, 'addWaitlist').mockRejectedValue(new Error(`D1_ERROR: write failed for ${SECRET_EMAIL}`));
    const r = await signUp();
    expect(r.status).toBe(500);
    const body = JSON.parse(r.text) as Envelope;
    expect(body).toMatchObject({ ok: false, error: { code: 'internal', message: 'Something went wrong' } });
    expect(typeof body.meta?.serverTime).toBe('string');
    expect(r.text).not.toContain('D1_ERROR');
    expect(r.text).not.toContain(SECRET_EMAIL);
  });

  it('logs once: one JSON line with the route pattern, method, error class and scrubbed message', async () => {
    vi.spyOn(testDb, 'addWaitlist').mockRejectedValue(new TypeError(`write failed for ${SECRET_EMAIL} on space:ab12cd34ef56`));
    await signUp();
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0]).toHaveLength(1);
    const line = logged.mock.calls[0]?.[0] as string;
    expect(JSON.parse(line)).toEqual({ event: 'api.error', method: 'POST', route: '/api/waitlist', errorName: 'TypeError', message: 'write failed for [email] on [id]' });
    expect(line).not.toContain(SECRET_EMAIL);
    expect(line).not.toContain('198.51.100.9');
  });

  it('logs the route pattern, never the path with its ids', async () => {
    vi.spyOn(testDb, 'getSpace').mockRejectedValue(new Error('boom'));
    const res = await app.request('/api/spaces/space:ab12cd34ef56/learning-summary', { headers: { authorization: 'Bearer user_mom' } });
    expect(res.status).toBe(500);
    expect(logged).toHaveBeenCalledTimes(1);
    const line = logged.mock.calls[0]?.[0] as string;
    expect(JSON.parse(line)).toMatchObject({ method: 'GET', route: '/api/spaces/:id/learning-summary', errorName: 'Error', message: 'boom' });
    expect(line).not.toContain('ab12cd34ef56');
    expect(line).not.toContain('user_mom');
  });

  it('keeps the CORS header on the 500, so the browser can read the envelope', async () => {
    vi.spyOn(testDb, 'addWaitlist').mockRejectedValue(new Error('boom'));
    const r = await signUp({ origin: 'https://hangulroute.com' });
    expect(r.status).toBe(500);
    expect(r.res.headers.get('access-control-allow-origin')).toBe('https://hangulroute.com');
  });

  it('a thrown HTTPException keeps its own response and is not logged (503 db_not_configured)', async () => {
    const res = await app.request('/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: SECRET_EMAIL }) }, { ENVIRONMENT: 'production' });
    expect(res.status).toBe(503);
    expect(((await res.json()) as Envelope).error?.code).toBe('db_not_configured');
    expect(logged).not.toHaveBeenCalled();
  });

  it('an HTTPException without a response of its own answers its status in plain text, as Hono does', async () => {
    vi.spyOn(testDb, 'addWaitlist').mockRejectedValue(new HTTPException(418, { message: 'teapot' }));
    const r = await signUp();
    expect(r.status).toBe(418);
    expect(logged).not.toHaveBeenCalled();
  });
});
