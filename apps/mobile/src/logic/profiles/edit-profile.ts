import {
  isLearnerLevelId,
  type AvatarKind,
  type LearnerLevelId,
  type LearnerType,
  type Profile,
} from '@hangul-route/content-schema';
import { pinCreated, type OnboardingEvent } from '../onboarding/onboarding-events';
import { effectiveLearnerType, requiredConsent } from './learner-type';
import { validateDisplayName, type ProfilePatch } from './profile-model';

/**
 * Editing a profile — F-LEARN-001 §3.11. Pure rules and the Save press, with
 * the stores injected so the order is tested; `EditProfileScreen` only paints
 * what these return. Name, level and avatar carry no privacy meaning; a change
 * of "Who is learning?" brings the consent (and, for a child on a device with
 * no PIN, the PIN) that the create form would have asked for.
 */

/** The four editable rows. `level` is `null` while a stored id this build does not know stays untouched. */
export interface EditDraft {
  name: string;
  level: LearnerLevelId | null;
  avatar: AvatarKind;
  learnerType: LearnerType;
}

export interface EditState {
  original: Profile;
  draft: EditDraft;
  /** The consent checkbox. */
  agreed: boolean;
  /** The confirmed PIN, or `null` while none is set. */
  pin: string | null;
  guardianAcceptedAt: string | null;
  selfAcceptedAt: string | null;
  parentPinHash: string | null;
}

/** The `field` of `profile.updated` (§3.8), in the order the screen shows the rows. */
export type EditField = 'name' | 'level' | 'avatar' | 'learner_type';

export interface EditPlan {
  whoChange: 'to-self' | 'to-child' | null;
  /** Which consent the checkbox records; `null` when no box is drawn. */
  consent: 'guardian' | 'self' | null;
  /** A grown-up PIN must be created before Save (a child on a device with no PIN). */
  pinRequired: boolean;
  changed: EditField[];
}

export function initialEditDraft(p: Profile): EditDraft {
  return {
    name: p.displayName,
    level: isLearnerLevelId(p.ageGroup) ? p.ageGroup : null,
    avatar: p.avatar,
    learnerType: effectiveLearnerType(p),
  };
}

export function editPlan(s: EditState): EditPlan {
  const before = effectiveLearnerType(s.original);
  const after = s.draft.learnerType;
  const whoChange = after === before ? null : after === 'self' ? 'to-self' : 'to-child';
  // Becoming "Me" is the learner's own statement, so the "13 or older" box is always asked;
  // becoming a child needs the guardian consent only when none is stored (`requiredConsent`).
  const consent =
    whoChange === 'to-self'
      ? 'self'
      : whoChange === 'to-child'
        ? requiredConsent({ learnerType: 'child', guardianAcceptedAt: s.guardianAcceptedAt, selfAcceptedAt: s.selfAcceptedAt })
        : null;
  const changed: EditField[] = [];
  if (s.draft.name.trim() !== s.original.displayName) changed.push('name');
  if (s.draft.level !== null && s.draft.level !== s.original.ageGroup) changed.push('level');
  if (s.draft.avatar !== s.original.avatar) changed.push('avatar');
  if (whoChange !== null) changed.push('learner_type');
  return { whoChange, consent, pinRequired: whoChange === 'to-child' && s.parentPinHash === null, changed };
}

export type EditMissing = 'name' | 'agree' | 'pin' | 'unchanged';

/** The next thing Save still needs, in the order the caption names them; `null` when it can save. */
export function editMissing(s: EditState): EditMissing | null {
  const plan = editPlan(s);
  // The single name rule (profile-model), so this form never waves through what `updateProfile` throws on.
  if (validateDisplayName(s.draft.name) !== null) return 'name';
  if (plan.consent !== null && !s.agreed) return 'agree';
  if (plan.pinRequired && s.pin === null) return 'pin';
  if (plan.changed.length === 0) return 'unchanged';
  return null;
}

export interface EditDeps {
  hashPin: (pin: string) => Promise<string>;
  acceptGuardianConsent: () => void;
  acceptSelfConsent: () => void;
  setParentPinHash: (hash: string) => void;
  updateProfile: (id: string, patch: ProfilePatch) => void;
  track: (event: OnboardingEvent) => void;
}

export type EditResult = { ok: true } | { ok: false; reason: 'incomplete' | 'pin-failed' };

/**
 * Save: the PIN is hashed first (the one step that can fail, so a failure
 * leaves nothing half-stored), then consent, PIN hash and the profile; the
 * events go out last, one `profile.updated` per changed field (no name, no
 * `learnerType`, owner decision 2026-10-10). Only changed fields are patched.
 */
export async function submitEdit(s: EditState, deps: EditDeps): Promise<EditResult> {
  if (editMissing(s) !== null) return { ok: false, reason: 'incomplete' };
  const plan = editPlan(s);

  let pinHash: string | null = null;
  if (plan.pinRequired && s.pin !== null) {
    try {
      pinHash = await deps.hashPin(s.pin);
    } catch {
      return { ok: false, reason: 'pin-failed' };
    }
  }

  if (plan.consent === 'guardian') deps.acceptGuardianConsent();
  if (plan.consent === 'self' && s.selfAcceptedAt === null) deps.acceptSelfConsent();
  if (pinHash !== null) deps.setParentPinHash(pinHash);

  const patch: ProfilePatch = {};
  if (plan.changed.includes('name')) patch.displayName = s.draft.name.trim();
  if (plan.changed.includes('level') && s.draft.level !== null) patch.ageGroup = s.draft.level;
  if (plan.changed.includes('avatar')) patch.avatar = s.draft.avatar;
  if (plan.changed.includes('learner_type')) patch.learnerType = s.draft.learnerType;
  deps.updateProfile(s.original.id, patch);

  const profileId = s.original.id;
  for (const field of plan.changed) deps.track({ name: 'profile.updated', profileId, payload: { field } });
  if (pinHash !== null) deps.track({ ...pinCreated('gate'), profileId });
  return { ok: true };
}
