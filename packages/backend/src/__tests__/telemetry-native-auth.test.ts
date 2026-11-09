import { TELEMETRY_EVENT_NAMES, isServerOnlyTelemetryName, isTelemetryEventName } from '@hangul-route/content-schema';
import { NATIVE_AUTH_TELEMETRY_NAMES } from '@hangul-route/content-schema/native-auth-telemetry';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { NATIVE_AUTH_PAYLOAD_RULES, keptEventFields } from '../lib/server-events';
import { TELEMETRY_DAILY_WINDOW_MS, flushTelemetryDaily, resetTelemetryDailyBudgetForTests } from '../lib/telemetry-daily';
import { store } from '../store';
import { testDb } from './helpers/db';

/**
 * POST /api/telemetry for the native grown-up sign-in names (F-AUTH-004 section 15, TELEMETRY-NAMES-2 section V, row
 * NS-1, Worker first): accepted before any client sends them, stored without a profile id, codes only (a smuggled
 * profile id, an email, an extra key or an off-list value is dropped), and counted in `telemetry_daily`. And
 * `who.picked { use: 'account' }` is kept and counted.
 */
type Stored = { name: string; profileId?: string; payload?: Record<string, unknown> };
const NOW = new Date('2026-11-08T12:00:00.000Z');
const DAY = NOW.toISOString().slice(0, 10);

