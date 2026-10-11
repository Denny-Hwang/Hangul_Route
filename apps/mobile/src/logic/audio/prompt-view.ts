import type { AudioCapability } from './capability';
import { fallbackActionLabel, matchSoundHeading, panelDetail, speakerLabel, type AudioCopy } from './copy';
import {
  fallbackAction,
  showText,
  type FallbackAction,
  type FallbackReason,
  type PromptState,
} from './prompt-state';
import type { SpokenForm } from './spoken';

/**
 * What the shared prompt panel shows for one prompt slot (F-AUDIO-004 §3.8,
 * wireframe design/wireframes/minigame/audio-fallback.md W1-W4). Pure: the
 * hook feeds it the reducer state plus the store values and the `learner.audio`
 * messages, and the screen only renders what comes back.
 */
export interface PromptPanelView {
  /** The text prompt (spoken syllable + romanization) is up. */
  textShown: boolean;
  /** Why; `null` when the text stays after sound was turned back on. */
  reason: FallbackReason | null;
  /** "No sound? Read it here." */
  readLine: string;
  /** Second line saying why, or `null`. */
  detail: string | null;
  action: FallbackAction;
  actionLabel: string | null;
  /** "How to add a voice" link: only when there is no Korean voice (W3), else `null`. */
  helpLabel: string | null;
  heading: string;
  /** Accessibility label of the speaker button; it states the state. */
  speakerLabel: string;
  /** Visible caption next to the speaker button. */
  speakerCaption: string;
}

/** The reason behind the text prompt right now (muted wins, then what the slot learned, then the proactive no-voice case). */
function reasonOf(s: PromptState, cap: AudioCapability, muted: boolean, hasClip: boolean): FallbackReason | null {
  if (muted) return 'muted';
  if (s.phase === 'text') return s.reason;
  if (cap.tts.state === 'none' && !hasClip) return 'no_voice';
  return null;
}

export function promptPanelView(
  s: PromptState,
  cap: AudioCapability,
  muted: boolean,
  hasClip: boolean,
  copy: AudioCopy,
): PromptPanelView {
  const textShown = showText(s, cap, muted, hasClip);
  const reason = textShown ? reasonOf(s, cap, muted, hasClip) : null;
  const action = fallbackAction(reason);
  // Wireframe W4: when the sound may still work (error / blocked) the learner is still asked to listen.
  const soundOffOrAbsent = reason === null || reason === 'muted' || reason === 'no_voice';
  return {
    textShown,
    reason,
    readLine: copy.readHere,
    detail: panelDetail(reason, copy),
    action,
    actionLabel: fallbackActionLabel(action, copy),
    helpLabel: reason === 'no_voice' ? copy.howToAddVoice.cta : null,
    heading: matchSoundHeading(textShown && soundOffOrAbsent, copy),
    speakerLabel: reason === 'blocked' ? copy.tapToHear : speakerLabel(muted, copy),
    speakerCaption: reason === 'blocked' ? copy.tapToHear : copy.tapToReplay,
  };
}

/** The 800 ms replay after a wrong tap is skipped while the text stands in for a sound that is off or unavailable. */
export function shouldAutoReplay(view: PromptPanelView): boolean {
  return view.reason === null;
}

/** Why a play came back `unavailable`, from `audio-store.lastFailure` (the controller sets it just before it returns). */
export function failureFromStore(last: { reason: FallbackReason; at: number } | null): FallbackReason {
  return last !== null && last.reason !== 'muted' ? last.reason : 'error';
}

export interface WrongAnswerBubble {
  message: string;
  korean: string;
  romanization: string;
}

/** F-001 §3.2 (revised): the bubble repeats the sound that was played, as the spoken syllable and its romanization. */
export function wrongAnswerBubble(spoken: Pick<SpokenForm, 'text' | 'romanization'>, copy: AudioCopy): WrongAnswerBubble {
  return { message: copy.listenAgain, korean: spoken.text, romanization: spoken.romanization };
}
