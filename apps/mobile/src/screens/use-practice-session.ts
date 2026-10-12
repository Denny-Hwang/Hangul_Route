import { useEffect } from 'react';
import { holdLearnerSession } from '../store/learner-session';

/**
 * Records practice time while a learner screen is mounted (F-REPORT-001
 * section 3.3.2, RP-3b): the story reader, the stand-alone game screen and
 * the level check. The session is time only (`streak: false`, OD-19): it
 * counts toward a report's minutes and practice days and never moves the
 * learner's streak or sends `session.start`. Opened inside a quest, it joins
 * the quest's session. No profile, or an `owner` of `null` (a host other than
 * the learner stack, such as the All lessons preview), records nothing.
 */
export function usePracticeSession(profileId: string | null | undefined, owner: string | null): void {
  useEffect(() => {
    if (!profileId || owner === null) return undefined;
    return holdLearnerSession(profileId, { owner, streak: false });
  }, [profileId, owner]);
}
