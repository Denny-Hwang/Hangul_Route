import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/flags', () => ({
  flags: { voiceEchoEnabled: false, telemetryEnabled: true, telemetryNetwork: true },
}));

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));

import { flags } from '../../config/flags';
import { flushQueue, track } from '../telemetry';

const ORIGINAL_FETCH = globalThis.fetch;

describe('track', () => {
  beforeEach(() => {
    flags.telemetryEnabled = true;
    flags.telemetryNetwork = true;
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it('posts to /api/telemetry with the event body', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 201 }));
    const ok = await track(
      { name: 'quest.complete', profileId: 'p1', payload: { stars: 3 } },
      { endpoint: 'https://api.example.com', fetchImpl: fetchMock },
    );
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0]?.[0];
    const init = fetchMock.mock.calls[0]?.[1];
    expect(calledUrl).toBe('https://api.example.com/api/telemetry');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'quest.complete',
      profileId: 'p1',
      payload: { stars: 3 },
      at: expect.any(String),
    });
  });

  it('returns false (no-op) when telemetry is disabled', async () => {
    flags.telemetryEnabled = false;
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 201 }));
    const ok = await track({ name: 'quest.complete' }, { fetchImpl: fetchMock });
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips the fetch but still returns true when network is off', async () => {
    flags.telemetryNetwork = false;
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 201 }));
    const ok = await track({ name: 'session.start' }, { fetchImpl: fetchMock });
    expect(ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows fetch errors — never throws', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new Error('network down');
    });
    const ok = await track(
      { name: 'quest.complete' },
      { endpoint: 'https://api.example.com', fetchImpl: fetchMock },
    );
    expect(ok).toBe(false);
  });

  it('returns false when the server rejects (4xx/5xx)', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 422 }));
    const ok = await track(
      { name: 'quest.complete' },
      { endpoint: 'https://api.example.com', fetchImpl: fetchMock },
    );
    expect(ok).toBe(false);
  });

  it('never POSTs to the unconfigured placeholder endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 201 }));
    const ok = await track({ name: 'session.start' }, { fetchImpl: fetchMock });
    expect(ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty event name', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 201 }));
    const ok = await track({ name: '' as never }, { fetchImpl: fetchMock });
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('offline queue (F-PWA-001 §3.2)', () => {
  beforeEach(() => {
    mem.clear();
    flags.telemetryEnabled = true;
    flags.telemetryNetwork = true;
  });

  it('queues an event when the POST fails and keeps its timestamp', async () => {
    const failing = vi.fn<typeof fetch>(async () => {
      throw new Error('offline');
    });
    const ok = await track({ name: 'quest.complete', profileId: 'p1' }, { endpoint: 'https://api.example.com', fetchImpl: failing });
    expect(ok).toBe(false);
    const queue = mem.get('telemetry:queue') as Array<{ name: string; at: string }>;
    expect(queue).toHaveLength(1);
    expect(queue[0]?.name).toBe('quest.complete');
    expect(queue[0]?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('flushes queued events in order and stops at the first failure', async () => {
    mem.set('telemetry:queue', [
      { name: 'a', at: '1' },
      { name: 'b', at: '2' },
      { name: 'c', at: '3' },
    ]);
    let calls = 0;
    const flaky = vi.fn<typeof fetch>(async () => {
      calls += 1;
      return new Response(null, { status: calls === 3 ? 500 : 201 });
    });
    const sent = await flushQueue({ endpoint: 'https://api.example.com', fetchImpl: flaky });
    expect(sent).toBe(2);
    expect((mem.get('telemetry:queue') as Array<{ name: string }>).map((e) => e.name)).toEqual(['c']);
    expect(JSON.parse(String(flaky.mock.calls[0]?.[1]?.body)).name).toBe('a');
  });

  it('drops rejected (4xx) events instead of queueing them', async () => {
    const rejecting = vi.fn<typeof fetch>(async () => new Response(null, { status: 400 }));
    const ok = await track({ name: 'quest.complete' }, { endpoint: 'https://api.example.com', fetchImpl: rejecting });
    expect(ok).toBe(false);
    expect(mem.has('telemetry:queue')).toBe(false);
    mem.set('telemetry:queue', [{ name: 'bad', at: '1' }, { name: 'good', at: '2' }]);
    let n = 0;
    const mixed = vi.fn<typeof fetch>(async () => new Response(null, { status: (n += 1) === 1 ? 400 : 201 }));
    expect(await flushQueue({ endpoint: 'https://api.example.com', fetchImpl: mixed })).toBe(1);
    expect(mem.get('telemetry:queue')).toEqual([]);
  });

  it('never queues for the placeholder endpoint', async () => {
    const failing = vi.fn<typeof fetch>(async () => {
      throw new Error('offline');
    });
    await track({ name: 'session.start' }, { fetchImpl: failing });
    expect(mem.has('telemetry:queue')).toBe(false);
    expect(failing).not.toHaveBeenCalled();
  });
});
