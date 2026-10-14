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
import { LearnerReportScreen } from '../screens/parent/LearnerReportScreen';
import { flags } from '../config/flags';
import { RestoreScreen } from '../screens/sync/RestoreScreen';
import { SaveProgressScreen } from '../screens/sync/SaveProgressScreen';
import { JoinSpaceScreen } from '../screens/sync/JoinSpaceScreen';
import { ApproveTransferScreen } from '../screens/transfer/ApproveTransferScreen';
import { MoveClassScreen } from '../screens/transfer/MoveClassScreen';
import { PaywallScreen } from '../screens/paywall/PaywallScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { HomeworkScreen } from '../screens/homework/HomeworkScreen';
import { QuestPlayerScreen } from '../screens/quest/QuestPlayerScreen';
import { ResultsScreen } from '../screens/results/ResultsScreen';
import { StageCompleteScreen } from '../screens/results/StageCompleteScreen';
import { StageReviewScreen } from '../screens/reviews/StageReviewScreen';
import { MinigameScreen } from '../screens/minigames/MinigameScreen';
import { StoryReaderScreen } from '../screens/story/StoryReaderScreen';
import { StorySourcesScreen } from '../screens/story/StorySourcesScreen';
import { CellStoriesScreen } from '../screens/story/CellStoriesScreen';
import { CultureNotesScreen } from '../screens/story/CultureNotesScreen';
import { PlacementScreen } from '../screens/placement/PlacementScreen';
import { VocabResultsScreen } from '../screens/vocab/VocabResultsScreen';
import { VocabSpeedRoundScreen } from '../screens/vocab/VocabSpeedRoundScreen';
import { RouteOverviewScreen } from '../screens/route/RouteOverviewScreen';
import { RoutePreviewScreen } from '../screens/route/RoutePreviewScreen';
import { RouteProposalScreen } from '../screens/route/RouteProposalScreen';
import { RouteSetupScreen } from '../screens/route/RouteSetupScreen';
import { NoteDetailScreen } from '../screens/notes/NoteDetailScreen';
import { NotesScreen } from '../screens/notes/NotesScreen';
import { NoteReportScreen } from '../screens/parent/NoteReportScreen';
import { NotesGrownUpScreen } from '../screens/parent/NotesGrownUpScreen';
import { VocabCardsScreen } from '../screens/vocab/VocabCardsScreen';
import { VocabMatchScreen } from '../screens/vocab/VocabMatchScreen';
import { VocabTopicScreen } from '../screens/vocab/VocabTopicScreen';
import { VocabTopicsScreen } from '../screens/vocab/VocabTopicsScreen';
import { cellStoriesRouteId } from '../logic/story/cell-stories';
import { STORY_FIXTURES_BUILD, StoryE2eHook } from './story-e2e';
import { PlacementE2eHook } from './placement-e2e';
import { VocabE2eHook, VocabQuestionE2eScreen } from './vocab-question-e2e';
import { SentenceBuilderE2eScreen, SentenceE2eHook } from './sentence-builder-e2e';
import { RealiaE2eHook, RealiaReadE2eScreen } from './realia-read-e2e';
import { TypeHangulE2eHook, TypeHangulE2eScreen } from './type-hangul-e2e';
import { WriteFrameE2eHook, WriteFrameE2eScreen } from './write-frame-e2e';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Modal screens (iOS page sheets) measure their own safe area, see with-own-safe-area.
const CardDetailModal = withOwnSafeArea(CardDetailScreen);
const PinEntryModal = withOwnSafeArea(PinEntryScreen);
const PinResetModal = withOwnSafeArea(PinResetScreen);

