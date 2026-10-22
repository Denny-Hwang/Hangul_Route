/**
 * [GU] How long the learner app keeps a first quest that was never saved (AMENDMENTS-GUEST-FIRST-LESSON GU-D13), in
 * days, as the Privacy Policy's first-quest bullet states it (section 13.3): 30 days without play, 7 on a device that
 * already has learner profiles. The same values as `GUEST_TTL_DAYS` and `GUEST_TTL_SHARED_DAYS` of
 * `packages/content-schema/src/schemas/guest.ts` (row GU-1); `guest-ttl.test.ts` holds the two equal once that module
 * is exported, so the policy and the app's sweep cannot drift.
 */
export const GUEST_TTL_DAYS = 30;
export const GUEST_TTL_SHARED_DAYS = 7;
