import type { ListenPickRound } from '@hangul-route/content-schema';
import type { ContrastEnv } from '../audio/contrast-sets';

/**
 * [MP] AMENDMENTS-MINIMAL-PAIRS section 3.6, row MP-2b: a contrast step that cannot play is passed by.
 *
 * On every entry to a contrast step the player decides, before it shows anything, whether the step has rounds to play:
 * first it waits for the clip packs that are on their way (`hasClip` is false for a lazy pack until its chunk has been
 * added), then it loads the contrast chunk (the catalogue, with each set's approval, lives there), then it asks the chunk
 * with the device as it is now (clips, sound, "Always show the letters"). "Play" shows the step as any game step (its
 * launcher); "pass" moves on as if it were done, without a step screen, a `minigame.finished`, or a mark on the run's
 * skipped steps (the learner chose nothing). Pure: the waiting, the chunk and the device are passed in.
 */

/** The part of the contrast chunk the verdict reads (`contrast-chunk.tsx`). */
export interface ContrastKitLike {
  contrastStepPlayable(rounds: readonly ListenPickRound[], env: ContrastEnv): boolean;
}

export interface ContrastPassDeps {
  /** Resolves once the clip registry's pending pack loads have settled, or `PACK_WAIT_MS` has passed. */
  waitForPacks(): Promise<void>;
  /** The contrast chunk; rejects when it cannot be loaded (offline before the precache). */
  loadKit(): Promise<ContrastKitLike>;
  /** The device now, read after the wait. */
  env(): ContrastEnv;
}

export type ContrastVerdict = 'play' | 'pass';

/** Whether the step plays or is passed by. Never throws: whatever goes wrong, the step is passed by (the quest is as it was). */
export async function contrastStepVerdict(rounds: readonly ListenPickRound[], deps: ContrastPassDeps): Promise<ContrastVerdict> {
  if (rounds.length === 0) return 'pass';
  try {
    await deps.waitForPacks();
    const kit = await deps.loadKit();
    return kit.contrastStepPlayable(rounds, deps.env()) ? 'play' : 'pass';
  } catch {
    return 'pass';
  }
}

/** Which way a passed-by step moves on: the way the learner was going (`cameBack` is true after Previous). */
export function passByDirection(cameBack: boolean): 'next' | 'prev' {
  return cameBack ? 'prev' : 'next';
}
