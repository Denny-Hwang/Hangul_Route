import type { ClerkHost } from './clerk-host';

/**
 * F-AUTH-004 section 6.1 (row NS-2): the web build and the tests. The web's grown-up area is the console, which has
 * its own Clerk (F-AUTH-002); the learner bundle never carries Clerk's Expo SDK. iOS and Android resolve
 * `clerk.native.tsx` instead.
 */
export const clerkHost: ClerkHost = { Provider: null, endSession: async () => true };
