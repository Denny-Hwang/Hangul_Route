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
 * Event names match the API's `ALLOWED_NAMES` whitelist exactly.
 */

import { flags } from '../config/flags';
import { enqueue, requeue, takeBatch, type QueuedEvent } from '../logic/telemetry/queue';
import { readJson, writeJson } from './storage';

export type TelemetryEventName =
  | 'session.start'
  | 'session.end'
  | 'episode.start'
  | 'episode.complete'
  | 'quest.start'
  | 'quest.complete'
  | 'round.correct'
  | 'round.wrong'
  | 'card.unlocked'
  | 'card.first_earned'
  | 'profile.switch'
  | 'parent.gate.opened'
  | 'onboarding.started'
  | 'minigame.finished'
  | 'space.join.attempted'
  | 'space.join.succeeded'
  | 'space.join.failed'
  | 'space.left'
  | 'space.relink.requested'
  | 'space.relink.approved'
  | 'space.relink.denied';

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

async function readQueue(): Promise<QueuedEvent[]> {
  return (await readJson<QueuedEvent[]>(QUEUE_KEY)) ?? [];
}

async function queueEvent(event: TelemetryEvent, at: string): Promise<void> {
  try {
    const current = await readQueue();
    await writeJson(QUEUE_KEY, enqueue(current, { name: event.name, profileId: event.profileId, payload: event.payload, at }));
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
    let queue = await readQueue();
    while (queue.length > 0) {
      const { batch, rest } = takeBatch(queue);
      let failedAt = -1;
      for (let i = 0; i < batch.length; i += 1) {
        const ev = batch[i] as QueuedEvent;
        const result = await postEvent(endpoint, fetchImpl, ev);
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
    await writeJson(QUEUE_KEY, queue);
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
