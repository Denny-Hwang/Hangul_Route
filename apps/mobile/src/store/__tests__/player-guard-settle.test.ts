import { describe, expect, it, vi } from 'vitest';

// The stores are injected through `deps`; the defaults are never read here.
vi.mock('../membership-store', () => ({ useMembershipStore: { getState: () => ({ hydrate: async () => [] }) } }));
vi.mock('../tier-store', () => ({ questOpenFor: () => () => true, useTierStore: { getState: () => ({ hydrate: async () => null }) } }));
import { settledPlayerGuard, type SettleDeps } from '../player-guard-settle';

const input = { learnerId: 'kid-1', questId: 'stage2-life-q1', episodeId: 'stage2-life' };

describe('settledPlayerGuard (F-ENT-003 section 3.6)', () => {
  it('a premium learner read as free before hydrate is never redirected once the stores are read', async () => {
    let premium = false;
    const deps: SettleDeps = {
      hydrate: async () => {
        premium = true;
      },
      openFor: () => () => premium,
      timeoutMs: 1000,
    };
    await expect(settledPlayerGuard(input, deps)).resolves.toBeNull();
  });

  it('a free learner still lands on the preview after the read', async () => {
    const deps: SettleDeps = { hydrate: async () => undefined, openFor: () => () => false, timeoutMs: 1000 };
    await expect(settledPlayerGuard(input, deps)).resolves.toEqual({ episodeId: 'stage2-life', from: 'player' });
  });

  it('a read that never settles gives way to the timeout and the answer the stores hold then', async () => {
    const deps: SettleDeps = { hydrate: () => new Promise(() => undefined), openFor: () => () => false, timeoutMs: 5 };
    await expect(settledPlayerGuard(input, deps)).resolves.toEqual({ episodeId: 'stage2-life', from: 'player' });
  });

  it('a failed read re-checks at once', async () => {
    const deps: SettleDeps = { hydrate: () => Promise.reject(new Error('io')), openFor: () => () => true, timeoutMs: 1000 };
    await expect(settledPlayerGuard(input, deps)).resolves.toBeNull();
  });

  it('no active learner skips the read', async () => {
    let read = false;
    const deps: SettleDeps = {
      hydrate: async () => {
        read = true;
      },
      openFor: () => () => false,
      timeoutMs: 1000,
    };
    await settledPlayerGuard({ ...input, learnerId: null }, deps);
    expect(read).toBe(false);
  });
});
