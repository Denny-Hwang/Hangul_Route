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
import { arriveAtChooser, closeGrownUpSession } from '../grown-up-session';
import { useProfileStore } from '../profile-store';
import { useUiStore } from '../ui-store';

const profile = (id: string): Profile =>
  ({ id, displayName: id, ageGroup: 'adult', avatar: 'tiger', role: 'learner', createdAt: '2026-01-01T00:00:00.000Z' }) as unknown as Profile;

beforeEach(() => {
  vi.mocked(endGrownUpTab).mockClear();
  useUiStore.setState({ parentGateOpenedAt: 1000, lastPinVerifiedAt: 2000 });
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
});
