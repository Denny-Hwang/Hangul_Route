import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHUNK_RETRY_DELAYS_MS, isRetryableChunkError } from '../../logic/lessons/chunk-retry';
import { ChunkDoorDropped, chunkDoor } from '../chunk-door';

/**
 * [SB] AMENDMENTS-START-BUNDLE-2026-11 row SB-4e: `drop()` forgets a load that is still pending (a hung request the
 * grown-up roots' timeout gave up on), so the next `load()` asks again, and the given-up load makes no further attempt.
 */
interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('chunkDoor drop()', () => {
  it('shares one pending load; after a drop the next load asks again', async () => {
    const asked: Deferred<string>[] = [];
    const door = chunkDoor<string>(() => {
      const d = deferred<string>();
      asked.push(d);
      return d.promise;
    });
    const first = door.load();
    expect(door.load()).toBe(first);
    expect(asked).toHaveLength(1);
    door.drop();
    const second = door.load();
    expect(second).not.toBe(first);
    expect(asked).toHaveLength(2);
    asked[1]!.resolve('chunk');
    await expect(second).resolves.toBe('chunk');
    expect(door.now()).toBe('chunk');
  });

  it('the given-up load makes no further attempt when its request fails (the retry backoff does not ask again)', async () => {
    vi.useFakeTimers();
    const asked: Deferred<string>[] = [];
    const door = chunkDoor<string>(() => {
      const d = deferred<string>();
      asked.push(d);
      return d.promise;
    });
    const given = door.load();
    const settled = given.then(
      () => 'in',
      (error: unknown) => error,
    );
    door.drop();
    const fresh = door.load();
    expect(asked).toHaveLength(2);
    // The abandoned script fires `error`: the given-up load would be asked again after its backoff.
    asked[0]!.reject(new Error('Loading module failed.'));
    await vi.advanceTimersByTimeAsync(CHUNK_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0) + 100);
    const error = await settled;
    expect(error).toBeInstanceOf(ChunkDoorDropped);
    expect(asked).toHaveLength(2);
    // Its failure leaves the fresh request alone.
    asked[1]!.resolve('chunk');
    await expect(fresh).resolves.toBe('chunk');
    expect(door.load()).resolves.toBe('chunk');
  });

  it('a chunk already in stays after a drop; a dropped load is never retried', async () => {
    const door = chunkDoor<string>(() => Promise.resolve('chunk'));
    await door.load();
    door.drop();
    expect(door.now()).toBe('chunk');
    await expect(door.load()).resolves.toBe('chunk');
    expect(isRetryableChunkError(new ChunkDoorDropped())).toBe(false);
  });
});
