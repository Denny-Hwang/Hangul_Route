import { useAuth, useUser } from '@clerk/clerk-expo';
import type { ReactElement } from 'react';
import { useAccountVisit } from '../../store/account-visit';
import { AccountCardBody, type CardNavigation } from './AccountCardBody.native';

/**
 * F-AUTH-004 section 7.1 (row NS-3): the account card's Clerk part, drawn only under Clerk's provider
 * (`ClerkMountContext` says `ready`): whether a session exists and its email. After a Sign out this run (offline,
 * Clerk's own state may still hold the session: its sign-out could not reach Clerk, R-2), the card reads signed out.
 */
export function AccountCardClerk({ navigation }: { navigation: CardNavigation }): ReactElement | null {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const signedOut = useAccountVisit((s) => s.signedOutThisRun);
  return (
    <AccountCardBody
      navigation={navigation}
      side={{
        clerk: isLoaded ? 'ready' : 'loading',
        signedIn: isLoaded && isSignedIn === true && !signedOut,
        email: user?.primaryEmailAddress?.emailAddress ?? null,
      }}
    />
  );
}
