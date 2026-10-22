import type { BootIntent } from '../logic/shell/boot-intent';

/**
 * Native stub of the root chooser (F-BROWSE-001 section 4.14, OD-10; F-APP-001 OD-6): native
 * builds have one root, the learner app, no address to read a boot intent from and no
 * `sessionStorage` to clear. The web variant is `app-root.web.ts`.
 */
export type AppRoot = 'presenter' | 'browse' | 'grown-up-bounce' | 'app';

export function pickRoot(_location?: { pathname: string }): AppRoot {
  return 'app';
}

export function bootRoot(): AppRoot {
  return 'app';
}

export function peekBootIntent(): BootIntent | null {
  return null;
}

export function consumeBootIntent(): void {
  // No intent on native.
}

/** [OA] No sign-in reset ticket on native (row OA-6). */
export function takeBootPinResetTicket(): string | null {
  return null;
}
