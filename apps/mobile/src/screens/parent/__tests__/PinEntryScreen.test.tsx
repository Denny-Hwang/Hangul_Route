import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-2 (sections 8.3, 14; CS-8, CS-16, CS-21; wireframe
 * `profiles/pin-entry-v2.md`, mock `design/screens/profiles/pin-entry-v2.md`): the PIN screen during a pause,
 * rendered through react-native-web. Minutes from a minute on; the help line from the 3rd pause on the Grown-up
 * area only; a restart keeps the pause; two tabs share one count; the events carry codes only.
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
const tracked = vi.hoisted(() => [] as { name: string; payload?: Record<string, unknown>; profileId?: string }[]);
vi.mock('../../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string }) => {
    tracked.push(event);
    return true;
  }),
}));

const handoff = vi.hoisted(() => ({ continued: [] as unknown[] }));
vi.mock('../../../platform/grown-up-handoff', () => ({
  openGrownUpArea: vi.fn(async () => 'opened'),
  continueToGrownUpPage: vi.fn((target: unknown) => void handoff.continued.push(target)),
  clearGrownUpTab: vi.fn(),
}));

import { flags } from '../../../config/flags';
import { useAccountStore } from '../../../store/account-store';
import { useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { pinHasher } from '../../../platform/crypto';
import { PinEntryScreen } from '../PinEntryScreen';

const m = getMessages('en').caregiver.pin;
const a11y = getMessages('en').a11y;
const buttons = getMessages('en').common.buttons;

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

type Next = 'ParentDashboard' | 'AddProfile' | 'Paywall' | 'EditProfile';

async function show(next: Next, navigation = nav()) {
  const route = { key: 'pin', name: 'PinEntry' as const, params: { next } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the screen reads only what `nav()` provides
  const r = await render(<PinEntryScreen route={route} navigation={navigation as any} />);
  // Let the attempt refresh on arrival land.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { r, navigation };
}

const pauseFor = (ms: number, strikes: number) => ({ failures: [], lockedUntil: Date.now() + ms, strikes, lastMissAt: Date.now() });

async function typePin(root: ReactTestInstance, pin: string): Promise<void> {
  for (const digit of pin) {
    const [key] = buttonsNamed(root, a11y.pinDigit(Number(digit)));
    await press(key as ReactTestInstance);
  }
  const [unlock] = buttonsNamed(root, m.entry.unlock.cta);
  await press(unlock as ReactTestInstance);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  setPlatform('web');
  disk.clear();
  tracked.length = 0;
  useProfileStore.setState({ profiles: [learner], activeId: learner.id, hydrated: true });
  useAccountStore.setState({ parentPinHash: 'h:1234', pinAttempts: { failures: [], lockedUntil: null, strikes: 0 }, rescueAttempts: { failures: [], lockedUntil: null, strikes: 0 } });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null, gateReturnPending: false });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
});

