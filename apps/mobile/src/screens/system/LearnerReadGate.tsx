import type { ScreenEdge } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { chooseAnotherOffered, tryReadAgain } from '../../store/read-failed';
import { activateMemory } from '../../logic/memory/boot';
import { ProgressReadFailedScreen } from './ProgressReadFailedScreen';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.4 (row DP-1c): a learner whose progress could not be read is not marked on
 * the chooser and does not hold the boot; when they are chosen, their Home shows ProgressReadFailedScreen in its learner
 * variant instead of an empty Home. Home's own body (and its `ensure`) mounts only once the read worked, so nothing on
 * it builds on an empty record. Try again reruns that learner's `progress.hydrate`; Choose another learner (2 or more
 * learners) opens the chooser, where locks still apply (OA-D9).
 */
/** The active learner whose progress could not be read, or `null`: Home shows `LearnerReadFailedScreen` for them. */
export function useLearnerReadHeld(): string | null {
  const activeId = useProfileStore((s) => s.activeId);
  const held = useProgressStore((s) => activeId !== null && s.loadFailedFor.has(activeId));
  return held ? activeId : null;
}

export interface LearnerReadFailedScreenProps {
  /** The held learner (`useLearnerReadHeld`). */
  profileId: string;
  /** Opens "Who is using this?" (`manual`). */
  onChooseAnother: () => void;
  /** The Screen's safe-area edges of the screen this stands in for (Home: a tab screen). */
  edges?: readonly ScreenEdge[];
}

export function LearnerReadFailedScreen({ profileId, onChooseAnother, edges }: LearnerReadFailedScreenProps): ReactElement {
  // Subscribed, so Choose another learner follows the profile list.
  const offered = useProfileStore((s) => chooseAnotherOffered(s.profiles));
  const onTryAgain = async (): Promise<boolean> => {
    await tryReadAgain({ variant: 'learner', profileId });
    const worked = !useProgressStore.getState().loadFailedFor.has(profileId);
    // The memory seeding and the day's memory.daily skipped this learner while unread (row CM-12): now, once.
    if (worked) activateMemory(profileId);
    return worked;
  };
  return <ProgressReadFailedScreen edges={edges} onTryAgain={onTryAgain} onChooseAnother={offered ? onChooseAnother : undefined} />;
}
