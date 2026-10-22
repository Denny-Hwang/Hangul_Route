import { afterRemoval, removalFacts, removedEvent, savedWithCode, type AfterRemoval, type RemoveStep } from '../logic/profiles/removal';
import { track } from '../platform/telemetry';
import { sweepProfileKeys } from './profile-key-sweep';
import './profile-keys';
import { useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';
import { useSyncStore } from './sync-store';

/**
 * [OA] Remove from this device (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D13, section 10.4, row OA-7a; CS-12, CS-20).
 * The rules are pure in `logic/profiles/removal.ts`; the screen (People on this device) asks the fresh PIN and shows
 * the ConfirmSheet steps. Nothing here calls the server for the removal: memberships, seats and saved progress stay
 * there, and the learner comes back on any device with the Rescue Code. Importing `profile-keys` loads every store
 * that keeps a per-profile key, so each one has subscribed to `onProfileRemoved` before a removal.
 */

/** Section 10.4: the sync check gives up after this long and the learner reads as unsaved (the safe side). */
export const SYNC_CHECK_TIMEOUT_MS = 10_000;

/** What the sheet needs to know: saved (with a Rescue Code to show), and that code. */
export interface RemovalCheck {
  saved: boolean;
  /** The learner's Rescue Code, shown on the saved step before Remove (null unless saved). */
  rescueCode: string | null;
}

const UNSAVED: RemovalCheck = { saved: false, rescueCode: null };

/**
 * Whether the learner is saved now (registered, nothing pending, no push running or queued, and a Rescue Code on
 * this device), from the stored records. Never throws.
 */
export async function removalCheck(profileId: string): Promise<RemovalCheck> {
  try {
    if (useSyncStore.getState().syncBusy(profileId)) return UNSAVED;
    const sync = await useSyncStore.getState().hydrate(profileId);
    await useProgressStore.getState().hydrate(profileId);
    const snapshot = useProgressStore.getState().byProfile[profileId];
    if (useSyncStore.getState().syncBusy(profileId)) return UNSAVED;
    return savedWithCode(sync, snapshot?.updatedAt ?? null) ? { saved: true, rescueCode: sync.rescueCode } : UNSAVED;
  } catch {
    return UNSAVED;
  }
}

/** Whether the learner is saved now (`removalCheck`). Never throws. */
export async function savedNow(profileId: string): Promise<boolean> {
  return (await removalCheck(profileId)).saved;
}

/** Resolves with the attempt's answer, or `false` once `ms` has passed (the attempt goes on in the background). */
function withinTime(attempt: Promise<boolean>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    void attempt.then((done) => {
      clearTimeout(timer);
      resolve(done);
    });
  });
}

/**
 * Section 10.4: the sync attempt of a learner not saved yet (`flushLearner`: a queued run included), a Rescue Code
 * asked for when the learner is registered without one, then the check again. A failure, no network, a build with
 * sync off or no answer within `SYNC_CHECK_TIMEOUT_MS` leaves the learner unsaved. Never throws.
 */
export async function syncThenCheck(profileId: string, timeoutMs: number = SYNC_CHECK_TIMEOUT_MS): Promise<RemovalCheck> {
  const attempt = (async (): Promise<boolean> => {
    await useSyncStore.getState().flushLearner(profileId);
    const record = await useSyncStore.getState().hydrate(profileId);
    if (record.secret && !record.rescueCode) await useSyncStore.getState().issueRescueCode(profileId);
    return true;
  })().catch(() => false);
  if (!(await withinTime(attempt, timeoutMs))) return UNSAVED;
  return removalCheck(profileId);
}

/**
 * Removes the learner from this device for the sheet's step: `saved` (Remove) or `anyway` (the second step of an
 * unsaved learner). Any other step removes nothing (null). `profile-store.remove` drops the profile, records the
 * tombstone, takes the id out of the locks and tells every per-profile store (`notifyProfileRemoved`), which delete
 * their keys; a sweep then deletes any key of the id still stored (a delete that failed, a key written back meanwhile)
 * and looks again. `profile.removed { saved, wasActive, anyway }` is sent. Answers where the app goes next.
 */
export async function removeFromDevice(profileId: string, step: RemoveStep): Promise<AfterRemoval | null> {
  const facts = removalFacts(step);
  if (facts === null) return null;
  const { activeId, profiles } = useProfileStore.getState();
  if (!profiles.some((p) => p.id === profileId)) return null;
  const wasActive = activeId === profileId;
  useProfileStore.getState().remove(profileId);
  const learnersLeft = useProfileStore.getState().profiles.filter((p) => p.role === 'learner').length;
  await sweepProfileKeys([profileId]);
  void track(removedEvent({ ...facts, wasActive }));
  return afterRemoval({ wasActive, learnersLeft });
}
