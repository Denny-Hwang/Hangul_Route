import { TELEMETRY_EVENT_NAMES, isServerOnlyTelemetryName } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { TELEMETRY_DAILY_FLUSH_MS, TELEMETRY_DAILY_WRITES_PER_MIN, flushTelemetryDaily, holdDailyCount, resetTelemetryDailyBudgetForTests } from '../lib/telemetry-daily';
import { store } from '../store';
import { testDb } from './helpers/db';

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
  // `billing.*` names are recorded by the Worker only (F-BILL-002 section 10): a client is refused below.
  it.each(TELEMETRY_EVENT_NAMES.filter((n) => !isServerOnlyTelemetryName(n)).map((n) => [n]))('accepts %s', async (name) => {
    expect((await post({ name })).status).toBe(201);
  });

  it('refuses every billing.* name from a client with 422, listed or not, and stores nothing (F-BILL-002 B-3)', async () => {
    const billing = TELEMETRY_EVENT_NAMES.filter((n) => n.startsWith('billing.'));
    expect(billing).toEqual(['billing.checkout_completed', 'billing.payment_failed', 'billing.refund_recorded', 'billing.checkout_started', 'billing.checkout_refused', 'billing.portal_opened', 'billing.summary_viewed', 'billing.receipts_viewed']);
    for (const name of [...billing, 'billing.made_up']) {
      const r = await post({ name, payload: { planKey: 'family_lifetime', mode: 'test', duplicate: false } });
      expect(r.status, name).toBe(422);
      expect(r.body.error?.code).toBe('bad_request');
    }
    expect(store.events).toHaveLength(0);
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

  it('accepts the seven F-FEEDBACK-001 notes names with their payloads (Worker first, FB-1)', async () => {
    const events: Array<[string, Record<string, unknown>]> = [
      ['notes.card_shown', { unread: 1 }],
      ['notes.list_viewed', { notes: 3, unread: 1 }],
      ['notes.note_opened', { presetId: 'progress_reading', fromRole: 'teacher', hasText: true, hasSuggest: true, suggestOpen: false }],
      ['notes.reaction_picked', { reaction: 'thanks', fromRole: 'family', changed: false }],
      ['notes.suggest_started', { fromRole: 'teacher' }],
      ['notes.report_sent', { reason: 'unkind', via: 'note_page' }],
      ['notes.prefs_changed', { classes: 'presets' }],
    ];
    for (const [name, payload] of events) {
      expect((await post({ name, payload })).status, name).toBe(201);
    }
    expect(store.events.map((e) => [e.name, e.payload])).toEqual(events);
  });

  it('never stores a profile id on a notes event, even when a client sends one (F-FEEDBACK-001 section 10)', async () => {
    const events: Array<[string, Record<string, unknown>]> = [
      ['notes.card_shown', { unread: 1 }],
      ['notes.note_opened', { presetId: 'effort_proud', fromRole: 'family', hasText: false, hasSuggest: false, suggestOpen: false }],
      ['notes.report_sent', { reason: 'other', via: 'grown_up_zone' }],
    ];
    for (const [name, payload] of events) {
      expect((await post({ name, profileId: 'profile:a', payload })).status, name).toBe(201);
    }
    expect(store.events).toHaveLength(3);
    expect(store.events.map((e) => e.profileId)).toEqual([undefined, undefined, undefined]);
    expect(store.events.map((e) => [e.name, e.payload])).toEqual(events);
    // An ordinary event still keeps the profile id it was sent with.
    await post({ name: 'session.start', profileId: 'profile:a' });
    expect(store.events.at(-1)?.profileId).toBe('profile:a');
  });

  it('stores a notes payload without note text, ids, labels or a profile id, whatever a client sends', async () => {
    const smuggled = { profileId: 'profile:a', noteId: 'note:0b7c2f9e-1d2a', spaceId: 'space:class-a', label: 'mom', text: 'Meet me after class' };
    expect((await post({ name: 'notes.reaction_picked', payload: { ...smuggled, reaction: 'thanks', fromRole: 'teacher', changed: false } })).status).toBe(201);
    expect((await post({ name: 'notes.list_viewed', payload: smuggled })).status).toBe(201);
    expect(store.events.map((e) => [e.name, e.profileId, e.payload])).toEqual([
      ['notes.reaction_picked', undefined, { reaction: 'thanks', fromRole: 'teacher', changed: false }],
      ['notes.list_viewed', undefined, undefined],
    ]);
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

  it('Learning Route section 8: accepts route_map.goal_reached and stores its payload as sent (Worker first, LR-W1)', async () => {
    const r = await post({ name: 'route_map.goal_reached', profileId: 'profile:suni', payload: { stage: 'stage2', goalFrom: 'class' } });
    expect(r.status).toBe(201);
    expect(r.body.data?.event).toMatchObject({ name: 'route_map.goal_reached', profileId: 'profile:suni', payload: { stage: 'stage2', goalFrom: 'class' } });
    expect(store.events.at(-1)?.name).toBe('route_map.goal_reached');
  });

  it('caps the in-memory log at 10k events', async () => {
    store.events = Array.from({ length: 10_000 }, (_, i) => ({ id: `event:${i}`, name: 'session.start', at: NOW.toISOString() }));
    await post({ name: 'session.end' });
    expect(store.events).toHaveLength(10_000);
    expect(store.events[0]?.id).toBe('event:1');
    expect(store.events.at(-1)?.name).toBe('session.end');
  });
});

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 15 and 15.1 (row OA-1, Worker first): the new names are accepted
 * before any client sends them, each section 15 event is stored without a profile id, and each one (plus
 * session.start) adds one to the anonymous telemetry_daily counter of its UTC day, with codes only.
 */
describe('[OA] POST /api/telemetry · section 15 names and the daily counters', () => {
  const DAY = NOW.toISOString().slice(0, 10);
  const rows = () => testDb.telemetryDailyOf(DAY);
  /** The next due flush: what the isolate's in-memory sums write a minute later. */
  const drain = () => flushTelemetryDaily(() => testDb, Date.now() + TELEMETRY_DAILY_FLUSH_MS);

  beforeEach(async () => {
    await testDb.reset();
    resetTelemetryDailyBudgetForTests();
  });

  it('accepts the seven new names and still refuses an unknown one', async () => {
    for (const name of ['who.shown', 'who.picked', 'pin.paused', 'pin.biometric_changed', 'profile.lock_changed', 'profile.removed', 'space.join.batch']) {
      expect((await post({ name })).status, name).toBe(201);
    }
    const unknown = await post({ name: 'who.peeked', payload: { kind: 'learner' } });
    expect(unknown.status).toBe(422);
    expect(unknown.body.error?.code).toBe('bad_request');
    expect(store.events).toHaveLength(7);
  });

  it('stores profile.switch and parent.gate.opened without a profile id and with codes only', async () => {
    const sw = await post({ name: 'profile.switch', profileId: 'profile:suni', payload: { via: 'chooser', trigger: 'launch', locked: false, minutesIn: '0-2', from: 'profile:suni', to: 'profile:mina' } });
    expect(sw.status).toBe(201);
    expect(sw.body.data?.event.profileId).toBeUndefined();
    expect(sw.body.data?.event.payload).toEqual({ via: 'chooser', trigger: 'launch', locked: false, minutesIn: '0-2' });
    const gate = await post({ name: 'parent.gate.opened', profileId: 'profile:suni', payload: { dest: 'area', via: 'pin', marker: 'pin', pinEpoch: 1_700_000_000_000 } });
    expect(gate.body.data?.event.profileId).toBeUndefined();
    expect(gate.body.data?.event.payload).toEqual({ dest: 'area', via: 'pin', marker: 'pin' });
    expect(JSON.stringify(store.events)).not.toMatch(/suni|mina|1700000000000/);
  });

  it('adds one per event to its day, name and kept dims, never a profile id or a dropped value', async () => {
    const payload = { trigger: 'launch', learners: '2', grownUps: 1, anyLocked: false, resetPending: false };
    await post({ name: 'who.shown', profileId: 'profile:suni', payload: { ...payload, name: 'Suni', deviceId: 'device:x' } });
    await post({ name: 'who.shown', payload: { resetPending: false, anyLocked: false, grownUps: 1, learners: '2', trigger: 'launch' } });
    await post({ name: 'who.picked', profileId: 'profile:suni', payload: { kind: 'learner', profileId: 'profile:suni' } });
    await post({ name: 'space.join.batch', payload: { picked: 40, joined: 2, refused: 0 } });
    await post({ name: 'session.start', profileId: 'profile:suni', payload: { source: 'pwa' } });
    // not counted: an ordinary name
    await post({ name: 'quest.complete', profileId: 'profile:suni', payload: { questId: 'quest:1' } });
    await drain();
    expect(await rows()).toEqual([
      { day: DAY, name: 'session.start', dims: '', n: 1 },
      { day: DAY, name: 'space.join.batch', dims: '{"joined":2,"refused":0}', n: 1 },
      { day: DAY, name: 'who.picked', dims: '{"kind":"learner"}', n: 1 },
      { day: DAY, name: 'who.shown', dims: '{"anyLocked":false,"grownUps":1,"learners":"2","resetPending":false,"trigger":"launch"}', n: 2 },
    ]);
    expect(JSON.stringify(await rows())).not.toMatch(/profile|suni|Suni|device|quest/);
  });

  it("counts on the UTC day of the event's own time (an offline-queued event counts on its day)", async () => {
    await post({ name: 'pin.paused', at: '2026-10-08T23:59:00.000Z', payload: { step: 2 } });
    await post({ name: 'pin.paused', at: '2026-10-09T00:00:01.000+09:00', payload: { step: 2 } });
    await drain();
    expect(await testDb.telemetryDailyOf('2026-10-08')).toEqual([
      { day: '2026-10-08', name: 'pin.paused', dims: '{"step":2}', n: 2 },
    ]);
    expect(await rows()).toEqual([]);
  });

  it('stops counting new rows past the 600 the isolate holds, and keeps accepting events', async () => {
    for (let i = 0; i < TELEMETRY_DAILY_WRITES_PER_MIN; i += 1) holdDailyCount(undefined, { name: 'pin.paused', payload: { step: i }, at: NOW.toISOString() });
    const add = vi.spyOn(testDb, 'addTelemetryDaily');
    try {
      const r = await post({ name: 'profile.lock_changed', payload: { locked: true } });
      expect(r.status).toBe(201);
      expect(store.events.at(-1)?.name).toBe('profile.lock_changed');
      // The one flush of this minute wrote the 600 held rows, in one call, and not the new one.
      expect(add).toHaveBeenCalledTimes(1);
      expect(add.mock.calls[0]?.[0]).toHaveLength(TELEMETRY_DAILY_WRITES_PER_MIN);
      expect((await rows()).some((row) => row.name === 'profile.lock_changed')).toBe(false);
      vi.setSystemTime(new Date(NOW.getTime() + TELEMETRY_DAILY_FLUSH_MS));
      await post({ name: 'profile.lock_changed', payload: { locked: true } });
      expect(add).toHaveBeenCalledTimes(2);
      expect((await rows()).filter((row) => row.name === 'profile.lock_changed')).toEqual([{ day: DAY, name: 'profile.lock_changed', dims: '{"locked":true}', n: 1 }]);
    } finally {
      add.mockRestore();
    }
  });

  it('TELEMETRY_DAILY off writes nothing; events are still accepted', async () => {
    const res = await app.request('/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'who.picked', payload: { kind: 'add' } }) }, { TELEMETRY_DAILY: 'disabled' });
    expect(res.status).toBe(201);
    expect(store.events).toHaveLength(1);
    await drain();
    expect(await rows()).toEqual([]);
  });

  it('a failed counter write never fails the request and is not retried', async () => {
    const add = vi.spyOn(testDb, 'addTelemetryDaily').mockRejectedValue(new Error('D1_ERROR: no such table: telemetry_daily'));
    try {
      const r = await post({ name: 'profile.removed', payload: { saved: true, wasActive: false, anyway: false } });
      expect(r.status).toBe(201);
      expect(r.body.data?.event.payload).toEqual({ saved: true, wasActive: false, anyway: false });
      expect(add).toHaveBeenCalledTimes(1);
      // The rows that write took are dropped, never written again.
      await post({ name: 'profile.removed', payload: { saved: true, wasActive: false, anyway: false } });
      expect(add).toHaveBeenCalledTimes(1);
      add.mockRestore();
      await drain();
      expect(await rows()).toEqual([{ day: DAY, name: 'profile.removed', dims: '{"anyway":false,"saved":true,"wasActive":false}', n: 1 }]);
    } finally {
      add.mockRestore();
    }
  });

  it('hands the counter to waitUntil when the Worker gives an execution context', async () => {
    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p), passThroughOnException: () => undefined, props: {} };
    const res = await app.request('/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'who.picked', payload: { kind: 'add' } }) }, {}, ctx);
    expect(res.status).toBe(201);
    expect(pending).toHaveLength(1);
    await Promise.all(pending);
    expect(await rows()).toEqual([{ day: DAY, name: 'who.picked', dims: '{"kind":"add"}', n: 1 }]);
  });
});
