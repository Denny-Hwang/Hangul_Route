import {
  PACES,
  addDays,
  regenerateFrom,
  sessionsPerWeekOf,
  toMeta,
  toPlanItems,
  type Catalog,
  type DateKey,
  type HomeworkAssignment,
  type PaceId,
  type PlanItem,
  type SelfRoute,
} from '@hangul-route/content-schema';
import { PACE_IDS } from './proposal-flow';

/**
 * Re-pacing the learner's own weekly plan (F-PLAN-002 section 3.7) and the Hoya check-in
 * (FP-B14, OD-13). Nothing is ever flagged as late: a re-pace moves unfinished items forward
 * quietly, and the check-in offers a lighter or a faster pace in positive words. Pure; the route
 * store passes the clock, the snapshot and the catalogue.
 */

/** Automatic re-pace: three or more pending past-dated plan items ... */
export const AUTO_REPACE_PENDING = 3;
/** ... or the oldest one at least this many days old. */
export const AUTO_REPACE_OLDEST_DAYS = 7;

/** Pending plan homework of this route dated before today. */
export function pendingPastOf(route: Pick<SelfRoute, 'id'>, homework: readonly HomeworkAssignment[], today: DateKey): HomeworkAssignment[] {
  return homework.filter((h) => !h.completedAt && h.id.startsWith(`${route.id}#`) && h.targetDate < today);
}

export interface AutoRepaceInput {
  route: SelfRoute | null;
  homework: readonly HomeworkAssignment[];
  today: DateKey;
  /** A quest (or any session) is open for this learner: never re-pace under them. */
  sessionOpen: boolean;
}

/**
 * At most once per UTC day (a re-pace of either kind today counts), never while a session is
 * open, and only when three or more past-dated items wait or the oldest is a week old.
 */
export function autoRepaceDue(i: AutoRepaceInput): boolean {
  const route = i.route;
  if (route === null || route.archivedAt !== null || i.sessionOpen) return false;
  if (route.meta.repacedAt !== null && route.meta.repacedAt.slice(0, 10) === i.today) return false;
  const pending = pendingPastOf(route, i.homework, i.today);
  if (pending.length >= AUTO_REPACE_PENDING) return true;
  const oldest = pending.reduce<string | null>((min, h) => (min === null || h.targetDate < min ? h.targetDate : min), null);
  return oldest !== null && oldest <= addDays(i.today, -AUTO_REPACE_OLDEST_DAYS);
}

function withDraft(route: SelfRoute, draft: ReturnType<typeof regenerateFrom>, nowIso: string): SelfRoute {
  const items: PlanItem[] = toPlanItems(draft);
  return { ...route, updatedAt: nowIso, meta: { ...toMeta(draft), repacedAt: nowIso }, items };
}

/**
 * "Move my plan along" and the automatic re-pace: `regenerateFrom(..., 'requeue')` with the
 * learner's completions, so unfinished past items return to the front and the rest is laid out
 * again from today; the plan keeps its id, start and end.
 */
export function repaceSelfRoute(route: SelfRoute, completedQuestIds: readonly string[], today: DateKey, catalog: Catalog, nowIso: string): SelfRoute {
  const draft = regenerateFrom(route, today, catalog, { mode: 'requeue', completedQuestIds: [...completedQuestIds] });
  return withDraft(route, draft, nowIso);
}

/** `route.repaced` (section 3.11): how it ran and how many past items were waiting; counts only. */
export function repacedEvent(
  profileId: string,
  mode: 'auto' | 'manual',
  pending: number,
): { name: 'route.repaced'; profileId: string; payload: { mode: 'auto' | 'manual'; pending: number } } {
  return { name: 'route.repaced', profileId, payload: { mode, pending } };
}

/** The Hoya check-in opens at the start of this week of an active plan (OD-13: after week 4). */
export const CHECK_IN_WEEK = 5;

export type CheckInOffer = { kind: 'lighter'; pace: PaceId } | { kind: 'faster'; pace: PaceId };

export interface CheckInInput {
  route: SelfRoute | null;
  completedQuestIds: readonly string[];
  today: DateKey;
  /** `route-ui:<profileId>.checkInFor`: the plan whose check-in was already answered. */
  answeredFor: string | undefined;
}

/**
 * Once, in week 5 of an active plan (FP-B14): from the sessions of weeks 1 to 4 that were
 * actually finished, fewer than half offers a lighter week (Gentle) and every one offers a bit
 * faster (one step up). Nothing in between, nothing past Brisk or below Gentle, and nothing for a
 * plan off the chips. A coming-soon placeholder is not a session anyone can finish, so it does
 * not count. It never names a session that was not done.
 */
export function checkInOffer(i: CheckInInput): CheckInOffer | null {
  const route = i.route;
  if (route === null || route.archivedAt !== null || i.answeredFor === route.id) return null;
  const week = route.meta.weeks.find((w) => w.index === CHECK_IN_WEEK);
  if (week === undefined || i.today < week.startDate || i.today >= addDays(week.startDate, 7)) return null;
  const sessions = route.items.filter((item) => item.kind === 'quest' && item.targetDate !== undefined && item.targetDate < week.startDate);
  if (sessions.length === 0) return null;
  const done = new Set(i.completedQuestIds);
  const finished = sessions.filter((item) => done.has(item.id)).length;
  const pace = PACE_IDS.find((id) => PACES[id] === sessionsPerWeekOf(route.meta.params));
  if (pace === undefined) return null;
  if (finished * 2 < sessions.length) return pace === 'gentle' ? null : { kind: 'lighter', pace: 'gentle' };
  if (finished === sessions.length && pace !== 'brisk') return { kind: 'faster', pace: PACE_IDS[PACE_IDS.indexOf(pace) + 1] as PaceId };
  return null;
}

/**
 * Yes on the check-in: the plan's own future items laid on the new pace's sessions from today
 * (`regenerateFrom(..., 'shift')`), its spread days, the same end date; the past stays.
 */
export function applyCheckIn(route: SelfRoute, offer: CheckInOffer, completedQuestIds: readonly string[], today: DateKey, catalog: Catalog, nowIso: string): SelfRoute {
  const { sessionDays: _days, ...params } = route.meta.params;
  const paced = { ...route, meta: { ...route.meta, params: { ...params, sessionsPerWeek: PACES[offer.pace] } } };
  const draft = regenerateFrom(paced, today, catalog, { mode: 'shift', completedQuestIds: [...completedQuestIds] });
  return withDraft(route, draft, nowIso);
}
