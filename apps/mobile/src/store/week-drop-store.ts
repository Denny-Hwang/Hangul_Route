import { removeKey } from '../platform/storage';
import { onProfileRemoved } from './profile-removal';

/**
 * The key of the "This week in Korea" done marks on this device (F-CURR-002 §5.7, row CM-48;
 * design/wireframes/home/this-week-in-korea.md A2): `week-drop:<profileId>` in `platform/storage.ts`, the Mondays of the
 * weeks whose drop the learner finished here. Never synced, never sent; a second device shows the drop as not done,
 * which is only a second look. Removing the profile from the device removes it (row OA-7a). The reads and writes are
 * the drop chunk's (`logic/week-drop/done-weeks.ts`); only the key and the removal are here.
 */
export const WEEK_DROP_KEY = (profileId: string): string => `week-drop:${profileId}`;

onProfileRemoved((profileId) => {
  void removeKey(WEEK_DROP_KEY(profileId)).catch(() => undefined);
});
