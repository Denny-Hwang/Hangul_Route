import { normalizeRescueCode, type AvatarKind, type Profile, type ProgressSnapshot } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { flags } from '../config/flags';
import { questJamo, stage1QuestIds } from '../content/sync-context';
import { syncLearner } from '../logic/sync/engine';
import { mergeSnapshots } from '../logic/sync/merge';
import { planRestore, type RestorePlan } from '../logic/sync/restore';
import { createSyncScheduler } from '../logic/sync/scheduler';
import { summarize } from '../logic/sync/summarize';
import { getDeviceId } from '../platform/device';
import { readJson, writeJson } from '../platform/storage';
import { apiBaseUrl, createSyncApi, type SyncApiClient } from '../platform/sync-api';
import { useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';

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
}

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
}

const key = (learnerId: string): string => `sync:${learnerId}`;

function blank(learnerId: string): LearnerSyncState {
  return { learnerId, secret: null, rev: 0, lastSyncedAt: null, lastError: null, status: apiBaseUrl() ? 'idle' : 'off', rescueCode: null };
}

function persistable(s: LearnerSyncState): Pick<LearnerSyncState, 'secret' | 'rev' | 'lastSyncedAt' | 'rescueCode'> {
  return { secret: s.secret, rev: s.rev, lastSyncedAt: s.lastSyncedAt, rescueCode: s.rescueCode };
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

const summarizeFor = (snapshot: ProgressSnapshot) =>
  summarize({ snapshot, now: new Date(), stage1QuestIds, questJamo });

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

  return {
    byLearner: {},

    hydrate: async (learnerId) => {
      const existing = get().byLearner[learnerId];
      if (existing) return existing;
      const saved = await readJson<Pick<LearnerSyncState, 'secret' | 'rev' | 'lastSyncedAt' | 'rescueCode'>>(key(learnerId));
      const state: LearnerSyncState = { ...blank(learnerId), ...(saved ?? {}) };
      set((s) => ({ byLearner: { ...s.byLearner, [learnerId]: state } }));
      return state;
    },

    requestSync: (learnerId) => {
      if (!api()) return;
      scheduler.request(learnerId);
    },

    syncNow: async (learnerId) => {
      const client = api();
      const state = await get().hydrate(learnerId);
      if (!client) return update(learnerId, { status: 'off' });
      const profile = useProfileStore.getState().profiles.find((p) => p.id === learnerId);
      const local = useProgressStore.getState().byProfile[learnerId];
      if (!profile || !local) return state;

      update(learnerId, { status: 'syncing' });
      const registered = await ensureRegistered(profile, state, client);
      if (!registered?.secret) return get().byLearner[learnerId] ?? state;
      const creds = { deviceId: await getDeviceId(), secret: registered.secret };

      const outcome = await syncLearner({
        learnerId,
        local,
        localRev: registered.rev,
        now: new Date(),
        summarize: summarizeFor,
        api: { putSnapshot: (id, body) => client.putSnapshot(id, body, creds) },
      });

      if (outcome.status === 'error') return update(learnerId, { status: 'error', lastError: outcome.code });
      if (outcome.status === 'retry-later') {
        useProgressStore.getState().replaceSnapshot(learnerId, outcome.snapshot);
        return update(learnerId, { status: 'idle', rev: outcome.rev, lastError: 'conflict' });
      }
      if (outcome.merged) useProgressStore.getState().replaceSnapshot(learnerId, outcome.snapshot);
      const synced = update(learnerId, { status: 'synced', rev: outcome.rev, lastSyncedAt: new Date().toISOString(), lastError: null });
      // Owner decision 2026-09-20: every learner gets a Rescue Code after the first cloud save.
      if (!synced.rescueCode) await get().issueRescueCode(learnerId);
      return get().byLearner[learnerId] ?? synced;
    },

    syncAll: async () => {
      if (!api()) return;
      scheduler.flush();
      const learners = useProfileStore.getState().profiles.filter((p) => p.role === 'learner');
      for (const p of learners) await get().syncNow(p.id);
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

      const learnerId = result.learner.id;
      const profiles = useProfileStore.getState();
      const existingProfile = profiles.profiles.find((p) => p.id === learnerId) ?? null;
      const profile: Profile = existingProfile ?? {
        id: learnerId,
        displayName: result.learner.displayName,
        ageGroup: result.learner.ageGroup,
        avatar: result.learner.avatar as AvatarKind,
        role: 'learner',
        createdAt: new Date().toISOString(),
      };
      const progress = useProgressStore.getState();
      if (existingProfile) await progress.hydrate(learnerId);
      const localSnapshot = existingProfile ? progress.ensure(learnerId) : null;
      const serverSnapshot = result.snapshot?.snapshot ?? null;
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
      if (!existingProfile) profiles.adoptProfile(profile);
      progress.replaceSnapshot(learnerId, plan.snapshot);
      // Keep the code the parent just typed: this device must show it, not mint a new one on its next sync.
      update(learnerId, { secret: result.secret, rev: result.snapshot?.rev ?? 0, status: 'idle', lastError: null, rescueCode: normalizeRescueCode(code) });
      // Merging may have added local-only progress; push it back.
      get().requestSync(learnerId);
      return { ok: true, plan };
    },
  };
});
