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
  return {
    goBack: vi.fn(),
    replace: vi.fn(),
    navigate: vi.fn(),
    reset: vi.fn(),
    addListener: vi.fn(() => () => undefined),
    setOptions: vi.fn(),
    getState: vi.fn((): { index: number; routes: { key: string; name: string; params?: unknown }[] } => ({ index: 0, routes: [{ key: 'pin', name: 'PinEntry' }] })),
  };
}

type Next = 'ParentDashboard' | 'AddProfile' | 'Paywall' | 'EditProfile' | 'CancelReset';

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
  useAccountStore.setState({ parentPinHash: 'h:1234', pinHashReadFailed: false, pinAttempts: { failures: [], lockedUntil: null, strikes: 0 }, rescueAttempts: { failures: [], lockedUntil: null, strikes: 0 } });
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

// ---- [OA] row OA-4a: Cancel the wait (OA-D21, CS-4, CS-21) ----

describe('PinEntry CancelReset (the chooser\'s Cancel the wait)', () => {
  const who = getMessages('en').learner.who;

  it('verifies only and offers no Forgot PIN? (its header title is Cancel the wait)', async () => {
    useAccountStore.setState({ pinResetRequestedAt: new Date(Date.now() - 60_000).toISOString() });
    const { r } = await show('CancelReset');
    expect(who.resetCancel).toBe('Cancel the wait');
    expect(buttonsNamed(r.root, m.entry.forgot.cta)).toHaveLength(0);
    expect(buttonsNamed(r.root, m.entry.unlock.cta)).toHaveLength(1);
  });

  it('a correct PIN stops the wait, opens nothing and returns to the chooser', async () => {
    useAccountStore.setState({ pinResetRequestedAt: new Date(Date.now() - 60_000).toISOString() });
    const { r, navigation } = await show('CancelReset');
    await typePin(r.root, '1234');
    expect(useAccountStore.getState().pinResetRequestedAt).toBeNull();
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.replace).not.toHaveBeenCalled();
    // No grown-up session and no fresh PIN (CS-4).
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    expect(tracked.find((e) => e.name === 'pin.reset_requested')?.payload).toEqual({ method: 'wait_cancelled' });
    expect(tracked.find((e) => e.name === 'parent.gate.opened')?.payload).toMatchObject({ dest: 'cancel_reset', via: 'pin' });
  });

  it('a wrong PIN leaves the wait running', async () => {
    const requested = new Date(Date.now() - 60_000).toISOString();
    useAccountStore.setState({ pinResetRequestedAt: requested });
    const { r, navigation } = await show('CancelReset');
    await typePin(r.root, '9999');
    expect(useAccountStore.getState().pinResetRequestedAt).toBe(requested);
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(tracked.find((e) => e.name === 'pin.reset_requested')).toBeUndefined();
  });

  it('never creates a PIN, even with none stored (CS-4)', async () => {
    useAccountStore.setState({ parentPinHash: null });
    const { r } = await show('CancelReset');
    expect(buttonsNamed(r.root, m.entry.unlock.cta)).toHaveLength(1);
    expect(screenTexts(r.root)).not.toContain(getMessages('en').caregiver.audience.family.pinCreateTitle);
  });
});

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-5 (section 6.3, CS-3, CS-4, CS-21): a locked tile asks the PIN through
 * `verifyForLockedProfile` and opens that learner only, never a grown-up session; the fresh PIN of the Edit profile
 * lock switch marks a fresh PIN and goes back.
 */
