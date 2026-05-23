import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  writeJson: vi.fn(),
}));

import type { SubscriptionState } from '../../logic/entitlement';
import { useAccountStore } from '../account-store';

describe('account-store', () => {
  beforeEach(() => {
    useAccountStore.setState({
      parentEmail: null,
      consentAcceptedAt: null,
      subscription: null,
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
});
