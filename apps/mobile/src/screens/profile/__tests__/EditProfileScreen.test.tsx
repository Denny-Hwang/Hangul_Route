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

// The native navigation package has no build that loads in Node: the back guard's route context stands in for it.
vi.mock('@react-navigation/native', async () => {
  const { createContext } = await import('react');
  return { NavigationContext: createContext(undefined) };
});

// The confirm step (a ConfirmSheet on the web, the platform Alert on native) answers as each case sets it.
const confirmAnswer: { next: Promise<boolean>; asked: unknown[] } = vi.hoisted(() => ({ next: Promise.resolve(false), asked: [] }));
vi.mock('../../../platform/dialog', () => ({
  confirm: (opts: unknown) => {
    confirmAnswer.asked.push(opts);
    return confirmAnswer.next;
  },
}));

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
  useLocaleStore.setState({ device: 'en', byProfile: {} });
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

describe('EditProfileScreen: a back with changes not saved yet asks first (AMENDMENTS-DISPLAY-NAV sections 7.1 and 8)', () => {
  type Listener = (event: { data: { action: { type: string } }; preventDefault: () => void }) => void;
  interface GuardedNavigation {
    navigate: ReturnType<typeof vi.fn>;
    goBack: ReturnType<typeof vi.fn>;
    setOptions: ReturnType<typeof vi.fn>;
    addListener: (type: string, listener: Listener) => () => void;
    back: () => boolean;
  }
  function guardedNavigation(): GuardedNavigation {
    const listeners: Listener[] = [];
    return {
      navigate: vi.fn(),
      goBack: vi.fn(),
      setOptions: vi.fn(),
      addListener: (_type: string, listener: Listener) => {
        listeners.push(listener);
        return () => listeners.splice(listeners.indexOf(listener), 1);
      },
      /** A back reaching `beforeRemove`; true when the screen held it. */
      back: () => {
        let held = false;
        for (const listener of listeners) listener({ data: { action: { type: 'GO_BACK' } }, preventDefault: () => (held = true) });
        return held;
      },
    };
  }
  const guarded = (nav: GuardedNavigation): React.ReactElement => (
    <EditProfileScreen navigation={nav as never} route={{ key: 'EditProfile', name: 'EditProfile', params: { profileId: LEARNER_ID } } as never} />
  );

  beforeEach(() => {
    confirmAnswer.asked = [];
  });

  it('nothing changed: Back leaves at once, with no question', async () => {
    seed(async () => 'full');
    const nav = guardedNavigation();
    const renderer = await render(guarded(nav));
    expect(nav.back()).toBe(false);
    expect(confirmAnswer.asked).toEqual([]);
    await unmount(renderer);
  });

  it('a changed name: Back asks with Keep editing first; Keep editing stays, Leave goes back once', async () => {
    seed(async () => 'full');
    const nav = guardedNavigation();
    const renderer = await render(guarded(nav));
    await act(async () => {
      nameField(renderer.root).props.onChangeText('Sungjoo');
    });

    let answer!: (yes: boolean) => void;
    confirmAnswer.next = new Promise((resolve) => (answer = resolve));
    expect(nav.back()).toBe(true);
    // A second back while the question is open asks nothing more.
    expect(nav.back()).toBe(true);
    expect(confirmAnswer.asked).toEqual([{ title: e.leave.title, message: e.leave.message, confirmLabel: e.leave.confirm.cta, cancelLabel: e.leave.keep.cta, destructive: true }]);
    await act(async () => answer(false));
    expect(nav.goBack).not.toHaveBeenCalled();
    expect(nameField(renderer.root).props.value).toBe('Sungjoo');

    confirmAnswer.next = Promise.resolve(true);
    expect(nav.back()).toBe(true);
    await act(async () => undefined);
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    // The back Leave sends goes through.
    expect(nav.back()).toBe(false);
    await unmount(renderer);
  });
});
