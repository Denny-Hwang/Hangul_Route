import type { Messages } from '@hangul-route/i18n';
import type { KoVoiceStatus } from './capability';
import { voiceStatusLine, type AudioCopy } from './copy';

/**
 * Profile "Sound" card voice line and the "Add a Korean voice" help sheet
 * (F-AUDIO-004 §3.7, wireframe design/wireframes/minigame/audio-fallback.md
 * W7, spec design/components/VoiceHelp/spec.md). Pure: the screen renders what
 * comes back. The words are `learner.audio` (F-I18N-001 PR 7b), passed in.
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

export function soundCardView(status: KoVoiceStatus, muted: boolean, copy: AudioCopy): SoundCardView {
  return {
    statusLine: voiceStatusLine(status, copy),
    showHowTo: status.state === 'none',
    howToLabel: copy.howToAddVoice.cta,
    glyph: muted ? 'speaker-off' : 'speaker',
  };
}

/**
 * The switch and the voice line read as one group: "Sound. Korean voice ready." The state is the switch's own
 * (`checked`), so the name does not say "on" or "off" a second time.
 */
export function soundSwitchLabel(status: KoVoiceStatus, copy: AudioCopy, label: Messages['a11y']['soundSwitch']): string {
  return label(voiceStatusLine(status, copy).replace(':', ''));
}

export type VoiceHelpSectionId = 'apple' | 'android' | 'computer';

export interface VoiceHelpSection {
  id: VoiceHelpSectionId;
  title: string;
  steps: readonly string[];
}

export interface VoiceHelpContent {
  title: string;
  note: string;
  sections: readonly VoiceHelpSection[];
  footer: string;
}

/** The OS families, in the order of the wireframe. */
const SECTION_ORDER: readonly VoiceHelpSectionId[] = ['apple', 'android', 'computer'];

/**
 * The sheet's content from `learner.audio.voiceHelp`: static steps per OS family. With a `family` (this device's, from
 * `platform/device-family.ts`) it holds that family's one section; without one, all three
 * (AMENDMENTS-AUDIO-CANT-HEAR section 3.9, review item P2-22).
 */
export function voiceHelpContent(copy: AudioCopy['voiceHelp'], family?: VoiceHelpSectionId): VoiceHelpContent {
  const ids = family === undefined ? SECTION_ORDER : [family];
  return {
    title: copy.title,
    note: copy.note,
    sections: ids.map((id) => ({ id, title: copy.sections[id].title, steps: copy.sections[id].steps })),
    footer: copy.footer,
  };
}
