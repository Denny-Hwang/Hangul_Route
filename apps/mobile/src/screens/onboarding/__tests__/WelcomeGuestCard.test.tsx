import { getMessages } from '@hangul-route/i18n';
import type { GuestRecord } from '@hangul-route/content-schema';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 6.3 (row GU-3, section 19; mock `design/screens/onboarding/guest-first-
 * quest.md` D2): Welcome's waiting card, in both states, only while a quest waits on a device with no profile and the
 * guest switch is on. Let's start stays the only filled button, in its place, with the keeps line under it. Back to my
 * quest closes the grown-up session and opens the guest run (`guest.started { via: 'welcome', resumed: true }`).
 */
const disk = vi.hoisted(() => new Map<string, string>());
vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => (disk.has(key) ? JSON.parse(disk.get(key)!) : null)),
  readJsonStrict: vi.fn(async (key: string) => (disk.has(key) ? JSON.parse(disk.get(key)!) : null)),
  readJsonExact: vi.fn(async (key: string) => (disk.has(key) ? JSON.parse(disk.get(key)!) : null)),
  writeJson: vi.fn(async (key: string, value: unknown) => void disk.set(key, JSON.stringify(value))),
  removeKey: vi.fn(async (key: string) => void disk.delete(key)),
  listKeys: vi.fn(async () => [...disk.keys()]),
}));
const sent = vi.hoisted(() => [] as Array<{ name: string; payload?: unknown }>);
vi.mock('../../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string; payload?: unknown }) => {
    sent.push(event);
    return true;
  }),
}));
vi.mock('../../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
vi.mock('@react-navigation/native', () => ({ CommonActions: { reset: (state: unknown) => ({ type: 'RESET', payload: state }) } }));
const switches = vi.hoisted(() => ({ guest: true }));
vi.mock('../../../config/flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../config/flags')>();
  return { ...actual, flags: new Proxy(actual.flags, { get: (target, key) => (key === 'guestLessonEnabled' ? switches.guest : Reflect.get(target, key)) }) };
});

import { guestFirstQuest } from '../../../store/guest-launch';
import { useGuestStore } from '../../../store/guest-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, byTestId, press, render, resetPlatform, screenTexts, setPlatform, unmount } from '../../../test-support/render';
import { WelcomeScreen } from '../WelcomeScreen';

const T0 = Date.parse('2026-10-22T10:00:00.000Z');
const record = (patch: Partial<GuestRecord> = {}): GuestRecord => ({ v: 1, id: 'profile:guest001', startedAt: new Date(T0).toISOString(), lastAt: new Date(T0).toISOString(), via: 'site', questDone: false, ...patch });
const mina = { id: 'profile:mina0001', displayName: 'Mina', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const, role: 'learner' as const, createdAt: '2026-10-01T00:00:00.000Z' };

const rootDispatch = vi.fn();
const navigation = { navigate: vi.fn(), getParent: () => ({ navigate: vi.fn(), dispatch: rootDispatch }) };
const welcome = () => (
  <WelcomeScreen
    navigation={navigation as unknown as React.ComponentProps<typeof WelcomeScreen>['navigation']}
    route={{ key: 'welcome', name: 'Welcome', params: undefined } as React.ComponentProps<typeof WelcomeScreen>['route']}
  />
);

/** The labels of the design-system Buttons drawn filled (`tone="primary"`). */
const filledButtons = (root: ReactTestInstance): string[] =>
  root.findAll((n) => typeof n.type === 'function' && typeof n.props.label === 'string' && n.props.tone === 'primary' && 'onPress' in n.props).map((n) => n.props.label as string);

beforeEach(() => {
  disk.clear();
  sent.length = 0;
  switches.guest = true;
  rootDispatch.mockClear();
  vi.stubGlobal('navigator', { locks: { request: async <T,>(_name: string, step: () => Promise<T>): Promise<T> => step() } });
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
  useGuestStore.setState({ record: null, running: false, hydrated: true, memoryOnly: false });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
  setPlatform('web');
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetPlatform();
});

const g = getMessages('en').learner.guest.welcome;
const w = getMessages('en').learner.welcome;

