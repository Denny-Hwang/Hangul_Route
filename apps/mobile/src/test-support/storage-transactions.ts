import { vi } from 'vitest';

/** The two calls of a test's storage fake that a transaction is built on. */
interface ReadWriteFake {
  readJson: (key: string) => Promise<unknown>;
  writeJson: (key: string, value: unknown) => Promise<unknown>;
  /** The rest of the fake, passed through as it is. */
  [name: string]: unknown;
}

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 rows AU-3 and AU-11: the progress store reads and writes a snapshot in one
 * `updateJson` transaction. A test file that fakes `platform/storage` with a map wraps its fake in this, and the
 * transaction then runs on the fake's own `readJson` and `writeJson`: its map holds what was stored, and its spies
 * still count "one read" and "one write". As in IndexedDB, the callback runs after the call has returned.
 * `keepRawCopy` has nothing to keep (a map of parsed values holds no damaged record), and `readJsonExact` is the
 * fake's `readJson`. A fake that brings its own `updateJson`, `keepRawCopy` or `readJsonExact` keeps it.
 *
 *   vi.mock('../../platform/storage', async () =>
 *     (await import('../../test-support/storage-transactions')).withTransactions({ readJson: ..., writeJson: ... }));
 */
export function withTransactions<T extends ReadWriteFake>(fake: T) {
  return {
    updateJson: vi.fn(async (key: string, next: (current: unknown) => unknown): Promise<boolean> => {
      const value = next(await fake.readJson(key));
      if (value === undefined) return false;
      await fake.writeJson(key, value);
      return true;
    }),
    keepRawCopy: vi.fn(async (): Promise<boolean> => false),
    // [DP] AMENDMENTS-DURABLE-PROGRESS row DP-1a: the sync store asks whether a damaged copy was kept
    // (`hr:progress-corrupt:<id>`); a map of parsed values holds what it holds, so the fake's own read answers.
    readJsonExact: vi.fn(async (key: string): Promise<unknown> => fake.readJson(key)),
    ...fake,
  };
}
