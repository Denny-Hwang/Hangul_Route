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
import { useAccountStore } from './src/store/account-store';
import { useProfileStore } from './src/store/profile-store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

export default function App(): React.ReactElement {
  const hydrate = useProfileStore((s) => s.hydrate);
  const hydrateAccount = useAccountStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
    void hydrateAccount();
  }, [hydrate, hydrateAccount]);

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
