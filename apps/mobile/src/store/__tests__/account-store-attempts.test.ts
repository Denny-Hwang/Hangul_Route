import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-2 (sections 8.3 and 8.5, OA-D19, OA-D21; CS-8, CS-16): the shared
 * PIN attempt state, the Rescue Code's own counter and the reset-by-wait record. Storage is an in-memory map here,
 * shared by "two tabs" (two reads of the same map), and Web Locks are a fake `navigator.locks`.
 */
const disk = new Map<string, unknown>();
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => (disk.has(key) ? structuredClone(disk.get(key)) : null)),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async (key: string) => (disk.has(key) ? structuredClone(disk.get(key)) : null)),
  writeJson: vi.fn(async (key: string, value: unknown) => {
    disk.set(key, structuredClone(value));
  }),
}));

import { INITIAL_ATTEMPT_STATE, MAX_ATTEMPTS, type AttemptState, type PinHasher } from '../../logic/profiles/pin-hash';
import { writeJson } from '../../platform/storage';
import { useAccountStore } from '../account-store';

const hasher: PinHasher = { hash: async (pin) => `h:${pin}`, verify: async (pin, stored) => stored === `h:${pin}` };
const T0 = 1_800_000_000_000;
const CODE = 'TIGER-MOON-RIVER-APPLE-482139';

interface FakeLocks {
  request: <T>(name: string, cb: () => Promise<T>) => Promise<T>;
  names: string[];
}

function fakeLocks(): FakeLocks {
  let chain: Promise<unknown> = Promise.resolve();
  const names: string[] = [];
  return {
    names,
    request: <T>(name: string, cb: () => Promise<T>): Promise<T> => {
      names.push(name);
      const run = chain.then(cb);
      chain = run.catch(() => undefined);
      return run;
    },
  };
}

const nav = globalThis as { navigator?: unknown };
const realNavigator = nav.navigator;

function reset(pinAttempts: AttemptState = INITIAL_ATTEMPT_STATE): void {
  disk.clear();
  useAccountStore.setState({ parentPinHash: 'h:1234', pinAttempts, rescueAttempts: INITIAL_ATTEMPT_STATE, pinResetByWait: null });
}

function setLocks(locks: FakeLocks | null): void {
  Object.defineProperty(globalThis, 'navigator', { value: locks === null ? realNavigator : { locks }, configurable: true, writable: true });
}

beforeEach(() => {
  reset();
  setLocks(null);
});

