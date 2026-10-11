import type { AvatarKind, LearnerLevelId, LearnerType, Profile } from '@hangul-route/content-schema';
import type { CreateProfileInput } from '../profiles/profile-model';
import { formPlan, missingStep, type FormState } from './create-profile-form';
import { consentGiven, onboardingStarted, pinCreated, type OnboardingEvent } from './onboarding-events';

/**
 * The Continue press of CreateProfile — F-LEARN-001 §3.3, §3.13, §3.14.
 * Orchestration only, with the stores injected so the order is tested:
 * the PIN is hashed first (the one step that can fail, so a failure leaves
 * nothing half-stored), then, synchronously and in this order, consent, PIN
 * hash, email and the profile; the events go out last with the new profile id.
 */
export interface SubmitInput {
  state: FormState;
  level: LearnerLevelId;
  avatar: AvatarKind;
  firstRun: boolean;
}

export interface SubmitDeps {
  hashPin: (pin: string) => Promise<string>;
  acceptGuardianConsent: () => void;
  acceptSelfConsent: () => void;
  setParentPinHash: (hash: string) => void;
  setParentEmail: (email: string) => void;
  createProfile: (input: CreateProfileInput & { learnerType: LearnerType }) => Profile;
  track: (event: OnboardingEvent) => void;
}

export type SubmitResult =
  | { ok: true; profile: Profile }
  | { ok: false; reason: 'incomplete' | 'pin-failed' };

export async function submitProfile({ state, level, avatar, firstRun }: SubmitInput, deps: SubmitDeps): Promise<SubmitResult> {
  const plan = formPlan(state);
  // `learnerType` is non-null whenever the plan is (and `missingStep` covers every other gap).
  if (plan === null || state.learnerType === null || missingStep(state) !== null) return { ok: false, reason: 'incomplete' };
  const learnerType = state.learnerType;

  // A PIN is stored when the card needs one, or when a self learner chose to set one.
  const pin = plan.pinRequired || (plan.pinOptional && state.pin !== null) ? state.pin : null;
  let pinHash: string | null = null;
  if (pin !== null) {
    try {
      pinHash = await deps.hashPin(pin);
    } catch {
      return { ok: false, reason: 'pin-failed' };
    }
  }

  const email = plan.showEmail ? state.email.trim() : '';
  if (plan.consent === 'guardian') deps.acceptGuardianConsent();
  if (plan.consent === 'self') deps.acceptSelfConsent();
  if (pinHash !== null) deps.setParentPinHash(pinHash);
  if (email !== '') deps.setParentEmail(state.email);
  const profile = deps.createProfile({ displayName: state.name.trim(), ageGroup: level, avatar, learnerType });

  const hasEmail = email !== '';
  if (plan.consent !== null) {
    deps.track({ ...consentGiven(plan.consent === 'guardian' ? 'guardian' : 'self_13plus', hasEmail, pinHash !== null), profileId: profile.id });
  }
  if (pinHash !== null) deps.track({ ...pinCreated(learnerType === 'child' ? 'first_run' : 'optional'), profileId: profile.id });
  deps.track({ ...onboardingStarted(level, firstRun, hasEmail), profileId: profile.id });
  return { ok: true, profile };
}
