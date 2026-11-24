import { describe, expect, it } from 'vitest';
import { deviceFamily, type DeviceFamily } from '../device-family';

/** AMENDMENTS-AUDIO-CANT-HEAR section 3.4 and test 5: which device's line the help shows. */

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const ANDROID_TABLET_DESKTOP_SITE = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0';
const CHROMEOS = 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

describe('deviceFamily, native', () => {
  it.each<[string, DeviceFamily]>([
    ['ios', 'apple'],
    ['android', 'android'],
    ['windows', 'computer'],
    ['macos', 'computer'],
    ['', 'computer'],
  ])('os %s gives %s whatever the user agent', (os, family) => {
    expect(deviceFamily({ os, userAgent: '', maxTouchPoints: 0 })).toBe(family);
    // A native os never reads the user agent.
    if (os === 'ios' || os === 'android') expect(deviceFamily({ os, userAgent: WINDOWS, maxTouchPoints: 0 })).toBe(family);
  });
});

describe('deviceFamily, web (Platform.OS is "web" in every browser)', () => {
  it.each<[string, string, number, DeviceFamily]>([
    ['an iPhone', IPHONE, 5, 'apple'],
    ['an iPad (the iPad token)', IPAD, 5, 'apple'],
    ['an iPad asking for the desktop site (Macintosh, 5 touch points)', MAC, 5, 'apple'],
    ['a Mac with 0 touch points', MAC, 0, 'computer'],
    ['a Mac with 1 touch point', MAC, 1, 'computer'],
    ['an Android phone', ANDROID_PHONE, 5, 'android'],
    ['an Android tablet', ANDROID_TABLET, 10, 'android'],
    ['an Android tablet asking for the desktop site (the known limit: computer)', ANDROID_TABLET_DESKTOP_SITE, 10, 'computer'],
    ['Windows', WINDOWS, 0, 'computer'],
    ['Linux', LINUX, 0, 'computer'],
    ['ChromeOS', CHROMEOS, 0, 'computer'],
    ['an empty user agent', '', 0, 'computer'],
  ])('%s', (_name, userAgent, maxTouchPoints, family) => {
    expect(deviceFamily({ os: 'web', userAgent, maxTouchPoints })).toBe(family);
  });
});
