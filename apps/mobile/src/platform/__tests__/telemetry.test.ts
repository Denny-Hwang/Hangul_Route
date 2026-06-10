import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/flags', () => ({
  flags: { voiceEchoEnabled: false, telemetryEnabled: true, telemetryNetwork: true },
}));

import { flags } from '../../config/flags';
import { track } from '../telemetry';

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
