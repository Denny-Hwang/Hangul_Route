/**
 * Waiting for a sound before the screen moves on. Pure timing; the screen passes the sound's play promise.
 *
 * Tap & Respond (F-AUDIO-004 §3.9, PR A-5b): after a right reply the next turn waits for the reply to be said in
 * full, so the next NPC line never cuts it off (`afterReply`).
 *
 * [QS] AMENDMENTS-QUEST-SOUND-BACK QS-4: the same wait for every game (`afterSound`). Where an answer plays a sound,
 * the next round, the next question or the end of the step waits for it to end, with the game's present delay as the
 * least wait and `ANSWER_SOUND_MAX_MS` as the most (`ADVANCE_MAX_MS` where the sound is a sentence).
 */

/** The next turn waits at least this long after a right reply, even when the reply ends at once or cannot play. */
export const ADVANCE_MIN_MS = 900;
/** Never wait longer than this for the reply to end (the controller's own safety timeout is the real bound). */
export const ADVANCE_MAX_MS = 6000;
/** [QS-4] The most a game waits for an answer's word, letter or syllable to end. */
export const ANSWER_SOUND_MAX_MS = 2500;

const defaultWait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface SoundWait {
  /** The least wait: the game's present delay. */
  minMs: number;
  /** The most. Default `ANSWER_SOUND_MAX_MS`; a value under `minMs` counts as `minMs`. */
  maxMs?: number;
}

/**
 * Resolves once `sound` has ended (or failed), and no sooner than `minMs` nor later than `maxMs`. With no sound
 * (`null`: nothing was played) it is the least wait alone.
 */
export function afterSound(
  sound: Promise<unknown> | null | undefined,
  { minMs, maxMs = ANSWER_SOUND_MAX_MS }: SoundWait,
  wait: (ms: number) => Promise<void> = defaultWait,
): Promise<void> {
  const least = wait(minMs);
  if (sound === null || sound === undefined) return least;
  const ended = sound.then(
    () => undefined,
    () => undefined,
  );
  return Promise.all([Promise.race([ended, wait(Math.max(minMs, maxMs))]), least]).then(() => undefined);
}

/** Resolves once the reply has ended (or failed), and no sooner than ADVANCE_MIN_MS nor later than ADVANCE_MAX_MS. */
export function afterReply(reply: Promise<unknown>, wait: (ms: number) => Promise<void> = defaultWait): Promise<void> {
  return afterSound(reply, { minMs: ADVANCE_MIN_MS, maxMs: ADVANCE_MAX_MS }, wait);
}
