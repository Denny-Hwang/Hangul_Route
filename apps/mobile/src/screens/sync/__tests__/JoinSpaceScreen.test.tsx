import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { TextInput } from 'react-native';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAME_MAX } from '../../../logic/profiles/profile-model';
import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useMembershipStore } from '../../../store/membership-store';
import { useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, byTestId, press, render, resetPlatform, screenTexts, setPlatform, unmount } from '../../../test-support/render';
import { JoinSpaceScreen } from '../JoinSpaceScreen';

/**
 * F-LEARN-001 section 3.11: the Join screen's name field. It starts from the profile name, follows the profile rule
 * with the create form's hints (a too-long name, a character the rule refuses), capitalizes every word, and lets a
 * stored name that predates the rule join as it is. A rename is a grown-up action, so on a device whose grown-up
 * gate is closed the field keeps the profile name and says where the name changes.
 */

const en = getMessages('en');
const m = en.caregiver.join;
const hints = en.learner.createProfile.nameHint;
const LEARNER_ID = 'profile:test';
const navigation = { navigate: vi.fn(), goBack: vi.fn() };
const real = { lookup: useMembershipStore.getState().lookup, join: useMembershipStore.getState().join };
const join = vi.fn(async (..._args: unknown[]) => ({
  ok: true as const,
  alreadyMember: false,
  membership: { spaceId: 'space:c', kind: 'class' as const, name: 'Sunflower', joinedAt: '2026-10-14T00:00:00.000Z' },
}));

function learner(over: Partial<Profile> = {}): Profile {
  return { id: LEARNER_ID, displayName: 'test', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'self', ...over };
}

/** `gated`: a family device with a PIN and no open grown-up session. Otherwise a self-only device with no PIN. */
function seed(profile: Profile, gated = false): void {
  useProfileStore.setState({ profiles: [profile], activeId: LEARNER_ID });
  useAccountStore.setState({ parentPinHash: gated ? 'pin-hash' : null });
  useUiStore.setState({ parentGateOpenedAt: null });
  useLocaleStore.setState({ device: 'en', session: null, byProfile: {} });
  useMembershipStore.setState({
    lookup: vi.fn(async () => ({ ok: true as const, space: { id: 'space:c', kind: 'class' as const, name: 'Sunflower' }, full: false, roster: [] })),
    join: join as never,
  });
}

const input = (root: ReactTestInstance, id: string): ReactTestInstance => root.findAll((n) => n.type === TextInput && n.props.testID === id)[0]!;
const type = async (root: ReactTestInstance, id: string, text: string): Promise<void> => {
  await act(async () => {
    input(root, id).props.onChangeText(text);
  });
};
const meButton = (root: ReactTestInstance): ReactTestInstance => buttonsNamed(root, m.confirm.me.cta)[0]!;
const disabled = (node: ReactTestInstance): boolean => node.props['aria-disabled'] === true || node.props.disabled === true;

/** Code, then the class: the name step. */
async function reachName(): Promise<Awaited<ReturnType<typeof render>>> {
  const renderer = await render(<JoinSpaceScreen navigation={navigation as never} route={{ key: 'JoinSpace', name: 'JoinSpace' } as never} />);
  await type(renderer.root, 'join-code', 'K7M2X9');
  await press(buttonsNamed(renderer.root, m.code.join.cta)[0]!);
  expect(byTestId(renderer.root, 'join-confirm')).toHaveLength(1);
  return renderer;
}

beforeEach(() => {
  // react-native-web's TextInput reads `document.activeElement` when it mounts; Node has no document.
  vi.stubGlobal('document', { activeElement: null });
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.e2e.invalid');
  setPlatform('web');
  join.mockClear();
});

afterEach(() => {
  resetPlatform();
  vi.unstubAllGlobals();
  useMembershipStore.setState(real);
});

describe('JoinSpaceScreen name field (F-LEARN-001 section 3.11)', () => {
  it('starts from the profile name and capitalizes every word', async () => {
    seed(learner());
    const renderer = await reachName();
    const field = input(renderer.root, 'join-name');
    expect(field.props.value).toBe('test');
    expect(field.props.autoCapitalize).toBe('words');
    expect(field.props.editable).toBe(true);
    expect(screenTexts(renderer.root)).toContain(m.confirm.sameEverywhere);
    expect(byTestId(renderer.root, 'join-name-locked')).toHaveLength(0);
    await unmount(renderer);
  });

  it('a too-long name and a character the rule refuses each get the calm hint and keep the button closed', async () => {
    seed(learner());
    const renderer = await reachName();
    await type(renderer.root, 'join-name', 'Sungjoo Sungjoo');
    expect(screenTexts(renderer.root)).toContain(hints.tooLong(NAME_MAX));
    expect(disabled(meButton(renderer.root))).toBe(true);
    await type(renderer.root, 'join-name', 'Sungjoo :)');
    expect(screenTexts(renderer.root)).toContain(hints.unsupportedCharacter);
    expect(disabled(meButton(renderer.root))).toBe(true);
    await type(renderer.root, 'join-name', '   ');
    expect(disabled(meButton(renderer.root))).toBe(true);
    await type(renderer.root, 'join-name', 'Sungjoo');
    expect(disabled(meButton(renderer.root))).toBe(false);
    await press(meButton(renderer.root));
    expect(join).toHaveBeenCalledWith(LEARNER_ID, 'space:c', 'K7M2X9', 'Sungjoo');
    await unmount(renderer);
  });

  it('a stored name that predates the rule joins as it is, with no hint', async () => {
    const legacy = 'Suni from Busan';
    expect(legacy.length).toBeGreaterThan(NAME_MAX);
    seed(learner({ displayName: legacy }));
    const renderer = await reachName();
    expect(screenTexts(renderer.root)).not.toContain(hints.tooLong(NAME_MAX));
    expect(disabled(meButton(renderer.root))).toBe(false);
    await press(meButton(renderer.root));
    expect(join).toHaveBeenCalledWith(LEARNER_ID, 'space:c', 'K7M2X9', legacy);
    await unmount(renderer);
  });

  it('with the grown-up gate closed, the field keeps the profile name and says it changes in Edit profile', async () => {
    seed(learner({ learnerType: 'child' }), true);
    const renderer = await reachName();
    const field = input(renderer.root, 'join-name');
    expect(field.props.editable).toBe(false);
    expect(byTestId(renderer.root, 'join-name-locked')).toHaveLength(1);
    expect(screenTexts(renderer.root)).toContain(m.confirm.nameLocked);
    // Even a change that reached the field joins under the profile name.
    await type(renderer.root, 'join-name', 'Sungjoo');
    expect(input(renderer.root, 'join-name').props.value).toBe('test');
    await press(meButton(renderer.root));
    expect(join).toHaveBeenCalledWith(LEARNER_ID, 'space:c', 'K7M2X9', 'test');
    await unmount(renderer);
  });

  it('with the gate open (a grown-up session), the same device can change the name', async () => {
    seed(learner({ learnerType: 'child' }), true);
    useUiStore.setState({ parentGateOpenedAt: Date.now() });
    const renderer = await reachName();
    expect(input(renderer.root, 'join-name').props.editable).toBe(true);
    expect(byTestId(renderer.root, 'join-name-locked')).toHaveLength(0);
    await unmount(renderer);
  });
});
