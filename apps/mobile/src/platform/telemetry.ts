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
  | 'minigame.finished';

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

  try {
    const res = await fetchImpl(`${endpoint}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: event.name,
        profileId: event.profileId,
        payload: event.payload,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
