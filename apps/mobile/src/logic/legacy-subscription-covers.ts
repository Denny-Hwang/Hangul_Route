import { FAMILY_LIFETIME_LEARNERS, type Profile } from '@hangul-route/content-schema';

/**
 * The legacy device subscription is capped like a family (AMENDMENTS-ONE-ACCOUNT-MANY-USERS
 * OA-D15, section 10.5; AMENDMENTS-SEATS-ADMINS SA-D1 and SA-D7). Pure rules; the account store
 * records `account:subscriptionCovers` once, remembers each newer learner it covers, and the tier
 * store asks `legacyCovers`.
 */

/** `account:subscriptionCovers`. Coverage only grows: an id in `ids` or `added` is never taken out. */
export interface SubscriptionCovers {
  v: 1;
  /** The learner profiles on the device when the record was made (grandfathered). */
  ids: string[];
  /** Newer learners the subscription has covered since, in the order they were covered. Optional in storage (read as []). */
  added: string[];
  /** ISO time the record was made. */
  at: string;
}

const isIdList = (value: unknown): value is string[] => Array.isArray(value) && value.every((id) => typeof id === 'string');

/** A stored value read back: the record when it has the v1 shape, else null (no record: every profile is covered). */
export function subscriptionCoversOf(value: unknown): SubscriptionCovers | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Partial<SubscriptionCovers>;
  if (record.v !== 1 || typeof record.at !== 'string' || !isIdList(record.ids)) return null;
  if (record.added !== undefined && !isIdList(record.added)) return null;
  return { v: 1, ids: [...record.ids], added: [...(record.added ?? [])], at: record.at };
}

/** A learner profile: one that takes a family place (section 10.2). A stored profile without a role is a learner. */
export function isLearnerProfile(profile: Pick<Profile, 'role'>): boolean {
  return (profile.role ?? 'learner') === 'learner';
}

/** The record for the learner profiles on the device now, in their device order. */
export function subscriptionCoversFor(profiles: readonly Pick<Profile, 'id' | 'role'>[], now: Date): SubscriptionCovers {
  const ids = [...new Set(profiles.filter(isLearnerProfile).map((p) => p.id))];
  return { v: 1, ids, added: [], at: now.toISOString() };
}

/** Every id the record covers for good: the grandfathered learners and the newer ones it has covered. */
function coveredIds(record: SubscriptionCovers): Set<string> {
  return new Set([...record.ids, ...record.added]);
}

/**
 * The newer learners the record covers but has not remembered yet: the learners on the device that
 * are in neither `ids` nor `added`, in device order, while the covered count is below
 * `FAMILY_LIFETIME_LEARNERS`. A removed learner keeps its place in the count (its id stays in the
 * record), so a place is never handed on and a restored learner is covered again.
 */
function uncountedCovered(record: SubscriptionCovers, profiles: readonly Pick<Profile, 'id' | 'role'>[]): string[] {
  const covered = coveredIds(record);
  const room = FAMILY_LIFETIME_LEARNERS - covered.size;
  if (room <= 0) return [];
  const newer = [...new Set(profiles.filter((p) => isLearnerProfile(p) && !covered.has(p.id)).map((p) => p.id))];
  return newer.slice(0, room);
}

/**
 * Whether the legacy subscription covers `learnerId` (section 10.5). Before the record exists it
 * covers every profile, as before. Then: every learner in `ids` or `added`, and a newer learner
 * while the covered count plus the newer learners before it is below `FAMILY_LIFETIME_LEARNERS`,
 * in device order (the account store then adds it to `added`, so it stays covered). A non-learner
 * profile (parent, teacher or admin) takes no family place and stays covered, while a grown-up's own
 * "Me" learner profile counts like any learner (section 10.2). An id that is no profile here is not.
 */
export function legacyCovers(record: SubscriptionCovers | null, profiles: readonly Pick<Profile, 'id' | 'role'>[], learnerId: string): boolean {
  if (record === null) return true;
  if (coveredIds(record).has(learnerId)) return true;
  const profile = profiles.find((p) => p.id === learnerId);
  if (!profile) return false;
  if (!isLearnerProfile(profile)) return true;
  return uncountedCovered(record, profiles).includes(learnerId);
}

/** The record with every newer learner it now covers added to `added`; the same object when there is none. */
export function withNewerCovered(record: SubscriptionCovers, profiles: readonly Pick<Profile, 'id' | 'role'>[]): SubscriptionCovers {
  const newer = uncountedCovered(record, profiles);
  return newer.length === 0 ? record : { ...record, added: [...record.added, ...newer] };
}

/**
 * Two records for the same device (this start's and the stored one, which another web tab may have
 * changed): the stored one with every id the other covers added, so nobody covered in either loses
 * it. The stored object when it already covers them all.
 */
export function mergeCovers(stored: SubscriptionCovers, mine: SubscriptionCovers): SubscriptionCovers {
  const covered = coveredIds(stored);
  const extra = [...new Set([...mine.ids, ...mine.added])].filter((id) => !covered.has(id));
  return extra.length === 0 ? stored : { ...stored, added: [...stored.added, ...extra] };
}
