import { describe, expect, it } from 'vitest';
import app from '../index';

/**
 * Legacy v1 in-memory routes that no shipped client calls are unmounted
 * (audit SEC-1 / SEC-3). Each must answer the 404 envelope, whoever asks.
 */
const UNMOUNTED: ReadonlyArray<readonly [string, string]> = [
  // SEC-1: the receipt-stub subscription path (and the rest of that router).
  ['POST', '/api/subscriptions/family:x/verify'],
  ['GET', '/api/subscriptions/family:x'],
  ['PUT', '/api/subscriptions/family:x'],
  ['POST', '/api/subscriptions/family:x/event'],
];

describe('legacy v1 routes are gone', () => {
  it.each(UNMOUNTED)('%s %s → 404', async (method, path) => {
    const res = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json', authorization: 'Bearer user_owner' },
      body: method === 'GET' ? undefined : JSON.stringify({ store: 'apple', receipt: JSON.stringify({ plan: 'yearly', expiresAt: '2099-01-01T00:00:00.000Z' }) }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: 'not_found' } });
  });
});