// One stack entry per cell page: `navigate` goes back to that cell's page, or pushes it (F-STORY-005 §3.6).
// `EpisodeDetail` has none (see `cellStoriesRouteId`): the cell page opens episodes with push or Back.
const cellStoriesRouteIdOf = ({ params }: { params: RootStackParamList['CellStories'] }): string => cellStoriesRouteId(params);

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
      {STORY_FIXTURES_BUILD ? <SentenceE2eHook /> : null}
      {STORY_FIXTURES_BUILD ? <RealiaE2eHook /> : null}
      {STORY_FIXTURES_BUILD ? <TypeHangulE2eHook /> : null}
      {STORY_FIXTURES_BUILD ? <WriteFrameE2eHook /> : null}
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}
        initialRouteName={hasProfile ? 'Main' : 'Onboarding'}
      >
        <Stack.Screen name="Onboarding" component={OnboardingStack} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="EpisodeDetail" component={EpisodeDetailScreen} />
        <Stack.Screen name="CellStories" component={CellStoriesScreen} getId={cellStoriesRouteIdOf} />
        <Stack.Screen name="MyRoute" component={MyRouteScreen} />
        <Stack.Screen name="QuestPlayer" component={QuestPlayerScreen} />
        <Stack.Screen name="Minigame" component={MinigameScreen} />
        <Stack.Screen name="Results" component={ResultsScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="StageComplete" component={StageCompleteScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="StageReview" component={StageReviewScreen} options={{ gestureEnabled: false }} />
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
        {/* Class moves (F-SPACE-002 T-7c): reachable only from the Classes card and the Home line, which draw nothing while the inbox says transfers are off. */}
        <Stack.Screen name="MoveClass" component={MoveClassScreen} />
        <Stack.Screen name="ApproveTransfer" component={ApproveTransferScreen} />
        <Stack.Screen name="Paywall" component={PaywallScreen} />
        <Stack.Screen name="StoryReader" component={StoryReaderScreen} />
        <Stack.Screen name="StorySources" component={StorySourcesScreen} />
        <Stack.Screen name="CultureNotes" component={CultureNotesScreen} />
        <Stack.Screen name="Placement" component={PlacementScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="PlacementReport" component={PlacementReportScreen} />
        {/* F-REPORT-001 section 3.9 (RP-9): registered only with the reports flag on. */}
        {flags.reportsEnabled ? <Stack.Screen name="LearnerReport" component={LearnerReportScreen} /> : null}
        {/* The weekly plan screens (F-PLAN-002 P2-7a, P2-7b) register on the raw flag; the entries gate (P2-8b): Home's
            plan slot, the Profile row, Open plan, the placement strip and the report card read routeEnabledFor(locale). */}
        {flags.routeEnabled ? <Stack.Screen name="RouteProposal" component={RouteProposalScreen} /> : null}
        {flags.routeEnabled ? <Stack.Screen name="RouteSetup" component={RouteSetupScreen} /> : null}
        {flags.routeEnabled ? <Stack.Screen name="RoutePreview" component={RoutePreviewScreen} /> : null}
        {flags.routeEnabled ? <Stack.Screen name="RouteOverview" component={RouteOverviewScreen} /> : null}
        {/* Notes from grown-ups (F-FEEDBACK-001 FB-8): My notes and the note page, only with flags.notesEnabled. */}
        {flags.notesEnabled ? <Stack.Screen name="Notes" component={NotesScreen} /> : null}
        {flags.notesEnabled ? <Stack.Screen name="NoteDetail" component={NoteDetailScreen} /> : null}
        {/* The grown-up zone of notes (FB-9): Notes for <learner> and the report sheet, behind the gate. */}
        {flags.notesEnabled ? <Stack.Screen name="NotesGrownUp" component={NotesGrownUpScreen} /> : null}
        {flags.notesEnabled ? <Stack.Screen name="NoteReport" component={NoteReportScreen} /> : null}
        {/* Words (F-VOC-003): reachable only from the Library Words section, which needs flags.vocabTopicsEnabled. */}
        <Stack.Screen name="VocabTopics" component={VocabTopicsScreen} />
        <Stack.Screen name="VocabTopic" component={VocabTopicScreen} />
        {/* The flashcards (F-VOC-003 C-5): opened from a topic page, so also behind flags.vocabTopicsEnabled. */}
        <Stack.Screen name="VocabCards" component={VocabCardsScreen} />
        {/* Words Match (F-VOC-003 C-6): Pic-Word Match on the collected words, opened from a topic page. */}
        <Stack.Screen name="VocabMatch" component={VocabMatchScreen} />
        {/* The Speed Round (F-VOC-004 S-5): launched from a topic page, so also behind flags.vocabTopicsEnabled. */}
        <Stack.Screen name="VocabSpeedRound" component={VocabSpeedRoundScreen} />
        <Stack.Screen name="VocabResults" component={VocabResultsScreen} />
        {STORY_FIXTURES_BUILD ? <Stack.Screen name="VocabQuestionE2e" component={VocabQuestionE2eScreen} /> : null}
        {STORY_FIXTURES_BUILD ? <Stack.Screen name="SentenceBuilderE2e" component={SentenceBuilderE2eScreen} /> : null}
        {STORY_FIXTURES_BUILD ? <Stack.Screen name="RealiaReadE2e" component={RealiaReadE2eScreen} /> : null}
        {STORY_FIXTURES_BUILD ? <Stack.Screen name="TypeHangulE2e" component={TypeHangulE2eScreen} /> : null}
        {STORY_FIXTURES_BUILD ? <Stack.Screen name="WriteFrameE2e" component={WriteFrameE2eScreen} /> : null}
      </Stack.Navigator>
      {/* After the stack, so the navigator is registered when the boot intent opens the PIN screen (F-APP-001 section 3.9). */}
      <BootIntentHook />
    </>
  );
}
