import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));

import { useAccountStore } from '../account-store';
import { unlockedStagesFor } from '../plan-store';
import { cachedTierIsPremium, effectiveTier, useTierStore } from '../tier-store';

const now = new Date('2026-09-21T12:00:00.000Z');
const source = { kind: 'class' as const, spaceId: 'space:c', name: 'Sunday Class A' };

beforeEach(() => {
  mem.clear();
  useTierStore.setState({ byLearner: {} });
  useAccountStore.setState({ subscription: null });
});

describe('tier-store (F-ENT-001 §3.4)', () => {
  it('caches the inbox tier with its grace window and persists it', async () => {
    const applied = useTierStore.getState().applyInbox('profile:a', { tier: 'premium', tierSource: source, tierValidUntil: '2026-09-28T12:00:00.000Z', serverTime: 't' });
    expect(applied).toEqual({ tier: 'premium', source, validUntil: '2026-09-28T12:00:00.000Z', fetchedAt: 't' });
    expect(mem.get('tier:profile:a')).toEqual(applied);
    useTierStore.setState({ byLearner: {} });
    expect(await useTierStore.getState().hydrate('profile:a')).toEqual(applied);
    expect(await useTierStore.getState().hydrate('profile:a')).toEqual(applied);
    expect(await useTierStore.getState().hydrate('profile:none')).toBeNull();
  });

  it('honours the cache until validUntil, then falls back to the legacy subscription', () => {
    expect(cachedTierIsPremium(undefined, now)).toBe(false);
    expect(cachedTierIsPremium({ tier: 'free', source: null, validUntil: null, fetchedAt: 't' }, now)).toBe(false);
    expect(cachedTierIsPremium({ tier: 'premium', source, validUntil: '2026-09-22T00:00:00.000Z', fetchedAt: 't' }, now)).toBe(true);
    expect(cachedTierIsPremium({ tier: 'premium', source, validUntil: '2026-09-20T00:00:00.000Z', fetchedAt: 't' }, now)).toBe(false);
    expect(cachedTierIsPremium({ tier: 'premium', source, validUntil: null, fetchedAt: 't' }, now)).toBe(true);

    useTierStore.getState().applyInbox('profile:a', { tier: 'premium', tierSource: source, tierValidUntil: '2026-09-28T12:00:00.000Z', serverTime: 't' });
    expect(effectiveTier('profile:a', now)).toEqual({ tier: 'premium', source });
    expect(unlockedStagesFor(now, 'profile:a')).toContain('stage2');
    expect(effectiveTier('profile:a', new Date('2026-10-01T00:00:00.000Z'))).toEqual({ tier: 'free', source: null });
    expect(unlockedStagesFor(new Date('2026-10-01T00:00:00.000Z'), 'profile:a')).toEqual(['stage1']);

    useAccountStore.setState({ subscription: { status: 'active', plan: 'monthly', expiresAt: '2027-01-01T00:00:00.000Z' } });
    expect(effectiveTier('profile:b', now)).toEqual({ tier: 'premium', source: null });
  });
});