describe('verifyPinAttempt: one count for every tab (OA-D19)', () => {
  it('runs inside the hr:pin-attempts lock and stores the result', async () => {
    const locks = fakeLocks();
    setLocks(locks);
    const result = await useAccountStore.getState().verifyPinAttempt('9999', { hasher, schedule: 'steps', now: () => T0 });
    expect(locks.names).toEqual(['hr:pin-attempts']);
    expect(result.reason).toBe('wrong-pin');
    expect(disk.get('account:pinAttempts')).toEqual({ failures: [T0], lockedUntil: null, strikes: 0, lastMissAt: T0 });
    expect(useAccountStore.getState().pinAttempts).toEqual(disk.get('account:pinAttempts'));
  });

  it('5 misses spread over 2 tabs pause both (Web Locks: the stored state is the truth)', async () => {
    const locks = fakeLocks();
    setLocks(locks);
    const tabA = useAccountStore.getState();
    // Tab A misses 3 times; tab B (a stale in-memory copy) misses twice.
    for (let i = 0; i < 3; i += 1) await tabA.verifyPinAttempt('9999', { hasher, schedule: 'steps', now: () => T0 + i });
    useAccountStore.setState({ pinAttempts: INITIAL_ATTEMPT_STATE });
    await useAccountStore.getState().verifyPinAttempt('9999', { hasher, schedule: 'steps', now: () => T0 + 10 });
    const fifth = await useAccountStore.getState().verifyPinAttempt('9999', { hasher, schedule: 'steps', now: () => T0 + 11 });
    expect(fifth.paused).toEqual({ step: 1, ms: 30_000 });
    // Tab A's next try, even with the right PIN, meets the pause.
    useAccountStore.setState({ pinAttempts: INITIAL_ATTEMPT_STATE });
    const a = await useAccountStore.getState().verifyPinAttempt('1234', { hasher, schedule: 'steps', now: () => T0 + 12 });
    expect(a.reason).toBe('cooldown');
  });

  it('without Web Locks it re-reads and merges, so neither copy loses a miss or a pause', async () => {
    // Storage holds a pause another tab started; this tab's copy has no idea.
    disk.set('account:pinAttempts', { failures: [], lockedUntil: T0 + 30_000, strikes: 1, lastMissAt: T0 });
    const r = await useAccountStore.getState().verifyPinAttempt('1234', { hasher, schedule: 'steps', now: () => T0 + 5 });
    expect(r.reason).toBe('cooldown');
    // This tab's copy holds misses storage lacks (an older write won): the merge keeps them.
    disk.set('account:pinAttempts', { failures: [T0], lockedUntil: null });
    useAccountStore.setState({ pinAttempts: { failures: [T0 + 1, T0 + 2, T0 + 3], lockedUntil: null, strikes: 2, lastMissAt: T0 + 3 } });
    const miss = await useAccountStore.getState().verifyPinAttempt('9999', { hasher, schedule: 'steps', now: () => T0 + 4 });
    expect(miss.paused).toEqual({ step: 3, ms: 300_000 });
  });

  it('a lock request that throws falls back to the merge path', async () => {
    setLocks({ names: [], request: () => Promise.reject(new Error('no locks')) });
    const r = await useAccountStore.getState().verifyPinAttempt('1234', { hasher, schedule: 'flat', now: () => T0 });
    expect(r.ok).toBe(true);
  });

  it('a pause survives a restart: hydrate reads it back, legacy state included', async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) await useAccountStore.getState().verifyPinAttempt('9999', { hasher, schedule: 'steps', now: () => T0 + i });
    useAccountStore.setState({ pinAttempts: INITIAL_ATTEMPT_STATE });
    const clock = vi.spyOn(Date, 'now').mockReturnValue(T0 + 5);
    try {
      await useAccountStore.getState().hydrate();
      expect(useAccountStore.getState().pinAttempts).toEqual({ failures: [], lockedUntil: T0 + 4 + 30_000, strikes: 1, lastMissAt: T0 + 4 });
      disk.set('account:pinAttempts', { failures: [], lockedUntil: 5000 });
      await useAccountStore.getState().hydrate();
      expect(useAccountStore.getState().pinAttempts).toEqual({ failures: [], lockedUntil: 5000, strikes: 0 });
    } finally {
      clock.mockRestore();
    }
  });

  it('[OA] a stored pause far in the future (a clock set back, a damaged record) is cut to the longest step at every read', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(T0);
    try {
      disk.set('account:pinAttempts', { failures: [], lockedUntil: T0 + 365 * 24 * 3_600_000, strikes: 5, lastMissAt: T0 });
      disk.set('account:rescueAttempts', { failures: [], lockedUntil: T0 + 365 * 24 * 3_600_000, strikes: 0 });
      await useAccountStore.getState().hydrate();
      expect(useAccountStore.getState().pinAttempts.lockedUntil).toBe(T0 + 60 * 60_000);
      expect(useAccountStore.getState().rescueAttempts.lockedUntil).toBe(T0 + 15 * 60_000);
      await useAccountStore.getState().refreshAttempts(() => T0 + 1000);
      expect(useAccountStore.getState().pinAttempts.lockedUntil).toBe(T0 + 1000 + 60 * 60_000);
    } finally {
      clock.mockRestore();
    }
  });

  it('[OA] the PIN is checked against the stored hash under the lock: another tab\'s new PIN wins over the one in memory', async () => {
    useAccountStore.setState({ parentPinHash: 'h:1234' });
    disk.set('account:parentPinHash', 'h:5678');
    const old = await useAccountStore.getState().verifyPinAttempt('1234', { hasher, schedule: 'steps', now: () => T0 });
    expect(old.ok).toBe(false);
    expect(useAccountStore.getState().parentPinHash).toBe('h:5678');
    const fresh = await useAccountStore.getState().verifyPinAttempt('5678', { hasher, schedule: 'steps', now: () => T0 + 1 });
    expect(fresh.ok).toBe(true);
    // No readable hash stored (this tab's own write still on its way): the one in memory stands.
    disk.delete('account:parentPinHash');
    useAccountStore.setState({ parentPinHash: 'h:2468' });
    expect((await useAccountStore.getState().verifyPinAttempt('2468', { hasher, schedule: 'steps', now: () => T0 + 2 })).ok).toBe(true);
  });

  it('refreshAttempts without Web Locks shows a pause another tab started, and never shortens one shown here', async () => {
    disk.set('account:pinAttempts', { failures: [], lockedUntil: T0 + 60_000, strikes: 2, lastMissAt: T0 });
    await useAccountStore.getState().refreshAttempts(() => T0);
    expect(useAccountStore.getState().pinAttempts.lockedUntil).toBe(T0 + 60_000);
    disk.set('account:pinAttempts', INITIAL_ATTEMPT_STATE);
    await useAccountStore.getState().refreshAttempts(() => T0);
    expect(useAccountStore.getState().pinAttempts.lockedUntil).toBe(T0 + 60_000);
  });

  it('refreshAttempts under Web Locks reads inside the lock and takes the stored state: another tab cleared the pause', async () => {
    const locks = fakeLocks();
    setLocks(locks);
    reset({ failures: [], lockedUntil: T0 + 60_000, strikes: 2, lastMissAt: T0 });
    disk.set('account:pinAttempts', INITIAL_ATTEMPT_STATE);
    await useAccountStore.getState().refreshAttempts(() => T0 + 1);
    expect(locks.names).toEqual(['hr:pin-attempts']);
    expect(useAccountStore.getState().pinAttempts).toEqual(INITIAL_ATTEMPT_STATE);
  });

  it('under Web Locks a state an older bundle wrote (no strikes) keeps its misses and pause, and this tab keeps its step', async () => {
    setLocks(fakeLocks());
    reset({ failures: [], lockedUntil: null, strikes: 3, lastMissAt: T0 });
    disk.set('account:pinAttempts', { failures: [T0 + 1, T0 + 2, T0 + 3, T0 + 4], lockedUntil: null });
    const miss = await useAccountStore.getState().verifyPinAttempt('9999', { hasher, schedule: 'steps', now: () => T0 + 5 });
    // The 5th miss of the round, at the 4th step (15 minutes), not back at 30 seconds.
    expect(miss.paused).toEqual({ step: 4, ms: 900_000 });
    // An older bundle's state with no step of ours to keep is taken as it is.
    reset();
    disk.set('account:pinAttempts', { failures: [], lockedUntil: T0 + 30_000 });
    await useAccountStore.getState().refreshAttempts(() => T0);
    expect(useAccountStore.getState().pinAttempts).toEqual({ failures: [], lockedUntil: T0 + 30_000, strikes: 0 });
  });

  it('under Web Locks with nothing readable stored, this tab keeps its own count', async () => {
    setLocks(fakeLocks());
    reset({ failures: [T0, T0 + 1], lockedUntil: null, strikes: 0, lastMissAt: T0 + 1 });
    await useAccountStore.getState().refreshAttempts(() => T0 + 2);
    expect(useAccountStore.getState().pinAttempts.failures).toEqual([T0, T0 + 1]);
  });

  it('a storage that refuses the write never stops a correct PIN, and a wrong one still counts in memory', async () => {
    setLocks(fakeLocks());
    vi.mocked(writeJson).mockRejectedValueOnce(new Error('QuotaExceededError'));
    const ok = await useAccountStore.getState().verifyPinAttempt('1234', { hasher, schedule: 'steps', now: () => T0 });
    expect(ok.ok).toBe(true);
    // The misses add up in memory while every write fails, and the 5th still pauses.
    vi.mocked(writeJson).mockRejectedValue(new Error('QuotaExceededError'));
    try {
      let last = null as Awaited<ReturnType<ReturnType<typeof useAccountStore.getState>['verifyPinAttempt']>> | null;
      for (let i = 0; i < MAX_ATTEMPTS; i += 1) last = await useAccountStore.getState().verifyPinAttempt('9999', { hasher, schedule: 'steps', now: () => T0 + 1 + i });
      expect(last?.paused).toEqual({ step: 1, ms: 30_000 });
      expect(useAccountStore.getState().pinAttempts.lockedUntil).toBe(T0 + MAX_ATTEMPTS + 30_000);
      const rescue = await useAccountStore.getState().attemptRescue('TIGER-MOON-RIVER-APPLE-000000', [CODE], () => T0);
      expect(rescue.ok).toBe(false);
      expect(useAccountStore.getState().rescueAttempts.failures).toEqual([T0]);
    } finally {
      vi.mocked(writeJson).mockReset();
      vi.mocked(writeJson).mockImplementation(async (key: string, value: unknown) => {
        disk.set(key, structuredClone(value));
      });
    }
    // Once a write lands again, the stored state is trusted again.
    await useAccountStore.getState().verifyPinAttempt('1234', { hasher, schedule: 'steps', now: () => T0 + 60_000 });
    expect(disk.get('account:pinAttempts')).toEqual(INITIAL_ATTEMPT_STATE);
  });

  it('a new PIN writes the cleared attempt state inside the lock', async () => {
    const locks = fakeLocks();
    setLocks(locks);
    useAccountStore.getState().setParentPinHash('h:5678');
    await new Promise((r) => setTimeout(r, 0));
    expect(locks.names).toContain('hr:pin-attempts');
    expect(disk.get('account:pinAttempts')).toEqual(INITIAL_ATTEMPT_STATE);
    expect(useAccountStore.getState().pinAttempts.strikes).toBe(0);
  });
});

