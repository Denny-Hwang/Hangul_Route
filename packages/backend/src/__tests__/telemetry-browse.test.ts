import { BROWSE_EVENT_NAMES } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { recordServerEvent } from '../lib/server-events';
import { store } from '../store';

/**
 * F-BROWSE-001 §5.2 and §9 (BR-2): a `browse.*` event is stored without a
 * profile id and with only its §9 payload keys, each in its documented shape
 * (codes, content ids of the event's kind, booleans, minutes 0-60). Anything
 * else in the payload is dropped before storage; other names are unchanged.
 */
type Stored = { name: string; profileId?: string; payload?: Record<string, unknown> };
const NOW = new Date('2026-10-11T12:00:00.000Z');

async function post(body: unknown) {
  const res = await app.request('/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, event: ((await res.json()) as { data?: { event: Stored } }).data?.event };
}

beforeEach(() => {
  store.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('POST /api/telemetry, browse.* (F-BROWSE-001 §5.2)', () => {
  it.each(BROWSE_EVENT_NAMES.map((n) => [n]))('accepts %s and drops its profile id', async (name) => {
    const r = await post({ name, profileId: 'profile:suni' });
    expect(r.status).toBe(201);
    expect(r.event?.profileId).toBeUndefined();
    expect(r.event?.payload).toBeUndefined();
  });

  it('keeps the documented payload of each name', async () => {
    const cases: [string, Record<string, unknown>][] = [
      ['browse.opened', { source: 'report', scope: 'sampler', passFrom: 'kept', offlineReady: true }],
      ['browse.opened', { source: 'direct', scope: 'none', passFrom: 'none', offlineReady: false }],
      ['browse.item_viewed', { kind: 'episode', itemId: 'episode:stage1-letters', access: 'open' }],
      ['browse.item_viewed', { kind: 'quest', itemId: 'quest:stage1-letters-q1', access: 'closed' }],
      ['browse.item_viewed', { kind: 'story', itemId: 'story:sun-and-moon', access: 'open' }],
      ['browse.item_viewed', { kind: 'vocab-topic', itemId: 'vocab-topic:food', access: 'open' }],
      ['browse.item_viewed', { kind: 'card', itemId: 'card:hangul-day', access: 'open' }],
      ['browse.preview_started', { kind: 'quest', itemId: 'quest:stage1-letters-q2' }],
      ['browse.preview_ended', { kind: 'story', itemId: 'story:sun-and-moon', reachedEnd: true, minutes: 0 }],
      ['browse.preview_ended', { kind: 'vocab-topic', itemId: 'vocab-topic:food', reachedEnd: false, minutes: 60 }],
      ['browse.plans_tapped', { kind: 'vocab-topic' }],
    ];
    for (const [name, payload] of cases) {
      const r = await post({ name, profileId: 'profile:suni', payload });
      expect(r.status, name).toBe(201);
      expect(r.event?.payload, name).toEqual(payload);
      expect(r.event?.profileId, name).toBeUndefined();
    }
  });

  it('drops unknown payload keys, so no person data rides along', async () => {
    const r = await post({
      name: 'browse.opened',
      profileId: 'profile:suni',
      payload: { source: 'nav', scope: 'full', passFrom: 'account', offlineReady: true, accountId: 'user_1', email: 'a@b.c', learnerId: 'profile:suni', spaceId: 'space:a' },
    });
    expect(r.event?.payload).toEqual({ source: 'nav', scope: 'full', passFrom: 'account', offlineReady: true });
    expect(store.events.at(-1)).not.toHaveProperty('profileId', 'profile:suni');
    // a key documented for another browse name is not kept either
    const other = await post({ name: 'browse.plans_tapped', payload: { kind: 'quest', itemId: 'quest:stage1-letters-q1', access: 'closed' } });
    expect(other.event?.payload).toEqual({ kind: 'quest' });
  });

  it('drops a documented key whose value has the wrong shape', async () => {
    const opened = await post({ name: 'browse.opened', payload: { source: 'email', scope: 'premium', passFrom: 'profile:suni', offlineReady: 'yes' } });
    expect(opened.event?.payload).toBeUndefined();

    const viewed = await post({ name: 'browse.item_viewed', payload: { kind: 'jamo', itemId: 'jamo:nieun', access: 'locked' } });
    expect(viewed.event?.payload).toBeUndefined();

    // an id must be a content id of the event's own kind
    const mismatch = await post({ name: 'browse.item_viewed', payload: { kind: 'quest', itemId: 'story:sun-and-moon', access: 'open' } });
    expect(mismatch.event?.payload).toEqual({ kind: 'quest', access: 'open' });
    const personId = await post({ name: 'browse.preview_started', payload: { kind: 'quest', itemId: 'profile:suni' } });
    expect(personId.event?.payload).toEqual({ kind: 'quest' });
    const noKind = await post({ name: 'browse.preview_started', payload: { itemId: 'quest:stage1-letters-q1' } });
    expect(noKind.event?.payload).toBeUndefined();
    const cardInPreview = await post({ name: 'browse.preview_started', payload: { kind: 'card', itemId: 'card:hangul-day' } });
    expect(cardInPreview.event?.payload).toBeUndefined();
    const nonString = await post({ name: 'browse.preview_started', payload: { kind: 'quest', itemId: 42 } });
    expect(nonString.event?.payload).toEqual({ kind: 'quest' });

    for (const minutes of [-1, 61, 2.5, '3', null, Number.NaN]) {
      const ended = await post({ name: 'browse.preview_ended', payload: { kind: 'quest', itemId: 'quest:stage1-letters-q1', reachedEnd: 1, minutes } });
      expect(ended.event?.payload, String(minutes)).toEqual({ kind: 'quest', itemId: 'quest:stage1-letters-q1' });
    }

    expect((await post({ name: 'browse.plans_tapped', payload: { kind: 'episode' } })).event?.payload).toBeUndefined();
    expect((await post({ name: 'browse.opened', payload: ['nav'] })).event?.payload).toBeUndefined();
    expect((await post({ name: 'browse.opened', payload: 'nav' })).event?.payload).toBeUndefined();
  });

  it('leaves other names unchanged', async () => {
    const quest = await post({ name: 'quest.complete', profileId: 'profile:a', payload: { questId: 'quest:x', extra: { nested: true } } });
    expect(quest.event).toMatchObject({ profileId: 'profile:a', payload: { questId: 'quest:x', extra: { nested: true } } });
    const transfer = await post({ name: 'space.transfer.consented', profileId: 'profile:a', payload: { initiator: 'learner_side', itemId: 'quest:x' } });
    expect(transfer.event?.profileId).toBeUndefined();
    expect(transfer.event?.payload).toEqual({ initiator: 'learner_side' });
  });
});

describe('recordServerEvent, browse.* (the same filter as POST /api/telemetry)', () => {
  it('keeps only the documented fields of an event the Worker records itself', () => {
    const event = recordServerEvent('browse.item_viewed', { kind: 'quest', itemId: 'quest:stage1-letters-q1', access: 'open', profileId: 'profile:suni', accountId: 'account:a' });
    expect(event?.payload).toEqual({ kind: 'quest', itemId: 'quest:stage1-letters-q1', access: 'open' });
    expect(event?.profileId).toBeUndefined();
    expect(recordServerEvent('browse.opened', { source: 'email' })?.payload).toBeUndefined();
  });
});
