import { describe, expect, it } from 'vitest';
import { TELEMETRY_EVENT_NAMES, TelemetryEventNameSchema, isTelemetryEventName } from '../index';

describe('telemetry event names (one list for the client type and the API whitelist)', () => {
  it('covers every event the learner app sends, including spaces and paywall', () => {
    expect([...TELEMETRY_EVENT_NAMES].sort()).toEqual(
      [
        'audio.capability_checked',
        'audio.fallback_shown',
        'audio.mute_changed',
        'audio.playback_failed',
        'card.first_earned',
        'card.unlocked',
        'episode.complete',
        'episode.start',
        'minigame.finished',
        'onboarding.consent_given',
        'onboarding.level_selected',
        'onboarding.started',
        'onboarding.who_selected',
        'parent.gate.opened',
        'paywall.console_opened',
        'paywall.viewed',
        'pin.created',
        'pin.reset_completed',
        'pin.reset_requested',
        'placement.complete',
        'placement.item_answered',
        'placement.override_applied',
        'placement.skipped',
        'placement.start',
        'profile.switch',
        'profile.updated',
        'quest.check_completed',
        'quest.complete',
        'quest.discover_completed',
        'quest.start',
        'quest.teaser_tapped',
        'review.complete',
        'review.start',
        'round.correct',
        'round.wrong',
        'session.end',
        'session.start',
        'space.join.attempted',
        'space.join.failed',
        'space.join.succeeded',
        'space.left',
        'space.relink.approved',
        'space.relink.denied',
        'space.relink.requested',
        'locale.changed',
        'romanization.mode_changed',
        'stage.complete',
        'story.check.answered',
        'story.check.finished',
        'story.read.finished',
        'story.recap.word_played',
        'story.results.action',
        'story.sequence.finished',
        'story.sources.link_opened',
        'story.sources.opened',
        'space.transfer.requested',
        'space.transfer.consented',
        'space.transfer.declined',
        'space.transfer.cancelled',
        'space.transfer.completed',
        'route_map.viewed',
        'route_map.stage_opened',
        'route_map.continue_tapped',
        'route_map.goal_reached',
        'layout.observed',
        'layout.guard_shown',
        'layout.guard_dismissed',
        'lecture.start',
        'lecture.complete',
        'lecture.tool_used',
        'lecture.deck_rejected',
        'story.shelf.viewed',
        'story.opened',
        'home.story_card.shown',
        'story.bookmark.resumed',
        'culture.note.viewed',
        'story.locked.tapped',
        'card.catchup_granted',
        'card_set.complete',
        'route.created',
        'route.repaced',
        'route.proposed',
        'route.proposal_skipped',
        'route.updated',
        'vocab.topic_opened',
        'vocab.cards.start',
        'vocab.cards.complete',
        'home.vocab_card.shown',
        'vocab.round.start',
        'vocab.round.complete',
        'vocab.challenge_toggled',
        'shell.persona_chosen',
        'shell.grown_up_handoff',
        'shell.path_bounced',
        'browse.opened',
        'browse.item_viewed',
        'browse.preview_started',
        'browse.preview_ended',
        'browse.plans_tapped',
        'access.preview_opened',
        'access.help_asked',
        'access.free_end_reached',
        'route.next_started',
        'route.offplan_finished',
        'report.viewed',
        'notes.card_shown',
        'notes.list_viewed',
        'notes.note_opened',
        'notes.reaction_picked',
        'notes.suggest_started',
        'notes.report_sent',
        'notes.prefs_changed',
        'billing.checkout_completed',
        'billing.payment_failed',
        'billing.refund_recorded',
        'billing.checkout_started',
        'billing.checkout_refused',
        'billing.portal_opened',
        'journey.cell_stories_opened',
      ].sort(),
    );
    expect(new Set(TELEMETRY_EVENT_NAMES).size).toBe(TELEMETRY_EVENT_NAMES.length);
  });

  it('lists the six story-shelf names of F-STORY-004 §3.11 exactly once each', () => {
    const shelf = ['story.shelf.viewed', 'story.opened', 'home.story_card.shown', 'story.bookmark.resumed', 'culture.note.viewed', 'story.locked.tapped'];
    for (const name of shelf) {
      expect(TELEMETRY_EVENT_NAMES.filter((n) => n === name)).toHaveLength(1);
      expect(isTelemetryEventName(name)).toBe(true);
    }
  });

  it('lists the F-STORY-005 map event once, in the journey namespace', () => {
    expect(TELEMETRY_EVENT_NAMES.filter((n) => n === 'journey.cell_stories_opened')).toHaveLength(1);
    expect(isTelemetryEventName('journey.cell_stories_opened')).toBe(true);
  });

  it('accepts listed names and rejects anything else', () => {
    expect(TelemetryEventNameSchema.safeParse('paywall.viewed').success).toBe(true);
    expect(TelemetryEventNameSchema.safeParse('parent.notify.queued').success).toBe(false);
    expect(TelemetryEventNameSchema.safeParse('').success).toBe(false);
    expect(TelemetryEventNameSchema.safeParse(42).success).toBe(false);
  });

  it('lists the three route_map names of F-ROUTE-001 section 3.16 (Worker first, R-W1)', () => {
    for (const name of ['route_map.viewed', 'route_map.stage_opened', 'route_map.continue_tapped']) {
      expect(isTelemetryEventName(name)).toBe(true);
    }
    expect(isTelemetryEventName('route_map.opened')).toBe(false);
  });

  it('lists route_map.goal_reached once, right after route_map.continue_tapped (Learning Route section 8; Worker first, LR-W1)', () => {
    expect(TELEMETRY_EVENT_NAMES.filter((n) => n === 'route_map.goal_reached')).toHaveLength(1);
    expect(isTelemetryEventName('route_map.goal_reached')).toBe(true);
    expect(TELEMETRY_EVENT_NAMES.indexOf('route_map.goal_reached')).toBe(TELEMETRY_EVENT_NAMES.indexOf('route_map.continue_tapped') + 1);
    expect(isTelemetryEventName('route_map.goal_set')).toBe(false);
  });

  it('lists the five route names of F-PLAN-002 section 3.11 (FP-B7; Worker first, P2-4)', () => {
    for (const name of ['route.created', 'route.repaced', 'route.proposed', 'route.proposal_skipped', 'route.updated']) {
      expect(isTelemetryEventName(name)).toBe(true);
    }
    expect(isTelemetryEventName('route.started')).toBe(false);
  });

  it('lists the three vocabulary names of F-VOC-003 section 3.7 (Worker first, C-1)', () => {
    for (const name of ['vocab.topic_opened', 'vocab.cards.start', 'vocab.cards.complete']) {
      expect(TELEMETRY_EVENT_NAMES.filter((n) => n === name)).toHaveLength(1);
      expect(isTelemetryEventName(name)).toBe(true);
    }
    expect(isTelemetryEventName('vocab.cards.finished')).toBe(false);
  });

  it('lists the Home vocabulary card name of F-VOC-005 section 3.9 (Worker first, P-1)', () => {
    expect(isTelemetryEventName('home.vocab_card.shown')).toBe(true);
    expect(TELEMETRY_EVENT_NAMES.filter((n) => n === 'home.vocab_card.shown')).toHaveLength(1);
    expect(isTelemetryEventName('home.vocab_card.opened')).toBe(false);
  });

  it('lists the three Speed Round names of F-VOC-004 section 3.10 (Worker first, S-1)', () => {
    for (const name of ['vocab.round.start', 'vocab.round.complete', 'vocab.challenge_toggled']) {
      expect(TELEMETRY_EVENT_NAMES.filter((n) => n === name)).toHaveLength(1);
      expect(isTelemetryEventName(name)).toBe(true);
    }
    expect(isTelemetryEventName('vocab.round.finished')).toBe(false);
    expect(isTelemetryEventName('vocab.challenge_toggle')).toBe(false);
  });

  it('lists the three shell names of F-APP-001 section 3.18 (Worker first, A-1)', () => {
    for (const name of ['shell.persona_chosen', 'shell.grown_up_handoff', 'shell.path_bounced']) {
      expect(TELEMETRY_EVENT_NAMES.filter((n) => n === name)).toHaveLength(1);
      expect(isTelemetryEventName(name)).toBe(true);
    }
    expect(isTelemetryEventName('shell.persona_selected')).toBe(false);
  });

  it('lists the five browse names of F-BROWSE-001 section 9 (Worker first, BR-1)', () => {
    for (const name of ['browse.opened', 'browse.item_viewed', 'browse.preview_started', 'browse.preview_ended', 'browse.plans_tapped']) {
      expect(TELEMETRY_EVENT_NAMES.filter((n) => n === name)).toHaveLength(1);
      expect(isTelemetryEventName(name)).toBe(true);
    }
    expect(isTelemetryEventName('browse.started')).toBe(false);
  });

  it('lists the five free-plan and next names of F-ENT-003 section 3.12 (Worker first, E3-1b)', () => {
    for (const name of ['access.preview_opened', 'access.help_asked', 'access.free_end_reached', 'route.next_started', 'route.offplan_finished']) {
      expect(TELEMETRY_EVENT_NAMES.filter((n) => n === name)).toHaveLength(1);
      expect(isTelemetryEventName(name)).toBe(true);
    }
    expect(isTelemetryEventName('access.paywall_shown')).toBe(false);
    expect(isTelemetryEventName('route.next_opened')).toBe(false);
  });

  it('lists the report name of F-REPORT-001 section 3.13 exactly once (Worker first, RP-W1)', () => {
    expect(TELEMETRY_EVENT_NAMES.filter((n) => n === 'report.viewed')).toHaveLength(1);
    expect(isTelemetryEventName('report.viewed')).toBe(true);
    expect(isTelemetryEventName('report.opened')).toBe(false);
    expect(TELEMETRY_EVENT_NAMES.filter((n) => n.startsWith('report.'))).toEqual(['report.viewed']);
  });

  it('lists the seven notes names of F-FEEDBACK-001 section 10 (Worker first, FB-1)', () => {
    const notes = [
      'notes.card_shown',
      'notes.list_viewed',
      'notes.note_opened',
      'notes.reaction_picked',
      'notes.suggest_started',
      'notes.report_sent',
      'notes.prefs_changed',
    ];
    for (const name of notes) {
      expect(TELEMETRY_EVENT_NAMES.filter((n) => n === name)).toHaveLength(1);
      expect(isTelemetryEventName(name)).toBe(true);
    }
    expect(TELEMETRY_EVENT_NAMES.filter((n) => n.startsWith('notes.'))).toEqual(notes);
    expect(isTelemetryEventName('notes.note_read')).toBe(false);
  });

  it('lists the billing names of F-BILL-002 section 10, appended in order (B-3, then B-5; B-4 appends its own)', () => {
    const webhook = ['billing.checkout_completed', 'billing.payment_failed', 'billing.refund_recorded'];
    const checkout = ['billing.checkout_started', 'billing.checkout_refused', 'billing.portal_opened'];
    for (const name of [...webhook, ...checkout]) {
      expect(TELEMETRY_EVENT_NAMES.filter((n) => n === name)).toHaveLength(1);
      expect(isTelemetryEventName(name)).toBe(true);
    }
    expect(TELEMETRY_EVENT_NAMES.filter((n) => n.startsWith('billing.'))).toEqual([...webhook, ...checkout]);
    // Not yet: B-4 adds these with the code that sends them.
    for (const later of ['billing.summary_viewed', 'billing.receipts_viewed']) {
      expect(isTelemetryEventName(later)).toBe(false);
    }
  });

  it('narrows unknown input with isTelemetryEventName', () => {
    expect(isTelemetryEventName('space.left')).toBe(true);
    expect(isTelemetryEventName('space.LEFT')).toBe(false);
    expect(isTelemetryEventName(undefined)).toBe(false);
  });
});
