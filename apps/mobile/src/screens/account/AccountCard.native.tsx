import { Suspense, lazy, useContext, useMemo, type ReactElement } from 'react';
import { nativeSignInConfig } from '../../config/native-signin';
import { ClerkMountContext } from './account-host';
import type { AccountCardProps } from './AccountCard';
import type { CardNavigation } from './AccountCardBody.native';

/**
 * F-AUTH-004 section 7.1, design D7 (row NS-3; CS-N1, CS-N13, ND-11): the Grown-up area's account card on iOS and
 * Android, reached from the dashboard through an `EXPO_OS` test the web build folds away. It draws nothing while the
 * native account is off (CS-N13). Its parts load only when drawn (`import()`): the card (`AccountCardBody.native.tsx`)
 * once the account is on, and the part that reads Clerk's hooks (`AccountCardClerk.native.tsx`) only under Clerk's
 * provider, so Clerk's Expo SDK never loads at launch or for a learner (ND-11). Nothing shows while a part loads.
 */

const CardBody = lazy(() => import('./AccountCardBody.native').then((m) => ({ default: m.AccountCardBody })));
const CardWithClerk = lazy(() => import('./AccountCardClerk.native').then((m) => ({ default: m.AccountCardClerk })));

export function AccountCard({ navigation }: AccountCardProps): ReactElement | null {
  const enabled = useMemo(() => nativeSignInConfig().enabled, []);
  const mount = useContext(ClerkMountContext);
  if (!enabled) return null;
  const nav = navigation as unknown as CardNavigation;
  return (
    <Suspense fallback={null}>
      {mount === 'ready' ? <CardWithClerk navigation={nav} /> : <CardBody navigation={nav} side={{ clerk: mount, signedIn: false, email: null }} />}
    </Suspense>
  );
}
