import { z } from 'zod';

/**
 * Telemetry event names (F-PWA-001 §3.2) — the one list shared by the
 * learner app's `track()` type and the API's POST /api/telemetry whitelist,
 * so the two cannot drift again (audit SEC-3: nine names the app sends were
 * rejected with 422 and silently dropped).
 */
export const TELEMETRY_EVENT_NAMES = [
  'session.start',
  'session.end',
  'episode.start',
  'episode.complete',
  'quest.start',
  'quest.complete',
  'round.correct',
  'round.wrong',
  'card.unlocked',
  'card.first_earned',
  'profile.switch',
  'parent.gate.opened',
  'onboarding.started',
  'minigame.finished',
  'space.join.attempted',
  'space.join.succeeded',
  'space.join.failed',
  'space.left',
  'space.relink.requested',
  'space.relink.approved',
  'space.relink.denied',
  'paywall.viewed',
  'paywall.console_opened',
  'locale.changed',
  'romanization.mode_changed',
] as const;

export const TelemetryEventNameSchema = z.enum(TELEMETRY_EVENT_NAMES);
export type TelemetryEventName = z.infer<typeof TelemetryEventNameSchema>;

const NAMES: ReadonlySet<string> = new Set(TELEMETRY_EVENT_NAMES);

export function isTelemetryEventName(value: unknown): value is TelemetryEventName {
  return typeof value === 'string' && NAMES.has(value);
}
