import { ClerkProvider } from '@clerk/clerk-expo';
import type { ReactElement } from 'react';
import type { ClerkHost, ClerkHostProviderProps } from './clerk-host';
import { clerkTokens } from './clerk-token-cache.native';

/**
 * F-AUTH-004 sections 6.1 and 6.2 (row NS-2; ND-11, CS-N1): Clerk's Expo provider for the Grown-up area stack on iOS
 * and Android. The one file outside `screens/account` that imports `@clerk/clerk-expo` (the import guard,
 * `account-imports.test.ts`).
 *
 * - Loaded with `import()` by `navigation/grown-up-stack.native.tsx`, only when the native account is on and the
 *   install sweep is complete, so with `EXPO_PUBLIC_NATIVE_SIGNIN` off no Clerk code ever runs (CS-N13).
 * - The key is the one `publishableKeyFor` accepted (never Clerk's own read of the environment); the token cache is
 *   `clerkTokens` (memory unless the device holds a grown-up PIN); Clerk's SDK telemetry is off.
 * - No OAuth flow, no passkey, no email link and no resource cache is set up.
 */
function NativeClerkProvider({ publishableKey, children }: ClerkHostProviderProps): ReactElement {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={clerkTokens.cache} telemetry={false}>
      {children}
    </ClerkProvider>
  );
}

export const clerkHost: ClerkHost = { Provider: NativeClerkProvider };
