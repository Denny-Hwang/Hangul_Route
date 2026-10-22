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

/** [GU] `fromGuest` (row GU-4): sent, as true, only when the profile was saved from a guest's first quest. */
export const onboardingStarted = (level: LearnerLevelId, firstRun: boolean, hasEmail: boolean, fromGuest?: true): OnboardingEvent => ({
  name: 'onboarding.started',
  payload: fromGuest === undefined ? { level, firstRun, hasEmail } : { level, firstRun, hasEmail, fromGuest },
});

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 12 (row GU-4): the first quest was saved as a profile. Codes only, never
 * `learnerType` or an id (`GUEST_TELEMETRY_PAYLOADS['guest.saved']`).
 */
export const guestSaved = (gated: boolean, consent: 'new' | 'existing', via: 'results' | 'welcome' | 'later' | 'setup'): OnboardingEvent => ({
  name: 'guest.saved',
  payload: { gated, consent, via },
});

export const pinCreated = (where: 'first_run' | 'gate' | 'reset' | 'optional'): OnboardingEvent => ({
  name: 'pin.created',
  payload: { where },
});

/** [OA] `wait_cancelled`: the chooser's Cancel the wait (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 15, row OA-4a). `sign_in`:
 * Sign in to the account on Forgot PIN? (row OA-6). */
export const pinResetRequested = (method: 'rescue_code' | 'wait' | 'wait_cancelled' | 'sign_in'): OnboardingEvent => ({
  name: 'pin.reset_requested',
  payload: { method },
});

/** [OA] `sign_in`: a new PIN set after the console's sign-in reset ticket (section 15, row OA-6). */
export const pinResetCompleted = (method: 'rescue_code' | 'wait' | 'sign_in'): OnboardingEvent => ({
  name: 'pin.reset_completed',
  payload: { method },
});
