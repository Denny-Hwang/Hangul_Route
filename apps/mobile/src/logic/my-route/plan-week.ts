import { addDays, type DateKey, type GoalSource, type RouteGoal } from '@hangul-route/content-schema';

/**
 * The weekly plan line under the route card (F-ROUTE-001 section 3.9 as
 * amended by the Learning Route amendment section 4.3, LR-5a): the week of the
 * plan that sets the goal, "Week 3 of your weekly plan". It never names a next
 * quest: the card owns Next. Pure.
 *
 * The plan is the goal's own source (the leading live curriculum, section 4.1),
 * so the week and the goal always come from the same plan. Null for the default
 * goal, for a plan that has no week holding `today` (before it starts), and for
 * a source that is not in the list.
 */
export function planWeekOf(goal: Pick<RouteGoal, 'sourceId'> | null, sources: readonly GoalSource[], today: DateKey): number | null {
  if (goal === null || goal.sourceId === null) return null;
  const meta = sources.find((s) => s.id === goal.sourceId)?.meta;
  if (meta === undefined || meta === null) return null;
  const week = meta.weeks.find((w) => w.startDate <= today && today <= addDays(w.startDate, 6));
  return week === undefined ? null : week.index;
}
