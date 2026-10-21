import { afterRemoval, isSaved, removalFacts, removedEvent, type AfterRemoval, type RemoveStep } from '../logic/profiles/removal';
import { track } from '../platform/telemetry';
import './profile-keys';
import { useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';
import { useSyncStore } from './sync-store';

/**
 * [OA] Remove from this device (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D13, section 10.4, row OA-7a; CS-12, CS-20).
 * The rules are pure in `logic/profiles/removal.ts`; the screen (People on this device) asks the fresh PIN and shows
 * the ConfirmSheet steps. Nothing here calls the server: memberships, seats and saved progress stay there, and the
 * learner comes back on any device with the Rescue Code. Importing `profile-keys` loads every store that keeps a
 * per-profile key, so each one has subscribed to `onProfileRemoved` before a removal.
 */

/** Whether the learner is saved now (registered and nothing pending), from the stored records. Never throws. */
export async function savedNow(profileId: string): Promise<boolean> {
  try {
    const sync = await useSyncStore.getState().hydrate(profileId);
    await useProgressStore.getState().hydrate(profileId);
    const snapshot = useProgressStore.getState().byProfile[profileId];
    return isSaved(sync, snapshot?.updatedAt ?? null);
  } catch {
    return false;
  }
}

/**
 * Section 10.4: the sync attempt of an unsaved learner (`syncNow`), then the check again. A failure, no network or
 * a build with sync off leaves the learner unsaved. Never throws.
 */
export async function syncThenCheck(profileId: string): Promise<boolean> {
  try {
    await useSyncStore.getState().syncNow(profileId);
  } catch {
    return false;
  }
  return savedNow(profileId);
}

/**
 * Removes the learner from this device for the sheet's step: `saved` (Remove) or `anyway` (the second step of an
 * unsaved learner). Any other step removes nothing (null). `profile-store.remove` drops the profile, records the
 * tombstone, takes the id out of the locks and tells every per-profile store (`notifyProfileRemoved`), which delete
 * their keys; then `profile.removed { saved, wasActive, anyway }` is sent. Answers where the app goes next.
 */
export function removeFromDevice(profileId: string, step: RemoveStep): AfterRemoval | null {
  const facts = removalFacts(step);
  if (facts === null) return null;
  const { activeId, profiles } = useProfileStore.getState();
  if (!profiles.some((p) => p.id === profileId)) return null;
  const wasActive = activeId === profileId;
  useProfileStore.getState().remove(profileId);
  void track(removedEvent({ ...facts, wasActive }));
  const learnersLeft = useProfileStore.getState().profiles.filter((p) => p.role === 'learner').length;
  return afterRemoval({ wasActive, learnersLeft });
}
