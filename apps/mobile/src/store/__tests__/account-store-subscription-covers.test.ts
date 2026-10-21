import type { Profile } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** AsyncStorage through the wrapper, with a switch per key for a read that fails (strict and exact reads throw). */
const disk = vi.hoisted(() => ({ mem: new Map<string, unknown>(), failing: new Set<string>(), damaged: new Set<string>() }));
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => (disk.failing.has(k) || disk.damaged.has(k) ? null : (disk.mem.get(k) ?? null))),
  readJsonStrict: vi.fn(async (k: string) => {
    if (disk.failing.has(k)) throw new Error('storage');
    return disk.damaged.has(k) ? null : (disk.mem.get(k) ?? null);
  }),
  readJsonExact: vi.fn(async (k: string) => {
    if (disk.failing.has(k) || disk.damaged.has(k)) throw new Error('storage');
    return disk.mem.get(k) ?? null;
  }),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    disk.mem.set(k, v);
  }),
}));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../../platform/locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: () => {} }));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));

import { writeJson } from '../../platform/storage';
import { SUBSCRIPTION_COVERS_KEY, useAccountStore } from '../account-store';
import { hydrateLearnerData } from '../bootstrap';
import { PROFILES_KEY, useProfileStore } from '../profile-store';

const now = new Date('2026-10-21T09:00:00.000Z');
const ACTIVE = { status: 'active', plan: 'yearly', expiresAt: '2027-10-01T00:00:00.000Z' } as const;
const person = (id: string, role: Profile['role'] = 'learner'): Profile => ({ id, displayName: id.slice(8), ageGroup: '8-9', avatar: 'hoya-blue', role, createdAt: '2026-01-01T00:00:00.000Z' });
const learners = [person('profile:ana'), person('profile:bo'), person('profile:me', 'parent'), person('profile:cy')];

/** The device after a start: what is stored, read by both stores' own hydrates. */
async function start(): Promise<void> {
  useAccountStore.setState({ subscription: null, subscriptionCovers: null, hydrated: false });
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: false });
  await useProfileStore.getState().hydrate();
  await useAccountStore.getState().hydrate();
}

const record = (): unknown => disk.mem.get(SUBSCRIPTION_COVERS_KEY);
const writesOfRecord = (): number => vi.mocked(writeJson).mock.calls.filter(([k]) => k === SUBSCRIPTION_COVERS_KEY).length;

beforeEach(() => {
  disk.mem.clear();
  disk.failing.clear();
  disk.damaged.clear();
  vi.mocked(writeJson).mockClear();
});

