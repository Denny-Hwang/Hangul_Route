import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, type ReactElement } from 'react';
import type { GrownUpStackParamList } from '../../navigation/types';
import { AccountGate, type AccountGateNavigation } from './AccountGate.native';

/**
 * F-AUTH-004 sections 7.2 and 8.1 (row NS-4; row NS-5 draws the homes): the route of a use's home, `AccountHome { use }`,
 * inside `AccountGate`, on iOS and Android. A route of the nested Grown-up area stack, registered with `getComponent`
 * so its module (and Clerk's SDK the gate reads) loads only when the route is first shown (ND-11, CS-N13).
 *
 * Until row NS-5 lands the homes, an open result lands on the Grown-up area (`landOnArea`), whose account card then
 * shows the account and its uses (as a completed sign-in does in row NS-3): back to the dashboard when it is under
 * this screen, else (a chooser row) in this screen's place, so Back from there still goes to the chooser.
 */

type Props = NativeStackScreenProps<GrownUpStackParamList, 'AccountHome'>;

export function AccountHomeScreen({ navigation, route }: Props): ReactElement {
  const nav = navigation as unknown as AccountGateNavigation;
  return (
    <AccountGate screen="home" use={route.params.use} navigation={nav} routeKey={route.key}>
      <LandOnArea navigation={nav} />
    </AccountGate>
  );
}

/** Row NS-4's open result (row NS-5 replaces it with the use's home). */
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
