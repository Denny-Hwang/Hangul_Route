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
  // F-ROUTE-001 §3.16 (payloads carry stage keys, booleans and codes only; active profile only)
  'route_map.viewed',
  'route_map.stage_opened',
  'route_map.continue_tapped',
  // Learning Route section 8 (payload { stage, goalFrom }: a stage key and a source code only; LR-W1, Worker first)
  'route_map.goal_reached',
  // F-LAYOUT-001 §3.13 (classes only: no sizes in px, no profile data)
  'layout.observed',
  'layout.guard_shown',
  'layout.guard_dismissed',
  // F-TCH-004 §3.14 (no profileId; never a name, picker label or the deck title)
  'lecture.start',
  'lecture.complete',
  'lecture.tool_used',
  'lecture.deck_rejected',
  // F-STORY-004 §3.11 (payloads carry ids and counts only)
  'story.shelf.viewed',
  'story.opened',
  'home.story_card.shown',
  'story.bookmark.resumed',
  'culture.note.viewed',
  'story.locked.tapped',
  // F-STORY-006 §3.9 (payloads carry ids and counts only)
  'card.catchup_granted',
  'card_set.complete',
  // F-PLAN-002 §3.11 incl. FP-B7 (codes and counts only; app only, the console has no telemetry client)
  'route.created',
  'route.repaced',
  'route.proposed',
  'route.proposal_skipped',
  'route.updated',
  // F-VOC-003 §3.7 (topic keys, levels and counts only; never a word, a name or free text)
  'vocab.topic_opened',
  'vocab.cards.start',
  'vocab.cards.complete',
  // F-VOC-005 §3.9 (payload { topicKey, due }: a topic key and a count only)
  'home.vocab_card.shown',
  // F-VOC-004 §3.10 (ids, codes and counts only; `level` is levelOrder, never an age)
  'vocab.round.start',
  'vocab.round.complete',
  'vocab.challenge_toggled',
  // F-APP-001 §3.18 (learner app only; codes only, never a profileId)
  'shell.persona_chosen',
  'shell.grown_up_handoff',
  'shell.path_bounced',
  // F-BROWSE-001 §9 (sent without profileId; content ids and codes only, never a person id)
  'browse.opened',
  'browse.item_viewed',
  'browse.preview_started',
  'browse.preview_ended',
  'browse.plans_tapped',
  // F-ENT-003 §3.12 (stage keys, codes and counts only; `day` is the internal route day; never a title, name, price or tier word)
  'access.preview_opened',
  'access.help_asked',
  'access.free_end_reached',
  'route.next_started',
  'route.offplan_finished',
  // F-REPORT-001 §3.13 (payload { scope, space, period }: codes only, never a profileId, space id, learner id or name)
  'report.viewed',
  // F-FEEDBACK-001 §10 (ids, codes and counts only; every notes.* event is sent without profileId)
  'notes.card_shown',
  'notes.list_viewed',
  'notes.note_opened',
  'notes.reaction_picked',
  'notes.suggest_started',
  'notes.report_sent',
  'notes.prefs_changed',
  // F-BILL-002 §10 (recorded by the Worker only, from the Stripe webhook; POST /api/telemetry refuses billing.* with 422;
  // payload codes only: planKey, mode, duplicate / full; never an account, space or learner id, an amount, a code or a URL)
  'billing.checkout_completed',
  'billing.payment_failed',
  'billing.refund_recorded',
  // F-BILL-002 §10, B-5 (recorded by the Worker on checkout and portal; codes only: planKey, mode, promo flag, refusal reason)
  'billing.checkout_started',
  'billing.checkout_refused',
  'billing.portal_opened',
] as const;

export const TelemetryEventNameSchema = z.enum(TELEMETRY_EVENT_NAMES);
export type TelemetryEventName = z.infer<typeof TelemetryEventNameSchema>;

const NAMES: ReadonlySet<string> = new Set(TELEMETRY_EVENT_NAMES);

export function isTelemetryEventName(value: unknown): value is TelemetryEventName {
  return typeof value === 'string' && NAMES.has(value);
}
