import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/root';
import { PwaBanners } from './src/components/PwaBanners';
import { OopsScreen } from './src/screens/system/OopsScreen';
import { subscribePwa } from './src/platform/pwa';
import { flushQueue } from './src/platform/telemetry';
import { useAccountStore } from './src/store/account-store';
import { useProfileStore } from './src/store/profile-store';
import { usePwaStore } from './src/store/pwa-store';
import { useSyncStore } from './src/store/sync-store';
import { setProgressPersistListener } from './src/logic/sync/persist-hook';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

export default function App(): React.ReactElement {
  const hydrate = useProfileStore((s) => s.hydrate);
  const hydrateAccount = useAccountStore((s) => s.hydrate);

  const countVisit = usePwaStore((s) => s.hydrateAndCountVisit);

  useEffect(() => {
    void hydrate();
    void hydrateAccount();
    void countVisit();
    // Offline telemetry (F-PWA-001 §3.2): drain on start and when back online.
    void flushQueue();
    // Background progress sync (F-SYNC-002): debounced after every write,
    // and a full pass on start / back-online.
    setProgressPersistListener((learnerId) => useSyncStore.getState().requestSync(learnerId));
    void hydrate().then(() => useSyncStore.getState().syncAll());
    const off = subscribePwa((event) => {
      if (event === 'back-online') {
        void flushQueue();
        void useSyncStore.getState().syncAll();
      }
    });
    return () => {
      off();
      setProgressPersistListener(null);
    };
  }, [hydrate, hydrateAccount, countVisit]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          {/* Production crash guard — a thrown render error shows OopsScreen
              instead of closing the app; Try again remounts the navigator. */}
          <ErrorBoundary fallbackRender={({ resetErrorBoundary }) => <OopsScreen onRetry={resetErrorBoundary} />}>
            <NavigationContainer>
              <RootNavigator />
              <StatusBar style="dark" />
            </NavigationContainer>
            <PwaBanners />
          </ErrorBoundary>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
