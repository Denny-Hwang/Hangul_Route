import type { ASSESSMENT_FORMATS } from '../assessment/question';
import type { PlacementForm, PlacementGate, PlacementLevel, PlacementResult, PlacementStrand } from '../schemas/placement';

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
 * The route-moving steps after `recog`, in asking order (F-PLC-001 section 3.5): each is
 * asked only while every step before it has passed. The planner walks this ladder and
 * `stepPassed` (scoring) counts a step as passed only when every step before it did.
 */
export const MAIN_STEPS: readonly (readonly [PlacementGate, PlacementForm])[] = [
  ['sound-basic', 'decode'],
  ['syl-cv', 'decode'],
  ['sound-rest', 'decode'],
  ['syl-cvc', 'decode'],
  ['vocab', 'read'],
  ['sentence', 'read'],
];

/**
 * The 30 symbol keys of the F-QUEST-002 accounting: 14 consonants, 10 vowels,
 * 6 finals. A final is `'<consonant>/final'`.
 */
export const RUNG_SYMBOLS = {
  basic: ['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ', 'ㅗ', 'ㅜ', 'ㅁ', 'ㅇ', 'ㅡ', 'ㅣ', 'ㄷ', 'ㄹ'],
  rest: ['ㅈ', 'ㅊ', 'ㅂ', 'ㅅ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', 'ㅑ', 'ㅕ', 'ㅛ', 'ㅠ'],
  finals: ['ㄴ/final', 'ㄹ/final', 'ㅇ/final', 'ㄱ/final', 'ㅁ/final', 'ㅂ/final'],
} as const;

/** Every rung is three questions, except `sentence` (see `SENTENCE_QUESTIONS`). */
export const QUESTIONS_PER_RUNG = 3;

/**
 * The one switch of the sentence gate (AMENDMENTS-PLC-VALIDITY section 3.6): how many
 * questions a `sentence` rung asks, in both forms. 3 in PV-1b, so the engine asks what
 * it asked before; PV-1c turns it to 4 (pass at 3 of 4) in the same change that lands
 * the sentence bank. Everything below that depends on it is derived from it.
 */
export const SENTENCE_QUESTIONS: number = 3;

/**
 * Questions in a rung of `gate`. `sentenceQuestions` is the switch and defaults to it;
 * a test may pass another value to exercise the derived rules at the next size.
 */
export const questionsFor = (gate: PlacementGate, sentenceQuestions: number = SENTENCE_QUESTIONS): number =>
  gate === 'sentence' ? sentenceQuestions : QUESTIONS_PER_RUNG;

/** The session inactivity pause: nothing touched for this long (unless Take my time). It records nothing. */
export const IDLE_PAUSE_MS = 45_000;

/**
 * The three check lengths a learner can choose (F-PLC-001 P14). This module is
 * the leaf that owns the tuple: `schemas/placement.ts` imports it for
 * `PlacementModeSchema`, and nothing here imports a value from the schemas.
 */
export const PLACEMENT_MODES = ['short', 'standard', 'deep'] as const;
export type PlacementMode = (typeof PLACEMENT_MODES)[number];

/**
 * The stored `PlacementResult.length` of a mode. `length` keeps its two legacy
 * values so readers that predate `mode` still parse a result: Short writes
 * `quick` (the same band-1 ceiling), Standard and Deep write `full`.
 */
export const legacyLengthOf = (mode: PlacementMode): 'quick' | 'full' => (mode === 'short' ? 'quick' : 'full');

/**
 * The mode of a stored result. `mode` is optional (legacy results, or a copy
 * that passed through a reader that strips unknown keys); without it, `quick`
 * reads as Short (same ceiling) and `full` as Standard.
 */
export const modeOf = (result: Pick<PlacementResult, 'length'> & { mode?: PlacementMode }): PlacementMode =>
  result.mode ?? (result.length === 'quick' ? 'short' : 'standard');

/** The highest level a mode can place at: Short stops after `syl-cv`. */
export const modeCeiling = (mode: PlacementMode): PlacementLevel =>
  mode === 'short' ? { stage: 'stage1', band: 1 } : { stage: 'stage3', band: 0 };

/**
 * The most questions a mode can ask; a run that ends there is labelled `cap`.
 * Short has no cap label: every Short run that reaches `syl-cv` ends `complete`.
 * The longest normal paths, derived from the sentence switch: Standard 21 + n
 * (24 at 3, 25 at 4), Deep 33 + 3n (42 at 3, 45 at 4).
 */
export const questionCap = (mode: PlacementMode, sentenceQuestions: number = SENTENCE_QUESTIONS): number | null =>
  mode === 'short' ? null : mode === 'standard' ? 21 + sentenceQuestions : 33 + 3 * sentenceQuestions;

/** Gates whose pass moves the route; Deep confirms each with a second draw of three. */
const CONFIRMED: readonly PlacementGate[] = ['sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc'];

/**
 * Draws of three per rung. Deep: two for every route-moving rung (the four
 * decoding gates above `recog` and both read forms). Standard: two for `vocab`
 * read only, because its pass places out every Stage 1 quest. Short: one.
 */
export const drawsFor = (mode: PlacementMode, gate: PlacementGate, form: PlacementForm): 1 | 2 => {
  if (mode === 'deep') return CONFIRMED.includes(gate) || form === 'read' ? 2 : 1;
  return mode === 'standard' && gate === 'vocab' && form === 'read' ? 2 : 1;
};

/**
 * Correct answers a draw needs. Short asks all three CV syllables right; a `sentence`
 * rung passes at one fewer than its size (2 of 3, 3 of 4); every other rung 2 of 3.
 * `size` is the size of the rung actually asked (a run saved under another switch
 * keeps the size of its own questions); it defaults to the switch.
 */
export const passAtFor = (mode: PlacementMode, gate: PlacementGate, size: number = questionsFor(gate)): 2 | 3 => {
  if (mode === 'short' && gate === 'syl-cv') return 3;
  return gate === 'sentence' ? (Math.min(3, Math.max(2, size - 1)) as 2 | 3) : 2;
};

/**
 * Formats a listen-first run may draw (Short, and any mode for a *Pictures
 * first* learner): one tap, and nothing to read in Latin letters. Left out:
 * `see-pick-sound` (its answers are Latin sound chips) and `build-syllable`
 * (several taps).
 */
export const LISTEN_FIRST_FORMATS: readonly (typeof ASSESSMENT_FORMATS)[number][] = [
  'shape-odd-one-out',
  'hear-pick-written',
  'hear-pick-picture',
  'read-pick-picture',
  'reply-pick',
];

/** Deep offers one spoken rest card when this many questions are done and more remain. */
export const DEEP_REST_AT = 18;

/**
 * The one backstop clock of a run (D3): Standard 10 minutes, Deep 20 minutes;
 * none for Short (its nine questions bound it) and none with Take my time. It
 * is never shown, never marks a question wrong and stops while a sheet is open.
 */
export const backstopMs = (mode: PlacementMode, takeMyTime: boolean): number | null =>
  takeMyTime || mode === 'short' ? null : mode === 'standard' ? 600_000 : 1_200_000;
