/**
 * Which device's steps a help line shows (AMENDMENTS-AUDIO-CANT-HEAR section 3.4, decision D2). Pure: the OS and the
 * user agent are passed in. Native chooses by `Platform.OS`; the web (`os === 'web'`, in every browser) by the user
 * agent, with the same three tests the install guide uses (`logic/pwa/install-guide.ts`), so the two cannot drift.
 */
export type DeviceFamily = 'apple' | 'android' | 'computer';

export interface DeviceFamilyEnv {
  /** `Platform.OS`. */
  os: string;
  /** `navigator.userAgent`, or '' on native. */
  userAgent: string;
  /** `navigator.maxTouchPoints`, or 0 on native. iPadOS asks for the desktop site and sends a Mac user agent. */
  maxTouchPoints: number;
}

export const IOS_UA = /iPhone|iPad|iPod/i;
export const MAC_UA = /Macintosh/i;
export const ANDROID_UA = /Android/i;

/** An iPhone, an iPad, or an iPad asking for the desktop site (a Mac user agent with more than one touch point). */
export function isAppleUserAgent(userAgent: string, maxTouchPoints: number): boolean {
  return IOS_UA.test(userAgent) || (MAC_UA.test(userAgent) && maxTouchPoints > 1);
}

/**
 * Known limit: a large Android tablet whose Chrome asks for the desktop site sends a desktop Linux user agent and gets
 * the computer family (its line is still true there).
 */
export function deviceFamily(env: DeviceFamilyEnv): DeviceFamily {
  if (env.os === 'ios') return 'apple';
  if (env.os === 'android') return 'android';
  if (env.os !== 'web') return 'computer';
  if (isAppleUserAgent(env.userAgent, env.maxTouchPoints)) return 'apple';
  if (ANDROID_UA.test(env.userAgent)) return 'android';
  return 'computer';
}
