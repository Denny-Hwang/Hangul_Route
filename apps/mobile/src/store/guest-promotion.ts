import type { GuestRecord } from '@hangul-route/content-schema';
import type { PromotionPlan } from '../logic/guest/guest-model';
import { useGuestStore } from './guest-store';
import { useProfileStore, type GuestPromotion } from './profile-store';
import { useProgressStore } from './progress-store';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 5.4 steps 2 and 3 (row GU-2; the save form, row GU-4, runs step 1, the
 * consent, the PIN and the email, first): the profile is written with the guest's id (`profile-store.promoteGuest`,
 * which resolves only once `hr:profiles` is written and read back), then `hr:guest` is deleted and the run ends.
 * Nothing is copied: every per-profile record is already under the id (G2). With the profile record in place the
 * awards reconcile adds the welcome card, dated from `createdAt` (the run's start), and never announces it as a
 * catch-up.
 * - `saved` and `confirmed`: `hr:guest` goes, the run ends, the welcome card arrives.
 * - `saved` but not confirmed (the read back failed): the run ends and `hr:guest` stays, so the next boot's hydrate
 *   repair deletes it once the profile is seen on disk, or keeps the guest when it is not. No welcome card yet.
 * - `duplicate` (another tab saved this guest first): its record goes all the same, so this tab shows that profile.
 * - `failed` (the list could not be read or written): nothing changed; the run and `hr:guest` stay, so the save can be
 *   tried again.
 */
export async function saveGuestAsProfile(record: GuestRecord, plan: Pick<PromotionPlan, 'profile'>): Promise<GuestPromotion> {
  const outcome = await useProfileStore.getState().promoteGuest(record, plan.profile);
  if (outcome.kind === 'failed') return outcome;
  if (outcome.kind === 'saved' && !outcome.confirmed) {
    useGuestStore.getState().endGuestRun();
    return outcome;
  }
  await useGuestStore.getState().forgetSavedGuest(record.id);
  if (outcome.kind === 'saved') useProgressStore.getState().reconcileAwards(outcome.profile.id);
  return outcome;
}
