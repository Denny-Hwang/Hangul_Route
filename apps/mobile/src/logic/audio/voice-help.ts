import type { KoVoiceStatus } from './capability';
import { AUDIO_COPY, voiceStatusLine } from './copy';

/**
 * Profile "Sound" card voice line and the "Add a Korean voice" help sheet
 * (F-AUDIO-004 §3.7, wireframe design/wireframes/minigame/audio-fallback.md
 * W7, spec design/components/VoiceHelp/spec.md). Pure: the screen renders what
 * comes back. English until F-I18N-001's catalog exists.
 */
export interface SoundCardView {
  /** Second line under "Sound". */
  statusLine: string;
  /** Offer the help sheet: only when a voice is known to be missing (never while still looking). */
  showHowTo: boolean;
  howToLabel: string;
  /** Mute sign while the sound is off, the speaker otherwise. */
  glyph: 'speaker' | 'speaker-off';
}

export function soundCardView(status: KoVoiceStatus, muted: boolean): SoundCardView {
  return {
    statusLine: voiceStatusLine(status),
    showHowTo: status.state === 'none',
    howToLabel: AUDIO_COPY.howToAddVoice,
    glyph: muted ? 'speaker-off' : 'speaker',
  };
}

/** The switch, its state and the voice line read as one group: "Sound, on. Korean voice ready." */
export function soundSwitchLabel(status: KoVoiceStatus, muted: boolean): string {
  const voice = voiceStatusLine(status).replace(':', '');
  return `Sound, ${muted ? 'off' : 'on'}. ${voice}.`;
}

export interface VoiceHelpSection {
  id: 'apple' | 'android' | 'computer';
  title: string;
  steps: readonly string[];
}

export interface VoiceHelpContent {
  title: string;
  note: string;
  sections: readonly VoiceHelpSection[];
  footer: string;
  closeLabel: string;
}

/**
 * Static steps per OS family. Menu names follow Apple, Google and Microsoft
 * help pages and still vary by OS version and maker, so the sheet says so.
 */
export const VOICE_HELP: VoiceHelpContent = {
  title: 'Add a Korean voice',
  note: 'Menu names can differ on your device.',
  sections: [
    {
      id: 'apple',
      title: 'iPhone or iPad',
      steps: [
        'Open Settings, then Accessibility.',
        'Tap Spoken Content, then Voices, then Korean.',
        'Download a voice, such as Yuna. Enhanced or Premium sounds best.',
        'Come back and reopen Hangul Route.',
      ],
    },
    {
      id: 'android',
      title: 'Android',
      steps: [
        'Open Settings, then search for Text-to-speech output.',
        'Choose Speech Services by Google and tap the gear.',
        'Tap Install voice data, then Korean.',
        'Come back and reopen Hangul Route.',
      ],
    },
    {
      id: 'computer',
      title: 'Computer',
      steps: [
        'Mac: System Settings, Accessibility, Spoken Content, System Voice, Manage Voices, then Korean.',
        'Windows: Settings, Time & language, Speech, Manage voices, then Add voices and Korean.',
        'Chrome and Edge: some Korean voices need the internet, so check you are online.',
        'Reload this page.',
      ],
    },
  ],
  footer: 'You can still play: the sound is written on screen.',
  closeLabel: 'OK',
};
