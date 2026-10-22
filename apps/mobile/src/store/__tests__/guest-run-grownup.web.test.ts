import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 5.3, CS-G3 (row GU-2, section 19), on the web: `startGuestRun` for every
 * `via` and for a reopen, with a grown-up session open, goes through the real `grown-up-tab.web.ts`: this tab's
 * unlock, console session and All lessons pass leave `sessionStorage`, and `{ v: 1, kind: 'lock' }` is posted on
 * `hr-grownup`, so a console tab on this browser locks before the first quest step renders.
 */
const disk = vi.hoisted(() => new Map<string, string>());
const parse = (key: string): unknown => (disk.has(key) ? JSON.parse(disk.get(key)!) : null);
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => parse(key)),
  readJsonStrict: vi.fn(async (key: string) => parse(key)),
  readJsonExact: vi.fn(async (key: string) => parse(key)),
  writeJson: vi.fn(async (key: string, value: unknown) => void disk.set(key, JSON.stringify(value))),
  removeKey: vi.fn(async (key: string) => void disk.delete(key)),
  listKeys: vi.fn(async () => [...disk.keys()]),
}));
vi.mock('../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
// The learner app's web build resolves `platform/grown-up-tab` to its `.web.ts` file.
vi.mock('../../platform/grown-up-tab', async () => await import('../../platform/grown-up-tab.web'));

/** A BroadcastChannel double: every post, with the channel name it went on. */
const posted = vi.hoisted(() => [] as { channel: string; message: unknown }[]);
class FakeChannel {
  constructor(private readonly name: string) {}
  postMessage(message: unknown): void {
    posted.push({ channel: this.name, message });
  }
}
const session = new Map<string, string>();
const sessionStorageDouble = {
  getItem: (key: string) => session.get(key) ?? null,
  setItem: (key: string, value: string) => void session.set(key, value),
  removeItem: (key: string) => void session.delete(key),
};
vi.stubGlobal('BroadcastChannel', FakeChannel);
vi.stubGlobal('sessionStorage', sessionStorageDouble);

import { BROWSE_PASS_SESSION_KEY, CONSOLE_SESSION_KEY, GROWN_UP_LOCK_CHANNEL, UNLOCK_SESSION_KEY, type GuestRecord } from '@hangul-route/content-schema';
import { useGuestStore } from '../guest-store';
import { useProfileStore } from '../profile-store';
import { useUiStore } from '../ui-store';

const T0 = Date.parse('2026-10-22T10:00:00.000Z');
const LIVE: GuestRecord = { v: 1, id: 'profile:guest001', startedAt: new Date(T0).toISOString(), lastAt: new Date(T0).toISOString(), via: 'site', questDone: false };

beforeEach(() => {
  disk.clear();
  posted.length = 0;
  for (const key of [UNLOCK_SESSION_KEY, CONSOLE_SESSION_KEY, BROWSE_PASS_SESSION_KEY, 'other']) session.set(key, 'x');
  useGuestStore.setState({ record: null, running: false, hydrated: true, memoryOnly: false });
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
  useUiStore.setState({ parentGateOpenedAt: T0, lastPinVerifiedAt: T0 });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('[GU] startGuestRun on the web locks every grown-up tab first (CS-G3)', () => {
  it.each(['site', 'chooser', 'welcome', 'reopen'] as const)('via %s: the session times are cleared, this tab\'s grown-up keys go and the lock is posted on hr-grownup', async (via) => {
    if (via === 'reopen') disk.set('guest', JSON.stringify(LIVE));
    const started = await useGuestStore.getState().startGuestRun(via, T0 + 60_000);
    expect(started).not.toBeNull();
    expect(useUiStore.getState()).toMatchObject({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
    expect(posted).toEqual([{ channel: GROWN_UP_LOCK_CHANNEL, message: { v: 1, kind: 'lock' } }]);
    expect(session.has(UNLOCK_SESSION_KEY)).toBe(false);
    expect(session.has(CONSOLE_SESSION_KEY)).toBe(false);
    expect(session.has(BROWSE_PASS_SESSION_KEY)).toBe(false);
    // Nothing else in this tab's sessionStorage is touched.
    expect(session.get('other')).toBe('x');
  });
});
