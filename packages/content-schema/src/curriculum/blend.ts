import type { StageKey } from '../schemas/heritage-card';
import { WEEKDAYS, addDays, isDateKey, weekdayOf, type Weekday } from './dates';

/**
 * Class days with practice days: the calendar and packing primitives of AMENDMENTS-ROUTE-CLASS-BLEND sections 6.2
 * and 6.3 (row BL-1). Pure and bundled, so the console preview and every device rule run offline (section 9.5). The
 * blended generator path (BL-2) builds on these; nothing here changes `generateCurriculum`. Imported from the
 * `@hangul-route/content-schema/blend` subpath, not the package index, so the start bundle does not grow until a
 * caller needs it (it ships in whichever bundle imports it, offline like the rest).
 */

/** Minutes of the review quiz `fillToLength` adds to a lecture deck (BL-OD-2). */
export const CLASS_REVIEW_MINUTES = 4;
/** A lesson of catalogue minutes `m` takes `CLASS_PACE x m` minutes in class (BL-OD-15). */
export const CLASS_PACE = 1.5;
/** A practice day with at least this much room left (or no lesson) gets a Refresh (section 6.4). */
export const REFRESH_MIN_ROOM = 3;

/** Upper bound on `cyclesOf` weeks: well above the params bound (52) plus weeks added for days off, so a bad input fails fast. */
export const MAX_ROUTE_WEEKS = 260;

