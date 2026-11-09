import { create } from 'zustand';

/**
 * F-AUTH-004 sections 6.5, 7.2, 7.3 and 13.1 (row NS-3; ND-5, ND-9): what the native grown-up account keeps in memory
 * between its screens, never stored.
 *
 * - `lastAccountSignInAt`: when a native sign-in completed; counts as a fresh proof for `GROWN_UP_FRESH_PIN_MS`, as a
 *   typed PIN does (ND-5). Forgotten when the grown-up session closes (section 13.1).
 * - `signedInThisVisit`: a sign-in completed during this visit of the Grown-up area. On a device that is not `pin`
 *   only this opens the account (ND-9: no session outlives a visit there). Forgotten at the session close and at the
 *   next mount of the area.
 * - `retrustPending`: this run's sign-in used only an email code after a PIN change, so it wrote no trust and the lock
 *   stays (`retrust_password`, section 7.3). Kept for the run; forgotten at sign-out or at a sign-in that re-trusts.
 * - `signedOutThisRun`: Sign out ran in this run and no sign-in followed. Offline, Clerk's own sign-out cannot reach
 *   Clerk and its in-memory session may stay (R-2); the account then reads as signed out all the same.
 *
 * - `visit`: counts the visits (row NS-4). A sign-in flow notes the visit it started in; one that completes after its
 *   visit ended (the session closed while Clerk answered) never counts for a later visit: no fresh proof and no
 *   visit's sign-in, only the run's re-trust flag (the NS-3 hand-off, section 7.2).
 *
 * Section 6.5 names `ui-store.lastAccountSignInAt`; it lives here instead so the web start bundle, which loads
 * `ui-store`, carries none of it: only native code (the Grown-up area stack and the account screens) imports this.
 */

interface AccountVisitState {
  visit: number;
  lastAccountSignInAt: number | null;
  signedInThisVisit: boolean;
  retrustPending: boolean;
  signedOutThisRun: boolean;
}

interface AccountVisitActions {
  /**
   * A native sign-in completed now (section 6.5 step 3), and whether the lock stays for a re-trust (7.3). `visit` is
   * the visit the flow started in: when it has ended since, only the re-trust flag is kept.
   */
  markSignedIn: (at: number, retrustPending: boolean, visit?: number) => void;
  /** The visit ended (the session closed, or the area mounts again): the sign-in time and the visit's sign-in go. */
  endVisit: () => void;
  /** Sign out: everything goes, and the account reads as signed out until the next sign-in. */
  forget: () => void;
}

const EMPTY: Omit<AccountVisitState, 'visit'> = { lastAccountSignInAt: null, signedInThisVisit: false, retrustPending: false, signedOutThisRun: false };

export const useAccountVisit = create<AccountVisitState & AccountVisitActions>((set, get) => ({
  visit: 0,
  ...EMPTY,
  markSignedIn: (at, retrustPending, visit) => {
    if (visit !== undefined && visit !== get().visit) {
      set({ retrustPending, signedOutThisRun: false });
      return;
    }
    set({ lastAccountSignInAt: at, signedInThisVisit: true, retrustPending, signedOutThisRun: false });
  },
  endVisit: () => set({ visit: get().visit + 1, lastAccountSignInAt: null, signedInThisVisit: false }),
  forget: () => set({ ...EMPTY, signedOutThisRun: true }),
}));
