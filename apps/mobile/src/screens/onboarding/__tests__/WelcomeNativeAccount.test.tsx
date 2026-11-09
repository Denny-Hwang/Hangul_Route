import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ComponentProps } from 'react';
import { Linking } from 'react-native';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountDenyHits } from '../../../logic/account/deny-list';
import { provideForRequire, srcPath } from '../../../test-support/native-require';

/**
 * F-AUTH-004 section 7.1 (Welcome's row), ND-9, CS-N13, CS-N14, design `entries.md` boards 8 and 9 (row NS-4): on iOS
 * and Android, under I already have progress, the lead and one outlined Sign in as a grown-up (never a use row; Let's
 * start stays the only filled button), waiting offline with Needs the internet; off with the native account off.
 */

const track = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../../../platform/telemetry', () => ({ track }));
const env = vi.hoisted(() => ({ enabled: true, online: true, onlineListener: null as null | ((online: boolean) => void) }));
vi.mock('../../../config/native-signin', () => ({ nativeSignInConfig: () => ({ flag: env.enabled, publishableKey: env.enabled ? 'pk_live_x' : null, enabled: env.enabled }) }));
vi.mock('../../../platform/account-online', () => ({
  readAccountOnline: async () => env.online,
  subscribeAccountOnline: (listener: (online: boolean) => void) => {
    env.onlineListener = listener;
    return () => undefined;
  },
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));

import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { buttonsNamed, byTestId, hostNodes, press, render, resetPlatform, screenTexts, setPlatform, unmount } from '../../../test-support/render';
import { WelcomeScreen } from '../WelcomeScreen';

const en = getMessages('en').learner;
const navigate = vi.fn();
const parentNavigate = vi.fn();
const navigation = { navigate, getParent: () => ({ navigate: parentNavigate }) };

const welcome = () => (
  <WelcomeScreen
    navigation={navigation as unknown as ComponentProps<typeof WelcomeScreen>['navigation']}
    route={{ key: 'welcome', name: 'Welcome', params: undefined } as ComponentProps<typeof WelcomeScreen>['route']}
  />
);

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
  }
}

beforeAll(async () => provideForRequire(srcPath('screens/account/WelcomeAccountRow'), await import('../../account/WelcomeAccountRow')));

beforeEach(() => {
  setPlatform('ios');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  // A device with no learner profile and no PIN: the gate is `open` (ND-9).
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
  useAccountStore.setState({ parentPinHash: null });
  env.enabled = true;
  env.online = true;
});
afterEach(() => {
  navigate.mockReset();
  parentNavigate.mockReset();
  track.mockClear();
  vi.unstubAllEnvs();
  resetPlatform();
});

for (const os of ['ios', 'android'] as const) {
  describe(`${os}: Welcome’s Sign in as a grown-up`, () => {
    beforeEach(() => setPlatform(os));

    it('board 8: the lead and one outlined Sign in as a grown-up; it opens the sign-in (no PIN exists, ND-9)', async () => {
      const r = await render(welcome());
      await settle();
      const group = byTestId(r.root, 'welcome-account')[0] as ReactTestInstance;
      expect(screenTexts(group)).toEqual(expect.arrayContaining([en.welcome.grownUps.lead, en.who.use.signIn]));
      // Never a use row, and none of the web's persona buttons.
      expect(buttonsNamed(r.root, en.who.use.family)).toHaveLength(0);
      expect(byTestId(r.root, 'welcome-grown-ups')).toHaveLength(0);
      await press(byTestId(r.root, 'welcome-account-sign-in')[0] as ReactTestInstance);
      expect(parentNavigate).toHaveBeenCalledWith('ParentDashboard', { screen: 'SignIn', params: {} });
      await unmount(r);
    });

    it('board 9: offline the button waits with Needs the internet under it', async () => {
      env.online = false;
      const r = await render(welcome());
      await settle();
      expect(byTestId(r.root, 'welcome-account-sign-in')[0]!.props['aria-disabled']).toBe(true);
      expect(byTestId(r.root, 'welcome-account-offline')).toHaveLength(1);
      await press(byTestId(r.root, 'welcome-account-sign-in')[0] as ReactTestInstance);
      expect(parentNavigate).not.toHaveBeenCalled();
      await unmount(r);
    });

    it('a device with a PIN asks the typed PIN first (no face or fingerprint, CS-N11)', async () => {
      useAccountStore.setState({ parentPinHash: 'h' });
      const r = await render(welcome());
      await settle();
      await press(byTestId(r.root, 'welcome-account-sign-in')[0] as ReactTestInstance);
      expect(parentNavigate).toHaveBeenCalledWith('PinEntry', { next: 'GrownUpUse', use: 'signin', typedOnly: true });
      await unmount(r);
    });

    it('CS-N13: the native account off: no row at all', async () => {
      env.enabled = false;
      const r = await render(welcome());
      await settle();
      expect(byTestId(r.root, 'welcome-account')).toHaveLength(0);
      expect(screenTexts(r.root)).not.toContain(en.who.use.signIn);
      await unmount(r);
    });
  });
}

describe('section 9.2: no denied word, in en, es and ko, online and offline', () => {
  it('every state', async () => {
    const openURL = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    for (const os of ['ios', 'android'] as const) {
      for (const locale of ['en', 'es', 'ko'] as UiLocale[]) {
        for (const online of [true, false]) {
          setPlatform(os);
          vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
          useLocaleStore.setState({ device: locale, byProfile: {} });
          env.online = online;
          const r = await render(welcome());
          await settle();
          const group = byTestId(r.root, 'welcome-account')[0] as ReactTestInstance;
          const labels = hostNodes(group, (n) => typeof n.props['aria-label'] === 'string').map((n) => n.props['aria-label'] as string);
          const hits = [...screenTexts(group), ...labels].flatMap((t) => accountDenyHits(t, locale).map((h) => `${os} ${locale} ${online}: "${t}" has ${h}`));
          expect(hits).toEqual([]);
          await unmount(r);
        }
      }
    }
    expect(openURL).not.toHaveBeenCalled();
  });
});
