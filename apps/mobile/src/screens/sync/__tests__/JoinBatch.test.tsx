import type { ProgressSnapshot, Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] Who is joining? (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D14, sections 10.2, 10.3, 10.6, CS-11; row OA-7b) through
 * the Join screen, rendered with react-native-web, against a mocked Worker: the real membership store and sync store
 * talk to a fake sync API that keeps the family's seats (one `/join` per learner, each seat taken atomically, a 409 cap
 * past the family cap, "already a member" for a member) and registers a learner that never synced. Section 20, OA-7b:
 * two join and one is refused at the cap; a never-synced learner is registered under the one consent; the network
 * drops after the first join, then Try again.
 */

const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => (disk.has(key) ? structuredClone(disk.get(key)) : null)),
  readJsonStrict: vi.fn(async (key: string) => (disk.has(key) ? structuredClone(disk.get(key)) : null)),
  readJsonExact: vi.fn(async (key: string) => (disk.has(key) ? structuredClone(disk.get(key)) : null)),
  writeJson: vi.fn(async (key: string, value: unknown) => void disk.set(key, structuredClone(value))),
  updateJson: vi.fn(async () => true),
  removeKey: vi.fn(async (key: string) => void disk.delete(key)),
}));
vi.mock('../../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
const tracked = vi.hoisted(() => [] as { name: string; payload?: Record<string, unknown>; profileId?: string }[]);
vi.mock('../../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string }) => {
    tracked.push(event);
    return true;
  }),
}));
const net = vi.hoisted(() => ({ online: true }));
vi.mock('../../../components/use-online', () => ({ useOnline: () => net.online }));
// The family home's hand-off code in this tab (`hr:shell:joinCode`), read once.
const handoff = vi.hoisted(() => ({ code: null as string | null }));
vi.mock('../../../platform/join-handoff', () => ({
  takeJoinHandoff: () => {
    const code = handoff.code;
    handoff.code = null;
    return code;
  },
}));

import { flags } from '../../../config/flags';
import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useMembershipStore } from '../../../store/membership-store';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { setSyncApiForTests, useSyncStore } from '../../../store/sync-store';
import { useUiStore } from '../../../store/ui-store';
import { batchHandoffPending, chooserLaunchTrigger, heldJoin, resetChooserState } from '../../../store/who-chooser';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { JoinSpaceScreen } from '../JoinSpaceScreen';

const en = getMessages('en');
const join = en.caregiver.join;
const who = join.who;
const SPACE = { id: 'space:kim', kind: 'family' as const, name: 'Kim family' };

const profile = (id: string, displayName: string, avatar: Profile['avatar'] = 'hoya-orange'): Profile => ({
  id,
  displayName,
  ageGroup: '8-9',
  avatar,
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType: 'child',
});
const MINA = profile('profile:mina', 'Mina');
const JUN = profile('profile:jun', 'Jun');
const SORA = profile('profile:sora', 'Sora', 'hoya-blue');
const snap = (profileId: string): ProgressSnapshot => ({ profileId, updatedAt: 't', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 });

/** The mocked Worker: the family's seats, registrations, and one way to drop the network. */
function worker(opts: { cap?: number; members?: string[]; dropJoinOf?: string } = {}) {
  const cap = opts.cap ?? 4;
  const members = new Set(opts.members ?? []);
  let drop = opts.dropJoinOf ?? null;
  const api = {
    register: vi.fn(async (p: { id: string }) => ({ status: 'ok', learnerId: p.id, secret: `sec:${p.id}` })),
    putSnapshot: vi.fn(async () => ({ status: 'ok', rev: 1 })),
    issueRescueCode: vi.fn(async () => ({ status: 'ok', code: 'TIGER-MOON-4821' })),
    claimRescueCode: vi.fn(),
    getSnapshot: vi.fn(),
    lookupSpace: vi.fn(async () => ({ status: 'ok', space: SPACE, full: false, seat: null, roster: [] })),
    joinSpace: vi.fn(async (_spaceId: string, body: { learnerId: string; displayName?: string }) => {
      if (drop === body.learnerId) {
        // The seat is taken on the Worker, then the answer is lost on the way back.
        members.add(body.learnerId);
        drop = null;
        return { status: 'error', code: 'network' };
      }
      if (members.has(body.learnerId)) return { status: 'ok', alreadyMember: true, membership: { spaceId: SPACE.id, kind: 'family', name: SPACE.name, role: 'student', joinedAt: 't' } };
      if (members.size >= cap) return { status: 'error', code: 'cap_family', cap };
      members.add(body.learnerId);
      return { status: 'ok', alreadyMember: false, membership: { spaceId: SPACE.id, kind: 'family', name: SPACE.name, role: 'student', joinedAt: 't' } };
    }),
    // The inbox read after a join is best effort (a failed read leaves the join as it is); it is not what this tests.
    getInbox: vi.fn(async () => ({ status: 'error', code: 'network' })),
    createRelink: vi.fn(),
    pollRelink: vi.fn(),
    leaveSpace: vi.fn(),
  };
  return { api, members };
}

