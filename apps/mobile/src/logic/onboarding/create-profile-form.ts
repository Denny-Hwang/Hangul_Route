import type { LearnerType } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { isValidEmail } from '../email';
import { pinRequiredForNewProfile, requiredConsent } from '../profiles/learner-type';
import { NAME_MAX, validateDisplayName } from '../profiles/profile-model';

/**
 * Pure rules of the CreateProfile form — F-LEARN-001 §3.2, §3.3. The screen
 * only paints what these return, so the branching (who is learning, which
 * card, what is still missing) is tested without a renderer.
 */

/** Everything the form's validity depends on: the answers plus what the device already holds. */
export interface FormState {
  /** `null` until section 1 is answered (L4: no preselected answer). */
  learnerType: LearnerType | null;
  name: string;
  email: string;
  /** The consent checkbox. */
  agreed: boolean;
  /** The confirmed PIN, or `null` while none is set. */
  pin: string | null;
  guardianAcceptedAt: string | null;
  selfAcceptedAt: string | null;
  parentPinHash: string | null;
}

export interface FormPlan {
  /** Which card is drawn at the bottom of the form; `null` for none. */
  card: 'guardian' | 'self' | null;
  /** Which consent the checkbox records (`requiredConsent`); `null` when none is needed. */
  consent: 'guardian' | 'self' | null;
  /** The grown-up PIN must be created before Continue (child on a device with no PIN). */
  pinRequired: boolean;
  /** The self card offers a collapsed "Protect settings with a PIN (optional)" row. */
  pinOptional: boolean;
  /** The optional email field is shown (it belongs to the consent step). */
  showEmail: boolean;
}

/** What the lower half of the form needs for this answer; `null` before section 1 is answered. */
export function formPlan(s: FormState): FormPlan | null {
  if (s.learnerType === null) return null;
  const consent = requiredConsent({
    learnerType: s.learnerType,
    guardianAcceptedAt: s.guardianAcceptedAt,
    selfAcceptedAt: s.selfAcceptedAt,
  });
  const pinRequired = pinRequiredForNewProfile({ learnerType: s.learnerType, parentPinHash: s.parentPinHash });
  const card = s.learnerType === 'child' ? (consent !== null || pinRequired ? 'guardian' : null) : consent === 'self' ? 'self' : null;
  return {
    card,
    consent,
    pinRequired,
    pinOptional: card === 'self',
    showEmail: consent !== null,
  };
}

export type MissingStep = 'who' | 'name' | 'agree' | 'pin' | 'email';

/** The calm line under a disabled Continue, one per missing step (audit UX-27). */
export const MISSING_STEP_CAPTION: Readonly<Record<MissingStep, string>> = {
  who: 'Choose who is learning',
  name: 'Type a name',
  agree: 'Tick the box to agree',
  pin: 'Create the PIN',
  email: 'Check the email, or leave it empty',
};

/** The next thing the form still needs, in the order the caption names them; `null` when it is complete. */
export function missingStep(s: FormState): MissingStep | null {
  const plan = formPlan(s);
  if (plan === null) return 'who';
  // The single name rule (profile-model), so this form never waves through what `createProfile` throws on.
  if (validateDisplayName(s.name) !== null) return 'name';
  if (plan.consent !== null && !s.agreed) return 'agree';
  if (plan.pinRequired && s.pin === null) return 'pin';
  if (plan.showEmail && s.email.trim() !== '' && !isValidEmail(s.email)) return 'email';
  return null;
}

/** The two hint sentences, from the dictionary (`m.learner.createProfile.nameHint`). */
export type NameHintMessages = Messages['learner']['createProfile']['nameHint'];

/** Hint under the name field. 'too-short' is an unfinished field, never scolded. */
export function nameHint(name: string, words: NameHintMessages): string | null {
  const error = validateDisplayName(name);
  if (error === 'too-long') return words.tooLong(NAME_MAX);
  if (error === 'unsupported-character') return words.unsupportedCharacter;
  return null;
}
