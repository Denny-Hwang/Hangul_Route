/**
 * Per-learner debounce for background sync (F-SYNC-002 §3.2). Timer
 * functions are injected so tests run instantly.
 */
export const SYNC_DEBOUNCE_MS = 30_000;

export interface SchedulerTimers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

export function createSyncScheduler(run: (learnerId: string) => void, timers: SchedulerTimers, delayMs = SYNC_DEBOUNCE_MS) {
  const pending = new Map<string, unknown>();
  return {
    /** Coalesce bursts of writes into one run per learner. */
    request(learnerId: string): void {
      const existing = pending.get(learnerId);
      if (existing !== undefined) timers.clearTimeout(existing);
      pending.set(
        learnerId,
        timers.setTimeout(() => {
          pending.delete(learnerId);
          run(learnerId);
        }, delayMs),
      );
    },
    /** Run everything queued right now (app start, back online). */
    flush(): void {
      for (const [learnerId, handle] of pending) {
        timers.clearTimeout(handle);
        pending.delete(learnerId);
        run(learnerId);
      }
    },
    pendingCount(): number {
      return pending.size;
    },
  };
}
