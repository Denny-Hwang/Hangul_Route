import { getMessages } from '@hangul-route/i18n';
import type { GuestRecord, Profile } from '@hangul-route/content-schema';
import React from 'react';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 8.1 to 8.6, CS-G2, CS-G8 to CS-G10 (row GU-4, section 19): the save
 * after the first quest, rendered through react-native-web: the save card in its three cases, the verify-only
 * `SaveGuest` PIN (no grown-up session, still asked with one open, refused without a PIN), the two-step form with the
 * folded email and the under-13 latch, the promotion and the first Home's bubble, and the Not now card.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const disk = vi.hoisted(() => new Map<string, string>());
vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => (disk.has(key) ? JSON.parse(disk.get(key)!) : null)),
  readJsonStrict: vi.fn(async (key: string) => (disk.has(key) ? JSON.parse(disk.get(key)!) : null)),
  readJsonExact: vi.fn(async (key: string) => (disk.has(key) ? JSON.parse(disk.get(key)!) : null)),
  writeJson: vi.fn(async (key: string, value: unknown) => void disk.set(key, JSON.stringify(value))),
  updateJson: vi.fn(async () => true),
  removeKey: vi.fn(async (key: string) => void disk.delete(key)),
  listKeys: vi.fn(async () => [...disk.keys()]),
}));
const sent = vi.hoisted(() => [] as Array<{ name: string; payload?: Record<string, unknown>; profileId?: string }>);
vi.mock('../../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string; payload?: Record<string, unknown>; profileId?: string }) => {
    sent.push(event);
    return true;
  }),
  flushQueue: vi.fn(async () => undefined),
}));
vi.mock('../../../platform/crypto', () => ({
  pinHasher: { hash: async (pin: string) => `h:${pin}`, verify: async (pin: string, stored: string) => stored === `h:${pin}` },
}));
vi.mock('../../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
vi.mock('../../../platform/grown-up-handoff', () => ({
  openGrownUpArea: vi.fn(async () => 'opened'),
  continueToGrownUpPage: vi.fn(),
  clearGrownUpTab: vi.fn(),
}));
// The native navigation package has no build that loads in Node: focus effects run once; reset is an action object.
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    NavigationRouteContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
    CommonActions: { reset: (state: unknown) => ({ type: 'RESET', payload: state }) },
  };
});
// Screen-reader focus moves are recorded (the node mocks below carry the element's test id or label).
const srFocus = vi.hoisted(() => [] as unknown[]);
vi.mock('../../../platform/screen-reader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../platform/screen-reader')>()),
  focusForScreenReader: (node: unknown) => void srFocus.push(node),
}));
const switches = vi.hoisted(() => ({ guest: true, placement: true }));
vi.mock('../../../config/flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../config/flags')>();
  return {
    ...actual,
    flags: new Proxy(actual.flags, {
      get: (target, key) => (key === 'guestLessonEnabled' ? switches.guest : key === 'placementEnabled' ? switches.placement : Reflect.get(target, key)),
    }),
  };
});

import { Pressable, Text, TextInput } from 'react-native';
import { ScreenHeaderSlotContext, type ScreenHeaderSlotProps } from '@hangul-route/design-system';
import { cardById } from '../../../content';
import { useAccountStore } from '../../../store/account-store';
import { guestFirstQuest } from '../../../store/guest-launch';
import { clearGuestSavedNote, guestSavedNoteFor, noteGuestSaveEntry } from '../../../store/guest-save';
import { useGuestStore } from '../../../store/guest-store';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { CreateProfileScreen } from '../../onboarding/CreateProfileScreen';
import { PinEntryScreen } from '../../parent/PinEntryScreen';
import { GuestLaterScreen } from '../GuestLaterScreen';
import { GuestResults } from '../GuestResults';

const all = getMessages('en');
const en = all.learner;
const g = en.guest;
const c = en.createProfile;
const GUEST_ID = 'profile:guest001';
const T0 = Date.parse('2026-10-22T10:00:00.000Z');
const record = (patch: Partial<GuestRecord> = {}): GuestRecord => ({ v: 1, id: GUEST_ID, startedAt: new Date(T0).toISOString(), lastAt: new Date(T0).toISOString(), via: 'site', questDone: true, ...patch });
const quest = guestFirstQuest()!;
const mina: Profile = { id: 'profile:mina0001', displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-blue', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' };

type BeforeRemove = (e: { data: { action: { type: string } }; preventDefault: () => void }) => void;

function navigationDouble() {
  const rootDispatch = vi.fn();
  return {
    rootDispatch,
    navigate: vi.fn(),
    replace: vi.fn(),
    dispatch: vi.fn(),
    goBack: vi.fn(),
    reset: vi.fn(),
    setOptions: vi.fn(),
    getState: () => ({ index: 0, routes: [{ key: 'r', name: 'Results' }] }),
    getParent: () => ({ dispatch: rootDispatch }),
    addListener: vi.fn(() => () => undefined),
  };
}