describe('Welcome with a waiting quest (6.3)', () => {
  it('quest 1 not done: the card above Let\'s start with Back to my quest, and the keeps line under it', async () => {
    disk.set('guest', JSON.stringify(record()));
    useGuestStore.setState({ record: record() });
    const r = await render(welcome());
    const card = byTestId(r.root, 'welcome-guest')[0] as ReactTestInstance;
    expect([...new Set(screenTexts(card))]).toEqual([g.waiting, g.resume]);
    expect(screenTexts(byTestId(r.root, 'welcome-guest-keeps')[0]!)).toEqual([g.keeps]);
    // Reading order: the card, Let's start, the keeps line; Let's start is the only filled button.
    const order = screenTexts(r.root);
    expect(order.indexOf(g.waiting)).toBeLessThan(order.indexOf(w.cta));
    expect(order.indexOf(w.cta)).toBeLessThan(order.indexOf(g.keeps));
    expect(filledButtons(r.root)).toEqual([w.cta]);

    // Back to my quest, with a grown-up session open: the session closes and the run opens alone on the root (CS-G3).
    useUiStore.setState({ parentGateOpenedAt: T0, lastPinVerifiedAt: T0 });
    await press(buttonsNamed(card, g.resume)[0]!);
    await vi.waitFor(() => expect(rootDispatch).toHaveBeenCalled());
    expect(rootDispatch).toHaveBeenCalledWith({ type: 'RESET', payload: { index: 0, routes: [{ name: 'Guest', params: { screen: 'QuestPlayer', params: guestFirstQuest() } }] } });
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    expect(useGuestStore.getState().running).toBe(true);
    expect(sent.filter((e) => e.name === 'guest.started')).toEqual([{ name: 'guest.started', payload: { via: 'welcome', resumed: true } }]);
    await unmount(r);
  });

  it('quest 1 done: Add your name to keep your first quest, with Add my name (the save, row GU-4)', async () => {
    useGuestStore.setState({ record: record({ questDone: true }) });
    const r = await render(welcome());
    const card = byTestId(r.root, 'welcome-guest')[0] as ReactTestInstance;
    expect([...new Set(screenTexts(card))]).toEqual([g.saveTitle, g.save]);
    expect(screenTexts(byTestId(r.root, 'welcome-guest-keeps')[0]!)).toEqual([g.keeps]);
    expect(filledButtons(r.root)).toEqual([w.cta]);
    await press(buttonsNamed(card, g.save)[0]!);
    expect(rootDispatch).toHaveBeenCalledWith({ type: 'RESET', payload: { index: 0, routes: [{ name: 'Guest', params: { screen: 'GuestLater' } }] } });
    // Add my name uses the guest's id without a run (GU-D15): nothing starts, nothing is sent.
    expect(useGuestStore.getState().running).toBe(false);
    expect(sent).toEqual([]);
    await unmount(r);
  });

  it('no card with the switch off, with no live guest, or once the guest is a profile', async () => {
    switches.guest = false;
    useGuestStore.setState({ record: record() });
    let r = await render(welcome());
    expect(byTestId(r.root, 'welcome-guest')).toHaveLength(0);
    expect(byTestId(r.root, 'welcome-guest-keeps')).toHaveLength(0);
    await unmount(r);

    switches.guest = true;
    useGuestStore.setState({ record: null });
    r = await render(welcome());
    expect(byTestId(r.root, 'welcome-guest')).toHaveLength(0);
    await unmount(r);

    useGuestStore.setState({ record: record({ id: mina.id }) });
    useProfileStore.setState({ profiles: [mina] });
    r = await render(welcome());
    expect(byTestId(r.root, 'welcome-guest')).toHaveLength(0);
    await unmount(r);
  });

  it.each(['es', 'ko'] as const)('%s: the card and the line are in that language', async (locale) => {
    vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
    useLocaleStore.setState({ device: locale, byProfile: {} });
    useGuestStore.setState({ record: record() });
    const words = getMessages(locale).learner.guest.welcome;
    const r = await render(welcome());
    expect([...new Set(screenTexts(byTestId(r.root, 'welcome-guest')[0]!))]).toEqual([words.waiting, words.resume]);
    expect(screenTexts(byTestId(r.root, 'welcome-guest-keeps')[0]!)).toEqual([words.keeps]);
    await unmount(r);
  });
});
