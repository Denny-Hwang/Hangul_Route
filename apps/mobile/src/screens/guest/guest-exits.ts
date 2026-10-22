import { guestLeaveState, type GuestLeaveState } from '../../logic/guest/guest-run';
import { guestSaveStack, type GuestSaveStack, type GuestSaveTarget } from '../../logic/guest/guest-save';
import { endGuestRunTo, guestRunLostTarget, type GuestRoute } from '../../store/guest-launch';
import { closeGrownUpSession } from '../../store/grown-up-session';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 6.3 and 6.4 (row GU-3): the only ways into and out of the `Guest` stack.
 * Both reset the root stack, so nothing of a learner's stack sits under a guest run and nothing of the guest run stays
 * under Welcome, the chooser or Home. The guest's screens name no other root route (CS-G1, `guest-stack.test.ts`).
 */

/** `CommonActions.reset`, written out so Welcome loads this module without the navigation package (as `who-chooser`). */
interface ResetAction {
  type: 'RESET';
  payload:
    | GuestLeaveState
    | { index: 0; routes: [{ name: 'Guest'; params: GuestRoute }] }
    // [GU] Row GU-4: Welcome's Add my name opens the stack with the Not now card under the save.
    | { index: 0; routes: [{ name: 'Guest'; state: GuestSaveStack }] };
}

/** What these exits need of a navigation object: its parent (the root stack), or the root itself. */
export interface Dispatcher {
  dispatch: (action: ResetAction) => void;
}

interface Nested {
  getParent: () => Dispatcher | undefined;
}

/**
 * Opens the `Guest` stack alone on the root (Welcome's Back to my quest; Add my name, GU-4's save entry). CS-G3: every
 * way into the stack closes the grown-up session first, also the ones that start no run (Add my name).
 */
export function openGuestStack(root: Dispatcher | undefined, route: GuestRoute): void {
  closeGrownUpSession();
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

/**
 * Section 6.4: another tab saved, removed or replaced the record of the run on here, so the run already ended
 * (`refresh`). The root leaves the `Guest` stack for the same target as Close, so the guest's screens never stay up
 * writing under no learner or the active profile. `root`: the root stack (the `Guest` route's own navigation).
 */
export function leaveLostGuestRun(root: Dispatcher | undefined): void {
  root?.dispatch({ type: 'RESET', payload: guestLeaveState(guestRunLostTarget()) });
}

/** [GU] What the save's openers need of the `Guest` stack's navigation (Results and the Not now card). */
interface SaveOpener {
  navigate: (screen: GuestSaveTarget['screen'], params: GuestSaveTarget['params']) => void;
}

/**
 * [GU] Row GU-4, section 8.2: **Keep my progress** and **Add my name** open the save inside the `Guest` stack: the
 * verify-only PIN (`SaveGuest`) when a PIN is stored, else the form. Nothing on an `owner` device (`target` null).
 */
export function openGuestSave(navigation: SaveOpener, target: GuestSaveTarget | null): void {
  if (target === null) return;
  if (target.screen === 'PinEntry') navigation.navigate('PinEntry', { next: 'SaveGuest' });
  else navigation.navigate('CreateProfile', target.params);
}

/**
 * [GU] Row GU-4, section 6.3: Welcome's **Add my name**: the `Guest` stack alone on the root, opened on the save. CS-G3:
 * the grown-up session is closed first, as for every way into the stack.
 */
export function openGuestSaveStack(root: Dispatcher | undefined, target: GuestSaveTarget): void {
  closeGrownUpSession();
  root?.dispatch({ type: 'RESET', payload: { index: 0, routes: [{ name: 'Guest', state: guestSaveStack(target) }] } });
}

/**
 * [GU] Row GU-4, section 8.4: after the save, Home of the new profile: the root holds `Main` alone, so nothing of the
 * `Guest` stack is left under it. The run has ended (the save ends it, `saveGuestAsProfile`).
 */
export function leaveGuestRunSaved(navigation: Nested): void {
  navigation.getParent()?.dispatch({ type: 'RESET', payload: guestLeaveState('home') });
}

/** [GU] What the `SaveGuest` PIN screen needs to open the form in its place (the `Guest` stack's `replace`). */
interface FormOpener {
  replace: (screen: 'CreateProfile', params: { firstRun: boolean; from: 'guest' }) => void;
}

/**
 * [GU] Row GU-4, section 8.2, CS-G2: a correct `SaveGuest` PIN opens the save form in the PIN screen's place, and
 * nothing else (Back on its first step returns to the save card).
 */
export function openGuestFormAfterPin(navigation: FormOpener, params: { firstRun: boolean; from: 'guest' }): void {
  navigation.replace('CreateProfile', params);
}

/** [GU] What the save form needs to ask the `SaveGuest` PIN in its place (the `Guest` stack's `replace`). */
interface PinOpener {
  replace: (screen: 'PinEntry', params: { next: 'SaveGuest' }) => void;
}

/**
 * [GU] Row GU-4 review, section 8.2, CS-G9: a PIN was set in another tab while the form was open: the form gives way
 * to the verify-only `SaveGuest` PIN (Cancel returns to the save card; a correct PIN opens the form again).
 */
export function reaskGuestSavePin(navigation: PinOpener): void {
  navigation.replace('PinEntry', { next: 'SaveGuest' });
}
