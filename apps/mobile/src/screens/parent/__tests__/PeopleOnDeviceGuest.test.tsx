import type { GuestRecord, Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { ConfirmSheet, type ConfirmSheetProps } from '@hangul-route/design-system';
import React from 'react';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 9.2, OQ-G4 (row GU-5, section 19): People on this device's first-quest
 * row. Shown whenever a live record is kept, with the guest switch on or off; Keep as a learner only with the switch
 * on; Remove the first quest asks a fresh PIN when a PIN is stored, else the ConfirmSheet alone; then the sweep.
 */
const removed = vi.hoisted(() => ({ calls: 0, result: true }));
vi.mock('../../../store/guest-remove', () => ({
  removeLiveGuest: vi.fn(async () => {
    removed.calls += 1;
    if (!removed.result) return false;
    const { useGuestStore } = await import('../../../store/guest-store');
    useGuestStore.setState({ record: null, running: false });
    return true;
  }),
  gateOpensDirectlyAfterRemove: vi.fn(async () => true),
}));

import { flags } from '../../../config/flags';
import { useAccountStore } from '../../../store/account-store';
import { useGuestStore } from '../../../store/guest-store';
import { useLocaleStore } from '../../../store/locale-store';
import { resetProfileLocks } from '../../../store/profile-locks';
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
import { PeopleOnDeviceCard } from '../PeopleOnDeviceCard';

const en = getMessages('en');
const people = en.caregiver.people;
const MINA: Profile = { id: 'profile:mina0001', displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-blue', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'self' };
const GUEST: GuestRecord = { v: 1, id: 'profile:guest001', startedAt: '2026-10-22T10:00:00.000Z', lastAt: '2026-10-22T10:05:00.000Z', via: 'chooser', questDone: true };

function actions() {
  const focus: (() => void)[] = [];
  return {
    onKeep: vi.fn(),
    onAskPin: vi.fn(),
    subscribeFocus: vi.fn((listener: () => void) => {
      focus.push(listener);
      return () => undefined;
    }),
    focus: () => focus.forEach((l) => l()),
  };
}

const sheetOf = (root: ReactTestInstance): ConfirmSheetProps => root.findByType(ConfirmSheet).props as ConfirmSheetProps;
const sheetOpen = (root: ReactTestInstance): boolean => sheetOf(root).visible;
const confirmSheet = async (root: ReactTestInstance): Promise<void> => act(async () => sheetOf(root).onConfirm());
const cancelSheet = async (root: ReactTestInstance): Promise<void> => act(async () => sheetOf(root).onCancel());

beforeEach(() => {
  setPlatform('web');
  removed.calls = 0;
  removed.result = true;
  resetProfileLocks();
  flags.guestLessonEnabled = true;
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useAccountStore.setState({ parentPinHash: 'pin-hash' });
  useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: null });
  useGuestStore.setState({ record: GUEST, running: false, hydrated: true, memoryOnly: false });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
  flags.guestLessonEnabled = false;
});