// `beforeRemove` listeners Join registers, called the way the navigator calls them when Join is left.
const leaving = vi.hoisted(() => [] as ((e: { preventDefault: () => void }) => void)[]);
const navigation = {
  navigate: vi.fn(),
  goBack: vi.fn(),
  replace: vi.fn(),
  reset: vi.fn(),
  addListener: vi.fn((name: string, cb: (e: { preventDefault: () => void }) => void) => {
    if (name === 'beforeRemove') leaving.push(cb);
    return () => {
      const i = leaving.indexOf(cb);
      if (i >= 0) leaving.splice(i, 1);
    };
  }),
};
/** Join is left (Done goes Home, Back to today, a back gesture): whether a listener kept it from leaving as asked. */
const leave = (): boolean => {
  let prevented = false;
  for (const cb of [...leaving]) cb({ preventDefault: () => (prevented = true) });
  return prevented;
};
const realDeviceScope = useMembershipStore.getState().deviceScope;
const settle = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
};
const button = (root: ReactTestInstance, label: string): ReactTestInstance => {
  const [b] = buttonsNamed(root, label);
  if (!b) throw new Error(`no button ${label}: ${screenTexts(root).join(' | ')}`);
  return b;
};
const row = (root: ReactTestInstance, id: string): ReactTestInstance => byTestId(root, `join-who-row-${id}`)[0]!;
const checked = (node: ReactTestInstance): boolean => node.props['aria-checked'] === true;

/** Three learners on the device (Mina active and synced, Jun never synced, Sora locked), a PIN set. */
function seed(learners: Profile[] = [MINA, JUN, SORA], locks: string[] = [SORA.id]): void {
  useProfileStore.setState({ profiles: learners, activeId: MINA.id, hydrated: true });
  useAccountStore.setState({ parentPinHash: 'h:1234' });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useProgressStore.setState({ byProfile: Object.fromEntries(learners.map((l) => [l.id, snap(l.id)])), hydratedFor: new Set(learners.map((l) => l.id)) });
  useSyncStore.setState({ byLearner: {} });
  useSyncStore.getState().adoptCredentials(MINA.id, 'sec:mina', 1);
  disk.set('profiles:locks', { v: 1, ids: locks });
}

/** The code, then the family: the checklist. */
async function reachChecklist(): Promise<ReactTestInstance> {
  const r = await render(<JoinSpaceScreen navigation={navigation as never} route={{ key: 'JoinSpace', name: 'JoinSpace', params: { code: 'FAM234' } } as never} />);
  await settle();
  await press(button(r.root, join.code.join.cta));
  await settle();
  expect(byTestId(r.root, 'join-who')).toHaveLength(1);
  return r.root;
}

/** The grown-up enters the PIN on the PIN screen, which opens the gate and returns here (PinEntry `JoinSpace`). */
async function enterPin(): Promise<void> {
  await act(async () => {
    useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: Date.now() });
  });
  await settle();
}

async function throughNames(root: ReactTestInstance, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    expect(byTestId(root, 'join-confirm')).toHaveLength(1);
    await press(button(root, join.confirm.me.cta));
  }
  expect(byTestId(root, 'join-who-consent')).toHaveLength(1);
}

beforeEach(() => {
  vi.stubGlobal('document', { activeElement: null });
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.e2e.invalid');
  setPlatform('web');
  disk.clear();
  tracked.length = 0;
  net.online = true;
  handoff.code = null;
  resetChooserState();
  navigation.navigate.mockClear();
  navigation.reset.mockClear();
  leaving.length = 0;
  flags.multiJoinEnabled = true;
  useMembershipStore.setState({ byLearner: {}, deviceScope: realDeviceScope });
});