describe('account:subscriptionCovers (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D15, section 10.5)', () => {
  it('with a premium legacy subscription, records every learner profile on the device once', async () => {
    disk.mem.set('account:subscription', ACTIVE);
    disk.mem.set(PROFILES_KEY, learners);
    await start();
    await useAccountStore.getState().recordSubscriptionCovers(now);

    const expected = { v: 1, ids: ['profile:ana', 'profile:bo', 'profile:cy'], at: now.toISOString() };
    expect(record()).toEqual(expected);
    expect(useAccountStore.getState().subscriptionCovers).toEqual(expected);

    // Recorded once: a later call and a later start with more learners leave it as it is.
    await useAccountStore.getState().recordSubscriptionCovers(new Date('2026-10-22T09:00:00.000Z'));
    disk.mem.set(PROFILES_KEY, [...learners, person('profile:dee')]);
    await start();
    expect(useAccountStore.getState().subscriptionCovers).toEqual(expected);
    await useAccountStore.getState().recordSubscriptionCovers(new Date('2026-10-23T09:00:00.000Z'));
    expect(record()).toEqual(expected);
    expect(writesOfRecord()).toBe(1);
  });

  it('records nothing on a device with no premium legacy subscription', async () => {
    disk.mem.set(PROFILES_KEY, learners);
    await start();
    await useAccountStore.getState().recordSubscriptionCovers(now);
    disk.mem.set('account:subscription', { status: 'expired', plan: 'yearly', expiresAt: '2026-01-01T00:00:00.000Z' });
    await start();
    await useAccountStore.getState().recordSubscriptionCovers(now);
    expect(record()).toBeUndefined();
    expect(useAccountStore.getState().subscriptionCovers).toBeNull();
  });

  it('records nothing before the profile store and the account have hydrated, and records at the next start', async () => {
    disk.mem.set('account:subscription', ACTIVE);
    disk.mem.set(PROFILES_KEY, learners);
    useProfileStore.setState({ profiles: learners, activeId: null, hydrated: false });
    useAccountStore.setState({ subscription: ACTIVE, subscriptionCovers: null, hydrated: true });
    await useAccountStore.getState().recordSubscriptionCovers(now);
    useProfileStore.setState({ hydrated: true });
    useAccountStore.setState({ hydrated: false });
    await useAccountStore.getState().recordSubscriptionCovers(now);
    expect(record()).toBeUndefined();

    await start();
    await useAccountStore.getState().recordSubscriptionCovers(now);
    expect(record()).toMatchObject({ ids: ['profile:ana', 'profile:bo', 'profile:cy'] });
  });

  it('records nothing when the profile list could not be read (an empty store), and records once it reads', async () => {
    disk.mem.set('account:subscription', ACTIVE);
    disk.mem.set(PROFILES_KEY, learners);
    disk.failing.add(PROFILES_KEY);
    await start();
    expect(useProfileStore.getState()).toMatchObject({ hydrated: true, profiles: [] });
    await useAccountStore.getState().recordSubscriptionCovers(now);
    expect(record()).toBeUndefined();

    disk.failing.clear();
    await start();
    await useAccountStore.getState().recordSubscriptionCovers(now);
    expect(record()).toMatchObject({ ids: ['profile:ana', 'profile:bo', 'profile:cy'] });
  });

  it('records nothing when the strict read of the profile list fails or reads damaged after the hydrate', async () => {
    disk.mem.set('account:subscription', ACTIVE);
    disk.mem.set(PROFILES_KEY, learners);
    await start();
    disk.failing.add(PROFILES_KEY);
    await useAccountStore.getState().recordSubscriptionCovers(now);
    disk.failing.clear();
    disk.damaged.add(PROFILES_KEY);
    await useAccountStore.getState().recordSubscriptionCovers(now);
    expect(record()).toBeUndefined();
    expect(useAccountStore.getState().subscriptionCovers).toBeNull();
  });

  it('records nothing for a device with no learner yet (only a grown-up), and records once a learner is there', async () => {
    disk.mem.set('account:subscription', ACTIVE);
    disk.mem.set(PROFILES_KEY, [person('profile:me', 'parent')]);
    await start();
    await useAccountStore.getState().recordSubscriptionCovers(now);
    expect(record()).toBeUndefined();

    disk.mem.set(PROFILES_KEY, [person('profile:me', 'parent'), person('profile:ana')]);
    await start();
    await useAccountStore.getState().recordSubscriptionCovers(now);
    expect(record()).toMatchObject({ ids: ['profile:ana'] });
  });

  it('never writes over a stored record this start could not read', async () => {
    const older = { v: 1, ids: ['profile:ana'], at: '2026-10-20T00:00:00.000Z' };
    disk.mem.set('account:subscription', ACTIVE);
    disk.mem.set(PROFILES_KEY, learners);
    disk.mem.set(SUBSCRIPTION_COVERS_KEY, older);
    disk.failing.add(SUBSCRIPTION_COVERS_KEY);
    await start();
    expect(useAccountStore.getState().subscriptionCovers).toBeNull();
    await useAccountStore.getState().recordSubscriptionCovers(now);
    expect(record()).toEqual(older);

    disk.failing.clear();
    await start();
    expect(useAccountStore.getState().subscriptionCovers).toEqual(older);
  });

  it('the start-up pass records it after hydrating, and a record that fails never holds up the start', async () => {
    disk.mem.set('account:subscription', ACTIVE);
    disk.mem.set(PROFILES_KEY, learners);
    useAccountStore.setState({ subscription: null, subscriptionCovers: null, hydrated: false });
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: false });
    const write = vi.mocked(writeJson).getMockImplementation();
    vi.mocked(writeJson).mockImplementation(async (k: string, v: unknown) => {
      if (k === SUBSCRIPTION_COVERS_KEY) throw new Error('disk full');
      await write?.(k, v);
    });
    await expect(hydrateLearnerData()).resolves.toBeUndefined();
    expect(record()).toBeUndefined();
    expect(useAccountStore.getState().subscriptionCovers).toBeNull();
    if (write) vi.mocked(writeJson).mockImplementation(write);

    useAccountStore.setState({ subscription: null, subscriptionCovers: null, hydrated: false });
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: false });
    await hydrateLearnerData();
    expect(record()).toMatchObject({ v: 1, ids: ['profile:ana', 'profile:bo', 'profile:cy'] });
  });
});