function HeaderDouble({ options }: ScreenHeaderSlotProps): React.ReactElement | null {
  const leading = options?.leading;
  if (leading?.onPress === undefined) return null;
  return (
    <Pressable accessibilityRole="button" onPress={leading.onPress} testID={`header-${leading.kind}`}>
      <Text>{leading.kind}</Text>
    </Pressable>
  );
}
const inGuest = (element: React.ReactElement): React.ReactElement => <ScreenHeaderSlotContext.Provider value={HeaderDouble}>{element}</ScreenHeaderSlotContext.Provider>;

/** A host node for react-test-renderer refs: react-native-web listens on it; `focus` records the focus moves. */
const nodeMock = (focus: () => void) => ({ focus, addEventListener: () => undefined, removeEventListener: () => undefined, getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }) });

/** A who-is-learning option (a radio). */
const optionNamed = (root: ReactTestInstance, label: string): ReactTestInstance[] =>
  root.findAll((n) => typeof n.type === 'string' && n.props.role === 'radio' && screenTexts(n).includes(label));

/** The labels of the design-system Buttons drawn filled (`tone="primary"`). */
const filledButtons = (root: ReactTestInstance): string[] =>
  root.findAll((n) => typeof n.type === 'function' && typeof n.props.label === 'string' && n.props.tone === 'primary' && 'onPress' in n.props).map((n) => n.props.label as string);
const disabled = (node: ReactTestInstance): boolean => node.props['aria-disabled'] === true || node.props.disabled === true;
const flush = (): Promise<void> => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

async function showResults(nav = navigationDouble(), stars: 0 | 1 | 2 | 3 = 2) {
  const route = { key: 'r', name: 'Results', params: { questId: quest.questId, episodeId: quest.episodeId, stars, correct: 2, total: 2 } };
  const r = await render(inGuest(<GuestResults route={route as never} navigation={nav as never} />));
  await flush();
  return { r, nav };
}

beforeEach(() => {
  setPlatform('web');
  // react-native-web's TextInput reads `document.activeElement` when it mounts; Node has no document.
  vi.stubGlobal('document', { activeElement: null });
  useProgressStore.setState({ byProfile: {} });
  disk.clear();
  sent.length = 0;
  switches.guest = true;
  switches.placement = true;
  vi.stubGlobal('navigator', { locks: { request: async <T,>(_name: string, step: () => Promise<T>): Promise<T> => step() } });
  disk.set('guest', JSON.stringify(record()));
  useGuestStore.setState({ record: record(), running: true, hydrated: true, memoryOnly: false });
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
  useAccountStore.setState({
    parentPinHash: null,
    pinHashReadFailed: false,
    guardianConsentAcceptedAt: null,
    selfConsentAcceptedAt: null,
    pinAttempts: { failures: [], lockedUntil: null, strikes: 0 },
  });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null, gateReturnPending: false });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
  vi.unstubAllGlobals();
});

