import type { GateResult, PlacementForm, PlacementGate } from '../schemas/placement';

/**
 * Which rung comes next (F-PLC-001 section 3.5). Pure and adaptive: it only
 * decides the next gate from the gates finished so far. A rung the device
 * cannot run (no sound, screen reader, too few templates) is recorded by the
 * caller as `not-run`; the planner treats that as "not passed", never as a fail.
 */

export interface PlanRung {
  gate: PlacementGate;
  form: PlacementForm;
}

export interface PlanDone extends PlanRung {
  result: GateResult['result'];
}

export interface PlanState {
  length: 'quick' | 'full';
  /** Every rung finished so far, in asking order (including rungs recorded as not-run). */
  done: readonly PlanDone[];
}

/** The decoding ladder after the entry rungs: each one is asked only if the previous one passed. */
const LADDER: readonly PlacementGate[] = ['syl-cv', 'sound-rest', 'syl-cvc'];

export const nextRung = (state: PlanState): PlanRung | null => {
  const has = (gate: PlacementGate, form: PlacementForm): boolean =>
    state.done.some((d) => d.gate === gate && d.form === form);
  const passed = (gate: PlacementGate, form: PlacementForm): boolean =>
    state.done.some((d) => d.gate === gate && d.form === form && d.result === 'pass');
  const rung = (gate: PlacementGate, form: PlacementForm): PlanRung => ({ gate, form });

  // Every run that does not read through to sentences measures listening.
  const oral = (): PlanRung | null => {
    if (!has('vocab', 'oral')) return rung('vocab', 'oral');
    if (!has('sentence', 'oral')) return rung('sentence', 'oral');
    return null;
  };

  // 1. The entry rungs, always.
  if (!has('recog', 'decode')) return rung('recog', 'decode');
  if (!has('sound-basic', 'decode')) return rung('sound-basic', 'decode');

  // 2. The decoding ladder; the first rung that is not passed ends it. Quick ends after syl-cv.
  let previous: PlacementGate = 'sound-basic';
  for (const gate of LADDER) {
    if (!passed(previous, 'decode')) return oral();
    if (!has(gate, 'decode')) return state.length === 'quick' && gate !== 'syl-cv' ? oral() : rung(gate, 'decode');
    previous = gate;
  }
  if (!passed('syl-cvc', 'decode')) return oral();

  // 3. Reading rungs.
  if (!has('vocab', 'read')) return rung('vocab', 'read');
  if (passed('vocab', 'read')) return has('sentence', 'read') ? null : rung('sentence', 'read');
  return has('vocab', 'oral') ? null : rung('vocab', 'oral');
};
