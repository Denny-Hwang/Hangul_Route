import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import type { AccessSource } from '../logic/browse/pass';
import type { BrowseHomeParams, BrowseRouteName } from '../logic/browse/boot';
import { BrowseAccessScreen } from '../screens/browse/BrowseAccessScreen';
import { BrowseCardScreen } from '../screens/browse/BrowseCardScreen';
import { BrowseEpisodeScreen } from '../screens/browse/BrowseEpisodeScreen';
import { BrowseHomeScreen } from '../screens/browse/BrowseHomeScreen';
import { BrowseItemScreen } from '../screens/browse/BrowseItemScreen';
import { BrowseMinigameScreen, BrowseStoryReaderScreen, BrowseStorySourcesScreen } from '../screens/browse/BrowseLessonScreens';
import { PreviewEndScreen } from '../screens/browse/PreviewEndScreen';
import { PreviewQuestScreen } from '../screens/browse/PreviewQuestScreen';
import type { RootStackParamList } from './types';

/**
 * The All lessons stack (F-BROWSE-001 section 4.1): its own native stack, no
 * tabs, no learner route. Every route of the spec is typed here; a route is
 * registered once its screen exists (BR-6: home and Access; BR-7 the episode
 * outline, the item page and the card; BR-8 the preview screens and the
 * learner screens through the navigation adapter, BR-5c). `entryStack` never
 * names a route that is not registered (`BROWSE_REGISTERED_ROUTES`).
 */
export type BrowseStackParamList = {
  BrowseHome: BrowseHomeParams | undefined;
  BrowseEpisode: { episodeId: string };
  BrowseItem: { kind: 'quest' | 'story' | 'vocab-topic'; id: string; focusJamoId?: string };
  PreviewQuest: { questId: string; episodeId: string };
  /** The learner `MinigameScreen`, through the navigation adapter (BR-5c). */
  Minigame: RootStackParamList['Minigame'];
  /** The learner story reader's replay route, which writes nothing. */
  StoryReader: RootStackParamList['StoryReader'];
  /** Story sources, copy-only links in All lessons. */
  StorySources: RootStackParamList['StorySources'];
  CardDetail: { cardId: string };
  PreviewEnd: { kind: 'quest' | 'story' | 'vocab-topic'; id: string; episodeId?: string };
  BrowseAccess: { reason: 'none' | 'expired'; source: AccessSource };
};

/** The routes this build registers (each name is a key of `BrowseStackParamList`). */
export const BROWSE_REGISTERED_ROUTES: ReadonlySet<BrowseRouteName> = new Set<BrowseRouteName & keyof BrowseStackParamList>([
  'BrowseHome',
  'BrowseAccess',
  // BR-7: the catalogue pages and the card.
  'BrowseEpisode',
  'BrowseItem',
  'CardDetail',
  // BR-8: the preview, the learner lesson screens through the navigation adapter, and the end screen.
  'PreviewQuest',
  'Minigame',
  'StoryReader',
  'StorySources',
  'PreviewEnd',
]);

const Stack = createNativeStackNavigator<BrowseStackParamList>();

export function BrowseNavigator(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BrowseHome" component={BrowseHomeScreen} />
      <Stack.Screen name="BrowseEpisode" component={BrowseEpisodeScreen} />
      <Stack.Screen name="BrowseItem" component={BrowseItemScreen} />
      <Stack.Screen name="CardDetail" component={BrowseCardScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="PreviewQuest" component={PreviewQuestScreen} />
      <Stack.Screen name="Minigame" component={BrowseMinigameScreen} />
      <Stack.Screen name="StoryReader" component={BrowseStoryReaderScreen} />
      <Stack.Screen name="StorySources" component={BrowseStorySourcesScreen} />
      <Stack.Screen name="PreviewEnd" component={PreviewEndScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="BrowseAccess" component={BrowseAccessScreen} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  );
}
