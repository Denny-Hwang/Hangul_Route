/**
 * Telemetry client — fire-and-forget POSTs to `/api/telemetry`.
 *
 * Contract:
 * - Never throws. A failed event must not crash a quest.
 * - Never blocks. Returns immediately; the network call resolves in the
 *   background.
 * - Honors `flags.telemetryEnabled` (no-op if false).
 * - Honors `flags.telemetryNetwork` (runs validation but skips fetch).
 * - Skips the network entirely while `EXPO_PUBLIC_API_BASE_URL` is unset —
 *   the placeholder default must never receive traffic.
 *
 * Event names come from `TELEMETRY_EVENT_NAMES` in @hangul-route/content-schema,
 * the same list POST /api/telemetry accepts. The client's `at` timestamp is
 * kept by the API, so offline-queued events keep their real time.
 */

import type { TelemetryEventName } from '@hangul-route/content-schema';
import { flags } from '../config/flags';
import { arrivedSince, enqueue, requeue, takeBatch, type QueuedEvent } from '../logic/telemetry/queue';
import { readJsonStrict, writeJson } from './storage';

/** The shared list the API whitelists — an event outside it cannot compile. */
export type { TelemetryEventName };

export interface TelemetryEvent {
  name: TelemetryEventName;
  profileId?: string;
  payload?: Record<string, unknown>;
}

