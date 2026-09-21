/**
 * Offline telemetry queue — F-PWA-001 §3.2. Pure array operations; the
 * platform wrapper persists the result through `platform/storage`.
 */
export interface QueuedEvent {
  name: string;
  profileId?: string;
  payload?: Record<string, unknown>;
  /** ISO timestamp of the original call, sent as `at` when flushed. */
  at: string;
}

export const TELEMETRY_QUEUE_CAP = 200;
export const TELEMETRY_FLUSH_BATCH = 20;

/** Append, dropping the oldest events once the cap is exceeded. */
export function enqueue(queue: readonly QueuedEvent[], event: QueuedEvent, cap = TELEMETRY_QUEUE_CAP): QueuedEvent[] {
  const next = [...queue, event];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Split off the next batch to send, oldest first. */
export function takeBatch(
  queue: readonly QueuedEvent[],
  size = TELEMETRY_FLUSH_BATCH,
): { batch: QueuedEvent[]; rest: QueuedEvent[] } {
  return { batch: queue.slice(0, size), rest: queue.slice(size) };
}

/** Put a failed batch back in front so order is preserved. */
export function requeue(failed: readonly QueuedEvent[], rest: readonly QueuedEvent[]): QueuedEvent[] {
  return [...failed, ...rest];
}
