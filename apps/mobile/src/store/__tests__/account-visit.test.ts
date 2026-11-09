import { beforeEach, describe, expect, it } from 'vitest';
import { useAccountVisit } from '../account-visit';

/** F-AUTH-004 sections 6.5, 7.3 and 13.1 (row NS-3): the account's memory between its screens. */

beforeEach(() => useAccountVisit.setState({ lastAccountSignInAt: null, signedInThisVisit: false, retrustPending: false, signedOutThisRun: false }));

describe('the account visit', () => {
  it('starts empty', () => {
    expect(useAccountVisit.getState()).toMatchObject({ lastAccountSignInAt: null, signedInThisVisit: false, retrustPending: false, signedOutThisRun: false });
  });

  it('a sign-in notes its time, this visit, and whether the lock stays for a re-trust', () => {
    useAccountVisit.getState().markSignedIn(1000, true);
    expect(useAccountVisit.getState()).toMatchObject({ lastAccountSignInAt: 1000, signedInThisVisit: true, retrustPending: true });
  });

  it('the end of a visit forgets the time and the visit, not the re-trust flag (it holds for the run)', () => {
    useAccountVisit.getState().markSignedIn(1000, true);
    useAccountVisit.getState().endVisit();
    expect(useAccountVisit.getState()).toMatchObject({ lastAccountSignInAt: null, signedInThisVisit: false, retrustPending: true });
  });

  it('Sign out forgets everything, and the account reads as signed out until the next sign-in (R-2)', () => {
    useAccountVisit.getState().markSignedIn(1000, true);
    useAccountVisit.getState().forget();
    expect(useAccountVisit.getState()).toMatchObject({ lastAccountSignInAt: null, signedInThisVisit: false, retrustPending: false, signedOutThisRun: true });
    useAccountVisit.getState().markSignedIn(2000, false);
    expect(useAccountVisit.getState().signedOutThisRun).toBe(false);
  });

  it('row NS-4: a sign-in that completes after its visit ended counts for no later visit, only for the re-trust flag', () => {
    const started = useAccountVisit.getState().visit;
    useAccountVisit.getState().endVisit();
    expect(useAccountVisit.getState().visit).toBe(started + 1);
    useAccountVisit.getState().markSignedIn(1000, true, started);
    expect(useAccountVisit.getState()).toMatchObject({ lastAccountSignInAt: null, signedInThisVisit: false, retrustPending: true });
    useAccountVisit.getState().markSignedIn(2000, false, started + 1);
    expect(useAccountVisit.getState()).toMatchObject({ lastAccountSignInAt: 2000, signedInThisVisit: true, retrustPending: false });
  });
});
