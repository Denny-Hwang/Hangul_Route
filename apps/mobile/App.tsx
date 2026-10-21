import { Screen, ScreenHeaderSlotContext, TextSizeProvider } from '@hangul-route/design-system';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ErrorBoundary } from 'react-error-boundary';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useDocumentLang } from './src/i18n/use-messages';
import { RootNavigator } from './src/navigation/root';
import type { RootStackParamList } from './src/navigation/types';
import { ConfirmHost } from './src/components/ConfirmHost';
import { LearnerScreenHeader } from './src/components/LearnerScreenHeader';
import { PortraitGuard } from './src/components/PortraitGuard';
import { PwaBanners } from './src/components/PwaBanners';
import { OopsScreen } from './src/screens/system/OopsScreen';
import { installGestureUnlock } from './src/platform/audio';
import { installHistoryBridge } from './src/platform/history-bridge';
import { leaveGrownUpAreaOnClose, watchGrownUpAreaExit } from './src/navigation/grown-up-area-exit';
import { followProfileChanges } from './src/store/profile-store';
import { bindChooserResume } from './src/store/who-chooser';
import { bindGrownUpBackgroundRule } from './src/screens/parent/use-gate-lapse';
import { subscribePwa } from './src/platform/pwa';
import { flushQueue } from './src/platform/telemetry';
import { bindAudioLevelToProfiles } from './src/store/audio-store';
import { bindDeviceGateMarker } from './src/store/device-gate';
import { hydrateLearnerData } from './src/store/bootstrap';
import { followDeviceSettings, useLocaleStore } from './src/store/locale-store';
import { usePwaStore } from './src/store/pwa-store';
import { rederiveAllLocal, registerInboxRefresh } from './src/store/membership-store';
import { useSyncStore } from './src/store/sync-store';
import { setProgressPersistListener } from './src/logic/sync/persist-hook';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

/** The root navigator's container, for the web history bridge (AMENDMENTS-DISPLAY-NAV section 7.2). */
const navigation = createNavigationContainerRef<RootStackParamList>();

export default function App(): React.ReactElement {
  // <html lang> follows the UI locale on web (F-I18N-001 §3.4); no-op on native.
  useDocumentLang();

  const countVisit = usePwaStore((s) => s.hydrateAndCountVisit);
  // The device record's text size (owner items 6 and 7): every design-system text reads it.
  const textSize = useLocaleStore((s) => s.textSize);
  // Profiles and every profile's saved progress are in memory before any
  // screen mounts, so nothing shows — or writes over — an empty record
  // (audit UX-01 / L16). The account and every cached tier load in the same
  // pass, before the first derivation (F-ENT-003 section 3.4).
  const [ready, setReady] = useState(false);
  // The web history bridge runs once the navigator is up, and again after Try again remounts it.
  const stopBridge = useRef<(() => void) | null>(null);
  const startBridge = useCallback(() => {
    stopBridge.current?.();
    const stopHistory = installHistoryBridge(navigation);
    // [OA] OA-D5b (2), CS-1: leaving the Grown-up area, or any learner landing with a session open, closes it (always on).
    const stopAreaExit = watchGrownUpAreaExit(navigation);
    // [OA] OA-D16, CS-14: a session that ends with a Grown-up area page in front leaves it for the PIN screen.
    const stopAreaLeave = leaveGrownUpAreaOnClose(navigation);
    // [OA] Row OA-4a: back after 30 minutes on a shared device, the chooser opens over the screen (flag on only).
    const stopResume = bindChooserResume(navigation);
    stopBridge.current = () => {
      stopHistory();
      stopAreaExit();
      stopAreaLeave();
      stopResume();
    };
  }, []);
  useEffect(
    () => () => {
      stopBridge.current?.();
      stopBridge.current = null;
    },
    [],
  );

  useEffect(() => {
    let live = true;
    // The first gesture anywhere unlocks speech for the page lifetime (F-AUDIO-004 AD8);
    // installed before the navigator renders. A no-op on native.
    const uninstallUnlock = installGestureUnlock();
    // Speech speed follows the active profile's level; game code never passes one.
    const unbindLevel = bindAudioLevelToProfiles();
    // The device gate marker the console's grown-up lock reads (F-APP-001 section 3.9): written once
    // the profiles and the account are in, and again whenever they change; independent of the flag.
    const unbindGate = bindDeviceGateMarker();
    // A language or text size chosen in another tab of this origin (the grown-up pages, All
    // lessons, the presenter) applies here live; a page back in front re-reads the record.
    const unfollow = followDeviceSettings();
    // [OA] OA-D16: 5 minutes in the background end the grown-up session (always on).
    const unbindBackground = bindGrownUpBackgroundRule();
    // [OA] OA-D19: a profile list another tab changed is read again here (always on).
    const unfollowProfiles = followProfileChanges();
    void countVisit();
    // Offline telemetry (F-PWA-001 §3.2): drain on start and when back online.
    void flushQueue();
    // Background progress sync (F-SYNC-002): debounced after every write,
    // and a full pass on start / back-online.
    setProgressPersistListener((learnerId) => useSyncStore.getState().requestSync(learnerId));
    // Plans and memberships arrive through the inbox after each successful sync (F-PLAN-001).
    const offInbox = registerInboxRefresh();
    void hydrateLearnerData()
      .catch(() => undefined)
      .then(async () => {
        if (!live) return;
        setReady(true);
        // A curriculum's horizon moves with the calendar, network or not (F-PLAN-002 section 3.6).
        await rederiveAllLocal().catch(() => undefined);
        void useSyncStore.getState().syncAll();
      });
    // Back in the foreground (possibly on a new day): derive the next days from the cached plans.
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void rederiveAllLocal().catch(() => undefined);
    });
    const off = subscribePwa((event) => {
      if (event === 'back-online') {
        void flushQueue();
        void useSyncStore.getState().syncAll();
      }
    });
    return () => {
      live = false;
      uninstallUnlock();
      unbindLevel();
      unbindGate();
      unfollow();
      unbindBackground();
      unfollowProfiles();
      off();
      offInbox();
      foreground.remove();
      setProgressPersistListener(null);
    };
  }, [countVisit]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <TextSizeProvider step={textSize}>
          {/* Production crash guard — a thrown render error shows OopsScreen
              instead of closing the app; Try again remounts the navigator. */}
          <ErrorBoundary fallbackRender={({ resetErrorBoundary }) => <OopsScreen onRetry={resetErrorBoundary} />}>
            {/* Every screen's top row (Back, its title, the Aa control) comes from its route (AMENDMENTS-DISPLAY-NAV section 7.1). */}
            <ScreenHeaderSlotContext.Provider value={LearnerScreenHeader}>
              <NavigationContainer ref={navigation} onReady={startBridge}>
                {ready ? <RootNavigator /> : <Screen tone="canvas">{null}</Screen>}
                <StatusBar style="dark" />
              </NavigationContainer>
            </ScreenHeaderSlotContext.Provider>
            {/* The web's confirm step in the UI language, in place of the browser's confirm() (section 8). */}
            <ConfirmHost />
            <PwaBanners />
            {/* F-LAYOUT-001 §3.4: a touch phone held sideways is asked, once, to turn upright. */}
            <PortraitGuard />
          </ErrorBoundary>
          </TextSizeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
