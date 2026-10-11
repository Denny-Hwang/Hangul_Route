import { describe, expect, it } from 'vitest';
import { ONBOARDING_TELEMETRY_PAYLOADS, isTelemetryEventName } from '@hangul-route/content-schema';
import { consentGiven, levelSelected, onboardingStarted, pinCreated, whoSelected } from '../onboarding-events';

describe('onboarding telemetry builders (F-LEARN-001 §3.8)', () => {
  const events = [
    whoSelected(true),
    levelSelected('10-11'),
    consentGiven('guardian', true, true),
    consentGiven('self_13plus', false, false),
    onboardingStarted('5-7', false, true),
    pinCreated('first_run'),
    pinCreated('optional'),
  ];

  it('uses whitelisted names with payloads that match the strict schemas', () => {
    for (const e of events) {
      expect(isTelemetryEventName(e.name)).toBe(true);
      const schema = ONBOARDING_TELEMETRY_PAYLOADS[e.name as keyof typeof ONBOARDING_TELEMETRY_PAYLOADS];
      expect(schema.safeParse(e.payload).success).toBe(true);
    }
  });

  it('carries the level, never an age, a name, an email or the learner type', () => {
    expect(onboardingStarted('8-9', true, false).payload).toEqual({ level: '8-9', firstRun: true, hasEmail: false });
    for (const e of events) expect(Object.keys(e.payload)).not.toEqual(expect.arrayContaining(['learnerType']));
  });
});
