import { ROUTE_BLEND_TELEMETRY_NAMES, TELEMETRY_EVENT_NAMES, isTelemetryEventName } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { ROUTE_BLEND_PAYLOAD_RULES, keptEventFields } from '../lib/server-events';
import { store } from '../store';

/**
 * POST /api/telemetry for the two names of AMENDMENTS-ROUTE-CLASS-BLEND section 18 (TELEMETRY-NAMES-2 section T,
 * row BL-W, Worker first): a count and codes only, stored without a profile id; no plan, space, cell or learner id,
 * no date and no weekday list ever survives.
 */
type Stored = { name: string; profileId?: string; payload?: Record<string, unknown> };

async function post(body: unknown) {
  const res = await app.request('/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as { ok: boolean; data?: { event: Stored } } };
}

beforeEach(() => store.reset());

describe('route blend telemetry names (section T)', () => {
  it('adds exactly the two names, at the end of the shared list, each with a payload rule', () => {
    expect(ROUTE_BLEND_TELEMETRY_NAMES).toEqual(['route.practice_days_changed', 'route.refresh_started']);
    expect(TELEMETRY_EVENT_NAMES.slice(-2)).toEqual(['route.practice_days_changed', 'route.refresh_started']);
    expect(Object.keys(ROUTE_BLEND_PAYLOAD_RULES)).toEqual(['route.practice_days_changed', 'route.refresh_started']);
    expect(Object.keys(ROUTE_BLEND_PAYLOAD_RULES['route.practice_days_changed'] ?? {})).toEqual(['days', 'by']);
    expect(Object.keys(ROUTE_BLEND_PAYLOAD_RULES['route.refresh_started'] ?? {})).toEqual(['via']);
    for (const name of ROUTE_BLEND_TELEMETRY_NAMES) expect(isTelemetryEventName(name)).toBe(true);
  });

  it.each([
    ['route.practice_days_changed', { days: 1, by: 'self' }],
    ['route.practice_days_changed', { days: 7, by: 'grownup' }],
    ['route.refresh_started', { via: 'cell-check' }],
    ['route.refresh_started', { via: 'daily-review' }],
  ])('accepts %s %j and stores it without the profile id', async (name, payload) => {
    const r = await post({ name, profileId: 'profile:abc', payload });
    expect(r.status).toBe(201);
    expect(r.body.data?.event.payload).toEqual(payload);
    expect(r.body.data?.event.profileId).toBeUndefined();
    expect(store.events.at(-1)?.profileId).toBeUndefined();
  });

  it('drops ids, dates and weekday lists, and values off their codes', () => {
    const sent = { days: 3, by: 'self', weekdays: ['mon', 'wed', 'fri'], planId: 'plan:abc', spaceId: 'space:x', date: '2026-11-03', learnerId: 'profile:abc' };
    expect(keptEventFields('route.practice_days_changed', sent, 'profile:abc')).toEqual({ profileId: undefined, payload: { days: 3, by: 'self' } });
    expect(keptEventFields('route.practice_days_changed', { days: 0, by: 'teacher' }, undefined)).toEqual({ profileId: undefined, payload: undefined });
    expect(keptEventFields('route.practice_days_changed', { days: 8, by: 'self' }, undefined).payload).toEqual({ by: 'self' });
    expect(keptEventFields('route.practice_days_changed', { days: 2.5, by: 'self' }, undefined).payload).toEqual({ by: 'self' });
    expect(keptEventFields('route.refresh_started', { via: 'cell-check', cellId: 'cell:stage1-a' }, 'p').payload).toEqual({ via: 'cell-check' });
    expect(keptEventFields('route.refresh_started', { via: 'stage-check' }, 'p')).toEqual({ profileId: undefined, payload: undefined });
    expect(keptEventFields('route.refresh_started', undefined, 'p')).toEqual({ profileId: undefined, payload: undefined });
  });

  it('leaves route.next_started as it was (fromClass rides its payload with no allowlist change)', () => {
    expect(keptEventFields('route.next_started', { surface: 'route', fromClass: true }, 'profile:a')).toEqual({
      profileId: 'profile:a',
      payload: { surface: 'route', fromClass: true },
    });
  });
});
