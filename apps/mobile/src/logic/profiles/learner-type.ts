import type { LearnerType, ProfileRole } from '@hangul-route/content-schema';

/**
 * Who is learning, and what that means for consent, tone and the grown-up
 * gate — F-LEARN-001 §3.3, L2, L3, L7. Pure: no storage, no React.
 *
 * `learnerType` lives only on the device. Absent (every profile created before
 * this spec, and learners restored from a Rescue Code) reads as `'child'`, the
 * conservative branch; it is never inferred from the learner's level.
 */

/** Labels and tone: a family device speaks to adults and children, a self-only device to the learner. */
export type DeviceAudience = 'family' | 'self';

interface ProfileLike {
  role: ProfileRole;
  learnerType?: LearnerType;
}

export const effectiveLearnerType = (p: { learnerType?: LearnerType }): LearnerType => p.learnerType ?? 'child';

/**
 * `'family'` when any learner profile is effectively a child; `'self'` when
 * every learner manages their own profile. Parent / teacher / admin profiles
 * are not learners and do not count. No learner profiles reads as `'family'`.
 */
export function deviceAudience(profiles: readonly ProfileLike[]): DeviceAudience {
  const learners = profiles.filter((p) => p.role === 'learner');
  if (learners.length === 0) return 'family';
  return learners.some((p) => effectiveLearnerType(p) === 'child') ? 'family' : 'self';
}

/**
 * Which consent card a new profile needs: `'guardian'` for a child unless a
 * guardian already agreed; `'self'` for a self learner only when no consent of
 * either kind exists on the device; `null` when nothing more is needed.
 */
export function requiredConsent(i: {
  learnerType: LearnerType;
  guardianAcceptedAt: string | null;
  selfAcceptedAt: string | null;
}): 'guardian' | 'self' | null {
  if (i.learnerType === 'child') return i.guardianAcceptedAt === null ? 'guardian' : null;
  return i.guardianAcceptedAt === null && i.selfAcceptedAt === null ? 'self' : null;
}

/**
 * Whether grown-up actions open behind the PIN gate. A device with a PIN
 * always gates; a device without one gates only while a child can reach it
 * (L7). A self-only device without a PIN opens grown-up actions directly.
 */
export function gateRequired(i: {
  profiles: readonly ProfileLike[];
  parentPinHash: string | null;
}): boolean {
  return i.parentPinHash !== null || deviceAudience(i.profiles) === 'family';
}

/** A child profile must come with a PIN when the device has none; a self learner's PIN is optional. */
export function pinRequiredForNewProfile(i: {
  learnerType: LearnerType;
  parentPinHash: string | null;
}): boolean {
  return i.learnerType === 'child' && i.parentPinHash === null;
}
