/**
 * Install-guide decisions — F-PWA-001 §3.1, §3.3. Pure: every input is
 * passed in so the rules are testable without a browser.
 */
export type InstallGuideVariant = 'ios-safari' | 'prompt' | 'desktop-hint' | 'in-app-browser' | 'none';

export interface InstallEnv {
  /** navigator.userAgent, or '' on native. */
  userAgent: string;
  /** display-mode: standalone or navigator.standalone (already installed). */
  standalone: boolean;
  /** A `beforeinstallprompt` event was captured by the shell. */
  hasPromptEvent: boolean;
  /** true only in the web build. */
  isWeb: boolean;
}

const IN_APP_TOKENS = /FBAN|FBAV|Instagram|KAKAOTALK|Line\/|Twitter|Snapchat/i;
const IOS = /iPhone|iPad|iPod/i;
const ANDROID = /Android/i;
const MOBILE = /Mobi|Android|iPhone|iPad|iPod/i;

export function installGuideVariant(env: InstallEnv): InstallGuideVariant {
  if (!env.isWeb || env.standalone || !env.userAgent) return 'none';
  if (IN_APP_TOKENS.test(env.userAgent)) return 'in-app-browser';
  if (env.hasPromptEvent) return 'prompt';
  if (IOS.test(env.userAgent)) return 'ios-safari';
  if (ANDROID.test(env.userAgent) || !MOBILE.test(env.userAgent)) return 'desktop-hint';
  return 'none';
}

export const INSTALL_GUIDE_MIN_VISITS = 3;
export const INSTALL_GUIDE_SNOOZE_VISITS = 5;

export interface InstallGuideState {
  variant: InstallGuideVariant;
  /** Service worker controls the page → the app is cached for offline. */
  offlineReady: boolean;
  visits: number;
  /** Visit number until which the guide stays hidden after a dismissal. */
  snoozedUntilVisit: number;
  installed: boolean;
  /** A parent asked for it from settings — bypasses the visit rules. */
  forced: boolean;
}

export function shouldShowInstallGuide(s: InstallGuideState): boolean {
  if (s.variant === 'none' || s.installed) return false;
  if (s.forced) return true;
  if (!s.offlineReady) return false;
  if (s.visits < INSTALL_GUIDE_MIN_VISITS) return false;
  return s.visits > s.snoozedUntilVisit;
}

/** Called on dismiss: hide for the next N opens. */
export function snoozeUntil(currentVisit: number): number {
  return currentVisit + INSTALL_GUIDE_SNOOZE_VISITS;
}
