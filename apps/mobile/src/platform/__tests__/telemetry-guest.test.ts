import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON GU-D15, section 12, CS-G7 (row GU-2, section 19): `track()` drops `profileId`
 * from every event while this tab is in a guest run, and from every event whose `profileId` is the live guest's id
 * (not a profile here) when no run is on: Welcome's Add my name, a `GuestLater` reopen, the hydrate repair, the sweep
 * and `guest.expired`. A guest is in no experiment: no `exp.exposure` is sent for one. Every request body is read.
 */
vi.mock('../../config/flags', () => ({
  flags: { voiceEchoEnabled: false, telemetryEnabled: true, telemetryNetwork: true },
}));
const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  readJsonStrict: vi.fn(async (k: string) => mem.get(k) ?? null),
  readJsonExact: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
  listKeys: vi.fn(async () => [...mem.keys()]),
}));
vi.mock('../profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
vi.mock('../locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: vi.fn() }));
vi.mock('../device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
vi.mock('../app-visibility', () => ({ subscribeAppVisibility: () => () => undefined }));
vi.mock('../app-root', () => ({ peekBootIntent: () => null, consumeBootIntent: () => undefined }));
vi.mock('../join-handoff', () => ({ takeJoinHandoff: () => null }));

import { TELEMETRY_EVENT_NAMES, type GuestRecord, type Profile } from '@hangul-route/content-schema';
import { useGuestStore } from '../../store/guest-store';
import { hydrateGuest } from '../../store/guest-sweep';
import { useProfileStore } from '../../store/profile-store';
import { onProfileRemoved } from '../../store/profile-removal';
import { setTelemetryProfileFilter } from '../telemetry-filter';
import { addTelemetryListener, track } from '../telemetry';

const endpoint = 'https://api.example.com';
const GUEST: GuestRecord = { v: 1, id: 'profile:guest001', startedAt: '2026-10-22T09:00:00.000Z', lastAt: '2026-10-22T09:00:00.000Z', via: 'site', questDone: true };
const MINA: Profile = { id: 'profile:mina0001', displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-blue', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z' };

let fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>;
const bodies = (): { name: string; profileId?: string }[] => fetchImpl.mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as { name: string; profileId?: string });

beforeEach(() => {
  mem.clear();
  fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 201 }));
  useProfileStore.setState({ profiles: [MINA], activeId: MINA.id, hydrated: true });
  useGuestStore.setState({ record: GUEST, running: false, hydrated: true, memoryOnly: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('[GU] a guest run sends no profileId (GU-D15)', () => {
  it('every event name sent while running, quest and game names included, goes without a profileId (no exp.exposure at all)', async () => {
    useGuestStore.setState({ running: true });
    for (const name of TELEMETRY_EVENT_NAMES) await track({ name, profileId: GUEST.id, payload: {} }, { endpoint, fetchImpl });
    const sent = bodies();
    expect(sent.map((b) => b.name)).toEqual(TELEMETRY_EVENT_NAMES.filter((n) => n !== 'exp.exposure'));
    expect(sent.filter((b) => 'profileId' in b)).toEqual([]);
  });

  it('while running, an event naming another profile goes without it too', async () => {
    useGuestStore.setState({ running: true });
    await track({ name: 'session.end', profileId: MINA.id }, { endpoint, fetchImpl });
    expect(bodies()).toEqual([expect.not.objectContaining({ profileId: expect.anything() })]);
  });
});

describe('[GU] the entries that use the guest id without a run (section 12)', () => {
  it('Welcome\'s Add my name and a GuestLater reopen: an event for the live guest id goes without it', async () => {
    await track({ name: 'onboarding.started', profileId: GUEST.id, payload: { firstRun: true, fromGuest: true } }, { endpoint, fetchImpl });
    await track({ name: 'guest.started', profileId: GUEST.id, payload: { via: 'welcome', resumed: true } }, { endpoint, fetchImpl });
    expect(bodies().map((b) => b.profileId)).toEqual([undefined, undefined]);
    expect(await track({ name: 'exp.exposure', profileId: GUEST.id, payload: {} }, { endpoint, fetchImpl })).toBe(false);
  });

  it('a learner on the list keeps its own profileId outside a run', async () => {
    await track({ name: 'session.start', profileId: MINA.id }, { endpoint, fetchImpl });
    expect(bodies()).toEqual([expect.objectContaining({ profileId: MINA.id })]);
  });

  it('the hydrate repair sends nothing; the sweep sends guest.expired with no profileId', async () => {
    const heard: { name: string; profileId?: string; payload?: unknown }[] = [];
    const stop = addTelemetryListener((event) => heard.push(event));
    useGuestStore.setState({ record: null, hydrated: false });
    mem.set('guest', GUEST);
    useProfileStore.setState({ profiles: [MINA, { ...MINA, id: GUEST.id }] });
    expect(await hydrateGuest(Date.parse(GUEST.lastAt))).toBe('repair');
    expect(heard).toEqual([]);
    useProfileStore.setState({ profiles: [MINA] });
    mem.set('guest', GUEST);
    expect(await hydrateGuest(Date.parse(GUEST.lastAt) + 8 * 24 * 60 * 60 * 1000)).toBe('sweep');
    await vi.waitFor(() => expect(heard).toEqual([{ name: 'guest.expired', payload: { questDone: true } }]));
    stop();
  });

  it('during the sweep (the record already out of the store) a removal listener that tracks with the id sends none', async () => {
    useGuestStore.setState({ record: null, hydrated: false });
    mem.set('guest', GUEST);
    const stop = onProfileRemoved((id) => {
      void track({ name: 'session.end', profileId: id }, { endpoint, fetchImpl });
      void track({ name: 'exp.exposure', profileId: id, payload: {} }, { endpoint, fetchImpl });
    });
    expect(await hydrateGuest(Date.parse(GUEST.lastAt) + 8 * 24 * 60 * 60 * 1000)).toBe('sweep');
    stop();
    await vi.waitFor(() => expect(bodies().map((b) => b.name)).toContain('session.end'));
    expect(bodies().filter((b) => b.name === 'exp.exposure')).toEqual([]);
    expect(bodies().filter((b) => 'profileId' in b)).toEqual([]);
    // After the sweep the id is no one's: the filter no longer holds it.
    await track({ name: 'session.end', profileId: MINA.id }, { endpoint, fetchImpl });
    expect(bodies().at(-1)).toMatchObject({ profileId: MINA.id });
  });

  it('once the guest is saved its id is an ordinary learner\'s again', async () => {
    useProfileStore.setState({ profiles: [MINA, { ...MINA, id: GUEST.id }] });
    await track({ name: 'session.start', profileId: GUEST.id }, { endpoint, fetchImpl });
    expect(bodies()).toEqual([expect.objectContaining({ profileId: GUEST.id })]);
  });
});

// Last in the file: it lifts the guest store's filter.
describe('the filter seam (telemetry-filter.ts)', () => {
  it('a filter that throws sends the event without its profileId; null lifts the filter', async () => {
    setTelemetryProfileFilter(() => {
      throw new Error('boom');
    });
    await track({ name: 'session.start', profileId: MINA.id }, { endpoint, fetchImpl });
    setTelemetryProfileFilter(null);
    useGuestStore.setState({ running: true });
    await track({ name: 'session.end', profileId: MINA.id }, { endpoint, fetchImpl });
    expect(bodies().map((b) => b.profileId)).toEqual([undefined, MINA.id]);
  });
});
