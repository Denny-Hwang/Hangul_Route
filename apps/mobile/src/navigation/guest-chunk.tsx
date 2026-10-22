import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { GuestLaterScreen } from '../screens/guest/GuestLaterScreen';
import { GuestQuestPlayer } from '../screens/guest/GuestQuestPlayer';
import { GuestResults } from '../screens/guest/GuestResults';
import { CardDetailScreen } from '../screens/library/CardDetailScreen';
import { MinigameScreen } from '../screens/minigames/MinigameScreen';
import type { GuestStackParamList } from './types';
import { withOwnSafeArea } from './with-own-safe-area';

const Stack = createNativeStackNavigator<GuestStackParamList>();

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 7.1, CS-G1 (row GU-3): the routes this stack registers, in order. Row
 * GU-4 appends the save's `CreateProfile` and `PinEntry`. `guest-stack.test.ts` holds this list, the navigator and the
 * navigate targets of every screen in it to `GuestStackParamList`.
 */
export const GUEST_STACK_ROUTES = ['QuestPlayer', 'Minigame', 'Results', 'CardDetail', 'GuestLater'] as const satisfies readonly (keyof GuestStackParamList)[];

/**
 * [GU] Row GU-3, F-CURR-002 section 10: this module is a chunk of its own (`guest-chunk-<md5>.js`, precached), reached
 * only through the literal `import()` of `navigation/guest.tsx`, so the learner's start bundle carries none of the
 * guest's screens. The post-build check fails if a start bundle carries this marker (`SCREEN_CHUNKS`).
 */
export const SCREEN_CHUNK = 'screen-chunk:guest';

type GuestScreenProps<K extends keyof GuestStackParamList> = NativeStackScreenProps<GuestStackParamList, K>;

/**
 * A learner screen this stack shares with the root stack (the card page, which navigates nowhere): the same
 * component, typed for this stack's route props.
 */
function shared<K extends keyof GuestStackParamList, P>(screen: React.ComponentType<P>): React.ComponentType<GuestScreenProps<K>> {
  return screen as unknown as React.ComponentType<GuestScreenProps<K>>;
}

// A modal measures its own safe area, as in the root stack.
const CardDetailModal = withOwnSafeArea(CardDetailScreen);
const GuestCardDetailRoute = shared<'CardDetail', React.ComponentProps<typeof CardDetailScreen>>(CardDetailModal);

/** A game of quest 1: Back returns to the player; the story step's Culture notes link is not drawn (not in this stack). */
function GuestMinigameRoute({ route, navigation }: GuestScreenProps<'Minigame'>): React.ReactElement {
  return <MinigameScreen route={route} navigation={{ goBack: () => navigation.goBack(), push: () => undefined }} onOpenCultureNote={null} />;
}

/**
 * The guest's first quest (sections 6.2 and 7.1): quest 1 with the guest ports (`GuestQuestPlayer`), its games, the
 * guest's Results (`GuestResults`), the card page and the Not now card, and nothing else (no tabs, no Profile, no
 * Grown-up area, no Paywall, no Join, no notes, no Learning Route, no level check, no Lecture mode, no All lessons).
 * The root stack registers it only while `flags.guestLessonEnabled` is on; it opens at `QuestPlayer` or `GuestLater`
 * (the route's `screen` param).
 */
export default function GuestStackNavigator(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
      <Stack.Screen name="QuestPlayer" component={GuestQuestPlayer} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Minigame" component={GuestMinigameRoute} />
      <Stack.Screen name="Results" component={GuestResults} options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="CardDetail" component={GuestCardDetailRoute} options={{ presentation: 'modal' }} />
      <Stack.Screen name="GuestLater" component={GuestLaterScreen} options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack.Navigator>
  );
}
