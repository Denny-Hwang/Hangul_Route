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
        'vocab.round.start',
        'vocab.round.complete',
        'vocab.challenge_toggled',
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

  it('lists the five route names of F-PLAN-002 section 3.11 (FP-B7; Worker first, P2-4)', () => {
    for (const name of ['route.created', 'route.repaced', 'route.proposed', 'route.proposal_skipped', 'route.updated']) {
      expect(isTelemetryEventName(name)).toBe(true);
    }
    expect(isTelemetryEventName('route.started')).toBe(false);
  });

  it('lists the three Speed Round names of F-VOC-004 section 3.10 (Worker first, S-1)', () => {
    for (const name of ['vocab.round.start', 'vocab.round.complete', 'vocab.challenge_toggled']) {
      expect(TELEMETRY_EVENT_NAMES.filter((n) => n === name)).toHaveLength(1);
      expect(isTelemetryEventName(name)).toBe(true);
    }
    expect(isTelemetryEventName('vocab.round.finished')).toBe(false);
    expect(isTelemetryEventName('vocab.challenge_toggle')).toBe(false);
  });

  it('narrows unknown input with isTelemetryEventName', () => {
    expect(isTelemetryEventName('space.left')).toBe(true);
    expect(isTelemetryEventName('space.LEFT')).toBe(false);
    expect(isTelemetryEventName(undefined)).toBe(false);
  });
});
