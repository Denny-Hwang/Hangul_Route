import { BROWSE_EVENT_NAMES, TELEMETRY_EVENT_NAMES } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * F-BROWSE-001 §4.10 (BR-3): what the browse root fences. Writes only to
 * `browse:pass`, `browse:prefs`, `browse:telemetry-queue` and `device:audio`;
 * telemetry only for the five `browse.*` names; its own telemetry queue key.
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

import { AUDIO_PREFS_KEY } from '../../store/audio-store';
import { BROWSE_TELEMETRY_QUEUE_KEY, BROWSE_WRITABLE_KEYS, applyBrowseFences, isBrowseEventName, isBrowseWritableKey } from '../browse-fences';
import { setWriteFence, setWriteFenceObserver, writePasses } from '../storage-fence';
import { LEARNER_TELEMETRY_QUEUE_KEY, configureTelemetryQueue, setTelemetryFence, track } from '../telemetry';

afterEach(() => {
  setWriteFence(null);
  setWriteFenceObserver(null);
  setTelemetryFence(null);
  configureTelemetryQueue(LEARNER_TELEMETRY_QUEUE_KEY);
  mem.clear();
});

describe('browse fences', () => {
  it('lists exactly the four keys Browse may write', () => {
    expect([...BROWSE_WRITABLE_KEYS]).toEqual(['browse:pass', 'browse:prefs', 'browse:telemetry-queue', 'device:audio']);
    expect(BROWSE_TELEMETRY_QUEUE_KEY).toBe('browse:telemetry-queue');
    expect(BROWSE_WRITABLE_KEYS).toContain(AUDIO_PREFS_KEY);
  });

  it('allows the listed keys only', () => {
    for (const key of BROWSE_WRITABLE_KEYS) expect(isBrowseWritableKey(key), key).toBe(true);
    for (const key of ['telemetry:queue', 'device:settings', 'profiles', 'profiles:active', 'progress:p1', 'account:session', 'settings:p1', 'browse:other', 'shell:lastPersona', 'browse:pass:x']) {
      expect(isBrowseWritableKey(key), key).toBe(false);
    }
  });

  it('allows the five browse.* names and no learner name', () => {
    for (const name of BROWSE_EVENT_NAMES) expect(isBrowseEventName(name), name).toBe(true);
    for (const name of TELEMETRY_EVENT_NAMES.filter((n) => !n.startsWith('browse.'))) expect(isBrowseEventName(name), name).toBe(false);
    expect(isBrowseEventName('browse.unknown')).toBe(false);
  });

  it('applyBrowseFences sets the write fence, the telemetry fence and the browse queue at once', async () => {
    applyBrowseFences();
    expect(writePasses('browse:prefs', 'write')).toBe(true);
    expect(writePasses('progress:p1', 'write')).toBe(false);
    expect(writePasses('telemetry:queue', 'remove')).toBe(false);

    const offline = vi.fn<typeof fetch>(async () => {
      throw new Error('offline');
    });
    expect(await track({ name: 'quest.complete', profileId: 'p1' }, { endpoint: 'https://api.example.com', fetchImpl: offline })).toBe(false);
    expect(offline).not.toHaveBeenCalled();
    await track({ name: 'browse.opened', payload: { source: 'gate' } }, { endpoint: 'https://api.example.com', fetchImpl: offline });
    expect(mem.has('telemetry:queue')).toBe(false);
    expect((mem.get('browse:telemetry-queue') as { name: string }[]).map((e) => e.name)).toEqual(['browse.opened']);
  });
});
