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
import { QUESTIONS_PER_RUNG, STRAND_GATES } from './rungs';

/**
 * Scoring (F-PLC-001 section 3.6). Nothing here is shown as a miss: "not sure",
 * wrong and assisted answers are simply "not correct", and time never counts.
 */

export type GateOutcome = Pick<GateResult, 'asked' | 'correct' | 'assisted' | 'result'>;

/**
 * Pass on two unassisted correct answers; fail once two can no longer be
 * reached (three asked, or earlier when the rest cannot help); otherwise
 * not-run (undecided). `asked` defaults to the number of responses.
 */
export const gateResult = (
  responses: readonly AssessmentResponse[],
  asked: number = responses.length,
): GateOutcome => {
  const correct = responses.filter((r) => r.outcome === 'correct' && !r.assisted).length;
  const assisted = responses.filter((r) => r.assisted).length;
  const result = correct >= 2 ? 'pass' : correct + (QUESTIONS_PER_RUNG - asked) < 2 ? 'fail' : 'not-run';
  return { asked, correct, assisted, result };
};

const ran = (entries: readonly GateResult[]): boolean => entries.some((e) => e.result !== 'not-run');
const passed = (entries: readonly GateResult[]): boolean => entries.some((e) => e.result === 'pass');

/**
 * One status per strand. A strand's gates may have two entries (vocabulary and
 * sentences: read and oral); the best one counts.
 */
export const strandStatuses = (gates: readonly GateResult[]): Record<PlacementStrand, StrandStatus> => {
  const status = (strand: PlacementStrand): StrandStatus => {
    const perGate = STRAND_GATES[strand].map((g) => gates.filter((e) => e.gate === g));
    if (!perGate.some(ran)) return 'not-tested';
    if (perGate.every(passed)) return 'secure';
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
): boolean => gates.some((e) => e.gate === gate && e.form === form && e.result === 'pass');

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
 * passed too, else stage1; null when no oral rung ran. Reported and used by the
 * planner; it never lowers or raises the route.
 */
export const oralStageOf = (gates: readonly GateResult[]): StageKey | null => {
  if (!gates.some((e) => e.form === 'oral' && e.result !== 'not-run')) return null;
  if (!gatePassed(gates, 'vocab', 'oral')) return 'stage1';
  return gatePassed(gates, 'sentence', 'oral') ? 'stage3' : 'stage2';
};
