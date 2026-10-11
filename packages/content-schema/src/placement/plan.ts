import type { GateResult, PlacementForm, PlacementGate } from '../schemas/placement';
import { drawsFor, type PlacementMode } from './rungs';
import { rowsPassed } from './scoring';

/**
 * Which rung comes next (F-PLC-001 section 3.5). Pure and adaptive: it only
 * decides the next gate from the gates finished so far. A rung the device
 * cannot run (no sound, screen reader, too few templates) is recorded by the
 * caller as `not-run`; the planner treats that as "not passed", never as a fail.
 */

export interface PlanRung {
  gate: PlacementGate;
  form: PlacementForm;
  /** 2 = the confirming second draw (Deep; Standard's `vocab` read). Absent = first draw. */
  draw?: 2;
}

export interface PlanDone {
  gate: PlacementGate;
  form: PlacementForm;
  result: GateResult['result'];
}

export interface PlanState {
  mode: PlacementMode;
  /** Every rung finished so far, in asking order (including rungs recorded as not-run). */
  done: readonly PlanDone[];
}

type Step = readonly [PlacementGate, PlacementForm];

/** The route-moving steps after `recog`, in order: each is asked only while every step before it passed. */
const MAIN: readonly Step[] = [
  ['sound-basic', 'decode'],
  ['syl-cv', 'decode'],
  ['sound-rest', 'decode'],
  ['syl-cvc', 'decode'],
  ['vocab', 'read'],
  ['sentence', 'read'],
];

export const nextRung = (state: PlanState): PlanRung | null => {
  const rows = (gate: PlacementGate, form: PlacementForm): PlanDone[] =>
    state.done.filter((d) => d.gate === gate && d.form === form);
  const has = (gate: PlacementGate, form: PlacementForm): boolean => rows(gate, form).length > 0;
  const passed = (gate: PlacementGate, form: PlacementForm): boolean => rowsPassed(rows(gate, form));
  const ran = (gate: PlacementGate, form: PlacementForm): boolean => rows(gate, form).some((r) => r.result !== 'not-run');
  /** Asked and passed so far: a draw passed and none failed (an unavailable second draw keeps the first pass). */
  const clean = ([gate, form]: Step): boolean => passed(gate, form);
  /** The first draw passed and a second one is planned but not asked yet. */
  const owed = ([gate, form]: Step): boolean => {
    const r = rows(gate, form);
    return r.length === 1 && (r[0] as PlanDone).result === 'pass' && drawsFor(state.mode, gate, form) === 2;
  };
  const first = ([gate, form]: Step): PlanRung => ({ gate, form });
  const second = ([gate, form]: Step): PlanRung => ({ gate, form, draw: 2 });

  // Short: one rung of letter sounds, one of words, then CV syllables if the sounds passed.
  // Nothing past band 1. With no decoding item (sound guide shown) shapes come after the words.
  // With no sound neither sounds nor words can run, and Short asks nothing: it never runs
  // a silent shapes-only check (the app offers sound or Standard instead).
  if (state.mode === 'short') {
    if (!has('sound-basic', 'decode')) return first(['sound-basic', 'decode']);
    if (!has('vocab', 'oral')) return first(['vocab', 'oral']);
    if (!ran('sound-basic', 'decode')) return ran('vocab', 'oral') && !has('recog', 'decode') ? first(['recog', 'decode']) : null;
    return passed('sound-basic', 'decode') && !has('syl-cv', 'decode') ? first(['syl-cv', 'decode']) : null;
  }

  // 1. The entry rung.
  if (!has('recog', 'decode')) return first(['recog', 'decode']);

  // 2. The ladder and the reading rungs. Standard confirms a step at once; Deep asks the
  // confirming draw after the next step's first draw, so one format never runs six in a row.
  const delay = state.mode === 'deep';
  for (let k = 0; k < MAIN.length; k += 1) {
    const step = MAIN[k] as Step;
    const before = MAIN.slice(0, k);
    const previous = MAIN[k - 1];
    if (!has(step[0], step[1])) {
      if (!before.every(clean)) break;
      if (previous !== undefined && !delay && owed(previous)) return second(previous);
      return first(step);
    }
    // `sound-basic` sets no level alone: when `syl-cv` did not pass, confirming it changes nothing.
    const matters = k !== 1 || clean(step);
    if (delay && previous !== undefined && owed(previous) && matters && before.slice(0, -1).every(clean)) return second(previous);
  }
  const lastIndex = MAIN.reduce((at, [gate, form], k) => (has(gate, form) ? k : at), 0);
  const last = MAIN[lastIndex] as Step;
  if (owed(last) && MAIN.slice(0, lastIndex).every(clean)) return second(last);

  // 3. Listening. Deep: everyone; a reader who passed `vocab` read hears sentences only
  // (or words, while no sentence draw is available). Standard: every run that does not read
  // through to `vocab` read, and once after a `vocab` read that did not pass.
  const pending = (gate: PlacementGate): PlanRung | null => (has(gate, 'oral') ? null : first([gate, 'oral']));
  const oralPair = (): PlanRung | null => pending('vocab') ?? pending('sentence');
  const readsWords = clean(['vocab', 'read']);
  if (delay) {
    if (!readsWords) return oralPair();
    if (!has('sentence', 'oral')) return first(['sentence', 'oral']);
    return ran('sentence', 'oral') ? null : pending('vocab');
  }
  if (!passed('syl-cvc', 'decode')) return oralPair();
  return readsWords ? null : pending('vocab');
};
