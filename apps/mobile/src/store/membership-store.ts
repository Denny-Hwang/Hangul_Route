import type { LearnerMembership } from '@hangul-route/content-schema';
import { create } from 'zustand';
import type { JoinErrorCode } from '../logic/spaces/join-code';
import type { RestorePlan } from '../logic/sync/restore';
import { getDeviceId } from '../platform/device';
import { readJson, writeJson } from '../platform/storage';
import type { DeviceCredentials, RosterName, SyncApiClient } from '../platform/sync-api';
import { track } from '../platform/telemetry';
import { usePlanStore } from './plan-store';
import { useTierStore } from './tier-store';
import { onSynced, syncApi, useSyncStore } from './sync-store';

/**
 * A learner's spaces on this device — F-SPACE-001 §3.5. Cached locally,
 * refreshed from the sync inbox; join / leave go through the device
 * principal, so a learner that never synced is registered first.
 */
interface State {
  byLearner: Record<string, LearnerMembership[]>;
}

export type LookupOutcome =
  | { ok: true; space: { id: string; kind: LearnerMembership['kind']; name: string }; full: boolean; roster: RosterName[] }
  | { ok: false; error: JoinErrorCode };

export type RelinkError = 'code_not_found' | 'code_expired' | 'learner_not_found' | 'already_bound' | 'too_many_attempts' | 'network' | 'invalid' | 'unknown' | 'off';
export type RelinkOutcome = { ok: true; requestId: string; expiresAt: string } | { ok: false; error: RelinkError };
export type RelinkPoll =
  | { state: 'pending' | 'denied' | 'expired' }
  | { state: 'approved'; plan: RestorePlan }
  | { state: 'error'; error: 'network' | 'not_found' | 'unknown' | 'off' };

export type JoinOutcome = { ok: true; alreadyMember: boolean; membership: LearnerMembership } | { ok: false; error: JoinErrorCode };

interface Actions {
  hydrate: (learnerId: string) => Promise<LearnerMembership[]>;
  /** Pull the learner's memberships from the inbox; null when offline / never synced / no API. */
  refresh: (learnerId: string) => Promise<LearnerMembership[] | null>;
  lookup: (code: string) => Promise<LookupOutcome>;
  join: (learnerId: string, spaceId: string, code: string, displayName?: string) => Promise<JoinOutcome>;
  leave: (learnerId: string, spaceId: string) => Promise<boolean>;
  /** Ask the teacher to bind this device to an existing roster learner (F-TCH-001 §10.1). */
  requestRelink: (spaceId: string, code: string, learnerId: string) => Promise<RelinkOutcome>;
  /** Poll the request; on approval the learner is adopted on this device. */
  pollRelink: (spaceId: string, requestId: string) => Promise<RelinkPoll>;
}

const key = (learnerId: string): string => `memberships:${learnerId}`;

async function credentialsFor(learnerId: string, registerIfNeeded: boolean): Promise<DeviceCredentials | null> {
  const sync = useSyncStore.getState();
  let state = await sync.hydrate(learnerId);
  if (!state.secret && registerIfNeeded) state = await sync.syncNow(learnerId);
  return state.secret ? { deviceId: await getDeviceId(), secret: state.secret } : null;
}

