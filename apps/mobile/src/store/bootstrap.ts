import { useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';

/**
 * Cold start (audit UX-01 / L16, F-PROF-001 §3.1): read the profile list,
 * then every profile's saved progress, so no screen shows or writes progress
 * on an empty store. App.tsx mounts the navigator and runs the start-up sync
 * (F-SYNC-002 §3.2, "after hydration") only once this resolves.
 */
export async function hydrateLearnerData(): Promise<void> {
  await useProfileStore.getState().hydrate();
  const { profiles } = useProfileStore.getState();
  const progress = useProgressStore.getState();
  await Promise.all(profiles.map((p) => progress.hydrate(p.id)));
}
