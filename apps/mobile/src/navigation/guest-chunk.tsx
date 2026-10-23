import { useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import type { ComponentType, ComponentProps, ReactElement } from 'react';
import { GuestLaterScreen } from '../screens/guest/GuestLaterScreen';
import { GuestQuestPlayer } from '../screens/guest/GuestQuestPlayer';
import { GuestResults } from '../screens/guest/GuestResults';
import { useLeaveWhenGuestRunLost } from '../screens/guest/use-guest-run-lost';
import { CardDetailScreen } from '../screens/library/CardDetailScreen';
import { MinigameScreen } from '../screens/minigames/MinigameScreen';
import { CreateProfileScreen } from '../screens/onboarding/CreateProfileScreen';
import { PinEntryScreen } from '../screens/parent/PinEntryScreen';
import { guardGuestNavigation } from './guest-nav-guard';
import type { GuestStackParamList } from './types';
import { withOwnSafeArea } from './with-own-safe-area';

const Stack = createNativeStackNavigator<GuestStackParamList>();

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 7.1, CS-G1 (row GU-3): the routes this stack registers, in order. Row
 * GU-4 appends the save's `CreateProfile` and `PinEntry`. `guest-stack.test.ts` holds this list, the navigator and the
 * navigate targets of every screen in it to `GuestStackParamList`.
 */
export const GUEST_STACK_ROUTES = ['QuestPlayer', 'Minigame', 'Results', 'CardDetail', 'GuestLater', 'CreateProfile', 'PinEntry'] as const satisfies readonly (keyof GuestStackParamList)[];

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
function shared<K extends keyof GuestStackParamList, P>(screen: ComponentType<P>): ComponentType<GuestScreenProps<K>> {
  return screen as unknown as ComponentType<GuestScreenProps<K>>;
}

// A modal measures its own safe area, as in the root stack.
const CardDetailModal = withOwnSafeArea(CardDetailScreen);
const GuestCardDetailRoute = shared<'CardDetail', ComponentProps<typeof CardDetailScreen>>(CardDetailModal);

/**
 * [GU] Row GU-4 review (CS-G1): the save's two screens are the learner's own and name routes outside this stack, so
 * they get a guarded `navigation` (`guest-nav-guard.ts`): moves only to this stack's routes (`PinEntry` only as
 * `SaveGuest`), and of the root only the reset to Home of the saved learner. Anything else is dropped.
 */
function useGuardedNavigation<N extends object>(navigation: N): N {
  return useMemo(() => guardGuestNavigation(navigation, GUEST_STACK_ROUTES), [navigation]);
}

/**
 * [GU] Row GU-4 (section 8.3): the save form, the learner's CreateProfile screen with `{ firstRun, from: 'guest' }`: two
 * steps, then `promoteGuest` and Home of the new profile (the root reset in `screens/guest/guest-exits.ts`).
 */
function GuestCreateProfileRoute({ route, navigation }: GuestScreenProps<'CreateProfile'>): ReactElement {
  const guarded = useGuardedNavigation(navigation);
  // The learner screen's own props, typed for the onboarding stack: the same route params (`{ firstRun, from }`).
  return <CreateProfileScreen route={route as never} navigation={guarded as never} />;
}

/**
 * [GU] Row GU-4 (section 8.2, CS-G2, CS-G10): the verify-only PIN of the save (`next: 'SaveGuest'`), a modal measuring
 * its own safe area as in the root stack. A correct PIN replaces it with the form; nothing else opens from it.
 */
const GuestPinEntryModal = withOwnSafeArea(PinEntryScreen);
function GuestPinEntryRoute({ route, navigation }: GuestScreenProps<'PinEntry'>): ReactElement {
  const guarded = useGuardedNavigation(navigation);
  return <GuestPinEntryModal route={route as never} navigation={guarded as never} />;
}

/** A game of quest 1: Back returns to the player; the story step's Culture notes link is not drawn (not in this stack). */
function GuestMinigameRoute({ route, navigation }: GuestScreenProps<'Minigame'>): ReactElement {
  return <MinigameScreen route={route} navigation={{ goBack: () => navigation.goBack(), push: () => undefined }} onOpenCultureNote={null} />;
}

/**
 * The guest's first quest (sections 6.2 and 7.1): quest 1 with the guest ports (`GuestQuestPlayer`), its games, the
 * guest's Results (`GuestResults`), the card page, the Not now card and (row GU-4) the save's form and PIN, and nothing else (no tabs, no Profile, no
 * Grown-up area, no Paywall, no Join, no notes, no Learning Route, no level check, no Lecture mode, no All lessons).
 * The root stack registers it only while `flags.guestLessonEnabled` is on; it opens at `QuestPlayer` or `GuestLater`
 * (the route's `screen` param).
 */
export default function GuestStackNavigator(): ReactElement {
  // Section 6.4: a run another tab ended (saved, removed or replaced) resets the root (this is the root's `Guest` route).
  useLeaveWhenGuestRunLost(useNavigation());
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
      <Stack.Screen name="QuestPlayer" component={GuestQuestPlayer} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Minigame" component={GuestMinigameRoute} />
      <Stack.Screen name="Results" component={GuestResults} options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="CardDetail" component={GuestCardDetailRoute} options={{ presentation: 'modal' }} />
      <Stack.Screen name="GuestLater" component={GuestLaterScreen} options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="CreateProfile" component={GuestCreateProfileRoute} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PinEntry" component={GuestPinEntryRoute} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
