import type { AssessmentResponse } from '../assessment/question';
import type { StageKey } from '../schemas/heritage-card';
import type {
  GateResult,
  PlacementForm,
  PlacementGate,
  PlacementLevel,
  PlacementStrand,
  StrandStatus,
} from '../schemas/placement';
import { MAIN_STEPS, QUESTIONS_PER_RUNG, STRAND_GATES } from './rungs';

/**
 * Scoring (F-PLC-001 section 3.6). Nothing here is shown as a miss: "not sure",
 * wrong and assisted answers are simply "not correct", and time never counts.
 */

export type GateOutcome = Pick<GateResult, 'asked' | 'correct' | 'assisted' | 'result'>;

/**
 * Pass on `passAt` (2, or 3 for Short's `syl-cv`) unassisted correct answers;
 * fail once that can no longer be reached (three asked, or earlier when the
 * rest cannot help); otherwise not-run (undecided). `asked` defaults to the
 * number of responses. The stored `result` is authoritative: consumers never
 * recompute it from `correct`, because the bar depends on the mode.
 *
 * A prompt that could not play (`noSound`, section 3.11) is not asked: it is
 * left out of `asked` and `correct`, and it counts as one that could still
 * have been right, so it never turns a rung into a fail. A rung it leaves
 * undecided stays not-run.
 */
export const gateResult = (
  responses: readonly AssessmentResponse[],
  asked: number = responses.length,
  passAt: 2 | 3 = 2,
): GateOutcome => {
  const heard = responses.filter((r) => r.noSound !== true);
  const scoredAsked = asked - (responses.length - heard.length);
  const correct = heard.filter((r) => r.outcome === 'correct' && !r.assisted).length;
  const assisted = heard.filter((r) => r.assisted).length;
  const result = correct >= passAt ? 'pass' : correct + (QUESTIONS_PER_RUNG - scoredAsked) < passAt ? 'fail' : 'not-run';
  return { asked: scoredAsked, correct, assisted, result };
};

/**
 * The rows of one gate/form passed: at least one passed and none failed. A
 * Deep rung (and Standard's `vocab` read) has two rows, one per draw; every
 * other rung has one, where this is the plain "pass". A not-run second draw
 * (unavailable, or stopped mid-draw) never turns a pass into a fail.
 */
export const rowsPassed = (rows: readonly Pick<GateResult, 'result'>[]): boolean =>
  rows.some((r) => r.result === 'pass') && !rows.some((r) => r.result === 'fail');

/**
 * One pure predicate for "this step passed" (F-PLC-001 sections 3.5 and 3.6, AM-28). A Deep
 * run asks a confirming draw after the next step's first draw, so a row can pass and still lie
 * beyond the end of the ladder once an earlier confirmation fails. That row is stored as it was
 * answered but counts as not passed: `rowsPassed` for the gate and form **and** for every main
 * step before it (only for the `decode` and `read` ladder steps; `recog` and the oral forms have
 * no predecessor). In Short and Standard a step is asked only after every earlier one passed,
 * so this equals `gatePassed` there.
 */
export const stepPassed = (
  gates: readonly Pick<GateResult, 'gate' | 'form' | 'result'>[],
  gate: PlacementGate,
  form: PlacementForm,
): boolean => {
  const own = (g: PlacementGate, f: PlacementForm): boolean => rowsPassed(gates.filter((e) => e.gate === g && e.form === f));
  if (!own(gate, form)) return false;
  const at = MAIN_STEPS.findIndex(([g, f]) => g === gate && f === form);
  return MAIN_STEPS.slice(0, Math.max(at, 0)).every(([g, f]) => own(g, f));
};

const ran = (entries: readonly GateResult[]): boolean => entries.some((e) => e.result !== 'not-run');
/** The best form counts (vocabulary and sentences have read and oral). */
const passed = (gates: readonly GateResult[], gate: PlacementGate): boolean =>
  (['decode', 'read', 'oral'] as const).some((form) => stepPassed(gates, gate, form));

/**
 * One status per strand. A strand's gates may have two entries (vocabulary and
 * sentences: read and oral); the best one counts.
 */
export const strandStatuses = (gates: readonly GateResult[]): Record<PlacementStrand, StrandStatus> => {
  const status = (strand: PlacementStrand): StrandStatus => {
    const perGate = STRAND_GATES[strand].map((g) => gates.filter((e) => e.gate === g));
    if (!perGate.some(ran)) return 'not-tested';
    if (STRAND_GATES[strand].every((g) => passed(gates, g))) return 'secure';
    const correct = perGate.reduce((n, entries) => n + entries.reduce((m, e) => m + e.correct, 0), 0);
    return correct > 0 ? 'getting-there' : 'not-yet';
  };
  return {
    'hangul-recognition': status('hangul-recognition'),
    'sound-letter': status('sound-letter'),
    'syllable-reading': status('syllable-reading'),
    vocabulary: status('vocabulary'),
    sentences: status('sentences'),
  };
};

export const gatePassed = (
  gates: readonly GateResult[],
  gate: PlacementGate,
  form: PlacementForm,
): boolean => rowsPassed(gates.filter((e) => e.gate === gate && e.form === form));

/**
 * The decoding level on the 7-stage grid: what the learner can read. With no
 * decoding evidence it is the conservative stage1 band 0 (a route default,
 * never a claim about the learner). Stage 4 and above are not measured.
 */
export const levelOf = (gates: readonly GateResult[]): PlacementLevel => {
  const at = (stage: StageKey, band: 0 | 1 | 2 | 3): PlacementLevel => ({ stage, band });
  if (!gatePassed(gates, 'sound-basic', 'decode') || !gatePassed(gates, 'syl-cv', 'decode')) return at('stage1', 0);
  if (!gatePassed(gates, 'sound-rest', 'decode')) return at('stage1', 1);
  if (!gatePassed(gates, 'syl-cvc', 'decode')) return at('stage1', 2);
  if (!gatePassed(gates, 'vocab', 'read')) return at('stage1', 3);
  if (!gatePassed(gates, 'sentence', 'read')) return at('stage2', 0);
  return at('stage3', 0);
};

/**
 * The listening level: stage2 when vocab oral passed, stage3 when sentence oral
 * passed too, else stage1; null when no oral rung ran. A Deep reader who passed
 * `vocab` read is asked only `sentence` oral: with no `vocab` oral row, the
 * read pass stands in for it. Reported and used by the planner; it never
 * lowers or raises the route.
 */
export const oralStageOf = (gates: readonly GateResult[]): StageKey | null => {
  if (!gates.some((e) => e.form === 'oral' && e.result !== 'not-run')) return null;
  const vocabOralAsked = gates.some((e) => e.gate === 'vocab' && e.form === 'oral' && e.result !== 'not-run');
  const vocabHeard = vocabOralAsked ? stepPassed(gates, 'vocab', 'oral') : stepPassed(gates, 'vocab', 'read');
  if (!vocabHeard) return 'stage1';
  return stepPassed(gates, 'sentence', 'oral') ? 'stage3' : 'stage2';
};
