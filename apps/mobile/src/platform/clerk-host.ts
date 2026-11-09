import type { ComponentType, ReactNode } from 'react';

/**
 * F-AUTH-004 section 6.1 (row NS-2): what the Grown-up area stack needs of Clerk. `platform/clerk.native.tsx` gives
 * Clerk's Expo provider on iOS and Android; `platform/clerk.tsx` (the web and the tests) gives none, so nothing of
 * Clerk's Expo SDK can be reached from a web entry.
 */
export interface ClerkHostProviderProps {
  /** A key `publishableKeyFor` accepted for this build. */
  publishableKey: string;
  children: ReactNode;
}

export interface ClerkHost {
  /** Clerk's provider for the Grown-up area stack, or null where the native account does not exist. */
  Provider: ComponentType<ClerkHostProviderProps> | null;
  /**
   * Signs out of Clerk's in-memory session, if a provider was mounted in this run. Clerk's Expo SDK keeps one instance
   * for the whole run, so unmounting the provider is not a sign-out: this is. Resolves to whether Clerk confirmed it
   * (offline, Clerk's local state may stay; the account rules then must not trust it, ND-9). Never throws.
   */
  endSession: () => Promise<boolean>;
}
