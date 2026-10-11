import type { Jamo } from '@hangul-route/content-schema';

/**
 * What a prompt for a jamo says (F-AUDIO-004 §3.1, §3.5). Pure.
 *
 * Sound first, name second (AD1): the `'sound'` mode plays the carrier
 * syllable (`spokenKo`), the `'name'` mode the Hangul letter name (`nameKo`).
 * Fields are optional in the schema until A-2 fills them, so a record without
 * them falls back to `char` and the tile romanization.
 */
export type SpokenJamo = Pick<
  Jamo,
  'char' | 'romanization' | 'nameEn' | 'spokenKo' | 'spokenRomanization' | 'spokenKind' | 'nameKo' | 'audioRef' | 'nameAudioRef'
>;

export interface SpokenForm {
  text: string;
  audioRef?: string;
  romanization: string;
}

function form(text: string, romanization: string, audioRef: string | undefined): SpokenForm {
  return audioRef === undefined ? { text, romanization } : { text, romanization, audioRef };
}

function soundOf(jamo: SpokenJamo): SpokenForm {
  const text = jamo.spokenKo ?? jamo.char;
  const romanization = jamo.spokenRomanization ?? jamo.romanization;
  return form(text, romanization, jamo.audioRef);
}

export function spokenFor(jamo: SpokenJamo, mode: 'sound' | 'name'): SpokenForm {
  if (mode === 'sound' || jamo.nameKo === undefined) return soundOf(jamo);
  // A vowel's name equals its sound, so the sound clip and romanization are reused (§3.2 notes).
  const sameAsSound = jamo.nameKo === jamo.spokenKo;
  const romanization = sameAsSound && jamo.spokenRomanization !== undefined ? jamo.spokenRomanization : jamo.nameEn;
  return form(jamo.nameKo, romanization, jamo.nameAudioRef ?? (sameAsSound ? jamo.audioRef : undefined));
}
