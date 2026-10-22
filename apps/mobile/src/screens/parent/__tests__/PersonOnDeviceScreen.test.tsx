import type { Profile } from '@hangul-route/content-schema';
import { ConfirmSheet, type ConfirmSheetProps } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] People on this device, one person (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D13, OA-D5b (3), section 10.4; row
 * OA-7a, section 20; CS-12; mock `design/screens/profiles/people-on-device.md` boards 3 to 9): Remove from this device
 * asks a fresh PIN, then the ConfirmSheet with the name; a saved learner gets Remove and Cancel; any other first tries
 * `syncNow` with the checking line; an unsaved one gets Save progress first as the main action and Remove anyway as a
 * quiet second step (Keep, Remove in the danger tone). The removal itself is the store's (`remove-from-device.test.ts`).
 */
const removal = vi.hoisted(() => ({
  saved: vi.fn(async (_id: string) => true),
  sync: vi.fn(async (_id: string) => true),
  remove: vi.fn(async (_id: string, _step: string): Promise<'stay' | 'chooser' | 'welcome' | null> => 'stay'),
}));
const CODE = 'TIGER-MOON-RIVER-STAR 123456';
const check = (saved: boolean) => ({ saved, rescueCode: saved ? CODE : null });
vi.mock('../../../store/remove-from-device', () => ({
  removalCheck: async (id: string) => check(await removal.saved(id)),
  syncThenCheck: async (id: string) => check(await removal.sync(id)),
  removeFromDevice: (id: string, step: string) => removal.remove(id, step),
}));
vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
const lockSpy = vi.hoisted(() => vi.fn(async (_id: string, _on: boolean, _profiles: unknown) => true));
vi.mock('../../../store/profile-locks', async (original) => ({ ...(await original<Record<string, unknown>>()), setProfileLocked: lockSpy }));

import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useMembershipStore } from '../../../store/membership-store';
import { resetProfileLocks } from '../../../store/profile-locks';
import { useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { PersonOnDeviceScreen } from '../PersonOnDeviceScreen';

const en = getMessages('en');
const people = en.caregiver.people;
const focusListeners = new Set<() => void>();
const navigation = {
  navigate: vi.fn(),
  goBack: vi.fn(),
  reset: vi.fn(),
  canGoBack: vi.fn(() => true),
  addListener: vi.fn((_event: 'focus', listener: () => void) => {
    focusListeners.add(listener);
    return () => focusListeners.delete(listener);
  }),
};
/** The screen comes back in front (a PIN screen closed). */
async function refocus(): Promise<void> {
  await act(async () => {
    for (const listener of focusListeners) listener();
  });
}

const child = (id: string, displayName: string): Profile => ({
  id,
  displayName,
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType: 'child',
});

const JUN = 'profile:jun00001';

function screen(): React.ReactElement {
  return <PersonOnDeviceScreen navigation={navigation as never} route={{ key: 'PersonOnDevice', name: 'PersonOnDevice', params: { profileId: JUN } } as never} />;
}

const sheetOf = (root: ReactTestInstance): ConfirmSheetProps => root.findByType(ConfirmSheet).props as ConfirmSheetProps;

/** Lets the sheet's awaited checks land. */
async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
}

const lockSwitch = (root: ReactTestInstance): ReactTestInstance =>
  root.findAll((n) => typeof n.type !== 'string' && n.props.testID === 'person-lock-switch' && typeof n.props.onValueChange === 'function')[0]!;

async function pressRemove(root: ReactTestInstance): Promise<void> {
  await press(byTestId(root, 'person-remove')[0]!);
  await settle();
}

const realHydrate = useMembershipStore.getState().hydrate;

beforeEach(() => {
  setPlatform('web');
  for (const fn of Object.values(navigation)) fn.mockClear();
  removal.saved.mockReset().mockResolvedValue(true);
  removal.sync.mockReset().mockResolvedValue(true);
  removal.remove.mockReset().mockResolvedValue('stay');
  lockSpy.mockClear();
  focusListeners.clear();
  resetProfileLocks();
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useProfileStore.setState({ profiles: [child('profile:mina0001', 'Mina'), child(JUN, 'Jun')], activeId: 'profile:mina0001' });
  useAccountStore.setState({ parentPinHash: 'pin-hash' });
  // The PIN was entered just now: Remove goes straight to the sheet.
  useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: Date.now() });
  useMembershipStore.setState({ byLearner: {}, hydrate: vi.fn(async () => []) });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
  useMembershipStore.setState({ hydrate: realHydrate });
});

