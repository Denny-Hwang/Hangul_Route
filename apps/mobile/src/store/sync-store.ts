import { normalizeRescueCode, type AvatarKind, type Profile, type ProgressSnapshot } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { flags } from '../config/flags';
import { journeyContent, questJamo, stage1QuestIds } from '../content/sync-context';
import { journeySummaryOf, routeGoalSummaryOf } from '../logic/my-route/summary';
import {
  hasFields,
  mergePending,
  queueRepair,
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
import { TRANSFER_SCOPE_KEY, deviceScopeOf } from '../logic/transfers/device-scope';
import { getDeviceId } from '../platform/device';
import { onInboxRead } from '../platform/inbox-events';
import { readJson, readJsonStrict, removeKey, writeJson } from '../platform/storage';
import { apiBaseUrl, createSyncApi, type SyncApiClient } from '../platform/sync-api';
import { usePlanStore } from './plan-store';
import { onProfileEdited } from './profile-edits';
import { onProfileRemoved } from './profile-removal';
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
  /**
   * [OA] Row OA-7a (section 10.4, CS-20): the learner was removed from this device. Its record (device secret, Rescue
   * Code, queued edit) is deleted, a queued run is dropped, and nothing more is written for it, even by a run already
   * in flight, until a restore adopts it again (`adoptCredentials`, `adoptServerLearner`). No server call is made.
   */
  forgetLearner: (learnerId: string) => void;
}

export interface AdoptInput {
  learner: { id: string; displayName: string; ageGroup: Profile['ageGroup']; avatar: string };
  secret: string;
  snapshot: { rev: number; snapshot: ProgressSnapshot } | null;
  rescueCode?: string | null;
}

/** The per-learner sync record (`hr:sync:<id>`); exported for the removal sweep (row OA-7a). */
export const SYNC_KEY = (learnerId: string): string => `sync:${learnerId}`;
const key = SYNC_KEY;

/** [OA] Learners removed from this device in this session (row OA-7a): nothing is written for them until a restore. */
const removedHere = new Set<string>();

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

