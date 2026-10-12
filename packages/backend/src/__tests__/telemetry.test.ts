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

  it('accepts the five F-ENT-003 names with their payloads (Worker first, E3-1b)', async () => {
    const events: Array<[string, Record<string, unknown>]> = [
      ['access.preview_opened', { stage: 'stage2', theme: 'life', from: 'journey' }],
      ['access.help_asked', { from: 'episode', audience: 'family' }],
      ['access.free_end_reached', { freeDays: 5, placedOut: false }],
      ['route.next_started', { source: 'class', surface: 'home' }],
      ['route.offplan_finished', { source: 'self', stage: 'stage1' }],
    ];
    for (const [name, payload] of events) {
      expect((await post({ name, profileId: 'profile:a', payload })).status, name).toBe(201);
    }
    expect(store.events.map((e) => [e.name, e.payload])).toEqual(events);
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

  it('keeps a client time a little ahead (clock skew) or weeks old (offline queue)', async () => {
    for (const at of ['2026-10-09T12:04:59.000Z', '2026-09-09T12:00:01.000Z']) {
      expect((await post({ name: 'session.start', at })).body.data?.event.at, at).toBe(at);
    }
  });

  it('falls back to the server time when the client time is implausible (> 5 min ahead or > 30 days old)', async () => {
    for (const at of ['2026-10-09T12:05:01.000Z', '2099-01-01T00:00:00Z', '2026-09-09T11:59:59.000Z', '1970-01-01T00:00:00Z']) {
      const r = await post({ name: 'session.start', at });
      expect(r.status).toBe(201);
      expect(r.body.data?.event.at, at).toBe(NOW.toISOString());
    }
  });

  it('drops a non-string profile id and a non-object payload instead of rejecting the event', async () => {
    const r = await post({ name: 'session.end', profileId: 7, payload: 'nope' });
    expect(r.status).toBe(201);
    expect(r.body.data?.event.profileId).toBeUndefined();
    expect(r.body.data?.event.payload).toBeUndefined();
    expect((await post({ name: 'session.end', payload: [1, 2] })).body.data?.event.payload).toBeUndefined();
  });

  it('F-SPACE-002 4.12: space.transfer.* keep only initiator, slot and basis with known values, and never a profile id', async () => {
    const r = await post({
      name: 'space.transfer.consented',
      profileId: 'profile:suni',
      payload: { initiator: 'learner_side', slot: 'learner', basis: 'caregiver', learnerId: 'profile:suni', spaceId: 'space:class-a', name: 'Suni' },
    });
    expect(r.status).toBe(201);
    expect(r.body.data?.event.profileId).toBeUndefined();
    expect(r.body.data?.event.payload).toEqual({ initiator: 'learner_side', slot: 'learner', basis: 'caregiver' });
    // an identifier smuggled into an allowed key is dropped too
    const smuggled = await post({ name: 'space.transfer.requested', payload: { initiator: 'space:class-a', slot: 7 } });
    expect(smuggled.status).toBe(201);
    expect(smuggled.body.data?.event.payload).toBeUndefined();
    // other events are untouched
    expect((await post({ name: 'space.join.failed', profileId: 'profile:suni', payload: { code: 'x' } })).body.data?.event).toMatchObject({ profileId: 'profile:suni', payload: { code: 'x' } });
  });

  it('F-APP-001 3.18: shell.* keep only their documented codes, and never a profile id', async () => {
    const chosen = await post({ name: 'shell.persona_chosen', profileId: 'profile:suni', payload: { persona: 'parent', from: 'welcome-continue', learnerId: 'profile:suni' } });
    expect(chosen.status).toBe(201);
    expect(chosen.body.data?.event.profileId).toBeUndefined();
    expect(chosen.body.data?.event.payload).toEqual({ persona: 'parent', from: 'welcome-continue' });
    const handoff = await post({ name: 'shell.grown_up_handoff', payload: { via: 'lock', target: 'next', next: '/teach/space?id=space:a' } });
    expect(handoff.body.data?.event.payload).toEqual({ via: 'lock', target: 'next' });
    const bounced = await post({ name: 'shell.path_bounced', profileId: 'profile:suni', payload: { prefix: 'teach' } });
    expect(bounced.body.data?.event).toMatchObject({ payload: { prefix: 'teach' } });
    expect(bounced.body.data?.event.profileId).toBeUndefined();
    // an identifier smuggled into an allowed key is dropped too
    const smuggled = await post({ name: 'shell.path_bounced', payload: { prefix: '/teach/space?id=space:a', persona: 'parent' } });
    expect(smuggled.status).toBe(201);
    expect(smuggled.body.data?.event.payload).toBeUndefined();
  });

  it('F-REPORT-001 3.10: report.* keep only scope, space and period with their enum values, and never a profile id (RP-W1)', async () => {
    const viewed = await post({
      name: 'report.viewed',
      profileId: 'profile:suni',
      payload: { scope: 'learner', space: 'device', period: 'month', learnerId: 'profile:suni', spaceId: 'space:family-a', name: 'Suni', at: '2026-10-05' },
    });
    expect(viewed.status).toBe(201);
    expect(viewed.body.data?.event.profileId).toBeUndefined();
    expect(viewed.body.data?.event.payload).toEqual({ scope: 'learner', space: 'device', period: 'month' });
    expect(store.events.at(-1)).toMatchObject({ name: 'report.viewed', payload: { scope: 'learner', space: 'device', period: 'month' } });
    expect(store.events.at(-1)?.profileId).toBeUndefined();
    // every documented value passes
    for (const payload of [
      { scope: 'class', space: 'class', period: 'day' },
      { scope: 'learner', space: 'family', period: 'week' },
      { scope: 'learner', space: 'class', period: 'all' },
    ]) {
      expect((await post({ name: 'report.viewed', payload })).body.data?.event.payload).toEqual(payload);
    }
    // an identifier smuggled into an allowed key, or a value off the enum, is dropped
    const smuggled = await post({ name: 'report.viewed', profileId: 'profile:suni', payload: { scope: 'profile:suni', space: 'space:class-a', period: 'year' } });
    expect(smuggled.status).toBe(201);
    expect(smuggled.body.data?.event.payload).toBeUndefined();
    expect(smuggled.body.data?.event.profileId).toBeUndefined();
    const partial = await post({ name: 'report.viewed', payload: { scope: 'class', space: 7, period: ['week'] } });
    expect(partial.body.data?.event.payload).toEqual({ scope: 'class' });
    // other events are untouched
    expect((await post({ name: 'route_map.viewed', profileId: 'profile:suni', payload: { scope: 'x' } })).body.data?.event).toMatchObject({ profileId: 'profile:suni', payload: { scope: 'x' } });
  });

  it('caps the in-memory log at 10k events', async () => {
    store.events = Array.from({ length: 10_000 }, (_, i) => ({ id: `event:${i}`, name: 'session.start', at: NOW.toISOString() }));
    await post({ name: 'session.end' });
    expect(store.events).toHaveLength(10_000);
    expect(store.events[0]?.id).toBe('event:1');
    expect(store.events.at(-1)?.name).toBe('session.end');
  });
});