describe('PinEntry during a pause', () => {
  it('a pause of a minute or more reads in minutes; the help line shows from the 3rd pause on the Grown-up area', async () => {
    const state = pauseFor(5 * 60_000, 3);
    disk.set('account:pinAttempts', state);
    useAccountStore.setState({ pinAttempts: state });
    const { r } = await show('ParentDashboard');
    const texts = screenTexts(r.root);
    expect(texts).toContain("Let's take a short break. Try again in 5 min.");
    expect(texts).toContain(m.cooldownHelp);
    expect(byTestId(r.root, 'pin-pause-help')).toHaveLength(1);
    // The pad and Unlock are paused; Cancel and Forgot PIN? stay usable (no hard lock).
    expect(buttonsNamed(r.root, a11y.pinDigit(1))[0]?.props['aria-disabled']).toBe(true);
    expect(buttonsNamed(r.root, m.entry.forgot.cta)[0]?.props['aria-disabled']).not.toBe(true);
    // The screen reader hears it in a polite live region; the visible line is hidden from it.
    const [live] = byTestId(r.root, 'pin-pause-live');
    expect(live?.props['aria-live']).toBe('polite');
    expect(screenTexts(live as ReactTestInstance)).toEqual(["Let's take a short break. Try again in 5 min."]);
    expect(byTestId(r.root, 'pin-pause-line')[0]?.props['aria-hidden']).toBe(true);
  });

  it('no help line before the 3rd pause, nor on any other destination', async () => {
    const early = pauseFor(2 * 60_000, 2);
    useAccountStore.setState({ pinAttempts: early });
    disk.set('account:pinAttempts', early);
    let shown = await show('ParentDashboard');
    expect(screenTexts(shown.r.root)).toContain("Let's take a short break. Try again in 2 min.");
    expect(byTestId(shown.r.root, 'pin-pause-help')).toHaveLength(0);
    await cleanup();
    for (const next of ['AddProfile', 'Paywall', 'EditProfile'] as const) {
      const late = pauseFor(60 * 60_000, 5);
      useAccountStore.setState({ pinAttempts: late });
      disk.set('account:pinAttempts', late);
      shown = await show(next);
      expect(screenTexts(shown.r.root), next).toContain("Let's take a short break. Try again in 60 min.");
      expect(screenTexts(shown.r.root), next).not.toContain(m.cooldownHelp);
      await cleanup();
    }
  });

  it('under a minute it counts seconds', async () => {
    const state = pauseFor(30_000, 1);
    useAccountStore.setState({ pinAttempts: state });
    disk.set('account:pinAttempts', state);
    const { r } = await show('ParentDashboard');
    expect(screenTexts(r.root)).toContain("Let's take a short break. Try again in 30s.");
  });

  it('a restart keeps the pause: the stored state is read back at hydrate and shown', async () => {
    disk.set('account:pinAttempts', pauseFor(15 * 60_000, 4));
    disk.set('account:parentPinHash', 'h:1234');
    useAccountStore.setState({ pinAttempts: { failures: [], lockedUntil: null, strikes: 0 } });
    await useAccountStore.getState().hydrate();
    const { r } = await show('ParentDashboard');
    expect(screenTexts(r.root)).toContain("Let's take a short break. Try again in 15 min.");
  });

  it('two tabs share one count: 4 misses stored by another tab, one here, and both are paused', async () => {
    const now = Date.now();
    disk.set('account:pinAttempts', { failures: [now - 4, now - 3, now - 2, now - 1], lockedUntil: null, strikes: 0, lastMissAt: now - 1 });
    const { r } = await show('ParentDashboard');
    await typePin(r.root, '9999');
    expect(screenTexts(r.root)).toContain("Let's take a short break. Try again in 30s.");
    expect((disk.get('account:pinAttempts') as { lockedUntil: number }).lockedUntil).toBeGreaterThan(now);
    const paused = tracked.find((e) => e.name === 'pin.paused');
    expect(paused).toEqual({ name: 'pin.paused', payload: { step: 1 } });
  });

  it('a correct PIN sends parent.gate.opened with codes only and resets the steps', async () => {
    useAccountStore.setState({ pinAttempts: { failures: [], lockedUntil: null, strikes: 3, lastMissAt: Date.now() - 1000 } });
    disk.set('account:pinAttempts', useAccountStore.getState().pinAttempts);
    const { r, navigation } = await show('ParentDashboard');
    await typePin(r.root, '1234');
    expect(navigation.replace).toHaveBeenCalledWith('ParentDashboard');
    expect(useAccountStore.getState().pinAttempts.strikes).toBe(0);
    const opened = tracked.find((e) => e.name === 'parent.gate.opened');
    expect(opened?.payload).toEqual({ dest: 'area', via: 'pin', marker: 'pin' });
    expect(opened && 'profileId' in opened).toBe(false);
  });
});

async function showWith(params: Record<string, unknown>, navigation = nav()) {
  const route = { key: 'pin', name: 'PinEntry' as const, params };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the screen reads only what `nav()` provides
  const r = await render(<PinEntryScreen route={route as any} navigation={navigation as any} />);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { r, navigation };
}

describe('[OA] PinEntry hand-backs and Change PIN', () => {
  it('CS-1: a PIN for an action on the screen that asked goes back with the gate open and marks that one return', async () => {
    const { r, navigation } = await showWith({ next: 'ExternalLink', url: 'https://example.org' });
    await typePin(r.root, '1234');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().parentGateOpenedAt).not.toBeNull();
    expect(useUiStore.getState().gateReturnPending).toBe(true);
  });

  it('Cancel goes back without a return mark', async () => {
    const { r, navigation } = await showWith({ next: 'ExternalLink' });
    await press(buttonsNamed(r.root, buttons.cancel)[0] as ReactTestInstance);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().gateReturnPending).toBe(false);
  });

  it("OA-D21: mode 'change' asks the current PIN first, then opens creation instead of the destination", async () => {
    const { r, navigation } = await showWith({ next: 'ParentDashboard', mode: 'change' });
    expect(buttonsNamed(r.root, m.entry.unlock.cta)).toHaveLength(1);
    await typePin(r.root, '1234');
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(buttonsNamed(r.root, buttons.next)).toHaveLength(1);
    expect(useUiStore.getState().lastPinVerifiedAt).not.toBeNull();
  });

  it('a check that cannot finish is no miss: the entry clears and the pad stays usable', async () => {
    const spy = vi.spyOn(pinHasher, 'verify').mockRejectedValueOnce(new Error('crypto unavailable'));
    try {
      const { r, navigation } = await showWith({ next: 'ParentDashboard' });
      await typePin(r.root, '1234');
      expect(navigation.replace).not.toHaveBeenCalled();
      expect(useAccountStore.getState().pinAttempts.failures).toEqual([]);
      expect(buttonsNamed(r.root, a11y.pinDigit(1))[0]?.props['aria-disabled']).not.toBe(true);
      await typePin(r.root, '1234');
      expect(navigation.replace).toHaveBeenCalledWith('ParentDashboard');
    } finally {
      spy.mockRestore();
    }
  });
});

