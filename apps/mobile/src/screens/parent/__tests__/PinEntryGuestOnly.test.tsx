import type { GuestRecord, Profile } from '@hangul-route/content-schema';
import { ConfirmSheet, type ConfirmSheetProps } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 9.2 (row GU-5, section 19; mock who-is-using-guest.md D15): the guest-only
 * gate. On a device with no PIN and no child profile, the L8 PIN setup a grown-up destination shows only because an
 * unsaved first quest is kept gains one line and Remove the first quest (ConfirmSheet, the sweep, then the destination
 * opens directly as before the guest, with no grown-up session). Also with the guest switch off; never in a guest run
 * (CS-G1); never on the guest's own SaveGuest (CS-G10); not where a child profile already asks the PIN.
 */
vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
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
vi.mock('../../../platform/grown-up-handoff', () => ({ openGrownUpArea: vi.fn(async () => 'opened'), continueToGrownUpPage: vi.fn(), clearGrownUpTab: vi.fn() }));
const sweep = vi.hoisted(() => ({ calls: 0, result: true, direct: true, pinSetElsewhere: false }));
vi.mock('../../../store/guest-remove', () => ({
  removeLiveGuest: vi.fn(async () => {
    sweep.calls += 1;
    if (sweep.result) {
      const { useGuestStore } = await import('../../../store/guest-store');
      useGuestStore.setState({ record: null, running: false });
    }
    return sweep.result;
  }),
  // [GU] GU-5 review: the gate read again from storage after the sweep (another tab may have set a PIN meanwhile).
  gateOpensDirectlyAfterRemove: vi.fn(async () => {
    if (sweep.pinSetElsewhere) {
      const { useAccountStore } = await import('../../../store/account-store');
      useAccountStore.setState({ parentPinHash: 'h:9999' });
    }
    return sweep.direct;
  }),
}));

