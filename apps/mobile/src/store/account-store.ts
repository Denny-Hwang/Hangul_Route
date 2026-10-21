import { PIN_SET_AT_KEY } from '@hangul-route/content-schema';
import { create } from 'zustand';
import type { SubscriptionState } from '../logic/entitlement';
import {
  INITIAL_ATTEMPT_STATE,
  effectiveStrikes,
  mergeAttemptStates,
  normalizeAttemptState,
  verifyPin,
  type AttemptState,
  type PauseSchedule,
  type PinHasher,
  type PinVerifyResult,
} from '../logic/profiles/pin-hash';
import { attemptRescueCode, startResetWait, type RescueCodeResult } from '../logic/profiles/pin-reset';
import {
  PIN_HASH_SEEN_KEY,
  PIN_HASH_UNREAD,
  pinHashSeenOf,
  pinHashFingerprint,
  pinSetAtOf,
  reconcilePinEpoch as nextPinEpoch,
} from '../logic/shell/device-gate';
import { readJson, readJsonExact, writeJson } from '../platform/storage';
import { announcePinAttempts } from '../platform/pin-attempts-channel';
import { PIN_ATTEMPTS_LOCK, withTabLock } from '../platform/tab-lock';

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
export const PIN_HASH_KEY = 'account:parentPinHash';
const PIN_ATTEMPTS_KEY = 'account:pinAttempts';
/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.3: the Rescue Code's own attempt state (same shape, 5 per 15
 * minutes, then a flat 15-minute pause), so the code stays usable while the PIN pad is paused.
 */
const RESCUE_ATTEMPTS_KEY = 'account:rescueAttempts';
/**
 * [OA] OA-D21: `{ v: 1, at }`, written when the finished 24-hour wait sets a PIN; the next Grown-up area entry
 * after a PIN shows the notice once and clears it. A reset by the Rescue Code (or a sign-in) writes nothing.
 */
const PIN_RESET_BY_WAIT_KEY = 'account:pinResetByWait';

/** [OA] The record of a PIN set by the finished 24-hour wait. */
export interface PinResetByWait {
  v: 1;
  at: number;
}

function pinResetByWaitOf(raw: unknown): PinResetByWait | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  return r.v === 1 && typeof r.at === 'number' && Number.isFinite(r.at) ? { v: 1, at: r.at } : null;
}

/**
 * [OA] Attempt state keys whose last write from this tab failed (a full or refusing storage): until a write lands
 * again, storage may hold an older state than this tab, so it is merged instead of trusted. In memory only.
 */
const unsavedAttempts = new Set<string>();

/**
 * [OA] OA-D19: the attempt state under `key`, read again inside the `hr:pin-attempts` lock. With Web Locks every
 * write of this bundle is serialised, so the stored state is the truth (another tab's correct PIN clears the pause
 * here too), except where it cannot be: nothing readable is stored (a first use, or a read that failed) and this
 * tab's own state stands; a state an older bundle wrote (no `strikes`) keeps its misses and pause but not a lower
 * step, so this tab's strikes stay (section 8.3); and after this tab's own write failed, the two are merged. Without
 * Web Locks (native, an older browser) another tab may have written meanwhile without seeing ours, so the two are
 * always merged (later pause, larger strikes after the decay, union of misses).
 */
async function sharedAttempts(key: string, own: AttemptState, locked: boolean, now: number): Promise<AttemptState> {
  const raw = await readJson<unknown>(key);
  const stored = normalizeAttemptState(raw);
  if (!locked || unsavedAttempts.has(key)) return mergeAttemptStates(stored, own, now);
  if (raw === null || typeof raw !== 'object') return own;
  if (typeof (raw as { strikes?: unknown }).strikes !== 'number') {
    const strikes = effectiveStrikes(own, now);
    return strikes === 0 ? stored : { ...stored, strikes, ...(own.lastMissAt === undefined ? {} : { lastMissAt: own.lastMissAt }) };
  }
  return stored;
}

/**
 * [OA] Best effort, as every other write of this store: a storage that refuses (quota, blocked site data, a lost
 * IndexedDB connection) never stops a correct PIN from going on, and the state stays counted in memory. A write
 * that landed tells the other tabs to re-read.
 */
async function saveAttempts(key: string, state: AttemptState): Promise<void> {
  try {
    await writeJson(key, state);
    unsavedAttempts.delete(key);
    announcePinAttempts();
  } catch {
    unsavedAttempts.add(key);
  }
}

/**
 * When the current PIN was made (epoch ms), F-SPACE-002 section 4.11: a PIN made less than a day ago
 * cannot attest a class move. Written with every new PIN, and moved with the epoch when an older bundle
 * changed the PIN; absent on a PIN set before this key, which counts as old enough.
 */
export const PIN_CREATED_AT_KEY = 'account:pinCreatedAt';
// The PIN epoch behind the device gate marker (F-APP-001 section 3.9): when the current PIN was
// set (`account:pinSetAt`, epoch ms), and the fingerprint of the hash this app last saw
// (`account:pinHashSeen`), so a PIN changed by an older bundle still moves the epoch.

