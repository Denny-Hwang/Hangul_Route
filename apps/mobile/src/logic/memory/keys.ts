import { removeKey } from '../../platform/storage';
import { onProfileRemoved } from '../../store/profile-removal';

/** The memory store of one profile (F-CURR-002 sections 4.8 and 4.9, row CM-12): `hr:memory:<profileId>`, swept with the profile's keys. */
export const MEMORY_KEY = (profileId: string): string => `memory:${profileId}`;

// [OA] A removed learner's memory store goes with it (row OA-7a, CS-20), loaded or not; the runtime forgets its copy (`./boot.ts`).
onProfileRemoved((profileId) => {
  removeKey(MEMORY_KEY(profileId)).catch(() => undefined);
});
