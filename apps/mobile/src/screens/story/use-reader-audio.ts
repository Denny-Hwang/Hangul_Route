import { useCallback, useEffect, useRef } from 'react';
import { usePromptSlot, type PromptSlot } from '../../components/use-prompt-slot';
import { canPlayKorean } from '../../logic/audio/capability';
import type { PlaySpec } from '../../logic/audio/controller';
import { createAudioRunner, type AudioRunner } from '../../logic/story/audio-runner';
import { hasKoreanStep, stepsForVoice } from '../../logic/story/reader-effects';
import { STORY_READER_AUDIO_SOURCE } from '../../logic/story/scene-audio';
import { playPrompt, stop as stopVoice } from '../../platform/audio';
import { useAudioStore } from '../../store/audio-store';

/**
 * The reader's sound (F-STORY-002 §3.4) over F-AUDIO-004: every step goes
 * through `playPrompt` (voice ranking, rate, mute, clips and capability live
 * there), chained by the pure `createAudioRunner`, and every result feeds one
 * shared prompt slot so the text fallback (`PromptPanel`) and the "Say it
 * yourself" chip follow F-AUDIO-004 §3.8. No rule lives here: which steps a
 * scene says is `planSceneAudio`, what is left out without a Korean voice is
 * `stepsForVoice`.
 */
export interface ReaderAudio {
  slot: PromptSlot;
  /**
   * False only once the capability check found no Korean voice and no clip (F-AUDIO-004 §3.4); while
   * the check still runs a Korean step is asked for (the controller waits for the voices).
   */
  canPlayKorean: boolean;
  /** The first-gesture unlock has run (always true on native). */
  unlocked: boolean;
  /** Plays the steps in order; a newer call or `stop()` ends the previous chain. */
  play: (steps: readonly PlaySpec[]) => void;
  /** Scene change: cut the voice and start a fresh prompt slot. */
  resetForScene: () => void;
  stop: () => void;
  /** Chains that were heard to the end (for `story.read.finished`). */
  playedCount: () => number;
}

/**
 * @param source surface id of the prompt slot (`audio.fallback_shown`); the story check
 * (F-STORY-003 §3.4) passes `'story-check'`, the reader keeps its default.
 */
export function useReaderAudio(source: string = STORY_READER_AUDIO_SOURCE): ReaderAudio {
  const slot = usePromptSlot({ source });
  const koreanOk = useAudioStore(
    (s) => s.tts.state === 'unknown' || canPlayKorean({ tts: s.tts, clips: s.clips, unlocked: s.unlocked }),
  );
  const checking = useAudioStore((s) => s.tts.state === 'unknown');
  const unlocked = useAudioStore((s) => s.unlocked);
  const runnerRef = useRef<AudioRunner | null>(null);
  if (runnerRef.current === null) runnerRef.current = createAudioRunner({ playPrompt, stop: stopVoice });
  const koreanRef = useRef(koreanOk);
  koreanRef.current = koreanOk;
  const checkingRef = useRef(checking);
  checkingRef.current = checking;
  const played = useRef(0);
  const { play: slotPlay, reset: slotReset } = slot;

  const play = useCallback(
    (steps: readonly PlaySpec[]): void => {
      const runner = runnerRef.current;
      if (runner === null || steps.length === 0) return;
      const spoken = stepsForVoice(steps, koreanRef.current);
      // Only Korean and no Korean voice: still ask, so the slot learns `unavailable` and shows its text.
      const chain = spoken.length > 0 ? spoken : [...steps];
      // Voice check still running: a Korean step that turns out unavailable is skipped, not the end of the English.
      const options = { skipUnavailableKorean: checkingRef.current };
      if (!hasKoreanStep(chain)) {
        // English only (no Korean voice): it says nothing about the Korean, so the slot keeps its
        // no-voice text, detail line and help link (§3.4, §3.14 row 7).
        void runner.play(chain, options).then((result) => {
          if (result === 'played') played.current += 1;
        });
        return;
      }
      void slotPlay(async () => {
        const result = await runner.play(chain, options);
        if (result === 'played') played.current += 1;
        // A superseded chain says nothing about the sound: the newer one reports.
        return result === 'superseded' ? 'played' : result;
      });
    },
    [slotPlay],
  );

  const stop = useCallback((): void => {
    runnerRef.current?.stop();
  }, []);

  const resetForScene = useCallback((): void => {
    runnerRef.current?.stop();
    slotReset();
  }, [slotReset]);

  useEffect(() => () => runnerRef.current?.stop(), []);

  return {
    slot,
    canPlayKorean: koreanOk,
    unlocked,
    play,
    resetForScene,
    stop,
    playedCount: () => played.current,
  };
}
