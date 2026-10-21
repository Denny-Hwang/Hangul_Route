/**
 * Install-guide decisions — F-PWA-001 §3.1, §3.3. Pure: every input is
 * passed in so the rules are testable without a browser.
 */
export type InstallGuideVariant = 'ios-safari' | 'mac-safari' | 'prompt' | 'desktop-hint' | 'in-app-browser' | 'none';

export interface InstallEnv {
  /** navigator.userAgent, or '' on native. */
  userAgent: string;
  /** display-mode: standalone or navigator.standalone (already installed). */
  standalone: boolean;
  /** A `beforeinstallprompt` event was captured by the shell. */
  hasPromptEvent: boolean;
  /** true only in the web build. */
  isWeb: boolean;
  /**
   * navigator.maxTouchPoints, or 0 on native. iPadOS Safari asks for the desktop site and sends a Mac user agent;
   * a Mac reports 0 or 1 touch points and an iPad more, so this tells them apart.
   */
  maxTouchPoints: number;
}

/** In-app browsers, which cannot install a web app: Facebook, Instagram, KakaoTalk, LINE, X, Snapchat, Naver, Daum, WeChat, TikTok. */
const IN_APP_TOKENS = /FBAN|FBAV|Instagram|KAKAOTALK|Line\/|Twitter|Snapchat|NAVER\(inapp|DaumApps|MicroMessenger|BytedanceWebview|musical_ly/i;
const IOS = /iPhone|iPad|iPod/i;
const MAC = /Macintosh/i;
const ANDROID = /Android/i;
const MOBILE = /Mobi|Android|iPhone|iPad|iPod/i;
const FIREFOX = /Firefox\//i;
/** Safari names itself `Version/… Safari/`; Chrome, Edge, Opera and Firefox on a Mac add their own token. */
const NOT_SAFARI = /Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Firefox/i;
const SAFARI = /Version\/(\d+)[\d.]*.*Safari\//i;
/** Add to Dock arrived in Safari 17 (macOS Sonoma). */
const MAC_SAFARI_MIN_MAJOR = 17;

export function installGuideVariant(env: InstallEnv): InstallGuideVariant {
  if (!env.isWeb || env.standalone || !env.userAgent) return 'none';
  const ua = env.userAgent;
  if (IN_APP_TOKENS.test(ua)) return 'in-app-browser';
  if (env.hasPromptEvent) return 'prompt';
  if (IOS.test(ua) || (MAC.test(ua) && env.maxTouchPoints > 1)) return 'ios-safari';
  if (ANDROID.test(ua)) return 'desktop-hint';
  if (MOBILE.test(ua)) return 'none';
  // Desktop Firefox has no way to install a web app: a hint would point at a menu item that is not there.
  if (FIREFOX.test(ua)) return 'none';
  // Safari 17 on macOS Sonoma and later: File menu, then Add to Dock. An older Safari for Mac has no such menu item
  // and no other way to install a web app, so it gets nothing, as desktop Firefox does.
  const safari = MAC.test(ua) && !NOT_SAFARI.test(ua) ? SAFARI.exec(ua) : null;
  if (safari) return Number(safari[1]) >= MAC_SAFARI_MIN_MAJOR ? 'mac-safari' : 'none';
  return 'desktop-hint';
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
