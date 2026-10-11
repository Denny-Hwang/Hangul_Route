import type { LearnerLevelId, TelemetryEventName } from '@hangul-route/content-schema';

/**
 * Typed builders for the onboarding telemetry events — F-LEARN-001 §3.8.
 * Payload shapes are the strict zod objects in content-schema
 * (`ONBOARDING_TELEMETRY_PAYLOADS`); the tests parse every builder against
 * them, so a stray name, email or `learnerType` cannot get in. Owner decision
 * 2026-10-10: `learnerType` is never sent.
 */
export interface OnboardingEvent {
  name: TelemetryEventName;
  profileId?: string;
  payload: Record<string, unknown>;
}

export const whoSelected = (firstRun: boolean): OnboardingEvent => ({
  name: 'onboarding.who_selected',
  payload: { firstRun },
});

export const levelSelected = (level: LearnerLevelId): OnboardingEvent => ({
  name: 'onboarding.level_selected',
  payload: { level },
});

export const consentGiven = (basis: 'guardian' | 'self_13plus', hasEmail: boolean, pinSet: boolean): OnboardingEvent => ({
  name: 'onboarding.consent_given',
  payload: { basis, hasEmail, pinSet },
});

export const onboardingStarted = (level: LearnerLevelId, firstRun: boolean, hasEmail: boolean): OnboardingEvent => ({
  name: 'onboarding.started',
  payload: { level, firstRun, hasEmail },
});

export const pinCreated = (where: 'first_run' | 'gate' | 'reset' | 'optional'): OnboardingEvent => ({
  name: 'pin.created',
  payload: { where },
});

export const pinResetRequested = (method: 'rescue_code' | 'wait'): OnboardingEvent => ({
  name: 'pin.reset_requested',
  payload: { method },
});

export const pinResetCompleted = (method: 'rescue_code' | 'wait'): OnboardingEvent => ({
  name: 'pin.reset_completed',
  payload: { method },
});
