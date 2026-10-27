import type { LearnerMembership, Profile } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { TextInput } from 'react-native';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useMembershipStore, type LookupOutcome } from '../../../store/membership-store';
import { useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, byTestId, press, render, resetPlatform, screenTexts, setPlatform, unmount } from '../../../test-support/render';
import { JoinSpaceScreen } from '../JoinSpaceScreen';

/**
 * Owner report 2026-10-23: a learner moved from class A to class B showed in both. The Join screen says why a join is
 * refused while a move stands or waits (and offers no Join then), says that a class join keeps the classes the learner
 * is in (with Move when this device may start one), and on a class tablet the move left without its class offers the
 * roster pick only.
 */

const LEARNER_ID = 'profile:test';
const navigation = { navigate: vi.fn(), goBack: vi.fn(), addListener: vi.fn(() => () => undefined) };
const real = {
  lookup: useMembershipStore.getState().lookup,
  join: useMembershipStore.getState().join,
  deviceScope: useMembershipStore.getState().deviceScope,
  hydrate: useMembershipStore.getState().hydrate,
};
const rowA: LearnerMembership = { spaceId: 'space:a', kind: 'class', name: 'Class A', role: 'student', joinedAt: 't' };
const spaceB = { id: 'space:b', kind: 'class' as const, name: 'Class B' };
const join = vi.fn(async (..._args: unknown[]) => ({ ok: true as const, alreadyMember: false, membership: { ...rowA, spaceId: 'space:b', name: 'Class B' } }));

function learner(over: Partial<Profile> = {}): Profile {
  return { id: LEARNER_ID, displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'self', ...over };
}

function seed(opts: { lookup?: Partial<Extract<LookupOutcome, { ok: true }>>; rows?: LearnerMembership[]; scope?: 'full' | 'class'; locale?: UiLocale; rejoin?: boolean } = {}): void {
  useProfileStore.setState({ profiles: [learner()], activeId: LEARNER_ID });
  useAccountStore.setState({ parentPinHash: null, selfConsentAcceptedAt: '2026-10-01T00:00:00.000Z' });
  useUiStore.setState({ parentGateOpenedAt: null });
  useLocaleStore.setState({ device: opts.locale ?? 'en', byProfile: {} });
  useMembershipStore.setState({
    byLearner: { [LEARNER_ID]: opts.rows ?? [] },
    transfersByLearner: {},
    rejoinByLearner: opts.rejoin === undefined ? {} : { [LEARNER_ID]: opts.rejoin },
    lookup: vi.fn(async () => ({ ok: true as const, space: spaceB, full: false, seat: null, roster: [], ...opts.lookup })),
    join: join as never,
    deviceScope: vi.fn(async () => opts.scope ?? 'full'),
    hydrate: vi.fn(async () => opts.rows ?? []),
  });
}

const type = async (root: ReactTestInstance, id: string, text: string): Promise<void> => {
  await act(async () => {
    root.findAll((n) => n.type === TextInput && n.props.testID === id)[0]!.props.onChangeText(text);
  });
};

async function lookUp(locale: UiLocale = 'en'): Promise<Awaited<ReturnType<typeof render>>> {
  const m = getMessages(locale).caregiver.join;
  const renderer = await render(<JoinSpaceScreen navigation={navigation as never} route={{ key: 'JoinSpace', name: 'JoinSpace' } as never} />);
  await type(renderer.root, 'join-code', 'K7M2X9');
  await press(buttonsNamed(renderer.root, m.code.join.cta)[0]!);
  return renderer;
}

beforeEach(() => {
  vi.stubGlobal('document', { activeElement: null });
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.e2e.invalid');
  setPlatform('web');
  join.mockClear();
  navigation.navigate.mockClear();
});

afterEach(() => {
  resetPlatform();
  vi.unstubAllGlobals();
  useMembershipStore.setState({ ...real, byLearner: {}, transfersByLearner: {}, rejoinByLearner: {} });
});

