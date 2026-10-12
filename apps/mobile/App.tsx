import { Screen } from '@hangul-route/design-system';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { ErrorBoundary } from 'react-error-boundary';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useDocumentLang } from './src/i18n/use-messages';
import { RootNavigator } from './src/navigation/root';
import { PortraitGuard } from './src/components/PortraitGuard';
import { PwaBanners } from './src/components/PwaBanners';
import { OopsScreen } from './src/screens/system/OopsScreen';
import { installGestureUnlock } from './src/platform/audio';
import { subscribePwa } from './src/platform/pwa';
import { flushQueue } from './src/platform/telemetry';
import { bindAudioLevelToProfiles } from './src/store/audio-store';
import { hydrateLearnerData } from './src/store/bootstrap';
import { usePwaStore } from './src/store/pwa-store';
import { rederiveAllLocal, registerInboxRefresh } from './src/store/membership-store';
import { useSyncStore } from './src/store/sync-store';
import { setProgressPersistListener } from './src/logic/sync/persist-hook';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

export default function App(): React.ReactElement {
  // <html lang> follows the UI locale on web (F-I18N-001 §3.4); no-op on native.
  useDocumentLang();

  const countVisit = usePwaStore((s) => s.hydrateAndCountVisit);
  // Profiles and every profile's saved progress are in memory before any
  // screen mounts, so nothing shows — or writes over — an empty record
  // (audit UX-01 / L16). The account and every cached tier load in the same
  // pass, before the first derivation (F-ENT-003 section 3.4).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    // The first gesture anywhere unlocks speech for the page lifetime (F-AUDIO-004 AD8);
    // installed before the navigator renders. A no-op on native.
    const uninstallUnlock = installGestureUnlock();
    // Speech speed follows the active profile's level; game code never passes one.
    const unbindLevel = bindAudioLevelToProfiles();
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
          {/* Production crash guard — a thrown render error shows OopsScreen
              instead of closing the app; Try again remounts the navigator. */}
          <ErrorBoundary fallbackRender={({ resetErrorBoundary }) => <OopsScreen onRetry={resetErrorBoundary} />}>
            <NavigationContainer>
              {ready ? <RootNavigator /> : <Screen tone="canvas">{null}</Screen>}
              <StatusBar style="dark" />
            </NavigationContainer>
            <PwaBanners />
            {/* F-LAYOUT-001 §3.4: a touch phone held sideways is asked, once, to turn upright. */}
            <PortraitGuard />
          </ErrorBoundary>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
