import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { store } from '../store';

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
  // SEC-3: unauthenticated reads of in-memory data, and the v1 family / profile / progress surface.
  ['POST', '/api/auth/family'],
  ['GET', '/api/auth/family/family:x'],
  ['GET', '/api/profiles?familyId=family:x'],
  ['POST', '/api/profiles'],
  ['GET', '/api/profiles/profile:x'],
  ['DELETE', '/api/profiles/profile:x'],
  ['GET', '/api/progress/profile:x'],
  ['PUT', '/api/progress/profile:x'],
  ['GET', '/api/cards/profile:x/unlocked'],
  ['GET', '/api/notifications/queue'],
  ['POST', '/api/notifications/parent/streak-milestone'],
  ['GET', '/api/telemetry/recent'],
  ['GET', '/api/telemetry/recent?limit=500'],
];

describe('legacy v1 routes are gone', () => {
  beforeEach(() => {
    // Data the old routes would have handed out (several without any auth).
    store.reset();
    const at = '2026-10-01T00:00:00.000Z';
    store.families.set('family:x', { id: 'family:x', email: 'parent@example.com', parentPinHash: 'pinhash', ownerId: 'user_owner', createdAt: at });
    store.profiles.set('profile:x', { id: 'profile:x', familyId: 'family:x', displayName: 'Mina', ageGroup: '5-7', avatar: 'hoya', createdAt: at, lastActiveAt: at });
    store.progress.set('profile:x', { profileId: 'profile:x', updatedAt: at, payload: { cards: [{ cardId: 'card:tiger', unlockedAt: at }] } });
    store.events.push({ id: 'event:1', name: 'session.start', profileId: 'profile:x', at });
  });

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

describe('what shipped clients still use stays mounted', () => {
  it('POST /api/telemetry (apps/mobile/src/platform/telemetry.ts)', async () => {
    const res = await app.request('/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'session.start' }) });
    expect(res.status).toBe(201);
  });

  it('the static catalogs (no stored data behind them)', async () => {
    for (const path of ['/api/cards/catalog', '/api/content/jamo', '/api/content/stages', '/api/content/themes']) {
      expect((await app.request(path)).status, path).toBe(200);
    }
  });
});
