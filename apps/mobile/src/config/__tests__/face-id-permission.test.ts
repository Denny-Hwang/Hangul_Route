import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.6 (row OA-9): the Xcode build needs `NSFaceIDUsageDescription`, or
 * expo-secure-store refuses to write an item with `requireAuthentication` on iOS. It is set through the
 * expo-secure-store config plugin (`faceIDPermission`), so every `expo prebuild` for Xcode carries it, with es and ko
 * `InfoPlist.strings` values from `expo.locales`. One English source only: no second plugin or `infoPlist` entry
 * may set another string (the legacy expo-local-authentication plugin only fills the key when it is missing).
 */

const root = join(__dirname, '../../..');
const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')) as {
  expo: { plugins: (string | [string, Record<string, unknown>])[]; locales?: Record<string, string>; ios: { infoPlist: Record<string, unknown> } };
};

const EN = 'Face ID opens the grown-up area when a grown-up turns it on.';
const ES = 'Face ID abre la zona de adultos cuando un adulto lo activa.';
const KO = '어른이 켜 두면 Face ID로 어른 공간을 열어요.';

const pluginOptions = (name: string) => {
  const entry = app.expo.plugins.find((p) => (typeof p === 'string' ? p : p[0]) === name);
  return entry === undefined ? undefined : typeof entry === 'string' ? {} : entry[1];
};

describe('[OA] Face ID permission string (Info.plist)', () => {
  it('the expo-secure-store plugin sets the English string', () => {
    expect(pluginOptions('expo-secure-store')).toEqual({ faceIDPermission: EN });
  });

  it('nothing else sets another string', () => {
    expect(app.expo.ios.infoPlist.NSFaceIDUsageDescription).toBeUndefined();
    const la = pluginOptions('expo-local-authentication');
    expect(la === undefined || la.faceIDPermission === undefined || la.faceIDPermission === EN).toBe(true);
  });

  it('es and ko InfoPlist.strings values come from expo.locales, and iOS may use them', () => {
    expect(app.expo.locales).toEqual({ es: './locales/es.json', ko: './locales/ko.json' });
    const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as Record<string, string>;
    expect(read('locales/es.json')).toEqual({ NSFaceIDUsageDescription: ES });
    expect(read('locales/ko.json')).toEqual({ NSFaceIDUsageDescription: KO });
    expect(app.expo.ios.infoPlist.CFBundleAllowMixedLocalizations).toBe(true);
  });

  it('the strings carry no quote that would break InfoPlist.strings, and no emoji', () => {
    for (const s of [EN, ES, KO]) {
      expect(s).not.toMatch(/["\\]/);
      expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
