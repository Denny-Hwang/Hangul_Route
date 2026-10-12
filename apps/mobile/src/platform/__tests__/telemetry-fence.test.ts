import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F-BROWSE-001 §4.10 (BR-3): the telemetry fence and the configurable queue
 * key. While a fence is set, `track()` returns false for a rejected name
 * before validation, listeners, the network or the queue. With
 * `configureTelemetryQueue('browse:telemetry-queue')` the learner queue
 * (`telemetry:queue`) is never read, rewritten or sent.
 */
vi.mock('../../config/flags', () => ({
  flags: { voiceEchoEnabled: false, telemetryEnabled: true, telemetryNetwork: true },
}));

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  readJsonStrict: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));

import { flags } from '../../config/flags';
import { readJsonStrict, writeJson } from '../storage';
import { LEARNER_TELEMETRY_QUEUE_KEY, addTelemetryListener, configureTelemetryQueue, flushQueue, setTelemetryFence, track } from '../telemetry';

const endpoint = 'https://api.example.com';
const offline = vi.fn<typeof fetch>(async () => {
  throw new Error('offline');
});
const online = (): ReturnType<typeof vi.fn<typeof fetch>> => vi.fn<typeof fetch>(async () => new Response(null, { status: 201 }));
const sentNames = (f: ReturnType<typeof vi.fn<typeof fetch>>): string[] => f.mock.calls.map((call) => (JSON.parse(String(call[1]?.body)) as { name: string }).name);
const onlyBrowse = (name: string): boolean => name.startsWith('browse.');

beforeEach(() => {
  mem.clear();
  vi.clearAllMocks();
  flags.telemetryEnabled = true;
  flags.telemetryNetwork = true;
});
afterEach(() => {
  setTelemetryFence(null);
  configureTelemetryQueue(LEARNER_TELEMETRY_QUEUE_KEY);
  vi.unstubAllGlobals();
});

describe('setTelemetryFence', () => {
  it('a rejected name returns false and neither sends, queues nor notifies', async () => {
    const heard: string[] = [];
    const stop = addTelemetryListener((e) => heard.push(e.name));
    setTelemetryFence(onlyBrowse);
    const fetchImpl = online();
    expect(await track({ name: 'quest.complete', profileId: 'p1' }, { endpoint, fetchImpl })).toBe(false);
    expect(await track({ name: 'session.start', profileId: 'p1' }, { endpoint, fetchImpl: offline })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(offline).not.toHaveBeenCalled();
    expect(writeJson).not.toHaveBeenCalled();
    expect(heard).toEqual([]);
    stop();
  });

  it('rejects before validation and before the network switches are read', async () => {
    setTelemetryFence(() => false);
    flags.telemetryNetwork = false;
    expect(await track({ name: 'browse.opened' }, { endpoint, fetchImpl: online() })).toBe(false);
  });

  it('an allowed name goes through as before', async () => {
    const heard: string[] = [];
    const stop = addTelemetryListener((e) => heard.push(e.name));
    setTelemetryFence(onlyBrowse);
    const fetchImpl = online();
    expect(await track({ name: 'browse.opened', payload: { source: 'nav' } }, { endpoint, fetchImpl })).toBe(true);
    expect(sentNames(fetchImpl)).toEqual(['browse.opened']);
    expect(heard).toEqual(['browse.opened']);
    stop();
  });

  it('a fence that throws counts as a rejection (fail closed)', async () => {
    setTelemetryFence(() => {
      throw new Error('fence');
    });
    const fetchImpl = online();
    expect(await track({ name: 'browse.opened' }, { endpoint, fetchImpl })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('clearing the fence restores every name', async () => {
    setTelemetryFence(() => false);
    setTelemetryFence(null);
    const fetchImpl = online();
    expect(await track({ name: 'quest.complete' }, { endpoint, fetchImpl })).toBe(true);
    expect(sentNames(fetchImpl)).toEqual(['quest.complete']);
  });
});

describe('configureTelemetryQueue', () => {
  const learnerQueue = [
    { name: 'quest.complete', profileId: 'profile:suni', payload: { stars: 3 }, at: '2026-10-11T08:00:00.000Z', id: 'l1' },
    { name: 'card.unlocked', profileId: 'profile:suni', at: '2026-10-11T08:00:01.000Z', id: 'l2' },
  ];

  it('the learner queue is the default', async () => {
    expect(LEARNER_TELEMETRY_QUEUE_KEY).toBe('telemetry:queue');
    await track({ name: 'quest.complete' }, { endpoint, fetchImpl: offline });
    expect(mem.get('telemetry:queue')).toHaveLength(1);
  });

  it('after boot, a preview and a flush, learner-queued events are untouched and unsent', async () => {
    const stored = structuredClone(learnerQueue);
    mem.set('telemetry:queue', stored);

    // boot
    configureTelemetryQueue('browse:telemetry-queue');
    setTelemetryFence(onlyBrowse);
    expect(await flushQueue({ endpoint, fetchImpl: offline })).toBe(0);

    // a preview while offline: browse events queue on their own key, learner events are dropped
    expect(await track({ name: 'browse.preview_started', payload: { kind: 'quest', itemId: 'quest:stage1-letters-q1' } }, { endpoint, fetchImpl: offline })).toBe(false);
    expect(await track({ name: 'quest.complete', profileId: 'profile:suni' }, { endpoint, fetchImpl: offline })).toBe(false);
    expect(await track({ name: 'browse.preview_ended', payload: { kind: 'quest', reachedEnd: true, minutes: 2 } }, { endpoint, fetchImpl: offline })).toBe(false);
    expect((mem.get('browse:telemetry-queue') as { name: string }[]).map((e) => e.name)).toEqual(['browse.preview_started', 'browse.preview_ended']);

    // back online: the flush sends only the browse queue
    const fetchImpl = online();
    expect(await flushQueue({ endpoint, fetchImpl })).toBe(2);
    expect(sentNames(fetchImpl)).toEqual(['browse.preview_started', 'browse.preview_ended']);
    expect(mem.get('browse:telemetry-queue')).toEqual([]);

    // the learner queue was never read, rewritten or sent
    expect(mem.get('telemetry:queue')).toBe(stored);
    expect(stored).toEqual(learnerQueue);
    for (const call of vi.mocked(readJsonStrict).mock.calls) expect(call[0]).toBe('browse:telemetry-queue');
    for (const call of vi.mocked(writeJson).mock.calls) expect(call[0]).toBe('browse:telemetry-queue');
  });

  it('a browse tab and a learner tab hold their own cross-tab lock', async () => {
    const names: string[] = [];
    vi.stubGlobal('navigator', {
      locks: {
        request: vi.fn(async <T>(name: string, step: () => Promise<T>) => {
          names.push(name);
          return step();
        }),
      },
    });
    await track({ name: 'quest.complete' }, { endpoint, fetchImpl: offline });
    configureTelemetryQueue('browse:telemetry-queue');
    await track({ name: 'browse.opened' }, { endpoint, fetchImpl: offline });
    expect(names).toEqual(['hr:telemetry:queue', 'hr:browse:telemetry-queue']);
  });
});
