import { create } from 'zustand';
import type { SubscriptionState } from '../logic/entitlement';
import { INITIAL_ATTEMPT_STATE, type AttemptState } from '../logic/profiles/pin-hash';
import { startResetWait } from '../logic/profiles/pin-reset';
import { readJson, writeJson } from '../platform/storage';

/**
 * Family-level account settings, persisted across sessions.
 * Separate from per-child `profile-store`: one parent email, one COPPA
 * consent record, and one subscription cover every child profile on the device.
 */

const EMAIL_KEY = 'account:parentEmail';
// First consent of any kind (kept so anything reading it keeps working). Since
// F-LEARN-001 the kind is recorded separately below.
const CONSENT_KEY = 'account:consentAcceptedAt';
const GUARDIAN_CONSENT_KEY = 'account:guardianConsentAcceptedAt';
const SELF_CONSENT_KEY = 'account:selfConsentAcceptedAt';
// Start of the 24-hour "Forgot PIN" wait (F-LEARN-001 §3.5).
const PIN_RESET_KEY = 'account:pinResetRequestedAt';
const SUBSCRIPTION_KEY = 'account:subscription';
// Family-level grown-up PIN (F-PROF-001 §10 interim: one PIN per device until
// parent-first onboarding ships). Attempt state persists so a force-quit
// cannot clear an active cooldown (§3.1).
const PIN_HASH_KEY = 'account:parentPinHash';
const PIN_ATTEMPTS_KEY = 'account:pinAttempts';

interface State {
  parentEmail: string | null;
  consentAcceptedAt: string | null;
  /** A parent or guardian agreed (F-LEARN-001 §3.3). */
  guardianConsentAcceptedAt: string | null;
  /** A learner attested "13 or older" and agreed (F-LEARN-001 §3.3). */
  selfConsentAcceptedAt: string | null;
  /** ISO time the 24-hour Forgot PIN wait started, or null. */
  pinResetRequestedAt: string | null;
  subscription: SubscriptionState | null;
  parentPinHash: string | null;
  pinAttempts: AttemptState;
  hydrated: boolean;
}

interface Actions {
  hydrate: () => Promise<void>;
  setParentEmail: (email: string) => void;
  acceptGuardianConsent: () => void;
  acceptSelfConsent: () => void;
  /**
   * @deprecated The pre-F-LEARN-001 checkbox was a parent/guardian attestation,
   * so this is `acceptGuardianConsent`. Kept only so the current
   * CreateProfileScreen compiles; F-LEARN-001 PR 4b removes it.
   */
  acceptConsent: () => void;
  /** Starts the Forgot PIN wait; a pending request keeps its original time. */
  requestPinReset: () => void;
  clearPinResetRequest: () => void;
  setSubscription: (subscription: SubscriptionState | null) => void;
  setParentPinHash: (hash: string | null) => void;
  setPinAttempts: (state: AttemptState) => void;
}

export const useAccountStore = create<State & Actions>((set, get) => ({
  parentEmail: null,
  consentAcceptedAt: null,
  guardianConsentAcceptedAt: null,
  selfConsentAcceptedAt: null,
  pinResetRequestedAt: null,
  subscription: null,
  parentPinHash: null,
  pinAttempts: INITIAL_ATTEMPT_STATE,
  hydrated: false,

  hydrate: async () => {
    const parentEmail = await readJson<string | null>(EMAIL_KEY);
    const consentAcceptedAt = await readJson<string | null>(CONSENT_KEY);
    const guardianConsentAcceptedAt = await readJson<string | null>(GUARDIAN_CONSENT_KEY);
    const selfConsentAcceptedAt = await readJson<string | null>(SELF_CONSENT_KEY);
    const pinResetRequestedAt = await readJson<string | null>(PIN_RESET_KEY);
    const subscription = await readJson<SubscriptionState | null>(SUBSCRIPTION_KEY);
    const parentPinHash = await readJson<string | null>(PIN_HASH_KEY);
    const pinAttempts = await readJson<AttemptState | null>(PIN_ATTEMPTS_KEY);
    set({
      parentEmail: parentEmail ?? null,
      consentAcceptedAt: consentAcceptedAt ?? null,
      // Migration (F-LEARN-001 §3.10): before this spec the only consent was a
      // parent/guardian checkbox, so a stored `consentAcceptedAt` is a guardian
      // stamp. Derived in memory; nothing is written until the next change.
      // A device that already has a self stamp is from this build (the legacy
      // flow could not write one), where `consentAcceptedAt` is only "first
      // consent" and must not be read as a guardian's.
      guardianConsentAcceptedAt:
        guardianConsentAcceptedAt ?? (selfConsentAcceptedAt === null ? (consentAcceptedAt ?? null) : null),
      selfConsentAcceptedAt: selfConsentAcceptedAt ?? null,
      pinResetRequestedAt: pinResetRequestedAt ?? null,
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

  acceptGuardianConsent: () => {
    const now = new Date().toISOString();
    const first = get().consentAcceptedAt === null;
    set(first ? { guardianConsentAcceptedAt: now, consentAcceptedAt: now } : { guardianConsentAcceptedAt: now });
    void writeJson(GUARDIAN_CONSENT_KEY, now);
    if (first) void writeJson(CONSENT_KEY, now);
  },

  acceptSelfConsent: () => {
    const now = new Date().toISOString();
    const first = get().consentAcceptedAt === null;
    set(first ? { selfConsentAcceptedAt: now, consentAcceptedAt: now } : { selfConsentAcceptedAt: now });
    void writeJson(SELF_CONSENT_KEY, now);
    if (first) void writeJson(CONSENT_KEY, now);
  },

  acceptConsent: () => get().acceptGuardianConsent(),

  requestPinReset: () => {
    const stamp = startResetWait(get().pinResetRequestedAt, Date.now());
    set({ pinResetRequestedAt: stamp });
    void writeJson(PIN_RESET_KEY, stamp);
  },

  clearPinResetRequest: () => {
    set({ pinResetRequestedAt: null });
    void writeJson(PIN_RESET_KEY, null);
  },

  setSubscription: (subscription) => {
    set({ subscription });
    void writeJson(SUBSCRIPTION_KEY, subscription);
  },

  setParentPinHash: (hash) => {
    // A stored PIN settles any pending Forgot PIN wait: the request is cleared
    // only after the new PIN is stored (F-LEARN-001 §3.5).
    const hadReset = get().pinResetRequestedAt !== null;
    set({ parentPinHash: hash, pinAttempts: INITIAL_ATTEMPT_STATE, ...(hadReset ? { pinResetRequestedAt: null } : {}) });
    void writeJson(PIN_HASH_KEY, hash);
    void writeJson(PIN_ATTEMPTS_KEY, INITIAL_ATTEMPT_STATE);
    if (hadReset) void writeJson(PIN_RESET_KEY, null);
  },

  setPinAttempts: (state) => {
    set({ pinAttempts: state });
    void writeJson(PIN_ATTEMPTS_KEY, state);
  },
}));
