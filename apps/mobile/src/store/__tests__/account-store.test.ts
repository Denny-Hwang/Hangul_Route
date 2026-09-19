import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  writeJson: vi.fn(),
}));

import type { SubscriptionState } from '../../logic/entitlement';
import { INITIAL_ATTEMPT_STATE } from '../../logic/profiles/pin-hash';
import { readJson } from '../../platform/storage';
import { useAccountStore } from '../account-store';

describe('account-store', () => {
  beforeEach(() => {
    useAccountStore.setState({
      parentEmail: null,
      consentAcceptedAt: null,
      subscription: null,
      parentPinHash: null,
      pinAttempts: INITIAL_ATTEMPT_STATE,
      hydrated: false,
    });
  });

  it('setParentEmail trims and stores', () => {
    useAccountStore.getState().setParentEmail('  mom@example.com  ');
    expect(useAccountStore.getState().parentEmail).toBe('mom@example.com');
  });

  it('setParentEmail with only whitespace clears to null', () => {
    useAccountStore.getState().setParentEmail('   ');
    expect(useAccountStore.getState().parentEmail).toBeNull();
  });

  it('acceptConsent records a timestamp', () => {
    useAccountStore.getState().acceptConsent();
    expect(useAccountStore.getState().consentAcceptedAt).toBeTruthy();
  });

  it('setSubscription stores and then clears', () => {
    const sub: SubscriptionState = { status: 'active', plan: 'yearly', expiresAt: '2099-12-31' };
    useAccountStore.getState().setSubscription(sub);
    expect(useAccountStore.getState().subscription).toEqual(sub);
    useAccountStore.getState().setSubscription(null);
    expect(useAccountStore.getState().subscription).toBeNull();
  });

  it('setParentPinHash stores the hash and clears any cooldown', () => {
    useAccountStore.getState().setPinAttempts({ failures: [1, 2], lockedUntil: 99 });
    useAccountStore.getState().setParentPinHash('salt:digest');
    expect(useAccountStore.getState().parentPinHash).toBe('salt:digest');
    expect(useAccountStore.getState().pinAttempts).toEqual(INITIAL_ATTEMPT_STATE);
  });

  it('setPinAttempts persists the attempt window', () => {
    const state = { failures: [10, 20], lockedUntil: null };
    useAccountStore.getState().setPinAttempts(state);
    expect(useAccountStore.getState().pinAttempts).toEqual(state);
  });

  it('hydrate restores the PIN hash and a persisted cooldown', async () => {
    vi.mocked(readJson).mockImplementation(async (key: string) => {
      if (key === 'account:parentPinHash') return 'salt:digest';
      if (key === 'account:pinAttempts') return { failures: [], lockedUntil: 5000 };
      return null;
    });
    await useAccountStore.getState().hydrate();
    expect(useAccountStore.getState().parentPinHash).toBe('salt:digest');
    expect(useAccountStore.getState().pinAttempts.lockedUntil).toBe(5000);
    expect(useAccountStore.getState().hydrated).toBe(true);
    vi.mocked(readJson).mockImplementation(async () => null);
  });
});
