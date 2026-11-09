import type { ReactElement } from 'react';
import type { EntryNavigation } from './account-entries';

/**
 * F-AUTH-004 section 7.1 (row NS-4): Welcome's Sign in as a grown-up exists on iOS and Android only
 * (`WelcomeAccountRow.native.tsx`). This twin is what the web build's import walk and the type checker resolve: Welcome
 * reaches the native row only through an `EXPO_OS` test the web build folds away. It draws nothing and imports types only.
 */
export function WelcomeAccountRow(_props: { navigation: EntryNavigation | undefined }): ReactElement | null {
  return null;
}
