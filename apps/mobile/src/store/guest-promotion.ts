import type { GuestRecord, Profile } from '@hangul-route/content-schema';
import type { PromotionPlan } from '../logic/guest/guest-model';
import { useGuestStore } from './guest-store';
import { useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 5.4 steps 2 and 3 (row GU-2; the save form, row GU-4, runs step 1, the
 * consent, the PIN and the email, first): the profile is written with the guest's id (`profile-store.promoteGuest`),
 * then `hr:guest` is deleted and the run ends. Nothing is copied: every per-profile record is already under the id
 * (G2). With the profile record in place the awards reconcile adds the welcome card, dated from `createdAt` (the run's
 * start), and never announces it as a catch-up. A guest another tab saved first is refused (`null`); its record goes
 * all the same, so this tab shows that profile. A crash between the two writes is repaired at the next boot
 * (`store/guest-sweep.ts`).
 */
export async function saveGuestAsProfile(record: GuestRecord, plan: Pick<PromotionPlan, 'profile'>): Promise<Profile | null> {
  const created = await useProfileStore.getState().promoteGuest(record, plan.profile);
  await useGuestStore.getState().forgetSavedGuest(record.id);
  if (created !== null) useProgressStore.getState().reconcileAwards(created.id);
  return created;
}
