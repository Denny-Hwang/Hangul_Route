import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-9 (section 8.6; CS-8, CS-13, CS-18; mock
 * `design/screens/profiles/pin-entry-v2.md` boards 1, 3 and 6, decision D9): Use face or fingerprint on the PIN
 * screen. Above the pad (which stays) in verify mode only; a success opens the destination, also during a pause,
 * and resets the strikes; a cancel is not a miss; an enrolment change turns it off and shows the changed line.
 */

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
  track: vi.fn(async (event: { name: string }) => {
    tracked.push(event);
    return true;
  }),
}));
const port = vi.hoisted(() => ({
  available: vi.fn(async () => true),
  write: vi.fn(async (): Promise<'written' | 'cancelled' | 'unavailable'> => 'written'),
  read: vi.fn(async (): Promise<'ok' | 'invalidated' | 'cancelled'> => 'ok'),
  remove: vi.fn(async () => undefined),
}));
vi.mock('../../../platform/biometric', () => ({ biometric: port }));

import { flags } from '../../../config/flags';
import { useAccountStore } from '../../../store/account-store';
import { useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { PinEntryScreen } from '../PinEntryScreen';

const m = getMessages('en').caregiver.pin;
const a11y = getMessages('en').a11y;
const EPOCH = 1_800_000_000_000;
const ON = { v: 1 as const, enabledAt: EPOCH + 1, epoch: EPOCH };

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

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function show(params: { next: 'ParentDashboard' | 'AddProfile' | 'BiometricShortcut'; mode?: 'setup' }, navigation = nav()) {
  const route = { key: 'pin', name: 'PinEntry' as const, params };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the screen reads only what `nav()` provides
  const r = await render(<PinEntryScreen route={route} navigation={navigation as any} />);
  // The attempt refresh and the availability check land.
  await settle();
  await settle();
  return { r, navigation };
}

const cta = (root: ReactTestInstance) => buttonsNamed(root, m.biometric.cta);

async function tapCta(root: ReactTestInstance): Promise<void> {
  await press(cta(root)[0] as ReactTestInstance);
  await settle();
}

const pause = () => ({ failures: [], lockedUntil: Date.now() + 15 * 60_000, strikes: 4, lastMissAt: Date.now() });

beforeEach(() => {
  setPlatform('ios');
  disk.clear();
  tracked.length = 0;
  vi.clearAllMocks();
  port.available.mockResolvedValue(true);
  port.read.mockResolvedValue('ok');
  port.write.mockResolvedValue('written');
  flags.biometricShortcutEnabled = true;
  useProfileStore.setState({ profiles: [learner], activeId: learner.id, hydrated: true });
  useAccountStore.setState({
    parentPinHash: 'h:1234',
    pinSetAt: EPOCH,
    biometricShortcut: ON,
    pinResetRequestedAt: null,
    pinAttempts: { failures: [], lockedUntil: null, strikes: 0 },
    rescueAttempts: { failures: [], lockedUntil: null, strikes: 0 },
  });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
  flags.biometricShortcutEnabled = true;
});

describe('[OA] Use face or fingerprint on the PIN screen', () => {
  it('shows above the pad in verify mode; the pad and Unlock stay', async () => {
    const { r } = await show({ next: 'ParentDashboard' });
    expect(cta(r.root)).toHaveLength(1);
    expect(buttonsNamed(r.root, a11y.pinDigit(1))).toHaveLength(1);
    expect(buttonsNamed(r.root, m.entry.unlock.cta)).toHaveLength(1);
    const texts = screenTexts(r.root);
    expect(texts.indexOf(m.biometric.cta)).toBeLessThan(texts.indexOf('1'));
  });

  it('is absent with the flag off, without strong biometrics, for another PIN epoch, or when never turned on', async () => {
    const cases: (() => void)[] = [
      () => void (flags.biometricShortcutEnabled = false),
      () => void port.available.mockResolvedValue(false),
      () => useAccountStore.setState({ pinSetAt: EPOCH + 1 }),
      () => useAccountStore.setState({ biometricShortcut: null }),
    ];
    for (const arrange of cases) {
      arrange();
      const { r } = await show({ next: 'ParentDashboard' });
      expect(cta(r.root)).toHaveLength(0);
      await cleanup();
      flags.biometricShortcutEnabled = true;
      port.available.mockResolvedValue(true);
      useAccountStore.setState({ pinSetAt: EPOCH, biometricShortcut: ON });
    }
  });

  it('never in setup: it never sets, changes or resets the PIN', async () => {
    const { r } = await show({ next: 'ParentDashboard', mode: 'setup' });
    expect(cta(r.root)).toHaveLength(0);
  });

  it('a success opens the destination as a correct PIN does (via biometric), and the PIN is untouched', async () => {
    useAccountStore.setState({ pinResetRequestedAt: '2026-10-21T00:00:00.000Z' });
    const { r, navigation } = await show({ next: 'ParentDashboard' });
    await tapCta(r.root);
    expect(port.read).toHaveBeenCalledWith(m.biometric.cta);
    expect(navigation.replace).toHaveBeenCalledWith('ParentDashboard');
    expect(useUiStore.getState().parentGateOpenedAt).not.toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).not.toBeNull();
    // A correct PIN settles a pending Forgot PIN wait.
    expect(useAccountStore.getState().pinResetRequestedAt).toBeNull();
    expect(useAccountStore.getState().parentPinHash).toBe('h:1234');
    expect(tracked.find((e) => e.name === 'parent.gate.opened')?.payload).toMatchObject({ dest: 'area', via: 'biometric' });
  });

  it('works during a pause: opens the destination and resets the strikes (CS-8)', async () => {
    const state = pause();
    disk.set('account:pinAttempts', state);
    useAccountStore.setState({ pinAttempts: state });
    const { r, navigation } = await show({ next: 'AddProfile' });
    expect(buttonsNamed(r.root, a11y.pinDigit(1))[0]?.props['aria-disabled']).toBe(true);
    expect(cta(r.root)[0]?.props['aria-disabled']).not.toBe(true);
    await tapCta(r.root);
    expect(navigation.replace).toHaveBeenCalledWith('Onboarding', { screen: 'CreateProfile', params: { firstRun: false } });
    expect(useAccountStore.getState().pinAttempts).toEqual({ failures: [], lockedUntil: null, strikes: 0 });
  });

  it('a cancel or failed match is not a miss: the pad as it was, the pause unchanged', async () => {
    const state = pause();
    disk.set('account:pinAttempts', state);
    useAccountStore.setState({ pinAttempts: state });
    port.read.mockResolvedValueOnce('cancelled');
    const { r, navigation } = await show({ next: 'ParentDashboard' });
    await tapCta(r.root);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(useAccountStore.getState().pinAttempts).toEqual(state);
    expect(cta(r.root)).toHaveLength(1);
    expect(screenTexts(r.root)).not.toContain(m.biometric.changed);
  });

  it('an enrolment change turns it off, the button goes and the changed line takes the subtitle place (CS-18)', async () => {
    port.read.mockResolvedValueOnce('invalidated');
    const { r, navigation } = await show({ next: 'ParentDashboard' });
    await tapCta(r.root);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(useAccountStore.getState().biometricShortcut).toBeNull();
    expect(port.remove).toHaveBeenCalled();
    expect(cta(r.root)).toHaveLength(0);
    expect(byTestId(r.root, 'pin-biometric-changed')).toHaveLength(1);
    expect(screenTexts(r.root)).toContain(m.biometric.changed);
    // In the subtitle's place, in the flow (it is longer than the subtitle, so it never covers the button or the dots).
    expect(screenTexts(r.root)).not.toContain(m.entry.verifySubtitle);
    expect(byTestId(r.root, 'pin-biometric-changed')[0]?.props.style).not.toMatchObject({ position: 'absolute' });
    expect(tracked.find((e) => e.name === 'pin.biometric_changed')?.payload).toEqual({ on: false, reason: 'enrolment_changed' });
    // The pad still takes the PIN.
    expect(buttonsNamed(r.root, a11y.pinDigit(1))[0]?.props['aria-disabled']).not.toBe(true);
  });

  it('during a pause the changed line goes under the pause line', async () => {
    const state = pause();
    disk.set('account:pinAttempts', state);
    useAccountStore.setState({ pinAttempts: state });
    port.read.mockResolvedValueOnce('invalidated');
    const { r } = await show({ next: 'ParentDashboard' });
    await tapCta(r.root);
    const texts = screenTexts(r.root);
    expect(texts).toContain(m.biometric.changed);
    expect(byTestId(r.root, 'pin-pause-line')).toHaveLength(1);
  });
});

