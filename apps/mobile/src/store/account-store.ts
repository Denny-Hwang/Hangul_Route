import { PIN_SET_AT_KEY, RESCUE_PAUSE_MS, type Profile } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { entitlementTier, type SubscriptionState } from '../logic/entitlement';
import {
  isLearnerProfile,
  mergeCovers,
  subscriptionCoversFor,
  subscriptionCoversOf,
  withNewerCovered,
  type SubscriptionCovers,
} from '../logic/legacy-subscription-covers';
import {
  INITIAL_ATTEMPT_STATE,
  PIN_MAX_PAUSE_MS,
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
import { readJson, readJsonExact, readJsonStrict, updateJson, writeJson } from '../platform/storage';
import { announcePinAttempts } from '../platform/pin-attempts-channel';
import { PIN_ATTEMPTS_LOCK, withTabLock } from '../platform/tab-lock';
import { PROFILES_KEY, useProfileStore } from './profile-store';

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
/** The learner profiles the legacy subscription covered when OA-8 first ran (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 10.5). */
export const SUBSCRIPTION_COVERS_KEY = 'account:subscriptionCovers';
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
 * [OA] The longest pause each counter can start: a stored pause that ends later than now plus this (a damaged
 * record, a clock that was ahead and was set back) is cut to it at every read (`normalizeAttemptState`).
 */
const MAX_PAUSE_MS: Readonly<Record<string, number>> = { [PIN_ATTEMPTS_KEY]: PIN_MAX_PAUSE_MS, [RESCUE_ATTEMPTS_KEY]: RESCUE_PAUSE_MS };

function readAttemptState(key: string, raw: unknown, now: number): AttemptState {
  return normalizeAttemptState(raw, { now, maxPauseMs: MAX_PAUSE_MS[key] ?? PIN_MAX_PAUSE_MS });
}

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
  const stored = readAttemptState(key, raw, now);
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
  /** `account:subscriptionCovers`; null until it is recorded, and while it is null the legacy subscription covers every profile. */
  subscriptionCovers: SubscriptionCovers | null;
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
  /**
   * Start-up step (OA-D15, section 10.5): with a premium legacy subscription and no record yet, records the learner
   * profiles on the device now, once. Only when the profile store is hydrated, the profile list reads back strictly and
   * the store holds at least one learner; otherwise nothing is recorded and the next start tries again.
   */
  recordSubscriptionCovers: (now: Date) => Promise<void>;
  /**
   * With a premium legacy subscription and a record, adds every newer learner it now covers to the record's `added`
   * (in memory at once, then stored), so a covered learner stays covered through a remove and a restore (section 10.5).
   */
  rememberCoveredLearners: (now: Date) => Promise<void>;
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
  subscriptionCovers: null,
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
    const subscriptionCovers = subscriptionCoversOf(await readJson<unknown>(SUBSCRIPTION_COVERS_KEY));
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
      subscriptionCovers,
      parentPinHash: pinHash.hash,
      pinHashReadFailed: pinHash.failed,
      pinSetAt: pinSetAtOf(pinSetAt),
      // A PIN made after the PIN epoch (F-APP-001 A-6) but before this key falls back to that epoch, so a PIN made
      // just before the upgrade still waits its day (F-SPACE-002 4.11); absent both, it predates them and counts as old enough.
      pinCreatedAt: pinSetAtOf(pinCreatedAt) ?? pinSetAtOf(pinSetAt),
      pinHashSeen,
      // A state an older bundle wrote (no `strikes`) reads as 0 strikes; the pause it holds still runs (section 8.3).
      pinAttempts: readAttemptState(PIN_ATTEMPTS_KEY, pinAttempts, Date.now()),
      rescueAttempts: readAttemptState(RESCUE_ATTEMPTS_KEY, rescueAttempts, Date.now()),
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

  recordSubscriptionCovers: async (now) => {
    const account = get();
    if (!account.hydrated || account.subscriptionCovers !== null) return;
    if (entitlementTier(account.subscription, now) !== 'premium') return;
    const profiles = useProfileStore.getState();
    // Nothing loaded yet, or a read that came back empty: try again on the next start (as `repairProfilePushes` does).
    if (!profiles.hydrated || !profiles.profiles.some(isLearnerProfile)) return;
    let storedProfiles: unknown;
    try {
      // The profile list must read back strictly: a failed or damaged read is not "these are all the learners".
      storedProfiles = await readJsonStrict<unknown>(PROFILES_KEY);
      if (!Array.isArray(storedProfiles)) return;
      // A record this start could not read is not "no record": it is never written over. One it reads now is kept.
      const stored = await readJsonExact<unknown>(SUBSCRIPTION_COVERS_KEY);
      if (stored !== null) {
        const parsed = subscriptionCoversOf(stored);
        if (parsed && get().subscriptionCovers === null) set({ subscriptionCovers: parsed });
        return;
      }
    } catch {
      return;
    }
    if (get().subscriptionCovers !== null) return;
    // Every learner in memory and every one stored (another web tab may have added one since this start read the list).
    const fromStorage = (storedProfiles as unknown[]).filter(
      (p): p is Pick<Profile, 'id' | 'role'> => typeof p === 'object' && p !== null && typeof (p as { id?: unknown }).id === 'string',
    );
    const record = subscriptionCoversFor([...useProfileStore.getState().profiles, ...fromStorage], now);
    // One read-modify-write, so two tabs starting together still make the record once. `exact`: only a truly missing
    // key is null here, so a value that became damaged since the read above rejects and is never written over.
    let kept = null as SubscriptionCovers | null;
    await updateJson<unknown>(
      SUBSCRIPTION_COVERS_KEY,
      (current) => {
        if (current === null) return record;
        kept = subscriptionCoversOf(current);
        return undefined;
      },
      { exact: true },
    );
    if (get().subscriptionCovers === null) set({ subscriptionCovers: kept ?? record });
  },

  rememberCoveredLearners: async (now) => {
    const account = get();
    const record = account.subscriptionCovers;
    if (!account.hydrated || record === null) return;
    if (entitlementTier(account.subscription, now) !== 'premium') return;
    const profiles = useProfileStore.getState();
    if (!profiles.hydrated) return;
    const next = withNewerCovered(record, profiles.profiles);
    if (next === record) return;
    // In memory first: no later change to the profile list in this session can take the cover back.
    set({ subscriptionCovers: next });
    let stored = null as SubscriptionCovers | null;
    await updateJson<unknown>(SUBSCRIPTION_COVERS_KEY, (current) => {
      const parsed = subscriptionCoversOf(current);
      // A stored value that is not a record is never written over (a failed read already rejected).
      if (parsed === null) return undefined;
      stored = mergeCovers(parsed, next);
      return stored === parsed ? undefined : stored;
    });
    // What another tab covered meanwhile is kept too.
    const current = get().subscriptionCovers;
    if (stored !== null && current !== null) {
      const both = mergeCovers(stored, current);
      if (JSON.stringify(both) !== JSON.stringify(current)) set({ subscriptionCovers: both });
    }
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
      // [OA] OA-D19: the PIN is checked against the stored hash, read again under the lock, so a tab left open after
      // another tab changed or reset the PIN never accepts the old one. A read that fails or finds no hash keeps the
      // one in memory (this tab's own write may not have landed yet).
      const stored = await readPinHash();
      const storedHash = !stored.failed && stored.hash !== null ? stored.hash : get().parentPinHash;
      if (storedHash !== get().parentPinHash) set({ parentPinHash: storedHash });
      const result = await verifyPin({ pin, storedHash, state, now: at, hasher, schedule });
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

let stopCoverWatch: (() => void) | null = null;

/**
 * From the start-up pass on, every change to the profile list (a learner made, restored or removed) remembers the newer
 * learners the legacy subscription now covers, at once (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 10.5). Once per app run:
 * a second call keeps the one watch. Returns the function that stops it (`stopWatchingCoveredLearners`).
 */
export function watchCoveredLearners(): () => void {
  if (stopCoverWatch) return stopWatchingCoveredLearners;
  stopCoverWatch = useProfileStore.subscribe((state, prev) => {
    if (state.profiles === prev.profiles) return;
    void useAccountStore
      .getState()
      .rememberCoveredLearners(new Date())
      .catch(() => undefined);
  });
  return stopWatchingCoveredLearners;
}

/** Stops the watch of `watchCoveredLearners`, so the next call starts a new one (tests; the app never stops it). */
export function stopWatchingCoveredLearners(): void {
  stopCoverWatch?.();
  stopCoverWatch = null;
}
