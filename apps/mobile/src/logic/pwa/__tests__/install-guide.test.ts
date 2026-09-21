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

const env = (userAgent: string, extra: Partial<Parameters<typeof installGuideVariant>[0]> = {}) => ({
  userAgent,
  standalone: false,
  hasPromptEvent: false,
  isWeb: true,
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
