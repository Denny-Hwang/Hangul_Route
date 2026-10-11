import type { PlayResult, PlaySpec } from '../audio/controller';

/**
 * Plays a scene's steps one after another (F-STORY-002 §3.2, §3.4). No React,
 * no platform import: `playPrompt` (F-AUDIO-004) and the voice `stop` are
 * injected.
 *
 * - Each step is awaited in order.
 * - Any result other than `played` ends the chain: `muted` or `unavailable`
 *   on a Korean step skips the English that follows too (a half-read scene is
 *   worse than a text-only one), and muted applies to every step anyway.
 * - A generation counter ends an old chain when `stop()` or a newer `play()`
 *   arrives, even though F-AUDIO-004 resolves a superseded prompt as `played`.
 *   A superseded chain reports nothing.
 */

export type RunnerResult = PlayResult | 'superseded';

export interface AudioRunnerDeps {
  playPrompt(spec: PlaySpec): Promise<PlayResult>;
  /** Cuts the voice that is speaking now (`platform/audio` `stop`). */
  stop?(): void;
  /** Called once when a chain that was not superseded ends. */
  onStatus?(report: { status: PlayResult }): void;
}

export interface AudioRunner {
  play(steps: readonly PlaySpec[]): Promise<RunnerResult>;
  stop(): void;
  isPlaying(): boolean;
}

export function createAudioRunner(deps: AudioRunnerDeps): AudioRunner {
  let generation = 0;
  let playing = false;

  /** Ends the current (not superseded) chain. */
  const settle = (status: PlayResult): RunnerResult => {
    playing = false;
    deps.onStatus?.({ status });
    return status;
  };

  const play = async (steps: readonly PlaySpec[]): Promise<RunnerResult> => {
    generation += 1;
    const gen = generation;
    if (steps.length === 0) {
      playing = false;
      return 'played';
    }
    playing = true;
    for (const spec of steps) {
      let result: PlayResult;
      try {
        result = await deps.playPrompt(spec);
      } catch {
        result = 'unavailable';
      }
      if (gen !== generation) return 'superseded';
      if (result !== 'played') return settle(result);
    }
    return settle('played');
  };

  const stop = (): void => {
    generation += 1;
    playing = false;
    deps.stop?.();
  };

  return { play, stop, isPlaying: () => playing };
}