/** The fields of `fields` whose value is not what the server row already holds. */
function differingFrom(fields: ProfileServerFields, server: ServerLearnerFields): ProfileServerFields {
  const out: ProfileServerFields = {};
  if (fields.displayName !== undefined && fields.displayName.trim() !== server.displayName.trim()) out.displayName = fields.displayName;
  if (fields.ageGroup !== undefined && fields.ageGroup !== server.ageGroup) out.ageGroup = fields.ageGroup;
  if (fields.avatar !== undefined && fields.avatar !== server.avatar) out.avatar = fields.avatar;
  return out;
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

/**
 * Local edits seen per learner, counted the moment `profile-store` reports them (before the queued edit is stored,
 * which waits for the sync record to load). An inbox pull that started before an edit never writes over it.
 */
const editCounts = new Map<string, number>();
const editCountOf = (learnerId: string): number => editCounts.get(learnerId) ?? 0;

export const useSyncStore = create<State & Actions>((set, get) => {
  const update = (learnerId: string, patch: Partial<LearnerSyncState>): LearnerSyncState => {
    const current = get().byLearner[learnerId] ?? blank(learnerId);
    const next = { ...current, ...patch };
    // [OA] A run that was in flight when the learner was removed writes nothing back (CS-20).
    if (removedHere.has(learnerId)) return next;
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
   * Send the queued name, level or avatar edit (PATCH, F-PROF-001). A 2xx settles it: `profileAt` takes the edit time
   * the server stored (its clock caps a device clock that runs ahead), and `applied` false (the server already held a
   * newer edit) takes the row the server answers with right away. A class tablet (403 `scope_limited`) or a value the
   * Worker refuses (422) is dropped with no retry; no network or a 5xx keeps it for the next sync. Answers the error
   * to record, or null.
   */
  async function pushProfile(learnerId: string, creds: { deviceId: string; secret: string }, client: SyncApiClient): Promise<string | null> {
    const pending = get().byLearner[learnerId]?.pendingProfile;
    if (!pending) return null;
    let toSend: ProfileServerFields = pending.fields;
    if (pending.repair && !hasFields(pending.fields) && deviceScopeOf(await readJson<unknown>(TRANSFER_SCOPE_KEY(learnerId)), creds.secret) === 'class') {
      // A class tablet may not PATCH (403 `scope_limited`), and the one-time check has no edit behind it: it settles
      // quietly, with no request and no error recorded. The learner's own device sends its values.
      settlePending(learnerId, pending.at);
      return null;
    }
    if (pending.repair) {
      // The one-time repair's values have no edit behind them. Only a PATCH sets `profileUpdatedAt` (a join never
      // does, F-SPACE-001), so a stamped row means another device edited this learner: its values win for every
      // field not edited here, and only the fields edited here go up.
      const inbox = await client.getInbox(learnerId, creds);
      if (inbox.status !== 'ok') return null;
      // An edit made while the inbox was read: the next pass looks again with it.
      if (get().byLearner[learnerId]?.pendingProfile?.at !== pending.at) return null;
      const server = inbox.inbox.learner;
      if (server && server.profileUpdatedAt !== null) {
        const local = pending.fields;
        useProfileStore.getState().applyServerProfile(learnerId, {
          displayName: local.displayName ?? server.displayName,
          ageGroup: local.ageGroup ?? server.ageGroup,
          avatar: local.avatar ?? server.avatar,
        });
        if (!hasFields(local)) {
          settlePending(learnerId, pending.at, { profileAt: server.profileUpdatedAt });
          return null;
        }
      } else {
        // Only the values that differ from the server go up: a device that never saw the rename sends nothing, so
        // it never stamps the old name as the newest edit before the device that made the rename starts this build.
        toSend = { ...(server ? differingFrom(pending.repair, server) : pending.repair), ...pending.fields };
      }
    }
    const fields = sendableFields(toSend);
    if (!hasFields(fields)) {
      settlePending(learnerId, pending.at);
      return null;
    }
    const result = await client.updateLearnerProfile(learnerId, creds.secret, creds.deviceId, { ...fields, at: pending.at });
    if (result.status === 'ok') {
      if (result.applied) {
        settlePending(learnerId, pending.at, { profileAt: result.profileUpdatedAt ?? pending.at });
        return null;
      }
      // The server kept a newer edit: show it now rather than wait for the inbox (unless an edit made meanwhile waits).
      // With no stored time in the answer, the next inbox row counts as newer.
      settlePending(learnerId, pending.at, { profileAt: result.profileUpdatedAt });
      if (result.learner && !get().byLearner[learnerId]?.pendingProfile) useProfileStore.getState().applyServerProfile(learnerId, result.learner);
      return null;
    }
    if (result.status === 'scope_limited' || result.status === 'invalid') {
      // Never retried: the same body would be refused again. Only a fixed code is recorded, never the value sent.
      settlePending(learnerId, pending.at);
      return result.status === 'scope_limited' ? 'scope_limited' : 'profile_invalid';
    }
    return null;
  }

  /**
   * The learner's sync record: the cached one, else the stored one (cached now), else a blank one when nothing is
   * stored. Null when storage could not be read: that is not "no record", so nothing is cached and the caller writes
   * nothing for the learner (a blank record saved over it would lose the device secret, F-SYNC-001 section 3.7 #10).
   */
  async function load(learnerId: string): Promise<LearnerSyncState | null> {
    const existing = get().byLearner[learnerId];
    if (existing) return existing;
    let saved: Partial<Persisted> | null;
    try {
      saved = await readJsonStrict<Partial<Persisted>>(key(learnerId));
    } catch {
      return null;
    }
    // A load that raced this one (an edit queued meanwhile) wins: its record is newer than the stored one.
    const raced = get().byLearner[learnerId];
    if (raced) return raced;
    const state: LearnerSyncState = { ...blank(learnerId), ...(saved ?? {}) };
    set((s) => ({ byLearner: { ...s.byLearner, [learnerId]: state } }));
    return state;
  }

  /** What a caller gets for a record that could not be read: never cached, never saved. */
  function unreadable(learnerId: string): LearnerSyncState {
    return { ...blank(learnerId), status: 'error', lastError: 'storage_unavailable' };
  }

  /**
   * One-time repair (builds before profile edits reached the server kept a rename on the device): queue every
   * registered learner's current name, level and avatar once, then set the marker. Learners not registered yet send
   * theirs when they register. A record that cannot be read stops the pass before anything is queued, with no marker
   * and nothing cached for that learner, so the repair runs again on the next start (F-SYNC-001 section 3.7 #10).
   */
  async function repairProfilePushes(): Promise<void> {
    if (await readJson<boolean>(PROFILE_PUSH_REPAIR_KEY)) return;
    const profiles = useProfileStore.getState();
    const learners = profiles.profiles.filter((p) => p.role === 'learner');
    // Nothing loaded yet (or a read that failed): try again on the next start rather than mark it done.
    if (!profiles.hydrated || learners.length === 0) return;
    // Every record is read before anything is queued: a failed read is not "no record" (a blank one would skip the
    // learner and mark the repair done), so the pass stops there with nothing queued and runs again on the next start.
    for (const p of learners) if (!(await load(p.id))) return;
    for (const p of learners) {
      const state = get().byLearner[p.id];
      if (!state?.secret) continue;
      update(p.id, { pendingProfile: queueRepair(state.pendingProfile, serverFieldsOf(p), editStamp(state.pendingProfile?.at)) });
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
    const state = await load(learnerId);
    // A record storage could not read: no registration and no write, so the stored secret is kept for a later pass.
    if (!state) return unreadable(learnerId);
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
      // A dropped profile edit is the more lasting news: the conflict retries by itself.
      return update(learnerId, { status: 'idle', rev: outcome.rev, lastError: profileError ?? 'conflict' });
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

    hydrate: async (learnerId) => (await load(learnerId)) ?? unreadable(learnerId),

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
      const state = await load(learnerId);
      if (!state) {
        // The queued edit cannot be stored without the record it belongs to. The profile keeps the new values, and
        // clearing the repair marker has the next start's one-time repair queue them (F-SYNC-001 section 3.7 #10).
        await writeJson(PROFILE_PUSH_REPAIR_KEY, false).catch(() => undefined);
        return;
      }
      const previous = get().byLearner[learnerId]?.pendingProfile ?? state.pendingProfile;
      update(learnerId, { pendingProfile: mergePending(previous, fields, editStamp(previous?.at)) });
      get().requestSync(learnerId);
    },

    applyInboxLearner: async (learnerId, learner) => {
      const edits = editCountOf(learnerId);
      await get().hydrate(learnerId);
      // A local edit reported while the record loaded: its queued push is about to land and wins.
      if (editCountOf(learnerId) !== edits) return;
      applyServerLearner(learnerId, learner);
    },

    adoptCredentials: (learnerId, secret, rev) => {
      removedHere.delete(learnerId);
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
      // [OA] A learner removed earlier in this session comes back through its Rescue Code (section 10.4).
      removedHere.delete(learnerId);
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

    forgetLearner: (learnerId) => {
      removedHere.add(learnerId);
      scheduler.cancel(learnerId);
      rerun.delete(learnerId);
      editCounts.delete(learnerId);
      set((s) => {
        const { [learnerId]: _gone, ...rest } = s.byLearner;
        return { byLearner: rest };
      });
      removeKey(key(learnerId)).catch(() => undefined);
    },
  };
});

// [OA] Row OA-7a: a removed learner leaves no sync record (device secret, Rescue Code, queued edit) behind (CS-20).
onProfileRemoved((learnerId) => useSyncStore.getState().forgetLearner(learnerId));

// Every learner name, level or avatar edit on this device is queued for the server (F-PROF-001).
onProfileEdited((learnerId, fields) => {
  editCounts.set(learnerId, editCountOf(learnerId) + 1);
  void useSyncStore.getState().markProfileDirty(learnerId, fields);
});
// The learner row an inbox carries: a newer edit made on another device comes down (F-PROF-001 profile pull).
onInboxRead((learnerId, inbox) => {
  if (inbox.learner) void useSyncStore.getState().applyInboxLearner(learnerId, inbox.learner);
});
