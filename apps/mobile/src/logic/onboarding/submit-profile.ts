import type { AvatarKind, LearnerLevelId, LearnerType, Profile } from '@hangul-route/content-schema';
import type { CreateProfileInput } from '../profiles/profile-model';
import { formPlan, missingStep, type FormState } from './create-profile-form';
import { consentGiven, guestSaved, onboardingStarted, pinCreated, type OnboardingEvent } from './onboarding-events';

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
  /**
   * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 5.4, 8.3, 8.5 and 12 (row GU-4): the profile is the live guest's,
   * promoted (`deps.createProfile` is then `promoteGuest`'s shell): `onboarding.started` gains `fromGuest: true` and
   * `guest.saved { gated, consent, via }` goes last. `gated`: the save asked the PIN (`SaveGuest`); `via`: where it
   * began (Results, Welcome's card, the Not now card, or the first-run setup, GU-D11).
   */
  guest?: { gated: boolean; via: GuestSaveVia };
}

/** [GU] Section 12: where a guest's save began (`guest.saved.via`). */
export type GuestSaveVia = 'results' | 'welcome' | 'later' | 'setup';

export interface SubmitDeps {
  hashPin: (pin: string) => Promise<string>;
  acceptGuardianConsent: () => void;
  acceptSelfConsent: () => void;
  setParentPinHash: (hash: string) => void;
  setParentEmail: (email: string) => void;
  /**
   * Writes the profile. [GU] On a guest's save it is `promoteGuest` (the guest's id kept, GU-D9), which resolves once
   * `hr:profiles` is written, or to null when it could not be (`save-failed`: the guest stays, Continue can be tried again).
   */
  createProfile: (input: CreateProfileInput & { learnerType: LearnerType }) => Profile | Promise<Profile | null>;
  track: (event: OnboardingEvent) => void;
}

export type SubmitResult =
  | { ok: true; profile: Profile }
  | { ok: false; reason: 'incomplete' | 'pin-failed' | 'save-failed' };

export async function submitProfile({ state, level, avatar, firstRun, guest }: SubmitInput, deps: SubmitDeps): Promise<SubmitResult> {
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
  const profile = await deps.createProfile({ displayName: state.name.trim(), ageGroup: level, avatar, learnerType });
  if (profile === null) return { ok: false, reason: 'save-failed' };

  const hasEmail = email !== '';
  if (plan.consent !== null) {
    deps.track({ ...consentGiven(plan.consent === 'guardian' ? 'guardian' : 'self_13plus', hasEmail, pinHash !== null), profileId: profile.id });
  }
  if (pinHash !== null) deps.track({ ...pinCreated(learnerType === 'child' ? 'first_run' : 'optional'), profileId: profile.id });
  deps.track({ ...onboardingStarted(level, firstRun, hasEmail, guest === undefined ? undefined : true), profileId: profile.id });
  // [GU] No profile id: the Worker drops one from every `guest.*` event anyway (GU-D15).
  if (guest !== undefined) deps.track(guestSaved(guest.gated, plan.consent === null ? 'existing' : 'new', guest.via));
  return { ok: true, profile };
}
