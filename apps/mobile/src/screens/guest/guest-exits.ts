import { guestLeaveState, type GuestLeaveState } from '../../logic/guest/guest-run';
import { endGuestRunTo, type GuestRoute } from '../../store/guest-launch';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 6.3 and 6.4 (row GU-3): the only ways into and out of the `Guest` stack.
 * Both reset the root stack, so nothing of a learner's stack sits under a guest run and nothing of the guest run stays
 * under Welcome, the chooser or Home. The guest's screens name no other root route (CS-G1, `guest-stack.test.ts`).
 */

/** `CommonActions.reset`, written out so Welcome loads this module without the navigation package (as `who-chooser`). */
interface ResetAction {
  type: 'RESET';
  payload: GuestLeaveState | { index: 0; routes: [{ name: 'Guest'; params: GuestRoute }] };
}

/** What these exits need of a navigation object: its parent (the root stack), or the root itself. */
interface Dispatcher {
  dispatch: (action: ResetAction) => void;
}

interface Nested {
  getParent: () => Dispatcher | undefined;
}

/** Opens the `Guest` stack alone on the root (Welcome's Back to my quest; GU-4's save entry). */
export function openGuestStack(root: Dispatcher | undefined, route: GuestRoute): void {
  root?.dispatch({ type: 'RESET', payload: { index: 0, routes: [{ name: 'Guest', params: route }] } });
}

/**
 * Section 6.4: the run ends (`guest.left { at }` when `at` is given; the record stays), then the root holds Welcome
 * (no learner profile), the chooser (profiles, the chooser on) or Home.
 */
export function leaveGuestRun(navigation: Nested, at: 'quest' | null): void {
  const target = endGuestRunTo(at);
  navigation.getParent()?.dispatch({ type: 'RESET', payload: guestLeaveState(target) });
}
