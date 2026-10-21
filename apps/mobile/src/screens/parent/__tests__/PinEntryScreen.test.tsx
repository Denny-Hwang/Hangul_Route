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

import { useAccountStore } from '../../../store/account-store';
import { useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { PinEntryScreen } from '../PinEntryScreen';

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
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
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
