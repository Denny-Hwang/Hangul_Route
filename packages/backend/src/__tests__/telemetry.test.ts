import { TELEMETRY_EVENT_NAMES } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { store } from '../store';

/**
 * POST /api/telemetry — the one legacy v1 route a shipped client calls
 * (apps/mobile/src/platform/telemetry.ts). Audit SEC-3: accept every name
 * the app sends and keep the client's timestamp (offline-queued events
 * arrive late, F-PWA-001 §3.2).
 */
type Stored = { name: string; profileId?: string; payload?: Record<string, unknown>; at: string; receivedAt: string };
const NOW = new Date('2026-10-09T12:00:00.000Z');

async function post(body: unknown) {
  const res = await app.request('/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as { ok: boolean; data?: { event: Stored }; error?: { code: string } } };
}

beforeEach(() => {
  store.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('POST /api/telemetry', () => {
  it.each(TELEMETRY_EVENT_NAMES.map((n) => [n]))('accepts %s', async (name) => {
    expect((await post({ name })).status).toBe(201);
  });

  it('accepts the nine names that used to 422 (spaces + paywall)', async () => {
    for (const name of ['space.join.attempted', 'space.join.succeeded', 'space.join.failed', 'space.left', 'space.relink.requested', 'space.relink.approved', 'space.relink.denied', 'paywall.viewed', 'paywall.console_opened']) {
      expect((await post({ name, payload: { kind: 'class' } })).status, name).toBe(201);
    }
    expect(store.events).toHaveLength(9);
  });

  it('rejects unknown or missing event names with 422', async () => {
    for (const body of [{ name: 'unknown.event' }, { name: 'parent.notify.queued' }, {}, { name: 42 }]) {
      const r = await post(body);
      expect(r.status).toBe(422);
      expect(r.body.error?.code).toBe('bad_request');
    }
    expect(store.events).toHaveLength(0);
  });

  it('keeps the client timestamp of an event queued offline, and records when it arrived', async () => {
    const r = await post({ name: 'quest.complete', profileId: 'profile:a', payload: { questId: 'quest:x' }, at: '2026-10-08T23:59:30.250Z' });
    expect(r.status).toBe(201);
    expect(r.body.data?.event).toMatchObject({ name: 'quest.complete', profileId: 'profile:a', payload: { questId: 'quest:x' }, at: '2026-10-08T23:59:30.250Z', receivedAt: NOW.toISOString() });
    expect(store.events.at(-1)).toMatchObject({ at: '2026-10-08T23:59:30.250Z', receivedAt: NOW.toISOString() });
  });

  it('normalises an offset timestamp to UTC ISO', async () => {
    expect((await post({ name: 'session.start', at: '2026-10-09T09:00:00+09:00' })).body.data?.event.at).toBe('2026-10-09T00:00:00.000Z');
  });

  it('falls back to the server time when the client timestamp is missing or unusable', async () => {
    for (const at of [undefined, 'yesterday', '', '1', 'Oct 9 2026', '2026-10-09', '2026-10-09T10:00:00', '2026-13-45T99:99:99Z', 1696800000000, null]) {
      const r = await post({ name: 'session.start', at });
      expect(r.status).toBe(201);
      expect(r.body.data?.event.at).toBe(NOW.toISOString());
    }
  });

  it('drops a non-string profile id and a non-object payload instead of rejecting the event', async () => {
    const r = await post({ name: 'session.end', profileId: 7, payload: 'nope' });
    expect(r.status).toBe(201);
    expect(r.body.data?.event.profileId).toBeUndefined();
    expect(r.body.data?.event.payload).toBeUndefined();
    expect((await post({ name: 'session.end', payload: [1, 2] })).body.data?.event.payload).toBeUndefined();
  });

  it('caps the in-memory log at 10k events', async () => {
    store.events = Array.from({ length: 10_000 }, (_, i) => ({ id: `event:${i}`, name: 'session.start', at: NOW.toISOString() }));
    await post({ name: 'session.end' });
    expect(store.events).toHaveLength(10_000);
    expect(store.events[0]?.id).toBe('event:1');
    expect(store.events.at(-1)?.name).toBe('session.end');
  });
});
