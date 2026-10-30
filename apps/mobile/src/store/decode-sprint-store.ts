import { removeKey } from '../platform/storage';
import { onProfileRemoved } from './profile-removal';

/**
 * The key of the Block Sprint's private record on this device (F-CURR-002 section 7.1 F9, OD-8, row CM-32):
 * `decode-sprint:<profileId>` in `platform/storage.ts`, the sprints a learner finished and their best count. Never synced,
 * never sent. Removing the profile from the device removes it (row OA-7a). The reads and writes are the sprint's
 * (`screens/decode-sprint/sprint-record.ts`, in the Syllable Build chunk); only the key and the removal are here.
 */
export const DECODE_SPRINT_KEY = (profileId: string): string => `decode-sprint:${profileId}`;

onProfileRemoved((profileId) => {
  void removeKey(DECODE_SPRINT_KEY(profileId)).catch(() => undefined);
});
