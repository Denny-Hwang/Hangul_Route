import { afterEach, describe, expect, it, vi } from 'vitest';
import { nativeSignInSwitch } from '../../logic/account/native-account';
import { nativeSignInConfig } from '../native-signin';

/**
 * F-AUTH-004 sections 6.1 and 16.1 (row NS-2; CS-N13): the native build's values for the grown-up account, read by
 * their literal `EXPO_PUBLIC_*` names, and `EXPO_PUBLIC_NATIVE_SIGNIN` read with exactly `parseKillSwitch`'s words.
 */

const LIVE = `pk_live_${btoa('clerk.hangulroute.com$')}`;
const TEST = `pk_test_${btoa('neat-gull-12.clerk.accounts.dev$')}`;

function stub(env: { os?: string; flag?: string; key?: string; nodeEnv?: string }): void {
  vi.stubEnv('EXPO_OS', env.os);
  vi.stubEnv('EXPO_PUBLIC_NATIVE_SIGNIN', env.flag);
  vi.stubEnv('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY', env.key);
  vi.stubEnv('NODE_ENV', env.nodeEnv ?? 'production');
}

afterEach(() => {
  vi.unstubAllEnvs();
  delete (globalThis as { __DEV__?: unknown }).__DEV__;
});

describe('nativeSignInConfig', () => {
  it('off by default: the switch unset (CS-N13)', () => {
    stub({ os: 'ios', key: LIVE });
    expect(nativeSignInConfig()).toEqual({ flag: false, publishableKey: null, enabled: false });
  });

  it('on with the switch, a live key, on iOS or Android', () => {
    stub({ os: 'ios', flag: 'true', key: LIVE });
    expect(nativeSignInConfig()).toEqual({ flag: true, publishableKey: LIVE, enabled: true });
    stub({ os: 'android', flag: ' ON ', key: LIVE });
    expect(nativeSignInConfig().enabled).toBe(true);
  });

  it('never on the web, whatever the switch and the key', () => {
    stub({ os: 'web', flag: 'true', key: LIVE });
    expect(nativeSignInConfig()).toEqual({ flag: true, publishableKey: null, enabled: false });
  });

  it('a test key: refused in a release build, taken in a development build', () => {
    stub({ os: 'ios', flag: '1', key: TEST });
    expect(nativeSignInConfig().enabled).toBe(false);
    (globalThis as { __DEV__?: unknown }).__DEV__ = true;
    expect(nativeSignInConfig()).toEqual({ flag: true, publishableKey: TEST, enabled: true });
    (globalThis as { __DEV__?: unknown }).__DEV__ = false;
    expect(nativeSignInConfig().enabled).toBe(false);
  });

  it('outside React Native, a non-production NODE_ENV is a development build', () => {
    stub({ os: 'android', flag: 'yes', key: TEST, nodeEnv: 'test' });
    expect(nativeSignInConfig().enabled).toBe(true);
  });

  it('a secret key is ignored', () => {
    stub({ os: 'ios', flag: 'true', key: `sk_live_${btoa('clerk.hangulroute.com$')}` });
    expect(nativeSignInConfig()).toEqual({ flag: true, publishableKey: null, enabled: false });
  });
});

describe('the switch reads parseKillSwitch’s words (config/flags.ts)', () => {
  it('every word reads the same as a flags.ts kill switch with the same default', async () => {
    const words = [undefined, '', 'true', '1', 'on', 'yes', ' ON ', 'Yes', 'false', '0', 'off', 'no', ' OFF ', 'enabled', 'disabled', 'maybe'];
    for (const word of words) {
      if (word === undefined) vi.stubEnv('EXPO_PUBLIC_BIOMETRIC_SHORTCUT', undefined);
      else vi.stubEnv('EXPO_PUBLIC_BIOMETRIC_SHORTCUT', word);
      vi.resetModules();
      const { flags } = await import('../flags');
      // `biometricShortcutEnabled` is a parseKillSwitch flag whose launch default is on.
      expect(nativeSignInSwitch(word, true), JSON.stringify(word)).toBe(flags.biometricShortcutEnabled);
    }
  }, 60_000);

  it('the module reads the literal names, so Metro inlines them', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(__dirname, '../native-signin.ts'), 'utf8');
    expect(src).toContain('process.env.EXPO_PUBLIC_NATIVE_SIGNIN');
    expect(src).toContain('process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
    expect(src).toContain('process.env.EXPO_OS');
  });
});
