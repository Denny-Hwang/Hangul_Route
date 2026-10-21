import type { Profile } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The mobile vitest lane renders no components: the hook's one React call answers with the store snapshot.
const hook = vi.hoisted(() => ({ subscribe: null as null | ((onChange: () => void) => () => void) }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useSyncExternalStore: <T,>(subscribe: (onChange: () => void) => () => void, getSnapshot: () => T): T => {
      hook.subscribe = subscribe;
      return getSnapshot();
    },
  };
});
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
}));

import type { SubscriptionState } from '../../logic/entitlement';
import { useAccountStore } from '../account-store';
import { useProfileStore } from '../profile-store';
import { accessTier, effectiveTier, useAccessTier, useTierStore } from '../tier-store';

const now = new Date('2026-10-21T12:00:00.000Z');
const ACTIVE: SubscriptionState = { status: 'active', plan: 'yearly', expiresAt: '2027-10-01T00:00:00.000Z' };
const person = (n: number, role: Profile['role'] = 'learner'): Profile => ({
  id: `profile:p${n}`,
  displayName: `P${n}`,
  ageGroup: '8-9',
  avatar: 'hoya-green',
  role,
  createdAt: `2026-10-${String(n).padStart(2, '0')}T00:00:00.000Z`,
});
const ids = (...ns: number[]): string[] => ns.map((n) => `profile:p${n}`);
const covers = (...ns: number[]) => ({ v: 1 as const, ids: ids(...ns), added: [] as string[], at: '2026-10-21T00:00:00.000Z' });
const tierOf = (n: number): string => effectiveTier(`profile:p${n}`, now).tier;

function device(profiles: Profile[], subscription: SubscriptionState | null, record: ReturnType<typeof covers> | null): void {
  useProfileStore.setState({ profiles, activeId: profiles[0]?.id ?? null, hydrated: true });
  useAccountStore.setState({ subscription, subscriptionCovers: record, hydrated: true });
}

beforeEach(() => {
  useTierStore.setState({ byLearner: {}, spaceMembers: {} });
  device([], null, null);
});

describe('effectiveTier and the capped legacy subscription (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D15, section 10.5)', () => {
  it('until the record exists, the legacy subscription covers every profile, as before', () => {
    const six = [1, 2, 3, 4, 5, 6].map((n) => person(n));
    device(six, ACTIVE, null);
    expect([1, 2, 3, 4, 5, 6].map(tierOf)).toEqual(Array(6).fill('premium'));
  });

  it('nobody who had premium loses it: every recorded learner keeps it, five or more included (SA-D7)', () => {
    const five = [1, 2, 3, 4, 5].map((n) => person(n));
    device(five, null, null);
    // Before: premium for every profile.
    useAccountStore.setState({ subscription: ACTIVE });
    const before = [1, 2, 3, 4, 5].map(tierOf);
    useAccountStore.setState({ subscriptionCovers: covers(1, 2, 3, 4, 5) });
    expect([1, 2, 3, 4, 5].map(tierOf)).toEqual(before);
    expect(before).toEqual(Array(5).fill('premium'));
    // A sixth profile made later is the one the cap leaves out.
    useProfileStore.setState({ profiles: [...five, person(6)] });
    expect([1, 2, 3, 4, 5, 6].map(tierOf)).toEqual([...Array(5).fill('premium'), 'free']);
  });

  it('covers newer learners while fewer than 4 are covered, in creation order, and a grown-up takes no place', () => {
    device([person(1), person(2), person(9, 'parent'), person(3), person(4), person(5)], ACTIVE, covers(1, 2));
    expect([1, 2, 3, 4, 5].map(tierOf)).toEqual(['premium', 'premium', 'premium', 'premium', 'free']);
    expect(tierOf(9)).toBe('premium');
    expect(effectiveTier('profile:p5', now).source).toBeNull();
  });

  it('a 5th new profile after 4 recorded learners is free, and its access tier is too', () => {
    device([1, 2, 3, 4, 5].map((n) => person(n)), ACTIVE, covers(1, 2, 3, 4));
    expect(tierOf(5)).toBe('free');
    expect(accessTier('profile:p5', now)).toBe('free');
    expect(accessTier('profile:p4', now)).toBe('premium');
  });

  it('a space still covers a learner the legacy subscription does not', () => {
    device([1, 2, 3, 4, 5].map((n) => person(n)), ACTIVE, covers(1, 2, 3, 4));
    const source = { kind: 'family' as const, spaceId: 'space:f', name: 'Kim family' };
    useTierStore.getState().applyInbox('profile:p5', { tier: 'premium', tierSource: source, tierValidUntil: null, serverTime: 't' });
    expect(effectiveTier('profile:p5', now)).toEqual({ tier: 'premium', source });
  });

  it('a device with no legacy subscription, or one that has ended, is unaffected by the record', () => {
    device([person(1), person(2)], null, covers(1));
    expect([1, 2].map(tierOf)).toEqual(['free', 'free']);
    device([person(1), person(2)], { status: 'expired', plan: 'yearly', expiresAt: '2026-01-01T00:00:00.000Z' }, covers(1, 2));
    expect([1, 2].map(tierOf)).toEqual(['free', 'free']);
  });

  it('useAccessTier re-reads when the profile list changes; a remembered newer learner keeps its place when removed', () => {
    device([1, 2, 3, 4, 5].map((n) => person(n)), ACTIVE, { ...covers(1, 2, 3), added: ids(4) });
    expect(useAccessTier('profile:p5')).toBe('free');
    const onChange = vi.fn();
    const off = hook.subscribe?.(onChange);
    useProfileStore.setState({ profiles: [1, 2, 3, 5].map((n) => person(n)) });
    expect(onChange).toHaveBeenCalled();
    expect(useAccessTier('profile:p5')).toBe('free');
    // Restored at the end of the list, p4 is premium again.
    useProfileStore.setState({ profiles: [1, 2, 3, 5, 4].map((n) => person(n)) });
    expect(useAccessTier('profile:p4')).toBe('premium');
    off?.();
  });
});
