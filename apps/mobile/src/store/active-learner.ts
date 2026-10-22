import { useGuestStore } from './guest-store';
import { useProfileStore } from './profile-store';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 5.3 (row GU-2): who the learner is now. The guest's id while this tab is
 * in a guest run, else the active profile's id. The quest player, its games, Results, the card page and every
 * per-profile store they call take the learner id from here (row GU-3 moves those screens to it), so a guest's answers
 * are written under the id the saved profile keeps (GU-D2). A run with no record reads as no learner, never as the
 * active profile: a guest run never writes into a profile's data.
 */
export function activeLearnerIdSelector(
  guest: { record: { id: string } | null; running: boolean },
  profiles: { activeId: string | null },
): string | null {
  if (guest.running) return guest.record?.id ?? null;
  return profiles.activeId;
}

/** The learner id now, read fresh from the stores (an action, an effect). */
export function activeLearnerIdNow(): string | null {
  return activeLearnerIdSelector(useGuestStore.getState(), useProfileStore.getState());
}

/** The learner id for a screen, kept current with both stores. */
export function useActiveLearnerId(): string | null {
  const guestId = useGuestStore((s) => (s.running ? (s.record?.id ?? null) : undefined));
  const activeId = useProfileStore((s) => s.activeId);
  return guestId === undefined ? activeId : guestId;
}
