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

/**
 * A learner's own practice days (section 9.4, row BL-8, BL-OD-7): a day may hold up to `PRACTICE_DAY_CAP x B_P`
 * minutes of re-dated items, so a learner who picked fewer days than the class still plays each class's lessons soon.
 */
export const PRACTICE_DAY_CAP = 1.5;

/** What `placePractice` reads of a plan item: its date, the class day that taught it, minutes and cell. */
export interface PlaceItem extends PackItem {
  targetDate?: string | undefined;
  lectureDate?: string | undefined;
}

/** A Refresh date and the cells it looks back at (`CurriculumMeta.refresh`). */
export interface RefreshEntry {
  date: string;
  cellIds: string[];
}

export interface PlaceContext {
  /** The plan's class weekdays (`blend.lecture.days`): the cycle boundaries. */
  classDays: readonly Weekday[];
  /** `B_P`: the plan's practice minutes (`blend.personal.minutes`). */
  budget: number;
  /** The first day that may change (the device's today): earlier items and Refresh entries keep their dates. */
  from?: string | undefined;
  /** The route's last day; default the latest item or Refresh date. No learner date after it is used. */
  endDate?: string | undefined;
  /** A plan day off (`daysOff`): no item or Refresh is placed on it. */
  isDayOff?: ((date: string) => boolean) | undefined;
}

export interface PlacedPractice<T> {
  /** The items in their input order, each with its new `targetDate` (only `targetDate` ever changes). */
  items: T[];
  /** The Refresh entries: before `from` as the plan has them, from `from` on on the learner's days. Date order. */
  refresh: RefreshEntry[];
  /** Items that found no learner day within two cycles of their class day: they keep their plan date. Input order. */
  kept: T[];
}

const MAX_REFRESH = 364;
const MAX_REFRESH_CELLS = 6;

/**
 * Re-dates a blended plan's practice items to the learner's own practice days (section 9.4), on the device only. Cycle
 * by cycle (a cycle's practice window runs from the day after a class day up to and including the next class day),
 * the cycle's due items (carried first, then class lessons by class day, then practice-only lessons, each in plan-date
 * order) are dealt with `spreadPractice` over the learner's dates in that window from `from` on, under five invariants:
 *
 * 1. a new date is after the item's `lectureDate` (the window starts after the cycle's class day);
 * 2. in split, a practice-only item's new date is after its cell opener's class date (checked, and true by the window);
 * 3. an item stays in its own cycle or moves to a later one;
 * 4. a day holds at most `PRACTICE_DAY_CAP x budget` of placed items; the excess carries to the next learner day with
 *    room (a later one in the same cycle first, then the next cycle's), and an item that would then fall more than two
 *    cycles after its class day (its plan cycle, when the plan put it later) keeps its plan date (`kept`). The cap
 *    counts re-dated items only: an item that keeps its plan date (`kept`, or dated before `from`) may share a day with
 *    placed ones. A single item longer than the cap never fits a learner day, so it always keeps its plan date;
 * 5. Refresh entries move to the learner's dates that end with at least `REFRESH_MIN_ROOM` minutes of room or no
 *    lesson, with the cells of the plan's entries in that cycle (else the latest earlier entry's).
 *
 * So a learner day before the class day (a Tuesday for a Thursday class) never gets that week's class lessons, and a
 * learner who picks only the class day plays each class's lessons on the next class day, after class.
 */
