import { PIN_SET_AT_KEY } from '@hangul-route/content-schema';
import { create } from 'zustand';
import type { SubscriptionState } from '../logic/entitlement';
import { INITIAL_ATTEMPT_STATE, type AttemptState } from '../logic/profiles/pin-hash';
import { startResetWait } from '../logic/profiles/pin-reset';
import { PIN_HASH_SEEN_KEY, pinHashFingerprint, reconcilePinEpoch as nextPinEpoch } from '../logic/shell/device-gate';
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
// The PIN epoch behind the device gate marker (F-APP-001 section 3.9): when the current PIN was
// set (`account:pinSetAt`, epoch ms), and the fingerprint of the hash this app last saw
// (`account:pinHashSeen`), so a PIN changed by an older bundle still moves the epoch.

function finiteTime(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

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
  /** Epoch ms the current PIN was set; null for a PIN set before F-APP-001 A-6 (read as epoch 0) or no PIN yet. */
  pinSetAt: number | null;
  /** Fingerprint of the stored PIN hash last seen (`NO_PIN_SEEN` without a PIN); null before the first look. */
  pinHashSeen: string | null;
  pinAttempts: AttemptState;
  hydrated: boolean;
}

interface Actions {
  hydrate: () => Promise<void>;
  setParentEmail: (email: string) => void;
  acceptGuardianConsent: () => void;
  acceptSelfConsent: () => void;
  /** Starts the Forgot PIN wait; a pending request keeps its original time. */
  requestPinReset: () => void;
  clearPinResetRequest: () => void;
  setSubscription: (subscription: SubscriptionState | null) => void;
  /** Stores the PIN hash; every new PIN (first set, change, Forgot PIN reset) moves the epoch to now. */
  setParentPinHash: (hash: string | null) => void;
  setPinAttempts: (state: AttemptState) => void;
  /**
   * Boot step of the device gate marker writer: a hash that differs from the one last seen was
   * changed by an older bundle, so the epoch moves to `now` before the marker is written.
   */
  reconcilePinEpoch: (now: number) => void;
}

export const useAccountStore = create<State & Actions>((set, get) => ({
  parentEmail: null,
  consentAcceptedAt: null,
  guardianConsentAcceptedAt: null,
  selfConsentAcceptedAt: null,
  pinResetRequestedAt: null,
  subscription: null,
  parentPinHash: null,
  pinSetAt: null,
  pinHashSeen: null,
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
    const pinSetAt = await readJson<unknown>(PIN_SET_AT_KEY);
    const pinHashSeen = await readJson<unknown>(PIN_HASH_SEEN_KEY);
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
      pinSetAt: finiteTime(pinSetAt),
      pinHashSeen: typeof pinHashSeen === 'string' ? pinHashSeen : null,
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
    // A new PIN gets a new epoch (F-APP-001 section 3.9), so a PIN a child set or reset never
    // opens the grown-up area until a grown-up signs in again; removing the PIN keeps the epoch.
    const pinSetAt = hash === null ? get().pinSetAt : Date.now();
    const pinHashSeen = pinHashFingerprint(hash);
    set({
      parentPinHash: hash,
      pinSetAt,
      pinHashSeen,
      pinAttempts: INITIAL_ATTEMPT_STATE,
      ...(hadReset ? { pinResetRequestedAt: null } : {}),
    });
    void writeJson(PIN_HASH_KEY, hash);
    if (hash !== null) void writeJson(PIN_SET_AT_KEY, pinSetAt);
    void writeJson(PIN_HASH_SEEN_KEY, pinHashSeen);
    void writeJson(PIN_ATTEMPTS_KEY, INITIAL_ATTEMPT_STATE);
    if (hadReset) void writeJson(PIN_RESET_KEY, null);
  },

  setPinAttempts: (state) => {
    set({ pinAttempts: state });
    void writeJson(PIN_ATTEMPTS_KEY, state);
  },

  reconcilePinEpoch: (now) => {
    const { parentPinHash, pinSetAt, pinHashSeen } = get();
    const next = nextPinEpoch({ parentPinHash, pinSetAt, pinHashSeen }, now);
    if (next === null) return;
    set(next);
    if (next.pinSetAt !== pinSetAt && next.pinSetAt !== null) void writeJson(PIN_SET_AT_KEY, next.pinSetAt);
    void writeJson(PIN_HASH_SEEN_KEY, next.pinHashSeen);
  },
}));
