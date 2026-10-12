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
  /**
   * Local id, unique across tabs, so a flush can tell which stored events
   * arrived while it was sending (`arrivedSince`). Never sent to the API.
   * Events queued by builds before it have none.
   */
  id?: string;
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

/**
 * The stored events that arrived after a flush read `seen`: those with an id
 * `seen` does not hold, in stored order. Works across tabs that share one
 * stored queue, where counting this tab's own appends misses another tab's.
 * An event without an id predates ids, so it was already stored when the
 * flush began.
 */
export function arrivedSince(stored: readonly QueuedEvent[], seen: readonly QueuedEvent[]): QueuedEvent[] {
  const seenIds = new Set(seen.map((e) => e.id));
  return stored.filter((e) => e.id !== undefined && !seenIds.has(e.id));
}
