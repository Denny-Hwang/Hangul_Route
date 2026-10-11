import type { Jamo } from '@hangul-route/content-schema';

/**
 * Spoken forms of the 30 symbols (F-QUEST-002 §3.12). What the voice
 * says for a symbol is its SOUND, not its letter name: a lone consonant read
 * by the iOS / Safari ko-KR voice comes out as 기역, 니은 ... (audit F01).
 * A consonant is spoken on the carrier vowel ㅏ, a vowel as its ㅇ-syllable and
 * a batchim as a short closed syllable. The one exception is the initial ㅇ:
 * 아 is the same audio as the vowel ㅏ, so ㅇ is spoken by its name 이응
 * (F-AUDIO-004 AD2, `spokenKind: 'name'`).
 *
 * The values now live on the jamo records (`spokenKo`, `spokenRomanization`,
 * `spokenKind`, F-AUDIO-004 PR A-2); the interim map this file once held is
 * gone. `logic/audio/spoken.ts` (`spokenFor`) is the audio-side reader.
 */
export interface SpokenForm {
  /** What the voice says. */
  ko: string;
  /** Revised Romanization of `ko`, unhyphenated (D13). */
  romanization: string;
  /** `sound`: the symbol's sound; `name`: the letter name (initial ㅇ only). */
  kind: 'sound' | 'name';
}

/**
 * What the voice says for a symbol, from the jamo data: `undefined` when the
 * record carries no spoken form (`spokenKo` with its `spokenRomanization`).
 */
export function spokenFormFor(jamo: Jamo): SpokenForm | undefined {
  if (jamo.spokenKo === undefined || jamo.spokenRomanization === undefined) return undefined;
  return { ko: jamo.spokenKo, romanization: jamo.spokenRomanization, kind: jamo.spokenKind };
}
