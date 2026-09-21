import { Screen } from '@hangul-route/design-system';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useProfileStore } from '../store/profile-store';
import { MainTabs } from './tabs';
import type { RootStackParamList } from './types';
import { CardDetailScreen } from '../screens/library/CardDetailScreen';
import { EpisodeDetailScreen } from '../screens/episode/EpisodeDetailScreen';
import { OnboardingStack } from './onboarding';
import { ParentDashboardScreen } from '../screens/parent/ParentDashboardScreen';
import { PinEntryScreen } from '../screens/parent/PinEntryScreen';
import { RestoreScreen } from '../screens/sync/RestoreScreen';
import { SaveProgressScreen } from '../screens/sync/SaveProgressScreen';
import { JoinSpaceScreen } from '../screens/sync/JoinSpaceScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { HomeworkScreen } from '../screens/homework/HomeworkScreen';
import { QuestPlayerScreen } from '../screens/quest/QuestPlayerScreen';
import { ResultsScreen } from '../screens/results/ResultsScreen';
import { MinigameScreen } from '../screens/minigames/MinigameScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.ReactElement {
  const profiles = useProfileStore((s) => s.profiles);
  const hydrated = useProfileStore((s) => s.hydrated);
  const hasProfile = profiles.length > 0;

  // `initialRouteName` is read once when the navigator mounts, so mounting
  // before storage has hydrated would send a returning learner back to
  // onboarding on every cold launch. Hold on a blank canvas (~1 frame on
  // device) until the profile store has loaded.
  if (!hydrated) {
    return <Screen tone="canvas">{null}</Screen>;
  }

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}
      initialRouteName={hasProfile ? 'Main' : 'Onboarding'}
    >
      <Stack.Screen name="Onboarding" component={OnboardingStack} />
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="EpisodeDetail" component={EpisodeDetailScreen} />
      <Stack.Screen name="QuestPlayer" component={QuestPlayerScreen} />
      <Stack.Screen name="Minigame" component={MinigameScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="CardDetail" component={CardDetailScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="PinEntry" component={PinEntryScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ParentDashboard" component={ParentDashboardScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Homework" component={HomeworkScreen} />
      <Stack.Screen name="Restore" component={RestoreScreen} />
      <Stack.Screen name="SaveProgress" component={SaveProgressScreen} />
      <Stack.Screen name="JoinSpace" component={JoinSpaceScreen} />
    </Stack.Navigator>
  );
}