describe('attemptRescue: the Rescue Code has its own counter (section 8.3, CS-8)', () => {
  it('is accepted during a PIN pause', async () => {
    const pinPause: AttemptState = { failures: [], lockedUntil: T0 + 3_600_000, strikes: 5, lastMissAt: T0 };
    reset(pinPause);
    disk.set('account:pinAttempts', pinPause);
    const r = await useAccountStore.getState().attemptRescue(CODE, [CODE], () => T0 + 1);
    expect(r.ok).toBe(true);
    expect(useAccountStore.getState().pinAttempts).toEqual(pinPause);
  });

  it('counts wrong codes in account:rescueAttempts, never in account:pinAttempts, inside the lock', async () => {
    const locks = fakeLocks();
    setLocks(locks);
    const r = await useAccountStore.getState().attemptRescue('TIGER-MOON-RIVER-APPLE-000000', [CODE], () => T0);
    expect(r.ok).toBe(false);
    expect(locks.names).toEqual(['hr:pin-attempts']);
    expect(disk.get('account:rescueAttempts')).toEqual({ failures: [T0], lockedUntil: null, strikes: 0, lastMissAt: T0 });
    expect(disk.has('account:pinAttempts')).toBe(false);
    expect(useAccountStore.getState().rescueAttempts.failures).toEqual([T0]);
  });

  it('hydrate reads the rescue state back', async () => {
    disk.set('account:rescueAttempts', { failures: [], lockedUntil: T0 + 900_000 });
    const clock = vi.spyOn(Date, 'now').mockReturnValue(T0);
    try {
      await useAccountStore.getState().hydrate();
    } finally {
      clock.mockRestore();
    }
    expect(useAccountStore.getState().rescueAttempts.lockedUntil).toBe(T0 + 900_000);
  });
});

describe('pinResetByWait (OA-D21)', () => {
  it('is written by the finished wait, read back once, and cleared', async () => {
    useAccountStore.getState().markPinResetByWait(T0);
    expect(useAccountStore.getState().pinResetByWait).toEqual({ v: 1, at: T0 });
    expect(disk.get('account:pinResetByWait')).toEqual({ v: 1, at: T0 });
    useAccountStore.setState({ pinResetByWait: null });
    await useAccountStore.getState().hydrate();
    expect(useAccountStore.getState().pinResetByWait).toEqual({ v: 1, at: T0 });
    useAccountStore.getState().clearPinResetByWait();
    expect(useAccountStore.getState().pinResetByWait).toBeNull();
    expect(disk.get('account:pinResetByWait')).toBeNull();
  });

  it('a damaged record reads as none', async () => {
    for (const junk of [{ v: 2, at: T0 }, { v: 1, at: 'x' }, 'x', 7]) {
      disk.set('account:pinResetByWait', junk);
      await useAccountStore.getState().hydrate();
      expect(useAccountStore.getState().pinResetByWait).toBeNull();
    }
  });
});
