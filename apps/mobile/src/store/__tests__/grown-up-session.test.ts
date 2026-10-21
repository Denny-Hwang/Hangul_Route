import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
}));
vi.mock('../../platform/grown-up-tab', () => ({ endGrownUpTab: vi.fn() }));

import type { Profile } from '@hangul-route/content-schema';
import { endGrownUpTab } from '../../platform/grown-up-tab';
import { arriveAtChooser, closeGrownUpSession, onGrownUpSessionClosed } from '../grown-up-session';
import { useProfileStore } from '../profile-store';
import { useUiStore } from '../ui-store';

const profile = (id: string): Profile =>
  ({ id, displayName: id, ageGroup: 'adult', avatar: 'tiger', role: 'learner', createdAt: '2026-01-01T00:00:00.000Z' }) as unknown as Profile;

beforeEach(() => {
  vi.mocked(endGrownUpTab).mockClear();
  useUiStore.setState({ parentGateOpenedAt: 1000, lastPinVerifiedAt: 2000, gateReturnPending: false });
  useProfileStore.setState({ profiles: [profile('aaaa1111'), profile('bbbb2222')], activeId: 'aaaa1111', hydrated: true, activeSince: 0 });
});

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D5b (1), CS-15: one function ends the grown-up session, and every
// change of learner calls it, from any surface.
describe('closeGrownUpSession', () => {
  it('clears the gate session and the fresh-PIN time, and ends the tab (web: clear and lock post)', () => {
    closeGrownUpSession();
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    expect(endGrownUpTab).toHaveBeenCalledTimes(1);
  });

  it('drops a pending PIN-screen return and tells every listener, even after one that throws', () => {
    useUiStore.setState({ gateReturnPending: true });
    const heard = vi.fn();
    const offBad = onGrownUpSessionClosed(() => {
      throw new Error('boom');
    });
    const off = onGrownUpSessionClosed(heard);
    closeGrownUpSession();
    expect(useUiStore.getState().gateReturnPending).toBe(false);
    expect(heard).toHaveBeenCalledTimes(1);
    off();
    offBad();
    closeGrownUpSession();
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe('every other change of the active learner closes the grown-up session too (OA-D5b (1))', () => {
  it('a new learner made active (Add a learner) closes it', () => {
    const before = Date.now();
    const created = useProfileStore.getState().createProfile({ displayName: 'Joon', ageGroup: '10-11', avatar: 'hoya-blue' });
    expect(useProfileStore.getState().activeId).toBe(created.id);
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    expect(useProfileStore.getState().activeSince).toBeGreaterThanOrEqual(before);
  });

  it('removing the active learner closes it; removing another learner does not', () => {
    useProfileStore.getState().remove('bbbb2222');
    expect(useUiStore.getState().parentGateOpenedAt).toBe(1000);
    expect(endGrownUpTab).not.toHaveBeenCalled();
    useProfileStore.getState().remove('aaaa1111');
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(endGrownUpTab).toHaveBeenCalledTimes(1);
  });

  it('adopting a restored learner onto a device with no active learner closes it; with one active it does not', () => {
    useProfileStore.getState().adoptProfile(profile('cccc3333'));
    expect(useUiStore.getState().parentGateOpenedAt).toBe(1000);
    useProfileStore.setState({ profiles: [], activeId: null });
    useProfileStore.getState().adoptProfile(profile('dddd4444'));
    expect(useProfileStore.getState().activeId).toBe('dddd4444');
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
  });
});

describe('[OA] closeGrownUpSession tells why and whether a session was open (OA-2 review round 2)', () => {
  it('passes the reason (exit by default) and wasOpen read before the clear', () => {
    const heard = vi.fn();
    const off = onGrownUpSessionClosed(heard);
    closeGrownUpSession('background');
    closeGrownUpSession();
    useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: 5 });
    closeGrownUpSession('switch');
    expect(heard.mock.calls).toEqual([[{ reason: 'background', wasOpen: true }], [{ reason: 'exit', wasOpen: false }], [{ reason: 'switch', wasOpen: true }]]);
    off();
  });

  it('a change of learner closes with the reason switch', () => {
    const heard = vi.fn();
    const off = onGrownUpSessionClosed(heard);
    useProfileStore.getState().setActive('bbbb2222');
    expect(heard).toHaveBeenCalledWith({ reason: 'switch', wasOpen: true });
    off();
  });
});

describe('profile-store.setActive closes the grown-up session on a change', () => {
  it('closes on a different learner and restarts the session clock', () => {
    const before = Date.now();
    useProfileStore.getState().setActive('bbbb2222');
    expect(useProfileStore.getState().activeId).toBe('bbbb2222');
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    expect(endGrownUpTab).toHaveBeenCalledTimes(1);
    expect(useProfileStore.getState().activeSince).toBeGreaterThanOrEqual(before);
  });

  it('keeps the session when the same learner is picked, or the id is unknown', () => {
    useProfileStore.getState().setActive('aaaa1111');
    useProfileStore.getState().setActive('nope');
    expect(useUiStore.getState().parentGateOpenedAt).toBe(1000);
    expect(endGrownUpTab).not.toHaveBeenCalled();
    expect(useProfileStore.getState().activeSince).toBe(0);
  });
});

// [OA] Row OA-4a, CS-2: arriving at "Who is using this?" closes the session whatever it was.
describe('arriveAtChooser', () => {
  it('clears both times, the tab unlock, and posts the lock', () => {
    arriveAtChooser();
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    expect(endGrownUpTab).toHaveBeenCalledTimes(1);
  });

  it('with nothing open it still clears the tab and tells the other tabs', () => {
    useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
    arriveAtChooser();
    expect(endGrownUpTab).toHaveBeenCalledTimes(1);
  });

  it('is closeGrownUpSession: a pending PIN-screen return goes and the listeners hear it (OA-4a review)', () => {
    useUiStore.setState({ gateReturnPending: true });
    const heard = vi.fn();
    const off = onGrownUpSessionClosed(heard);
    arriveAtChooser();
    off();
    expect(useUiStore.getState().gateReturnPending).toBe(false);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('a tab leaving for another page (a hand-off from a PIN screen over the chooser) keeps what it handed off (CS-5)', () => {
    useUiStore.setState({ gateReturnPending: true });
    arriveAtChooser(() => true);
    expect(useUiStore.getState()).toMatchObject({ parentGateOpenedAt: 1000, lastPinVerifiedAt: 2000, gateReturnPending: true });
    expect(endGrownUpTab).not.toHaveBeenCalled();
  });
});