export function placePractice<T extends PlaceItem>(items: readonly T[], refresh: readonly RefreshEntry[], practiceDays: readonly Weekday[], ctx: PlaceContext): PlacedPractice<T> {
  checkClassDays(ctx.classDays);
  if (!Number.isFinite(ctx.budget) || ctx.budget <= 0) throw new RangeError('budget: a finite number above 0');
  if (practiceDays.length < 1 || practiceDays.length > 7 || new Set(practiceDays).size !== practiceDays.length) throw new RangeError('practice days: 1 to 7 distinct weekdays');
  for (const day of practiceDays) if (!WEEKDAYS.includes(day)) throw new RangeError(`practice days: ${String(day)} is not a weekday`);
  for (const item of items) checkAmount('minutes', item.minutes);
  const from = ctx.from ?? '';
  const dated = items.flatMap((item, index) => (item.targetDate === undefined ? [] : [{ item, index, planDate: item.targetDate }]));
  const allDates = [...dated.map((d) => d.planDate), ...dated.flatMap((d) => (d.item.lectureDate === undefined ? [] : [d.item.lectureDate])), ...refresh.map((e) => e.date)];
  if (allDates.length === 0) return { items: [...items], refresh: [...refresh], kept: [] };
  const first = allDates.reduce((a, b) => (a < b ? a : b));
  const endDate = ctx.endDate ?? [...dated.map((d) => d.planDate), ...refresh.map((e) => e.date)].reduce((a, b) => (a > b ? a : b), first);

  // Class dates: the last one before the earliest date, then every one up to the first after the route's end.
  let start = addDays(first, -1);
  while (!ctx.classDays.includes(weekdayOf(start))) start = addDays(start, -1);
  const classDates: string[] = [];
  for (let date = start; ; date = addDays(date, 1)) {
    if (ctx.classDays.includes(weekdayOf(date))) {
      classDates.push(date);
      if (date > endDate) break;
    }
  }
  /** The cycle a practice date falls in: the last class date strictly before it. */
  const cycleOf = (date: string): number => {
    let c = 0;
    for (let i = 0; i < classDates.length && (classDates[i] as string) < date; i += 1) c = i;
    return c;
  };
  const lastCycle = classDates.length - 2;
  const learnerDates = (c: number): string[] => {
    const out: string[] = [];
    const end = (classDates[c + 1] as string) < endDate ? (classDates[c + 1] as string) : endDate;
    for (let date = addDays(classDates[c] as string, 1); date <= end; date = addDays(date, 1)) {
      if (practiceDays.includes(weekdayOf(date)) && date >= from && !(ctx.isDayOff?.(date) ?? false)) out.push(date);
    }
    return out;
  };

  const openerDate = new Map<string, string>();
  for (const { item } of dated) {
    if (item.lectureDate === undefined || item.cellId === undefined) continue;
    const prev = openerDate.get(item.cellId);
    if (prev === undefined || item.lectureDate < prev) openerDate.set(item.cellId, item.lectureDate);
  }
  /** The earliest date an item may take (invariants 1 and 2): after its class day, or after its cell opener's. */
  const floorOf = (item: T): string => item.lectureDate ?? (item.cellId === undefined ? '' : (openerDate.get(item.cellId) ?? ''));

  interface Due extends PackItem {
    index: number;
    item: T;
    planDate: string;
    planCycle: number;
    lastCycle: number;
  }
  const byCycle = new Map<number, Due[]>();
  for (const { item, index, planDate } of dated) {
    if (planDate < from) continue;
    const planCycle = cycleOf(planDate);
    const ref = item.lectureDate === undefined ? planCycle : cycleOf(addDays(item.lectureDate, 1));
    const due: Due = { index, item, planDate, minutes: item.minutes, cellId: item.cellId, planCycle, lastCycle: Math.max(ref + 1, planCycle) };
    byCycle.set(planCycle, [...(byCycle.get(planCycle) ?? []), due]);
  }
  const order = (a: Due, b: Due): number =>
    (a.item.lectureDate === undefined ? 1 : 0) - (b.item.lectureDate === undefined ? 1 : 0) ||
    (a.item.lectureDate ?? '').localeCompare(b.item.lectureDate ?? '') ||
    a.planDate.localeCompare(b.planDate) ||
    a.index - b.index;

  const placed = new Map<number, string>();
  const keptIndex = new Set<number>();
  const cap = PRACTICE_DAY_CAP * ctx.budget;
  let carry: Due[] = [];
  const cycles = [...byCycle.keys()];
  const firstCycle = cycles.length === 0 ? lastCycle + 1 : Math.min(...cycles);
  for (let c = firstCycle; c <= lastCycle; c += 1) {
    const own = [...(byCycle.get(c) ?? [])].sort(order);
    const queue = [...carry, ...own];
    if (queue.length === 0) continue;
    const dates = learnerDates(c);
    const spread = spreadPractice({ carried: carry, taught: own.filter((d) => d.item.lectureDate !== undefined), practiceOnly: own.filter((d) => d.item.lectureDate === undefined) }, dates, cap);
    const left = new Set<Due>(spread.carry);
    const dayLoad = new Map<string, number>();
    for (const day of spread.days) {
      for (const due of day.items) {
        const minutes = dayLoad.get(day.date) ?? 0;
        if (minutes + due.minutes <= cap && day.date > floorOf(due.item)) {
          dayLoad.set(day.date, minutes + due.minutes);
          placed.set(due.index, day.date);
        } else left.add(due);
      }
    }
    // Invariant 4: what a day could not hold goes to the learner's next day with room in this cycle (in queue order),
    // and only then to the next cycle.
    for (const due of queue) {
      if (!left.has(due)) continue;
      const date = dates.find((d) => d > floorOf(due.item) && (dayLoad.get(d) ?? 0) + due.minutes <= cap);
      if (date === undefined) continue;
      dayLoad.set(date, (dayLoad.get(date) ?? 0) + due.minutes);
      placed.set(due.index, date);
      left.delete(due);
    }
    carry = [];
    for (const due of queue) {
      if (!left.has(due)) continue;
      if (due.lastCycle > c) carry.push(due);
      else keptIndex.add(due.index);
    }
  }
  for (const due of carry) keptIndex.add(due.index);

  const out = items.map((item, index) => {
    const date = placed.get(index);
    return date === undefined || date === item.targetDate ? item : { ...item, targetDate: date };
  });

  // Invariant 5: Refresh on the learner's dates with room or no lesson.
  const load = new Map<string, number>();
  for (const item of out) if (item.targetDate !== undefined) load.set(item.targetDate, (load.get(item.targetDate) ?? 0) + item.minutes);
  const sortedPlan = [...refresh].sort((a, b) => a.date.localeCompare(b.date));
  const cellsFor = (date: string): string[] => {
    const c = cycleOf(date);
    const same = sortedPlan.filter((e) => cycleOf(e.date) === c);
    const source = same.length > 0 ? same : sortedPlan.filter((e) => e.date < date).slice(-1);
    return [...new Set(source.flatMap((e) => e.cellIds))].slice(0, MAX_REFRESH_CELLS);
  };
  const moved: RefreshEntry[] = [];
  for (let c = 0; c <= lastCycle; c += 1) {
    for (const date of learnerDates(c)) {
      const minutes = load.get(date) ?? 0;
      if (minutes > 0 && ctx.budget - minutes < REFRESH_MIN_ROOM) continue;
      const cellIds = cellsFor(date);
      if (cellIds.length > 0) moved.push({ date, cellIds });
    }
  }
  const nextRefresh = [...sortedPlan.filter((e) => e.date < from), ...moved].slice(0, MAX_REFRESH);
  return { items: out, refresh: nextRefresh, kept: items.filter((_, index) => keptIndex.has(index)) };
}