export const useMembershipStore = create<State & Actions>((set, get) => {
  const put = (learnerId: string, rows: LearnerMembership[]): LearnerMembership[] => {
    const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    set((s) => ({ byLearner: { ...s.byLearner, [learnerId]: sorted } }));
    void writeJson(key(learnerId), sorted);
    return sorted;
  };

  return {
    byLearner: {},

    hydrate: async (learnerId) => {
      const existing = get().byLearner[learnerId];
      if (existing) return existing;
      const saved = (await readJson<LearnerMembership[]>(key(learnerId))) ?? [];
      set((s) => ({ byLearner: { ...s.byLearner, [learnerId]: saved } }));
      return saved;
    },

    refresh: async (learnerId) => {
      const client: SyncApiClient | null = syncApi();
      if (!client) return null;
      const creds = await credentialsFor(learnerId, false);
      if (!creds) return null;
      const result = await client.getInbox(learnerId, creds);
      if (result.status !== 'ok') return null;
      const rows = put(learnerId, result.inbox.memberships);
      // The server decides premium from memberships (F-ENT-001 §3.4); cache it with its grace window.
      useTierStore.getState().applyInbox(learnerId, result.inbox);
      // Plans ride the same inbox (F-PLAN-001 §3.3): derive homework, then push the change back.
      const applied = await usePlanStore.getState().applyPlans(learnerId, result.inbox.plans);
      if (applied.changed) useSyncStore.getState().requestSync(learnerId);
      return rows;
    },

    lookup: async (code) => {
      const client = syncApi();
      if (!client) return { ok: false, error: 'off' };
      const result = await client.lookupSpace(code);
      return result.status === 'ok' ? { ok: true, space: result.space, full: result.full, roster: result.roster } : { ok: false, error: result.code };
    },

    join: async (learnerId, spaceId, code, displayName) => {
      const client = syncApi();
      if (!client) return { ok: false, error: 'off' };
      void track({ name: 'space.join.attempted', profileId: learnerId });
      const creds = await credentialsFor(learnerId, true);
      if (!creds) {
        void track({ name: 'space.join.failed', profileId: learnerId, payload: { reason: 'network' } });
        return { ok: false, error: 'network' };
      }
      const result = await client.joinSpace(spaceId, { code, learnerId, displayName }, creds);
      if (result.status !== 'ok') {
        void track({ name: 'space.join.failed', profileId: learnerId, payload: { reason: result.code } });
        return { ok: false, error: result.code };
      }
      const current = await get().hydrate(learnerId);
      put(learnerId, [...current.filter((m) => m.spaceId !== result.membership.spaceId), result.membership]);
      void track({ name: 'space.join.succeeded', profileId: learnerId, payload: { kind: result.membership.kind, alreadyMember: result.alreadyMember } });
      return { ok: true, alreadyMember: result.alreadyMember, membership: result.membership };
    },

    requestRelink: async (spaceId, code, learnerId) => {
      const client = syncApi();
      if (!client) return { ok: false, error: 'off' };
      void track({ name: 'space.relink.requested', profileId: learnerId });
      const result = await client.createRelink(spaceId, { code, learnerId, deviceId: await getDeviceId() });
      return result.status === 'ok' ? { ok: true, requestId: result.requestId, expiresAt: result.expiresAt } : { ok: false, error: result.code };
    },

    pollRelink: async (spaceId, requestId) => {
      const client = syncApi();
      if (!client) return { state: 'error', error: 'off' };
      const result = await client.pollRelink(spaceId, requestId, await getDeviceId());
      if (result.status !== 'ok') return { state: 'error', error: result.code };
      if (result.state !== 'approved') {
        if (result.state === 'denied') void track({ name: 'space.relink.denied', profileId: undefined });
        return { state: result.state };
      }
      const plan = await useSyncStore.getState().adoptServerLearner({ learner: result.learner, secret: result.secret, snapshot: result.snapshot });
      void track({ name: 'space.relink.approved', profileId: result.learner.id });
      await get().refresh(result.learner.id);
      return { state: 'approved', plan };
    },

    leave: async (learnerId, spaceId) => {
      const client = syncApi();
      const creds = client ? await credentialsFor(learnerId, false) : null;
      if (!client || !creds) return false;
      const result = await client.leaveSpace(spaceId, learnerId, creds);
      if (result.status !== 'ok') return false;
      const current = await get().hydrate(learnerId);
      put(learnerId, current.filter((m) => m.spaceId !== spaceId));
      void track({ name: 'space.left', profileId: learnerId });
      return true;
    },
  };
});

/** Refresh the inbox after every successful sync (call once at app start; returns the unsubscribe). */
export function registerInboxRefresh(): () => void {
  return onSynced((learnerId) => {
    void useMembershipStore.getState().refresh(learnerId);
  });
}
