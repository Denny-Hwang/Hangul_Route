import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { TextInput } from 'react-native';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useMembershipStore } from '../../../store/membership-store';
import { useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, byTestId, render, resetPlatform, screenTexts, setPlatform, unmount } from '../../../test-support/render';
import { EditProfileScreen } from '../EditProfileScreen';

/**
 * F-LEARN-001 section 3.11: Edit profile on a class device (a class re-link, `device-scope` 'class'), where the
 * server refuses name, level and cub edits. The three rows are disabled, the class-device line shows, the "teacher's
 * list updates" line does not, and anything typed before the answer came back goes back to the stored values. Save
 * stays closed until the device scope is known.
 */

const e = getMessages('en').learner.editProfile;
const LEARNER_ID = 'profile:test';
const navigation = { navigate: vi.fn(), goBack: vi.fn() };
const realDeviceScope = useMembershipStore.getState().deviceScope;
const realHydrate = useMembershipStore.getState().hydrate;

function learner(): Profile {
  return { id: LEARNER_ID, displayName: 'test', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'self' };
}

/** A self learner in one class, the gate open (no PIN on a self-only device), and the device scope `answer` gives. */
function seed(answer: () => Promise<'full' | 'class'>): void {
  useProfileStore.setState({ profiles: [learner()], activeId: LEARNER_ID });
  useAccountStore.setState({ parentPinHash: null, selfConsentAcceptedAt: '2026-10-01T00:00:00.000Z' });
  useUiStore.setState({ parentGateOpenedAt: null });
  useLocaleStore.setState({ device: 'en', session: null, byProfile: {} });
  useMembershipStore.setState({
    byLearner: { [LEARNER_ID]: [{ spaceId: 'space:c', kind: 'class', name: 'Sunflower', role: 'learner', joinedAt: '2026-10-02T00:00:00.000Z' } as never] },
    deviceScope: vi.fn(answer),
    hydrate: vi.fn(async () => useMembershipStore.getState().byLearner[LEARNER_ID] ?? []),
  });
}

function screen(): React.ReactElement {
  return <EditProfileScreen navigation={navigation as never} route={{ key: 'EditProfile', name: 'EditProfile', params: { profileId: LEARNER_ID } } as never} />;
}

const nameField = (root: ReactTestInstance): ReactTestInstance => root.findAll((n) => n.type === TextInput)[0]!;
const saveDisabled = (root: ReactTestInstance): boolean => {
  const save = buttonsNamed(root, e.save.cta)[0]!;
  return save.props['aria-disabled'] === true || save.props.disabled === true;
};

beforeEach(() => {
  // react-native-web's TextInput reads `document.activeElement` when it mounts; Node has no document.
  vi.stubGlobal('document', { activeElement: null });
  setPlatform('web');
  navigation.navigate.mockReset();
  navigation.goBack.mockReset();
});

afterEach(() => {
  resetPlatform();
  vi.unstubAllGlobals();
  useMembershipStore.setState({ deviceScope: realDeviceScope, hydrate: realHydrate, byLearner: {} });
});

describe('EditProfileScreen on a class device (F-LEARN-001 section 3.11)', () => {
  it('disables the name, level and cub rows and says where they change; the class-list line is hidden', async () => {
    seed(async () => 'class');
    const renderer = await render(screen());
    const texts = screenTexts(renderer.root);
    expect(byTestId(renderer.root, 'edit-class-device')).toHaveLength(1);
    expect(texts).toContain(e.classDevice);
    expect(texts).not.toContain(e.classNote);
    expect(nameField(renderer.root).props.editable).toBe(false);
    const disabledRadios = renderer.root.findAll((n) => typeof n.type !== 'string' && n.props.accessibilityRole === 'radio' && n.props.disabled === true);
    expect(disabledRadios.length).toBeGreaterThan(0);
    await unmount(renderer);
  });

  it('puts back a name typed before the device scope answered', async () => {
    let answer!: (scope: 'class') => void;
    seed(() => new Promise((resolve) => (answer = resolve)));
    const renderer = await render(screen());
    // The answer has not come back: Save stays closed, and the typed name shows for now.
    expect(saveDisabled(renderer.root)).toBe(true);
    await act(async () => {
      nameField(renderer.root).props.onChangeText('Sungjoo');
    });
    expect(nameField(renderer.root).props.value).toBe('Sungjoo');
    expect(saveDisabled(renderer.root)).toBe(true);
    await act(async () => answer('class'));
    expect(nameField(renderer.root).props.value).toBe('test');
    expect(useProfileStore.getState().profiles[0]?.displayName).toBe('test');
    await unmount(renderer);
  });

  it('on a full device the rows stay open, the class-list line shows, and Save opens once the scope is known', async () => {
    seed(async () => 'full');
    const renderer = await render(screen());
    const texts = screenTexts(renderer.root);
    expect(texts).toContain(e.classNote);
    expect(texts).not.toContain(e.classDevice);
    expect(nameField(renderer.root).props.editable).toBe(true);
    await act(async () => {
      nameField(renderer.root).props.onChangeText('Sungjoo');
    });
    expect(saveDisabled(renderer.root)).toBe(false);
    await unmount(renderer);
  });

  it('a device scope read that fails reads as a full device, so Save is not closed for good', async () => {
    seed(async () => {
      throw new Error('storage');
    });
    const renderer = await render(screen());
    expect(screenTexts(renderer.root)).not.toContain(e.classDevice);
    await act(async () => {
      nameField(renderer.root).props.onChangeText('Sungjoo');
    });
    expect(saveDisabled(renderer.root)).toBe(false);
    await unmount(renderer);
  });
});
