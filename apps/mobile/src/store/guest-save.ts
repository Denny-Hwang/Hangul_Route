import type { AvatarKind, LearnerType, Profile } from '@hangul-route/content-schema';
import { questById } from '../content';
import { isLiveGuest, promotionPlan } from '../logic/guest/guest-model';
import { guestSaveTarget, type GuestSaveTarget } from '../logic/guest/guest-save';
import type { GuestSaveVia } from '../logic/onboarding/submit-profile';
import { guestFirstQuest } from './guest-launch';
import { saveGuestAsProfile } from './guest-promotion';
import { useAccountStore } from './account-store';
import { useGuestStore } from './guest-store';
import { useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 5.4, 8.3 to 8.5 and 12 (row GU-4): the save of the first quest at run
 * time. The save form (`CreateProfileScreen` with `from: 'guest'`, or a first run with a live guest, GU-D11) runs
 * F-LEARN-001 section 3.3's order (consent, PIN, email) and then `promoteLiveGuest`, which writes the profile with
 * the guest's id (`profile-store.promoteGuest` through `saveGuestAsProfile`) and deletes `hr:guest`. Memory only: the
 * entry the save began at (`guest.saved.via`) and the one Hoya bubble of the first Home (section 8.4).
 */

/** Where the save that is open began (Results, Welcome's card or the Not now card). */
let entry: Exclude<GuestSaveVia, 'setup'> = 'results';

/** Keep my progress, or an Add my name, was pressed: the save that opens began there. */
export function noteGuestSaveEntry(via: Exclude<GuestSaveVia, 'setup'>): void {
  entry = via;
}

export function guestSaveEntry(): Exclude<GuestSaveVia, 'setup'> {
  return entry;
}

/**
 * Section 6.3: Welcome's **Add my name** (a device with no profile, quest 1 done): the save begins at Welcome, the
 * guest's progress is read so the form and the first Home know whether the card is kept, and the answer is where the
 * `Guest` stack opens (the form, or the `SaveGuest` PIN), or null when there is no live guest to save.
 */
export function beginGuestSaveFromWelcome(): GuestSaveTarget | null {
  const { record } = useGuestStore.getState();
  const profiles = useProfileStore.getState().profiles;
  if (!isLiveGuest(record, profiles) || guestFirstQuest() === null) return null;
  noteGuestSaveEntry('welcome');
  useProgressStore.getState().hydrate(record.id).catch(() => undefined);
  return guestSaveTarget({ profiles, parentPinHash: useAccountStore.getState().parentPinHash });
}

/** Whether the learner with this id holds quest 1's card (the save card's and the first Home's wording). */
export function holdsFirstQuestCard(learnerId: string | null): boolean {
  const first = guestFirstQuest();
  const cardId = first === null ? undefined : questById(first.questId)?.rewardCardId;
  if (learnerId === null || cardId === undefined) return false;
  return useProgressStore.getState().byProfile[learnerId]?.cards.some((c) => c.cardId === cardId) ?? false;
}

/**
 * Section 5.4 steps 2 and 3: the live guest becomes the profile, with its id and the run's start as `createdAt`; then
 * `hr:guest` goes and the run ends. Resolves to the profile (also when another tab saved it first: this tab then shows
 * that one), or null when there is no live guest or `hr:profiles` could not be written (the guest stays, so Continue
 * can be tried again). The reducer's name rules are unchanged (an invalid name throws, as `createProfile` does).
 */
export async function promoteLiveGuest(
  input: { displayName: string; ageGroup: Profile['ageGroup']; avatar: AvatarKind; learnerType: LearnerType },
  options?: { keepActive?: boolean },
): Promise<Profile | null> {
  const { record } = useGuestStore.getState();
  if (!isLiveGuest(record, useProfileStore.getState().profiles)) return null;
  const plan = promotionPlan(record, input, Date.now());
  // [GU] Row GU-5: `keepActive`, Keep as a learner from People on this device (section 9.2).
  const outcome = await saveGuestAsProfile(record, plan, options);
  if (outcome.kind === 'saved') return outcome.profile;
  if (outcome.kind === 'duplicate') return useProfileStore.getState().profiles.find((p) => p.id === record.id) ?? null;
  return null;
}

/** Section 8.4: the first Home of the saved learner draws one Hoya bubble, once. */
let savedNote: { profileId: string; card: boolean } | null = null;

export function noteGuestSaved(profileId: string, card: boolean): void {
  savedNote = { profileId, card };
}

/** The bubble for this learner's Home, or none (another learner, or already shown). */
export function guestSavedNoteFor(profileId: string | undefined): { card: boolean } | null {
  if (savedNote === null || profileId === undefined || savedNote.profileId !== profileId) return null;
  return { card: savedNote.card };
}

/** The bubble was shown: a later Home draws none. */
export function clearGuestSavedNote(): void {
  savedNote = null;
}
