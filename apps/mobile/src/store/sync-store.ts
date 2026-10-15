import { normalizeRescueCode, type AvatarKind, type Profile, type ProgressSnapshot } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { flags } from '../config/flags';
import { journeyContent, questJamo, stage1QuestIds } from '../content/sync-context';
import { journeySummaryOf, routeGoalSummaryOf } from '../logic/my-route/summary';
import {
  hasFields,
  mergePending,
  sendableFields,
  serverFieldsOf,
  shouldPullServerProfile,
  type PendingProfile,
  type ProfileServerFields,
  type ServerLearnerFields,
} from '../logic/sync/learner-profile';
import { buildActivity, deviceLocalDay } from '../logic/reports/activity';
import { syncLearner } from '../logic/sync/engine';
import { mergeSnapshots, rebaseSnapshot } from '../logic/sync/merge';
import { planRestore, type RestorePlan } from '../logic/sync/restore';
import { createSyncScheduler } from '../logic/sync/scheduler';
import { summarize } from '../logic/sync/summarize';
import { getDeviceId } from '../platform/device';
import { onInboxRead } from '../platform/inbox-events';
import { readJson, writeJson } from '../platform/storage';
import { apiBaseUrl, createSyncApi, type SyncApiClient } from '../platform/sync-api';
import { usePlanStore } from './plan-store';
import { onProfileEdited } from './profile-edits';
import { useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';
import { questOpenFor } from './tier-store';

/**
 * Background progress sync — F-SYNC-002 §3.1–3.2. One record per learner:
 * the device secret, the last acknowledged rev and the last outcome. The
 * store never throws and never blocks a screen.
 */
export type SyncStatus = 'off' | 'idle' | 'syncing' | 'synced' | 'error';

export interface LearnerSyncState {
  learnerId: string;
  secret: string | null;
  rev: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  status: SyncStatus;
  /** Rescue Code shown to a parent (F-RESTORE-001); kept locally, never synced. */
  rescueCode: string | null;
  /**
   * A name, level or avatar edit the server has not confirmed (F-PROF-001). Kept across restarts until a sync sends
   * it; a registration in the same pass already carried the current values, so it clears the edit too.
   */
  pendingProfile: PendingProfile | null;
  /** When the server copy of those fields was last set from this device (sent or taken); older inbox rows are stale. */
  profileAt: string | null;
}

/** The server's learner row on the inbox of the learner's own device (null `profileUpdatedAt`: never edited). */
export type InboxLearnerRow = ServerLearnerFields & { profileUpdatedAt: string | null };

/** A queued profile edit the one-time repair made (no edit behind it): it waits if another device already edited. */
type QueuedProfile = PendingProfile & { repair?: true };

/** Set once every registered learner's current name, level and avatar is queued for the server (one-time repair). */
export const PROFILE_PUSH_REPAIR_KEY = 'profilePushedV1';

interface State {
  byLearner: Record<string, LearnerSyncState>;
}

interface Actions {
  hydrate: (learnerId: string) => Promise<LearnerSyncState>;
  /** Debounced trigger for a progress write. */
  requestSync: (learnerId: string) => void;
  /** Run now for one learner (start, back-online, manual). */
  syncNow: (learnerId: string) => Promise<LearnerSyncState>;
  /** Sync every learner profile on the device. */
  syncAll: () => Promise<void>;
  /** Attach the device's own copy of a learner registered elsewhere (restore paths). */
  adoptCredentials: (learnerId: string, secret: string, rev: number) => void;
  /** Mint (or rotate) the learner's Rescue Code; requires a registered device. */
  issueRescueCode: (learnerId: string) => Promise<string | null>;
  /** Restore from a Rescue Code on this device. */
  claimRescueCode: (code: string) => Promise<{ ok: true; plan: RestorePlan } | { ok: false; error: 'code_not_found' | 'too_many_attempts' | 'network' | 'invalid' | 'unknown' | 'off' }>;
  /**
   * Queue a learner's changed name, level or avatar for the server (F-PROF-001): the values fold into any edit still
   * waiting, `at` moves to now, and a sync is requested. Offline it simply waits for the next sync.
   */
  markProfileDirty: (learnerId: string, fields: ProfileServerFields) => Promise<void>;
  /** The learner row from an inbox: taken when no local edit waits and it is newer than what this device holds. */
  applyInboxLearner: (learnerId: string, learner: InboxLearnerRow) => Promise<void>;
  /** Take over a learner the server handed us (rescue claim, re-link approval): profile, snapshot, credentials. */
  adoptServerLearner: (input: AdoptInput) => Promise<RestorePlan>;
}

export interface AdoptInput {
  learner: { id: string; displayName: string; ageGroup: Profile['ageGroup']; avatar: string };
  secret: string;
  snapshot: { rev: number; snapshot: ProgressSnapshot } | null;
  rescueCode?: string | null;
}

const key = (learnerId: string): string => `sync:${learnerId}`;

function blank(learnerId: string): LearnerSyncState {
  return { learnerId, secret: null, rev: 0, lastSyncedAt: null, lastError: null, status: apiBaseUrl() ? 'idle' : 'off', rescueCode: null, pendingProfile: null, profileAt: null };
}

type Persisted = Pick<LearnerSyncState, 'secret' | 'rev' | 'lastSyncedAt' | 'rescueCode' | 'pendingProfile' | 'profileAt'>;

function persistable(s: LearnerSyncState): Persisted {
  return { secret: s.secret, rev: s.rev, lastSyncedAt: s.lastSyncedAt, rescueCode: s.rescueCode, pendingProfile: s.pendingProfile, profileAt: s.profileAt };
}

/** Now, or one millisecond past `previous`: every queued edit gets a later `at`, so "unchanged since the send" is exact. */
function editStamp(previous: string | null | undefined): string {
  const now = Date.now();
  const last = previous ? Date.parse(previous) : Number.NaN;
  return new Date(Number.isNaN(last) || now > last ? now : last + 1).toISOString();
}

let apiClient: SyncApiClient | null = null;
function api(): SyncApiClient | null {
  const base = apiBaseUrl();
  if (!base || !flags.syncEnabled) return null;
  if (!apiClient) apiClient = createSyncApi({ endpoint: base });
  return apiClient;
}

/** The shared transport (null when the build has no API or sync is off) — sibling stores reuse it. */
export function syncApi(): SyncApiClient | null {
  return api();
}

/** Test seam: swap the transport. */
export function setSyncApiForTests(client: SyncApiClient | null): void {
  apiClient = client;
}

/**
 * The summary this device uploads for a learner. Also the in-app report's local summary (F-REPORT-001 section 3.9,
 * RP-9), so the device report and the console read the same figures for the same child.
 */
export const summarizeFor = (snapshot: ProgressSnapshot) => {
  const now = new Date();
  const plans = usePlanStore.getState();
  const inbox = plans.byLearner[snapshot.profileId];
  // Stage-level My route counts for the console strip (F-ROUTE-001 R-8); summarize stays pure.
  const journey = journeySummaryOf(snapshot, journeyContent, now);
  return summarize({
    snapshot,
    now,
    stage1QuestIds,
    questJamo,
    planNotReady: plans.notReady[snapshot.profileId] ?? {},
    journey,
    // The goal the Learning Route shows, for the family space only (Learning Route LR-6, LR-OD-12). Left out while
    // this device does not know the learner's plans (no inbox yet, or not loaded): a plan may lead, so no goal is guessed.
    routeGoal: inbox === undefined ? undefined : routeGoalSummaryOf({ snapshot, plans: inbox, journey, content: journeyContent, now }),
    // Day-by-day report activity on this device's calendar (F-REPORT-001 RP-4, OD-12). `next` waits for F-ENT-003
    // E3-4's `routeNext`; `revisit` reads the same quest access the learner's screens do.
    activity: buildActivity({ snapshot, now, questJamo, localDay: deviceLocalDay, isQuestOpen: questOpenFor(snapshot.profileId, now, snapshot) }),
  });
};

/** Listeners run after every successful sync — the inbox refresh hangs off this (F-PLAN-001 §3.3). */
const syncedListeners = new Set<(learnerId: string) => void>();
export function onSynced(listener: (learnerId: string) => void): () => void {
  syncedListeners.add(listener);
  return () => {
    syncedListeners.delete(listener);
  };
}

export const useSyncStore = create<State & Actions>((set, get) => {
  const update = (learnerId: string, patch: Partial<LearnerSyncState>): LearnerSyncState => {
    const current = get().byLearner[learnerId] ?? blank(learnerId);
    const next = { ...current, ...patch };
    set((s) => ({ byLearner: { ...s.byLearner, [learnerId]: next } }));
    void writeJson(key(learnerId), persistable(next));
    return next;
  };

  const scheduler = createSyncScheduler((learnerId) => void get().syncNow(learnerId), {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  });

  async function ensureRegistered(profile: Profile, state: LearnerSyncState, client: SyncApiClient): Promise<LearnerSyncState | null> {
    if (state.secret) return state;
    const deviceId = await getDeviceId();
    const result = await client.register(
      { id: profile.id, displayName: profile.displayName, ageGroup: profile.ageGroup, avatar: profile.avatar },
      deviceId,
    );
    if (result.status !== 'ok') {
      update(profile.id, { status: 'error', lastError: result.status === 'conflict' ? 'registered-elsewhere' : result.code });
      return null;
    }
    return update(profile.id, { secret: result.secret, rev: 0, lastError: null });
  }

  /** Drop the queued edit if it is still the one sent (a newer edit made meanwhile stays for the next pass). */
  function settlePending(learnerId: string, sentAt: string, patch: Partial<LearnerSyncState> = {}): void {
    const current = get().byLearner[learnerId]?.pendingProfile;
    update(learnerId, { ...patch, ...(current?.at === sentAt ? { pendingProfile: null } : {}) });
  }

  /** Take the server's learner row (inbox pull): only with no local edit waiting, and only a row newer than ours. */
  function applyServerLearner(learnerId: string, learner: InboxLearnerRow): void {
    const state = get().byLearner[learnerId];
    if (!state) return;
    if (!shouldPullServerProfile({ profileUpdatedAt: learner.profileUpdatedAt, pending: state.pendingProfile, profileAt: state.profileAt })) return;
    useProfileStore.getState().applyServerProfile(learnerId, learner);
    update(learnerId, { profileAt: learner.profileUpdatedAt });
  }

  /**
   * Send the queued name, level or avatar edit (PATCH, F-PROF-001). A 2xx settles it (`applied` false means the
   * server already held a newer edit, which the inbox brings down); a class tablet (403 `scope_limited`) or a value
   * the Worker refuses (422) is dropped with no retry; no network or a 5xx keeps it for the next sync. Answers the
   * error to record, or null.
   */
  async function pushProfile(learnerId: string, creds: { deviceId: string; secret: string }, client: SyncApiClient): Promise<string | null> {
    const pending = get().byLearner[learnerId]?.pendingProfile as QueuedProfile | null | undefined;
    if (!pending) return null;
    if (pending.repair) {
      // The one-time repair queues values no one just edited: when another device already changed this learner on
      // the server, its edit is newer, so it is taken instead of overwritten.
      const inbox = await client.getInbox(learnerId, creds);
      if (inbox.status !== 'ok') return null;
      const server = inbox.inbox.learner;
      if (server && server.profileUpdatedAt !== null) {
        settlePending(learnerId, pending.at);
        applyServerLearner(learnerId, server);
        return null;
      }
    }
    const fields = sendableFields(pending.fields);
    if (!hasFields(fields)) {
      settlePending(learnerId, pending.at);
      return null;
    }
    const result = await client.updateLearnerProfile(learnerId, creds.secret, creds.deviceId, { ...fields, at: pending.at });
    if (result.status === 'ok') {
      settlePending(learnerId, pending.at, { profileAt: pending.at });
      return null;
    }
    if (result.status === 'scope_limited' || result.status === 'invalid') {
      settlePending(learnerId, pending.at);
      return result.status === 'scope_limited' ? 'scope_limited' : 'profile_invalid';
    }
    return null;
  }

  /**
   * One-time repair (builds before profile edits reached the server kept a rename on the device): queue every
   * registered learner's current name, level and avatar once, then set the marker. Learners not registered yet send
   * theirs when they register.
   */
  async function repairProfilePushes(): Promise<void> {
    if (await readJson<boolean>(PROFILE_PUSH_REPAIR_KEY)) return;
    const profiles = useProfileStore.getState();
    const learners = profiles.profiles.filter((p) => p.role === 'learner');
    // Nothing loaded yet (or a read that failed): try again on the next start rather than mark it done.
    if (!profiles.hydrated || learners.length === 0) return;
    for (const p of learners) {
      const state = await get().hydrate(p.id);
      if (!state.secret) continue;
      const queued: QueuedProfile = { ...mergePending(state.pendingProfile, serverFieldsOf(p), editStamp(state.pendingProfile?.at)), ...(state.pendingProfile ? {} : { repair: true as const }) };
      update(p.id, { pendingProfile: queued });
    }
    await writeJson(PROFILE_PUSH_REPAIR_KEY, true);
  }

  /**
   * Hand a merged snapshot back to progress. A write that landed while the
   * request was in flight (a Results score, a card seen, a session end) is
   * folded in, never replaced, and the result goes up on the next pass
   * because the server does not hold it yet (issue #262).
   */
  function applyServerSnapshot(learnerId: string, sent: ProgressSnapshot, incoming: ProgressSnapshot): void {
    // A learner removed while the request was in flight stays removed: its progress is not written back.
    if (!useProfileStore.getState().profiles.some((p) => p.id === learnerId)) return;
    const progress = useProgressStore.getState();
    const current = progress.byProfile[learnerId];
    if (!current || current === sent) {
      progress.replaceSnapshot(learnerId, incoming);
      return;
    }
    // The union can bring back a plan item the reconcile dropped; put the plans' answer back (F-PLAN-002 section 3.6).
    const folded = usePlanStore.getState().reconcile(learnerId, rebaseSnapshot(sent, current, incoming, { now: new Date() }));
    progress.replaceSnapshot(learnerId, folded);
    get().requestSync(learnerId);
  }

  const inflight = new Map<string, Promise<LearnerSyncState>>();
  const rerun = new Set<string>();

  async function runSync(learnerId: string): Promise<LearnerSyncState> {
    const client = api();
    const state = await get().hydrate(learnerId);
    if (!client) return update(learnerId, { status: 'off' });
    const profile = useProfileStore.getState().profiles.find((p) => p.id === learnerId);
    // The edit the registration below would carry: the profile is read now, so this is the edit it holds.
    const pendingAt = get().byLearner[learnerId]?.pendingProfile?.at ?? null;
    // Never upload what is in memory before the saved snapshot has loaded:
    // a blank record there would replace the server copy (audit UX-01).
    await useProgressStore.getState().hydrate(learnerId);
    const local = useProgressStore.getState().byProfile[learnerId];
    if (!profile || !local) return state;

    update(learnerId, { status: 'syncing' });
    const registered = await ensureRegistered(profile, state, client);
    if (!registered?.secret) return get().byLearner[learnerId] ?? state;
    const creds = { deviceId: await getDeviceId(), secret: registered.secret };
    let profileError: string | null = null;
    if (!state.secret) {
      // Registered in this pass: the server already has the current name, level and avatar.
      if (pendingAt !== null) settlePending(learnerId, pendingAt);
    } else {
      profileError = await pushProfile(learnerId, creds, client);
    }

    const outcome = await syncLearner({
      learnerId,
      local,
      localRev: registered.rev,
      now: new Date(),
      summarize: summarizeFor,
      // A merged copy is reconciled with the cached plans before it goes up (F-PLAN-002 section 3.6).
      reconcile: (merged) => usePlanStore.getState().reconcile(learnerId, merged),
      api: { putSnapshot: (id, body) => client.putSnapshot(id, body, creds) },
    });

    if (outcome.status === 'error') return update(learnerId, { status: 'error', lastError: outcome.code });
    if (outcome.status === 'retry-later') {
      applyServerSnapshot(learnerId, local, outcome.snapshot);
      return update(learnerId, { status: 'idle', rev: outcome.rev, lastError: 'conflict' });
    }
    if (outcome.merged) applyServerSnapshot(learnerId, local, outcome.snapshot);
    const synced = update(learnerId, { status: 'synced', rev: outcome.rev, lastSyncedAt: new Date().toISOString(), lastError: profileError });
    // Owner decision 2026-09-20: every learner gets a Rescue Code after the first cloud save.
    if (!synced.rescueCode) await get().issueRescueCode(learnerId);
    for (const listener of syncedListeners) listener(learnerId);
    return get().byLearner[learnerId] ?? synced;
  }

  return {
    byLearner: {},

    hydrate: async (learnerId) => {
      const existing = get().byLearner[learnerId];
      if (existing) return existing;
      const saved = await readJson<Partial<Persisted>>(key(learnerId));
      // A hydrate that raced this one (an edit queued meanwhile) wins: its record is newer than the stored one.
      const raced = get().byLearner[learnerId];
      if (raced) return raced;
      const state: LearnerSyncState = { ...blank(learnerId), ...(saved ?? {}) };
      set((s) => ({ byLearner: { ...s.byLearner, [learnerId]: state } }));
      return state;
    },

    requestSync: (learnerId) => {
      if (!api()) return;
      scheduler.request(learnerId);
    },

    syncNow: (learnerId) => {
      // One request per learner at a time: `applyServerSnapshot` folds against
      // the copy that went up, which only holds while no other sync replaces
      // the snapshot underneath it. A call made meanwhile joins the running
      // one, and one more run follows so nothing it would have sent is missed.
      const running = inflight.get(learnerId);
      if (running) {
        rerun.add(learnerId);
        return running;
      }
      const run = runSync(learnerId).finally(() => {
        inflight.delete(learnerId);
        if (rerun.delete(learnerId)) void get().syncNow(learnerId);
      });
      inflight.set(learnerId, run);
      return run;
    },

    syncAll: async () => {
      if (!api()) return;
      await repairProfilePushes().catch(() => undefined);
      scheduler.flush();
      const learners = useProfileStore.getState().profiles.filter((p) => p.role === 'learner');
      // A learner the flush just started is awaited, not synced a second time.
      for (const p of learners) await (inflight.get(p.id) ?? get().syncNow(p.id));
    },

    markProfileDirty: async (learnerId, fields) => {
      if (!hasFields(fields)) return;
      const state = await get().hydrate(learnerId);
      const previous = get().byLearner[learnerId]?.pendingProfile ?? state.pendingProfile;
      update(learnerId, { pendingProfile: mergePending(previous, fields, editStamp(previous?.at)) });
      get().requestSync(learnerId);
    },

    applyInboxLearner: async (learnerId, learner) => {
      await get().hydrate(learnerId);
      applyServerLearner(learnerId, learner);
    },

    adoptCredentials: (learnerId, secret, rev) => {
      update(learnerId, { secret, rev, status: 'idle', lastError: null });
    },

    issueRescueCode: async (learnerId) => {
      const client = api();
      const state = await get().hydrate(learnerId);
      if (!client || !state.secret) return null;
      const result = await client.issueRescueCode(learnerId, { deviceId: await getDeviceId(), secret: state.secret });
      if (result.status !== 'ok') {
        update(learnerId, { lastError: result.code });
        return null;
      }
      update(learnerId, { rescueCode: result.code });
      return result.code;
    },

    claimRescueCode: async (code) => {
      const client = api();
      if (!client) return { ok: false, error: 'off' };
      const result = await client.claimRescueCode(code, await getDeviceId());
      if (result.status !== 'ok') return { ok: false, error: result.code };
      // Keep the code the parent just typed: this device must show it, not mint a new one on its next sync.
      const plan = await get().adoptServerLearner({ learner: result.learner, secret: result.secret, snapshot: result.snapshot, rescueCode: normalizeRescueCode(code) });
      return { ok: true, plan };
    },

    adoptServerLearner: async ({ learner, secret, snapshot: server, rescueCode }) => {
      const learnerId = learner.id;
      // Let a running sync finish first: its fold would read the restored copy as a local write.
      await inflight.get(learnerId);
      // Loaded first: `update` below would otherwise start from a blank record and lose a queued edit.
      const syncState = await get().hydrate(learnerId);
      const profiles = useProfileStore.getState();
      // The server row is current (profile edits reach it, F-PROF-001): it replaces this device's copy unless an edit
      // made here still waits to go up, which keeps its values and is sent on the next sync.
      if (!syncState.pendingProfile && profiles.profiles.some((p) => p.id === learnerId)) profiles.applyServerProfile(learnerId, learner);
      const existingProfile = useProfileStore.getState().profiles.find((p) => p.id === learnerId) ?? null;
      const profile: Profile = existingProfile ?? {
        id: learnerId,
        displayName: learner.displayName,
        ageGroup: learner.ageGroup,
        avatar: learner.avatar as AvatarKind,
        role: 'learner',
        createdAt: new Date().toISOString(),
      };
      const progress = useProgressStore.getState();
      if (existingProfile) await progress.hydrate(learnerId);
      const localSnapshot = existingProfile ? progress.ensure(learnerId) : null;
      const serverSnapshot = server?.snapshot ?? null;
      const now = new Date();

      let plan: RestorePlan;
      if (serverSnapshot) {
        plan = planRestore(
          { format: 'hangul-route-backup', version: 1, exportedAt: now.toISOString(), profile, snapshot: serverSnapshot },
          localSnapshot ? { profile, snapshot: localSnapshot } : null,
          now,
        );
      } else {
        const snapshot = localSnapshot ?? progress.ensure(learnerId);
        plan = { action: existingProfile ? 'merge' : 'create', profile, snapshot: mergeSnapshots(snapshot, snapshot, { now }), added: { cards: 0, quests: 0 } };
      }
      if (!existingProfile) useProfileStore.getState().adoptProfile(profile);
      progress.replaceSnapshot(learnerId, plan.snapshot);
      update(learnerId, { secret, rev: server?.rev ?? 0, status: 'idle', lastError: null, ...(rescueCode ? { rescueCode } : {}) });
      // Merging may have added local-only progress; push it back.
      get().requestSync(learnerId);
      return plan;
    },
  };
});

// Every learner name, level or avatar edit on this device is queued for the server (F-PROF-001).
onProfileEdited((learnerId, fields) => void useSyncStore.getState().markProfileDirty(learnerId, fields));
// The learner row an inbox carries: a newer edit made on another device comes down (F-PROF-001 profile pull).
onInboxRead((learnerId, inbox) => {
  if (inbox.learner) void useSyncStore.getState().applyInboxLearner(learnerId, inbox.learner);
});