export interface TelemetryClientOptions {
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

const PLACEHOLDER_ENDPOINT = 'https://api.hangulroute.example';
const QUEUE_KEY = 'telemetry:queue';
/** Web Locks name shared by every tab of the PWA (they share one IndexedDB queue). */
const QUEUE_LOCK = 'hr:telemetry:queue';

async function postEvent(
  endpoint: string,
  fetchImpl: typeof fetch,
  body: { name: string; profileId?: string; payload?: Record<string, unknown>; at?: string },
): Promise<'ok' | 'retry' | 'drop'> {
  try {
    const res = await fetchImpl(`${endpoint}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return 'ok';
    // 5xx / 429 are transient; any other 4xx means the event itself is
    // rejected and must not clog the queue forever.
    return res.status >= 500 || res.status === 429 ? 'retry' : 'drop';
  } catch {
    return 'retry';
  }
}

/**
 * The stored queue. A failed storage read throws (it is not an empty queue),
 * so the caller's write is skipped instead of overwriting events it could not
 * see; the next event or flush tries again. Unparsable data counts as empty.
 */
async function readQueue(): Promise<QueuedEvent[]> {
  const stored = await readJsonStrict<unknown>(QUEUE_KEY);
  return Array.isArray(stored) ? (stored as QueuedEvent[]) : [];
}

/** A local event id that stays unique across tabs and sessions (not a secret). */
function newEventId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface LockManagerLike {
  request: <T>(name: string, callback: () => Promise<T>) => Promise<T>;
}

/**
 * Run `step` under the cross-tab queue lock when the browser has Web Locks,
 * so PWA tabs (one shared IndexedDB queue) never interleave a
 * read-modify-write. Native, and browsers without Web Locks, run it directly:
 * there two tabs appending at the same instant can still race.
 */
function withQueueLock<T>(step: () => Promise<T>): Promise<T> {
  const locks = (globalThis as { navigator?: { locks?: Partial<LockManagerLike> } }).navigator?.locks;
  if (typeof locks?.request !== 'function') return step();
  return (locks as LockManagerLike).request(QUEUE_LOCK, step);
}

/**
 * Every read-modify-write of the stored queue runs one at a time on this
 * chain (issue #261): a Results visit sends several events in one tick, and
 * unchained writers each read the same queue and overwrite each other. The
 * chain covers this JS context; `withQueueLock` extends it across tabs where
 * the browser allows. A failed step never breaks the chain for the steps
 * after it.
 */
let queueTail: Promise<unknown> = Promise.resolve();
function serialized<T>(step: () => Promise<T>): Promise<T> {
  const run = queueTail.then(() => withQueueLock(step));
  queueTail = run.catch(() => undefined);
  return run;
}

async function queueEvent(event: TelemetryEvent, at: string): Promise<void> {
  try {
    await serialized(async () => {
      const current = await readQueue();
      await writeJson(QUEUE_KEY, enqueue(current, { name: event.name, profileId: event.profileId, payload: event.payload, at, id: newEventId() }));
    });
  } catch {
    // Queueing is best effort — never surface storage errors into a game.
  }
}

let flushing = false;

/**
 * Send queued offline events in order (F-PWA-001 §3.2). Stops at the first
 * batch that fails so nothing is lost or reordered. Returns the number sent.
 */
export async function flushQueue(options?: TelemetryClientOptions): Promise<number> {
  if (flushing || !flags.telemetryEnabled || !flags.telemetryNetwork) return 0;
  const endpoint = endpointFor(options);
  if (endpoint === PLACEHOLDER_ENDPOINT) return 0;
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') return 0;
  flushing = true;
  let sent = 0;
  try {
    const start = await serialized(readQueue);
    let queue = start;
    while (queue.length > 0) {
      const { batch, rest } = takeBatch(queue);
      let failedAt = -1;
      for (let i = 0; i < batch.length; i += 1) {
        const ev = batch[i] as QueuedEvent;
        // The local id stays on the device.
        const result = await postEvent(endpoint, fetchImpl, { name: ev.name, profileId: ev.profileId, payload: ev.payload, at: ev.at });
        if (result === 'ok') sent += 1;
        else if (result === 'retry') {
          failedAt = i;
          break;
        }
        // 'drop': skip it and keep going
      }
      if (failedAt >= 0) {
        queue = requeue(batch.slice(failedAt), rest);
        break;
      }
      queue = rest;
    }
    const unsent = queue;
    await serialized(async () => {
      // Events queued while the batches were sending, by this tab or another
      // one, are the stored events this flush did not read at the start.
      const late = arrivedSince(await readQueue(), start);
      await writeJson(QUEUE_KEY, late.reduce((q, e) => enqueue(q, e), unsent));
    });
  } catch {
    // leave whatever we have; next flush retries
  } finally {
    flushing = false;
  }
  return sent;
}

const DEFAULT_ENDPOINT =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? PLACEHOLDER_ENDPOINT;

function endpointFor(opts: TelemetryClientOptions | undefined): string {
  return opts?.endpoint ?? DEFAULT_ENDPOINT;
}

type TelemetryListener = (event: TelemetryEvent) => void;
const listeners = new Set<TelemetryListener>();

/**
 * Observe every event `track` accepts (before the network decision). Used by
 * the story fixture e2e build (`navigation/story-e2e.tsx`) to check what the
 * reader emits; nothing registers one in a real build. Returns the unsubscribe.
 */
export function addTelemetryListener(listener: TelemetryListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(event: TelemetryEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // An observer never breaks telemetry.
    }
  }
}

/**
 * Send a telemetry event. Returns a Promise that always resolves —
 * `true` if the event was queued/sent successfully, `false` otherwise.
 * Callers can `void track(...)` safely.
 */
export async function track(
  event: TelemetryEvent,
  options?: TelemetryClientOptions,
): Promise<boolean> {
  if (!flags.telemetryEnabled) return false;

  // Run validation even when network is off, so dev mode catches typos.
  if (!event.name || typeof event.name !== 'string') return false;
  notify(event);

  if (!flags.telemetryNetwork) return true;

  const endpoint = endpointFor(options);
  if (endpoint === PLACEHOLDER_ENDPOINT) return true;

  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') return false;

  const at = new Date().toISOString();
  const result = await postEvent(endpoint, fetchImpl, {
    name: event.name,
    profileId: event.profileId,
    payload: event.payload,
    at,
  });
  if (result === 'ok') {
    // A success means we are online: drain anything queued while offline.
    void flushQueue(options);
    return true;
  }
  if (result === 'retry') await queueEvent(event, at);
  return false;
}
