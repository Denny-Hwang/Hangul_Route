import type { ComponentType, ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * Gives a screen its own safe-area provider. `Screen` and `useSafeAreaInsets`
 * read the nearest provider, and the app-level one measures the full window.
 * A `presentation: 'modal'` screen (iOS page sheet) sits below the status bar
 * already, so inside the app-level provider it would pad the notch twice; its
 * own provider measures the sheet's real frame instead.
 */
export function withOwnSafeArea<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  function WithOwnSafeArea(props: P): ReactElement {
    return (
      <SafeAreaProvider>
        <Component {...props} />
      </SafeAreaProvider>
    );
  }
  WithOwnSafeArea.displayName = `WithOwnSafeArea(${Component.displayName ?? Component.name ?? 'Screen'})`;
  return WithOwnSafeArea;
}
