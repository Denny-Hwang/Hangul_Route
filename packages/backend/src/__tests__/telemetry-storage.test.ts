import { TELEMETRY_EVENT_NAMES, isServerOnlyTelemetryName, isTelemetryEventName } from '@hangul-route/content-schema';
import { STORAGE_TELEMETRY_NAMES } from '@hangul-route/content-schema/storage-telemetry';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { STORAGE_PAYLOAD_RULES, keptEventFields, recordServerEvent } from '../lib/server-events';
import { resetTelemetryDailyBudgetForTests } from '../lib/telemetry-daily';
import { store } from '../store';
import { eventText } from './helpers/event-text';

/**
 * [DP] POST /api/telemetry for the storage names (AMENDMENTS-DURABLE-PROGRESS section 3.9, TELEMETRY-NAMES-2 section W,
 * row DP-3, Worker first): accepted before the app sends them, stored without a profile id, and codes only. A smuggled
 * profile id, a key name, a learner name, an error message or any other key is dropped, and so is a value off its
 * codes.
 */
type Stored = { name: string; profileId?: string; payload?: Record<string, unknown> };

async function post(body: unknown) {
  const res = await app.request('/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as { ok: boolean; data?: { event: Stored } } };
}

const GOOD = {
  'storage.read_failed': { record: 'profiles', cause: 'parse', kept: true },
  'storage.write_failed': { record: 'progress' },
  'storage.write_recovered': { record: 'progress', tries: 4 },
} as const;

/** What a careless client could add: an id, a key that names the learner, a name, the damaged bytes and an error text. */
const SMUGGLED = {
  profileId: 'profile:suni',
  key: 'hr:progress:profile:suni',
  displayName: 'Suni',
  raw: '[{"displayName":"Suni"',
  message: 'QuotaExceededError: Suni',
};

beforeEach(() => {
  store.reset();
  resetTelemetryDailyBudgetForTests();
});

describe('[DP] storage.* telemetry (section 3.9)', () => {
  it('appends the three names to the shared list, each with a rule for exactly its documented keys', () => {
    expect(STORAGE_TELEMETRY_NAMES).toEqual(['storage.read_failed', 'storage.write_failed', 'storage.write_recovered']);
    // Right after the four auth.native.* names (F-AUTH-004 row NS-1); the list is append-only.
    const at = TELEMETRY_EVENT_NAMES.indexOf('storage.read_failed');
    expect(TELEMETRY_EVENT_NAMES[at - 1]).toBe('auth.native.home');
    expect(TELEMETRY_EVENT_NAMES.slice(at, at + 3)).toEqual([...STORAGE_TELEMETRY_NAMES]);
    for (const name of STORAGE_TELEMETRY_NAMES) {
      expect(isTelemetryEventName(name), name).toBe(true);
      // The learner app sends them: never server-only.
      expect(isServerOnlyTelemetryName(name), name).toBe(false);
    }
    expect(Object.keys(STORAGE_PAYLOAD_RULES)).toEqual([...STORAGE_TELEMETRY_NAMES]);
    expect(Object.keys(STORAGE_PAYLOAD_RULES['storage.read_failed'] ?? {})).toEqual(['record', 'cause', 'kept']);
    expect(Object.keys(STORAGE_PAYLOAD_RULES['storage.write_failed'] ?? {})).toEqual(['record']);
    expect(Object.keys(STORAGE_PAYLOAD_RULES['storage.write_recovered'] ?? {})).toEqual(['record', 'tries']);
  });

  it.each(Object.entries(GOOD))('stores a good %s payload as sent, without the profile id', async (name, payload) => {
    const r = await post({ name, profileId: 'profile:suni', payload });
    expect(r.status).toBe(201);
    expect(r.body.data?.event.payload).toEqual(payload);
    expect(r.body.data?.event.profileId).toBeUndefined();
    expect(store.events.at(-1)?.profileId).toBeUndefined();
  });

  it('drops a smuggled profile id and every other key, whatever the name', () => {
    for (const [name, payload] of Object.entries(GOOD) as [keyof typeof GOOD, Record<string, unknown>][]) {
      expect(keptEventFields(name, { ...payload, ...SMUGGLED }, 'profile:suni'), name).toEqual({ profileId: undefined, payload });
    }
  });

  it('drops each value off its codes on its own, and keeps the rest', () => {
    expect(keptEventFields('storage.read_failed', { record: 'stories', cause: 'parse', kept: true }, undefined).payload).toEqual({ cause: 'parse', kept: true });
    expect(keptEventFields('storage.read_failed', { record: 'active', cause: 'quota', kept: 'yes' }, undefined).payload).toEqual({ record: 'active' });
    expect(keptEventFields('storage.read_failed', { record: 'profile:suni', cause: 'Suni', kept: 1 }, undefined).payload).toBeUndefined();
    expect(keptEventFields('storage.write_failed', { record: 'profiles' }, undefined).payload).toBeUndefined();
    for (const tries of [0, 5, 1.5, '2', 1_700_000_000_000]) {
      expect(keptEventFields('storage.write_recovered', { record: 'progress', tries }, undefined).payload, String(tries)).toEqual({ record: 'progress' });
    }
  });

  it('keeps nothing from a payload that is not an object or has no listed key', () => {
    expect(keptEventFields('storage.write_failed', undefined, 'profile:suni')).toEqual({ profileId: undefined, payload: undefined });
    expect(keptEventFields('storage.read_failed', { profileId: 'profile:suni' }, 'profile:suni')).toEqual({ profileId: undefined, payload: undefined });
  });

  it('never stores the smuggled values through the route either', async () => {
    for (const [name, payload] of Object.entries(GOOD)) {
      const r = await post({ name, profileId: 'profile:suni', payload: { ...payload, ...SMUGGLED } });
      expect(r.status).toBe(201);
    }
    expect(store.events).toHaveLength(3);
    expect(eventText(store.events)).not.toMatch(/suni|hr:progress|Quota|displayName/i);
  });

  it('refuses a storage name the list does not hold', async () => {
    expect((await post({ name: 'storage.read_failure', payload: GOOD['storage.read_failed'] })).status).toBe(422);
  });

  it('applies the same rule to an event the Worker records itself', () => {
    expect(recordServerEvent('storage.write_failed', { record: 'progress', profileId: 'profile:suni' })?.payload).toEqual({ record: 'progress' });
  });
});
