import { newestPracticeDays, type PracticeDaysEntry, type Weekday } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import type { DeriveSource } from '../homework/plan-derivation';
import { isClassKind } from './layer';

/**
 * The learner's own practice days (AMENDMENTS-ROUTE-CLASS-BLEND sections 9.4 and 13, row BL-8, BL-OD-7;
 * design/wireframes/journey/route-class-blend.md B7). Pure and small: it rides the start bundle with Profile and the
 * derivation. The re-dating itself (`placePractice`, the content-schema `blend` subpath) lives in the practice-days
 * chunk and is handed in through `setPracticePlacer` once that chunk is in, so the start bundle does not grow by it.
 * A learner (or a grown-up, for a child) moves the days and their count; the lessons never change, and the console
 * never sees the days.
 */

/** Chip order: Sunday first, as the app's weekday control (`RouteSetupScreen`) and the BL-D mock. */
export const CHIP_DAYS: readonly Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Week order from Monday: the order a learner day list is stored and read in. */
const WEEK: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const byWeek = (days: Iterable<Weekday>): Weekday[] => {
  const set = new Set(days);
  return WEEK.filter((day) => set.has(day));
};

/**
 * The days after picking a count (B7): the chosen days stay; a higher count adds days from the class's default order
 * first, then the remaining weekdays (non-class days before class days); a lower count drops from the end of that
 * order. So the class's own days are the ones kept longest.
 */
export function daysForCount(current: readonly Weekday[], count: number, defaults: readonly Weekday[], classDays: readonly Weekday[]): Weekday[] {
  if (!Number.isInteger(count) || count < 1 || count > 7) throw new RangeError('practice days: 1 to 7 a week');
  const rest = WEEK.filter((day) => !defaults.includes(day));
  const order = [...defaults, ...rest.filter((day) => !classDays.includes(day)), ...rest.filter((day) => classDays.includes(day))];
  const chosen = order.filter((day) => current.includes(day));
  if (chosen.length >= count) return byWeek(chosen.slice(0, count));
  return byWeek([...chosen, ...order.filter((day) => !chosen.includes(day)).slice(0, count - chosen.length)]);
}

/** The days after a weekday chip (B7): on or off; the last chosen day stays on (1 to 7 days). Picking days sets the count. */
export function toggleDay(current: readonly Weekday[], day: Weekday): Weekday[] {
  if (current.includes(day)) return current.length === 1 ? byWeek(current) : byWeek(current.filter((d) => d !== day));
  return byWeek([...current, day]);
}

/**
 * `snapshot.practiceDays` after a change (section 9.4): this plan's entry replaced (newest `updatedAt` wins), and the
 * entries of plans the learner no longer has dropped, so the days go with their plan; at most 3, the newest.
 */
export function practiceDaysWrite(existing: readonly PracticeDaysEntry[] | undefined, next: PracticeDaysEntry, livePlanIds: readonly string[]): PracticeDaysEntry[] {
  const kept = (existing ?? []).filter((entry) => entry.planId !== next.planId && livePlanIds.includes(entry.planId));
  return newestPracticeDays([...kept, { ...next, days: byWeek(next.days) }]);
}

/** The learner's days for a plan, or undefined when they never moved them. */
export function learnerDaysOf(entries: readonly PracticeDaysEntry[] | undefined, planId: string): Weekday[] | undefined {
  const days = entries?.find((entry) => entry.planId === planId)?.days;
  return days === undefined || days.length === 0 ? undefined : [...days];
}

/** Who changed the days (section 18): the learner on a self profile, else a grown-up behind the gate. */
export type ChangedBy = 'self' | 'grownup';

/** `route.practice_days_changed { days, by }` (section 18, TELEMETRY-NAMES-2 section T): the count only, no weekday or id. */
export function practiceDaysChangedEvent(days: readonly Weekday[], by: ChangedBy): TelemetryEvent {
  return { name: 'route.practice_days_changed', payload: { days: days.length, by } };
}

/**
 * Re-dates one blended class plan to the learner's days from `from` on (the chunk's `placeSourceForLearner`): `from`
 * is the day the days took effect (`placementFrom`), so the dates it gives never move as the days pass.
 */
export type PracticePlacer = (source: DeriveSource, days: readonly Weekday[], from: string) => DeriveSource;

let placer: PracticePlacer | null = null;
const placerListeners = new Set<() => void>();

/** Hands in the chunk's placer (or takes it away, in tests), and tells every view that reads it (`subscribePlacer`). */
export function setPracticePlacer(next: PracticePlacer | null): void {
  placer = next;
  placerListeners.forEach((listener) => listener());
}

/**
 * Called when the placer comes in or goes: a view that re-dates with `withLearnerDays` (Home's Refresh) recomputes
 * then, even when the derivation that follows changes no homework and so writes no new snapshot.
 */
export function subscribePlacer(listener: () => void): () => void {
  placerListeners.add(listener);
  return () => void placerListeners.delete(listener);
}

/** Whether the placer is in (the chunk has loaded). */
export const practicePlacerReady = (): boolean => placer !== null;

/** A blended class or school plan the learner moved days for: the ones `withLearnerDays` re-dates. */
export function needsPlacer(sources: readonly DeriveSource[], entries: readonly PracticeDaysEntry[] | undefined): boolean {
  return sources.some((source) => isClassKind(source.kind) && source.meta?.params.blend !== undefined && learnerDaysOf(entries, source.id) !== undefined);
}

/**
 * The sources with every blended class plan the learner moved days for re-dated to those days (section 9.4,
 * `placePractice`). Until the placer is in, the plans keep their dates: a plan date is always a valid date.
 */
export function withLearnerDays(sources: readonly DeriveSource[], entries: readonly PracticeDaysEntry[] | undefined, today: string): DeriveSource[] {
  const place = placer;
  if (place === null || entries === undefined || entries.length === 0) return [...sources];
  return sources.map((source) => {
    if (!isClassKind(source.kind) || source.meta?.params.blend === undefined) return source;
    const entry = entries.find((e) => e.planId === source.id);
    if (entry === undefined || entry.days.length === 0) return source;
    return place(source, [...entry.days], placementFrom(entry, today));
  });
}

/**
 * The first day `placePractice` may re-date (section 9.4): the day the learner's days were saved (`updatedAt`, as the
 * derivation's `today` counts days), not today, so a lesson moved to a learner day stays there as the days pass and
 * never drifts back to its plan date. An entry stamped later than today (a device clock ahead) counts from today.
 */
export function placementFrom(entry: Pick<PracticeDaysEntry, 'updatedAt'>, today: string): string {
  const time = Date.parse(entry.updatedAt);
  if (!Number.isFinite(time)) return today;
  const saved = new Date(time).toISOString().slice(0, 10);
  return saved < today ? saved : today;
}
