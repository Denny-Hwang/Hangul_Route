import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useProfileStore } from '../store/profile-store';
import { MainTabs } from './tabs';
import type { RootStackParamList } from './types';
import { CardDetailScreen } from '../screens/library/CardDetailScreen';
import { EpisodeDetailScreen } from '../screens/episode/EpisodeDetailScreen';
import { OnboardingStack } from './onboarding';
import { ParentDashboardScreen } from '../screens/parent/ParentDashboardScreen';
import { ParentGateScreen } from '../screens/parent/ParentGateScreen';
import { QuestPlayerScreen } from '../screens/quest/QuestPlayerScreen';
import { ResultsScreen } from '../screens/results/ResultsScreen';
import { MinigameScreen } from '../screens/minigames/MinigameScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.ReactElement {
  const profiles = useProfileStore((s) => s.profiles);
  const hydrated = useProfileStore((s) => s.hydrated);
  const hasProfile = profiles.length > 0;

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}
      initialRouteName={hydrated && hasProfile ? 'Main' : 'Onboarding'}
    >
      <Stack.Screen name="Onboarding" component={OnboardingStack} />
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="EpisodeDetail" component={EpisodeDetailScreen} />
      <Stack.Screen name="QuestPlayer" component={QuestPlayerScreen} />
      <Stack.Screen name="Minigame" component={MinigameScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="CardDetail" component={CardDetailScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ParentGate" component={ParentGateScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ParentDashboard" component={ParentDashboardScreen} />
    </Stack.Navigator>
  );
}
