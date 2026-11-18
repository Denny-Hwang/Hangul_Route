import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { TextInput } from 'react-native';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [FN] AMENDMENTS-FINISH-2026-11 FN-1 (audit SEC-7; wireframe onboarding/all-ages-onboarding.md box G2, mock
 * design/screens/profiles/pin-reset-check.md): the two offline ways of Forgot PIN? (a matching Rescue Code, the
 * finished 24-hour wait) ask a number written out in words, typed as digits, before the new-PIN screen; a miss changes
 * nothing but the number; signing in asks none.
 */
vi.mock('@react-navigation/native', async () => {
  const { createContext } = await import('react');
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
vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../../../platform/online', () => ({ isOnline: () => false, subscribeOnline: () => () => undefined }));
vi.mock('../../../platform/pin-reset', () => ({ takePinResetTicket: () => null, openPinResetSignIn: vi.fn(async () => undefined) }));

import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useSyncStore } from '../../../store/sync-store';
import { byTestId, buttonsNamed, cleanup, press, render, resetPlatform, screenTexts, setPlatform, textOf } from '../../../test-support/render';
import { PinEntryScreen } from '../PinEntryScreen';
import { PinResetScreen } from '../PinResetScreen';

const m = getMessages('en').caregiver.pin;
const CONTINUE = getMessages('en').common.buttons.continue;
const CODE = 'TIGER-MOON-RIVER-APPLE-482139';
const DAY_MS = 24 * 60 * 60 * 1000;

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

const nodeMock = { createNodeMock: () => ({ focus: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined }) };

async function showReset(navigation = nav()) {
  const route = { key: 'reset', name: 'PinReset' as const, params: { next: 'ParentDashboard' as const } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the screen reads only what `nav()` provides
  const r = await render(<PinResetScreen route={route} navigation={navigation as any} />, nodeMock);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { r, navigation };
}

function field(root: ReactTestInstance, testID: string): ReactTestInstance {
  const found = root.findAll((n) => n.type === TextInput && n.props.testID === testID);
  expect(found, testID).toHaveLength(1);
  return found[0]!;
}

async function type(root: ReactTestInstance, testID: string, text: string): Promise<void> {
  await act(async () => field(root, testID).props.onChangeText(text));
}

const words = (root: ReactTestInstance): string => textOf(byTestId(root, 'pin-reset-check-words')[0]!);

/** The digits of the number on screen, found by writing every number out (the test reads the words like a person). */
function answerOf(root: ReactTestInstance, locale: 'en' | 'es' | 'ko' = 'en'): string {
  const shown = words(root);
  const say = getMessages(locale).caregiver.pin.reset.check.words;
  for (let n = 100; n <= 999; n += 1) if (say(n) === shown) return String(n);
  throw new Error(`no number reads "${shown}"`);
}

async function pressContinue(root: ReactTestInstance): Promise<void> {
  const [button] = byTestId(root, 'pin-reset-check-continue');
  await press(button!);
}

async function waitReadyCheck() {
  useAccountStore.setState({ pinResetRequestedAt: new Date(Date.now() - DAY_MS - 60_000).toISOString() });
  const shown = await showReset();
  await press(buttonsNamed(shown.r.root, m.reset.wait.ready.button)[0]!);
  return shown;
}

const sync = useSyncStore.getState();

beforeEach(() => {
  setPlatform('web');
  // The text fields are DOM inputs on the web build and read the focused element.
  vi.stubGlobal('document', { activeElement: null });
  disk.clear();
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useProfileStore.setState({ profiles: [learner], activeId: learner.id, hydrated: true });
  useAccountStore.setState({
    parentPinHash: 'h:1234',
    pinResetRequestedAt: null,
    pinAttempts: { failures: [], lockedUntil: null, strikes: 0 },
    rescueAttempts: { failures: [], lockedUntil: null, strikes: 0 },
  });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useSyncStore.setState({ byLearner: sync.byLearner, hydrate: sync.hydrate });
});

describe('the 24-hour wait asks the check', () => {
  it('Set a new PIN shows the number in words, not the new-PIN screen', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { r, navigation } = await waitReadyCheck();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(byTestId(r.root, 'pin-reset-check')).not.toHaveLength(0);
    const texts = screenTexts(r.root);
    expect(texts).toEqual(expect.arrayContaining([m.reset.title, m.reset.check.heading, m.reset.check.prompt]));
    expect(words(r.root)).toBe('five hundred fifty');
    // The number never shows as digits, and the reset ways are gone while the check is up.
    expect(texts.join(' ')).not.toMatch(/550/);
    expect(texts).not.toContain(m.reset.wait.heading);
    expect(field(r.root, 'pin-reset-check-input').props.accessibilityLabel ?? field(r.root, 'pin-reset-check-input').props['aria-label']).toBe(m.reset.check.fieldLabel);
    // Continue waits for a digit; no miss line yet.
    expect(byTestId(r.root, 'pin-reset-check-continue')[0]!.props['aria-disabled']).toBe(true);
    expect(byTestId(r.root, 'pin-reset-check-line')).toHaveLength(0);
  });

  it('the right number opens the new-PIN screen with via wait', async () => {
    const { r, navigation } = await waitReadyCheck();
    await type(r.root, 'pin-reset-check-input', answerOf(r.root));
    await pressContinue(r.root);
    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith('PinEntry', { next: 'ParentDashboard', mode: 'setup', via: 'wait' });
  });

  it('a miss changes nothing but the number: a new one, the field cleared, the calm line; no count, no lock', async () => {
    const { pinAttempts, rescueAttempts } = useAccountStore.getState();
    const before = structuredClone({ pinAttempts, rescueAttempts });
    const { r, navigation } = await waitReadyCheck();
    const requestedAt = useAccountStore.getState().pinResetRequestedAt;
    for (let i = 0; i < 12; i += 1) {
      const shown = words(r.root);
      const right = Number(answerOf(r.root));
      await type(r.root, 'pin-reset-check-input', String(right === 999 ? 100 : right + 1));
      await pressContinue(r.root);
      expect(navigation.replace).not.toHaveBeenCalled();
      expect(words(r.root)).not.toBe(shown);
      expect(field(r.root, 'pin-reset-check-input').props.value).toBe('');
      expect(screenTexts(byTestId(r.root, 'pin-reset-check-line')[0]!)).toEqual([m.reset.check.again]);
    }
    // Nothing counts the misses: the PIN's and the Rescue Code's attempt states, and the wait, are as they were.
    const after = useAccountStore.getState();
    expect(after.pinAttempts).toEqual(before.pinAttempts);
    expect(after.rescueAttempts).toEqual(before.rescueAttempts);
    expect(after.pinResetRequestedAt).toBe(requestedAt);
    expect(screenTexts(r.root).join(' ')).not.toMatch(/\d/);
    // Still answerable after many misses.
    await type(r.root, 'pin-reset-check-input', answerOf(r.root));
    await pressContinue(r.root);
    expect(navigation.replace).toHaveBeenCalledWith('PinEntry', { next: 'ParentDashboard', mode: 'setup', via: 'wait' });
  });

  it('Spanish and Korean write the number in their own words', async () => {
    for (const locale of ['es', 'ko'] as const) {
      vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
      useLocaleStore.setState({ device: locale, byProfile: {} });
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      useAccountStore.setState({ pinResetRequestedAt: new Date(Date.now() - DAY_MS - 60_000).toISOString() });
      const { r } = await showReset();
      await press(buttonsNamed(r.root, getMessages(locale).caregiver.pin.reset.wait.ready.button)[0]!);
      expect(words(r.root)).toBe(getMessages(locale).caregiver.pin.reset.check.words(550));
      expect(screenTexts(r.root)).toContain(getMessages(locale).caregiver.pin.reset.check.prompt);
      await cleanup();
    }
  });
});

describe('the Rescue Code asks the check', () => {
  it('a matching code shows the check; only its right answer opens setup with via rescue_code', async () => {
    const byLearner = { [learner.id]: { rescueCode: CODE } } as unknown as typeof sync.byLearner;
    useSyncStore.setState({ byLearner, hydrate: (async () => byLearner[learner.id]) as typeof sync.hydrate });
    const { r, navigation } = await showReset();
    await type(r.root, 'pin-reset-code-input', CODE);
    await press(buttonsNamed(r.root, CONTINUE)[0]!);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screenTexts(r.root)).toContain(m.reset.check.heading);
    expect(screenTexts(r.root)).not.toContain(m.reset.code.heading);
    // The code's own counter recorded the success, as before.
    expect(useAccountStore.getState().rescueAttempts.failures).toEqual([]);
    await type(r.root, 'pin-reset-check-input', answerOf(r.root));
    await pressContinue(r.root);
    expect(navigation.replace).toHaveBeenCalledWith('PinEntry', { next: 'ParentDashboard', mode: 'setup', via: 'rescue_code' });
  });
});

describe('signing in asks no check', () => {
  it("the console ticket's new-PIN screen opens the pad directly", async () => {
    const route = { key: 'pin', name: 'PinEntry' as const, params: { next: 'ParentDashboard' as const, mode: 'setup' as const, via: 'sign_in' as const } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the screen reads only what `nav()` provides
    const r = await render(<PinEntryScreen route={route} navigation={nav() as any} />);
    expect(byTestId(r.root, 'pin-reset-check')).toHaveLength(0);
    expect(buttonsNamed(r.root, getMessages('en').a11y.pinDigit(1))).not.toHaveLength(0);
  });
});
