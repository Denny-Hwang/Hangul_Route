import type { Profile } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** AsyncStorage through the wrapper, with a switch per key for a read that fails (strict and exact reads throw). */
const disk = vi.hoisted(() => ({ mem: new Map<string, unknown>(), failing: new Set<string>(), damaged: new Set<string>(), lenientFails: new Set<string>() }));
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => (disk.failing.has(k) || disk.damaged.has(k) || disk.lenientFails.has(k) ? null : (disk.mem.get(k) ?? null))),
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
  removeKey: vi.fn(async (k: string) => {
    disk.mem.delete(k);
  }),
  // One read-modify-write: a failed read rejects and writes nothing; a damaged value reads as null.
  updateJson: vi.fn(async (k: string, next: (current: unknown) => unknown) => {
    if (disk.failing.has(k)) throw new Error('storage');
    const value = next(disk.damaged.has(k) ? null : (disk.mem.get(k) ?? null));
    if (value === undefined) return false;
    disk.mem.set(k, value);
    return true;
  }),
}));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../../platform/locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: () => {} }));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));

import { updateJson, writeJson } from '../../platform/storage';
import { SUBSCRIPTION_COVERS_KEY, useAccountStore, watchCoveredLearners } from '../account-store';
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
const writesOfRecord = (): number =>
  vi.mocked(writeJson).mock.calls.filter(([k]) => k === SUBSCRIPTION_COVERS_KEY).length +
  vi.mocked(updateJson).mock.results.filter((r, i) => vi.mocked(updateJson).mock.calls[i]?.[0] === SUBSCRIPTION_COVERS_KEY && r.type === 'return').length;
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  disk.mem.clear();
  disk.failing.clear();
  disk.damaged.clear();
  disk.lenientFails.clear();
  vi.mocked(writeJson).mockClear();
  vi.mocked(updateJson).mockClear();
});

