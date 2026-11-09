import type { Profile } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import React from 'react';
import { Linking } from 'react-native';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountDenyHits } from '../../../logic/account/deny-list';
import { provideForRequire, srcPath } from '../../../test-support/native-require';

/**
 * F-AUTH-004 sections 7.1 and 12, design `entries.md` boards 1 to 7 and D3 (row NS-4; CS-N2, CS-N9, CS-N11, CS-N13):
 * the chooser's Grown-ups rows on iOS and Android with the native account on: the known uses of the native uses
 * record, Grown-up account for a record with no use, Sign in with none; `nopin` captions; offline; an `open` device;
 * the switch off. A row asks the typed PIN (no face or fingerprint) on a `pin` device, opens PIN setup on `nopin`, and
 * the sign-in at once with no PIN. Rows carry generic labels only, in en, es and ko, with no denied word.
 */
vi.mock('@react-navigation/native', () => ({ useFocusEffect: (effect: () => void) => (React as typeof import('react')).useEffect(effect, []) }));
const tracked = vi.hoisted(() => [] as { name: string; payload?: Record<string, unknown> }[]);
vi.mock('../../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string }) => {
    tracked.push(event);
    return true;
  }),
}));
vi.mock('../../../platform/grown-up-tab', () => ({ endGrownUpTab: () => undefined }));
const env = vi.hoisted(() => ({ enabled: true, record: ['family', 'teacher'] as string[] | null, online: true, onlineListener: null as null | ((online: boolean) => void), reads: 0 }));
vi.mock('../../../config/native-signin', () => ({ nativeSignInConfig: () => ({ flag: env.enabled, publishableKey: env.enabled ? 'pk_live_x' : null, enabled: env.enabled }) }));
vi.mock('../../../platform/device-uses', () => ({ readDeviceUses: vi.fn(async () => (env.enabled ? [...(env.record ?? [])] : [])) }));
vi.mock('../../../platform/account-records', () => ({
  readUsesRecord: async () => {
    env.reads += 1;
    return env.record === null ? null : [...env.record];
  },
}));
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
import { useUiStore } from '../../../store/ui-store';
import { resetChooserState } from '../../../store/who-chooser';
import { byTestId, cleanup, hostNodes, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { WhoIsUsingScreen } from '../WhoIsUsingScreen';

const en = getMessages('en');
const w = en.learner.who;

const learner = (id: string, displayName: string, learnerType: 'child' | 'self' = 'child'): Profile => ({
  id,
  displayName,
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType,
});

let focusListeners: (() => void)[] = [];

function fakeNavigation() {
  const routes = [{ key: 'who-1', name: 'WhoIsUsing', params: { trigger: 'launch' } }];
  focusListeners = [];
  return {
    getState: () => ({ index: 0, routes }),
    goBack: vi.fn(),
    reset: vi.fn(),
    navigate: vi.fn(),
    setOptions: vi.fn(),
    addListener: vi.fn((event: string, listener: () => void) => {
      if (event === 'focus') focusListeners.push(listener);
      return () => undefined;
    }),
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
  }
}

async function renderChooser() {
  const navigation = fakeNavigation();
  const r = await render(<WhoIsUsingScreen navigation={navigation as never} route={{ key: 'who-1', name: 'WhoIsUsing', params: { trigger: 'launch' } } as never} />);
  await settle();
  return { r, navigation };
}

const rowIds = (root: ReactTestInstance): string[] =>
  hostNodes(root, (n) => /^who-row-[a-z]+$/.test(String(n.props['data-testid'] ?? ''))).map((n) => n.props['data-testid'] as string);
const row = (root: ReactTestInstance, use: string): ReactTestInstance => byTestId(root, `who-row-${use}`)[0]!;

beforeAll(async () => provideForRequire(srcPath('screens/account/account-entries'), await import('../../account/account-entries')));

beforeEach(() => {
  setPlatform('ios');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  tracked.length = 0;
  env.enabled = true;
  env.record = ['family', 'teacher'];
  env.online = true;
  env.reads = 0;
  resetChooserState();
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useProfileStore.setState({ profiles: [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun')], activeId: 'profile:mina', hydrated: true, activeSince: Date.now() });
  useAccountStore.setState({ parentPinHash: 'pin-hash', pinResetRequestedAt: null });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
});

for (const os of ['ios', 'android'] as const) {
  describe(`${os}: the native account rows`, () => {
    beforeEach(() => setPlatform(os));

    it('board 1: the known uses, then the Grown-up area; a row asks the typed PIN, never face or fingerprint (CS-N11)', async () => {
      const { r, navigation } = await renderChooser();
      expect(rowIds(r.root)).toEqual(['who-row-family', 'who-row-teacher', 'who-row-area']);
      expect(row(r.root, 'family').props['aria-label']).toBe(en.a11y.who.grownUpRow(w.use.family));
      await press(row(r.root, 'teacher'));
      expect(tracked).toContainEqual({ name: 'who.picked', payload: { kind: 'grown_up', use: 'teacher' } });
      expect(navigation.navigate).toHaveBeenCalledWith('PinEntry', { next: 'GrownUpUse', use: 'teacher', typedOnly: true });
    });

    it('board 2: a record with no use: Grown-up account (who.picked `account`)', async () => {
      env.record = [];
      const { r, navigation } = await renderChooser();
      expect(rowIds(r.root)).toEqual(['who-row-account', 'who-row-area']);
      expect(screenTexts(row(r.root, 'account'))).toContain(en.caregiver.account.card.title);
      await press(row(r.root, 'account'));
      expect(tracked).toContainEqual({ name: 'who.picked', payload: { kind: 'grown_up', use: 'account' } });
      expect(navigation.navigate).toHaveBeenCalledWith('PinEntry', { next: 'GrownUpUse', use: 'account', typedOnly: true });
    });

    it('board 3: no record: Sign in as a grown-up', async () => {
      env.record = null;
      const { r } = await renderChooser();
      expect(rowIds(r.root)).toEqual(['who-row-signin', 'who-row-area']);
    });

    it('board 4 (ND-7): nopin: Sign in captioned Set a grown-up PIN first, named by its label alone; it opens PIN setup', async () => {
      useAccountStore.setState({ parentPinHash: null });
      const { r, navigation } = await renderChooser();
      expect(rowIds(r.root)).toEqual(['who-row-signin', 'who-row-area']);
      expect(screenTexts(row(r.root, 'signin'))).toContain(en.caregiver.pin.needsPinFirst);
      expect(row(r.root, 'signin').props['aria-label']).toBe(w.use.signIn);
      await press(row(r.root, 'signin'));
      expect(navigation.navigate).toHaveBeenCalledWith('PinEntry', { next: 'ParentDashboard' });
      expect(navigation.navigate).not.toHaveBeenCalledWith('ParentDashboard', expect.anything());
    });

    it('board 5 (D3): offline the account rows wait with Needs the internet; the Grown-up area stays enabled', async () => {
      env.online = false;
      const { r, navigation } = await renderChooser();
      for (const use of ['family', 'teacher']) {
        expect(row(r.root, use).props['aria-disabled']).toBe(true);
        expect(screenTexts(row(r.root, use))).toContain(en.learner.welcome.grownUps.needsInternet);
      }
      await press(row(r.root, 'family'));
      expect(navigation.navigate).not.toHaveBeenCalled();
      expect(row(r.root, 'area').props['aria-disabled']).not.toBe(true);
    });

    it('board 6: an open device (self-only, no PIN): Sign in with no lock; it opens the sign-in at once (ND-9)', async () => {
      useProfileStore.setState({ profiles: [learner('profile:dana', 'Dana', 'self')], activeId: 'profile:dana' });
      useAccountStore.setState({ parentPinHash: null });
      const { r, navigation } = await renderChooser();
      expect(rowIds(r.root)).toEqual(['who-row-signin', 'who-row-area']);
      expect(row(r.root, 'signin').props['aria-label']).toBe(w.use.signIn);
      await press(row(r.root, 'signin'));
      expect(navigation.navigate).toHaveBeenCalledWith('ParentDashboard', { screen: 'SignIn', params: {} });
      expect(tracked.some((e) => e.name === 'parent.gate.opened' && e.payload?.via === 'open')).toBe(true);
    });

    it('board 7 (CS-N13): the native account off: the Grown-up area only, and no record is read', async () => {
      env.enabled = false;
      const { r } = await renderChooser();
      expect(rowIds(r.root)).toEqual(['who-row-area']);
      expect(env.reads).toBe(0);
    });

    it('the record is read again whenever the chooser comes back to the front (a sign-in just wrote it)', async () => {
      env.record = null;
      const { r } = await renderChooser();
      expect(rowIds(r.root)).toEqual(['who-row-signin', 'who-row-area']);
      env.record = ['school'];
      await act(async () => focusListeners.forEach((l) => l()));
      await settle();
      expect(rowIds(r.root)).toEqual(['who-row-school', 'who-row-area']);
    });
  });
}

describe('section 9.2 and CS-N9: generic labels only, no denied word, in en, es and ko on iOS and Android', () => {
  for (const os of ['ios', 'android'] as const) {
    it(`${os}: every row state`, async () => {
      const openURL = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
      const states: Record<string, () => void> = {
        uses: () => undefined,
        all: () => void (env.record = ['family', 'teacher', 'school']),
        account: () => void (env.record = []),
        signin: () => void (env.record = null),
        nopin: () => useAccountStore.setState({ parentPinHash: null }),
        offline: () => void (env.online = false),
      };
      for (const locale of ['en', 'es', 'ko'] as UiLocale[]) {
        for (const [name, setUp] of Object.entries(states)) {
          setPlatform(os);
          vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
          useLocaleStore.setState({ device: locale, byProfile: {} });
          env.record = ['family', 'teacher'];
          env.online = true;
          useAccountStore.setState({ parentPinHash: 'pin-hash' });
          setUp();
          const { r } = await renderChooser();
          const rows = byTestId(r.root, 'who-rows')[0]!;
          const labels = hostNodes(rows, (n) => typeof n.props['aria-label'] === 'string').map((n) => n.props['aria-label'] as string);
          const texts = [...screenTexts(rows), ...labels];
          const hits = texts.flatMap((t) => accountDenyHits(t, locale).map((h) => `${os} ${locale} ${name}: "${t}" has ${h}`));
          expect(hits).toEqual([]);
          expect(texts.join(' ')).not.toMatch(/@/);
          await cleanup();
        }
      }
      expect(openURL).not.toHaveBeenCalled();
    });
  }
});
