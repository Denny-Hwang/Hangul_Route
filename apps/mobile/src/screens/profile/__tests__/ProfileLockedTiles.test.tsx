import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-5 (sections 6.1, 6.3, 13.2, 16; CS-3, CS-4): the Profile tile row
 * enforces locks whatever the chooser flag says (fail safe). A locked tile carries the glyph and a caption and asks the
 * grown-up PIN (`LockedProfile`); a tap never switches to it directly and never opens a grown-up session.
 */
const navigation = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }));
vi.mock('@react-navigation/native', () => ({ useNavigation: () => navigation, useFocusEffect: () => undefined }));
vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));

import { flags } from '../../../config/flags';
import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { resetProfileLocks, useProfileLocks } from '../../../store/profile-locks';
import { useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { ProfileScreen } from '../ProfileScreen';

const en = getMessages('en');
const t = en.learner.profile;

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
  navigation.navigate.mockReset();
  resetProfileLocks();
  flags.whoChooserEnabled = false;
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useProfileStore.setState({ profiles: [child('profile:mina', 'Mina'), child('profile:sora', 'Sora')], activeId: 'profile:mina', activeSince: Date.now() - 30_000 });
  useAccountStore.setState({ parentPinHash: 'pin-hash' });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
});

describe('[OA] locked Profile tiles (row OA-5)', () => {
  it('with the chooser flag off, a locked tile still carries the glyph and caption and asks the PIN; it never switches', async () => {
    useProfileLocks.setState({ read: ['profile:sora'] });
    const r = await render(<ProfileScreen />);
    expect(byTestId(r.root, 'profile-tile-lock-profile:sora')).toHaveLength(1);
    expect(byTestId(r.root, 'profile-tile-lock-profile:mina')).toHaveLength(0);
    expect(screenTexts(r.root)).toContain(en.learner.who.lockedCaption);
    const [sora] = buttonsNamed(r.root, en.a11y.who.lockedTile('Sora'));
    expect(buttonsNamed(r.root, t.switchTo('Sora'))).toHaveLength(0);
    await press(sora as ReactTestInstance);
    expect(navigation.navigate).toHaveBeenCalledWith('PinEntry', { next: 'LockedProfile', profileId: 'profile:sora', lockedFrom: { via: 'profile' } });
    expect(useProfileStore.getState().activeId).toBe('profile:mina');
    // The tap opens no grown-up session (CS-3).
    expect(useUiStore.getState()).toMatchObject({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
  });

  it('the active learner\'s own locked tile switches nothing and asks nothing', async () => {
    useProfileLocks.setState({ read: ['profile:mina'] });
    const r = await render(<ProfileScreen />);
    // It asks nothing, so it is not announced as a tile the PIN opens; the badge and caption still show the lock.
    expect(buttonsNamed(r.root, en.a11y.who.lockedTile('Mina'))).toHaveLength(0);
    expect(byTestId(r.root, 'profile-tile-lock-profile:mina')).toHaveLength(1);
    await press(buttonsNamed(r.root, en.learner.profile.switchTo('Mina'))[0] as ReactTestInstance);
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(useProfileStore.getState().activeId).toBe('profile:mina');
  });

  it('locks that cannot be read: every tile locked, one line, no per-tile caption', async () => {
    useProfileLocks.setState({ read: 'unread' });
    const r = await render(<ProfileScreen />);
    expect(screenTexts(byTestId(r.root, 'profile-locks-unread')[0]!)).toEqual([en.learner.who.locksUnread]);
    expect(byTestId(r.root, 'profile-tile-lock-profile:mina')).toHaveLength(1);
    expect(byTestId(r.root, 'profile-tile-lock-profile:sora')).toHaveLength(1);
    expect(screenTexts(r.root)).not.toContain(en.learner.who.lockedCaption);
  });

  it('a lock without a PIN is void: the tile is one tap, with no glyph (CS-4)', async () => {
    useAccountStore.setState({ parentPinHash: null });
    useProfileLocks.setState({ read: ['profile:sora'] });
    const r = await render(<ProfileScreen />);
    expect(byTestId(r.root, 'profile-tile-lock-profile:sora')).toHaveLength(0);
    await press(buttonsNamed(r.root, t.switchTo('Sora'))[0] as ReactTestInstance);
    expect(useProfileStore.getState().activeId).toBe('profile:sora');
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
