import { useAccountStore } from './account-store';
import { useAudioStore } from './audio-store';
import { useLayoutStore } from './layout-store';
import { useLocaleStore } from './locale-store';
import { useMembershipStore } from './membership-store';
import { useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';
import { useStoryStore } from './story-store';
import { useTierStore } from './tier-store';

/**
 * Cold start (audit UX-01 / L16, F-PROF-001 §3.1): read the profile list,
 * then every profile's saved progress, so no screen shows or writes progress
 * on an empty store. The UI locale settings load right after the profiles
 * (F-I18N-001 §3.2), so the first screen never flashes the wrong language.
 * The saved sound on/off loads alongside (F-AUDIO-004 §3.7), so no prompt
 * plays for a learner who switched the sound off. The device's "Keep
 * sideways" choice (F-LAYOUT-001 §3.4) loads too, so the portrait guard never
 * flashes for a learner who already said no.
 * Story bookmarks load with each profile's progress (F-STORY-004 §3.2), so
 * Home never builds a story card before they are in memory.
 * Each progress hydrate ends with a card reconcile (F-STORY-006 §3.5), so
 * cards a learner already earned arrive once, after the saved copy is in
 * memory. Nothing is written here for a profile with nothing saved: a read
 * that failed looks the same, and a blank record would replace real
 * progress. Its welcome card arrives with Home's `ensure` (§3.3), in memory,
 * and is saved by the learner's first real write.
 * The account (legacy subscription), every profile's cached tier and every
 * profile's spaces load in the same pass (F-ENT-003 section 3.4), so the first
 * render and the first plan derivation already read the access tier the server
 * last gave: a premium learner offline never sees a lesson close or a plan item
 * go, and a member the server has not answered for yet fails open.
 * Then, with a premium legacy subscription, the learners it covers are recorded once
 * (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 10.5); a record that cannot be made
 * yet is tried again at the next start and never holds up the start.
 * App.tsx mounts the navigator, derives plans and runs the start-up sync
 * (F-SYNC-002 §3.2, "after hydration") only once this resolves.
 */
export async function hydrateLearnerData(): Promise<void> {
  await useProfileStore.getState().hydrate();
  const { profiles, activeId } = useProfileStore.getState();
  const progress = useProgressStore.getState();
  const stories = useStoryStore.getState();
  const tiers = useTierStore.getState();
  const memberships = useMembershipStore.getState();
  // Every hydrate finishes before this settles, even when one fails, so `ready`
  // never comes while another read (the account's PIN hash) is still pending.
  const results = await Promise.allSettled([
    useAudioStore.getState().hydrate(),
    useLayoutStore.getState().hydrate(),
    useLocaleStore.getState().hydrate(
      profiles.map((p) => p.id),
      { activeProfileId: activeId },
    ),
    useAccountStore.getState().hydrate(),
    ...profiles.map((p) => progress.hydrate(p.id)),
    ...profiles.map((p) => stories.hydrate(p.id)),
    ...profiles.map((p) => tiers.hydrate(p.id)),
    ...profiles.map((p) => memberships.hydrate(p.id)),
  ]);
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) throw failed.reason;
  await useAccountStore
    .getState()
    .recordSubscriptionCovers(new Date())
    .catch(() => undefined);
}
