import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-6 (section 8.5 steps 1 and 5; section 20; mock
 * `design/screens/profiles/pin-entry-v2.md` boards 7 to 10): Forgot PIN? offers Sign in to the account first only on
 * the web, online, with the switch on, and its Sign in writes no unlock; the ticket's new-PIN screen is titled Choose a
 * new grown-up PIN and reports `pin.reset_completed { method: 'sign_in' }`; a refused ticket shows the expired line once.
 */
vi.mock('@react-navigation/native', async () => {
  const { createContext } = await import('react');
  // The back guard reads the screen's navigation from this context; the tests hand the screen its own.
  return { NavigationContext: createContext(undefined), useFocusEffect: () => undefined };
});
const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => (disk.has(key) ? structuredClone(disk.get(key)) : null)),
  readJsonStrict: vi.fn(async (key: string) => (disk.has(key) ? structuredClone(disk.get(key)) : null)),
  readJsonExact: vi.fn(async (key: string) => (disk.has(key) ? structuredClone(disk.get(key)) : null)),
  writeJson: vi.fn(async (key: string, value: unknown) => void disk.set(key, structuredClone(value))),
  updateJson: vi.fn(async () => true),
  removeKey: vi.fn(async () => undefined),
}));
vi.mock('../../../platform/crypto', () => ({
  pinHasher: { hash: async (pin: string) => `h:${pin}`, verify: async (pin: string, stored: string) => stored === `h:${pin}` },
}));
const tracked = vi.hoisted(() => [] as { name: string; payload?: Record<string, unknown> }[]);
vi.mock('../../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string; payload?: Record<string, unknown> }) => {
    tracked.push(event);
    return true;
  }),
}));
const net = vi.hoisted(() => ({ online: true }));
vi.mock('../../../platform/online', () => ({ isOnline: () => net.online, subscribeOnline: () => () => undefined }));
const signIn = vi.hoisted(() => ({ calls: 0 }));
vi.mock('../../../platform/pin-reset', () => ({
  takePinResetTicket: () => null,
  openPinResetSignIn: vi.fn(async () => {
    signIn.calls += 1;
  }),
}));

import { UNLOCK_SESSION_KEY } from '@hangul-route/content-schema';
import { ScreenHeaderSlotContext, type ScreenHeaderSlotProps } from '@hangul-route/design-system';
import { Text } from 'react-native';
import { flags } from '../../../config/flags';
import { useAccountStore } from '../../../store/account-store';
import { usePinResetNotice } from '../../../store/pin-reset-notice';
import { useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform, type RenderPlatform } from '../../../test-support/render';
import { PinEntryScreen } from '../PinEntryScreen';
import { PinResetExpiredNotice } from '../PinResetExpiredNotice';
import { PinResetScreen } from '../PinResetScreen';

const m = getMessages('en').caregiver.pin;
const a11y = getMessages('en').a11y;

const learner: Profile = {
  id: 'profile:mina',
  displayName: 'Mina',
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType: 'child',
};

function nav() {
  return { goBack: vi.fn(), replace: vi.fn(), navigate: vi.fn(), addListener: vi.fn(() => () => undefined), setOptions: vi.fn() };
}

