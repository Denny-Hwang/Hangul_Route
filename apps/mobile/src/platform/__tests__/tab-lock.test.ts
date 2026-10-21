import { describe, expect, it } from 'vitest';
import { PIN_ATTEMPTS_LOCK, withTabLock } from '../tab-lock';

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D19: the PIN attempt state is read, changed and written under one
// Web Lock; without Web Locks the step runs at once and is told to merge instead.
describe('withTabLock', () => {
  it('names the PIN attempts lock', () => {
    expect(PIN_ATTEMPTS_LOCK).toBe('hr:pin-attempts');
  });

  it('runs the step inside the lock, told it is locked', async () => {
    const names: string[] = [];
    const locks = { request: async <T,>(name: string, cb: () => Promise<T>) => (names.push(name), cb()) };
    await expect(withTabLock('x', async (locked) => locked, locks)).resolves.toBe(true);
    expect(names).toEqual(['x']);
  });

  it('serialises two steps on a lock that queues', async () => {
    let chain: Promise<unknown> = Promise.resolve();
    const locks = {
      request: <T,>(_n: string, cb: () => Promise<T>) => {
        const run = chain.then(cb);
        chain = run.catch(() => undefined);
        return run;
      },
    };
    const order: string[] = [];
    const slow = withTabLock('x', async () => {
      await new Promise((r) => setTimeout(r, 5));
      order.push('first');
    }, locks);
    const fast = withTabLock('x', async () => {
      order.push('second');
    }, locks);
    await Promise.all([slow, fast]);
    expect(order).toEqual(['first', 'second']);
  });

  it('without Web Locks runs the step at once, told it is not locked', async () => {
    await expect(withTabLock('x', async (locked) => locked, null)).resolves.toBe(false);
    // The default reads navigator.locks, which Node does not have.
    await expect(withTabLock('x', async (locked) => locked)).resolves.toBe(false);
  });

  it('a lock that cannot be taken falls back; an error of the step itself is passed on', async () => {
    const refusing = { request: () => Promise.reject(new Error('refused')) };
    await expect(withTabLock('x', async (locked) => locked, refusing)).resolves.toBe(false);
    const ok = { request: <T,>(_n: string, cb: () => Promise<T>) => cb() };
    await expect(withTabLock('x', async () => { throw new Error('step'); }, ok)).rejects.toThrow('step');
  });

  it('a navigator whose locks getter throws counts as no locks', async () => {
    const nav = globalThis as { navigator?: unknown };
    const real = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, get: () => { throw new Error('blocked'); } });
    try {
      await expect(withTabLock('x', async (locked) => locked)).resolves.toBe(false);
    } finally {
      if (real) Object.defineProperty(globalThis, 'navigator', real);
      else delete nav.navigator;
    }
  });
});
