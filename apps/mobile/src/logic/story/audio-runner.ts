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
 * - Exception (`skipUnavailableKorean`): when the voice check had not settled
 *   as the chain started, an `unavailable` Korean step is skipped and the
 *   English carries on (§3.4: English narration still plays); the chain then
 *   reports `unavailable` so the prompt slot learns the Korean did not play.
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

export interface AudioRunnerPlayOptions {
  /** Skip (do not stop at) a Korean step that reports `unavailable`; see above. */
  skipUnavailableKorean?: boolean;
}

export interface AudioRunner {
  play(steps: readonly PlaySpec[], options?: AudioRunnerPlayOptions): Promise<RunnerResult>;
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

  const play = async (steps: readonly PlaySpec[], options?: AudioRunnerPlayOptions): Promise<RunnerResult> => {
    generation += 1;
    const gen = generation;
    if (steps.length === 0) {
      playing = false;
      return 'played';
    }
    playing = true;
    let skipped = false;
    for (const spec of steps) {
      let result: PlayResult;
      try {
        result = await deps.playPrompt(spec);
      } catch {
        result = 'unavailable';
      }
      if (gen !== generation) return 'superseded';
      if (result === 'unavailable' && options?.skipUnavailableKorean === true && (spec.language ?? 'ko-KR') === 'ko-KR') {
        skipped = true;
        continue;
      }
      if (result !== 'played') return settle(result);
    }
    return settle(skipped ? 'unavailable' : 'played');
  };

  const stop = (): void => {
    generation += 1;
    playing = false;
    deps.stop?.();
  };

  return { play, stop, isPlaying: () => playing };
}
