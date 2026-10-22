import { useEffect } from 'react';
import { useGuestStore } from '../../store/guest-store';
import { leaveLostGuestRun, type Dispatcher } from './guest-exits';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 6.4 (row GU-3 review): while the `Guest` stack is mounted, a run this tab
 * had on that another tab ended (its record saved, removed, swept or replaced: `useGuestStore.runsLost`) resets the
 * root at once to Welcome, the chooser or Home, in the same store update, before the guest's screens render again with
 * no run under them. A stack opened with no run on (Add my name) is never reset here: only a lost run counts.
 * `root`: the navigation of the root stack's `Guest` route.
 */
export function useLeaveWhenGuestRunLost(root: Dispatcher | undefined): void {
  useEffect(
    () =>
      useGuestStore.subscribe((now, before) => {
        if (now.runsLost !== before.runsLost) leaveLostGuestRun(root);
      }),
    [root],
  );
}
