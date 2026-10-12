import { NavigationContext } from '@react-navigation/native';
import { useContext, useEffect } from 'react';
import { holdWhileFocused, type FocusPorts } from '../logic/sessions/hold';
import { holdLearnerSession } from '../store/learner-session';

/**
 * Records practice time while a learner screen is in front (F-REPORT-001
 * section 3.3.2, RP-3b): the story reader, the stand-alone game screen and
 * the level check. The session is time only (`streak: false`, OD-19): it
 * counts toward a report's minutes and practice days and never moves the
 * learner's streak or sends `session.start`. Opened inside a quest, it joins
 * the quest's session. It ends when another screen is pushed over it (the PIN
 * or the placement report over the level check) and begins again on return,
 * so a grown-up's time never counts as practice. No profile, or an `owner`
 * of `null` (a host other than the learner stack, such as the All lessons
 * preview), records nothing.
 */
export function usePracticeSession(profileId: string | null | undefined, owner: string | null): void {
  const navigation = useContext(NavigationContext);
  useEffect(() => {
    if (!profileId || owner === null) return undefined;
    const focus: FocusPorts | null = navigation
      ? { isFocused: () => navigation.isFocused(), addListener: (event, listener) => navigation.addListener(event, listener) }
      : null;
    return holdWhileFocused(focus, () => holdLearnerSession(profileId, { owner, streak: false }));
  }, [profileId, owner, navigation]);
}
