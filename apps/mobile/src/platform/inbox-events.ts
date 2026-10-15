import type { SyncInbox } from '@hangul-route/content-schema';

/**
 * Every inbox this device reads (`sync-api.getInbox`), announced to the stores that keep a piece of it outside the
 * inbox refresh: the sync store takes the server's learner row from here (F-PROF-001 profile pull). A listener
 * that throws never breaks the read.
 */
type Listener = (learnerId: string, inbox: SyncInbox) => void;
const listeners = new Set<Listener>();

export function onInboxRead(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyInboxRead(learnerId: string, inbox: SyncInbox): void {
  for (const listener of listeners) {
    try {
      listener(learnerId, inbox);
    } catch {
      // One store's problem never costs the others their inbox.
    }
  }
}
