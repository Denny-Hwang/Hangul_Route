import { ADVANCE_MAX_MS, ANSWER_SOUND_MAX_MS } from './reply-advance';
import { SCREEN_SETTLE_MS } from './settle';

/**
 * [QS] AMENDMENTS-QUEST-SOUND-BACK QS-3 and QS-4: the two waits a game screen gives its sounds, in one place.
 *
 * - `opening(play)`: the first round's own prompt waits `SCREEN_SETTLE_MS` for the screen (QS-3). Any sound the
 *   screen starts first (a tap on the speaker) drops the pending one, so nothing is said twice.
 * - `after(minMs, run, maxMs)`: what follows an answer (the next round, the end of the step) waits for the sound
 *   that is playing, no less than the game's own delay and no more than the cap (QS-4).
 *
 * Pure timing over injected timers; `components/use-sound-pacing.ts` ties one to a screen's life.
 */

export interface PacingTimers {
  set(run: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const systemTimers: PacingTimers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** The most a wait for a sentence lasts (`afterReply`'s bound). */
export const SENTENCE_SOUND_MAX_MS = ADVANCE_MAX_MS;

/** The cap for a sound of this kind: a sentence gets the long one, everything else `ANSWER_SOUND_MAX_MS`. */
export function soundCapMs(kind: string | undefined): number {
  return kind === 'sentence' || kind === 'narration' ? SENTENCE_SOUND_MAX_MS : ANSWER_SOUND_MAX_MS;
}

export interface SoundPacing {
  /**
   * Note a sound this screen just started (the promise `playPrompt` / the prompt slot returned) and hand it back.
   * It is what `after` waits for, and it drops an opening sound still waiting for the screen.
   */
  track<T>(sound: T): T;
  /**
   * Run `run` once the sound playing then has ended: never before `minMs`, never after `maxMs` (default
   * `ANSWER_SOUND_MAX_MS`; at least `minMs`). Returns a cancel.
   */
  after(minMs: number, run: () => void, maxMs?: number): () => void;
  /** The screen's own first sound: `play` runs after `SCREEN_SETTLE_MS`, unless a sound is tracked or the screen leaves first. */
  opening(play: () => void): void;
  /** Drop an opening sound still waiting. */
  cancelOpening(): void;
  /** The screen went away: every pending wait is dropped, and nothing runs later. */
  dispose(): void;
}

interface Tracked {
  ended: boolean;
  promise: Promise<void>;
}

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  value !== null && typeof value === 'object' && typeof (value as PromiseLike<unknown>).then === 'function';

export function createSoundPacing(timers: PacingTimers = systemTimers): SoundPacing {
  let last: Tracked | null = null;
  let openingHandle: unknown = null;
  const pending = new Set<() => void>();

  const cancelOpening = (): void => {
    if (openingHandle === null) return;
    timers.clear(openingHandle);
    openingHandle = null;
  };

  return {
    track: (sound) => {
      cancelOpening();
      if (!isThenable(sound)) {
        last = null;
        return sound;
      }
      const tracked: Tracked = { ended: false, promise: Promise.resolve() };
      const end = (): void => {
        tracked.ended = true;
      };
      tracked.promise = Promise.resolve(sound).then(end, end);
      last = tracked;
      return sound;
    },
    after: (minMs, run, maxMs = ANSWER_SOUND_MAX_MS) => {
      let done = false;
      let minHandle: unknown = null;
      let capHandle: unknown = null;
      const cancel = (): void => {
        done = true;
        if (minHandle !== null) timers.clear(minHandle);
        if (capHandle !== null) timers.clear(capHandle);
        minHandle = null;
        capHandle = null;
        pending.delete(cancel);
      };
      const fire = (): void => {
        if (done) return;
        cancel();
        run();
      };
      /** The least wait is over: go when nothing is sounding, else when it ends (a newer sound is waited for too). */
      const check = (): void => {
        if (done) return;
        const sound = last;
        if (sound === null || sound.ended) return fire();
        void sound.promise.then(check);
      };
      minHandle = timers.set(() => {
        minHandle = null;
        const rest = Math.max(0, maxMs - minMs);
        if (rest === 0) return fire();
        capHandle = timers.set(fire, rest);
        check();
      }, Math.max(0, minMs));
      pending.add(cancel);
      return cancel;
    },
    opening: (play) => {
      cancelOpening();
      openingHandle = timers.set(() => {
        openingHandle = null;
        play();
      }, SCREEN_SETTLE_MS);
    },
    cancelOpening,
    dispose: () => {
      cancelOpening();
      for (const cancel of [...pending]) cancel();
    },
  };
}
