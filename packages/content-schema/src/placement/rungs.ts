import type { PlacementForm, PlacementGate, PlacementStrand } from '../schemas/placement';

/**
 * The rung table and the 30 symbols (F-PLC-001 sections 3.4 and 3.5). Pure data
 * plus the limits of a run. No clock reads: durations are numbers the caller
 * compares against its own `nowMs`.
 */

export interface RungSpec {
  gate: PlacementGate;
  strand: PlacementStrand;
  /** `decode` for the five decoding gates; `read` and `oral` for vocabulary and sentences. */
  forms: readonly PlacementForm[];
}

/** The seven gates in asking order (rung 1 first). */
export const RUNG_TABLE: readonly RungSpec[] = [
  { gate: 'recog', strand: 'hangul-recognition', forms: ['decode'] },
  { gate: 'sound-basic', strand: 'sound-letter', forms: ['decode'] },
  { gate: 'syl-cv', strand: 'syllable-reading', forms: ['decode'] },
  { gate: 'sound-rest', strand: 'sound-letter', forms: ['decode'] },
  { gate: 'syl-cvc', strand: 'syllable-reading', forms: ['decode'] },
  { gate: 'vocab', strand: 'vocabulary', forms: ['read', 'oral'] },
  { gate: 'sentence', strand: 'sentences', forms: ['read', 'oral'] },
];

export const strandOfGate = (gate: PlacementGate): PlacementStrand => {
  const spec = RUNG_TABLE.find((r) => r.gate === gate);
  return (spec as RungSpec).strand;
};

/** The gates each strand owns, in asking order. */
export const STRAND_GATES: Readonly<Record<PlacementStrand, readonly PlacementGate[]>> = {
  'hangul-recognition': ['recog'],
  'sound-letter': ['sound-basic', 'sound-rest'],
  'syllable-reading': ['syl-cv', 'syl-cvc'],
  vocabulary: ['vocab'],
  sentences: ['sentence'],
};

/**
 * The 30 symbol keys of the F-QUEST-002 accounting: 14 consonants, 10 vowels,
 * 6 finals. A final is `'<consonant>/final'`.
 */
export const RUNG_SYMBOLS = {
  basic: ['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ', 'ㅗ', 'ㅜ', 'ㅁ', 'ㅇ', 'ㅡ', 'ㅣ', 'ㄷ', 'ㄹ'],
  rest: ['ㅈ', 'ㅊ', 'ㅂ', 'ㅅ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', 'ㅑ', 'ㅕ', 'ㅛ', 'ㅠ'],
  finals: ['ㄴ/final', 'ㄹ/final', 'ㅇ/final', 'ㄱ/final', 'ㅁ/final', 'ㅂ/final'],
} as const;

/** Every rung is exactly three questions. */
export const QUESTIONS_PER_RUNG = 3;

/** The session inactivity pause: nothing touched for this long (unless Take my time). It records nothing. */
export const IDLE_PAUSE_MS = 45_000;

/** Quick asks at most 15 questions, full at most 21. */
export const questionCap = (length: 'quick' | 'full'): number => (length === 'quick' ? 15 : 21);

/**
 * The one backstop clock of a run (D3): 4 minutes (quick) or 6 minutes (full),
 * `null` with Take my time. It is never shown and never marks a question wrong.
 */
export const backstopMs = (length: 'quick' | 'full', takeMyTime: boolean): number | null =>
  takeMyTime ? null : length === 'quick' ? 240_000 : 360_000;