async function post(body: unknown, env: Record<string, string> = {}) {
  const res = await app.request('/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, env);
  return { status: res.status, body: (await res.json()) as { ok: boolean; data?: { event: Stored } } };
}
const rows = () => testDb.telemetryDailyOf(DAY);
const drain = () => flushTelemetryDaily(() => testDb, Date.now() + TELEMETRY_DAILY_WINDOW_MS);

const GOOD = {
  'auth.native.signin': { os: 'ios', method: 'password', result: 'ok', second: true },
  'auth.native.signout': { os: 'android', via: 'lock' },
  'auth.native.lock': { os: 'ios', cause: 'retrust_password' },
  'auth.native.home': { os: 'android', use: 'account', spaces: '0' },
} as const;

beforeEach(async () => {
  store.reset();
  await testDb.reset();
  resetTelemetryDailyBudgetForTests();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('auth.native.* telemetry (section 15)', () => {
  it('appends the four names to the shared list, each with a rule for exactly its documented keys', () => {
    expect(NATIVE_AUTH_TELEMETRY_NAMES).toEqual(['auth.native.signin', 'auth.native.signout', 'auth.native.lock', 'auth.native.home']);
    expect(TELEMETRY_EVENT_NAMES.slice(-4)).toEqual([...NATIVE_AUTH_TELEMETRY_NAMES]);
    for (const name of NATIVE_AUTH_TELEMETRY_NAMES) {
      expect(isTelemetryEventName(name), name).toBe(true);
      // A client sends them (the native app): never server-only.
      expect(isServerOnlyTelemetryName(name), name).toBe(false);
    }
    expect(Object.keys(NATIVE_AUTH_PAYLOAD_RULES)).toEqual([...NATIVE_AUTH_TELEMETRY_NAMES]);
    expect(Object.keys(NATIVE_AUTH_PAYLOAD_RULES['auth.native.signin'] ?? {})).toEqual(['os', 'method', 'result', 'second']);
    expect(Object.keys(NATIVE_AUTH_PAYLOAD_RULES['auth.native.signout'] ?? {})).toEqual(['os', 'via']);
    expect(Object.keys(NATIVE_AUTH_PAYLOAD_RULES['auth.native.lock'] ?? {})).toEqual(['os', 'cause']);
    expect(Object.keys(NATIVE_AUTH_PAYLOAD_RULES['auth.native.home'] ?? {})).toEqual(['os', 'use', 'spaces']);
  });

  it.each(Object.entries(GOOD))('stores a good %s payload as sent, without the profile id', async (name, payload) => {
    const r = await post({ name, profileId: 'profile:suni', payload });
    expect(r.status).toBe(201);
    expect(r.body.data?.event.payload).toEqual(payload);
    expect(r.body.data?.event.profileId).toBeUndefined();
    expect(store.events.at(-1)?.profileId).toBeUndefined();
  });

  it('drops a smuggled profile id, an email, an account id, an extra key and every off-list value', () => {
    const smuggled = { profileId: 'profile:suni', email: 'mom@example.org', accountId: 'user_2abc', code: '123456', error: 'Invalid code for mom@example.org' };
    expect(keptEventFields('auth.native.signin', { ...GOOD['auth.native.signin'], ...smuggled }, 'profile:suni')).toEqual({ profileId: undefined, payload: GOOD['auth.native.signin'] });
    // Off-list values: each key is dropped on its own, the rest stay.
    expect(keptEventFields('auth.native.signin', { os: 'web', method: 'google', result: 'ok', second: 'yes' }, undefined)).toEqual({ profileId: undefined, payload: { result: 'ok' } });
    expect(keptEventFields('auth.native.signout', { os: 'ios', via: 'remote' }, undefined).payload).toEqual({ os: 'ios' });
    expect(keptEventFields('auth.native.lock', { os: 'android', cause: 'mom@example.org' }, undefined).payload).toEqual({ os: 'android' });
    expect(keptEventFields('auth.native.home', { os: 'ios', use: 'area', spaces: 3 }, undefined).payload).toEqual({ os: 'ios' });
    expect(keptEventFields('auth.native.home', { use: 'family', spaces: '5+', spaceId: 'space:abc' }, undefined).payload).toEqual({ use: 'family', spaces: '5+' });
  });

  it('keeps nothing from a payload that is not an object or has no listed key', () => {
    expect(keptEventFields('auth.native.lock', undefined, 'profile:suni')).toEqual({ profileId: undefined, payload: undefined });
    expect(keptEventFields('auth.native.lock', { reason: 'x' }, 'profile:suni')).toEqual({ profileId: undefined, payload: undefined });
  });

  it('never stores the smuggled values through the route either', async () => {
    await post({ name: 'auth.native.signin', profileId: 'profile:suni', payload: { ...GOOD['auth.native.signin'], email: 'mom@example.org', error: 'Clerk: user_2abc' } });
    expect(JSON.stringify(store.events)).not.toMatch(/suni|mom@|user_2abc|Clerk/);
  });

  it('counts each name in telemetry_daily with the codes its rules kept, never a dropped value', async () => {
    for (const [name, payload] of Object.entries(GOOD)) await post({ name, profileId: 'profile:suni', payload: { ...payload, email: 'mom@example.org' } });
    await post({ name: 'auth.native.signin', payload: { second: true, result: 'ok', method: 'password', os: 'ios' } });
    await drain();
    expect(await rows()).toEqual([
      { day: DAY, name: 'auth.native.home', dims: '{"os":"android","spaces":"0","use":"account"}', n: 1 },
      { day: DAY, name: 'auth.native.lock', dims: '{"cause":"retrust_password","os":"ios"}', n: 1 },
      { day: DAY, name: 'auth.native.signin', dims: '{"method":"password","os":"ios","result":"ok","second":true}', n: 2 },
      { day: DAY, name: 'auth.native.signout', dims: '{"os":"android","via":"lock"}', n: 1 },
    ]);
    expect(JSON.stringify(await rows())).not.toMatch(/profile|suni|mom@/);
  });

  it('TELEMETRY_DAILY off counts nothing; the events are still accepted', async () => {
    const r = await post({ name: 'auth.native.lock', payload: GOOD['auth.native.lock'] }, { TELEMETRY_DAILY: 'disabled' });
    expect(r.status).toBe(201);
    await drain();
    expect(await rows()).toEqual([]);
  });
});

describe("who.picked { use: 'account' } (section 7.1)", () => {
  it('is kept, without the profile id, and counted', async () => {
    const r = await post({ name: 'who.picked', profileId: 'profile:suni', payload: { kind: 'grown_up', use: 'account', email: 'mom@example.org' } });
    expect(r.status).toBe(201);
    expect(r.body.data?.event.payload).toEqual({ kind: 'grown_up', use: 'account' });
    expect(r.body.data?.event.profileId).toBeUndefined();
    await drain();
    expect(await rows()).toEqual([{ day: DAY, name: 'who.picked', dims: '{"kind":"grown_up","use":"account"}', n: 1 }]);
  });

  it('still drops a use off the list', () => {
    expect(keptEventFields('who.picked', { kind: 'grown_up', use: 'accounts' }, undefined).payload).toEqual({ kind: 'grown_up' });
  });
});
