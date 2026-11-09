import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, type ReactElement } from 'react';
import type { GrownUpStackParamList } from '../../navigation/types';
import { AccountGate, type AccountGateNavigation } from './AccountGate.native';
import { FamilyHome, type HomeNavigation } from './FamilyHome.native';

/**
 * F-AUTH-004 sections 7.2 and 8.1 to 8.4 (rows NS-4, NS-5; row NS-6 draws the Teacher and School homes): the route of a
 * use's home, `AccountHome { use }`, inside `AccountGate`, on iOS and Android. A route of the nested Grown-up area
 * stack, registered with `getComponent` so its module (and Clerk's SDK the gate reads) loads only when the route is
 * first shown (ND-11, CS-N13).
 *
 * - `family`, and `account` (the Grown-up account row of a record with no use: the Family home's "no family space"
 *   state, section 7.1): the Family home (`FamilyHome.native.tsx`, row NS-5).
 * - `teacher` and `school`: until row NS-6 draws their homes, an open result lands on the Grown-up area
 *   (`landOnArea`), whose account card then shows the account and its uses: back to the dashboard when it is under
 *   this screen, else (a chooser row) in this screen's place, so Back from there still goes to the chooser.
 */

type Props = NativeStackScreenProps<GrownUpStackParamList, 'AccountHome'>;

export function AccountHomeScreen({ navigation, route }: Props): ReactElement {
  const nav = navigation as unknown as AccountGateNavigation;
  const { use } = route.params;
  return (
    <AccountGate screen="home" use={use} navigation={nav} routeKey={route.key}>
      {use === 'family' || use === 'account' ? <FamilyHome use={use} navigation={navigation as unknown as HomeNavigation} routeKey={route.key} /> : <LandOnArea navigation={nav} />}
    </AccountGate>
  );
}

/** Row NS-4's open result, kept for the Teacher and School uses until row NS-6 draws their homes. */
export function landOnArea(navigation: AccountGateNavigation): void {
  const state = navigation.getState();
  if (state.routes.some((r) => r.name === 'ParentDashboard')) navigation.navigate('ParentDashboard');
  else navigation.replace('ParentDashboard');
}

function LandOnArea({ navigation }: { navigation: AccountGateNavigation }): null {
  useEffect(() => {
    landOnArea(navigation);
  }, [navigation]);
  return null;
}
