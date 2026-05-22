import { create } from 'zustand';
import type { SubscriptionState } from '../logic/entitlement';
import { readJson, writeJson } from '../platform/storage';

/**
 * Family-level account settings, persisted across sessions.
 * Separate from per-child `profile-store`: one parent email, one COPPA
 * consent record, and one subscription cover every child profile on the device.
 */

const EMAIL_KEY = 'account:parentEmail';
const CONSENT_KEY = 'account:consentAcceptedAt';
const SUBSCRIPTION_KEY = 'account:subscription';

interface State {
  parentEmail: string | null;
  consentAcceptedAt: string | null;
  subscription: SubscriptionState | null;
  hydrated: boolean;
}

interface Actions {
  hydrate: () => Promise<void>;
  setParentEmail: (email: string) => void;
  acceptConsent: () => void;
  setSubscription: (subscription: SubscriptionState | null) => void;
}

export const useAccountStore = create<State & Actions>((set) => ({
  parentEmail: null,
  consentAcceptedAt: null,
  subscription: null,
  hydrated: false,

  hydrate: async () => {
    const parentEmail = await readJson<string | null>(EMAIL_KEY);
    const consentAcceptedAt = await readJson<string | null>(CONSENT_KEY);
    const subscription = await readJson<SubscriptionState | null>(SUBSCRIPTION_KEY);
    set({
      parentEmail: parentEmail ?? null,
      consentAcceptedAt: consentAcceptedAt ?? null,
      subscription: subscription ?? null,
      hydrated: true,
    });
  },

  setParentEmail: (email) => {
    const value = email.trim() || null;
    set({ parentEmail: value });
    void writeJson(EMAIL_KEY, value);
  },

  acceptConsent: () => {
    const now = new Date().toISOString();
    set({ consentAcceptedAt: now });
    void writeJson(CONSENT_KEY, now);
  },

  setSubscription: (subscription) => {
    set({ subscription });
    void writeJson(SUBSCRIPTION_KEY, subscription);
  },
}));
