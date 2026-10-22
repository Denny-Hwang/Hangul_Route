/**
 * How long Home holds the day's plan for the Daily Review's first read (F-CURR-002 sections 4.3 and 4.5, row CM-14;
 * review of #831). The read goes through the memory chunk, the review items and the store; when it is slower than
 * this (or never settles), Home pins the day's plan without it, so the Today cards, the new lesson first among them,
 * are never held back. The read still lands later, and the Daily Review joins slot 3 then (`repinDailyReview`).
 * About the memory hooks' own wait (`MEMORY_HOOK_TIMEOUT_MS` is 3 s), shorter because Home is the first screen.
 */
export const DAILY_REVIEW_HOME_WAIT_MS = 1500;

/**
 * Calls `onLate` once when `read` has not settled within `ms`; nothing when it settles first (resolved or rejected).
 * Returns a cancel that clears the timer.
 */
export function onLateRead(read: Promise<unknown>, ms: number, onLate: () => void): () => void {
  let settled = false;
  const timer = setTimeout(() => {
    if (!settled) onLate();
  }, ms);
  const done = (): void => {
    settled = true;
    clearTimeout(timer);
  };
  read.then(done, done);
  return done;
}