describe('JoinSpaceScreen: a move that stands or waits (owner report 2026-10-23)', () => {
  it.each(['en', 'es', 'ko'] as const)('%s: a lookup naming the class the learner moved to shows the line and no Join', async (locale) => {
    const c = getMessages(locale).caregiver;
    seed({ locale, lookup: { space: { id: 'space:a', kind: 'class', name: 'Class A' }, moved: { to: { spaceId: 'space:b', name: 'Class B' } } } });
    const renderer = await lookUp(locale);
    expect(byTestId(renderer.root, 'join-confirm')).toHaveLength(1);
    expect(screenTexts(renderer.root)).toContain(c.join.errors.movedOut('Suni', 'Class B', 'Class A'));
    expect(buttonsNamed(renderer.root, c.join.confirm.me.cta)).toHaveLength(0);
    expect(join).not.toHaveBeenCalled();
    await unmount(renderer);
  });

  it('a lookup naming a move that waits into this class shows the line and no Join', async () => {
    const c = getMessages('en').caregiver;
    seed({ lookup: { moveWaiting: { from: { spaceId: 'space:a', name: 'Class A' } } } });
    const renderer = await lookUp();
    expect(screenTexts(renderer.root)).toContain('A move to Class B is waiting for the teacher. It finishes when they say yes.');
    expect(buttonsNamed(renderer.root, c.join.confirm.me.cta)).toHaveLength(0);
    // "Not this one" goes back to the code, and the line goes with the class.
    await press(buttonsNamed(renderer.root, c.join.confirm.notThis.cta)[0]!);
    expect(byTestId(renderer.root, 'join-move-line')).toHaveLength(0);
    await unmount(renderer);
  });

  it('a join refused with moved_out (an older lookup) shows the same line on the class, never the three-classes line', async () => {
    const c = getMessages('en').caregiver;
    seed({ lookup: { space: { id: 'space:a', kind: 'class', name: 'Class A' } } });
    join.mockResolvedValueOnce({ ok: false, error: 'moved_out', to: { spaceId: 'space:b', name: 'Class B' } } as never);
    const renderer = await lookUp();
    await press(buttonsNamed(renderer.root, c.join.confirm.me.cta)[0]!);
    expect(byTestId(renderer.root, 'join-confirm')).toHaveLength(1);
    expect(screenTexts(renderer.root)).toContain('Suni moved to Class B. To be in Class A too, ask the teacher.');
    expect(screenTexts(renderer.root)).not.toContain(c.audience.shared.joinCodeFull);
    expect(buttonsNamed(renderer.root, c.join.confirm.me.cta)).toHaveLength(0);
    await unmount(renderer);
  });

  it('a join refused with move_waiting shows the waiting line', async () => {
    const c = getMessages('en').caregiver;
    seed();
    join.mockResolvedValueOnce({ ok: false, error: 'move_waiting', from: { spaceId: 'space:a', name: 'Class A' } } as never);
    const renderer = await lookUp();
    await press(buttonsNamed(renderer.root, c.join.confirm.me.cta)[0]!);
    expect(screenTexts(renderer.root)).toContain('A move to Class B is waiting for the teacher. It finishes when they say yes.');
    await unmount(renderer);
  });
});

describe('JoinSpaceScreen: a join keeps the classes the learner is in (owner report 2026-10-23)', () => {
  it.each(['en', 'es', 'ko'] as const)('%s: names the class the learner stays in, under the confirm button', async (locale) => {
    const c = getMessages(locale).caregiver;
    seed({ locale, rows: [rowA] });
    const renderer = await lookUp(locale);
    expect(screenTexts(renderer.root)).toContain(c.join.confirm.staysIn('Suni', ['Class A']));
    // Join is still offered: joining two classes is allowed (up to three).
    expect(buttonsNamed(renderer.root, c.join.confirm.me.cta)).toHaveLength(1);
    await unmount(renderer);
  });

  it('no line for a learner in no other class', async () => {
    seed({ rows: [{ ...rowA, spaceId: 'space:f', kind: 'family', name: 'Kim family' }] });
    const renderer = await lookUp();
    expect(byTestId(renderer.root, 'join-stays-in')).toHaveLength(0);
    await unmount(renderer);
  });

  it('offers Move from the one class when this device may start a move, and it opens the move from that class', async () => {
    const t = getMessages('en').caregiver.transfer;
    seed({ rows: [rowA] });
    useMembershipStore.setState({ transfersByLearner: { [LEARNER_ID]: { enabled: true, deviceConsent: true, selfManaged: false, scope: 'full', requests: [] } } });
    const renderer = await lookUp();
    const move = buttonsNamed(renderer.root, t.actions.move.cta);
    expect(move).toHaveLength(1);
    await press(move[0]!);
    expect(navigation.navigate).toHaveBeenCalledWith('MoveClass', { profileId: LEARNER_ID, fromSpaceId: 'space:a' });
    await unmount(renderer);
  });

  it('no Move while moves are off for the learner (the line stays)', async () => {
    const t = getMessages('en').caregiver.transfer;
    seed({ rows: [rowA] });
    useMembershipStore.setState({ transfersByLearner: { [LEARNER_ID]: { enabled: false, deviceConsent: true, selfManaged: false, scope: 'full', requests: [] } } });
    const renderer = await lookUp();
    expect(byTestId(renderer.root, 'join-stays-in')).toHaveLength(1);
    expect(buttonsNamed(renderer.root, t.actions.move.cta)).toHaveLength(0);
    await unmount(renderer);
  });
});

describe('JoinSpaceScreen: a class tablet the move left without its class (owner report 2026-10-23)', () => {
  const roster = [{ learnerId: 'profile:m', name: 'Minho' }];

  it('opens the roster pick with no "I\'m new"', async () => {
    const m = getMessages('en').caregiver.join;
    seed({ scope: 'class', rejoin: false, lookup: { roster } });
    const renderer = await lookUp();
    expect(byTestId(renderer.root, 'join-pick')).toHaveLength(1);
    expect(buttonsNamed(renderer.root, 'Minho')).toHaveLength(1);
    expect(buttonsNamed(renderer.root, m.pick.newHere.cta)).toHaveLength(0);
    await press(buttonsNamed(renderer.root, m.confirm.notThis.cta)[0]!);
    expect(byTestId(renderer.root, 'join-pick')).toHaveLength(0);
    expect(byTestId(renderer.root, 'join-confirm')).toHaveLength(0);
    await unmount(renderer);
  });

  it('a full device keeps "I\'m new" on the roster pick', async () => {
    const m = getMessages('en').caregiver.join;
    seed({ scope: 'full', rejoin: false, lookup: { roster } });
    const renderer = await lookUp();
    expect(byTestId(renderer.root, 'join-confirm')).toHaveLength(1);
    await press(buttonsNamed(renderer.root, m.confirm.alreadyIn.cta)[0]!);
    expect(buttonsNamed(renderer.root, m.pick.newHere.cta)).toHaveLength(1);
    await unmount(renderer);
  });
});
