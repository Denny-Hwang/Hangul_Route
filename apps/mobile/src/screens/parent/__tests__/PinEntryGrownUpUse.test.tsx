import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { act } from 'react-test-renderer';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-4b (section 5.3, CS-1, CS-4): the PIN screen a Family, Teacher, School
 * or Sign in row of the chooser opens (`PinEntry { next: 'GrownUpUse', use }`). Verify only: a correct PIN hands off
 * with `via: 'chooser'` to that use's page; a wrong PIN opens nothing; no Forgot PIN?; with no PIN stored, the no-PIN
 * line and Continue to `/signin`, never a PIN set-up; Cancel goes back to the chooser.
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
const handoff = vi.hoisted(() => ({
  opened: [] as { via: string; target?: string }[],
  continued: [] as (string | null | undefined)[],
}));
vi.mock('../../../platform/grown-up-handoff', () => ({
  openGrownUpArea: vi.fn(async (request: { via: string; target?: string }) => {
    handoff.opened.push(request);
    return 'opened';
  }),
  continueToGrownUpPage: vi.fn((target: string | null | undefined) => void handoff.continued.push(target)),
  clearGrownUpTab: vi.fn(),
}));

import { useAccountStore } from '../../../store/account-store';
import { useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { PinEntryScreen } from '../PinEntryScreen';

const en = getMessages('en');
const m = en.caregiver.pin;
const a11y = en.a11y;

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

type Use = 'family' | 'teacher' | 'school' | 'signin';

async function show(use: Use, navigation = nav()) {
  const route = { key: 'pin', name: 'PinEntry' as const, params: { next: 'GrownUpUse' as const, use } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the screen reads only what `nav()` provides
  const r = await render(<PinEntryScreen route={route} navigation={navigation as any} />);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { r, navigation };
}

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
  handoff.opened.length = 0;
  handoff.continued.length = 0;
  useProfileStore.setState({ profiles: [learner], activeId: learner.id, hydrated: true });
  useAccountStore.setState({ parentPinHash: 'h:1234', pinAttempts: { failures: [], lockedUntil: null, strikes: 0 }, rescueAttempts: { failures: [], lockedUntil: null, strikes: 0 } });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
});

describe('PinEntry for a chooser use row (GrownUpUse)', () => {
  it.each([
    ['family', '/parent'],
    ['teacher', '/teach?persona=teacher'],
    ['school', '/teach?focus=school'],
  ] as const)('%s: a correct PIN hands off with via chooser to %s and stays while the page goes', async (use, target) => {
    const { r, navigation } = await show(use);
    await typePin(r.root, '1234');
    expect(handoff.opened).toEqual([{ via: 'chooser', target }]);
    // Not back to the chooser: arriving there would clear the unlock the hand-off just wrote (CS-2).
    expect(navigation.goBack).not.toHaveBeenCalled();
    // The fresh PIN the hand-off needs (2 minutes); no other destination opened.
    expect(useUiStore.getState().lastPinVerifiedAt).not.toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(tracked.find((e) => e.name === 'parent.gate.opened')?.payload).toEqual(expect.objectContaining({ dest: 'use', via: 'pin' }));
  });

  it('while the page goes, the pad, Unlock and Cancel wait: a second PIN does not hand off again, Cancel does not leave', async () => {
    const { r, navigation } = await show('teacher');
    await typePin(r.root, '1234');
    expect(handoff.opened).toHaveLength(1);
    await typePin(r.root, '1234');
    expect(handoff.opened).toHaveLength(1);
    await press(buttonsNamed(r.root, en.common.buttons.cancel)[0] as ReactTestInstance);
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(tracked.filter((e) => e.name === 'parent.gate.opened')).toHaveLength(1);
  });

  it('a page that comes back in front (the back/forward cache) finds the PIN screen usable again', async () => {
    const visibility = await import('../../../platform/app-visibility');
    const listeners: ((visible: boolean) => void)[] = [];
    const spy = vi.spyOn(visibility, 'subscribeAppVisibility').mockImplementation((l) => {
      listeners.push(l);
      return () => undefined;
    });
    const { r, navigation } = await show('family');
    await typePin(r.root, '1234');
    expect(handoff.opened).toHaveLength(1);
    await press(buttonsNamed(r.root, en.common.buttons.cancel)[0] as ReactTestInstance);
    expect(navigation.goBack).not.toHaveBeenCalled();
    await act(async () => {
      for (const l of [...listeners]) l(true);
      await Promise.resolve();
    });
    spy.mockRestore();
    await press(buttonsNamed(r.root, en.common.buttons.cancel)[0] as ReactTestInstance);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('Sign in as a grown-up: the hand-off has no target (the sign-in router)', async () => {
    const { r } = await show('signin');
    await typePin(r.root, '1234');
    expect(handoff.opened).toEqual([{ via: 'chooser' }]);
  });

  it('a wrong PIN opens nothing (CS-1)', async () => {
    const { r, navigation } = await show('teacher');
    await typePin(r.root, '9999');
    expect(handoff.opened).toEqual([]);
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
  });

  it('verify only: the verify title, no Forgot PIN?, and Cancel goes back to the chooser', async () => {
    const { r, navigation } = await show('family');
    expect(buttonsNamed(r.root, m.entry.forgot.cta)).toHaveLength(0);
    await press(buttonsNamed(r.root, en.common.buttons.cancel)[0] as ReactTestInstance);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(handoff.opened).toEqual([]);
  });

  it('no PIN stored (CS-4): the no-PIN line and Continue to /signin, never a set-up step', async () => {
    useAccountStore.setState({ parentPinHash: null });
    const { r } = await show('teacher');
    expect(screenTexts(r.root)).toContain(en.caregiver.grownUpHome.noPin);
    expect(buttonsNamed(r.root, a11y.pinDigit(1))).toHaveLength(0);
    expect(screenTexts(r.root)).not.toContain(m.entry.createAgain);
    await press(buttonsNamed(r.root, en.caregiver.grownUpHome.continue.cta)[0] as ReactTestInstance);
    // No target: `continueToGrownUpPage` opens the sign-in page.
    expect(handoff.continued).toEqual([undefined]);
    expect(useAccountStore.getState().parentPinHash).toBeNull();
  });
});
