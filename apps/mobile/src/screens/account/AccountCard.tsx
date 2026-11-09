import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

/**
 * F-AUTH-004 section 7.1, design D7 (row NS-3): the Grown-up area's account card exists on iOS and Android only
 * (`AccountCard.native.tsx`). This twin is what the web build's import walk and the render tests resolve: the web's
 * grown-up account is the console (F-APP-001), so there is no card. The dashboard reaches the card only through an
 * `EXPO_OS` test the web build folds away, so the web bundle carries neither file.
 */
export interface AccountCardProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ParentDashboard'>;
}

export function AccountCard(_props: AccountCardProps): null {
  return null;
}
