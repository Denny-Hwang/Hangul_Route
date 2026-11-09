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
}
