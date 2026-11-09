import { TELEMETRY_EVENT_NAMES, isTelemetryEventName } from '@hangul-route/content-schema';
import { CRASH_TELEMETRY_NAMES } from '@hangul-route/content-schema/crash-telemetry';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { CRASH_PAYLOAD_RULES, keptEventFields } from '../lib/server-events';
import { store } from '../store';

/**
 * POST /api/telemetry for `app.crash` (TELEMETRY-NAMES-2 section U, Worker first): the root, the route and error class
 * names, a scrubbed message, a chunk flag and the app version, stored without a profile id; no address, link or long
 * number in the message, and no key outside the list.
 */
type Stored = { name: string; profileId?: string; payload?: Record<string, unknown> };

async function post(body: unknown) {
  const res = await app.request('/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as { ok: boolean; data?: { event: Stored } } };
}

const GOOD = { surface: 'learner', route: 'QuestPlayer', errorName: 'AsyncRequireError', message: 'Loading module failed', chunk: true, appVersion: '1.0.0' };

beforeEach(() => store.reset());

describe('app.crash telemetry (section U)', () => {
  it('is one name in the shared list, with a rule for each payload key', () => {
    expect(CRASH_TELEMETRY_NAMES).toEqual(['app.crash']);
    expect(TELEMETRY_EVENT_NAMES.filter((n) => n === 'app.crash')).toHaveLength(1);
    expect(TELEMETRY_EVENT_NAMES.at(-1)).toBe('app.crash');
    expect(isTelemetryEventName('app.crash')).toBe(true);
    expect(Object.keys(CRASH_PAYLOAD_RULES['app.crash'] ?? {})).toEqual(['surface', 'route', 'errorName', 'message', 'chunk', 'appVersion']);
  });

  it('stores a good payload without the profile id', async () => {
    const r = await post({ name: 'app.crash', profileId: 'profile:abc', payload: GOOD });
    expect(r.status).toBe(201);
    expect(r.body.data?.event.payload).toEqual(GOOD);
    expect(r.body.data?.event.profileId).toBeUndefined();
    expect(store.events.at(-1)?.profileId).toBeUndefined();
  });

  it('drops extra keys and values off their shape', () => {
    const kept = keptEventFields('app.crash', { ...GOOD, learnerName: 'Dami', stack: 'at x', route: 'Quest/abc?x=1', surface: 'kiosk', appVersion: 'v1' }, 'profile:abc');
    expect(kept).toEqual({ profileId: undefined, payload: { errorName: 'AsyncRequireError', message: 'Loading module failed', chunk: true } });
  });

  it.each([
    ['an email address', 'failed for dami@example.com'],
    ['a link', 'GET https://app.hangulroute.com/x failed'],
    ['a long number', 'id 1234567 missing'],
    ['non-ASCII text', 'Dami ☃'],
    ['over 120 characters', 'x'.repeat(121)],
  ])('drops a message with %s', (_label, message) => {
    expect(keptEventFields('app.crash', { ...GOOD, message }, undefined).payload).not.toHaveProperty('message');
  });

  it('keeps a message of exactly 120 characters', () => {
    const message = 'x'.repeat(120);
    expect(keptEventFields('app.crash', { ...GOOD, message }, undefined).payload?.message).toBe(message);
  });

  it('keeps nothing from a payload that is not an object', () => {
    expect(keptEventFields('app.crash', undefined, 'p')).toEqual({ profileId: undefined, payload: undefined });
  });
});
