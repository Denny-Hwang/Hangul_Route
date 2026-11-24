import { beforeEach, describe, expect, it, vi } from 'vitest';

/** `currentDeviceFamily()` reads `Platform.OS` and `installEnv()` (AMENDMENTS-AUDIO-CANT-HEAR section 3.4, test 9). */

const env = vi.hoisted(() => ({ os: 'web', userAgent: '', maxTouchPoints: 0 }));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return env.os;
    },
  },
}));
vi.mock('../pwa', () => ({
  installEnv: () => ({ userAgent: env.userAgent, maxTouchPoints: env.maxTouchPoints, standalone: false, hasPromptEvent: false, isWeb: env.os === 'web' }),
}));

import { currentDeviceFamily } from '../device-family';

beforeEach(() => {
  env.os = 'web';
  env.userAgent = '';
  env.maxTouchPoints = 0;
});

describe('currentDeviceFamily', () => {
  it('native ios is apple and native android is android, with no user agent', () => {
    env.os = 'ios';
    expect(currentDeviceFamily()).toBe('apple');
    env.os = 'android';
    expect(currentDeviceFamily()).toBe('android');
  });

  it('the web reads the user agent: an iPhone is apple, a Windows browser is computer', () => {
    env.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
    env.maxTouchPoints = 5;
    expect(currentDeviceFamily()).toBe('apple');
    env.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';
    env.maxTouchPoints = 0;
    expect(currentDeviceFamily()).toBe('computer');
  });

  it('the web reads an Android user agent as android', () => {
    env.userAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36';
    expect(currentDeviceFamily()).toBe('android');
  });
});
