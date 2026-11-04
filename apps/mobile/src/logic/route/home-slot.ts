import type { CheckInOffer } from './repace';

/**
 * Home's one quiet card for the learner's weekly plan (F-PLAN-002 sections 3.7 and 3.9, wireframe
 * console/curriculum-planner.md H as amended by FP-B6): before a plan exists the prompt "Hoya can
 * make a weekly plan for you"; with a plan there is no plan card, only, when it applies, the Hoya
 * check-in of week 5 (FP-B14) or the calm line "Hoya moved your plan along" once after an
 * automatic re-pace. The level check still wins the slot while it is eligible (AM-6). Pure.
 */

/** The calm line shows after an automatic re-pace until it has been seen once. */
export function movedLineVisible(ui: { movedAt?: string; movedSeenAt?: string }): boolean {
  if (ui.movedAt === undefined) return false;
  return ui.movedSeenAt === undefined || ui.movedSeenAt < ui.movedAt;
}

export type PlanSlot = { kind: 'prompt' } | { kind: 'instead' } | { kind: 'check-in'; offer: CheckInOffer } | { kind: 'back' } | { kind: 'moved' };

/**
 * The card the slot holds: the prompt (no plan yet), else, while a class plan with practice days leaves the proposal
 * out, its line instead (`instead`, AMENDMENTS-ROUTE-CLASS-BLEND section 8, row BL-7), else the check-in, else the
 * one-time "Your own weekly plan is back." (`back`), else the moved line, else none.
 */
export function planSlotOf(i: { prompt: boolean; instead?: boolean; offer: CheckInOffer | null; back?: boolean; moved: boolean }): PlanSlot | null {
  if (i.prompt) return { kind: 'prompt' };
  if (i.instead === true) return { kind: 'instead' };
  if (i.offer !== null) return { kind: 'check-in', offer: i.offer };
  if (i.back === true) return { kind: 'back' };
  return i.moved ? { kind: 'moved' } : null;
}