describe('[OA] People on this device: one person (row OA-7a)', () => {
  it('shows the name, the lock card, Edit profile and Remove from this device (a secondary button, never red)', async () => {
    const r = await render(screen());
    const texts = screenTexts(r.root);
    expect(texts).toEqual(expect.arrayContaining(['Jun', people.lock, people.lockHint, en.learner.editProfile.title, people.remove]));
    await press(byTestId(r.root, 'person-edit')[0]!);
    expect(navigation.navigate).toHaveBeenCalledWith('EditProfile', { profileId: JUN });
    expect(sheetOf(r.root).visible).toBe(false);
  });

  it('with no PIN, Remove is disabled with Set a grown-up PIN first. and opens nothing (CS-12)', async () => {
    useAccountStore.setState({ parentPinHash: null });
    const r = await render(screen());
    expect(screenTexts(byTestId(r.root, 'person-remove-needs-pin')[0]!)).toEqual([en.caregiver.pin.needsPinFirst]);
    const remove = byTestId(r.root, 'person-remove')[0]!;
    expect(remove.props['aria-disabled']).toBe(true);
    expect(removal.saved).not.toHaveBeenCalled();
    expect(sheetOf(r.root).visible).toBe(false);
  });

  it('a PIN older than 2 minutes: Remove asks the PIN first (FreshPin), and the sheet opens once it is right (OA-D5b (3))', async () => {
    useUiStore.setState({ lastPinVerifiedAt: Date.now() - 3 * 60_000 });
    const r = await render(screen());
    await pressRemove(r.root);
    expect(navigation.navigate).toHaveBeenCalledWith('PinEntry', { next: 'FreshPin' });
    expect(removal.saved).not.toHaveBeenCalled();
    expect(sheetOf(r.root).visible).toBe(false);
    // The open 15-minute session alone never counts: only a new PIN does.
    await act(async () => useUiStore.setState({ lastPinVerifiedAt: Date.now() }));
    await settle();
    expect(removal.saved).toHaveBeenCalledWith(JUN);
    expect(sheetOf(r.root)).toMatchObject({ visible: true, title: people.removeAsk('Jun') });
  });

  it('saved: the name, removeSaved, Cancel and Remove; spacesStay when the learner has memberships; Remove removes', async () => {
    useMembershipStore.setState({ byLearner: { [JUN]: [{ spaceId: 'space:f', kind: 'family', name: 'Kim', role: 'learner', joinedAt: '2026-10-02T00:00:00.000Z' } as never] } });
    const r = await render(screen());
    await pressRemove(r.root);
    expect(removal.sync).not.toHaveBeenCalled();
    const sheet = sheetOf(r.root);
    expect(sheet).toMatchObject({
      visible: true,
      title: people.removeAsk('Jun'),
      message: people.removeSaved,
      code: CODE,
      detail: people.spacesStay,
      cancelLabel: en.common.buttons.cancel,
      confirmLabel: en.console.confirm.remove,
      confirmTone: 'primary',
      confirmFirst: false,
      busy: false,
    });
    expect(sheet.quietLabel).toBeUndefined();
    await act(async () => sheet.onConfirm());
    await settle();
    expect(removal.remove).toHaveBeenCalledWith(JUN, 'saved');
    expect(navigation.goBack).toHaveBeenCalled();
    expect(sheetOf(r.root).visible).toBe(false);
  });

  it('no memberships: no spacesStay line', async () => {
    const r = await render(screen());
    await pressRemove(r.root);
    expect(sheetOf(r.root).detail).toBeUndefined();
  });

  it('not saved yet: the checking line (only Cancel) while syncNow runs; a sync that lands makes it saved', async () => {
    removal.saved.mockResolvedValue(false);
    let land: (saved: boolean) => void = () => undefined;
    removal.sync.mockImplementation(() => new Promise<boolean>((resolve) => (land = resolve)));
    const r = await render(screen());
    await pressRemove(r.root);
    expect(removal.sync).toHaveBeenCalledWith(JUN);
    expect(sheetOf(r.root)).toMatchObject({ visible: true, title: people.removeAsk('Jun'), message: people.checking, busy: true });
    await act(async () => land(true));
    await settle();
    expect(sheetOf(r.root)).toMatchObject({ message: people.removeSaved, busy: false, confirmLabel: en.console.confirm.remove });
  });

  it('unsaved: Save progress first is the main action (Save my progress for that learner), Cancel, and a quiet Remove anyway', async () => {
    removal.saved.mockResolvedValue(false);
    removal.sync.mockResolvedValue(false);
    const r = await render(screen());
    await pressRemove(r.root);
    const sheet = sheetOf(r.root);
    expect(sheet).toMatchObject({
      visible: true,
      title: people.removeAsk('Jun'),
      message: people.removeUnsaved,
      confirmLabel: people.saveFirst,
      confirmFirst: true,
      confirmTone: 'primary',
      quietLabel: people.removeAnyway,
    });
    await act(async () => sheet.onConfirm());
    expect(navigation.navigate).toHaveBeenCalledWith('SaveProgress', { profileId: JUN });
    expect(removal.remove).not.toHaveBeenCalled();
    expect(sheetOf(r.root).visible).toBe(false);
  });

  it('Remove anyway opens a second step: Keep first, Remove in the danger tone; Keep removes nothing', async () => {
    removal.saved.mockResolvedValue(false);
    removal.sync.mockResolvedValue(false);
    const r = await render(screen());
    await pressRemove(r.root);
    await act(async () => sheetOf(r.root).onQuiet!());
    expect(sheetOf(r.root)).toMatchObject({ visible: true, title: people.removeAnywayAsk, cancelLabel: people.keep, confirmLabel: en.console.confirm.remove, confirmTone: 'danger', confirmFirst: false });
    expect(sheetOf(r.root).quietLabel).toBeUndefined();
    await act(async () => sheetOf(r.root).onCancel());
    expect(sheetOf(r.root).visible).toBe(false);
    expect(removal.remove).not.toHaveBeenCalled();

    await pressRemove(r.root);
    await act(async () => sheetOf(r.root).onQuiet!());
    await act(async () => sheetOf(r.root).onConfirm());
    await settle();
    expect(removal.remove).toHaveBeenCalledWith(JUN, 'anyway');
  });

  it('the unsaved steps show no Rescue Code; the saved step shows it before Remove (an unregistered learner registered by the check)', async () => {
    removal.saved.mockResolvedValue(false);
    removal.sync.mockResolvedValue(false);
    const r = await render(screen());
    await pressRemove(r.root);
    expect(sheetOf(r.root).code).toBeUndefined();
    await act(async () => sheetOf(r.root).onCancel());
    // Never registered before: the check registers it and a code is issued; the sheet shows that code with Remove.
    removal.sync.mockResolvedValue(true);
    await pressRemove(r.root);
    expect(sheetOf(r.root)).toMatchObject({ message: people.removeSaved, code: CODE, confirmLabel: en.console.confirm.remove });
  });

  it('a Remove PIN screen closed without the PIN: a PIN entered later for the lock switch changes the lock only, no sheet opens', async () => {
    useUiStore.setState({ lastPinVerifiedAt: Date.now() - 3 * 60_000 });
    const r = await render(screen());
    await pressRemove(r.root);
    expect(navigation.navigate).toHaveBeenLastCalledWith('PinEntry', { next: 'FreshPin' });
    await refocus();
    await act(async () => lockSwitch(r.root).props.onValueChange(true));
    expect(navigation.navigate).toHaveBeenLastCalledWith('PinEntry', { next: 'FreshPin' });
    await act(async () => useUiStore.setState({ lastPinVerifiedAt: Date.now() }));
    await settle();
    expect(lockSpy).toHaveBeenCalledWith(JUN, true, expect.anything());
    expect(removal.saved).not.toHaveBeenCalled();
    expect(sheetOf(r.root).visible).toBe(false);
  });

  it('a lock PIN screen closed without the PIN: a PIN entered later for Remove opens the sheet only, the lock stays', async () => {
    useUiStore.setState({ lastPinVerifiedAt: Date.now() - 3 * 60_000 });
    const r = await render(screen());
    await act(async () => lockSwitch(r.root).props.onValueChange(true));
    expect(navigation.navigate).toHaveBeenLastCalledWith('PinEntry', { next: 'FreshPin' });
    await refocus();
    await pressRemove(r.root);
    await act(async () => useUiStore.setState({ lastPinVerifiedAt: Date.now() }));
    await settle();
    expect(sheetOf(r.root)).toMatchObject({ visible: true, title: people.removeAsk('Jun') });
    expect(lockSpy).not.toHaveBeenCalled();
  });

  it('the PIN went stale while the sheet was open: Remove asks the PIN again and removes nothing; the sheet starts over once it is right', async () => {
    removal.saved.mockResolvedValue(false);
    removal.sync.mockResolvedValue(false);
    const r = await render(screen());
    await pressRemove(r.root);
    await act(async () => sheetOf(r.root).onQuiet!());
    expect(sheetOf(r.root).title).toBe(people.removeAnywayAsk);
    useUiStore.setState({ lastPinVerifiedAt: Date.now() - 3 * 60_000 });
    await act(async () => sheetOf(r.root).onConfirm());
    await settle();
    expect(removal.remove).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenLastCalledWith('PinEntry', { next: 'FreshPin' });
    expect(sheetOf(r.root).visible).toBe(false);
    await act(async () => useUiStore.setState({ lastPinVerifiedAt: Date.now() }));
    await settle();
    // Back at the first step, checked again: Remove anyway needs its second step again.
    expect(sheetOf(r.root)).toMatchObject({ visible: true, message: people.removeUnsaved, quietLabel: people.removeAnyway });
  });

  it('a saved learner written to while the sheet was open: Remove checks again and goes through the sync check', async () => {
    const r = await render(screen());
    await pressRemove(r.root);
    expect(sheetOf(r.root).message).toBe(people.removeSaved);
    removal.saved.mockResolvedValue(false);
    removal.sync.mockResolvedValue(false);
    await act(async () => sheetOf(r.root).onConfirm());
    await settle();
    expect(removal.remove).not.toHaveBeenCalled();
    expect(removal.sync).toHaveBeenCalledWith(JUN);
    expect(sheetOf(r.root)).toMatchObject({ visible: true, message: people.removeUnsaved, confirmLabel: people.saveFirst });
  });

  it('a check that lands after Cancel changes nothing', async () => {
    removal.saved.mockResolvedValue(false);
    let land: (saved: boolean) => void = () => undefined;
    removal.sync.mockImplementation(() => new Promise<boolean>((resolve) => (land = resolve)));
    const r = await render(screen());
    await pressRemove(r.root);
    await act(async () => sheetOf(r.root).onCancel());
    await act(async () => land(true));
    await settle();
    expect(sheetOf(r.root).visible).toBe(false);
  });

  it('removing the active learner opens the chooser; removing the last one opens Welcome', async () => {
    removal.remove.mockResolvedValue('chooser');
    const r = await render(screen());
    await pressRemove(r.root);
    await act(async () => sheetOf(r.root).onConfirm());
    await settle();
    // The chooser alone: no learner's Home under it (the learner who takes over may be locked).
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'WhoIsUsing', params: { trigger: 'manual' } }] });

    removal.remove.mockResolvedValue('welcome');
    await pressRemove(r.root);
    await act(async () => sheetOf(r.root).onConfirm());
    await settle();
    expect(navigation.reset).toHaveBeenLastCalledWith({ index: 0, routes: [{ name: 'Onboarding', params: { screen: 'Welcome' } }] });
  });

  it('a learner that is gone (removed in another tab) draws nothing', async () => {
    useProfileStore.setState({ profiles: [child('profile:mina0001', 'Mina')] });
    const r = await render(screen());
    expect(buttonsNamed(r.root, people.remove)).toHaveLength(0);
  });
});
