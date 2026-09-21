import type { Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { flags } from '../config/flags';
import { questJamo, stage1QuestIds } from '../content/sync-context';
import { syncLearner } from '../logic/sync/engine';
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
}

const key = (learnerId: string): string => `sync:${learnerId}`;

function blank(learnerId: string): LearnerSyncState {
  return { learnerId, secret: null, rev: 0, lastSyncedAt: null, lastError: null, status: apiBaseUrl() ? 'idle' : 'off' };
}

function persistable(s: LearnerSyncState): Pick<LearnerSyncState, 'secret' | 'rev' | 'lastSyncedAt'> {
  return { secret: s.secret, rev: s.rev, lastSyncedAt: s.lastSyncedAt };
}

let apiClient: SyncApiClient | null = null;
function api(): SyncApiClient | null {
  const base = apiBaseUrl();
  if (!base || !flags.syncEnabled) return null;
  if (!apiClient) apiClient = createSyncApi({ endpoint: base });
  return apiClient;
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
      const saved = await readJson<Pick<LearnerSyncState, 'secret' | 'rev' | 'lastSyncedAt'>>(key(learnerId));
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
      return update(learnerId, { status: 'synced', rev: outcome.rev, lastSyncedAt: new Date().toISOString(), lastError: null });
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
  };
});
