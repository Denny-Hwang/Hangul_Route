import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReactElement } from 'react';
import type { GrownUpStackParamList } from '../../navigation/types';
import { AccountGate, type AccountGateNavigation } from './AccountGate.native';
import { FamilyHome, type HomeNavigation } from './FamilyHome.native';
import { TeacherHome, type TeacherHomeNavigation } from './TeacherHome.native';

/**
 * F-AUTH-004 sections 7.2 and 8.1 to 8.4 (rows NS-4 to NS-6): the route of a use's home, `AccountHome { use }`, inside
 * `AccountGate`, on iOS and Android. A route of the nested Grown-up area stack, registered with `getComponent` so its
 * module (and Clerk's SDK the gate reads) loads only when the route is first shown (ND-11, CS-N13).
 *
 * - `family`, and `account` (the Grown-up account row of a record with no use: the Family home's "no family space"
 *   state, section 7.1): the Family home (`FamilyHome.native.tsx`, row NS-5).
 * - `teacher`, and `school` (the same page titled School, focus on its first school row, section 8.4): the Teacher home
 *   (`TeacherHome.native.tsx`, row NS-6), which replaced row NS-4's interim landing on the Grown-up area.
 */

type Props = NativeStackScreenProps<GrownUpStackParamList, 'AccountHome'>;

export function AccountHomeScreen({ navigation, route }: Props): ReactElement {
  const nav = navigation as unknown as AccountGateNavigation;
  const { use } = route.params;
  return (
    <AccountGate screen="home" use={use} navigation={nav} routeKey={route.key}>
      {use === 'family' || use === 'account' ? (
        <FamilyHome use={use} navigation={navigation as unknown as HomeNavigation} routeKey={route.key} />
      ) : (
        <TeacherHome use={use} navigation={navigation as unknown as TeacherHomeNavigation} routeKey={route.key} />
      )}
    </AccountGate>
  );
}
