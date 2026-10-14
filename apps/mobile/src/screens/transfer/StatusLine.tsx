import React from 'react';
import { View } from 'react-native';

/**
 * A one-off polite status line ("Moved.", "Join your new class again.", "Request sent…"): `role="status"` with
 * `aria-live` on the web and a polite live region on Android, as `PreviewFrame` does. No invalid native role.
 */
export function StatusLine({ children, testID }: { children: React.ReactNode; testID?: string }): React.ReactElement {
  return (
    <View role="status" aria-live="polite" accessibilityLiveRegion="polite" testID={testID}>
      {children}
    </View>
  );
}
