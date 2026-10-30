import { romanizeWord } from '@hangul-route/content-schema';
import { reportVoiceFault } from './speech-guard';
import { spokenFor, type SpokenJamo } from './spoken';

/**
 * What a jamo says, by the question asked (AMENDMENTS-AUDIO-CLIPS JV-A1, JV-A2). Pure.
 *
 * The one source of truth for a letter's voice: a **letter question** ("which letter is
 * this?") says the letter's name (ㄴ = 니은; a vowel's name is its sound, 아; ㅇ is 이응),
 * a **sound question** says the AD2 carrier syllable (ㄴ = 나, final ㄴ = 안). A final is
 * never asked by name. `spokenFor` stays the implementation detail underneath.
 */
export type JamoQuestion = 'letter' | 'sound';

/** The old `playJamo(jamo, mode)` name mode, kept for callers until JV-2 migrates them. */
export type LegacyJamoMode = 'name';

export interface JamoVoice {
  /** What is spoken: never a compatibility (U+3131-318E) or conjoining (U+1100-11FF) jamo. */
  text: string;
  /** What the screen shows for it: `text`, except the Word Builder finals spelled unlike their sound (앚 shown, 앋 spoken). */
  shown: string;
  /** Shown next to it (D2): the name's RR for a letter question, the spoken syllable's RR for a sound question. */
  romanization: string;
  /** The clip: `nameAudioRef`, or `audioRef` when the name is the sound (ㅇ, every vowel); `audioRef` for a sound. */
  audioRef?: string;
  /** What was chosen, for telemetry and tests. */
  kind: 'name' | 'sound';
}

/**
 * The Word Builder finals whose spelled closed syllable is not how it sounds (M12; standard
 * pronunciation article 9): a sound question shows the spelling and speaks the pronounced
 * form, so neither the device voice nor a clip reads a non-word coda. 디귿 at the bottom is
 * spelled as it sounds (앋) and is listed so the six finals said t share one entry.
 */
export const PRONOUNCED_FINALS: Readonly<Record<string, { text: string; romanization: string }>> = {
  'jamo:siot-batchim': { text: '앋', romanization: 'at' },
  'jamo:jieut-batchim': { text: '앋', romanization: 'at' },
  'jamo:chieut-batchim': { text: '앋', romanization: 'at' },
  'jamo:tieut-batchim': { text: '앋', romanization: 'at' },
  'jamo:digeut-batchim': { text: '앋', romanization: 'at' },
  'jamo:ssangsiot-batchim': { text: '앋', romanization: 'at' },
  'jamo:kieuk-batchim': { text: '악', romanization: 'ak' },
  'jamo:ssanggiyeok-batchim': { text: '악', romanization: 'ak' },
  'jamo:pieup-batchim': { text: '압', romanization: 'ap' },
};

function label(jamo: SpokenJamo): string {
  return jamo.id ?? jamo.char;
}

function voiceOf(text: string, shown: string, romanization: string, audioRef: string | undefined, kind: JamoVoice['kind']): JamoVoice {
  return audioRef === undefined ? { text, shown, romanization, kind } : { text, shown, romanization, audioRef, kind };
}

/** Authored RR wins (F-CNT-002); otherwise the converter, and the tile romanization for a text it cannot read. */
function romanizationOf(authored: string | undefined, text: string, fallback: string): string {
  return authored ?? romanizeWord(text) ?? fallback;
}

function soundVoice(jamo: SpokenJamo): JamoVoice {
  const base = spokenFor(jamo, 'sound');
  if (jamo.spokenKo === undefined) {
    // Release builds keep the old fallback (the tile glyph); the speech guard reports it again.
    reportVoiceFault(`jamoVoice: ${label(jamo)} has no spokenKo, so its sound would be a lone jamo (JV-A2).`);
    return voiceOf(base.text, base.text, base.romanization, base.audioRef, 'sound');
  }
  const pronounced = jamo.id === undefined ? undefined : PRONOUNCED_FINALS[jamo.id];
  if (pronounced !== undefined) {
    return voiceOf(pronounced.text, base.text, pronounced.romanization, base.audioRef, 'sound');
  }
  return voiceOf(base.text, base.text, romanizationOf(jamo.spokenRomanization, base.text, jamo.romanization), base.audioRef, 'sound');
}

/**
 * The spoken form of `jamo` for a `question` (JV-A2). A letter question on a final throws in
 * every build: a final is asked only by its sound (JV-A3). A record with no `nameKo` throws
 * in tests and falls back to the sound elsewhere (with a warning in development).
 */
export function jamoVoice(jamo: SpokenJamo, question: JamoQuestion): JamoVoice {
  if (question === 'sound') return soundVoice(jamo);
  if (jamo.kind === 'batchim') {
    throw new Error(`jamoVoice: ${label(jamo)} is a final; a final is asked only by a sound question (JV-A1).`);
  }
  if (jamo.nameKo === undefined) {
    reportVoiceFault(`jamoVoice: ${label(jamo)} has no nameKo for a letter question; falling back to its sound (JV-A2).`);
    return soundVoice(jamo);
  }
  // A vowel's name is its sound, and so is ㅇ's (이응): `spokenFor` reuses the sound clip and RR there.
  const name = spokenFor(jamo, 'name');
  const sameAsSound = jamo.nameKo === jamo.spokenKo;
  const romanization = sameAsSound ? romanizationOf(jamo.spokenRomanization, name.text, name.romanization) : name.romanization;
  return voiceOf(name.text, name.text, romanization, name.audioRef, 'name');
}

/**
 * The question an old `playJamo(jamo, mode)` call means: `'sound'` and the default are sound
 * questions; the legacy `'name'` is a letter question for a consonant or a vowel and keeps its
 * old fallback (the sound) on a final or a record with no name.
 */
export function toJamoQuestion(jamo: SpokenJamo, mode: JamoQuestion | LegacyJamoMode = 'sound'): JamoQuestion {
  if (mode !== 'name') return mode;
  return jamo.kind === 'batchim' || jamo.nameKo === undefined ? 'sound' : 'letter';
}