describe('[GU] People on this device: the first-quest row (9.2)', () => {
  it('after the people: the default cub and First quest, not saved; not a button, no chevron; Keep and Remove under it', async () => {
    const r = await render(<PeopleOnDeviceCard profiles={[MINA]} onOpen={vi.fn()} guest={actions()} />);
    const row = byTestId(r.root, 'people-guest')[0]!;
    expect(row.props.role).toBe('group');
    expect(row.props['aria-label']).toBe(people.guestRow);
    expect(screenTexts(byTestId(r.root, 'people-guest-label')[0]!)).toEqual([people.guestRow]);
    expect(byTestId(r.root, 'people-guest-keep')).not.toHaveLength(0);
    expect(byTestId(r.root, 'people-guest-remove')).not.toHaveLength(0);
    // The learners' rows are buttons; the guest's label is not (there is no person page for a guest).
    const buttons = r.root.findAll((n) => typeof n.type === 'string' && n.props.role === 'button').map((n) => screenTexts(n).join(' '));
    expect(buttons.some((t) => t.startsWith(people.guestRow))).toBe(false);
    expect(screenTexts(r.root).join(' ')).not.toMatch(/\bstars?\b(?! of this)|\d+ (day|min)/i);
  });

  it('a live guest alone (no learner profile): the card still shows, with only that row', async () => {
    const r = await render(<PeopleOnDeviceCard profiles={[]} onOpen={vi.fn()} guest={actions()} />);
    expect(byTestId(r.root, 'people-on-device')).not.toHaveLength(0);
    expect(byTestId(r.root, 'people-guest')).not.toHaveLength(0);
  });

  it('no live guest (none kept, or its id already a profile): no row', async () => {
    useGuestStore.setState({ record: null });
    let r = await render(<PeopleOnDeviceCard profiles={[MINA]} onOpen={vi.fn()} guest={actions()} />);
    expect(byTestId(r.root, 'people-guest')).toHaveLength(0);
    await cleanup();
    useGuestStore.setState({ record: { ...GUEST, id: MINA.id } });
    r = await render(<PeopleOnDeviceCard profiles={[MINA]} onOpen={vi.fn()} guest={actions()} />);
    expect(byTestId(r.root, 'people-guest')).toHaveLength(0);
  });

  it('the guest switch off: the row and Remove still show (the reason for a gate stays removable); no Keep', async () => {
    flags.guestLessonEnabled = false;
    const r = await render(<PeopleOnDeviceCard profiles={[MINA]} onOpen={vi.fn()} guest={actions()} />);
    expect(byTestId(r.root, 'people-guest')).not.toHaveLength(0);
    expect(byTestId(r.root, 'people-guest-keep')).toHaveLength(0);
    expect(byTestId(r.root, 'people-guest-remove')).not.toHaveLength(0);
  });

  it('Keep as a learner hands over to the save steps inside this session', async () => {
    const a = actions();
    const r = await render(<PeopleOnDeviceCard profiles={[MINA]} onOpen={vi.fn()} guest={a} />);
    await press(byTestId(r.root, 'people-guest-keep')[0]!);
    expect(a.onKeep).toHaveBeenCalledTimes(1);
  });

  it('with a PIN stored: Remove asks a fresh PIN first, then the ConfirmSheet; Remove the first quest runs the sweep', async () => {
    const a = actions();
    const r = await render(<PeopleOnDeviceCard profiles={[MINA]} onOpen={vi.fn()} guest={a} />);
    await press(byTestId(r.root, 'people-guest-remove')[0]!);
    expect(a.onAskPin).toHaveBeenCalledTimes(1);
    expect(sheetOpen(r.root)).toBe(false);
    // The fresh PIN comes back right.
    await act(async () => useUiStore.setState({ lastPinVerifiedAt: Date.now() }));
    expect(sheetOpen(r.root)).toBe(true);
    // Cancel first and focused, Remove the first quest the primary (never the danger tone).
    expect(sheetOf(r.root)).toMatchObject({ title: people.guestRemoveAsk, message: people.guestConfirm, cancelLabel: en.common.buttons.cancel, confirmLabel: people.guestRemove });
    expect(sheetOf(r.root).confirmTone ?? 'primary').toBe('primary');
    expect(sheetOf(r.root).confirmFirst ?? false).toBe(false);
    await confirmSheet(r.root);
    await vi.waitFor(() => expect(removed.calls).toBe(1));
    await vi.waitFor(() => expect(byTestId(r.root, 'people-guest')).toHaveLength(0));
  });

  it('with a PIN stored and one entered in the last 2 minutes: the ConfirmSheet at once; Cancel removes nothing', async () => {
    useUiStore.setState({ lastPinVerifiedAt: Date.now() });
    const a = actions();
    const r = await render(<PeopleOnDeviceCard profiles={[MINA]} onOpen={vi.fn()} guest={a} />);
    await press(byTestId(r.root, 'people-guest-remove')[0]!);
    expect(a.onAskPin).not.toHaveBeenCalled();
    expect(sheetOpen(r.root)).toBe(true);
    await cancelSheet(r.root);
    expect(sheetOpen(r.root)).toBe(false);
    expect(removed.calls).toBe(0);
  });

  it('a PIN screen left without the PIN drops the Remove it was asked for', async () => {
    const a = actions();
    const r = await render(<PeopleOnDeviceCard profiles={[MINA]} onOpen={vi.fn()} guest={a} />);
    await press(byTestId(r.root, 'people-guest-remove')[0]!);
    await act(async () => a.focus());
    // A PIN entered later for something else never opens the sheet unasked.
    await act(async () => useUiStore.setState({ lastPinVerifiedAt: Date.now() }));
    expect(sheetOpen(r.root)).toBe(false);
  });

  it('with no PIN stored: the ConfirmSheet alone (it deletes nobody\'s saved data)', async () => {
    useAccountStore.setState({ parentPinHash: null });
    const a = actions();
    const r = await render(<PeopleOnDeviceCard profiles={[MINA]} onOpen={vi.fn()} guest={a} />);
    await press(byTestId(r.root, 'people-guest-remove')[0]!);
    expect(a.onAskPin).not.toHaveBeenCalled();
    expect(sheetOpen(r.root)).toBe(true);
    await confirmSheet(r.root);
    await vi.waitFor(() => expect(removed.calls).toBe(1));
  });

  it('the switch off, Remove works the same (no PIN stored: the sheet alone, then the sweep)', async () => {
    flags.guestLessonEnabled = false;
    useAccountStore.setState({ parentPinHash: null });
    const r = await render(<PeopleOnDeviceCard profiles={[MINA]} onOpen={vi.fn()} guest={actions()} />);
    await press(byTestId(r.root, 'people-guest-remove')[0]!);
    await confirmSheet(r.root);
    await vi.waitFor(() => expect(removed.calls).toBe(1));
  });

  it('GU-5 review: a sweep that could not read the storage keeps the sheet open with the generic line; the row stays', async () => {
    useAccountStore.setState({ parentPinHash: null });
    removed.result = false;
    const r = await render(<PeopleOnDeviceCard profiles={[MINA]} onOpen={vi.fn()} guest={actions()} />);
    await press(byTestId(r.root, 'people-guest-remove')[0]!);
    await confirmSheet(r.root);
    expect(removed.calls).toBe(1);
    expect(sheetOf(r.root)).toMatchObject({ visible: true, detail: en.common.errors.generic });
    expect(byTestId(r.root, 'people-guest')).not.toHaveLength(0);
    await cancelSheet(r.root);
    expect(sheetOf(r.root).detail).toBeUndefined();
  });

  it('Remove from this device lists profiles only: only a learner row opens a person page, never the guest', async () => {
    const onOpen = vi.fn();
    const r = await render(<PeopleOnDeviceCard profiles={[MINA]} onOpen={onOpen} guest={actions()} />);
    const buttons = r.root.findAll((n) => typeof n.type === 'string' && n.props.role === 'button' && typeof n.props.onClick === 'function');
    for (const b of buttons) {
      if (screenTexts(b).some((t) => t === people.guestKeep || t === people.guestRemove)) continue;
      await press(b);
    }
    expect(onOpen.mock.calls.map((c) => c[0])).toEqual([MINA.id]);
    expect(onOpen).not.toHaveBeenCalledWith(GUEST.id);
  });
});
