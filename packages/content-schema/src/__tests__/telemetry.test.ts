import { describe, expect, it } from 'vitest';
import { TELEMETRY_EVENT_NAMES, TelemetryEventNameSchema, isTelemetryEventName } from '../index';

describe('telemetry event names (one list for the client type and the API whitelist)', () => {
  it('covers every event the learner app sends, including spaces and paywall', () => {
    expect([...TELEMETRY_EVENT_NAMES].sort()).toEqual(
      [
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
        'profile.switch',
        'profile.updated',
        'quest.complete',
        'quest.start',
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
      ].sort(),
    );
    expect(new Set(TELEMETRY_EVENT_NAMES).size).toBe(TELEMETRY_EVENT_NAMES.length);
  });

  it('accepts listed names and rejects anything else', () => {
    expect(TelemetryEventNameSchema.safeParse('paywall.viewed').success).toBe(true);
    expect(TelemetryEventNameSchema.safeParse('parent.notify.queued').success).toBe(false);
    expect(TelemetryEventNameSchema.safeParse('').success).toBe(false);
    expect(TelemetryEventNameSchema.safeParse(42).success).toBe(false);
  });

  it('narrows unknown input with isTelemetryEventName', () => {
    expect(isTelemetryEventName('space.left')).toBe(true);
    expect(isTelemetryEventName('space.LEFT')).toBe(false);
    expect(isTelemetryEventName(undefined)).toBe(false);
  });
});
