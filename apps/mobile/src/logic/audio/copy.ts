import type { KoVoiceStatus } from './capability';
import type { FallbackAction, FallbackReason } from './prompt-state';

/**
 * Audio UI copy (F-AUDIO-004 §3.8). Pre-A1 English, plain and calm: no emoji,
 * no age words, no failure shaming. Lives here until F-I18N-001's catalog
 * exists, then moves to `learner.audio.*` keys. Korean letters are shown by
 * the screens as taught content (with romanization), never inside these strings.
 */
export const AUDIO_COPY = {
  readHere: 'No sound? Read it here.',
  headingListen: 'Tap the letter you hear',
  headingText: 'Tap the letter for this sound',
  listenAgain: 'Listen again. This one says',
  hearIt: 'Hear it',
  tapToHear: 'Tap to hear',
  turnSoundOn: 'Turn sound on',
  tryAgain: 'Try again',
  noKoreanVoice: 'No Korean voice on this device',
  soundIsOff: 'Sound is off.',
  didNotPlay: 'The sound did not play.',
  letterName: 'Letter name',
  playSound: 'Play sound',
  playSoundOff: 'Play sound, sound is off',
  voiceReady: 'Korean voice: ready',
  voiceNeedsInternet: 'Korean voice needs the internet',
  voiceLooking: 'Looking for a Korean voice',
} as const;

export function matchSoundHeading(textShown: boolean): string {
  return textShown ? AUDIO_COPY.headingText : AUDIO_COPY.headingListen;
}

/** Accessibility label of the speaker button; it states the state. */
export function speakerLabel(muted: boolean): string {
  return muted ? AUDIO_COPY.playSoundOff : AUDIO_COPY.playSound;
}

export function fallbackMessage(reason: FallbackReason | null): string | null {
  switch (reason) {
    case 'muted':
      return AUDIO_COPY.soundIsOff;
    case 'no_voice':
      return AUDIO_COPY.noKoreanVoice;
    case 'error':
      return AUDIO_COPY.didNotPlay;
    case 'blocked':
      return AUDIO_COPY.tapToHear;
    case null:
      return null;
  }
}

export function fallbackActionLabel(action: FallbackAction): string | null {
  switch (action) {
    case 'turn_on':
      return AUDIO_COPY.turnSoundOn;
    case 'try_again':
      return AUDIO_COPY.tryAgain;
    case 'tap_to_hear':
      return AUDIO_COPY.tapToHear;
    case 'none':
      return null;
  }
}

/** The Profile "Sound" card's second line (§3.7). */
export function voiceStatusLine(status: KoVoiceStatus): string {
  if (status.state === 'ready') return AUDIO_COPY.voiceReady;
  if (status.state === 'unknown') return AUDIO_COPY.voiceLooking;
  if (status.reason === 'offline_network_only') return AUDIO_COPY.voiceNeedsInternet;
  return AUDIO_COPY.noKoreanVoice;
}
