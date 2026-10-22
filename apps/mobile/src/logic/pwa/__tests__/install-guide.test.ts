import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INSTALL_GUIDE_MIN_VISITS,
  INSTALL_GUIDE_SNOOZE_VISITS,
  installGuideVariant,
  shouldShowInstallGuide,
  snoozeUntil,
} from '../install-guide';

const IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const DESKTOP_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const INSTAGRAM = `${IOS_SAFARI} Instagram 300.0`;
/** iPadOS 13+ Safari asks for the desktop site: the user agent reads as a Mac; only the touch points tell them apart. */
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
/** Safari 16 (macOS Ventura and older) has no Add to Dock. */
const MAC_SAFARI_16 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15';
const MAC_SAFARI_18 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const MAC_EDGE = `${MAC_CHROME} Edg/126.0`;
const MAC_FIREFOX = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:127.0) Gecko/20100101 Firefox/127.0';
const WINDOWS_FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0';
const LINUX_FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0';
const ANDROID_FIREFOX = 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0';
/** In-app browsers of the apps families share links from: Naver, Daum / Kakao, WeChat, TikTok (two tokens). */
const NAVER = `${ANDROID_CHROME} NAVER(inapp; search; 2000; 12.6.3)`;
const DAUM = `${IOS_SAFARI} DaumApps/7.12.0`;
const WECHAT = `${ANDROID_CHROME} MicroMessenger/8.0.49.2600`;
const TIKTOK_WEBVIEW = `${ANDROID_CHROME} BytedanceWebview/d8a21c6`;
const TIKTOK_IOS = `${IOS_SAFARI} musical_ly_34.1.0 JsSdk/2.0`;

const env = (userAgent: string, extra: Partial<Parameters<typeof installGuideVariant>[0]> = {}) => ({
  userAgent,
  standalone: false,
  hasPromptEvent: false,
  isWeb: true,
  maxTouchPoints: 0,
  ...extra,
});

describe('installGuideVariant', () => {
  it('is none on native, when installed, or with no user agent', () => {
    expect(installGuideVariant(env(ANDROID_CHROME, { isWeb: false }))).toBe('none');
    expect(installGuideVariant(env(IOS_SAFARI, { standalone: true }))).toBe('none');
    expect(installGuideVariant(env(''))).toBe('none');
  });
  it('detects in-app browsers before anything else', () => {
    expect(installGuideVariant(env(INSTAGRAM, { hasPromptEvent: true }))).toBe('in-app-browser');
  });
  it('uses the native prompt whenever it was captured', () => {
    expect(installGuideVariant(env(ANDROID_CHROME, { hasPromptEvent: true }))).toBe('prompt');
    expect(installGuideVariant(env(DESKTOP_CHROME, { hasPromptEvent: true }))).toBe('prompt');
  });
  it('shows the share-sheet pictogram on iOS Safari', () => {
    expect(installGuideVariant(env(IOS_SAFARI))).toBe('ios-safari');
  });
  it('falls back to the address-bar hint on Android without a prompt and on desktop', () => {
    expect(installGuideVariant(env(ANDROID_CHROME))).toBe('desktop-hint');
    expect(installGuideVariant(env(DESKTOP_CHROME))).toBe('desktop-hint');
    expect(installGuideVariant(env(MAC_CHROME))).toBe('desktop-hint');
    expect(installGuideVariant(env(MAC_EDGE))).toBe('desktop-hint');
  });
  it('treats an iPad that reads as a Mac (more than one touch point) as iOS', () => {
    expect(installGuideVariant(env(MAC_SAFARI, { maxTouchPoints: 5 }))).toBe('ios-safari');
    // One touch point is not an iPad: a Mac with a touch bar or a mouse reports 0 or 1.
    expect(installGuideVariant(env(MAC_SAFARI, { maxTouchPoints: 1 }))).toBe('mac-safari');
  });
  it('shows File menu, then Add to Dock, on Safari for Mac', () => {
    expect(installGuideVariant(env(MAC_SAFARI))).toBe('mac-safari');
    expect(installGuideVariant(env(MAC_SAFARI_18))).toBe('mac-safari');
    // Chrome and Edge on a Mac name Safari in their user agent too: they keep the browser-menu hint.
    expect(installGuideVariant(env(MAC_CHROME))).not.toBe('mac-safari');
  });
  it('offers nothing on Safari 16 for Mac, which has no Add to Dock', () => {
    expect(installGuideVariant(env(MAC_SAFARI_16))).toBe('none');
    // An iPad on iPadOS 16 still gets the iOS steps: Share, then Add to Home Screen.
    expect(installGuideVariant(env(MAC_SAFARI_16, { maxTouchPoints: 5 }))).toBe('ios-safari');
  });
  it('offers nothing on desktop Firefox, which cannot install a web app', () => {
    expect(installGuideVariant(env(MAC_FIREFOX))).toBe('none');
    expect(installGuideVariant(env(WINDOWS_FIREFOX))).toBe('none');
    expect(installGuideVariant(env(LINUX_FIREFOX))).toBe('none');
    // Firefox for Android adds to the home screen from its menu: the hint stays.
    expect(installGuideVariant(env(ANDROID_FIREFOX))).toBe('desktop-hint');
  });
  it.each([
    ['Naver', NAVER],
    ['Daum', DAUM],
    ['WeChat', WECHAT],
    ['TikTok web view', TIKTOK_WEBVIEW],
    ['TikTok on iOS', TIKTOK_IOS],
  ])('detects the %s in-app browser', (_name, userAgent) => {
    expect(installGuideVariant(env(userAgent, { hasPromptEvent: true }))).toBe('in-app-browser');
  });
});

describe('shouldShowInstallGuide', () => {
  const base = {
    variant: 'ios-safari' as const,
    offlineReady: true,
    visits: INSTALL_GUIDE_MIN_VISITS,
    snoozedUntilVisit: 0,
    installed: false,
    forced: false,
  };
  it('shows on the third open once the app is cached', () => {
    expect(shouldShowInstallGuide(base)).toBe(true);
    expect(shouldShowInstallGuide({ ...base, visits: 2 })).toBe(false);
    expect(shouldShowInstallGuide({ ...base, offlineReady: false })).toBe(false);
  });
  it('never shows when installed or when there is no variant', () => {
    expect(shouldShowInstallGuide({ ...base, installed: true, forced: true })).toBe(false);
    expect(shouldShowInstallGuide({ ...base, variant: 'none', forced: true })).toBe(false);
  });
  it('a parent can force it from settings regardless of visits', () => {
    expect(shouldShowInstallGuide({ ...base, visits: 1, offlineReady: false, forced: true })).toBe(true);
  });
  it('snoozes for five opens after a dismissal', () => {
    const until = snoozeUntil(3);
    expect(until).toBe(3 + INSTALL_GUIDE_SNOOZE_VISITS);
    expect(shouldShowInstallGuide({ ...base, visits: 8, snoozedUntilVisit: until })).toBe(false);
    expect(shouldShowInstallGuide({ ...base, visits: 9, snoozedUntilVisit: until })).toBe(true);
  });
});

describe('the sheet source', () => {
  // The mobile vitest config cannot render React Native, so this reads the source. The e2e locator handlers close
  // the guide by this test id in every UI language; dropping it would only show there as a handler timeout.
  it('keeps the test id on Not now, which dismisses the guide', () => {
    const sheet = readFileSync(join(__dirname, '..', '..', '..', 'components', 'InstallGuideSheet.tsx'), 'utf8');
    expect(sheet).toMatch(/<Button testID="install-guide-not-now"[^>]*onPress=\{dismiss\}/);
  });
});
