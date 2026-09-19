import { create } from 'zustand';
import type { SubscriptionState } from '../logic/entitlement';
import { INITIAL_ATTEMPT_STATE, type AttemptState } from '../logic/profiles/pin-hash';
import { readJson, writeJson } from '../platform/storage';

/**
 * Family-level account settings, persisted across sessions.
 * Separate from per-child `profile-store`: one parent email, one COPPA
 * consent record, and one subscription cover every child profile on the device.
 */

const EMAIL_KEY = 'account:parentEmail';
const CONSENT_KEY = 'account:consentAcceptedAt';
const SUBSCRIPTION_KEY = 'account:subscription';
// Family-level grown-up PIN (F-PROF-001 §10 interim: one PIN per device until
// parent-first onboarding ships). Attempt state persists so a force-quit
// cannot clear an active cooldown (§3.1).
const PIN_HASH_KEY = 'account:parentPinHash';
const PIN_ATTEMPTS_KEY = 'account:pinAttempts';

interface State {
  parentEmail: string | null;
  consentAcceptedAt: string | null;
  subscription: SubscriptionState | null;
  parentPinHash: string | null;
  pinAttempts: AttemptState;
  hydrated: boolean;
}

interface Actions {
  hydrate: () => Promise<void>;
  setParentEmail: (email: string) => void;
  acceptConsent: () => void;
  setSubscription: (subscription: SubscriptionState | null) => void;
  setParentPinHash: (hash: string | null) => void;
  setPinAttempts: (state: AttemptState) => void;
}

export const useAccountStore = create<State & Actions>((set) => ({
  parentEmail: null,
  consentAcceptedAt: null,
  subscription: null,
  parentPinHash: null,
  pinAttempts: INITIAL_ATTEMPT_STATE,
  hydrated: false,

  hydrate: async () => {
    const parentEmail = await readJson<string | null>(EMAIL_KEY);
    const consentAcceptedAt = await readJson<string | null>(CONSENT_KEY);
    const subscription = await readJson<SubscriptionState | null>(SUBSCRIPTION_KEY);
    const parentPinHash = await readJson<string | null>(PIN_HASH_KEY);
    const pinAttempts = await readJson<AttemptState | null>(PIN_ATTEMPTS_KEY);
    set({
      parentEmail: parentEmail ?? null,
      consentAcceptedAt: consentAcceptedAt ?? null,
      subscription: subscription ?? null,
      parentPinHash: parentPinHash ?? null,
      pinAttempts: pinAttempts ?? INITIAL_ATTEMPT_STATE,
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

  setParentPinHash: (hash) => {
    set({ parentPinHash: hash, pinAttempts: INITIAL_ATTEMPT_STATE });
    void writeJson(PIN_HASH_KEY, hash);
    void writeJson(PIN_ATTEMPTS_KEY, INITIAL_ATTEMPT_STATE);
  },

  setPinAttempts: (state) => {
    set({ pinAttempts: state });
    void writeJson(PIN_ATTEMPTS_KEY, state);
  },
}));
