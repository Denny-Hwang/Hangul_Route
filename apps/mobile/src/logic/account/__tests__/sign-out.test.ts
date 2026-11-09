import { describe, expect, it, vi } from 'vitest';
import type { NativeGateState } from '../gate-state';
import type { TrustRead } from '../sign-in-records';
import { signOutOfAccount, type SignOutPorts } from '../sign-out';

/**
 * F-AUTH-004 section 6.6 (row NS-3; CS-N4, CS-N7, R-2): Sign out and the lock's Sign in again, in order, offline
 * included: Clerk first, then every Clerk item, the records, the account queries, the visit's memory, the event.
 */

function ports(over: Partial<SignOutPorts> = {}, gate: NativeGateState = { state: 'pin', epoch: 7 }, trust: TrustRead = { kind: 'trust', trust: { v: 1, epoch: 7 } }): SignOutPorts & { log: string[] } {
  const log: string[] = [];
  return {
    log,
    endSession: over.endSession ?? vi.fn(async () => (log.push('endSession'), true)),
    wipeTokens: over.wipeTokens ?? vi.fn(async () => (log.push('wipeTokens'), true)),
    gate: over.gate ?? vi.fn(async () => gate),
    readTrust: over.readTrust ?? vi.fn(async () => trust),
    removeRecord: over.removeRecord ?? vi.fn(async (key: string) => void log.push(`remove ${key}`)),
    clearQueries: over.clearQueries ?? vi.fn(async () => void log.push('clearQueries')),
    forgetVisit: over.forgetVisit ?? vi.fn(() => void log.push('forgetVisit')),
    track: over.track ?? vi.fn((via: 'user' | 'lock') => void log.push(`track ${via}`)),
  };
}

describe('section 6.6: Sign out', () => {
  it('Clerk first, then the items, the records, the queries, the memory, the event', async () => {
    const p = ports();
    expect(await signOutOfAccount(p, 'user')).toBe(true);
    expect(p.log).toEqual([
      'endSession',
      'wipeTokens',
      'remove grownup:deviceUses',
      'remove grownup:trust',
      'remove grownup:retrustNotice',
      'clearQueries',
      'forgetVisit',
      'track user',
    ]);
  });

  it('Sign in again on the lock keeps a trust of another epoch (the re-trust rule still holds)', async () => {
    const p = ports({}, undefined, { kind: 'trust', trust: { v: 1, epoch: 3 } });
    await signOutOfAccount(p, 'lock');
    expect(p.log).toEqual(['endSession', 'wipeTokens', 'remove grownup:deviceUses', 'remove grownup:retrustNotice', 'clearQueries', 'forgetVisit', 'track lock']);
  });

  it('row NS-7 (security review): Sign out keeps a trust of another epoch too (it asks no PIN), so an email code alone never re-trusts after it', async () => {
    const p = ports({}, undefined, { kind: 'trust', trust: { v: 1, epoch: 3 } });
    await signOutOfAccount(p, 'user');
    expect(p.log).toEqual(['endSession', 'wipeTokens', 'remove grownup:deviceUses', 'remove grownup:retrustNotice', 'clearQueries', 'forgetVisit', 'track user']);
  });

  it('offline: Clerk cannot be reached, the local items still go at once (R-2)', async () => {
    const p = ports({ endSession: vi.fn(async () => Promise.reject(new Error('network_error'))) });
    expect(await signOutOfAccount(p, 'user')).toBe(true);
    expect(p.log).toContain('wipeTokens');
    expect(p.log).toContain('remove grownup:trust');
    expect(p.log).toContain('track user');
  });

  it('a delete that fails is reported, and nothing stops the rest', async () => {
    const p = ports({
      wipeTokens: vi.fn(async () => Promise.reject(new Error('keychain'))),
      removeRecord: vi.fn(async (key: string) => {
        if (key === 'grownup:trust') throw new Error('storage');
      }),
      clearQueries: vi.fn(async () => Promise.reject(new Error('q'))),
      forgetVisit: vi.fn(() => {
        throw new Error('m');
      }),
      track: vi.fn(() => {
        throw new Error('t');
      }),
    });
    expect(await signOutOfAccount(p, 'user')).toBe(false);
    expect(p.removeRecord).toHaveBeenCalledTimes(3);
    expect(p.track).toHaveBeenCalledWith('user');
  });

  it('a wipe that answers false is reported', async () => {
    expect(await signOutOfAccount(ports({ wipeTokens: vi.fn(async () => false) }), 'user')).toBe(false);
  });

  it('a gate or trust read that fails: both paths keep the trust (deleting it could only weaken the re-trust rule)', async () => {
    const failing = { gate: vi.fn(async () => Promise.reject(new Error('g'))), readTrust: vi.fn(async () => Promise.reject(new Error('t'))) };
    const user = ports(failing);
    await signOutOfAccount(user, 'user');
    expect(user.log).not.toContain('remove grownup:trust');
    const lock = ports(failing);
    await signOutOfAccount(lock, 'lock');
    expect(lock.log).not.toContain('remove grownup:trust');
  });
});
