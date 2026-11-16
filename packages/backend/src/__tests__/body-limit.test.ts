import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { BODY_LIMIT_BYTES, LARGE_BODY_LIMIT_BYTES, bodyLimitBytesFor } from '../lib/body-limit';
import { testDb as db } from './helpers/db';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-16 (audit SEC-6): every route refuses a body over its cap with 413 in the
 * standard error envelope: 256 KB by default, 2 MB for the snapshot upload and the Stripe webhook.
 */
type Envelope = { ok: boolean; error?: { code: string; message: string; details?: Record<string, unknown> }; meta?: { serverTime: string } };
const json = { 'content-type': 'application/json' };

/** A JSON body of exactly `bytes` bytes. */
const bodyOf = (bytes: number): string => {
  const shell = JSON.stringify({ name: 'session.start', payload: { pad: '' } });
  return JSON.stringify({ name: 'session.start', payload: { pad: 'x'.repeat(bytes - shell.length) } });
};

/** A body sent with no declared length, in 16 KB chunks; `pulled()` says how many chunks were asked for. */
function chunked(totalBytes: number) {
  let pulled = 0;
  const chunk = new TextEncoder().encode('x'.repeat(16 * 1024));
  const chunks = Math.ceil(totalBytes / chunk.byteLength);
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1;
      if (pulled > chunks) controller.close();
      else controller.enqueue(chunk);
    },
  });
  return { body, pulled: () => pulled };
}

async function send(method: string, path: string, body: BodyInit, headers: Record<string, string> = json, env?: Record<string, unknown>) {
  const res = await app.request(path, { method, headers, body, duplex: 'half' } as RequestInit, env);
  const text = await res.text();
  return { res, status: res.status, text, body: (text.startsWith('{') ? JSON.parse(text) : {}) as Envelope };
}

const TOO_LARGE = { ok: false, error: { code: 'payload_too_large', message: 'Request body is too large' } };

beforeEach(async () => {
  await db.reset();
});

describe('bodyLimitBytesFor', () => {
  it('is 256 KB by default and 2 MB for the snapshot upload and the Stripe webhook', () => {
    expect([BODY_LIMIT_BYTES, LARGE_BODY_LIMIT_BYTES]).toEqual([262_144, 2_097_152]);
    expect(bodyLimitBytesFor('POST', '/api/telemetry')).toBe(BODY_LIMIT_BYTES);
    expect(bodyLimitBytesFor('POST', '/')).toBe(BODY_LIMIT_BYTES);
    expect(bodyLimitBytesFor('PUT', '/api/sync/learners/profile:abc/snapshot')).toBe(LARGE_BODY_LIMIT_BYTES);
    expect(bodyLimitBytesFor('PUT', '/api/sync/learners/profile%3Aabc/snapshot')).toBe(LARGE_BODY_LIMIT_BYTES);
    expect(bodyLimitBytesFor('POST', '/api/entitlements/stripe/webhook')).toBe(LARGE_BODY_LIMIT_BYTES);
  });

  it('gives the larger cap to those two only: another method, a deeper path or a near miss gets the default', () => {
    for (const [method, path] of [
      ['POST', '/api/sync/learners/profile:abc/snapshot'],
      ['PUT', '/api/sync/learners/profile:abc/snapshot/extra'],
      ['PUT', '/api/sync/learners/a/b/snapshot'],
      ['PUT', '/api/sync/learners/profile:abc/note-prefs'],
      ['PUT', '/x/api/sync/learners/profile:abc/snapshot'],
      ['GET', '/api/entitlements/stripe/webhook'],
      ['POST', '/api/entitlements/stripe/webhook/x'],
      ['POST', '/api/entitlements/stripe/checkout'],
    ] as const) {
      expect(bodyLimitBytesFor(method, path), `${method} ${path}`).toBe(BODY_LIMIT_BYTES);
    }
  });

  it('leaves the memory push to its own 64 KB cap', () => {
    expect(bodyLimitBytesFor('POST', '/api/sync/learners/profile:abc/memory')).toBeNull();
    expect(bodyLimitBytesFor('GET', '/api/sync/learners/profile:abc/memory')).toBe(BODY_LIMIT_BYTES);
    expect(bodyLimitBytesFor('POST', '/api/sync/learners/profile:abc/memory/x')).toBe(BODY_LIMIT_BYTES);
  });
});