import { flags } from '../../../config/flags';
import { useAccountStore } from '../../../store/account-store';
import { useGuestStore } from '../../../store/guest-store';
import { useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { byTestId, cleanup, press, render as renderNow, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';

/** Renders, then lets the lazy guest-keep chunk (`guest-keep.tsx`) load and draw. */
async function render(...args: Parameters<typeof renderNow>): ReturnType<typeof renderNow> {
  const r = await renderNow(...args);
  await act(async () => {
    await import('../guest-keep-chunk');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return r;
}
import { PinEntryScreen } from '../PinEntryScreen';

const en = getMessages('en');
const people = en.caregiver.people;
const self: Profile = { id: 'profile:me000001', displayName: 'Ana', ageGroup: '10-11', avatar: 'hoya-green', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'self' };
const GUEST: GuestRecord = { v: 1, id: 'profile:guest001', startedAt: '2026-10-22T10:00:00.000Z', lastAt: '2026-10-22T10:05:00.000Z', via: 'chooser', questDone: false };

function nav() {
  return {
    goBack: vi.fn(),
    replace: vi.fn(),
    navigate: vi.fn(),
    reset: vi.fn(),
    addListener: vi.fn(() => () => undefined),
    setOptions: vi.fn(),
    getState: vi.fn(() => ({ index: 0, routes: [{ key: 'pin', name: 'PinEntry' }] })),
  };
}

async function show(params: Record<string, unknown> = { next: 'ParentDashboard' }) {
  const navigation = nav();
  const r = await render(<PinEntryScreen route={{ key: 'pin', name: 'PinEntry', params } as never} navigation={navigation as never} />);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { r, navigation };
}
const sheetOf = (root: ReactTestInstance): ConfirmSheetProps => root.findByType(ConfirmSheet).props as ConfirmSheetProps;

beforeEach(() => {
  setPlatform('web');
  tracked.length = 0;
  sweep.calls = 0;
  sweep.result = true;
  sweep.direct = true;
  sweep.pinSetElsewhere = false;
  flags.guestLessonEnabled = true;
  useProfileStore.setState({ profiles: [self], activeId: self.id, hydrated: true });
  useAccountStore.setState({ parentPinHash: null, pinHashReadFailed: false, pinAttempts: { failures: [], lockedUntil: null, strikes: 0 } });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null, gateReturnPending: false });
  useGuestStore.setState({ record: GUEST, running: false, hydrated: true, memoryOnly: false });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
  flags.guestLessonEnabled = false;
});

describe('[GU] the guest-only gate on PIN setup (9.2)', () => {
  it('a self-only device with no PIN and a kept first quest: the line and Remove the first quest above the pad', async () => {
    const { r } = await show();
    const box = byTestId(r.root, 'pin-guest-only')[0]!;
    expect(screenTexts(box)).toEqual(expect.arrayContaining([people.guestOnlyGate, people.guestRemove]));
    expect(sheetOf(r.root).visible).toBe(false);
  });

  it('Remove: the ConfirmSheet alone (no PIN to ask), then the sweep, then the destination directly, with no grown-up session', async () => {
    const { r, navigation } = await show();
    await press(byTestId(r.root, 'pin-guest-remove')[0]!);
    expect(sheetOf(r.root)).toMatchObject({ visible: true, title: people.guestRemoveAsk, message: people.guestConfirm, confirmLabel: people.guestRemove, cancelLabel: en.common.buttons.cancel });
    expect(sheetOf(r.root).confirmTone ?? 'primary').toBe('primary');
    await act(async () => sheetOf(r.root).onConfirm());
    expect(sweep.calls).toBe(1);
    expect(navigation.replace).toHaveBeenCalledWith('ParentDashboard');
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useAccountStore.getState().parentPinHash).toBeNull();
    expect(tracked.find((e) => e.name === 'parent.gate.opened')?.payload).toMatchObject({ via: 'open' });
  });

  it('Add a learner after Remove opens the form directly (the destination as before the guest)', async () => {
    const { r, navigation } = await show({ next: 'AddProfile' });
    await press(byTestId(r.root, 'pin-guest-remove')[0]!);
    await act(async () => sheetOf(r.root).onConfirm());
    expect(navigation.replace).toHaveBeenCalledWith('Onboarding', { screen: 'CreateProfile', params: { firstRun: false } });
  });

  it('Cancel removes nothing and keeps the setup; a sweep that cannot read storage keeps the screen as it is', async () => {
    const { r, navigation } = await show();
    await press(byTestId(r.root, 'pin-guest-remove')[0]!);
    await act(async () => sheetOf(r.root).onCancel());
    expect(sweep.calls).toBe(0);
    expect(sheetOf(r.root).visible).toBe(false);
    sweep.result = false;
    await press(byTestId(r.root, 'pin-guest-remove')[0]!);
    await act(async () => sheetOf(r.root).onConfirm());
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(byTestId(r.root, 'pin-guest-only')).not.toHaveLength(0);
  });

  it('a failed sweep keeps the sheet open with the generic line (never a silent press)', async () => {
    sweep.result = false;
    const { r, navigation } = await show();
    await press(byTestId(r.root, 'pin-guest-remove')[0]!);
    await act(async () => sheetOf(r.root).onConfirm());
    expect(sheetOf(r.root)).toMatchObject({ visible: true, detail: en.common.errors.generic });
    expect(navigation.replace).not.toHaveBeenCalled();
    await act(async () => sheetOf(r.root).onCancel());
    expect(sheetOf(r.root).detail).toBeUndefined();
  });

  it('GU-5 review: a guest saved as a child or a PIN set in another tab meanwhile opens nothing (the gate read again)', async () => {
    sweep.direct = false;
    sweep.pinSetElsewhere = true;
    const { r, navigation } = await show({ next: 'AddProfile' });
    await press(byTestId(r.root, 'pin-guest-remove')[0]!);
    await act(async () => sheetOf(r.root).onConfirm());
    expect(sweep.calls).toBe(1);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(tracked.some((e) => e.name === 'parent.gate.opened')).toBe(false);
    // The PIN another tab set is asked now: the guest-only box is gone and nothing was opened.
    expect(byTestId(r.root, 'pin-guest-only')).toHaveLength(0);
  });

  it('a destination that waits underneath (the level check\'s finish) gets a back with no gate opened: one more tap opens it', async () => {
    const { r, navigation } = await show({ next: 'PlacementFinish' });
    await press(byTestId(r.root, 'pin-guest-remove')[0]!);
    await act(async () => sheetOf(r.root).onConfirm());
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
  });

  it('the guest switch off: the line and Remove still show (a grown-up always sees why)', async () => {
    flags.guestLessonEnabled = false;
    const { r } = await show();
    expect(byTestId(r.root, 'pin-guest-only')).not.toHaveLength(0);
  });

  it('none where the gate is not only the guest\'s: a child profile, a PIN stored, or no kept quest', async () => {
    useProfileStore.setState({ profiles: [{ ...self, learnerType: 'child' }] });
    let { r } = await show();
    expect(byTestId(r.root, 'pin-guest-only')).toHaveLength(0);
    await cleanup();
    useProfileStore.setState({ profiles: [self] });
    useGuestStore.setState({ record: null });
    ({ r } = await show());
    expect(byTestId(r.root, 'pin-guest-only')).toHaveLength(0);
    await cleanup();
    useGuestStore.setState({ record: GUEST });
    useAccountStore.setState({ parentPinHash: 'h:1234' });
    ({ r } = await show());
    expect(byTestId(r.root, 'pin-guest-only')).toHaveLength(0);
  });

  it('never inside a guest run (CS-G1), and never on the guest\'s own SaveGuest (CS-G10)', async () => {
    useGuestStore.setState({ running: true });
    let { r } = await show();
    expect(byTestId(r.root, 'pin-guest-only')).toHaveLength(0);
    await cleanup();
    useGuestStore.setState({ running: false });
    ({ r } = await show({ next: 'SaveGuest' }));
    expect(byTestId(r.root, 'pin-guest-only')).toHaveLength(0);
  });
});
