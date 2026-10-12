import { Screen } from '@hangul-route/design-system';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useProfileStore } from '../store/profile-store';
import { BootIntentHook } from './boot-intent';
import { MainTabs } from './tabs';
import type { RootStackParamList } from './types';
import { CardDetailScreen } from '../screens/library/CardDetailScreen';
import { EpisodeDetailScreen } from '../screens/episode/EpisodeDetailScreen';
import { MyRouteScreen } from '../screens/my-route/MyRouteScreen';
import { OnboardingStack } from './onboarding';
import { withOwnSafeArea } from './with-own-safe-area';
import { ParentDashboardScreen } from '../screens/parent/ParentDashboardScreen';
import { PinEntryScreen } from '../screens/parent/PinEntryScreen';
import { PinResetScreen } from '../screens/parent/PinResetScreen';
import { PlacementReportScreen } from '../screens/parent/PlacementReportScreen';
import { RestoreScreen } from '../screens/sync/RestoreScreen';
import { SaveProgressScreen } from '../screens/sync/SaveProgressScreen';
import { JoinSpaceScreen } from '../screens/sync/JoinSpaceScreen';
import { PaywallScreen } from '../screens/paywall/PaywallScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { HomeworkScreen } from '../screens/homework/HomeworkScreen';
import { QuestPlayerScreen } from '../screens/quest/QuestPlayerScreen';
import { ResultsScreen } from '../screens/results/ResultsScreen';
import { MinigameScreen } from '../screens/minigames/MinigameScreen';
import { StoryReaderScreen } from '../screens/story/StoryReaderScreen';
import { StorySourcesScreen } from '../screens/story/StorySourcesScreen';
import { CellStoriesScreen } from '../screens/story/CellStoriesScreen';
import { CultureNotesScreen } from '../screens/story/CultureNotesScreen';
import { PlacementScreen } from '../screens/placement/PlacementScreen';
import { VocabTopicScreen } from '../screens/vocab/VocabTopicScreen';
import { VocabTopicsScreen } from '../screens/vocab/VocabTopicsScreen';
import { STORY_FIXTURES_BUILD, StoryE2eHook } from './story-e2e';
import { PlacementE2eHook } from './placement-e2e';
import { VocabE2eHook, VocabQuestionE2eScreen } from './vocab-question-e2e';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Modal screens (iOS page sheets) measure their own safe area, see with-own-safe-area.
const CardDetailModal = withOwnSafeArea(CardDetailScreen);
const PinEntryModal = withOwnSafeArea(PinEntryScreen);
const PinResetModal = withOwnSafeArea(PinResetScreen);

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
    <>
      {STORY_FIXTURES_BUILD ? <StoryE2eHook /> : null}
      {STORY_FIXTURES_BUILD ? <PlacementE2eHook /> : null}
      {STORY_FIXTURES_BUILD ? <VocabE2eHook /> : null}
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}
        initialRouteName={hasProfile ? 'Main' : 'Onboarding'}
      >
        <Stack.Screen name="Onboarding" component={OnboardingStack} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="EpisodeDetail" component={EpisodeDetailScreen} />
        <Stack.Screen name="CellStories" component={CellStoriesScreen} />
        <Stack.Screen name="MyRoute" component={MyRouteScreen} />
        <Stack.Screen name="QuestPlayer" component={QuestPlayerScreen} />
        <Stack.Screen name="Minigame" component={MinigameScreen} />
        <Stack.Screen name="Results" component={ResultsScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="CardDetail" component={CardDetailModal} options={{ presentation: 'modal' }} />
        <Stack.Screen name="PinEntry" component={PinEntryModal} options={{ presentation: 'modal' }} />
        <Stack.Screen name="PinReset" component={PinResetModal} options={{ presentation: 'modal' }} />
        <Stack.Screen name="ParentDashboard" component={ParentDashboardScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Homework" component={HomeworkScreen} />
        <Stack.Screen name="Restore" component={RestoreScreen} />
        <Stack.Screen name="SaveProgress" component={SaveProgressScreen} />
        <Stack.Screen name="JoinSpace" component={JoinSpaceScreen} />
        <Stack.Screen name="Paywall" component={PaywallScreen} />
        <Stack.Screen name="StoryReader" component={StoryReaderScreen} />
        <Stack.Screen name="StorySources" component={StorySourcesScreen} />
        <Stack.Screen name="CultureNotes" component={CultureNotesScreen} />
        <Stack.Screen name="Placement" component={PlacementScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="PlacementReport" component={PlacementReportScreen} />
        {/* Words (F-VOC-003): reachable only from the Library Words section, which needs flags.vocabTopicsEnabled. */}
        <Stack.Screen name="VocabTopics" component={VocabTopicsScreen} />
        <Stack.Screen name="VocabTopic" component={VocabTopicScreen} />
        {STORY_FIXTURES_BUILD ? <Stack.Screen name="VocabQuestionE2e" component={VocabQuestionE2eScreen} /> : null}
      </Stack.Navigator>
      {/* After the stack, so the navigator is registered when the boot intent opens the PIN screen (F-APP-001 section 3.9). */}
      <BootIntentHook />
    </>
  );
}
