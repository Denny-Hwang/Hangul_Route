import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  INITIAL_PROMPT_STATE,
  promptReducer,
  type FallbackAction,
  type PlayResult,
} from '../logic/audio/prompt-state';
import { failureFromStore, fallbackVisible, promptPanelView, type PromptPanelView } from '../logic/audio/prompt-view';
import { useMessages } from '../i18n/use-messages';
import { noteFallbackShown } from '../platform/audio';
import { useAudioStore } from '../store/audio-store';

/**
 * One prompt slot (a Match Sound round, a Discover item, a Listen & Pick
 * question) wired to the audio store (F-AUDIO-004 §3.8). The decisions live in
 * `logic/audio/prompt-state.ts` and `prompt-view.ts`; this hook only connects
 * them to React. Text shows at once when sound is off or no Korean voice
 * exists, and after a failed play; once shown in a round it stays until
 * `reset()` (call it when the next round starts).
 */
export interface PromptSlot {
  view: PromptPanelView;
  /** Run a play (`playJamo(...)` / `playPrompt(...)`) and feed its result to the slot. */
  play: (run: () => Promise<PlayResult>) => Promise<PlayResult>;
  /** New round: forget the text and any play still in flight. */
  reset: () => void;
  /** The panel button: Turn sound on / Try again / Tap to hear. `replay` plays the prompt once. */
  act: (action: FallbackAction, replay: () => void) => void;
}

export interface PromptSlotOptions {
  /** Surface id for telemetry: 'match-sound' | 'discover' | 'listen-pick' | ... */
  source: string;
  /** The item has a bundled recording (so a missing voice is not a missing sound). */
  hasClip?: boolean;
  /**
   * The screen already prints the Korean next to its speaker and renders `<PromptPanel variant="status">`
   * (A-5b), so the fallback counts as shown when that status panel appears, not before.
   */
  textOnScreen?: boolean;
}

export function usePromptSlot({ source, hasClip = false, textOnScreen = false }: PromptSlotOptions): PromptSlot {
  const [state, dispatch] = useReducer(promptReducer, INITIAL_PROMPT_STATE);
  const muted = useAudioStore((s) => s.muted);
  const tts = useAudioStore((s) => s.tts);
  const clips = useAudioStore((s) => s.clips);
  const unlocked = useAudioStore((s) => s.unlocked);
  const epoch = useRef(0);
  const copy = useMessages().learner.audio;

  const capability = { tts, clips, unlocked };
  const clip = hasClip && clips;
  const view = promptPanelView(state, capability, muted, clip, copy);

  // Mute and capability changes reach the slot as events, so text shown in a round stays (no flicker).
  useEffect(() => {
    dispatch({ muted });
  }, [muted]);
  useEffect(() => {
    if (!clip) dispatch({ capability: { tts, clips, unlocked } });
  }, [tts, clips, unlocked, clip]);

  const shown = fallbackVisible(view, textOnScreen);
  useEffect(() => {
    if (shown && view.reason !== null) noteFallbackShown(source, view.reason);
  }, [shown, view.reason, source]);

  const play = useCallback((run: () => Promise<PlayResult>): Promise<PlayResult> => {
    const mine = epoch.current;
    dispatch('play');
    return run().then((result) => {
      if (mine === epoch.current) {
        dispatch({ result, failure: result === 'unavailable' ? failureFromStore(useAudioStore.getState().lastFailure) : undefined });
      }
      return result;
    });
  }, []);

  const reset = useCallback((): void => {
    epoch.current += 1;
    dispatch('reset');
    // The new round starts from what is true now.
    dispatch({ muted: useAudioStore.getState().muted });
  }, []);

  const act = useCallback((action: FallbackAction, replay: () => void): void => {
    if (action === 'turn_on') useAudioStore.getState().setMuted(false, 'fallback_panel');
    if (action !== 'none') replay();
  }, []);

  return { view, play, reset, act };
}