afterEach(async () => {
  await cleanup();
  flags.multiJoinEnabled = false;
  flags.whoChooserEnabled = false;
  setSyncApiForTests(null);
  resetPlatform();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Who is joining? with the mocked Worker (OA-7b)', () => {
  it('the checklist: the active learner checked, a locked profile unchecked with Takes a family place.', async () => {
    seed();
    setSyncApiForTests(worker().api as never);
    const root = await reachChecklist();
    expect(screenTexts(root)).toEqual(expect.arrayContaining([who.title, who.hint, 'Mina', 'Jun', 'Sora', who.takesPlace]));
    expect(checked(row(root, MINA.id))).toBe(true);
    expect(checked(row(root, JUN.id))).toBe(false);
    expect(checked(row(root, SORA.id))).toBe(false);
    // A real check box, named by the learner's name; the caption is its description.
    expect(row(root, SORA.id).props.role).toBe('checkbox');
    expect(row(root, SORA.id).props['aria-label']).toBe('Sora');
    expect(row(root, SORA.id).props['aria-describedby']).toBe(`join-who-caption-${SORA.id}`);
  });

  it('two join and one is refused at the cap: a calm result line, never an error, and space.join.batch', async () => {
    seed();
    const { api } = worker({ members: ['profile:x1', 'profile:x2'] });
    setSyncApiForTests(api as never);
    const root = await reachChecklist();
    await press(row(root, JUN.id));
    await press(row(root, SORA.id));
    // CS-11: anyone but the active learner asks a fresh PIN first.
    await press(button(root, en.common.buttons.next));
    expect(navigation.navigate).toHaveBeenCalledWith('PinEntry', { next: 'JoinSpace' });
    expect(byTestId(root, 'join-confirm')).toHaveLength(0);
    await enterPin();
    await throughNames(root, 3);
    await press(button(root, who.consentYes));
    await settle();
    expect(api.joinSpace.mock.calls.map(([, body]) => (body as { learnerId: string }).learnerId)).toEqual([MINA.id, JUN.id, SORA.id]);
    expect(screenTexts(root)).toEqual(
      expect.arrayContaining([who.result(2, 3), who.joined('Mina'), who.joined('Jun'), who.refused('Sora', join.errors.familyFull(4))]),
    );
    expect(screenTexts(root).join(' ')).not.toMatch(/error|fail/i);
    expect(buttonsNamed(root, en.common.buttons.done)).toHaveLength(1);
    const batch = tracked.filter((e) => e.name === 'space.join.batch');
    expect(batch).toHaveLength(1);
    expect(batch[0]).toEqual({ name: 'space.join.batch', payload: { picked: 3, joined: 2, refused: 1 } });
    await press(button(root, en.common.buttons.done));
    expect(navigation.navigate).toHaveBeenLastCalledWith('Main', { screen: 'Home' });
  });

  it('a never-synced learner is registered only under the one consent that names it', async () => {
    seed();
    const { api } = worker();
    setSyncApiForTests(api as never);
    const root = await reachChecklist();
    await press(row(root, JUN.id));
    await press(button(root, en.common.buttons.next));
    await enterPin();
    await throughNames(root, 2);
    // The one consent step names every picked learner.
    expect(screenTexts(root)).toEqual(expect.arrayContaining([who.consentTitle('Kim family'), who.consentLine('Mina'), who.consentLine('Jun'), who.consentSees]));
    expect(api.register).not.toHaveBeenCalled();
    // Not now: back to the checklist, nobody registered or joined.
    await press(button(root, who.notNow));
    expect(byTestId(root, 'join-who')).toHaveLength(1);
    expect(api.register).not.toHaveBeenCalled();
    expect(api.joinSpace).not.toHaveBeenCalled();
    // Again, and Yes, join: Jun is registered (a server learner and its secret), then joins.
    await press(button(root, en.common.buttons.next));
    await throughNames(root, 2);
    await press(button(root, who.consentYes));
    await settle();
    expect(api.register).toHaveBeenCalledTimes(1);
    expect(api.register.mock.calls[0]![0]).toMatchObject({ id: JUN.id });
    expect(api.joinSpace).toHaveBeenCalledTimes(2);
    expect(screenTexts(root)).toEqual(expect.arrayContaining([who.result(2, 2), who.joined('Mina'), who.joined('Jun')]));
  });

  it('the network drops after the first join: the lines so far and Try again; the retry is idempotent', async () => {
    seed();
    const { api } = worker({ dropJoinOf: JUN.id });
    setSyncApiForTests(api as never);
    const root = await reachChecklist();
    await press(row(root, JUN.id));
    await press(row(root, SORA.id));
    await press(button(root, en.common.buttons.next));
    await enterPin();
    await throughNames(root, 3);
    await press(button(root, who.consentYes));
    await settle();
    // Stopped at Jun: Sora was never sent.
    expect(api.joinSpace).toHaveBeenCalledTimes(2);
    expect(screenTexts(root)).toEqual(expect.arrayContaining([who.result(1, 3), who.joined('Mina'), en.caregiver.retry.offline]));
    expect(screenTexts(root)).not.toContain(who.joined('Jun'));
    expect(buttonsNamed(root, who.retry)).toHaveLength(1);
    expect(tracked.filter((e) => e.name === 'space.join.batch')).toHaveLength(0);
    await press(button(root, who.retry));
    await settle();
    // Jun's seat was taken before the answer was lost: "already a member" reads joined. Mina is not sent again.
    expect(api.joinSpace.mock.calls.map(([, body]) => (body as { learnerId: string }).learnerId)).toEqual([MINA.id, JUN.id, JUN.id, SORA.id]);
    expect(screenTexts(root)).toEqual(expect.arrayContaining([who.result(3, 3), who.joined('Mina'), who.joined('Jun'), who.joined('Sora')]));
    expect(screenTexts(root)).not.toContain(who.already('Jun'));
    expect(tracked.filter((e) => e.name === 'space.join.batch').map((e) => e.payload)).toEqual([{ picked: 3, joined: 3, refused: 0 }]);
  });

  it('joining only the active learner asks no PIN, as today; a member already reads already', async () => {
    seed();
    const { api } = worker({ members: [MINA.id] });
    setSyncApiForTests(api as never);
    const root = await reachChecklist();
    await press(button(root, en.common.buttons.next));
    expect(navigation.navigate).not.toHaveBeenCalledWith('PinEntry', expect.anything());
    await throughNames(root, 1);
    await press(button(root, who.consentYes));
    await settle();
    expect(screenTexts(root)).toEqual(expect.arrayContaining([who.result(1, 1), who.already('Mina')]));
  });

  it('a class-scoped learner is listed disabled and cannot be picked (section 10.6)', async () => {
    seed([MINA, JUN], []);
    const { api } = worker();
    setSyncApiForTests(api as never);
    useMembershipStore.setState({ deviceScope: vi.fn(async (id: string) => (id === JUN.id ? 'class' : 'full')) as never });
    const root = await reachChecklist();
    const jun = row(root, JUN.id);
    expect(jun.props['aria-disabled']).toBe(true);
    expect(screenTexts(root)).toContain(who.classOnly);
    await press(jun);
    expect(checked(row(root, JUN.id))).toBe(false);
  });

  it('offline: Next stays reachable, does nothing, and says it needs the internet', async () => {
    seed();
    setSyncApiForTests(worker().api as never);
    const root = await reachChecklist();
    await act(async () => {
      net.online = false;
    });
    // A re-render reads the hook again.
    await press(row(root, JUN.id));
    expect(screenTexts(root)).toContain(en.learner.welcome.grownUps.needsInternet);
    await press(button(root, en.common.buttons.next));
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(byTestId(root, 'join-confirm')).toHaveLength(0);
  });

  it('the flag off: the one-learner join of today', async () => {
    seed();
    flags.multiJoinEnabled = false;
    setSyncApiForTests(worker().api as never);
    const r = await render(<JoinSpaceScreen navigation={navigation as never} route={{ key: 'JoinSpace', name: 'JoinSpace', params: { code: 'FAM234' } } as never} />);
    await settle();
    await press(button(r.root, join.code.join.cta));
    await settle();
    expect(byTestId(r.root, 'join-who')).toHaveLength(0);
    expect(byTestId(r.root, 'join-confirm')).toHaveLength(1);
  });

  it('a class code keeps the one-learner flow (OQ-15)', async () => {
    seed();
    const { api } = worker();
    api.lookupSpace.mockResolvedValue({ status: 'ok', space: { id: 'space:c', kind: 'class', name: 'Sunflower' } as never, full: false, seat: null, roster: [] });
    setSyncApiForTests(api as never);
    const r = await render(<JoinSpaceScreen navigation={navigation as never} route={{ key: 'JoinSpace', name: 'JoinSpace', params: { code: 'ABC234' } } as never} />);
    await settle();
    await press(button(r.root, join.code.join.cta));
    await settle();
    expect(byTestId(r.root, 'join-who')).toHaveLength(0);
    expect(byTestId(r.root, 'join-confirm')).toHaveLength(1);
  });

  it('a family hand-off code on a shared device: the launch takes it and Join opens on the checklist at once (OA-D20)', async () => {
    seed();
    flags.whoChooserEnabled = true;
    const { api } = worker();
    setSyncApiForTests(api as never);
    handoff.code = 'FAM234';
    // The launch takes the code for Who is joining? instead of opening the chooser.
    expect(await chooserLaunchTrigger()).toBeNull();
    expect(batchHandoffPending()).toBe(true);
    const r = await render(<JoinSpaceScreen navigation={navigation as never} route={{ key: 'JoinSpace', name: 'JoinSpace' } as never} />);
    await settle();
    expect(batchHandoffPending()).toBe(false);
    expect(api.lookupSpace).toHaveBeenCalledTimes(1);
    expect(byTestId(r.root, 'join-who')).toHaveLength(1);
  });

  it('a launch hand-off code that turns out to be a class code is held, and the chooser asks who is joining', async () => {
    seed();
    flags.whoChooserEnabled = true;
    const { api } = worker();
    api.lookupSpace.mockResolvedValue({ status: 'ok', space: { id: 'space:c', kind: 'class', name: 'Sunflower' } as never, full: false, seat: null, roster: [] });
    setSyncApiForTests(api as never);
    handoff.code = 'ABC234';
    await chooserLaunchTrigger();
    const r = await render(<JoinSpaceScreen navigation={navigation as never} route={{ key: 'JoinSpace', name: 'JoinSpace' } as never} />);
    await settle();
    expect(navigation.navigate).toHaveBeenCalledWith('WhoIsUsing', { trigger: 'join' });
    expect(heldJoin()).toEqual({ code: 'ABC234' });
    expect(byTestId(r.root, 'join-confirm')).toHaveLength(0);
    expect(api.joinSpace).not.toHaveBeenCalled();
  });

  it('CS-11: a PIN older than 2 minutes at Yes, join is asked again before anyone joins', async () => {
    seed();
    const { api } = worker();
    setSyncApiForTests(api as never);
    const root = await reachChecklist();
    await press(row(root, JUN.id));
    await press(button(root, en.common.buttons.next));
    await enterPin();
    await throughNames(root, 2);
    await act(async () => {
      useUiStore.setState({ lastPinVerifiedAt: Date.now() - 3 * 60_000 });
    });
    navigation.navigate.mockClear();
    await press(button(root, who.consentYes));
    await settle();
    expect(navigation.navigate).toHaveBeenCalledWith('PinEntry', { next: 'JoinSpace' });
    expect(api.joinSpace).not.toHaveBeenCalled();
    await enterPin();
    expect(api.joinSpace).toHaveBeenCalledTimes(2);
    expect(screenTexts(root)).toContain(who.result(2, 2));
  });

  it('a code that stopped working stops the joins with its own line and Done, no Try again', async () => {
    seed();
    const { api } = worker();
    api.joinSpace.mockResolvedValue({ status: 'error', code: 'code_expired' } as never);
    setSyncApiForTests(api as never);
    const root = await reachChecklist();
    await press(button(root, en.common.buttons.next));
    await throughNames(root, 1);
    await press(button(root, who.consentYes));
    await settle();
    expect(screenTexts(root)).toEqual(expect.arrayContaining([who.result(0, 1), join.errors.codeExpired]));
    expect(buttonsNamed(root, who.retry)).toHaveLength(0);
    expect(buttonsNamed(root, en.common.buttons.done)).toHaveLength(1);
    expect(tracked.filter((e) => e.name === 'space.join.batch').map((e) => e.payload)).toEqual([{ picked: 1, joined: 0, refused: 0 }]);
  });

  it('Not this one on a name step goes back to the code', async () => {
    seed();
    setSyncApiForTests(worker().api as never);
    const root = await reachChecklist();
    await press(button(root, en.common.buttons.next));
    await press(button(root, join.confirm.notThis.cta));
    expect(byTestId(root, 'join-who')).toHaveLength(0);
    expect(byTestId(root, 'join-code')).toHaveLength(1);
  });

  it('leaving with Try again on screen still reports the batch once, counts only', async () => {
    seed();
    const { api } = worker({ dropJoinOf: MINA.id });
    setSyncApiForTests(api as never);
    const root = await reachChecklist();
    await press(button(root, en.common.buttons.next));
    await throughNames(root, 1);
    await press(button(root, who.consentYes));
    await settle();
    expect(buttonsNamed(root, who.retry)).toHaveLength(1);
    expect(tracked.filter((e) => e.name === 'space.join.batch')).toHaveLength(0);
    await cleanup();
    const sent = tracked.filter((e) => e.name === 'space.join.batch');
    expect(sent.map((e) => e.payload)).toEqual([{ picked: 1, joined: 0, refused: 0 }]);
    expect(sent[0]!.profileId).toBeUndefined();
  });
  it('CS-11 on Try again: a PIN that lapsed while the results stood is asked again before the rest join', async () => {
    seed();
    const { api } = worker({ dropJoinOf: JUN.id });
    setSyncApiForTests(api as never);
    const root = await reachChecklist();
    await press(row(root, JUN.id));
    await press(row(root, SORA.id));
    await press(button(root, en.common.buttons.next));
    await enterPin();
    await throughNames(root, 3);
    await press(button(root, who.consentYes));
    await settle();
    expect(buttonsNamed(root, who.retry)).toHaveLength(1);
    expect(api.joinSpace).toHaveBeenCalledTimes(2);
    // The grown-up walked away: the PIN is older than 2 minutes (or the session closed it).
    await act(async () => {
      useUiStore.setState({ lastPinVerifiedAt: Date.now() - 3 * 60_000 });
    });
    navigation.navigate.mockClear();
    await press(button(root, who.retry));
    await settle();
    expect(navigation.navigate).toHaveBeenCalledWith('PinEntry', { next: 'JoinSpace' });
    expect(api.joinSpace).toHaveBeenCalledTimes(2);
    await enterPin();
    expect(api.joinSpace.mock.calls.map(([, body]) => (body as { learnerId: string }).learnerId)).toEqual([MINA.id, JUN.id, JUN.id, SORA.id]);
    expect(screenTexts(root)).toContain(who.result(3, 3));
  });

  it('Try again for the active, unlocked learner alone asks no PIN, as today', async () => {
    seed();
    const { api } = worker({ dropJoinOf: MINA.id });
    setSyncApiForTests(api as never);
    const root = await reachChecklist();
    await press(button(root, en.common.buttons.next));
    await throughNames(root, 1);
    await press(button(root, who.consentYes));
    await settle();
    navigation.navigate.mockClear();
    await press(button(root, who.retry));
    await settle();
    expect(navigation.navigate).not.toHaveBeenCalledWith('PinEntry', expect.anything());
    expect(screenTexts(root)).toEqual(expect.arrayContaining([who.result(1, 1), who.joined('Mina')]));
  });

  it('a second tap on Yes, join sends nothing more; nothing is announced before a join answers', async () => {
    seed();
    const { api } = worker();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const real = api.joinSpace.getMockImplementation()!;
    api.joinSpace.mockImplementation(async (...args: Parameters<typeof real>) => {
      await gate;
      return real(...args);
    });
    setSyncApiForTests(api as never);
    const root = await reachChecklist();
    await press(row(root, JUN.id));
    await press(button(root, en.common.buttons.next));
    await enterPin();
    await throughNames(root, 2);
    // Two taps in the same frame, before the step re-renders.
    const yes = button(root, who.consentYes);
    const tap = (): void => {
      const currentTarget = { getAttribute: (name: string): unknown => yes.props[name] ?? null, tagName: String(yes.type) };
      (yes.props.onClick as (event: unknown) => void)({ altKey: false, currentTarget, nativeEvent: {}, preventDefault: () => undefined, stopPropagation: () => undefined });
    };
    await act(async () => {
      tap();
      tap();
    });
    await settle();
    // Running: the Joining button, and no result heading yet ("0 of 2 joined." would read like a failure).
    expect(byTestId(root, 'join-who-results')).toHaveLength(1);
    expect(screenTexts(root)).not.toContain(who.result(0, 2));
    await act(async () => release());
    await settle();
    expect(api.joinSpace.mock.calls.map(([, body]) => (body as { learnerId: string }).learnerId)).toEqual([MINA.id, JUN.id]);
    expect(screenTexts(root)).toContain(who.result(2, 2));
  });

  it('each name step shows whose step it is: the cub and the profile name', async () => {
    seed();
    setSyncApiForTests(worker().api as never);
    const root = await reachChecklist();
    await press(row(root, JUN.id));
    await press(button(root, en.common.buttons.next));
    await enterPin();
    const owner = (): string[] => screenTexts(byTestId(root, 'join-who-name-for')[0]!);
    expect(owner()).toContain('Mina');
    await press(button(root, join.confirm.me.cta));
    expect(owner()).toContain('Jun');
  });

  it('a learner scope that cannot be read fails closed: the row is disabled', async () => {
    seed([MINA, JUN], []);
    setSyncApiForTests(worker().api as never);
    useMembershipStore.setState({ deviceScope: vi.fn(async (id: string) => (id === JUN.id ? Promise.reject(new Error('read')) : 'full')) as never });
    const root = await reachChecklist();
    expect(row(root, JUN.id).props['aria-disabled']).toBe(true);
    expect(screenTexts(root)).toContain(who.classOnly);
  });

  it('the device check refuses one learner: its own line, and the others still join', async () => {
    seed();
    const { api } = worker();
    const real = api.joinSpace.getMockImplementation()!;
    api.joinSpace.mockImplementation(async (...args: Parameters<typeof real>) =>
      (args[1] as { learnerId: string }).learnerId === JUN.id ? ({ status: 'error', code: 'forbidden' } as never) : real(...args),
    );
    setSyncApiForTests(api as never);
    const root = await reachChecklist();
    await press(row(root, JUN.id));
    await press(row(root, SORA.id));
    await press(button(root, en.common.buttons.next));
    await enterPin();
    await throughNames(root, 3);
    await press(button(root, who.consentYes));
    await settle();
    expect(api.joinSpace).toHaveBeenCalledTimes(3);
    expect(screenTexts(root)).toEqual(expect.arrayContaining([who.result(2, 3), who.joined('Mina'), who.refused('Jun', en.caregiver.retry.unknown), who.joined('Sora')]));
    expect(buttonsNamed(root, who.retry)).toHaveLength(0);
    expect(buttonsNamed(root, en.common.buttons.done)).toHaveLength(1);
  });

  it('after a launch hand-off, leaving Join opens the chooser the launch deferred, never Home as whoever played last (OA-D20, CS-5)', async () => {
    seed();
    flags.whoChooserEnabled = true;
    const { api } = worker();
    setSyncApiForTests(api as never);
    handoff.code = 'FAM234';
    expect(await chooserLaunchTrigger()).toBeNull();
    const r = await render(<JoinSpaceScreen navigation={navigation as never} route={{ key: 'JoinSpace', name: 'JoinSpace' } as never} />);
    await settle();
    await press(button(r.root, en.common.buttons.next));
    await throughNames(r.root, 1);
    await press(button(r.root, who.consentYes));
    await settle();
    await press(button(r.root, en.common.buttons.done));
    // Done asks for Home; the navigator then removes Join, and the launch's chooser takes its place.
    expect(leave()).toBe(true);
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'WhoIsUsing', params: { trigger: 'launch' } }] });
    // Once: the reset itself leaves Join as asked.
    expect(leave()).toBe(false);
    expect(navigation.reset).toHaveBeenCalledTimes(1);
  });

  it('a Join opened any other way leaves as before (no chooser)', async () => {
    seed();
    flags.whoChooserEnabled = true;
    setSyncApiForTests(worker().api as never);
    await reachChecklist();
    expect(leave()).toBe(false);
    expect(navigation.reset).not.toHaveBeenCalled();
  });
});
