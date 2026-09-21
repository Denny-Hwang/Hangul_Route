import type { Learner } from '../store';

/** What a device or console may see about a learner — never the recovery hash. */
export function publicLearner({ id, displayName, ageGroup, avatar, createdAt, lastActiveAt }: Learner): Omit<Learner, 'recoveryHash'> {
  return { id, displayName, ageGroup, avatar, createdAt, lastActiveAt };
}
