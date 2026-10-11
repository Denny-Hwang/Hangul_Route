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
  // F-LEARN-001 §3.8 (payloads: onboarding-telemetry.ts; never learnerType)
  'onboarding.who_selected',
  'onboarding.level_selected',
  'onboarding.consent_given',
  'profile.updated',
  'pin.created',
  'pin.reset_requested',
  'pin.reset_completed',
  // F-QUEST-002 §3.13
  'quest.discover_completed',
  'quest.check_completed',
  'quest.teaser_tapped',
  'stage.complete',
  'review.start',
  'review.complete',
  // F-AUDIO-004 §3.14
  'audio.capability_checked',
  'audio.fallback_shown',
  'audio.mute_changed',
  'audio.playback_failed',
  // F-STORY-002 §3.12 (payloads carry ids and counts only)
  'story.read.finished',
  'story.sources.opened',
  'story.sources.link_opened',
  // F-STORY-003 §3.9 (payloads carry ids and counts only)
  'story.check.answered',
  'story.check.finished',
  'story.sequence.finished',
  'story.recap.word_played',
  'story.results.action',
  // F-PLC-001 §3.13 (payloads carry ids, codes and counts only; never learnerType)
  'placement.start',
  'placement.item_answered',
  'placement.complete',
  'placement.skipped',
  'placement.override_applied',
  // F-SPACE-002 §4.12 (payload keys initiator, slot, basis only; sent without profileId; never evidence of consent)
  'space.transfer.requested',
  'space.transfer.consented',
  'space.transfer.declined',
  'space.transfer.cancelled',
  'space.transfer.completed',
] as const;

export const TelemetryEventNameSchema = z.enum(TELEMETRY_EVENT_NAMES);
export type TelemetryEventName = z.infer<typeof TelemetryEventNameSchema>;

const NAMES: ReadonlySet<string> = new Set(TELEMETRY_EVENT_NAMES);

export function isTelemetryEventName(value: unknown): value is TelemetryEventName {
  return typeof value === 'string' && NAMES.has(value);
}
