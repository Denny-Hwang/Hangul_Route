/**
 * Tap & Respond (F-AUDIO-004 §3.9, PR A-5b): after a right reply the next
 * turn waits for the reply to be said in full, so the next NPC line never
 * cuts it off. Pure timing; the screen passes the reply's play promise.
 */

/** The next turn waits at least this long after a right reply, even when the reply ends at once or cannot play. */
export const ADVANCE_MIN_MS = 900;
/** Never wait longer than this for the reply to end (the controller's own safety timeout is the real bound). */
export const ADVANCE_MAX_MS = 6000;

const defaultWait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves once the reply has ended (or failed), and no sooner than ADVANCE_MIN_MS nor later than ADVANCE_MAX_MS. */
export function afterReply(reply: Promise<unknown>, wait: (ms: number) => Promise<void> = defaultWait): Promise<void> {
  const ended = reply.then(
    () => undefined,
    () => undefined,
  );
  return Promise.all([Promise.race([ended, wait(ADVANCE_MAX_MS)]), wait(ADVANCE_MIN_MS)]).then(() => undefined);
}
