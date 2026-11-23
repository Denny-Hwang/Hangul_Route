import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { createContext, useContext, type ReactElement } from 'react';
import { PinEntryScreen } from '../screens/parent/PinEntryScreen';
import { PinResetScreen } from '../screens/parent/PinResetScreen';
import { RecoverHoldScreen, type RecoverHoldProps } from '../screens/system/RecoverHoldScreen';
import type { RecoverStackParamList } from './types';
import { withOwnSafeArea } from './with-own-safe-area';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.6 (row DP-1d): the read-failed screen's own stack at boot, for a profile
 * list whose bytes do not parse and were kept. The app's navigator is not mounted then (BootGate holds the boot), so
 * the grown-up gate (the root's PIN screens, for the `RecoverRecord` destination only) runs in a navigation container
 * of its own: independent, so nothing here reaches or changes the app's container (its history bridge, the Grown-up
 * area watchers), and no route outside this stack can be reached from it. The screen is `RecoverHold` (a root: no
 * header, as the held screen outside a route); the PIN screen comes back to it with the gate open, and it shows the
 * RecoverRecord sheet. The document title is left as it is.
 */
const Stack = createNativeStackNavigator<RecoverStackParamList>();

const HoldProps = createContext<RecoverHoldProps>({ onTryAgain: async () => false, onStartFresh: async () => false });

function RecoverHoldRoute({ navigation }: NativeStackScreenProps<RecoverStackParamList, 'RecoverHold'>): ReactElement {
  return <RecoverHoldScreen navigation={navigation} {...useContext(HoldProps)} />;
}

// Modal screens (iOS page sheets) measure their own safe area, as in the root stack.
const PinEntryModal = withOwnSafeArea(PinEntryScreen);
const PinResetModal = withOwnSafeArea(PinResetScreen);

export function RecoverStack(props: RecoverHoldProps): ReactElement {
  return (
    <HoldProps.Provider value={props}>
      <NavigationContainer independent documentTitle={{ enabled: false }}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }} initialRouteName="RecoverHold">
          <Stack.Screen name="RecoverHold" component={RecoverHoldRoute} />
          <Stack.Screen name="PinEntry" component={PinEntryModal} options={{ presentation: 'modal' }} />
          <Stack.Screen name="PinReset" component={PinResetModal} options={{ presentation: 'modal' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </HoldProps.Provider>
  );
}
