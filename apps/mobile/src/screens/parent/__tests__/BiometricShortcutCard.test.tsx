import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-9 (sections 8.2, 8.6; mock `design/screens/profiles/people-on-device.md`,
 * decision D18): the face or fingerprint switch in the Grown-up area. Off by default; on needs a fresh PIN and the
 * warning is its hint; no PIN disables it with `needsPinFirst`; the flag off or no strong biometrics hides it.
 */

const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => (disk.has(key) ? structuredClone(disk.get(key)) : null)),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async () => null),
  writeJson: vi.fn(async (key: string, value: unknown) => void disk.set(key, structuredClone(value))),
  updateJson: vi.fn(async () => true),
  removeKey: vi.fn(async () => undefined),
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
import { useUiStore } from '../../../store/ui-store';
import { byTestId, cleanup, hostNodes, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { BiometricShortcutCard } from '../BiometricShortcutCard';

const m = getMessages('en').caregiver.pin;
const EPOCH = 1_800_000_000_000;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function show() {
  const onNeedPin = vi.fn();
  const r = await render(<BiometricShortcutCard onNeedPin={onNeedPin} />);
  await settle();
  await settle();
  return { r, onNeedPin };
}

function theSwitch(root: ReactTestInstance): ReactTestInstance {
  const [node] = hostNodes(root, (n) => n.props.role === 'switch');
  if (node === undefined) throw new Error('no switch');
  return node;
}

async function flip(root: ReactTestInstance, checked: boolean): Promise<void> {
  const node = theSwitch(root);
  await act(async () => {
    (node.props.onChange as (e: unknown) => void)({ nativeEvent: { target: { checked } } });
  });
  await settle();
}

beforeEach(() => {
  setPlatform('ios');
  disk.clear();
  tracked.length = 0;
  vi.clearAllMocks();
  port.available.mockResolvedValue(true);
  port.write.mockResolvedValue('written');
  flags.biometricShortcutEnabled = true;
  useAccountStore.setState({ parentPinHash: 'h:1234', pinSetAt: EPOCH, biometricShortcut: null });
  useUiStore.setState({ lastPinVerifiedAt: null });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
  flags.biometricShortcutEnabled = true;
});

describe('[OA] the Grown-up area switch', () => {
  it('is off by default, named by its label, with the warning as its hint', async () => {
    const { r } = await show();
    expect(screenTexts(r.root)).toEqual(expect.arrayContaining([m.biometric.toggle, m.biometric.warning]));
    const node = theSwitch(r.root);
    expect(node.props['aria-checked'] ?? node.props.checked).toBe(false);
    expect(byTestId(r.root, 'dashboard-biometric-switch')).toHaveLength(1);
  });

  it('turning it on without a fresh PIN asks for the PIN first and turns nothing on yet', async () => {
    const { r, onNeedPin } = await show();
    await flip(r.root, true);
    expect(onNeedPin).toHaveBeenCalledTimes(1);
    expect(port.write).not.toHaveBeenCalled();
    expect(useAccountStore.getState().biometricShortcut).toBeNull();
  });

  it('with a PIN entered in the last 2 minutes it turns on at once', async () => {
    useUiStore.setState({ lastPinVerifiedAt: Date.now() - 30_000 });
    const { r, onNeedPin } = await show();
    await flip(r.root, true);
    expect(onNeedPin).not.toHaveBeenCalled();
    expect(port.write).toHaveBeenCalledWith(m.biometric.cta);
    expect(useAccountStore.getState().biometricShortcut).toMatchObject({ v: 1, epoch: EPOCH });
    expect(tracked.find((e) => e.name === 'pin.biometric_changed')?.payload).toEqual({ on: true, reason: 'user' });
  });

  it('a PIN older than 2 minutes is not fresh', async () => {
    useUiStore.setState({ lastPinVerifiedAt: Date.now() - 3 * 60_000 });
    const { r, onNeedPin } = await show();
    await flip(r.root, true);
    expect(onNeedPin).toHaveBeenCalled();
  });

  it('turning it off needs no PIN and deletes the item', async () => {
    useAccountStore.setState({ biometricShortcut: { v: 1, enabledAt: EPOCH + 1, epoch: EPOCH } });
    const { r } = await show();
    const node = theSwitch(r.root);
    expect(node.props['aria-checked'] ?? node.props.checked).toBe(true);
    await flip(r.root, false);
    expect(useAccountStore.getState().biometricShortcut).toBeNull();
    expect(port.remove).toHaveBeenCalled();
    expect(tracked.find((e) => e.name === 'pin.biometric_changed')?.payload).toEqual({ on: false, reason: 'user' });
  });

  it('a record for another PIN shows off', async () => {
    useAccountStore.setState({ biometricShortcut: { v: 1, enabledAt: 1, epoch: EPOCH - 1 } });
    const { r } = await show();
    const node = theSwitch(r.root);
    expect(node.props['aria-checked'] ?? node.props.checked).toBe(false);
  });

  it('with no PIN it is disabled and the hint says to set a PIN first', async () => {
    useAccountStore.setState({ parentPinHash: null });
    const { r, onNeedPin } = await show();
    expect(screenTexts(r.root)).toContain(m.needsPinFirst);
    expect(screenTexts(r.root)).not.toContain(m.biometric.warning);
    expect(theSwitch(r.root).props.disabled).toBe(true);
    await flip(r.root, true);
    expect(onNeedPin).not.toHaveBeenCalled();
    expect(port.write).not.toHaveBeenCalled();
  });

  it('is hidden with the flag off (a stored opt-in ignored) and without strong biometrics', async () => {
    flags.biometricShortcutEnabled = false;
    useAccountStore.setState({ biometricShortcut: { v: 1, enabledAt: EPOCH + 1, epoch: EPOCH } });
    let shown = await show();
    expect(byTestId(shown.r.root, 'dashboard-biometric')).toHaveLength(0);
    expect(port.available).not.toHaveBeenCalled();
    await cleanup();
    flags.biometricShortcutEnabled = true;
    port.available.mockResolvedValue(false);
    shown = await show();
    expect(byTestId(shown.r.root, 'dashboard-biometric')).toHaveLength(0);
  });
});