describe('the save card on the guest\'s Results (8.1, 8.2)', () => {
  it('open (no profile, no PIN): Hoya\'s line as the heading, Keep my progress (the one filled button), a quiet Not now; Keep opens the form', async () => {
    const { r, nav } = await showResults();
    const card = byTestId(r.root, 'guest-save-card')[0] as ReactTestInstance;
    // Two stars: the card is earned and kept.
    expect(screenTexts(byTestId(card, 'guest-save-heading')[0]!)).toEqual([g.results.line]);
    expect(byTestId(card, 'guest-save-heading')[0]!.props.role).toBe('heading');
    expect(filledButtons(r.root)).toEqual([g.results.keep]);
    expect(buttonsNamed(r.root, g.results.notNow)).toHaveLength(1);
    expect(byTestId(r.root, 'guest-save-caption')).toHaveLength(0);
    // Reading order: the tier word first, then the save card's heading, Keep my progress, Not now.
    const texts = screenTexts(r.root);
    expect(texts).toContain(en.results.headline.great);
    expect(texts.indexOf(en.results.headline.great)).toBeLessThan(texts.indexOf(g.results.line));
    expect(texts.indexOf(g.results.line)).toBeLessThan(texts.indexOf(g.results.keep));
    expect(texts.indexOf(g.results.keep)).toBeLessThan(texts.indexOf(g.results.notNow));
    // Never the Grown-up area's rescue-code label.
    expect(texts).not.toContain(all.caregiver.backup.save.cta);
    await press(buttonsNamed(r.root, g.results.keep)[0]!);
    expect(nav.navigate).toHaveBeenCalledWith('CreateProfile', { firstRun: true, from: 'guest' });
  });

  it('no card kept (below 2 stars): the first-quest line', async () => {
    const { r } = await showResults(navigationDouble(), 1);
    expect(screenTexts(byTestId(r.root, 'guest-save-heading')[0]!)).toEqual([g.results.lineNoCard]);
  });

  it('verify (a PIN is stored): the caption under Keep my progress, and Keep asks the SaveGuest PIN, also with a grown-up session open (CS-G9)', async () => {
    useAccountStore.setState({ parentPinHash: 'h:1234' });
    useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: Date.now() });
    const { r, nav } = await showResults();
    expect(screenTexts(byTestId(r.root, 'guest-save-caption')[0]!)).toEqual([g.results.askGrownUp]);
    const texts = screenTexts(r.root);
    expect(texts.indexOf(g.results.keep)).toBeLessThan(texts.indexOf(g.results.askGrownUp));
    await press(buttonsNamed(r.root, g.results.keep)[0]!);
    expect(nav.navigate).toHaveBeenCalledWith('PinEntry', { next: 'SaveGuest' });
    expect(nav.navigate).not.toHaveBeenCalledWith('CreateProfile', expect.anything());
  });

  it('owner (profiles, no PIN): only the ask-the-owner line and a filled Not now; no Keep my progress, no PIN pad (CS-G10)', async () => {
    useProfileStore.setState({ profiles: [mina], activeId: mina.id });
    const { r, nav } = await showResults();
    expect(screenTexts(byTestId(r.root, 'guest-save-heading')[0]!)).toEqual([g.results.askOwner]);
    expect(buttonsNamed(r.root, g.results.keep)).toHaveLength(0);
    expect(filledButtons(r.root)).toEqual([g.results.notNow]);
    expect(buttonsNamed(r.root, all.a11y.pinDigit(1))).toHaveLength(0);
    await press(buttonsNamed(r.root, g.results.notNow)[0]!);
    expect(nav.replace).toHaveBeenCalledWith('GuestLater');
    expect(nav.navigate).not.toHaveBeenCalled();
    expect(sent.filter((e) => e.name === 'guest.left')).toEqual([{ name: 'guest.left', payload: { at: 'save' } }]);
  });

  it('Not now opens the Not now card with guest.left { at: save }', async () => {
    const { r, nav } = await showResults();
    await press(buttonsNamed(r.root, g.results.notNow)[0]!);
    expect(nav.replace).toHaveBeenCalledWith('GuestLater');
    expect(sent.filter((e) => e.name === 'guest.left')).toEqual([{ name: 'guest.left', payload: { at: 'save' } }]);
  });
});

describe('GuestLater, the Not now card (8.6)', () => {
  it('the heading names the days (30 with no profile); Add my name opens the save; nothing removed', async () => {
    const nav = navigationDouble();
    const r = await render(<GuestLaterScreen route={{ key: 'l', name: 'GuestLater' } as never} navigation={nav as never} />);
    const heading = byTestId(r.root, 'guest-later-heading')[0] as ReactTestInstance;
    expect(screenTexts(heading)).toEqual([g.later.title(30)]);
    expect(screenTexts(byTestId(r.root, 'guest-later-line')[0]!)).toEqual([g.later.line]);
    expect(filledButtons(r.root)).toEqual([g.later.save]);
    expect(buttonsNamed(r.root, g.later.close)).toHaveLength(1);
    await press(buttonsNamed(r.root, g.later.save)[0]!);
    expect(nav.navigate).toHaveBeenCalledWith('CreateProfile', { firstRun: true, from: 'guest' });
    expect(useGuestStore.getState().record).not.toBeNull();
  });

  it('its first focus is the heading (section 14)', async () => {
    srFocus.length = 0;
    await render(<GuestLaterScreen route={{ key: 'l', name: 'GuestLater' } as never} navigation={navigationDouble() as never} />, {
      createNodeMock: (element) => ({ ...nodeMock(() => undefined), id: (element.props as { 'data-testid'?: string })['data-testid'] }),
    });
    expect(srFocus.map((n) => (n as { id?: string } | null)?.id)).toEqual(['guest-later-heading']);
  });

  it('a back on it (the phone\'s, or the stack\'s) does what Close does: Welcome, never Results; the record stays', async () => {
    const nav = navigationDouble();
    const listeners: BeforeRemove[] = [];
    nav.addListener = vi.fn((type: string, l: BeforeRemove) => {
      if (type === 'beforeRemove') listeners.push(l);
      return () => undefined;
    }) as never;
    await render(<GuestLaterScreen route={{ key: 'l', name: 'GuestLater' } as never} navigation={nav as never} />);
    const out = { prevented: false };
    act(() => listeners.at(-1)!({ data: { action: { type: 'GO_BACK' } }, preventDefault: () => void (out.prevented = true) }));
    expect(out.prevented).toBe(true);
    expect(nav.rootDispatch).toHaveBeenCalledWith({ type: 'RESET', payload: { index: 0, routes: [{ name: 'Onboarding' }] } });
    expect(nav.navigate).not.toHaveBeenCalled();
    expect(nav.replace).not.toHaveBeenCalled();
    expect(useGuestStore.getState().running).toBe(false);
    expect(useGuestStore.getState().record).not.toBeNull();
  });

  it('on an owner device: 7 days, the ask-the-owner line, and Close as the one filled button', async () => {
    useProfileStore.setState({ profiles: [mina], activeId: mina.id });
    const nav = navigationDouble();
    const r = await render(<GuestLaterScreen route={{ key: 'l', name: 'GuestLater' } as never} navigation={nav as never} />);
    expect(screenTexts(byTestId(r.root, 'guest-later-heading')[0]!)).toEqual([g.later.title(7)]);
    expect(screenTexts(byTestId(r.root, 'guest-later-line')[0]!)).toEqual([g.results.askOwner]);
    expect(buttonsNamed(r.root, g.later.save)).toHaveLength(0);
    expect(filledButtons(r.root)).toEqual([g.later.close]);
    await press(buttonsNamed(r.root, g.later.close)[0]!);
    // Close ends the run (the record stays) and the root leaves the Guest stack (the chooser, or Home).
    expect(nav.rootDispatch).toHaveBeenCalledTimes(1);
    expect(useGuestStore.getState().running).toBe(false);
    expect(useGuestStore.getState().record).not.toBeNull();
  });
});

