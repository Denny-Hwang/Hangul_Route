import { createContext } from 'react';

/**
 * F-AUTH-004 sections 6.1, 6.6 and 7.4 (rows NS-2, NS-3): what the native Grown-up area stack
 * (`navigation/grown-up-stack.native.tsx`) gives the account screens and the account card. The stack is the one module
 * that may import Clerk's host and token cache (the import guard), so the screens reach them only through this:
 *
 * - `ClerkMountContext`: whether Clerk's provider is above the area's screens (`pending`, `off`, `ready`); a screen
 *   reads it before it calls a Clerk hook.
 * - `AccountHostContext`: the provider state again, with the session's ends: Clerk's own sign-out (`endSession`),
 *   the deletion of every Clerk item (`wipeTokens`), and `retry`, which asks the area to decide its Clerk provider again
 *   (the account card's Try again after a visit that started without it).
 *
 * Outside the stack (the web, the tests, the native account off) the defaults hold: no provider and nothing to end.
 */

export type ClerkMountState = 'pending' | 'off' | 'ready';

export const ClerkMountContext = createContext<ClerkMountState>('off');

export interface AccountHost {
  mount: ClerkMountState;
  /** Clerk's sign-out of its in-memory session (resolves false when it could not reach Clerk). Never throws. */
  endSession: () => Promise<boolean>;
  /** Deletes every Clerk item, kept and in memory; true when every delete answered. */
  wipeTokens: () => Promise<boolean>;
  /** Decides the area's Clerk provider again (only while it is `off`). */
  retry: () => void;
}

export const OFF_HOST: AccountHost = {
  mount: 'off',
  endSession: async () => true,
  wipeTokens: async () => true,
  retry: () => undefined,
};

export const AccountHostContext = createContext<AccountHost>(OFF_HOST);
