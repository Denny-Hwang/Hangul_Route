import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F-AUTH-004 (row NS-2): the native build's configuration for the grown-up account.
 * - CS-N6 (section 6.4): no URL scheme, no associated domains, no intent filter, no `linking` config: no link,
 *   notification or boot path can open an account screen.
 * - Section 5 and owner step O-4: the iOS privacy manifest declares the email address and the user id, linked to the
 *   grown-up, for app functionality, never tracking.
 * - Section 7.4 (CS-N12): the iOS cover config plugin; expo-screen-capture's screenshot listener permission is blocked
 *   on Android (the app never listens for screenshots; FLAG_SECURE needs no permission).
 */

const APP = join(__dirname, '..', '..', '..');
const app = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8')) as { expo: Record<string, unknown> & { ios: Record<string, unknown>; android: Record<string, unknown>; plugins: unknown[] } };
const expo = app.expo;
const require = createRequire(__filename);
const plugin = require(join(APP, 'plugins', 'with-account-cover.js')) as ((config: Record<string, unknown>) => Record<string, unknown>) & {
  addAccountCover: (contents: string, hex?: string) => string;
  ACCOUNT_COVER_KEY: string;
};

describe('CS-N6: no deep link of any kind', () => {
  it('no scheme, associated domains, intent filters or URL types', () => {
    expect(expo.scheme).toBeUndefined();
    expect(expo.ios.scheme).toBeUndefined();
    expect(expo.android.scheme).toBeUndefined();
    expect(expo.ios.associatedDomains).toBeUndefined();
    expect(expo.android.intentFilters).toBeUndefined();
    expect((expo.ios.infoPlist as Record<string, unknown>).CFBundleURLTypes).toBeUndefined();
  });

  it('the navigation container has no linking config', () => {
    const appSource = readFileSync(join(APP, 'App.tsx'), 'utf8');
    expect(appSource).toMatch(/<NavigationContainer ref=\{navigation\} onReady=\{startBridge\}>/);
    expect(appSource).not.toMatch(/\blinking=/);
  });
});

describe('section 5: the privacy manifest', () => {
  const manifest = expo.ios.privacyManifests as { NSPrivacyTracking: boolean; NSPrivacyCollectedDataTypes: Record<string, unknown>[] };
  const entry = (type: string) => manifest.NSPrivacyCollectedDataTypes.find((t) => t.NSPrivacyCollectedDataType === type);

  it('email address and user id: collected, linked to the grown-up, app functionality, not tracking', () => {
    for (const type of ['NSPrivacyCollectedDataTypeEmailAddress', 'NSPrivacyCollectedDataTypeUserID']) {
      expect(entry(type), type).toEqual({
        NSPrivacyCollectedDataType: type,
        NSPrivacyCollectedDataTypeLinked: true,
        NSPrivacyCollectedDataTypeTracking: false,
        NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
      });
    }
  });

  it('nothing tracks', () => {
    expect(manifest.NSPrivacyTracking).toBe(false);
    for (const t of manifest.NSPrivacyCollectedDataTypes) expect(t.NSPrivacyCollectedDataTypeTracking).toBe(false);
  });
});

describe('section 7.4: capture protection set-up', () => {
  it('the iOS cover plugin is listed; Android blocks the screenshot listener permission', () => {
    expect(expo.plugins).toContain('./plugins/with-account-cover');
    expect(expo.android.blockedPermissions).toEqual(expect.arrayContaining(['android.permission.RECORD_AUDIO', 'android.permission.DETECT_SCREEN_CAPTURE']));
  });
});

/** Expo SDK 52's `AppDelegate.mm` as `expo prebuild` writes it. */
const APP_DELEGATE = `#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"main";

  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

@end
`;

describe('plugins/with-account-cover.js (CS-N12, assumption U7)', () => {
  it('adds the cover class before the app delegate and installs it at launch', () => {
    const out = plugin.addAccountCover(APP_DELEGATE, '#FCF8F1');
    expect(out.indexOf('@implementation HRAccountCover')).toBeLessThan(out.indexOf('@implementation AppDelegate'));
    expect(out).toMatch(/didFinishLaunchingWithOptions:\(NSDictionary \*\)launchOptions\n\{\n {2}\/\/ @generated begin hr-account-cover-install\n {2}\[HRAccountCover install\];/);
    expect(out).toContain('UIApplicationWillResignActiveNotification');
    expect(out).toContain('UIApplicationDidBecomeActiveNotification');
    expect(out).toContain(`static NSString *const HRAccountCoverKey = @"${plugin.ACCOUNT_COVER_KEY}";`);
    expect(plugin.ACCOUNT_COVER_KEY).toBe('hr.accountCover');
    // The flag left on by an earlier run covers nothing later; the cover is hidden from VoiceOver.
    expect(out).toContain('removeObjectForKey:HRAccountCoverKey');
    expect(out).toContain('cover.accessibilityElementsHidden = YES;');
    // The splash colour of app.json, no new colour literal.
    expect(out).toContain('[UIColor colorWithRed:0.9882 green:0.9725 blue:0.9451 alpha:1.0]');
    // No app delegate method is overridden.
    expect(out).not.toMatch(/-\s*\(void\)applicationWillResignActive/);
  });

  it('shows only while the flag is on, and only once', () => {
    const out = plugin.addAccountCover(APP_DELEGATE);
    expect(out).toContain('if (![[NSUserDefaults standardUserDefaults] boolForKey:HRAccountCoverKey]) return;');
    expect(out).toContain('[window viewWithTag:HRAccountCoverTag] != nil) return;');
    expect(out).toContain('[UIColor systemBackgroundColor]');
  });

  it('is idempotent: a second prebuild replaces the block, it never doubles it', () => {
    const once = plugin.addAccountCover(APP_DELEGATE, '#FCF8F1');
    const twice = plugin.addAccountCover(once, '#FCF8F1');
    expect(twice).toBe(once);
    expect(twice.match(/@implementation HRAccountCover/g)).toHaveLength(1);
    expect(twice.match(/\[HRAccountCover install\]/g)).toHaveLength(1);
  });

  it('fails the prebuild when it has nowhere to go, so the protection is never silently missing', () => {
    expect(() => plugin.addAccountCover('@implementation Other\n@end\n')).toThrow(/@implementation AppDelegate/);
    expect(() => plugin.addAccountCover('@implementation AppDelegate\n@end\n')).toThrow(/didFinishLaunchingWithOptions/);
  });

  it('registers an iOS app delegate mod that writes the Objective-C delegate and refuses a Swift one', async () => {
    const config = plugin({ name: 'Hangul Route', slug: 'hangul-route', splash: { backgroundColor: '#FCF8F1' } });
    type Mod = (c: Record<string, unknown>) => Promise<{ modResults: { contents: string } }>;
    const mod = (config.mods as { ios: { appDelegate: Mod } }).ios.appDelegate;
    const done = await mod({ ...config, modRequest: {}, modResults: { language: 'objcpp', contents: APP_DELEGATE, path: 'AppDelegate.mm' } });
    expect(done.modResults.contents).toBe(plugin.addAccountCover(APP_DELEGATE, '#FCF8F1'));
    await expect(mod({ ...config, modRequest: {}, modResults: { language: 'swift', contents: '', path: 'AppDelegate.swift' } })).rejects.toThrow(/swift/);
  });
});
