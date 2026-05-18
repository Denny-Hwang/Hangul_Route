import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { CreateProfileScreen } from '../screens/onboarding/CreateProfileScreen';
import { FirstQuestPreviewScreen } from '../screens/onboarding/FirstQuestPreviewScreen';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import type { OnboardingStackParamList } from './types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingStack(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="CreateProfile" component={CreateProfileScreen} initialParams={{ firstRun: true }} />
      <Stack.Screen name="FirstQuestPreview" component={FirstQuestPreviewScreen} />
    </Stack.Navigator>
  );
}
