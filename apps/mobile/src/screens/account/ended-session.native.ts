import type { GrownUpUse } from '@hangul-route/content-schema';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { routesAfterEndedSession, type LoadFailure } from '../../logic/account/homes';
import type { GrownUpStackParamList } from '../../navigation/types';
import { useAccountSessionEnded } from './account-session.native';

/**
 * F-AUTH-004 sections 6.6 and 8.8 (rows NS-5, NS-6): what every account page does when a read answers `401`, kept apart
 * from the homes' other steps (`home-data.native.ts`) so a report loads nothing it does not draw.
 */

/** The navigation every account page drives (a home, a page above it). */
export type AccountPageNavigation = NativeStackNavigationProp<GrownUpStackParamList, keyof GrownUpStackParamList>;

/**
 * Sections 6.6 and 8.8: a `401` on any read of the page. The records go (as a Sign out, without its event), then the
 * run of account routes the page sits in gives way to one sign-in for the use, so Back never reaches a page of the
 * ended session; that sign-in's AccountGate decides it.
 */
export function useEndedSession(failure: LoadFailure | null, navigation: AccountPageNavigation, routeKey: string, use: GrownUpUse | 'account' | undefined): void {
  const sessionEnded = useAccountSessionEnded();
  const ending = useRef(false);
  useEffect(() => {
    if (failure !== 'unauthorized' || ending.current) return;
    ending.current = true;
    void sessionEnded()
      .catch(() => false)
      .then(() => {
        navigation.dispatch((state) => {
          const kept = routesAfterEndedSession(state.routes, routeKey);
          // Another page of the same run answered `401` first and already gave way to the sign-in: keep that stack.
          if (kept === null) return { type: 'RESET', payload: state } as never;
          const routes = [...kept, { key: `SignIn-${routeKey}`, name: 'SignIn' as const, params: use === undefined ? {} : { use } }];
          // `CommonActions.reset`, written out (as `navigation/grown-up-area-exit.ts` does) so the module loads without the navigation package.
          return { type: 'RESET', payload: { ...state, routes, index: routes.length - 1 } } as never;
        });
      });
  }, [failure, sessionEnded, navigation, use, routeKey]);
}