describe('the body cap on every route', () => {
  it('accepts a body of exactly 256 KB and refuses one byte more, with 413 payload_too_large in the envelope', async () => {
    const fits = bodyOf(BODY_LIMIT_BYTES);
    expect(new TextEncoder().encode(fits).byteLength).toBe(BODY_LIMIT_BYTES);
    expect((await send('POST', '/api/telemetry', fits)).status).toBe(201);
    const over = await send('POST', '/api/telemetry', bodyOf(BODY_LIMIT_BYTES + 1));
    expect(over.status).toBe(413);
    expect(over.body).toMatchObject(TOO_LARGE);
    expect(typeof over.body.meta?.serverTime).toBe('string');
  });

  it('refuses a declared Content-Length over the cap without reading the body', async () => {
    const stream = chunked(BODY_LIMIT_BYTES * 4);
    const r = await send('POST', '/api/telemetry', stream.body, { ...json, 'content-length': String(BODY_LIMIT_BYTES + 1) });
    expect(r.status).toBe(413);
    expect(r.body).toMatchObject(TOO_LARGE);
    expect(stream.pulled()).toBeLessThanOrEqual(1);
  });

  it('reads a body with no declared length only up to the cap', async () => {
    const stream = chunked(BODY_LIMIT_BYTES * 4);
    const r = await send('POST', '/api/telemetry', stream.body);
    expect(r.status).toBe(413);
    expect(r.body).toMatchObject(TOO_LARGE);
    // 256 KB is sixteen chunks; the seventeenth passes the cap (a stream may pull one ahead).
    expect(stream.pulled()).toBeLessThanOrEqual(18);
  });

  it('hands a body with no declared length under the cap to the route unchanged', async () => {
    const text = JSON.stringify({ name: 'session.start' });
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text.slice(0, 5)));
        controller.enqueue(new TextEncoder().encode(text.slice(5)));
        controller.close();
      },
    });
    expect((await send('POST', '/api/telemetry', body)).status).toBe(201);
  });

  it('covers a route outside /api, an unknown route, and answers before auth', async () => {
    const over = bodyOf(BODY_LIMIT_BYTES + 1);
    for (const [method, path] of [
      ['POST', '/'],
      ['POST', '/api/nope'],
      ['POST', '/api/spaces'],
      ['POST', '/api/spaces/lookup'],
      ['POST', '/api/recovery/claim'],
      ['POST', '/api/waitlist'],
      ['PATCH', '/api/spaces/space:a/settings'],
      ['PUT', '/api/sync/learners/profile:a/note-prefs'],
      ['DELETE', '/api/spaces/space:a/members/learner/profile:a'],
    ] as const) {
      const r = await send(method, path, over);
      expect(r.status, `${method} ${path}`).toBe(413);
      expect(r.body, `${method} ${path}`).toMatchObject(TOO_LARGE);
    }
  });

  it('keeps the CORS header on the 413, so a browser can read it', async () => {
    const r = await send('POST', '/api/telemetry', bodyOf(BODY_LIMIT_BYTES + 1), { ...json, origin: 'https://app.hangulroute.com' });
    expect(r.status).toBe(413);
    expect(r.res.headers.get('access-control-allow-origin')).toBe('https://app.hangulroute.com');
  });

  it('lets a request with no body through (GET, and a bodiless POST)', async () => {
    expect((await app.request('/health', {}, { ENVIRONMENT: 'development' })).status).toBe(200);
    expect((await app.request('/api/spaces/lookup', { method: 'POST' })).status).toBe(422);
  });
});

describe('the 2 MB routes', () => {
  it('the snapshot upload reads a body over 256 KB (here 422: not a snapshot) and refuses one over 2 MB', async () => {
    const reg = await send('POST', '/api/sync/learners', JSON.stringify({ deviceId: 'device-aaaaaaaa', learner: { id: 'profile:suni', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange' } }));
    const secret = ((JSON.parse(reg.text) as { data: { device: { secret: string } } }).data.device.secret);
    const auth = { ...json, authorization: `Device device-aaaaaaaa:${secret}` };
    const big = await send('PUT', '/api/sync/learners/profile:suni/snapshot', bodyOf(BODY_LIMIT_BYTES * 2), auth);
    expect([big.status, big.body.error?.code]).toEqual([422, 'bad_request']);
    const edge = await send('PUT', '/api/sync/learners/profile:suni/snapshot', bodyOf(LARGE_BODY_LIMIT_BYTES), auth);
    expect(edge.status).toBe(422);
    const over = await send('PUT', '/api/sync/learners/profile:suni/snapshot', bodyOf(LARGE_BODY_LIMIT_BYTES + 1), auth);
    expect(over.status).toBe(413);
    expect(over.body).toMatchObject(TOO_LARGE);
  });

  it('the Stripe webhook reads an event over 256 KB (here 400: not signed) and refuses one over 2 MB', async () => {
    const env = { STRIPE_WEBHOOK_SECRET: 'whsec_test' };
    const big = await send('POST', '/api/entitlements/stripe/webhook', bodyOf(BODY_LIMIT_BYTES * 2), { ...json, 'stripe-signature': 't=1,v1=00' }, env);
    expect([big.status, big.body.error?.code]).toEqual([400, 'bad_signature']);
    const over = await send('POST', '/api/entitlements/stripe/webhook', bodyOf(LARGE_BODY_LIMIT_BYTES + 1), { ...json, 'stripe-signature': 't=1,v1=00' }, env);
    expect(over.status).toBe(413);
  });
});

describe('routes with their own smaller cap keep it', () => {
  it('the waitlist still answers its own 413 at 2 KB', async () => {
    const r = await send('POST', '/api/waitlist', JSON.stringify({ email: 'a@example.com', pad: 'x'.repeat(4096) }), { ...json, 'cf-connecting-ip': '203.0.113.77' });
    expect(r.status).toBe(413);
    expect(r.body.error?.code).toBe('payload_too_large');
  });

  it('the memory push still answers its own 413, with the caps a device needs to split its queue', async () => {
    const reg = await send('POST', '/api/sync/learners', JSON.stringify({ deviceId: 'device-aaaaaaaa', learner: { id: 'profile:suni', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange' } }));
    const secret = ((JSON.parse(reg.text) as { data: { device: { secret: string } } }).data.device.secret);
    const r = await send('POST', '/api/sync/learners/profile:suni/memory', bodyOf(BODY_LIMIT_BYTES * 2), { ...json, authorization: `Device device-aaaaaaaa:${secret}` });
    expect(r.status).toBe(413);
    expect(Object.keys(r.body.error?.details ?? {}).sort()).toEqual(['maxBytes', 'maxShards', 'maxStates']);
  });
});