describe('[OA] PinEntry LockedProfile (a locked tile)', () => {
  const sora: Profile = { ...learner, id: 'profile:sora', displayName: 'Sora', learnerType: 'self' };
  type LockedParams = { next: 'LockedProfile'; profileId: string; lockedFrom?: { via: 'chooser'; trigger: 'launch' } | { via: 'profile' } };

  async function showLocked(params: LockedParams = { next: 'LockedProfile', profileId: sora.id, lockedFrom: { via: 'chooser', trigger: 'launch' } }, navigation = nav()) {
    const route = { key: 'pin', name: 'PinEntry' as const, params };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the screen reads only what `nav()` provides
    const r = await render(<PinEntryScreen route={route} navigation={navigation as any} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { r, navigation };
  }

  beforeEach(() => {
    useProfileStore.setState({ profiles: [learner, sora], activeId: learner.id, hydrated: true });
  });

  it('is titled with the learner\'s name and keeps Forgot PIN? (it leads to the reset paths)', async () => {
    const { r } = await showLocked();
    // The route header (drawn by the app's header slot) gets the learner's name as its title.
    const titled = r.root.findAll((n) => typeof (n.props as { header?: { title?: unknown } }).header?.title === 'string');
    expect((titled[0]?.props as { header: { title: string } }).header.title).toBe('Sora');
    expect(buttonsNamed(r.root, m.entry.unlock.cta)).toHaveLength(1);
    expect(buttonsNamed(r.root, m.entry.forgot.cta)).toHaveLength(1);
  });

  it('a correct PIN opens that learner\'s Home and no grown-up session: no gate, no fresh PIN (CS-3)', async () => {
    useAccountStore.setState({
      pinResetRequestedAt: new Date(Date.now() - 60_000).toISOString(),
      pinAttempts: { failures: [], lockedUntil: null, strikes: 2, lastMissAt: Date.now() - 1_000 },
    });
    const { r, navigation } = await showLocked();
    await typePin(r.root, '1234');
    expect(useProfileStore.getState().activeId).toBe(sora.id);
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    // Like any correct PIN: the strikes reset and a pending wait is cleared.
    expect(useAccountStore.getState().pinAttempts.strikes).toBe(0);
    expect(useAccountStore.getState().pinResetRequestedAt).toBeNull();
    expect(tracked.find((e) => e.name === 'parent.gate.opened')?.payload).toMatchObject({ dest: 'locked_profile', via: 'pin' });
    expect(tracked.find((e) => e.name === 'profile.switch')?.payload).toMatchObject({ via: 'chooser', trigger: 'launch', locked: true });
    expect(tracked.every((e) => e.profileId === undefined && !JSON.stringify(e.payload ?? {}).includes('profile:'))).toBe(true);
  });

  it('an open grown-up session does not survive the unlock: the change of learner closes it (CS-3, CS-15)', async () => {
    useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: Date.now() });
    const { r } = await showLocked({ next: 'LockedProfile', profileId: sora.id, lockedFrom: { via: 'profile' } });
    await typePin(r.root, '1234');
    expect(useProfileStore.getState().activeId).toBe(sora.id);
    expect(useUiStore.getState()).toMatchObject({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
    expect(tracked.find((e) => e.name === 'profile.switch')?.payload).toMatchObject({ via: 'profile', trigger: 'none', locked: true });
  });

  it('a wrong PIN opens nothing and says how many tries are left', async () => {
    const { r, navigation } = await showLocked();
    await typePin(r.root, '9999');
    expect(useProfileStore.getState().activeId).toBe(learner.id);
    expect(navigation.reset).not.toHaveBeenCalled();
    expect(screenTexts(r.root)).toContain(m.entry.triesLeft(4));
  });

  it('Cancel goes back (to the chooser), opening nothing', async () => {
    const { r, navigation } = await showLocked();
    await press(buttonsNamed(r.root, getMessages('en').common.buttons.cancel)[0] as ReactTestInstance);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(useProfileStore.getState().activeId).toBe(learner.id);
  });

  it('the help line never shows here, even at the 5th pause (CS-21)', async () => {
    const late = pauseFor(60 * 60_000, 5);
    useAccountStore.setState({ pinAttempts: late });
    disk.set('account:pinAttempts', late);
    const { r } = await showLocked();
    expect(screenTexts(r.root)).toContain("Let's take a short break. Try again in 60 min.");
    expect(byTestId(r.root, 'pin-pause-help')).toHaveLength(0);
  });

  it('the active learner\'s own lock over a quest (the CS-19 relock): the quest continues, nothing is reset or saved away', async () => {
    useProfileStore.setState({ profiles: [learner, sora], activeId: sora.id, hydrated: true });
    const navigation = nav();
    const routes = [
      { key: 'main', name: 'Main' },
      { key: 'quest', name: 'Quest', params: { questId: 'q1' } },
      { key: 'who', name: 'WhoIsUsing', params: { trigger: 'resume' } },
      { key: 'pin', name: 'PinEntry' },
    ];
    navigation.getState.mockReturnValue({ index: 3, routes });
    const { r } = await showLocked({ next: 'LockedProfile', profileId: sora.id, lockedFrom: { via: 'chooser', trigger: 'resume' } as never }, navigation);
    await typePin(r.root, '1234');
    expect(useProfileStore.getState().activeId).toBe(sora.id);
    // Back to the quest by its own key (a reset, which the chooser's back guard lets through), so it stays mounted.
    expect(navigation.reset).toHaveBeenCalledWith(expect.objectContaining({ index: 1, routes: routes.slice(0, 2) }));
    expect(tracked.some((e) => e.name === 'profile.switch')).toBe(false);
    expect(useUiStore.getState()).toMatchObject({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
  });

  it('another learner over a quest still lands on Home (a real switch)', async () => {
    const navigation = nav();
    navigation.getState.mockReturnValue({
      index: 3,
      routes: [{ key: 'main', name: 'Main' }, { key: 'quest', name: 'Quest' }, { key: 'who', name: 'WhoIsUsing' }, { key: 'pin', name: 'PinEntry' }],
    });
    const { r } = await showLocked(undefined, navigation);
    await typePin(r.root, '1234');
    expect(useProfileStore.getState().activeId).toBe(sora.id);
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
  });

  it('Forgot PIN? carries the tile\'s surface to the reset paths, so the switch is still counted after a reset', async () => {
    const { r, navigation } = await showLocked();
    await press(buttonsNamed(r.root, m.entry.forgot.cta)[0] as ReactTestInstance);
    expect(navigation.replace).toHaveBeenCalledWith('PinReset', { next: 'LockedProfile', profileId: sora.id, lockedFrom: { via: 'chooser', trigger: 'launch' } });
  });

  it('a new PIN from the reset paths opens that learner only: no gate session and no fresh PIN (CS-3)', async () => {
    useAccountStore.setState({ pinResetRequestedAt: new Date(Date.now() - 25 * 60 * 60_000).toISOString() });
    const navigation = nav();
    const route = {
      key: 'pin',
      name: 'PinEntry' as const,
      params: { next: 'LockedProfile' as const, profileId: sora.id, mode: 'setup' as const, via: 'wait' as const, lockedFrom: { via: 'chooser' as const, trigger: 'launch' as const } },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the screen reads only what `nav()` provides
    const r = await render(<PinEntryScreen route={route} navigation={navigation as any} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const next = buttons.next;
    for (let round = 0; round < 2; round += 1) {
      for (const digit of '5678') await press(buttonsNamed(r.root, a11y.pinDigit(Number(digit)))[0] as ReactTestInstance);
      await press(buttonsNamed(r.root, next)[0] as ReactTestInstance);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(useAccountStore.getState().parentPinHash).toBe('h:5678');
    expect(useProfileStore.getState().activeId).toBe(sora.id);
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(useUiStore.getState()).toMatchObject({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
  });

  it('a PIN hash that could not be read is not "no PIN": the lock holds, nothing opens and no attempt is counted', async () => {
    useAccountStore.setState({ parentPinHash: null, pinHashReadFailed: true });
    // The stored value is not a hash, so every read fails again.
    disk.set('account:parentPinHash', { broken: true });
    const { r, navigation } = await showLocked();
    expect(buttonsNamed(r.root, m.entry.unlock.cta)).toHaveLength(1);
    await typePin(r.root, '1234');
    expect(useProfileStore.getState().activeId).toBe(learner.id);
    expect(navigation.reset).not.toHaveBeenCalled();
    expect(screenTexts(r.root)).toContain(getMessages('en').common.errors.generic);
    expect(useAccountStore.getState().pinAttempts.failures).toEqual([]);
  });

  it('a PIN hash read again on arrival checks the PIN as usual', async () => {
    useAccountStore.setState({ parentPinHash: null, pinHashReadFailed: true });
    disk.set('account:parentPinHash', 'h:1234');
    const { r, navigation } = await showLocked();
    expect(useAccountStore.getState()).toMatchObject({ parentPinHash: 'h:1234', pinHashReadFailed: false });
    await typePin(r.root, '1234');
    expect(useProfileStore.getState().activeId).toBe(sora.id);
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
  });

  it('with no PIN stored the lock is void: the learner opens at once and no PIN is made (CS-4)', async () => {
    useAccountStore.setState({ parentPinHash: null });
    const { r, navigation } = await showLocked();
    expect(buttonsNamed(r.root, m.entry.unlock.cta)).toHaveLength(0);
    expect(useProfileStore.getState().activeId).toBe(sora.id);
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    expect(useAccountStore.getState().parentPinHash).toBeNull();
  });
});

describe('[OA] PinEntry FreshPin (the lock switch asks the PIN again)', () => {
  async function showFresh() {
    const navigation = nav();
    const route = { key: 'pin', name: 'PinEntry' as const, params: { next: 'FreshPin' as const } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the screen reads only what `nav()` provides
    const r = await render(<PinEntryScreen route={route} navigation={navigation as any} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { r, navigation };
  }

  it('verifies only, no Forgot PIN?; a correct PIN marks a fresh PIN and goes back without opening the gate', async () => {
    const { r, navigation } = await showFresh();
    expect(buttonsNamed(r.root, m.entry.forgot.cta)).toHaveLength(0);
    await typePin(r.root, '1234');
    expect(useUiStore.getState().lastPinVerifiedAt).not.toBeNull();
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(tracked.find((e) => e.name === 'parent.gate.opened')?.payload).toMatchObject({ dest: 'action', via: 'pin' });
  });

  it('with no PIN stored there is nothing to confirm: back at once, no PIN made (CS-4)', async () => {
    useAccountStore.setState({ parentPinHash: null });
    const { r, navigation } = await showFresh();
    expect(buttonsNamed(r.root, m.entry.unlock.cta)).toHaveLength(0);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
  });
});
