/**
 * Tiny event seam so `profile-store.remove` can announce a removal to the stores
 * that keep per-profile data (locale settings, F-I18N-001 §3.2) without importing
 * them — and without every profile-store consumer loading their dependencies.
 */
type Listener = (profileId: string) => void;
const listeners = new Set<Listener>();

/** Subscribe to profile removals; returns the unsubscribe function. */
export function onProfileRemoved(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyProfileRemoved(profileId: string): void {
  for (const listener of listeners) listener(profileId);
}
