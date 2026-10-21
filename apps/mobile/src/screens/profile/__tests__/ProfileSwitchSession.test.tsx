import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-2 (OA-D5b, CS-15; section 15): a switch with a Profile tile closes
 * the grown-up session (so re-opening the Grown-up area asks the PIN) and sends `profile.switch` with codes only.
 */
const navigation = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }));
vi.mock('@react-navigation/native', () => ({ useNavigation: () => navigation, useFocusEffect: () => undefined }));
const tracked = vi.hoisted(() => [] as { name: string; payload?: Record<string, unknown> }[]);
vi.mock('../../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string }) => {
    tracked.push(event);
    return true;
  }),
}));

import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, setPlatform } from '../../../test-support/render';
import { ProfileScreen } from '../ProfileScreen';

const t = getMessages('en').learner.profile;

const child = (id: string, displayName: string): Profile => ({
  id,
  displayName,
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType: 'child',
});

beforeEach(() => {
  setPlatform('ios');
  tracked.length = 0;
  navigation.navigate.mockReset();
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useProfileStore.setState({ profiles: [child('profile:mina', 'Mina'), child('profile:joon', 'Joon')], activeId: 'profile:mina', activeSince: Date.now() - 30_000 });
  useAccountStore.setState({ parentPinHash: 'pin-hash' });
  // A grown-up opened the session a moment ago (PIN entered now).
  useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: Date.now() });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
});

async function openGrownUpArea(root: ReactTestInstance): Promise<void> {
  if (byTestId(root, 'profile-grown-up-area').length === 0) {
    await press(byTestId(root, 'profile-group-grown-ups-toggle')[0] as ReactTestInstance);
  }
  const [row] = byTestId(root, 'profile-grown-up-area');
  await press(row as ReactTestInstance);
}

describe('Profile tiles and the grown-up session', () => {
  it('with the session open, the Grown-up area opens directly; after a tile switch it asks the PIN', async () => {
    const r = await render(<ProfileScreen />);
    await openGrownUpArea(r.root);
    expect(navigation.navigate).toHaveBeenLastCalledWith('ParentDashboard');
    expect(tracked.find((e) => e.name === 'parent.gate.opened')?.payload).toEqual({ dest: 'area', via: 'session', marker: 'pin' });

    const [joon] = buttonsNamed(r.root, t.switchTo('Joon'));
    await press(joon as ReactTestInstance);
    expect(useProfileStore.getState().activeId).toBe('profile:joon');
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    const switched = tracked.find((e) => e.name === 'profile.switch');
    expect(switched).toEqual({ name: 'profile.switch', payload: { via: 'profile', trigger: 'none', locked: false, minutesIn: '0-2' } });

    navigation.navigate.mockReset();
    await openGrownUpArea(r.root);
    expect(navigation.navigate).toHaveBeenLastCalledWith('PinEntry', { next: 'ParentDashboard' });
  });

  it('the active tile again is no switch: no event, the session stays', async () => {
    const r = await render(<ProfileScreen />);
    const [mina] = buttonsNamed(r.root, t.switchTo('Mina'));
    await press(mina as ReactTestInstance);
    expect(tracked.filter((e) => e.name === 'profile.switch')).toHaveLength(0);
    expect(useUiStore.getState().parentGateOpenedAt).not.toBeNull();
  });
});
