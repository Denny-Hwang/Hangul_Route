import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-4a (section 6.2, the `manual` trigger): the Home Switch button and the
 * Profile **Who is using this?** row open the chooser while the flag is on and the device has 2 or more learners;
 * with the flag off neither exists (the Profile tile row as before).
 */
const navigation = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }));
vi.mock('@react-navigation/native', () => ({ useNavigation: () => navigation, useFocusEffect: () => undefined }));
vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));

import { WhoSwitchButton } from '../../../components/WhoSwitchButton';
import { flags } from '../../../config/flags';
import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, setPlatform } from '../../../test-support/render';
import { ProfileScreen } from '../../profile/ProfileScreen';

const w = getMessages('en').learner.who;
const learner = (id: string, displayName: string): Profile => ({
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
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useProfileStore.setState({ profiles: [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun')], activeId: 'profile:mina', hydrated: true });
  useAccountStore.setState({ parentPinHash: 'h' });
  flags.whoChooserEnabled = true;
});

afterEach(async () => {
  flags.whoChooserEnabled = false;
  await cleanup();
  resetPlatform();
});

describe('Home Switch (WhoSwitchButton)', () => {
  it('is named Switch, opens the chooser with the manual trigger', async () => {
    const onPress = vi.fn();
    const r = await render(<WhoSwitchButton onPress={onPress} />);
    const [button] = buttonsNamed(r.root, w.switch);
    expect(button).toBeDefined();
    await press(button as ReactTestInstance);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is not there with one learner, or with the flag off', async () => {
    useProfileStore.setState({ profiles: [learner('profile:mina', 'Mina')] });
    let r = await render(<WhoSwitchButton onPress={() => undefined} />);
    expect(byTestId(r.root, 'home-who-switch')).toHaveLength(0);
    await cleanup();
    useProfileStore.setState({ profiles: [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun')] });
    flags.whoChooserEnabled = false;
    r = await render(<WhoSwitchButton onPress={() => undefined} />);
    expect(byTestId(r.root, 'home-who-switch')).toHaveLength(0);
  });
});

describe('Profile: the Who is using this? row', () => {
  it('opens the chooser; the tiles stay as a second way to switch', async () => {
    const r = await render(<ProfileScreen />);
    await press(byTestId(r.root, 'profile-who-row')[0] as ReactTestInstance);
    expect(navigation.navigate).toHaveBeenLastCalledWith('WhoIsUsing', { trigger: 'manual' });
    expect(buttonsNamed(r.root, getMessages('en').learner.profile.switchTo('Jun'))).toHaveLength(1);
  });

  it('with the flag off the Profile screen is as before', async () => {
    flags.whoChooserEnabled = false;
    const r = await render(<ProfileScreen />);
    expect(byTestId(r.root, 'profile-who-row')).toHaveLength(0);
  });
});
