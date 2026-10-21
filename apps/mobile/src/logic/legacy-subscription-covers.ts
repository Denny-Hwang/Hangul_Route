import { FAMILY_LIFETIME_LEARNERS, type Profile } from '@hangul-route/content-schema';

/**
 * The legacy device subscription is capped like a family (AMENDMENTS-ONE-ACCOUNT-MANY-USERS
 * OA-D15, section 10.5; AMENDMENTS-SEATS-ADMINS SA-D1 and SA-D7). Pure rules; the account store
 * records `account:subscriptionCovers` once and the tier store asks `legacyCovers`.
 */

/** `account:subscriptionCovers`: the learner profiles on the device when the record was made (grandfathered). */
export interface SubscriptionCovers {
  v: 1;
  ids: string[];
  /** ISO time the record was made. */
  at: string;
}

/** A stored value read back: the record when it has the v1 shape, else null (no record: every profile is covered). */
export function subscriptionCoversOf(value: unknown): SubscriptionCovers | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Partial<SubscriptionCovers>;
  if (record.v !== 1 || typeof record.at !== 'string' || !Array.isArray(record.ids)) return null;
  if (!record.ids.every((id) => typeof id === 'string')) return null;
  return { v: 1, ids: [...record.ids], at: record.at };
}

/** A learner profile: one that takes a family place (section 10.2). A stored profile without a role is a learner. */
export function isLearnerProfile(profile: Pick<Profile, 'role'>): boolean {
  return (profile.role ?? 'learner') === 'learner';
}

/** The record for the learner profiles on the device now, in their device order. */
export function subscriptionCoversFor(profiles: readonly Pick<Profile, 'id' | 'role'>[], now: Date): SubscriptionCovers {
  const ids = [...new Set(profiles.filter(isLearnerProfile).map((p) => p.id))];
  return { v: 1, ids, at: now.toISOString() };
}

/**
 * Whether the legacy subscription covers `learnerId` (section 10.5). Before the record exists it
 * covers every profile, as before. Then: every learner in `ids`; a newer learner while `ids.length`
 * plus the newer learners covered before it is below `FAMILY_LIFETIME_LEARNERS`, in creation order
 * (the order profiles were added on this device, which is the order of the profile list: new and
 * restored profiles are appended, so a learner covered once stays covered). A grown-up's profile
 * takes no family place (OQ-11) and stays covered. An id that is no profile on the device is not.
 */
export function legacyCovers(record: SubscriptionCovers | null, profiles: readonly Pick<Profile, 'id' | 'role'>[], learnerId: string): boolean {
  if (record === null) return true;
  if (record.ids.includes(learnerId)) return true;
  const profile = profiles.find((p) => p.id === learnerId);
  if (!profile) return false;
  if (!isLearnerProfile(profile)) return true;
  const room = FAMILY_LIFETIME_LEARNERS - record.ids.length;
  if (room <= 0) return false;
  const newer = profiles.filter((p) => isLearnerProfile(p) && !record.ids.includes(p.id));
  const position = newer.findIndex((p) => p.id === learnerId);
  return position >= 0 && position < room;
}
