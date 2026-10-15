import type { ProfileServerFields } from '../logic/sync/learner-profile';

/**
 * Tiny event seam so `profile-store.updateProfile` can tell the sync store that a learner's name, level or
 * picture changed (F-PROF-001, F-SYNC-001) without importing it, so profile-store consumers do not load the
 * sync store's dependencies. The sync store subscribes when it loads and queues the change for the server.
 */
type Listener = (profileId: string, fields: ProfileServerFields) => void;
const listeners = new Set<Listener>();

/** Subscribe to local profile edits; returns the unsubscribe function. */
export function onProfileEdited(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyProfileEdited(profileId: string, fields: ProfileServerFields): void {
  for (const listener of listeners) {
    // A listener that throws never fails the edit, which is already saved by then.
    try {
      listener(profileId, fields);
    } catch {
      // Swallowed on purpose: the next sync's one-time check or a later edit sends the value.
    }
  }
}
