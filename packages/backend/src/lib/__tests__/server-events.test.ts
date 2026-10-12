import { REPORT_TELEMETRY_PAYLOAD, type TelemetryEventName } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../store';
import { MAX_EVENTS, appendEvent, keptEventFields, recordServerEvent } from '../server-events';

/**
 * The Worker's own telemetry (F-REPORT-001 section 3.13): the console has no
 * telemetry client, so the report routes record `report.viewed` themselves,
 * into the same capped in-memory log as POST /api/telemetry and through the
 * same codes-only filter (section 3.10).
 */
const NOW = new Date('2026-10-11T12:00:00.000Z');

beforeEach(() => {
  store.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('recordServerEvent', () => {
  it('appends a report.viewed event with codes only, stamped with the server time', () => {
    const event = recordServerEvent('report.viewed', { scope: 'learner', space: 'family', period: 'week' });
    expect(event).toMatchObject({ name: 'report.viewed', payload: { scope: 'learner', space: 'family', period: 'week' }, at: NOW.toISOString(), receivedAt: NOW.toISOString() });
    expect(event?.id).toMatch(/^event:/);
    expect(event?.profileId).toBeUndefined();
    expect(store.events).toEqual([event]);
  });

  it('applies the report.* filter: identifiers, names and values off the enum never reach the log', () => {
    const event = recordServerEvent('report.viewed', {
      scope: 'class',
      space: 'class',
      period: 'year',
      spaceId: 'space:class-a',
      learnerId: 'profile:suni',
      profileId: 'profile:suni',
      name: 'Suni',
    });
    expect(event?.payload).toEqual({ scope: 'class', space: 'class' });
    expect(Object.keys(event ?? {})).not.toContain('profileId');
    expect(recordServerEvent('report.viewed', { scope: 'space:class-a' })?.payload).toBeUndefined();
    expect(recordServerEvent('report.viewed')?.payload).toBeUndefined();
  });

  it('accepts every documented code', () => {
    for (const scope of REPORT_TELEMETRY_PAYLOAD.scope) {
      for (const space of REPORT_TELEMETRY_PAYLOAD.space) {
        for (const period of REPORT_TELEMETRY_PAYLOAD.period) {
          expect(recordServerEvent('report.viewed', { scope, space, period })?.payload).toEqual({ scope, space, period });
        }
      }
    }
  });

  it('applies the other codes-only filters too, and keeps an ordinary payload as given', () => {
    expect(recordServerEvent('space.transfer.completed', { initiator: 'learner_side', spaceId: 'space:a' })?.payload).toEqual({ initiator: 'learner_side' });
    expect(recordServerEvent('shell.path_bounced', { prefix: 'teach', next: '/teach/space?id=space:a' })?.payload).toEqual({ prefix: 'teach' });
    expect(recordServerEvent('route_map.viewed', { from: 'home' })?.payload).toEqual({ from: 'home' });
  });

  it('validates the name against the shared list and records nothing for an unknown one', () => {
    expect(recordServerEvent('report.opened' as TelemetryEventName, { scope: 'learner' })).toBeNull();
    expect(recordServerEvent('' as TelemetryEventName)).toBeNull();
    expect(store.events).toHaveLength(0);
  });

  it('shares the 10k cap with POST /api/telemetry', () => {
    store.events = Array.from({ length: MAX_EVENTS }, (_, i) => ({ id: `event:${i}`, name: 'session.start', at: NOW.toISOString() }));
    recordServerEvent('report.viewed', { scope: 'learner', space: 'class', period: 'day' });
    expect(MAX_EVENTS).toBe(10_000);
    expect(store.events).toHaveLength(MAX_EVENTS);
    expect(store.events[0]?.id).toBe('event:1');
    expect(store.events.at(-1)?.name).toBe('report.viewed');
  });
});

describe('keptEventFields (the codes-only filter shared with POST /api/telemetry)', () => {
  it('keeps the profile id and payload of an ordinary event', () => {
    expect(keptEventFields('quest.complete', { questId: 'quest:x' }, 'profile:a')).toEqual({ profileId: 'profile:a', payload: { questId: 'quest:x' } });
  });

  it('drops a non-string profile id', () => {
    expect(keptEventFields('quest.complete', undefined, 7)).toEqual({ profileId: undefined, payload: undefined });
  });

  it('never keeps a profile id on a codes-only event, and keeps only its codes', () => {
    expect(keptEventFields('report.viewed', { scope: 'learner', other: 'x' }, 'profile:a')).toEqual({ profileId: undefined, payload: { scope: 'learner' } });
    expect(keptEventFields('shell.unlisted' as TelemetryEventName, { prefix: 'teach' }, 'profile:a')).toEqual({ profileId: undefined, payload: undefined });
  });
});

describe('appendEvent', () => {
  it('pushes and trims from the front once past the cap', () => {
    store.events = Array.from({ length: MAX_EVENTS }, (_, i) => ({ id: `event:${i}`, name: 'session.start', at: NOW.toISOString() }));
    const event = { id: 'event:new', name: 'session.end', at: NOW.toISOString() };
    expect(appendEvent(event)).toBe(event);
    expect(store.events).toHaveLength(MAX_EVENTS);
    expect(store.events[0]?.id).toBe('event:1');
  });
});
