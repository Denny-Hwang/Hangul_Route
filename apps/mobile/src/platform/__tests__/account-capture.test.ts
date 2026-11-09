import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** F-AUTH-004 section 7.4 (row NS-4; CS-N12): capture protection while an account screen is focused. */

const calls = vi.hoisted(() => ({ list: [] as string[], os: 'ios', settingsThrow: false, preventThrow: false }));
vi.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: async (key: string) => {
    if (calls.preventThrow) throw new Error('no module');
    calls.list.push(`prevent ${key}`);
  },
  allowScreenCaptureAsync: async (key: string) => void calls.list.push(`allow ${key}`),
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return calls.os;
    },
  },
  Settings: {
    set: (values: Record<string, unknown>) => {
      if (calls.settingsThrow) throw new Error('settings');
      calls.list.push(`settings ${JSON.stringify(values)}`);
    },
  },
}));

beforeEach(() => {
  calls.list = [];
  calls.os = 'ios';
  calls.settingsThrow = false;
  calls.preventThrow = false;
  vi.resetModules();
});

const load = () => import('../account-capture');

describe('holdAccountCapture', () => {
  it('iOS: the cover flag on and capture prevented for the first holder; off again after the last release, once', async () => {
    const { holdAccountCapture, accountCaptureHolders, ACCOUNT_CAPTURE_KEY, ACCOUNT_COVER_SETTING } = await load();
    expect(ACCOUNT_COVER_SETTING).toBe('hr.accountCover');
    const a = holdAccountCapture();
    const b = holdAccountCapture();
    await Promise.resolve();
    expect(accountCaptureHolders()).toBe(2);
    expect(calls.list).toEqual(['settings {"hr.accountCover":true}', `prevent ${ACCOUNT_CAPTURE_KEY}`]);
    a();
    a();
    expect(accountCaptureHolders()).toBe(1);
    b();
    await Promise.resolve();
    expect(accountCaptureHolders()).toBe(0);
    expect(calls.list.slice(2)).toEqual(['settings {"hr.accountCover":false}', `allow ${ACCOUNT_CAPTURE_KEY}`]);
  });

  it('the iOS cover flag is the key the plugin reads', async () => {
    const { ACCOUNT_COVER_SETTING } = await load();
    const plugin = createRequire(import.meta.url)('../../../plugins/with-account-cover.js') as { ACCOUNT_COVER_KEY: string };
    expect(plugin.ACCOUNT_COVER_KEY).toBe(ACCOUNT_COVER_SETTING);
  });

  it('Android: FLAG_SECURE through expo-screen-capture, no iOS setting', async () => {
    calls.os = 'android';
    const { holdAccountCapture } = await load();
    const release = holdAccountCapture();
    await Promise.resolve();
    release();
    await Promise.resolve();
    expect(calls.list).toEqual(['prevent hr-account', 'allow hr-account']);
  });

  it('never throws: a refusing platform leaves the other layers', async () => {
    calls.settingsThrow = true;
    calls.preventThrow = true;
    const { holdAccountCapture } = await load();
    expect(() => holdAccountCapture()()).not.toThrow();
  });
});
