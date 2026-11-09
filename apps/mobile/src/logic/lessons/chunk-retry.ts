/**
 * Retrying a chunk that failed to load before the learner sees the crash screen. A request that fails once on a flaky
 * network or a service worker still waking usually answers a moment later, so a failed load is asked again after a short
 * backoff (`CHUNK_RETRY_DELAYS_MS`: twice, 0.4 s then 1.5 s). Two failures are never asked again: a chunk of another
 * build (a retry reads the same wrong file; the page reload for a newer build handles it) and a hung request (it already
 * waited the whole timeout, and the screen's own Try again asks again). Offline, the crash screen comes about two
 * seconds later than before, still behind the calm waiting header.
 */
export const CHUNK_RETRY_DELAYS_MS: readonly number[] = [400, 1500];

const NEVER_RETRIED = new Set(['LessonChunkMismatch', 'LessonChunkTimeout', 'RootChunkTimeout']);

/** True for a failure another try can mend: not a chunk of a newer build, not a timeout. */
export function isRetryableChunkError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  return !NEVER_RETRIED.has(error.name) && !/^Requiring unknown module\b/.test(error.message);
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `load`; a retryable failure is run again after each delay in turn, then the last error is thrown. */
export async function retryLoad<T>(load: () => Promise<T>, delays: readonly number[] = CHUNK_RETRY_DELAYS_MS, wait: (ms: number) => Promise<void> = sleep): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await load();
    } catch (error) {
      const delay = delays[attempt];
      if (delay === undefined || !isRetryableChunkError(error)) throw error;
      await wait(delay);
    }
  }
}
