import { SelfRouteSchema, addDays, toMeta, toPlanItems, type CurriculumDraft, type DateKey, type SelfRoute } from '@hangul-route/content-schema';
import type { WeekRow } from './proposal-flow';

/**
 * The learner's own weekly plan as it is stored in the progress snapshot (F-PLAN-002
 * section 3.5, `selfRoute`): it rides sync, the backup file and Rescue Code restore, with no
 * storage key of its own. Pure; the route store passes the clock.
 */

const ID_SUFFIX_SPACE = 36 ** 4;

/** `route:<time in base 36>-<four random base-36 characters>`, inside the schema's `[a-z0-9-]`. */
export function newSelfRouteId(nowMs: number, random: () => number = Math.random): string {
  const suffix = Math.min(ID_SUFFIX_SPACE - 1, Math.floor(random() * ID_SUFFIX_SPACE));
  return `route:${Math.max(0, Math.floor(nowMs)).toString(36)}-${suffix.toString(36).padStart(4, '0')}`;
}

/** A new active route from a draft: the meta never holds the learner's completions (`toMeta`). */
export function selfRouteOf(draft: CurriculumDraft, id: string, nowIso: string): SelfRoute {
  return SelfRouteSchema.parse({
    id,
    createdAt: nowIso,
    updatedAt: nowIso,
    archivedAt: null,
    meta: toMeta(draft),
    items: toPlanItems(draft),
  });
}

/** Stopping a plan archives it; it is never set to null, so an older copy cannot bring it back. */
export function archivedRoute(route: SelfRoute, nowIso: string): SelfRoute {
  return { ...route, archivedAt: nowIso, updatedAt: nowIso };
}

/** The snapshot's route while it is active; null when there is none or it was stopped. */
export function activeSelfRoute(snapshot: { selfRoute?: SelfRoute | null } | undefined): SelfRoute | null {
  const route = snapshot?.selfRoute ?? null;
  return route !== null && route.archivedAt === null ? route : null;
}

/** The items of the plan week that holds `today`, by date; empty before the plan starts or after it ends. */
export function thisWeekRows(route: Pick<SelfRoute, 'meta' | 'items'>, today: DateKey): WeekRow[] {
  const week = route.meta.weeks.find((w) => w.startDate <= today && today < addDays(w.startDate, 7));
  if (week === undefined) return [];
  const end = addDays(week.startDate, 7);
  return route.items
    .filter((item): item is typeof item & { targetDate: string } => item.targetDate !== undefined && item.targetDate >= week.startDate && item.targetDate < end)
    .map((item) => ({ date: item.targetDate, kind: item.kind, id: item.id }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
