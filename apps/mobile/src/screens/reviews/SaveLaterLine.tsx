import { Body } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { useMessages } from '../../i18n/use-messages';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

/**
 * The quiet line under the stars of a check's result while the learner's progress write is still waiting
 * (AMENDMENTS-QUEST-LEAVE-RESUME OD-LR8, row LR-4; AMENDMENTS-DURABLE-PROGRESS section 3.7). A finish can resolve while
 * the progress write behind it fails: the Daily Review, the Stage Check, the Hangul Check and the Cell Check show the
 * words Results shows (`learner.results.saveLater`), with the same selector (`saveRetryFailedFor`, which holds a save
 * only once its first retry has not landed either, or `loadFailedFor`) and the same quiet look: secondary text, no
 * icon, no box, not a live region. Nothing is drawn otherwise.
 */
export function SaveLaterLine({ testID }: { testID: string }): ReactElement | null {
  const m = useMessages().learner.results;
  const profileId = useProfileStore((s) => activeProfileSelector(s)?.id ?? null);
  const waiting = useProgressStore((s) => (profileId === null ? false : s.saveRetryFailedFor.has(profileId) || s.loadFailedFor.has(profileId)));
  if (!waiting) return null;
  return (
    <Body tone="secondary" align="center" testID={testID}>
      {m.saveLater}
    </Body>
  );
}