describe('account:subscriptionCovers (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D15, section 10.5)', () => {
  it('with a premium legacy subscription, records every learner profile on the device once', async () => {
    disk.mem.set('account:subscription', ACTIVE);
    disk.mem.set(PROFILES_KEY, learners);
    await start();
    await useAccountStore.getState().recordSubscriptionCovers(now);

    const expected = { v: 1, ids: ['profile:ana', 'profile:bo', 'profile:cy'], added: [], at: now.toISOString() };
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
    expect(useAccountStore.getState().subscriptionCovers).toEqual({ ...older, added: [] });
  });

  it('keeps a stored record the lenient start-up read missed, and writes nothing', async () => {
    const older = { v: 1, ids: ['profile:ana'], at: '2026-10-20T00:00:00.000Z' };
    disk.mem.set('account:subscription', ACTIVE);
    disk.mem.set(PROFILES_KEY, learners);
    disk.mem.set(SUBSCRIPTION_COVERS_KEY, older);
    disk.lenientFails.add(SUBSCRIPTION_COVERS_KEY);
    await start();
    expect(useAccountStore.getState().subscriptionCovers).toBeNull();
    await useAccountStore.getState().recordSubscriptionCovers(now);
    expect(useAccountStore.getState().subscriptionCovers).toEqual({ ...older, added: [] });
    expect(record()).toEqual(older);
    expect(writesOfRecord()).toBe(0);
  });

  it('records a learner another tab stored after this start read the list, and keeps a record another tab made first', async () => {
    disk.mem.set('account:subscription', ACTIVE);
    disk.mem.set(PROFILES_KEY, learners);
    await start();
    disk.mem.set(PROFILES_KEY, [...learners, person('profile:dee'), { bad: true }]);
    await useAccountStore.getState().recordSubscriptionCovers(now);
    expect(record()).toMatchObject({ ids: ['profile:ana', 'profile:bo', 'profile:cy', 'profile:dee'] });

    // Another tab stores its record between this start's read and its write: that record is kept.
    const theirs = { v: 1, ids: ['profile:ana', 'profile:bo'], added: [], at: '2026-10-21T08:59:00.000Z' };
    disk.mem.delete(SUBSCRIPTION_COVERS_KEY);
    await start();
    const exact = vi.mocked(updateJson).getMockImplementation();
    vi.mocked(updateJson).mockImplementationOnce(async (k, next) => {
      disk.mem.set(k, theirs);
      return (exact as NonNullable<typeof exact>)(k, next);
    });
    await useAccountStore.getState().recordSubscriptionCovers(now);
    expect(record()).toEqual(theirs);
    expect(useAccountStore.getState().subscriptionCovers).toEqual(theirs);
  });

  it('remembers each newer learner it covers, so it is still covered after the next start', async () => {
    disk.mem.set('account:subscription', ACTIVE);
    disk.mem.set(SUBSCRIPTION_COVERS_KEY, { v: 1, ids: ['profile:ana', 'profile:bo'], at: '2026-10-20T00:00:00.000Z' });
    disk.mem.set(PROFILES_KEY, [...learners, person('profile:dee'), person('profile:eve')]);
    await start();
    await useAccountStore.getState().rememberCoveredLearners(now);
    expect(useAccountStore.getState().subscriptionCovers?.added).toEqual(['profile:cy', 'profile:dee']);
    expect(record()).toMatchObject({ ids: ['profile:ana', 'profile:bo'], added: ['profile:cy', 'profile:dee'] });
    await start();
    expect(useAccountStore.getState().subscriptionCovers?.added).toEqual(['profile:cy', 'profile:dee']);
  });

  it('remembers nothing without a record, a premium subscription or hydrated stores, and never writes over a damaged record', async () => {
    disk.mem.set(PROFILES_KEY, [...learners, person('profile:dee')]);
    await start();
    await useAccountStore.getState().rememberCoveredLearners(now);
    disk.mem.set(SUBSCRIPTION_COVERS_KEY, { v: 1, ids: ['profile:ana'], at: 't' });
    await start();
    await useAccountStore.getState().rememberCoveredLearners(now);
    expect(record()).toEqual({ v: 1, ids: ['profile:ana'], at: 't' });

    disk.mem.set('account:subscription', ACTIVE);
    await start();
    useProfileStore.setState({ hydrated: false });
    await useAccountStore.getState().rememberCoveredLearners(now);
    expect(writesOfRecord()).toBe(0);

    // The stored value turns out damaged: the in-memory cover holds for this session, and nothing is written.
    useProfileStore.setState({ hydrated: true });
    disk.damaged.add(SUBSCRIPTION_COVERS_KEY);
    await useAccountStore.getState().rememberCoveredLearners(now);
    expect(useAccountStore.getState().subscriptionCovers?.added).toEqual(['profile:bo', 'profile:cy', 'profile:dee']);
    expect(record()).toEqual({ v: 1, ids: ['profile:ana'], at: 't' });
  });

  it('keeps what another tab remembered meanwhile', async () => {
    disk.mem.set('account:subscription', ACTIVE);
    disk.mem.set(PROFILES_KEY, learners);
    disk.mem.set(SUBSCRIPTION_COVERS_KEY, { v: 1, ids: ['profile:ana'], at: 't' });
    await start();
    disk.mem.set(SUBSCRIPTION_COVERS_KEY, { v: 1, ids: ['profile:ana'], added: ['profile:zed'], at: 't' });
    await useAccountStore.getState().rememberCoveredLearners(now);
    expect(record()).toEqual({ v: 1, ids: ['profile:ana'], added: ['profile:zed', 'profile:bo', 'profile:cy'], at: 't' });
    expect(useAccountStore.getState().subscriptionCovers?.added).toEqual(['profile:zed', 'profile:bo', 'profile:cy']);
  });

  it('remove, add, restore through the profile store: a covered newer learner keeps premium (section 10.5)', async () => {
    const ana = person('profile:ana');
    disk.mem.set('account:subscription', ACTIVE);
    disk.mem.set(PROFILES_KEY, [ana, person('profile:bo')]);
    disk.mem.set(SUBSCRIPTION_COVERS_KEY, { v: 1, ids: ['profile:ana', 'profile:bo'], at: 't' });
    await start();
    watchCoveredLearners();
    watchCoveredLearners();
    const { effectiveTier } = await import('../tier-store');
    const store = useProfileStore.getState();
    const cy = store.createProfile({ displayName: 'Cy', ageGroup: '8-9', avatar: 'hoya-blue' });
    const dee = store.createProfile({ displayName: 'Dee', ageGroup: '8-9', avatar: 'hoya-blue' });
    expect(useAccountStore.getState().subscriptionCovers?.added).toEqual([cy.id, dee.id]);
    store.remove(cy.id);
    const eve = store.createProfile({ displayName: 'Eve', ageGroup: '8-9', avatar: 'hoya-blue' });
    expect(effectiveTier(eve.id, now).tier).toBe('free');
    store.adoptProfile(cy);
    expect(effectiveTier(cy.id, now).tier).toBe('premium');
    expect(effectiveTier(dee.id, now).tier).toBe('premium');
    await settle();
    expect(record()).toMatchObject({ added: [cy.id, dee.id] });
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
    const update = vi.mocked(updateJson).getMockImplementation();
    vi.mocked(updateJson).mockImplementation(async (k, next) => {
      if (k === SUBSCRIPTION_COVERS_KEY) throw new Error('disk full');
      return (update as NonNullable<typeof update>)(k, next);
    });
    await expect(hydrateLearnerData()).resolves.toBeUndefined();
    expect(record()).toBeUndefined();
    expect(useAccountStore.getState().subscriptionCovers).toBeNull();
    if (write) vi.mocked(writeJson).mockImplementation(write);
    if (update) vi.mocked(updateJson).mockImplementation(update);

    useAccountStore.setState({ subscription: null, subscriptionCovers: null, hydrated: false });
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: false });
    await hydrateLearnerData();
    expect(record()).toMatchObject({ v: 1, ids: ['profile:ana', 'profile:bo', 'profile:cy'] });
  });
});
