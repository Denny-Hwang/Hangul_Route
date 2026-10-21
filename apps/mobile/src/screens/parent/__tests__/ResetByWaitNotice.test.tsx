import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D21 (section 8.5, row OA-2): a PIN set by the finished 24-hour wait is
 * announced once at the next Grown-up area entry after a PIN, with Change PIN; the record is then cleared.
 */
vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
  updateJson: vi.fn(async () => true),
  removeKey: vi.fn(async () => undefined),
}));

import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { ResetByWaitNotice } from '../ResetByWaitNotice';

const m = getMessages('en').caregiver.pin;
const AT = 1_800_000_000_000;

async function show() {
  const onChange = vi.fn();
  const r = await render(<ResetByWaitNotice onChange={onChange} />);
  return { r, onChange };
}

beforeEach(() => {
  setPlatform('ios');
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useAccountStore.setState({ parentPinHash: 'h:1', pinResetByWait: { v: 1, at: AT } });
  useUiStore.setState({ parentGateOpenedAt: AT + 5000, lastPinVerifiedAt: AT + 5000 });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
});

describe('Grown-up area: the reset-by-wait notice', () => {
  it('shows once after a PIN entered later, with Change PIN, and clears the record', async () => {
    const { r, onChange } = await show();
    expect(screenTexts(r.root)).toContain(m.resetByWaitNotice);
    expect(byTestId(r.root, 'dashboard-reset-by-wait')).toHaveLength(1);
    expect(useAccountStore.getState().pinResetByWait).toBeNull();
    await press(buttonsNamed(r.root, m.resetByWaitChange)[0] as ReactTestInstance);
    expect(onChange).toHaveBeenCalledTimes(1);
    await cleanup();
    const again = await show();
    expect(byTestId(again.r.root, 'dashboard-reset-by-wait')).toHaveLength(0);
    expect(screenTexts(again.r.root)).not.toContain(m.resetByWaitNotice);
  });

  it('never right after the setup by the wait itself (no PIN entered since)', async () => {
    useUiStore.setState({ parentGateOpenedAt: AT, lastPinVerifiedAt: null });
    const { r } = await show();
    expect(screenTexts(r.root)).not.toContain(m.resetByWaitNotice);
    expect(useAccountStore.getState().pinResetByWait).toEqual({ v: 1, at: AT });
  });
});