describe('PinEntry { next: SaveGuest }: verify only (8.2, CS-G2, CS-G9, CS-G10)', () => {
  const show = async (nav = navigationDouble()) => {
    const route = { key: 'pin', name: 'PinEntry' as const, params: { next: 'SaveGuest' as const } };
    const r = await render(<PinEntryScreen route={route as never} navigation={nav as never} />);
    await flush();
    return { r, nav };
  };
  const typePin = async (root: ReactTestInstance, pin: string): Promise<void> => {
    for (const digit of pin) await press(buttonsNamed(root, all.a11y.pinDigit(Number(digit)))[0]!);
    await press(buttonsNamed(root, all.caregiver.pin.entry.unlock.cta)[0]!);
    await flush();
  };

  it('a correct PIN opens the form in its place, and opens no grown-up session (no markPinVerified, no openParentGate)', async () => {
    useAccountStore.setState({ parentPinHash: 'h:1234', pinAttempts: { failures: [], lockedUntil: null, strikes: 2 }, pinResetRequestedAt: new Date().toISOString() });
    const { r, nav } = await show();
    expect(buttonsNamed(r.root, all.caregiver.pin.entry.forgot.cta)).toHaveLength(0);
    await typePin(r.root, '1234');
    expect(nav.replace).toHaveBeenCalledWith('CreateProfile', { firstRun: true, from: 'guest' });
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    // As any correct PIN: the strikes reset and a pending reset is cleared.
    expect(useAccountStore.getState().pinAttempts.strikes).toBe(0);
    expect(useAccountStore.getState().pinResetRequestedAt).toBeNull();
    expect(sent.some((e) => e.name === 'parent.gate.opened')).toBe(false);
  });

  it('still asks the PIN with a grown-up session open (CS-G9), and a wrong PIN opens nothing', async () => {
    useAccountStore.setState({ parentPinHash: 'h:1234' });
    useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: Date.now() });
    const { r, nav } = await show();
    expect(buttonsNamed(r.root, all.a11y.pinDigit(1))).toHaveLength(1);
    await typePin(r.root, '9999');
    expect(nav.replace).not.toHaveBeenCalled();
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('Cancel goes back to the save card', async () => {
    useAccountStore.setState({ parentPinHash: 'h:1234' });
    const { r, nav } = await show();
    await press(buttonsNamed(r.root, all.common.buttons.cancel)[0]!);
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('refuses with no PIN stored: back, never a PIN setup (CS-G10)', async () => {
    const { r, nav } = await show();
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    expect(screenTexts(r.root)).not.toContain(all.caregiver.pin.entry.createAgain);
    expect(buttonsNamed(r.root, all.a11y.pinDigit(1))).toHaveLength(0);
    expect(useAccountStore.getState().parentPinHash).toBeNull();
  });
});

describe('CreateProfile { from: guest }, the save form (8.3 to 8.5)', () => {
  const focused: string[] = [];
  const show = async (params: { firstRun: boolean; from: 'guest' } = { firstRun: true, from: 'guest' }, nav = navigationDouble()) => {
    focused.length = 0;
    const r = await render(<CreateProfileScreen route={{ key: 'cp', name: 'CreateProfile', params } as never} navigation={nav as never} />, {
      createNodeMock: (element) => nodeMock(() => void focused.push(String((element.props as { 'aria-label'?: string })['aria-label']))),
    });
    return { r, nav };
  };
  const type = async (root: ReactTestInstance, label: string, text: string): Promise<void> => {
    await act(async () => {
      root.findAll((n) => n.type === TextInput && n.props.accessibilityLabel === label)[0]!.props.onChangeText(text);
    });
  };
  const cont = (root: ReactTestInstance): ReactTestInstance => buttonsNamed(root, c.cta)[0]!;

  it('step 1 of 2: Keep your progress, the Name field and its line; Continue waits for a name; no level, no cub', async () => {
    const { r } = await show();
    expect(screenTexts(byTestId(r.root, 'create-profile-heading')[0]!)).toContain(`${c.step(1, 2)}. ${c.guest.title}`);
    const texts = screenTexts(r.root);
    expect(texts).toContain(c.guest.nameLabel);
    expect(texts).toContain(c.guest.later);
    expect(texts).not.toContain(c.avatarHeading);
    expect(texts).not.toContain(c.title);
    expect(disabled(cont(r.root))).toBe(true);
    expect(texts).toContain(c.missing.name);
    await type(r.root, c.guest.nameLabel, 'Sam');
    expect(disabled(cont(r.root))).toBe(false);
  });

  it('step 2 of 2: who is learning with nothing preselected, lessons.plain even with the level check on, then the card for the answer', async () => {
    const { r } = await show();
    await type(r.root, c.guest.nameLabel, 'Sam');
    await press(cont(r.root));
    expect(screenTexts(byTestId(r.root, 'create-profile-heading')[0]!)).toContain(`${c.step(2, 2)}. ${c.privacy.title}`);
    let texts = screenTexts(r.root);
    expect(texts).toContain(c.title);
    expect(texts).toContain(c.lessons.plain);
    expect(texts).not.toContain(c.lessons.withCheck);
    // Nothing chosen: no agreement card, no Ready, Continue names the answer.
    expect(texts).not.toContain(c.ready.heading);
    expect(texts).not.toContain(c.self.heading);
    expect(texts).toContain(c.missing.who);
    expect(r.root.findAll((n) => typeof n.type === 'string' && n.props['aria-checked'] === true)).toHaveLength(0);
    await press(optionNamed(r.root, c.who.self.label)[0]!);
    texts = screenTexts(r.root);
    expect(texts).toContain(c.self.heading);
    expect(texts).toContain(c.self.pinRow);
    expect(texts).toContain(c.ready.heading);
  });

  it('the email is folded behind Add an email: a disclosure that opens the field (focus moves there) and clears it when closed', async () => {
    const { r } = await show();
    await type(r.root, c.guest.nameLabel, 'Sam');
    await press(cont(r.root));
    await press(optionNamed(r.root, c.who.self.label)[0]!);
    const row = byTestId(r.root, 'create-profile-email-row')[0] as ReactTestInstance;
    expect(row.props['aria-expanded']).toBe(false);
    expect(r.root.findAll((n) => n.type === TextInput && n.props.accessibilityLabel === c.email.label)).toHaveLength(0);
    await press(row);
    expect(byTestId(r.root, 'create-profile-email-row')[0]!.props['aria-expanded']).toBe(true);
    expect(focused).toContain(c.email.label);
    await type(r.root, c.email.label, 'sam@example.com');
    await press(byTestId(r.root, 'create-profile-email-row')[0]!);
    await press(byTestId(r.root, 'create-profile-email-row')[0]!);
    expect(r.root.findAll((n) => n.type === TextInput && n.props.accessibilityLabel === c.email.label)[0]!.props.value).toBe('');
  });

  it('the under-13 latch holds for the form\'s life; Back on step 2 keeps the values; Back on step 1 leaves to the save card', async () => {
    const nav = navigationDouble();
    const listeners: BeforeRemove[] = [];
    nav.addListener = vi.fn((type: string, l: BeforeRemove) => {
      if (type === 'beforeRemove') listeners.push(l);
      return () => undefined;
    }) as never;
    const { r } = await show(undefined, nav);
    await type(r.root, c.guest.nameLabel, 'Sam');
    await press(cont(r.root));
    await press(optionNamed(r.root, c.who.self.label)[0]!);
    await press(buttonsNamed(r.root, c.privacy.under13)[0]!);
    expect(screenTexts(r.root)).toContain(c.privacy.switchedNote);
    expect(screenTexts(r.root)).toContain(c.guardian.heading);
    expect(disabled(optionNamed(r.root, c.who.self.label)[0]!)).toBe(true);
    // A back on step 2 opens step 1 with the name kept.
    const back = (): { prevented: boolean } => {
      const out = { prevented: false };
      act(() => listeners.at(-1)!({ data: { action: { type: 'GO_BACK' } }, preventDefault: () => void (out.prevented = true) }));
      return out;
    };
    expect(back().prevented).toBe(true);
    expect(r.root.findAll((n) => n.type === TextInput && n.props.accessibilityLabel === c.guest.nameLabel)[0]!.props.value).toBe('Sam');
    await press(cont(r.root));
    // Still latched.
    expect(disabled(optionNamed(r.root, c.who.self.label)[0]!)).toBe(true);
    expect(back().prevented).toBe(true);
    // On step 1 the back lets the route go (to the save card underneath).
    expect(back().prevented).toBe(false);
  });

  it('after a verify (a PIN stored, consent held): only the who cards and Ready; Continue promotes the guest with its id and opens Home with one bubble', async () => {
    useAccountStore.setState({ parentPinHash: 'h:1234', guardianConsentAcceptedAt: '2026-10-01T00:00:00.000Z' });
    // The guest holds quest 1's card.
    const cardId = (await import('../../../content')).questById(quest.questId)!.rewardCardId!;
    const at = new Date(T0).toISOString();
    useProgressStore.setState((s) => ({
      byProfile: {
        ...s.byProfile,
        [GUEST_ID]: { profileId: GUEST_ID, updatedAt: at, episodes: [], quests: [], cards: [{ cardId, unlockedAt: at, newSinceLastView: true }], sessions: [], homework: [], reviews: [], streakDays: 0, questDoneAt: {} },
      },
    }));
    expect(cardById(cardId)).toBeDefined();
    noteGuestSaveEntry('results');
    const nav = navigationDouble();
    const { r } = await show({ firstRun: true, from: 'guest' }, nav);
    await type(r.root, c.guest.nameLabel, 'Sam');
    await press(cont(r.root));
    await press(optionNamed(r.root, c.who.child.label)[0]!);
    const texts = screenTexts(r.root);
    expect(texts).not.toContain(c.guardian.heading);
    expect(texts).not.toContain(c.guardian.pinHeading);
    expect(texts).toContain(c.ready.heading);
    await press(cont(r.root));
    await flush();
    await vi.waitFor(() => expect(nav.rootDispatch).toHaveBeenCalledWith({ type: 'RESET', payload: { index: 0, routes: [{ name: 'Main' }] } }));
    const saved = useProfileStore.getState().profiles.find((p) => p.id === GUEST_ID);
    expect(saved).toMatchObject({ displayName: 'Sam', learnerType: 'child', createdAt: new Date(T0).toISOString() });
    expect(useProfileStore.getState().activeId).toBe(GUEST_ID);
    expect(disk.has('guest')).toBe(false);
    expect(useGuestStore.getState().running).toBe(false);
    // The stored PIN is unchanged (CS-G10), and no grown-up session was opened (CS-G2).
    expect(useAccountStore.getState().parentPinHash).toBe('h:1234');
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(sent.filter((e) => e.name === 'guest.saved')).toEqual([{ name: 'guest.saved', payload: { gated: true, consent: 'existing', via: 'results' } }]);
    expect(sent.find((e) => e.name === 'onboarding.started')?.payload).toMatchObject({ firstRun: true, fromGuest: true });
    // No level-check fork: Home, with the bubble once.
    expect(nav.reset).not.toHaveBeenCalled();
    expect(guestSavedNoteFor(GUEST_ID)).toEqual({ card: true });
  });
});

describe('GU-D11: the first-run setup on a device whose only learner is a live guest (8.5)', () => {
  const runSetup = async (nav = navigationDouble()) => {
    const r = await render(<CreateProfileScreen route={{ key: 'cp', name: 'CreateProfile', params: { firstRun: true } } as never} navigation={nav as never} />, {
      createNodeMock: () => nodeMock(() => undefined),
    });
    const radio = (label: string): ReactTestInstance => r.root.findAll((n) => typeof n.type === 'string' && n.props.role === 'radio' && screenTexts(n).includes(label))[0]!;
    // The usual three steps: who, the profile, Privacy.
    expect(screenTexts(byTestId(r.root, 'create-profile-heading')[0]!)).toContain(`${c.step(1, 3)}. ${c.title}`);
    await press(radio(c.who.self.label));
    await press(buttonsNamed(r.root, c.cta)[0]!);
    await act(async () => {
      r.root.findAll((n) => n.type === TextInput && n.props.accessibilityLabel === c.profile.self.nameLabel)[0]!.props.onChangeText('Sam');
    });
    await press(buttonsNamed(r.root, c.cta)[0]!);
    // The email is not folded on this path.
    expect(byTestId(r.root, 'create-profile-email-row')).toHaveLength(0);
    await press(r.root.findAll((n) => typeof n.type === 'string' && n.props.role === 'checkbox')[0]!);
    await press(buttonsNamed(r.root, c.cta)[0]!);
    await flush();
    return { r, nav };
  };

  it('keeps the steps and the fork, and promotes the guest (its id) with guest.saved { via: setup }', async () => {
    useGuestStore.setState({ running: false });
    const nav = navigationDouble();
    await runSetup(nav);
    await vi.waitFor(() => expect(nav.reset).toHaveBeenCalledTimes(1));
    const [state] = nav.reset.mock.calls[0] as [{ routes: Array<{ name: string; params: { profileId: string } }> }];
    expect(state.routes[0]!.params.profileId).toBe(GUEST_ID);
    expect(['PlacementInvite', 'FirstQuestPreview']).toContain(state.routes[0]!.name);
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toEqual([GUEST_ID]);
    expect(disk.has('guest')).toBe(false);
    expect(sent.filter((e) => e.name === 'guest.saved')).toEqual([{ name: 'guest.saved', payload: { gated: false, consent: 'new', via: 'setup' } }]);
    expect(nav.rootDispatch).not.toHaveBeenCalled();
  });

  it('with the switch off, the setup makes a new profile and the record stays', async () => {
    switches.guest = false;
    useGuestStore.setState({ running: false });
    const nav = navigationDouble();
    await runSetup(nav);
    await vi.waitFor(() => expect(nav.reset).toHaveBeenCalledTimes(1));
    const ids = useProfileStore.getState().profiles.map((p) => p.id);
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe(GUEST_ID);
    expect(sent.some((e) => e.name === 'guest.saved')).toBe(false);
  });
});

describe('[GU] Keep as a learner from People on this device (row GU-5, 8.3, 9.2)', () => {
  it('the owner case: the two steps inside the grown-up session; the learner keeps the id, the session and the active learner stay; back to the Grown-up area', async () => {
    const owner: Profile = { ...mina, id: 'profile:owner001', displayName: 'Ana', learnerType: 'self' };
    clearGuestSavedNote();
    disk.set('profiles', JSON.stringify([owner]));
    useProfileStore.setState({ profiles: [owner], activeId: owner.id, hydrated: true });
    useGuestStore.setState({ record: record(), running: false });
    useAccountStore.setState({ parentPinHash: 'h:1234', guardianConsentAcceptedAt: '2026-10-01T00:00:00.000Z', selfConsentAcceptedAt: '2026-10-01T00:00:00.000Z' });
    useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: null });
    const parentNavigate = vi.fn();
    const nav = { ...navigationDouble(), getParent: () => ({ navigate: parentNavigate, dispatch: vi.fn() }) };
    const r = await render(<CreateProfileScreen route={{ key: 'cp', name: 'CreateProfile', params: { firstRun: false, from: 'guest', owner: true } } as never} navigation={nav as never} />, {
      createNodeMock: () => nodeMock(() => undefined),
    });
    expect(screenTexts(r.root)).toContain(c.guest.title);
    await act(async () => {
      r.root.findAll((n) => n.type === TextInput && n.props.accessibilityLabel === c.guest.nameLabel)[0]!.props.onChangeText('Sam');
    });
    await press(buttonsNamed(r.root, c.cta)[0]!);
    await press(optionNamed(r.root, c.who.child.label)[0]!);
    await press(buttonsNamed(r.root, c.cta)[0]!);
    await flush();
    await vi.waitFor(() => expect(parentNavigate).toHaveBeenCalledWith('ParentDashboard'));
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toEqual([owner.id, GUEST_ID]);
    expect(useProfileStore.getState().activeId).toBe(owner.id);
    expect(useUiStore.getState().parentGateOpenedAt).not.toBeNull();
    expect(disk.has('guest')).toBe(false);
    expect(useAccountStore.getState().parentPinHash).toBe('h:1234');
    expect(sent.filter((e) => e.name === 'guest.saved').map((e) => e.payload)).toEqual([{ gated: true, consent: 'existing', via: 'setup' }]);
    expect(sent.find((e) => e.name === 'onboarding.started')?.payload).toMatchObject({ firstRun: false, fromGuest: true });
    // No Hoya bubble for anyone's Home: the grown-up stays in the Grown-up area.
    expect(guestSavedNoteFor(GUEST_ID)).toBeNull();
    expect(nav.rootDispatch).not.toHaveBeenCalled();
  });
});