/**
 * The fingerprint is read exactly: a read that fails, a value that does not parse and a value
 * that is not a fingerprint are not "nothing seen yet" (which keeps the epoch) but
 * `PIN_HASH_UNREAD`, which moves it, so a lost or damaged read can never hide a PIN change.
 */
async function readPinHashSeen(): Promise<string | null> {
  try {
    return pinHashSeenOf(await readJsonExact<unknown>(PIN_HASH_SEEN_KEY));
  } catch {
    return PIN_HASH_UNREAD;
  }
}

/**
 * The PIN hash, read exactly (A-6 review): a read that fails or a stored value that is not a hash
 * is `failed`, so the device gate marker and the epoch never take it for "no PIN". The screens
 * keep the lenient value, as before: a retry that finds a hash is not a failure.
 */
async function readPinHash(): Promise<{ hash: string | null; failed: boolean }> {
  try {
    const value = await readJsonExact<unknown>(PIN_HASH_KEY);
    if (value === null || typeof value === 'string') return { hash: value, failed: false };
    return { hash: null, failed: true };
  } catch {
    const retry = await readJson<unknown>(PIN_HASH_KEY);
    return typeof retry === 'string' ? { hash: retry, failed: false } : { hash: null, failed: true };
  }
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
  /** Epoch ms the current PIN was made (`account:pinCreatedAt`); null when unknown (a PIN older than the key, or no PIN). */
  pinCreatedAt: number | null;
  /** Fingerprint of the stored PIN hash last seen (`NO_PIN_SEEN` without a PIN); null before the first look, `PIN_HASH_UNREAD` when the read failed. */
  pinHashSeen: string | null;
  /**
   * The PIN hash could not be read at hydrate (or was damaged): the device gate marker is not
   * written and the epoch not reconciled until a PIN is set again (F-APP-001 section 3.9, A-6
   * review). In memory only.
   */
  pinHashReadFailed: boolean;
  pinAttempts: AttemptState;
  /** [OA] The Rescue Code's own attempt state (`account:rescueAttempts`). */
  rescueAttempts: AttemptState;
  /** [OA] A PIN set by the finished 24-hour wait, until the next Grown-up area entry shows it (`account:pinResetByWait`). */
  pinResetByWait: PinResetByWait | null;
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
   * [OA] Checks a PIN against the shared attempt state: read, verify and write run inside the `hr:pin-attempts`
   * lock (or re-read and merged without Web Locks), so all tabs share one count (OA-D19, CS-16).
   */
  verifyPinAttempt: (pin: string, deps: { hasher: PinHasher; schedule: PauseSchedule; now?: () => number }) => Promise<PinVerifyResult>;
  /** [OA] Checks a Rescue Code against its own shared attempt state, the same way (section 8.3). */
  attemptRescue: (entry: string, storedCodes: readonly string[], now?: () => number) => Promise<RescueCodeResult>;
  /** [OA] Re-reads the shared attempt states (under the same lock), so a pause another tab started or ended shows here too. */
  refreshAttempts: (now?: () => number) => Promise<void>;
  /** [OA] OA-D21: the finished 24-hour wait just set a PIN. */
  markPinResetByWait: (at: number) => void;
  /** [OA] The notice was shown at a Grown-up area entry. */
  clearPinResetByWait: () => void;
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
  pinCreatedAt: null,
  pinHashSeen: null,
  pinHashReadFailed: false,
  pinAttempts: INITIAL_ATTEMPT_STATE,
  rescueAttempts: INITIAL_ATTEMPT_STATE,
  pinResetByWait: null,
  hydrated: false,

  hydrate: async () => {
    const parentEmail = await readJson<string | null>(EMAIL_KEY);
    const consentAcceptedAt = await readJson<string | null>(CONSENT_KEY);
    const guardianConsentAcceptedAt = await readJson<string | null>(GUARDIAN_CONSENT_KEY);
    const selfConsentAcceptedAt = await readJson<string | null>(SELF_CONSENT_KEY);
    const pinResetRequestedAt = await readJson<string | null>(PIN_RESET_KEY);
    const subscription = await readJson<SubscriptionState | null>(SUBSCRIPTION_KEY);
    const pinHash = await readPinHash();
    const pinAttempts = await readJson<unknown>(PIN_ATTEMPTS_KEY);
    const rescueAttempts = await readJson<unknown>(RESCUE_ATTEMPTS_KEY);
    const pinResetByWait = await readJson<unknown>(PIN_RESET_BY_WAIT_KEY);
    const pinSetAt = await readJson<unknown>(PIN_SET_AT_KEY);
    const pinCreatedAt = await readJson<unknown>(PIN_CREATED_AT_KEY);
    const pinHashSeen = await readPinHashSeen();
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
      parentPinHash: pinHash.hash,
      pinHashReadFailed: pinHash.failed,
      pinSetAt: pinSetAtOf(pinSetAt),
      // A PIN made after the PIN epoch (F-APP-001 A-6) but before this key falls back to that epoch, so a PIN made
      // just before the upgrade still waits its day (F-SPACE-002 4.11); absent both, it predates them and counts as old enough.
      pinCreatedAt: pinSetAtOf(pinCreatedAt) ?? pinSetAtOf(pinSetAt),
      pinHashSeen,
      // A state an older bundle wrote (no `strikes`) reads as 0 strikes; the pause it holds still runs (section 8.3).
      pinAttempts: normalizeAttemptState(pinAttempts),
      rescueAttempts: normalizeAttemptState(rescueAttempts),
      pinResetByWait: pinResetByWaitOf(pinResetByWait),
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
    const pinCreatedAt = hash === null ? get().pinCreatedAt : pinSetAt;
    const pinHashSeen = pinHashFingerprint(hash);
    set({
      parentPinHash: hash,
      pinSetAt,
      pinCreatedAt,
      pinHashSeen,
      pinHashReadFailed: false,
      pinAttempts: INITIAL_ATTEMPT_STATE,
      ...(hadReset ? { pinResetRequestedAt: null } : {}),
    });
    void writeJson(PIN_HASH_KEY, hash);
    if (hash !== null) void writeJson(PIN_SET_AT_KEY, pinSetAt);
    if (hash !== null) void writeJson(PIN_CREATED_AT_KEY, pinCreatedAt);
    void writeJson(PIN_HASH_SEEN_KEY, pinHashSeen);
    // [OA] OA-D19: the setup path writes the attempt state inside the same lock as every verify.
    void withTabLock(PIN_ATTEMPTS_LOCK, () => saveAttempts(PIN_ATTEMPTS_KEY, INITIAL_ATTEMPT_STATE)).catch(() => undefined);
    if (hadReset) void writeJson(PIN_RESET_KEY, null);
  },

  setPinAttempts: (state) => {
    set({ pinAttempts: state });
    void writeJson(PIN_ATTEMPTS_KEY, state);
  },

  verifyPinAttempt: (pin, { hasher, schedule, now = Date.now }) =>
    withTabLock(PIN_ATTEMPTS_LOCK, async (locked) => {
      const at = now();
      const state = await sharedAttempts(PIN_ATTEMPTS_KEY, get().pinAttempts, locked, at);
      const result = await verifyPin({ pin, storedHash: get().parentPinHash, state, now: at, hasher, schedule });
      set({ pinAttempts: result.state });
      await saveAttempts(PIN_ATTEMPTS_KEY, result.state);
      return result;
    }),

  attemptRescue: (entry, storedCodes, now = Date.now) =>
    withTabLock(PIN_ATTEMPTS_LOCK, async (locked) => {
      const at = now();
      const state = await sharedAttempts(RESCUE_ATTEMPTS_KEY, get().rescueAttempts, locked, at);
      const result = attemptRescueCode({ entry, storedCodes, state, now: at });
      set({ rescueAttempts: result.state });
      await saveAttempts(RESCUE_ATTEMPTS_KEY, result.state);
      return result;
    }),

  refreshAttempts: (now = Date.now) =>
    // Read under the same lock as every verify, so the stored state is the truth where Web Locks exist (another
    // tab's correct PIN or reset clears the pause here too); without them it is merged, never shortening a pause.
    withTabLock(PIN_ATTEMPTS_LOCK, async (locked) => {
      const at = now();
      const pinAttempts = await sharedAttempts(PIN_ATTEMPTS_KEY, get().pinAttempts, locked, at);
      const rescueAttempts = await sharedAttempts(RESCUE_ATTEMPTS_KEY, get().rescueAttempts, locked, at);
      set({ pinAttempts, rescueAttempts });
    }),

  markPinResetByWait: (at) => {
    const record: PinResetByWait = { v: 1, at };
    set({ pinResetByWait: record });
    void writeJson(PIN_RESET_BY_WAIT_KEY, record);
  },

  clearPinResetByWait: () => {
    set({ pinResetByWait: null });
    void writeJson(PIN_RESET_BY_WAIT_KEY, null);
  },

  reconcilePinEpoch: (now) => {
    const { parentPinHash, pinSetAt, pinHashSeen, pinHashReadFailed } = get();
    // A hash that could not be read is not "no PIN": record nothing until it is known again.
    if (pinHashReadFailed) return;
    const next = nextPinEpoch({ parentPinHash, pinSetAt, pinHashSeen }, now);
    if (next === null) return;
    const moved = next.pinSetAt !== pinSetAt && next.pinSetAt !== null;
    // A PIN an older bundle changed is a new PIN: it is made now for the move rules too.
    set(moved ? { ...next, pinCreatedAt: next.pinSetAt } : next);
    if (moved) void writeJson(PIN_SET_AT_KEY, next.pinSetAt);
    if (moved) void writeJson(PIN_CREATED_AT_KEY, next.pinSetAt);
    void writeJson(PIN_HASH_SEEN_KEY, next.pinHashSeen);
  },
}));