async function showReset(navigation = nav()) {
  const route = { key: 'reset', name: 'PinReset' as const, params: { next: 'ParentDashboard' as const } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the screen reads only what `nav()` provides
  const r = await render(<PinResetScreen route={route} navigation={navigation as any} />);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { r, navigation };
}

const defaultFlag = flags.pinResetSignInEnabled;

/** The route's header, reduced to its title (the app's `LearnerScreenHeader` needs a navigator). */
function TitleSlot({ options }: ScreenHeaderSlotProps): React.ReactElement | null {
  return options?.title ? <Text>{options.title}</Text> : null;
}

beforeEach(() => {
  setPlatform('web');
  disk.clear();
  tracked.length = 0;
  signIn.calls = 0;
  net.online = true;
  flags.pinResetSignInEnabled = true;
  useProfileStore.setState({ profiles: [learner], activeId: learner.id, hydrated: true });
  useAccountStore.setState({
    parentPinHash: 'h:1234',
    pinResetRequestedAt: null,
    pinAttempts: { failures: [], lockedUntil: null, strikes: 0 },
    rescueAttempts: { failures: [], lockedUntil: null, strikes: 0 },
  });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
  usePinResetNotice.setState({ expired: false });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
  flags.pinResetSignInEnabled = defaultFlag;
});

describe('Forgot PIN?: Sign in to the account (section 8.5 step 1)', () => {
  it('on the web, online, switch on: the first card, with its heading, caption and Sign in', async () => {
    const { r } = await showReset();
    const [card] = byTestId(r.root, 'pin-reset-signin');
    expect(card).toBeDefined();
    expect(screenTexts(card as ReactTestInstance)).toEqual(expect.arrayContaining([m.reset.signIn.heading, m.reset.signIn.caption, m.reset.signIn.button]));
    // First: before the wait card the screen always shows here (no Rescue Code is stored).
    const texts = screenTexts(r.root);
    expect(texts.indexOf(m.reset.signIn.heading)).toBeLessThan(texts.indexOf(m.reset.wait.heading));
  });

  const hidden: Array<[string, () => void]> = [
    ['offline', () => (net.online = false)],
    ['switch off', () => (flags.pinResetSignInEnabled = false)],
    ...(['ios', 'android'] as RenderPlatform[]).map((os): [string, () => void] => [os, () => setPlatform(os)]),
  ];
  for (const [name, arrange] of hidden) {
    it(`hidden ${name}: the Rescue Code and the wait only`, async () => {
      arrange();
      const { r } = await showReset();
      expect(byTestId(r.root, 'pin-reset-signin')).toHaveLength(0);
      expect(screenTexts(r.root)).not.toContain(m.reset.signIn.heading);
      expect(screenTexts(r.root)).toContain(m.reset.wait.heading);
    });
  }

  it('Sign in hands off once and writes no unlock', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    const { r } = await showReset();
    const [button] = buttonsNamed(r.root, m.reset.signIn.button);
    await press(button as ReactTestInstance);
    await press(button as ReactTestInstance);
    expect(signIn.calls).toBe(1);
    expect(store.has(UNLOCK_SESSION_KEY)).toBe(false);
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('the ticket’s new-PIN screen (section 8.5 step 5)', () => {
  async function showSetup(navigation = nav()) {
    const route = { key: 'pin', name: 'PinEntry' as const, params: { next: 'ParentDashboard' as const, mode: 'setup' as const, via: 'sign_in' as const } };
    const r = await render(
      <ScreenHeaderSlotContext.Provider value={TitleSlot}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the screen reads only what `nav()` provides */}
        <PinEntryScreen route={route} navigation={navigation as any} />
      </ScreenHeaderSlotContext.Provider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { r, navigation };
  }

  async function enter(root: ReactTestInstance, pin: string): Promise<void> {
    for (const digit of pin) await press(buttonsNamed(root, a11y.pinDigit(Number(digit)))[0] as ReactTestInstance);
    await press(buttonsNamed(root, getMessages('en').common.buttons.next)[0] as ReactTestInstance);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('is setup-1 titled Choose a new grown-up PIN, with no Forgot PIN?', async () => {
    const { r } = await showSetup();
    expect(screenTexts(r.root)).toContain(m.reset.signIn.newPinTitle);
    expect(buttonsNamed(r.root, m.entry.forgot.cta)).toHaveLength(0);
  });

  it('during a PIN pause (no hard lock, OA-D7) a new PIN moves the epoch, sets strikes to 0 and reports pin.reset_completed { method: sign_in }', async () => {
    useAccountStore.setState({ pinSetAt: 1, pinAttempts: { failures: [], lockedUntil: Date.now() + 60_000, strikes: 3, lastMissAt: Date.now() } });
    const { r, navigation } = await showSetup();
    await enter(r.root, '2468');
    await enter(r.root, '2468');
    const account = useAccountStore.getState();
    expect(account.parentPinHash).toBe('h:2468');
    expect(account.pinSetAt).not.toBe(1);
    expect(account.pinAttempts.strikes).toBe(0);
    expect(account.pinAttempts.lockedUntil).toBeNull();
    expect(tracked).toContainEqual({ name: 'pin.reset_completed', payload: { method: 'sign_in' } });
    expect(tracked).toContainEqual({ name: 'pin.created', payload: { where: 'reset' } });
    // No id in any event (the Worker stores these without a profile id, section 15).
    expect(JSON.stringify(tracked)).not.toContain('profile:mina');
    expect(navigation.replace).toHaveBeenCalledWith('ParentDashboard');
  });
});

describe('the expired line (section 8.5 step 5, board 10)', () => {
  it('shows once the intent raises it, then not on the next visit', async () => {
    const first = await render(<PinResetExpiredNotice />);
    expect(byTestId(first.root, 'pin-reset-expired')).toHaveLength(0);
    usePinResetNotice.getState().showExpired();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await first.update(<PinResetExpiredNotice />);
    const [notice] = byTestId(first.root, 'pin-reset-expired');
    expect(screenTexts(notice as ReactTestInstance)).toEqual([m.reset.signIn.expired]);
    expect(notice?.props.role).toBe('status');
    expect(usePinResetNotice.getState().expired).toBe(false);
    await cleanup();
    const again = await render(<PinResetExpiredNotice />);
    expect(byTestId(again.root, 'pin-reset-expired')).toHaveLength(0);
  });
});
