import { useAudioStore } from './audio-store';
import { useLayoutStore } from './layout-store';
import { useLocaleStore } from './locale-store';
import { useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';
import { useStoryStore } from './story-store';

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
 * App.tsx mounts the navigator and runs the start-up sync
 * (F-SYNC-002 §3.2, "after hydration") only once this resolves.
 */
export async function hydrateLearnerData(): Promise<void> {
  await useProfileStore.getState().hydrate();
  const { profiles } = useProfileStore.getState();
  const progress = useProgressStore.getState();
  const stories = useStoryStore.getState();
  await Promise.all([
    useAudioStore.getState().hydrate(),
    useLayoutStore.getState().hydrate(),
    useLocaleStore.getState().hydrate(profiles.map((p) => p.id)),
    ...profiles.map((p) => progress.hydrate(p.id)),
    ...profiles.map((p) => stories.hydrate(p.id)),
  ]);
}
