import { addDays, weekdayOf, type CurriculumMeta, type SelfRoute } from '@hangul-route/content-schema';
import type { DeriveSource } from '../homework/plan-derivation';

/**
 * The three layers of a learner's Learning Route (AMENDMENTS-ROUTE-CLASS-BLEND section 3.2, row BL-6). Pure: the
 * stores pass the sources and the plan day (the UTC day of F-PLAN-002 section 3.6). The layer decides whether the
 * learner's own weekly plan rests (section 8), which weekly-goal rule applies (section 6.1) and whether the Refresh
 * step shows (section 7); derivation, precedence and `routeNext` run on the sources as before.
 *
 * - `class-with-practice`: a class plan with class days and practice days (`meta.params.blend`) whose route holds today;
 * - `class-only`: else, a class or school curriculum is in force today;
 * - `solo`: else.
 */
export type Layer = 'solo' | 'class-only' | 'class-with-practice';

type MetaSource = Pick<DeriveSource, 'kind' | 'meta'>;

/** A class or a school space: the plans whose lessons an own or a family plan never repeats (section 8). */
export const isClassKind = (kind: DeriveSource['kind']): boolean => kind === 'class' || kind === 'school';

/** The last day of the curriculum's weeks, or null with none. */
function lastWeekDay(meta: CurriculumMeta): string | null {
  const last = meta.weeks[meta.weeks.length - 1];
  return last === undefined ? null : addDays(last.startDate, 6);
}

/**
 * The days a blended plan's route covers (section 6.3): from the first class day on or after the start date to the
 * end of the last class's whole cycle (`weeks` cycles of the first class weekday), or to the end of the plan's last
 * week when that is later (a route kept at its average, section 6.1). Null for a plan without class days.
 */
export function blendSpanOf(meta: CurriculumMeta): { from: string; to: string } | null {
  const blend = meta.params.blend;
  if (blend === undefined || blend.lecture.days.length === 0) return null;
  let from = meta.params.startDate;
  // Seven days always meet a class weekday.
  for (let step = 0; step < 7 && !blend.lecture.days.includes(weekdayOf(from)); step += 1) from = addDays(from, 1);
  const cyclesEnd = addDays(from, 7 * meta.params.weeks - 1);
  const weeksEnd = lastWeekDay(meta);
  return { from, to: weeksEnd !== null && weeksEnd > cyclesEnd ? weeksEnd : cyclesEnd };
}

/**
 * A curriculum is in force on `today` when one of its weeks holds the day (F-PLAN-002, `planDaysInForce`), or, for
 * a blended plan, when its route does (its class cycles may run past the last week, section 6.3).
 */
export function curriculumInForce(meta: CurriculumMeta | null | undefined, today: string): boolean {
  if (meta === null || meta === undefined) return false;
  if (meta.weeks.some((w) => w.startDate <= today && today <= addDays(w.startDate, 6))) return true;
  const span = blendSpanOf(meta);
  return span !== null && span.from <= today && today <= span.to;
}

/** A class plan with practice days whose route holds today (section 3.2). */
export function blendInForce(source: MetaSource, today: string): boolean {
  if (source.kind !== 'class' || source.meta === null || source.meta === undefined) return false;
  const span = blendSpanOf(source.meta);
  return span !== null && span.from <= today && today <= span.to;
}

/** `layerOf(sources, today)` (section 3.2). */
export function layerOf(sources: readonly MetaSource[], today: string): Layer {
  if (sources.some((s) => blendInForce(s, today))) return 'class-with-practice';
  if (sources.some((s) => isClassKind(s.kind) && curriculumInForce(s.meta, today))) return 'class-only';
  return 'solo';
}

/**
 * The blended plan that leads the Route line, `routeNext` and Refresh (section 12.2): with two in force, the newest
 * (`assignedAt`, the plan's publish time). Null outside the class-with-practice layer.
 */
export function leadingBlended<S extends Pick<DeriveSource, 'kind' | 'meta' | 'assignedAt'>>(sources: readonly S[], today: string): S | null {
  let lead: S | null = null;
  for (const source of sources) {
    if (!blendInForce(source, today)) continue;
    if (lead === null || source.assignedAt > lead.assignedAt) lead = source;
  }
  return lead;
}

/**
 * A new own weekly plan made while the layer is class-with-practice starts the day after the class plans' last day
 * (section 8: "it starts the day after the class plan's last day"), so it never begins resting; the latest route end
 * of every class plan with practice days in force. Undefined in the other layers (the plan starts as before).
 */
export function ownPlanStartAfterClass(sources: readonly MetaSource[], today: string): string | undefined {
  let end: string | undefined;
  for (const source of sources) {
    if (!blendInForce(source, today) || source.meta === null || source.meta === undefined) continue;
    const span = blendSpanOf(source.meta);
    if (span !== null && (end === undefined || span.to > end)) end = span.to;
  }
  return end === undefined ? undefined : addDays(end, 1);
}

/** The proposal for a new own weekly plan is offered on Home in every layer but class-with-practice (section 8). */
export const ownPlanProposalOffered = (layer: Layer): boolean => layer !== 'class-with-practice';

/**
 * The own plan's rest and resume (section 8, BL-OD-5), one step per check:
 * - `rest`: the active own plan is resting now (the device remembers which plan it saw resting);
 * - `resume`: the plan it saw resting is back: re-pace it once (`repaceSelfRoute`, requeue) and show "Your own
 *   weekly plan is back." once;
 * - `none`: nothing to do.
 * Resting itself is never stored: it is the pure `selfRouteResting` check.
 */
export type OwnPlanRestStep = 'rest' | 'resume' | 'none';

export function ownPlanRestStep(i: { route: SelfRoute | null; resting: boolean; restingFor: string | undefined }): OwnPlanRestStep {
  if (i.route === null || i.route.archivedAt !== null) return 'none';
  if (i.resting) return 'rest';
  return i.restingFor === i.route.id ? 'resume' : 'none';
}

/** The one-time "own plan back" line (BL-OD-5): shows after a resume until it is seen. */
export function ownPlanBackShows(ui: { backAt?: string | undefined; backSeenAt?: string | undefined }): boolean {
  return ui.backAt !== undefined && (ui.backSeenAt === undefined || ui.backSeenAt < ui.backAt);
}
