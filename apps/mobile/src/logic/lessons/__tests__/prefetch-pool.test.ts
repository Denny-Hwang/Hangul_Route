import { describe, expect, it } from 'vitest';
import { PREFETCH_CONCURRENCY, runPool } from '../prefetch-pool';

/** A task that stays pending until `release(name)`; records starts and the most in flight at once. */
function rig() {
  const started: string[] = [];
  const waiting = new Map<string, { resolve: () => void; reject: (e: Error) => void }>();
  let inFlight = 0;
  let most = 0;
  const task = (name: string) => (): Promise<void> => {
    started.push(name);
    inFlight += 1;
    most = Math.max(most, inFlight);
    return new Promise<void>((resolve, reject) => {
      waiting.set(name, {
        resolve: () => {
          inFlight -= 1;
          resolve();
        },
        reject: (e) => {
          inFlight -= 1;
          reject(e);
        },
      });
    });
  };
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  return { started, waiting, task, settle, most: () => most };
}

describe('runPool (AMENDMENTS-FOLLOWUPS-2026-11 FU-4: the background chunk load, a few at a time)', () => {
  it('keeps at most four tasks in flight, starts them in order and runs every one', async () => {
    expect(PREFETCH_CONCURRENCY).toBe(4);
    const r = rig();
    const names = Array.from({ length: 10 }, (_, i) => `chunk-${i}`);
    const done = runPool(names.map(r.task));
    await r.settle();
    expect(r.started).toEqual(names.slice(0, 4));
    for (const name of names) {
      r.waiting.get(name)?.resolve();
      await r.settle();
    }
    await done;
    expect(r.started).toEqual(names);
    expect(r.most()).toBe(4);
  });

  it('a failed task never stops the others, and the pool never rejects', async () => {
    const r = rig();
    const done = runPool(['a', 'b', 'c'].map(r.task), 1);
    await r.settle();
    r.waiting.get('a')?.reject(new Error('offline'));
    await r.settle();
    expect(r.started).toEqual(['a', 'b']);
    r.waiting.get('b')?.resolve();
    await r.settle();
    r.waiting.get('c')?.resolve();
    await expect(done).resolves.toBeUndefined();
    expect(r.most()).toBe(1);
  });

  it('a task that throws before it returns a promise is skipped the same way; no task is fine', async () => {
    const ran: string[] = [];
    await runPool([
      () => {
        throw new Error('sync');
      },
      async () => {
        ran.push('after');
      },
    ]);
    expect(ran).toEqual(['after']);
    await expect(runPool([])).resolves.toBeUndefined();
  });
});
