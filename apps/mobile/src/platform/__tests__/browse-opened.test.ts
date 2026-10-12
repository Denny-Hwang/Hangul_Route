import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedPass } from '../../logic/browse/pass';

/**
 * F-BROWSE-001 sections 4.4, 4.9 and 9 (BR-6): each time the browse root
 * resolves a link's pass (the first boot, and a later link in the same tab),
 * it applies the pass's UI language in memory once the device locale is read,
 * then sends `browse.opened` for that link's source from the browse queue and
 * flushes it. The event never names a person.
 */
const calls: string[] = [];
const track = vi.fn(async (event: { name: string }) => {
  calls.push(`track:${event.name}`);
  return true;
});
const flushQueue = vi.fn(async () => {
  calls.push('flush');
  return 0;
});
const setSessionLocale = vi.fn((locale: string | null) => {
  calls.push(`locale:${String(locale)}`);
});

vi.mock('../telemetry', () => ({ track, flushQueue }));

const { announceBrowseOpened } = await import('../browse-opened');

const active = (over: Partial<Extract<ResolvedPass, { status: 'active' }>> = {}): ResolvedPass => ({
  status: 'active',
  scope: 'sampler',
  from: 'account',
  fallback: false,
  removeSession: false,
  removeKept: false,
  ...over,
});

beforeEach(() => {
  calls.length = 0;
  track.mockClear();
  flushQueue.mockClear();
  setSessionLocale.mockClear();
});

describe('announceBrowseOpened', () => {
  it('sends browse.opened for the source with no profileId, then flushes the browse queue', async () => {
    await announceBrowseOpened({ source: 'report', resolved: active(), offlineReady: true, localeReady: Promise.resolve(), applyLocale: setSessionLocale });
    expect(track).toHaveBeenCalledWith({ name: 'browse.opened', payload: { source: 'report', scope: 'sampler', passFrom: 'account', offlineReady: true } });
    const event = track.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(event).not.toHaveProperty('profileId');
    expect(calls).toEqual(['track:browse.opened', 'flush']);
    expect(setSessionLocale).not.toHaveBeenCalled();
  });

  it("applies the pass's UI language once the device locale is read", async () => {
    let ready: () => void = () => undefined;
    const localeReady = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const done = announceBrowseOpened({ source: 'nav', resolved: active({ uiLocale: 'es' }), offlineReady: false, localeReady, applyLocale: setSessionLocale });
    await Promise.resolve();
    expect(setSessionLocale).not.toHaveBeenCalled();
    ready();
    await done;
    expect(setSessionLocale).toHaveBeenCalledWith('es');
  });

  it('no pass: scope and passFrom are none, and no language is applied', async () => {
    await announceBrowseOpened({
      source: 'direct',
      resolved: { status: 'none', reason: 'none', expiredSource: null, removeSession: false, removeKept: false },
      offlineReady: false,
      localeReady: Promise.resolve(),
      applyLocale: setSessionLocale,
    });
    expect(track).toHaveBeenCalledWith({ name: 'browse.opened', payload: { source: 'direct', scope: 'none', passFrom: 'none', offlineReady: false } });
    expect(setSessionLocale).not.toHaveBeenCalled();
  });

  it('a locale read that failed still sends the event', async () => {
    await announceBrowseOpened({ source: 'gate', resolved: active({ uiLocale: 'ko' }), offlineReady: false, localeReady: Promise.reject(new Error('closed')), applyLocale: setSessionLocale });
    expect(track).toHaveBeenCalledTimes(1);
    expect(flushQueue).toHaveBeenCalledTimes(1);
  });
});
