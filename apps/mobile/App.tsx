import { Screen } from '@hangul-route/design-system';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/root';
import { PwaBanners } from './src/components/PwaBanners';
import { OopsScreen } from './src/screens/system/OopsScreen';
import { subscribePwa } from './src/platform/pwa';
import { flushQueue } from './src/platform/telemetry';
import { useAccountStore } from './src/store/account-store';
import { hydrateLearnerData } from './src/store/bootstrap';
import { usePwaStore } from './src/store/pwa-store';
import { registerInboxRefresh } from './src/store/membership-store';
import { useSyncStore } from './src/store/sync-store';
import { setProgressPersistListener } from './src/logic/sync/persist-hook';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

export default function App(): React.ReactElement {
  const hydrateAccount = useAccountStore((s) => s.hydrate);

  const countVisit = usePwaStore((s) => s.hydrateAndCountVisit);
  // Profiles and every profile's saved progress are in memory before any
  // screen mounts, so nothing shows — or writes over — an empty record
  // (audit UX-01 / L16).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    void hydrateAccount();
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
      .then(() => {
        if (!live) return;
        setReady(true);
        void useSyncStore.getState().syncAll();
      });
    const off = subscribePwa((event) => {
      if (event === 'back-online') {
        void flushQueue();
        void useSyncStore.getState().syncAll();
      }
    });
    return () => {
      live = false;
      off();
      offInbox();
      setProgressPersistListener(null);
    };
  }, [hydrateAccount, countVisit]);

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
          </ErrorBoundary>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