async function typeNew(root: ReactTestInstance, pin: string): Promise<void> {
  for (const digit of pin) {
    const [key] = buttonsNamed(root, a11y.pinDigit(Number(digit)));
    await press(key as ReactTestInstance);
  }
  await press(buttonsNamed(root, buttons.next)[0] as ReactTestInstance);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// [OA] OA-2 review round 2.
describe('[OA] PinEntry: the creation pad, Change PIN, the kill switch and the no-PIN gate', () => {
  it('CS-8: after a Rescue Code accepted during a pause the new-PIN pad is usable; the new PIN clears the pause', async () => {
    const state = pauseFor(60 * 60_000, 5);
    disk.set('account:pinAttempts', state);
    useAccountStore.setState({ pinAttempts: state });
    const { r, navigation } = await showWith({ next: 'ParentDashboard', mode: 'setup', via: 'code' });
    expect(screenTexts(r.root)).not.toContain("Let's take a short break. Try again in 60 min.");
    expect(byTestId(r.root, 'pin-pause-help')).toHaveLength(0);
    expect(buttonsNamed(r.root, a11y.pinDigit(1))[0]?.props['aria-disabled']).not.toBe(true);
    await typeNew(r.root, '5678');
    await typeNew(r.root, '5678');
    expect(useAccountStore.getState().parentPinHash).toBe('h:5678');
    expect(useAccountStore.getState().pinAttempts).toEqual({ failures: [], lockedUntil: null, strikes: 0 });
    expect(navigation.replace).toHaveBeenCalledWith('ParentDashboard');
  });

  it('OA-D21: Change PIN from the notice goes back to the dashboard that asked, and sends one gate event', async () => {
    const { r, navigation } = await showWith({ next: 'ParentDashboard', mode: 'change', returnAfterSet: true });
    await typePin(r.root, '1234');
    await typeNew(r.root, '2468');
    await typeNew(r.root, '2468');
    expect(useAccountStore.getState().parentPinHash).toBe('h:2468');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(useUiStore.getState().parentGateOpenedAt).not.toBeNull();
    expect(tracked.filter((e) => e.name === 'parent.gate.opened')).toHaveLength(1);
  });

  it('the kill switch off (flat 30 s pause): no help line, however many pauses', async () => {
    const original = flags.pinPauseStepsEnabled;
    flags.pinPauseStepsEnabled = false;
    try {
      const state = pauseFor(30_000, 5);
      disk.set('account:pinAttempts', state);
      useAccountStore.setState({ pinAttempts: state });
      const { r } = await show('ParentDashboard');
      expect(screenTexts(r.root)).toContain("Let's take a short break. Try again in 30s.");
      expect(byTestId(r.root, 'pin-pause-help')).toHaveLength(0);
    } finally {
      flags.pinPauseStepsEnabled = original;
    }
  });

  it('section 15: the Grown-up area with no PIN stored sends parent.gate.opened via open on Continue', async () => {
    useAccountStore.setState({ parentPinHash: null });
    handoff.continued.length = 0;
    const { r } = await showWith({ next: 'GrownUpArea', url: '/parent' });
    await press(buttonsNamed(r.root, getMessages('en').caregiver.grownUpHome.continue.cta)[0] as ReactTestInstance);
    expect(handoff.continued).toEqual(['/parent']);
    const opened = tracked.filter((e) => e.name === 'parent.gate.opened');
    expect(opened).toHaveLength(1);
    expect(opened[0]?.payload).toMatchObject({ dest: 'use', via: 'open' });
  });
});