describe('the gate read again at Continue: another tab changed the device while the form was open (8.2, CS-G9, CS-G10)', () => {
  const PIN_KEY = 'account:parentPinHash';
  const open = async (nav = navigationDouble()) => {
    noteGuestSaveEntry('results');
    const r = await render(<CreateProfileScreen route={{ key: 'cp', name: 'CreateProfile', params: { firstRun: true, from: 'guest' } } as never} navigation={nav as never} />, {
      createNodeMock: () => nodeMock(() => undefined),
    });
    await act(async () => {
      r.root.findAll((n) => n.type === TextInput && n.props.accessibilityLabel === c.guest.nameLabel)[0]!.props.onChangeText('Sam');
    });
    await press(buttonsNamed(r.root, c.cta)[0]!);
    await press(optionNamed(r.root, c.who.self.label)[0]!);
    await press(r.root.findAll((n) => typeof n.type === 'string' && n.props.role === 'checkbox')[0]!);
    return { r, nav };
  };
  const cont = async (r: { root: ReactTestInstance }): Promise<void> => {
    await press(buttonsNamed(r.root, c.cta)[0]!);
    await flush();
  };
  /** Nothing was written for the save: no consent, no PIN, no profile, the guest kept, no guest.saved. */
  const nothingSaved = (): void => {
    expect(useAccountStore.getState().selfConsentAcceptedAt).toBeNull();
    expect(useAccountStore.getState().guardianConsentAcceptedAt).toBeNull();
    expect(useProfileStore.getState().profiles.some((p) => p.id === GUEST_ID)).toBe(false);
    expect(disk.has('guest')).toBe(true);
    expect(sent.some((e) => e.name === 'guest.saved' || e.name === 'onboarding.consent_given')).toBe(false);
  };

  it('open, then a learner added elsewhere (no PIN): back to the save card, which now asks the owner; nothing saved, no PIN set (CS-G10)', async () => {
    const { r, nav } = await open();
    disk.set('profiles', JSON.stringify([mina]));
    await cont(r);
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    expect(nav.rootDispatch).not.toHaveBeenCalled();
    nothingSaved();
    expect(disk.has(PIN_KEY)).toBe(false);
    expect(useAccountStore.getState().parentPinHash).toBeNull();
    // The card under the form now draws the owner case.
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toContain(mina.id);
  });

  it('open, then a PIN set elsewhere: the SaveGuest PIN in the form\'s place, and the stored PIN is untouched (CS-G9)', async () => {
    const { r, nav } = await open();
    disk.set(PIN_KEY, JSON.stringify('h:9999'));
    await cont(r);
    expect(nav.replace).toHaveBeenCalledWith('PinEntry', { next: 'SaveGuest' });
    expect(nav.goBack).not.toHaveBeenCalled();
    nothingSaved();
    expect(JSON.parse(disk.get(PIN_KEY)!)).toBe('h:9999');
    // This tab now knows the PIN, so the save card asks it too.
    expect(useAccountStore.getState().parentPinHash).toBe('h:9999');
    // The leave goes through: the step-back listener does not hold it on step 2.
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
  });

  it('this guest saved in another tab: that learner\'s Home, with nothing written here', async () => {
    // A guest id this test file's tab has never seen as a profile (the merge keeps ids this tab removed out).
    const id = 'profile:guest777';
    disk.set('guest', JSON.stringify(record({ id })));
    useGuestStore.setState({ record: record({ id }) });
    const { r, nav } = await open();
    const saved: Profile = { id, displayName: 'Sam', ageGroup: '8-9', avatar: 'hoya-blue', role: 'learner', createdAt: new Date(T0).toISOString(), learnerType: 'self' };
    disk.set('profiles', JSON.stringify([saved]));
    await cont(r);
    await vi.waitFor(() => expect(nav.rootDispatch).toHaveBeenCalledWith({ type: 'RESET', payload: { index: 0, routes: [{ name: 'Main' }] } }));
    expect(useProfileStore.getState().activeId).toBe(id);
    expect(useAccountStore.getState().selfConsentAcceptedAt).toBeNull();
    expect(sent.some((e) => e.name === 'guest.saved')).toBe(false);
    expect(disk.has('guest')).toBe(false);
    expect(guestSavedNoteFor(id)).toEqual({ card: false });
  });

  it('the profile list cannot be read: nothing is written and the form says so (fail closed)', async () => {
    const storage = await import('../../../platform/storage');
    const { r, nav } = await open();
    vi.mocked(storage.readJsonStrict).mockRejectedValueOnce(new Error('blocked'));
    await cont(r);
    expect(byTestId(r.root, 'create-profile-save-error')).toHaveLength(1);
    expect(nav.goBack).not.toHaveBeenCalled();
    nothingSaved();
  });

  it('with nothing changed, the save goes on', async () => {
    const { r, nav } = await open();
    await cont(r);
    await vi.waitFor(() => expect(nav.rootDispatch).toHaveBeenCalledTimes(1));
    expect(sent.filter((e) => e.name === 'guest.saved')).toEqual([{ name: 'guest.saved', payload: { gated: false, consent: 'new', via: 'results' } }]);
  });
});

describe('the guest\'s Results with no save card', () => {
  it('a back opens the Not now card without guest.left (the save was never offered)', async () => {
    useGuestStore.setState({ record: record({ questDone: false }) });
    const nav = navigationDouble();
    const listeners: BeforeRemove[] = [];
    nav.addListener = vi.fn((type: string, l: BeforeRemove) => {
      if (type === 'beforeRemove') listeners.push(l);
      return () => undefined;
    }) as never;
    const route = { key: 'r', name: 'Results', params: { questId: quest.questId, episodeId: quest.episodeId, stars: 0, correct: 0, total: 0 } };
    const r = await render(inGuest(<GuestResults route={route as never} navigation={nav as never} />));
    await flush();
    expect(byTestId(r.root, 'guest-save-card')).toHaveLength(0);
    act(() => listeners.at(-1)!({ data: { action: { type: 'GO_BACK' } }, preventDefault: () => undefined }));
    expect(nav.replace).toHaveBeenCalledWith('GuestLater');
    expect(sent.some((e) => e.name === 'guest.left')).toBe(false);
  });
});
