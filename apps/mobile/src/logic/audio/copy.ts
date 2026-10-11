import type { Messages } from '@hangul-route/i18n';
import type { KoVoiceStatus } from './capability';
import type { FallbackAction, FallbackReason } from './prompt-state';

/**
 * Audio UI copy rules (F-AUDIO-004 §3.8). The words live in the dictionary
 * (`learner.audio`, F-I18N-001 PR 7b); these pick which one applies and take
 * the subtree as a parameter, so they stay pure and testable per locale.
 * Korean letters are shown by the screens as taught content (with
 * romanization), never inside these strings.
 */
export type AudioCopy = Messages['learner']['audio'];

export function matchSoundHeading(textShown: boolean, copy: AudioCopy): string {
  return textShown ? copy.heading.text : copy.heading.listen;
}

/** Accessibility label of the speaker button; it states the state. */
export function speakerLabel(muted: boolean, copy: AudioCopy): string {
  return muted ? copy.speaker.off : copy.speaker.on;
}

export function fallbackMessage(reason: FallbackReason | null, copy: AudioCopy): string | null {
  switch (reason) {
    case 'muted':
      return copy.soundIsOff;
    case 'no_voice':
      return copy.noKoreanVoice;
    case 'error':
      return copy.didNotPlay;
    case 'blocked':
      return copy.tapToHear;
    case null:
      return null;
  }
}

export function fallbackActionLabel(action: FallbackAction, copy: AudioCopy): string | null {
  return action === 'none' ? null : copy.action[action].cta;
}

/** The Profile "Sound" card's second line (§3.7). */
export function voiceStatusLine(status: KoVoiceStatus, copy: AudioCopy): string {
  if (status.state === 'ready') return copy.voice.ready;
  if (status.state === 'unknown') return copy.voice.looking;
  if (status.reason === 'offline_network_only') return copy.voice.needsInternet;
  return copy.noKoreanVoice;
}

/**
 * The second line of the fallback panel (§3.8): why the text is up. A blocked
 * sound has no line, because the speaker button itself reads "Tap to hear".
 */
export function panelDetail(reason: FallbackReason | null, copy: AudioCopy): string | null {
  switch (reason) {
    case 'muted':
      return copy.soundIsOff;
    case 'no_voice':
      return copy.noKoreanVoiceSentence;
    case 'error':
      return copy.didNotPlay;
    case 'blocked':
    case null:
      return null;
  }
}