describe('[OA] destination BiometricShortcut (the Grown-up area switch asked for a fresh PIN)', () => {
  it('a correct PIN turns the shortcut on for this PIN and goes back', async () => {
    useAccountStore.setState({ biometricShortcut: null });
    const { r, navigation } = await show({ next: 'BiometricShortcut' });
    expect(cta(r.root)).toHaveLength(0);
    for (const digit of '1234') await press(buttonsNamed(r.root, a11y.pinDigit(Number(digit)))[0] as ReactTestInstance);
    await press(buttonsNamed(r.root, m.entry.unlock.cta)[0] as ReactTestInstance);
    await settle();
    expect(port.write).toHaveBeenCalledWith(m.biometric.cta);
    expect(useAccountStore.getState().biometricShortcut).toMatchObject({ v: 1, epoch: EPOCH });
    expect(navigation.goBack).toHaveBeenCalled();
    expect(tracked.find((e) => e.name === 'pin.biometric_changed')?.payload).toEqual({ on: true, reason: 'user' });
  });

  it('a wrong PIN turns nothing on', async () => {
    useAccountStore.setState({ biometricShortcut: null });
    const { r, navigation } = await show({ next: 'BiometricShortcut' });
    for (const digit of '9999') await press(buttonsNamed(r.root, a11y.pinDigit(Number(digit)))[0] as ReactTestInstance);
    await press(buttonsNamed(r.root, m.entry.unlock.cta)[0] as ReactTestInstance);
    await settle();
    expect(port.write).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