function checkAmount(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name}: a finite number from 0`);
}

/** `B_L = T_L - 4`: the class day's lesson minutes, at class pace, for a class of `classMinutes` (BL-OD-2). */
export function classBudget(classMinutes: number): number {
  return classMinutes - CLASS_REVIEW_MINUTES;
}

/** `C_max`: new cells one class day may open: 2 in Stages 1-2, 3 above (BL-OD-16). */
export function newCellsPerClassDay(stage: StageKey): number {
  return stage === 'stage1' || stage === 'stage2' ? 2 : 3;
}

/** Weekdays in week order from Monday. */
const WEEK_FROM_MONDAY: readonly Weekday[] = [...WEEKDAYS.slice(1), WEEKDAYS[0]];
const mondayIndex = (day: Weekday): number => WEEK_FROM_MONDAY.indexOf(day);

function checkClassDays(lectureDays: readonly Weekday[]): void {
  if (lectureDays.length < 1 || lectureDays.length > 5) throw new RangeError('class days: 1 to 5 weekdays');
  lectureDays.forEach((day, index) => {
    if (!WEEKDAYS.includes(day)) throw new RangeError(`class days: ${String(day)} is not a weekday`);
    if (lectureDays.indexOf(day) !== index) throw new RangeError(`class days: ${day} is repeated`);
  });
}

/**
 * Default practice weekdays for `perWeek` sessions with class on `lectureDays` (section 6.3, BL-OD-19).
 *
 * The `7 - L` non-class weekdays split into segments: the days after each class day up to the next one, classes in
 * week order from Monday. Each segment gets `round(P x len / n)` days by largest remainder (ties to the earlier
 * segment), and while `P >= L` every non-empty segment gets at least one (taken from the segment with the most, the
 * later on a tie). Inside a segment of `len` days, `p` days are picked at `floor(i x len / p)`, so the day after a
 * class is a practice day whenever its segment has one. When `P > 7 - L`, every non-class weekday is a practice day
 * and the remaining sessions go on class days (after class), in week order from Monday.
 *
 * The result lists the segments' days in cycle order, then those class days.
 */
export function practiceDaysFor(lectureDays: readonly Weekday[], perWeek: number): Weekday[] {
  checkClassDays(lectureDays);
  if (!Number.isInteger(perWeek) || perWeek < 1 || perWeek > 7) throw new RangeError('practice days: 1 to 7 a week');
  const classes = [...lectureDays].sort((a, b) => mondayIndex(a) - mondayIndex(b));
  const segments = classes.map((day) => {
    const out: Weekday[] = [];
    for (let i = 1; i < 7; i += 1) {
      const next = WEEKDAYS[(WEEKDAYS.indexOf(day) + i) % 7] as Weekday;
      if (lectureDays.includes(next)) break;
      out.push(next);
    }
    return out;
  });
  const n = 7 - lectureDays.length;
  if (perWeek >= n) {
    const extra = WEEK_FROM_MONDAY.filter((day) => lectureDays.includes(day)).slice(0, perWeek - n);
    return [...segments.flat(), ...extra];
  }
  const segs = segments.map((days, index) => {
    const quota = (perWeek * days.length) / n;
    return { days, index, count: Math.floor(quota), rest: quota - Math.floor(quota) };
  });
  const left = perWeek - segs.reduce((sum, seg) => sum + seg.count, 0);
  [...segs]
    .sort((a, b) => b.rest - a.rest || a.index - b.index)
    .slice(0, left)
    .forEach((seg) => {
      seg.count += 1;
    });
  if (perWeek >= lectureDays.length) {
    for (const seg of segs) {
      if (seg.days.length === 0 || seg.count !== 0) continue;
      const most = Math.max(...segs.map((other) => other.count));
      const donor = segs.filter((other) => other.count === most).at(-1) as (typeof segs)[number];
      donor.count -= 1;
      seg.count = 1;
    }
  }
  return segs.flatMap(({ days, count }) => Array.from({ length: count }, (_, i) => days[Math.floor((i * days.length) / count)] as Weekday));
}

/** One class cycle: a class day to the day before the next class day (section 6.1). */
export interface ClassCycle {
  /** 0-based, in date order. */
  index: number;
  classDate: string;
  /** The day before the next class day. */
  endDate: string;
  /**
   * The cycle's practice dates, ascending: practice weekdays after the class day up to the next class day; a practice
   * session on the next class day belongs here (it is played after that class, with this cycle's lessons). The route's
   * first class day never holds one, and neither does the class day after the route's end.
   */
  practiceDates: string[];
}

export interface ClassRoute {
  /** The first class day on or after the start date: the route's first day. */
  firstClassDate: string;
  /** The last class's whole cycle ends here (the day before the next class would fall). */
  endDate: string;
  cycles: ClassCycle[];
}

export interface CyclesInput {
  startDate: string;
  /** Cycles of the first class weekday. */
  weeks: number;
  lectureDays: readonly Weekday[];
  /** The plan's practice weekdays (`blend.personal.days`); else `practiceDaysFor(lectureDays, perWeek)`. */
  practiceDays?: readonly Weekday[];
  perWeek?: number;
}

/**
 * The class cycles of a route (section 6.3). It starts with the first class day on or after `startDate` (the days
 * before carry nothing), counts `weeks` cycles of that class's weekday (so `L x weeks` cycles), and ends with the last
 * class's whole cycle. Days off are not applied here: they remove sessions, never move them (BL-2).
 */
export function cyclesOf(input: CyclesInput): ClassRoute {
  const { startDate, weeks, lectureDays } = input;
  checkClassDays(lectureDays);
  if (!isDateKey(startDate)) throw new RangeError(`start date: ${startDate} is not a real day`);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_ROUTE_WEEKS) throw new RangeError(`weeks: a whole number from 1 to ${MAX_ROUTE_WEEKS}`);
  const practice = input.practiceDays ?? (input.perWeek === undefined ? undefined : practiceDaysFor(lectureDays, input.perWeek));
  if (practice === undefined) throw new RangeError('practice days: give practiceDays or perWeek');
  if (practice.length < 1 || practice.length > 7 || new Set(practice).size !== practice.length) throw new RangeError('practice days: 1 to 7 distinct weekdays');
  for (const day of practice) if (!WEEKDAYS.includes(day)) throw new RangeError(`practice days: ${String(day)} is not a weekday`);

  let firstClassDate = startDate;
  while (!lectureDays.includes(weekdayOf(firstClassDate))) firstClassDate = addDays(firstClassDate, 1);
  const endDate = addDays(firstClassDate, 7 * weeks - 1);
  const classDates: string[] = [];
  for (let date = firstClassDate; date <= endDate; date = addDays(date, 1)) {
    if (lectureDays.includes(weekdayOf(date))) classDates.push(date);
  }
  const cycles = classDates.map((classDate, index): ClassCycle => {
    const next = classDates[index + 1];
    const cycleEnd = next === undefined ? endDate : addDays(next, -1);
    const practiceDates: string[] = [];
    for (let date = addDays(classDate, 1); date <= cycleEnd; date = addDays(date, 1)) {
      if (practice.includes(weekdayOf(date))) practiceDates.push(date);
    }
    if (next !== undefined && practice.includes(weekdayOf(next))) practiceDates.push(next);
    return { index, classDate, endDate: cycleEnd, practiceDates };
  });
  return { firstClassDate, endDate, cycles };
}

/** What the packers read of an item: catalogue minutes and, for a lesson, its cell. */
export interface PackItem {
  minutes: number;
  cellId?: string | undefined;
}

export interface PackClassOptions<T> {
  /** Cells opened by earlier class days; reopening one does not count against `C_max`. */
  openedBefore?: Iterable<string>;
  /**
   * Split mode (section 5.2): the packet's cell openers go first (at most `C_max` new cells; an opener past `C_max` is
   * skipped, not the end of the day), then the packet's other lessons in queue order while the budget allows. A lesson
   * whose cell opener is in the queue but not taken waits for it. Pass one cycle's packet as the queue in this mode.
   */
  isOpener?: (item: T) => boolean;
}

export interface PackedClass<T> {
  /** In the order the class day plays them (in split mode, the openers first). */
  taken: T[];
  /** What the class day did not take, in queue order (the queue minus `taken`). */
  rest: T[];
  /** Class minutes of `taken` (`k x m` summed). */
  classMinutes: number;
  /** Cells this class day opens for the first time, in order. */
  openedCells: string[];
}

/**
 * Class packing (section 6.2): take items in order while `running + k x m <= budget` and the new cells opened stay at
 * most `cMax`; the first item is always taken when the queue is not empty. A take-while: the first item that does not
 * fit ends the class day, so the queue's order holds. In split mode (`isOpener`) only the budget ends the day; an item
 * past `cMax`, or one whose cell opener was not taken, is skipped and stays in `rest`.
 */
export function packClass<T extends PackItem>(queue: readonly T[], budget: number, k: number, cMax: number, opts: PackClassOptions<T> = {}): PackedClass<T> {
  checkAmount('budget', budget);
  checkAmount('class pace', k);
  if (!Number.isInteger(cMax) || cMax < 0) throw new RangeError('new cells: a whole number from 0');
  for (const item of queue) checkAmount('minutes', item.minutes);
  const { isOpener } = opts;
  const opened = new Set(opts.openedBefore ?? []);
  const openedCells: string[] = [];
  const taken: T[] = [];
  let classMinutes = 0;
  const take = (item: T): void => {
    if (item.cellId !== undefined && !opened.has(item.cellId)) {
      opened.add(item.cellId);
      openedCells.push(item.cellId);
    }
    classMinutes += k * item.minutes;
    taken.push(item);
  };
  const overBudget = (item: T): boolean => taken.length > 0 && classMinutes + k * item.minutes > budget;
  const overCells = (item: T): boolean =>
    taken.length > 0 && item.cellId !== undefined && !opened.has(item.cellId) && openedCells.length + 1 > cMax;

  if (!isOpener) {
    for (const item of queue) {
      if (overBudget(item) || overCells(item)) break;
      take(item);
    }
    return { taken, rest: queue.slice(taken.length), classMinutes, openedCells };
  }

  const openers = queue.filter((item) => isOpener(item));
  let ended = false;
  for (const item of openers) {
    if (overBudget(item)) {
      ended = true;
      break;
    }
    if (!overCells(item)) take(item);
  }
  if (!ended) {
    // Cells whose opener is in this queue but was not taken: their other lessons wait for it.
    const waiting = new Set(openers.filter((item) => !taken.includes(item)).map((item) => item.cellId));
    for (const item of queue) {
      if (isOpener(item) || (item.cellId !== undefined && waiting.has(item.cellId)) || overCells(item)) continue;
      if (overBudget(item)) break;
      take(item);
    }
  }
  return { taken, rest: queue.filter((item) => !taken.includes(item)), classMinutes, openedCells };
}

/** A cycle's items for its practice days, in the order they are dealt (section 6.2). */
export interface CycleItems<T> {
  /** Earlier cycles' class lessons not yet placed. */
  carried?: readonly T[];
  /** This cycle's class lessons. */
  taught?: readonly T[];
  /** Split mode: the packet's practice-only lessons. */
  practiceOnly?: readonly T[];
}

export interface PracticeDay<T> {
  date: string;
  items: T[];
  /** Catalogue minutes placed. */
  minutes: number;
  /** No lesson, or at least `REFRESH_MIN_ROOM` minutes of room: the day offers a Refresh. */
  refresh: boolean;
}

export interface SpreadPractice<T> {
  days: Array<PracticeDay<T>>;
  /** What did not fit, in order: it goes first on the next cycle's practice days. */
  carry: T[];
}

/**
 * Practice packing (section 6.2): carried-over lessons, then this cycle's class lessons, then practice-only lessons,
 * dealt round robin over the practice dates in date order, so the days hold about the same number and each mixes an
 * earlier and a later lesson. A day takes an item only while its minutes are under `budget`, so it never goes over by
 * more than one item; the rest carries forward. Days differ by at most one item unless the day with fewer is full
 * (with mixed minutes, a long item can fill a day early; the budget rule wins over the even count).
 */
export function spreadPractice<T extends PackItem>(cycleItems: CycleItems<T>, practiceDates: readonly string[], budget: number): SpreadPractice<T> {
  checkAmount('budget', budget);
  const queue = [...(cycleItems.carried ?? []), ...(cycleItems.taught ?? []), ...(cycleItems.practiceOnly ?? [])];
  for (const item of queue) checkAmount('minutes', item.minutes);
  for (const date of practiceDates) if (!isDateKey(date)) throw new RangeError(`practice dates: ${date} is not a real day`);
  if (new Set(practiceDates).size !== practiceDates.length) throw new RangeError('practice dates: a date is repeated');
  const days = [...practiceDates].sort().map((date) => ({ date, items: [] as T[], minutes: 0 }));
  let next = 0;
  let open = days.length > 0;
  while (next < queue.length && open) {
    open = false;
    for (const day of days) {
      if (next >= queue.length) break;
      if (day.minutes >= budget) continue;
      const item = queue[next] as T;
      day.items.push(item);
      day.minutes += item.minutes;
      next += 1;
      open = true;
    }
  }
  return {
    days: days.map((day) => ({ ...day, refresh: day.items.length === 0 || budget - day.minutes >= REFRESH_MIN_ROOM })),
    carry: queue.slice(next),
  };
}
