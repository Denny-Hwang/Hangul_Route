import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import type { ClipLookup } from '../logic/audio/controller';
import {
  INITIAL_PROMPT_STATE,
  promptReducer,
  type FallbackAction,
  type PlayResult,
} from '../logic/audio/prompt-state';
import { failureFromStore, fallbackVisible, promptPanelView, type PromptPanelView } from '../logic/audio/prompt-view';
import { useMessages } from '../i18n/use-messages';
import { hasClipFor, noteFallbackShown } from '../platform/audio';
import { clipRegistry } from '../platform/audio-assets-store';
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
  /**
   * Run a play (`playJamo` or `playPrompt`) and feed its result to the slot. `says`: what this play says (its spec, or
   * a chain's specs), for a slot whose word changes from play to play (Card Match, a story page, a word list): the slot
   * then counts a bundled recording of that word (its own or the say clip of its text) as sound, as `hasClip` does
   * for a slot with one word ([FU] AMENDMENTS-FOLLOWUPS-2026-11 FU-3). Kept until the next play that says or `reset()`.
   */
  play: (run: () => Promise<PlayResult>, says?: ClipLookup | readonly ClipLookup[]) => Promise<PlayResult>;
  /** New round: forget the text and any play still in flight. */
  reset: () => void;
  /** The panel button: Turn sound on / Try again / Tap to hear. `replay` plays the prompt once. */
  act: (action: FallbackAction, replay: () => void) => void;
  /**
   * Whether the text this slot shows without a play is decided: the voice check is over (or cannot change it: sound off, a
   * bundled clip). Until then the screen holds its answers (`<TapBoard held={!slot.settled}>`), so "No sound? Read it
   * here." never comes in above answers already on screen and moves them under a finger. Once true, stays true.
   */
  settled: boolean;
}

export interface PromptSlotOptions {
  /** Surface id for telemetry: 'match-sound' | 'discover' | 'listen-pick' | ... */
  source: string;
  /**
   * The item has a bundled recording (so a missing voice is not a missing sound): `hasClipFor(<the spec that plays>)`.
   * A slot whose word changes from play to play passes what each play says to `play` instead.
   */
  hasClip?: boolean;
  /**
   * The screen already prints the Korean next to its speaker and renders `<PromptPanel variant="status">`
   * (A-5b), so the fallback counts as shown when that status panel appears, not before.
   */
  textOnScreen?: boolean;
  /**
   * `false`: the slot never sends `audio.fallback_shown`, for a screen that draws no `PromptPanel` and
   * reports the fallback it does draw itself (the story check's "Say it yourself" chip). Default `true`.
   */
  reportFallback?: boolean;
}

export function usePromptSlot({
  source,
  hasClip = false,
  textOnScreen = false,
  reportFallback = true,
}: PromptSlotOptions): PromptSlot {
  const [state, dispatch] = useReducer(promptReducer, INITIAL_PROMPT_STATE);
  // A pack chunk's clips arrive after the first render (AMENDMENTS-AUDIO-CLIPS AC-B6): the caller re-renders then, so
  // the `hasClip` it computes (`hasClipFor`) is never left saying "no clip" while the say clip will play.
  useSyncExternalStore(clipRegistry.subscribe, clipRegistry.version, clipRegistry.version);
  const muted = useAudioStore((s) => s.muted);
  const tts = useAudioStore((s) => s.tts);
  const clips = useAudioStore((s) => s.clips);
  const unlocked = useAudioStore((s) => s.unlocked);
  const voiceCheckPending = useAudioStore((s) => s.voiceCheckPending);
  const epoch = useRef(0);
  // Answers once shown are never hidden again, whatever the store says later.
  const revealed = useRef(false);
  const copy = useMessages().learner.audio;
  // What the last play said, when the screen told the slot ([FU] FU-3); read against the clip registry on every render.
  const [said, setSaid] = useState<readonly ClipLookup[] | null>(null);

  const capability = { tts, clips, unlocked };
  const clip = (said !== null ? recorded(said) : hasClip) && clips;
  const view = promptPanelView(state, capability, muted, clip, copy);
  const settled = revealed.current || muted || clip || !voiceCheckPending;
  revealed.current = settled;

  // Mute and capability changes reach the slot as events, so text shown in a round stays (no flicker). An item whose
  // clip arrives late (its pack chunk) clears a "no Korean voice" text: with a clip it was never true.
  useEffect(() => {
    dispatch({ muted });
  }, [muted]);
  useEffect(() => {
    dispatch({ capability: { tts, clips, unlocked } });
  }, [tts, clips, unlocked, clip]);

  const shown = reportFallback && fallbackVisible(view, textOnScreen);
  useEffect(() => {
    if (shown && view.reason !== null) noteFallbackShown(source, view.reason);
  }, [shown, view.reason, source]);

  const play = useCallback((run: () => Promise<PlayResult>, says?: ClipLookup | readonly ClipLookup[]): Promise<PlayResult> => {
    const mine = epoch.current;
    if (says !== undefined) setSaid(isLookupList(says) ? says : [says]);
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
    setSaid(null);
    dispatch('reset');
    // The new round starts from what is true now.
    dispatch({ muted: useAudioStore.getState().muted });
  }, []);

  const act = useCallback((action: FallbackAction, replay: () => void): void => {
    if (action === 'turn_on') useAudioStore.getState().setMuted(false, 'fallback_panel');
    if (action !== 'none') replay();
  }, []);

  return { view, play, reset, act, settled };
}

function isLookupList(says: ClipLookup | readonly ClipLookup[]): says is readonly ClipLookup[] {
  return Array.isArray(says);
}

/** Every Korean step of what played has a bundled recording (a step in another language is the device voice's). */
function recorded(said: readonly ClipLookup[]): boolean {
  const korean = said.filter((s) => (s.language ?? 'ko-KR') === 'ko-KR' && s.text.trim() !== '');
  return korean.length > 0 && korean.every((s) => hasClipFor(s));
}
