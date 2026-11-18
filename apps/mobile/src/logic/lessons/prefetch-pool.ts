/**
 * The background load of every lesson, story and locale chunk, a few at a time (AMENDMENTS-FOLLOWUPS-2026-11 FU-4).
 *
 * The load starts once the first screen is up (`platform/lesson-prefetch`). It used to ask for every chunk at once,
 * 54 requests on a first visit; on a slow link a chunk the screen then needs (the guest's first quest, the lesson the
 * learner opens) waited behind all of them: the guest's hello came 6 s later on a fast-3G-like link
 * (docs/launch/performance-review-2026-11.md). With at most `PREFETCH_CONCURRENCY` in flight, a request the screen
 * makes shares the link with a few, and every chunk is still loaded. Tasks start in the order given; a task that fails
 * is left for the screen that needs it (as before) and the others go on. Pure.
 */
export const PREFETCH_CONCURRENCY = 4;

export async function runPool(tasks: readonly (() => Promise<unknown>)[], limit: number = PREFETCH_CONCURRENCY): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < tasks.length) {
      const task = tasks[next];
      next += 1;
      if (task === undefined) continue;
      try {
        await task();
      } catch {
        // Left for the screen that needs it; the next try (back online) asks again.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, worker));
}
