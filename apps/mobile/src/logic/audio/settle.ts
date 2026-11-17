/**
 * [QS] AMENDMENTS-QUEST-SOUND-BACK QS-3: a sound the app starts by itself, on a screen that has just appeared, waits
 * for the screen first. The first letter of a Look and learn page (AU-10) and a game's first-round prompt use this;
 * later rounds and every tap on a speaker stay immediate (G7). Pure timing: the screen owns what is played.
 */

/** How long a self-started sound waits for a screen that has just appeared. The same with reduced motion. */
export const SCREEN_SETTLE_MS = 350;

/** The timer the wait runs on (the real one by default; a test passes its own). */
export interface SettleTimers {
  set(run: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const systemTimers: SettleTimers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Runs `play` once the screen has had `SCREEN_SETTLE_MS`. The returned function cancels a wait still pending (the
 * screen went away, or the learner tapped a speaker first, so the sound is never said twice); after `play` ran it
 * does nothing.
 */
export function afterScreenSettles(play: () => void, timers: SettleTimers = systemTimers): () => void {
  let handle: unknown = timers.set(() => {
    handle = null;
    play();
  }, SCREEN_SETTLE_MS);
  return () => {
    if (handle === null) return;
    timers.clear(handle);
    handle = null;
  };
}
