import type { InboxClassMove, InboxClassScope, SyncInbox } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { classMovesSeenKey, readSeen, withSeen } from '../logic/class-update/class-update';
import { getDeviceId } from '../platform/device';
import { readJson, removeKey, writeJson } from '../platform/storage';
import { track } from '../platform/telemetry';
import { onProfileRemoved } from './profile-removal';
import { syncApi, useSyncStore } from './sync-store';

/** The class moves this learner has seen (`hr:class-moves-seen:<id>`); exported for the removal sweep (row OA-7a). */
export const CLASS_MOVES_SEEN_KEY = classMovesSeenKey;

/**
 * [TV] The class update and the one-time move notices on this device — AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D4,
 * TV-D5, TV-D10. The inbox fields (`classScope`, `classMoves`) are kept in memory only, from the last inbox of this
 * session; which notices this device already showed is kept per profile (`class-moves-seen:<profileId>`, through the
 * storage wrapper), so a notice shows once. The acknowledgement is sent online only (it is never queued): the screen
 * says "This needs internet." otherwise.
 */

export type AcknowledgeOutcome = 'ok' | 'offline' | 'stale' | 'failed';

interface State {
  scopeByLearner: Record<string, InboxClassScope | null>;
  movesByLearner: Record<string, InboxClassMove[]>;
  seenByLearner: Record<string, string[]>;
}

interface Actions {
  /** The inbox's class fields for one learner (called by `membership-store.refresh`). */
  applyInbox: (learnerId: string, inbox: Partial<Pick<SyncInbox, 'classScope' | 'classMoves'>>) => void;
  /** The seen notices of a profile, read once per session. */
  hydrateSeen: (learnerId: string) => Promise<string[]>;
  /** OK on a move notice: shown once on this device. */
  markSeen: (learnerId: string, moveId: string) => Promise<void>;
  /** OK on the class update screen: sends the acknowledgement for the version the inbox named. */
  acknowledge: (learnerId: string) => Promise<AcknowledgeOutcome>;
}

const hydrated = new Set<string>();

export const useClassUpdateStore = create<State & Actions>((set, get) => ({
  scopeByLearner: {},
  movesByLearner: {},
  seenByLearner: {},

  applyInbox: (learnerId, inbox) => {
    set((s) => ({
      scopeByLearner: { ...s.scopeByLearner, [learnerId]: inbox.classScope ?? null },
      movesByLearner: { ...s.movesByLearner, [learnerId]: inbox.classMoves ?? [] },
    }));
  },

  hydrateSeen: async (learnerId) => {
    if (hydrated.has(learnerId)) return get().seenByLearner[learnerId] ?? [];
    hydrated.add(learnerId);
    const stored = readSeen(await readJson<unknown>(classMovesSeenKey(learnerId)).catch(() => null));
    // A notice marked while the read was pending is newer than the stored list.
    const merged = [...new Set([...stored, ...(get().seenByLearner[learnerId] ?? [])])];
    set((s) => ({ seenByLearner: { ...s.seenByLearner, [learnerId]: merged } }));
    return merged;
  },

  markSeen: async (learnerId, moveId) => {
    const next = withSeen(get().seenByLearner[learnerId] ?? [], moveId);
    set((s) => ({ seenByLearner: { ...s.seenByLearner, [learnerId]: next } }));
    void track({ name: 'space.move.notice_seen', payload: { seenOn: 'device' } });
    try {
      await writeJson(classMovesSeenKey(learnerId), next);
    } catch {
      // Shown again in a later session at worst: the notice names nothing private.
    }
  },

  acknowledge: async (learnerId) => {
    const scope = get().scopeByLearner[learnerId];
    const client = syncApi();
    if (!scope || !client) return 'failed';
    const sync = await useSyncStore.getState().hydrate(learnerId);
    if (!sync.secret) return 'failed';
    const result = await client.putClassScopeAck(learnerId, scope.current, { deviceId: await getDeviceId(), secret: sync.secret });
    if (result.status === 'ok') {
      set((s) => ({ scopeByLearner: { ...s.scopeByLearner, [learnerId]: { ...scope, needed: false } } }));
      return 'ok';
    }
    if (result.code === 'network') return 'offline';
    if (result.code === 'class_scope_stale') return 'stale';
    return 'failed';
  },
}));

// A removed profile leaves no key behind (F-PROF-001 section 3.3).
onProfileRemoved((profileId) => {
  hydrated.delete(profileId);
  void removeKey(classMovesSeenKey(profileId)).catch(() => undefined);
});

/** Tests only. */
export function resetClassUpdateForTests(): void {
  hydrated.clear();
  useClassUpdateStore.setState({ scopeByLearner: {}, movesByLearner: {}, seenByLearner: {} });
}
