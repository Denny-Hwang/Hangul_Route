/**
 * Tiny event seam so `progress-store` can announce writes without importing
 * the sync store (which imports it back). F-SYNC-002 §3.2.
 */
type Listener = (learnerId: string) => void;
let listener: Listener | null = null;

export function setProgressPersistListener(fn: Listener | null): void {
  listener = fn;
}

export function notifyProgressPersisted(learnerId: string): void {
  listener?.(learnerId);
}
