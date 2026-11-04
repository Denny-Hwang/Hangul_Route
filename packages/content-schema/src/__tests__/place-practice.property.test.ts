import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { WEEKDAYS, addDays, weekdayOf, type Weekday } from '..';
import {
  PRACTICE_DAY_CAP,
  REFRESH_MIN_ROOM,
  cyclesOf,
  placePractice,
  practiceDaysFor,
  spreadPractice,
  type PlaceItem,
  type RefreshEntry,
} from '../curriculum/blend';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND section 9.4 (row BL-8, BL-OD-7): `placePractice` re-dates a blended plan's practice
 * items to the learner's own practice days, on the device only, cycle by cycle with `spreadPractice`, under five
 * invariants. The plans here are built the way the generator lays them out (class lessons dated after their class day
 * by `spreadPractice` over the plan's practice days, carried forward when they do not fit; in split, practice-only
 * lessons of the cells the cycle's class opened), then moved to random learner days of 1 to 7, class days included.
 */

interface Item extends PlaceItem {
  id: string;
  targetDate: string;
}

const MONDAY = '2026-11-02';

/** The cycle (0-based) a practice date falls in: after class day `c`, up to and including class day `c + 1`. */
function cycleIndex(classDates: readonly string[], date: string): number {
  let c = -1;
  for (let i = 0; i < classDates.length; i += 1) if ((classDates[i] as string) < date) c = i;
  return c;
}

/** Every class weekday date from a week before `from` to two weeks after `to`. */
function classDatesAround(classDays: readonly Weekday[], from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = addDays(from, -7); d <= addDays(to, 14); d = addDays(d, 1)) if (classDays.includes(weekdayOf(d))) out.push(d);
  return out;
}

interface Plan {
  classDays: Weekday[];
  budget: number;
  mode: 'overlap' | 'split';
  items: Item[];
  refresh: RefreshEntry[];
  endDate: string;
}

/** A blended plan laid out as the generator does (sections 5 and 6.2), small enough for a property run. */
function planOf(o: { classDays: Weekday[]; perWeek: number; budget: number; mode: 'overlap' | 'split'; weeks: number; perClass: number[]; minutes: number[] }): Plan {
  const route = cyclesOf({ startDate: MONDAY, weeks: o.weeks, lectureDays: o.classDays, perWeek: o.perWeek });
  const items: Item[] = [];
  const refresh: RefreshEntry[] = [];
  let carried: Item[] = [];
  let n = 0;
  const minutesAt = (): number => o.minutes[n % o.minutes.length] as number;
  route.cycles.forEach((cycle, c) => {
    const count = o.perClass[c % o.perClass.length] as number;
    const taught: Item[] = [];
    const practiceOnly: Item[] = [];
    const cells: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const cellId = `cell:${c}-${i % 2}`;
      if (!cells.includes(cellId)) cells.push(cellId);
      taught.push({ id: `q${(n += 1)}`, targetDate: '', lectureDate: cycle.classDate, minutes: minutesAt(), cellId });
    }
    if (o.mode === 'split') for (const cellId of cells) practiceOnly.push({ id: `q${(n += 1)}`, targetDate: '', minutes: minutesAt(), cellId });
    const spread = spreadPractice({ carried, taught, practiceOnly }, cycle.practiceDates, o.budget);
    for (const day of spread.days) {
      for (const item of day.items) items.push({ ...item, targetDate: day.date });
      if (day.refresh && cells.length > 0) refresh.push({ date: day.date, cellIds: cells.slice(0, 6) });
    }
    carried = spread.carry;
  });
  // What the last cycle could not take goes a week after the route's last day, after every class (the generator
  // warns instead; a class on the route's last day has no practice date of its own).
  const endDate = carried.length === 0 ? route.endDate : addDays(route.endDate, 7);
  for (const item of carried) items.push({ ...item, targetDate: endDate });
  return { classDays: o.classDays, budget: o.budget, mode: o.mode, items, refresh, endDate };
}

const weekdaySet = fc.subarray([...WEEKDAYS] as Weekday[], { minLength: 1, maxLength: 7 });

const planArb = fc
  .record({
    classDays: fc.subarray([...WEEKDAYS] as Weekday[], { minLength: 1, maxLength: 3 }),
    perWeek: fc.integer({ min: 1, max: 7 }),
    budget: fc.constantFrom(5, 10, 15, 20),
    mode: fc.constantFrom('overlap' as const, 'split' as const),
    weeks: fc.integer({ min: 1, max: 5 }),
    perClass: fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 1, maxLength: 4 }),
    minutes: fc.array(fc.integer({ min: 1, max: 9 }), { minLength: 1, maxLength: 5 }),
  })
  .map(planOf);

/** The minutes placed on each date, over every item's final date. */
function load(items: readonly Item[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) out.set(item.targetDate, (out.get(item.targetDate) ?? 0) + item.minutes);
  return out;
}

/** The earliest class day of each cell: its opener's class date. */
function openerDates(items: readonly Item[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const item of items) {
    if (item.lectureDate === undefined || item.cellId === undefined) continue;
    const prev = out.get(item.cellId);
    if (prev === undefined || item.lectureDate < prev) out.set(item.cellId, item.lectureDate);
  }
  return out;
}

describe('placePractice: the five invariants of section 9.4 (property)', () => {
  it('holds for random plans, learner days 1 to 7 (class days included), overlap and split, and any first day', () => {
    fc.assert(
      fc.property(planArb, weekdaySet, fc.integer({ min: -3, max: 30 }), (plan, days, fromOffset) => {
        const from = addDays(MONDAY, fromOffset);
        const out = placePractice(plan.items, plan.refresh, days, { classDays: plan.classDays, budget: plan.budget, from, endDate: plan.endDate });
        const lastPlanDate = plan.items.reduce((top, item) => (item.targetDate > top ? item.targetDate : top), plan.endDate);
        const classDates = classDatesAround(plan.classDays, MONDAY, lastPlanDate);
        const openers = openerDates(plan.items);
        const kept = new Set(out.kept.map((item) => item.id));

        // No item lost, added or reordered; only `targetDate` may change.
        expect(out.items.map((item) => item.id)).toEqual(plan.items.map((item) => item.id));
        const moved: Item[] = [];
        out.items.forEach((item, i) => {
          const before = plan.items[i] as Item;
          expect({ ...item, targetDate: before.targetDate }).toEqual(before);
          if (before.targetDate < from || kept.has(item.id)) {
            // Past items and items that keep their plan date do not move.
            expect(item.targetDate).toBe(before.targetDate);
            return;
          }
          moved.push(item);
          // A placed item lands on a learner day, from `from` on.
          expect(days).toContain(weekdayOf(item.targetDate));
          expect(item.targetDate >= from).toBe(true);
          // (1) after its class day.
          if (item.lectureDate !== undefined) expect(item.targetDate > item.lectureDate).toBe(true);
          // (2) in split, a practice-only item after its cell opener's class day.
          if (item.lectureDate === undefined && item.cellId !== undefined && openers.has(item.cellId)) {
            expect(item.targetDate > (openers.get(item.cellId) as string)).toBe(true);
          }
          // (3) its own cycle or a later one.
          const planCycle = cycleIndex(classDates, before.targetDate);
          const newCycle = cycleIndex(classDates, item.targetDate);
          expect(newCycle).toBeGreaterThanOrEqual(planCycle);
          // (4) never more than two cycles after its class day (the plan's own cycle when the plan put it later).
          const ref = item.lectureDate === undefined ? planCycle : cycleIndex(classDates, addDays(item.lectureDate, 1));
          expect(newCycle).toBeLessThanOrEqual(Math.max(ref + 1, planCycle));
        });
        // (4) a learner day holds at most 1.5 x B_P of what was placed there.
        for (const [, minutes] of load(moved)) expect(minutes).toBeLessThanOrEqual(PRACTICE_DAY_CAP * plan.budget);
        // Kept items are items that could not be placed: they keep their plan date.
        for (const item of out.kept) expect(item.targetDate).toBe(plan.items.find((p) => p.id === item.id)?.targetDate);

        // (5) Refresh entries from `from` on sit on learner days that end with room or no lesson.
        const finalLoad = load(out.items);
        const dates = out.refresh.map((entry) => entry.date);
        expect(new Set(dates).size).toBe(dates.length);
        expect([...dates].sort()).toEqual(dates);
        for (const entry of out.refresh) {
          expect(entry.cellIds.length).toBeGreaterThanOrEqual(1);
          expect(entry.cellIds.length).toBeLessThanOrEqual(6);
          if (entry.date < from) {
            expect(plan.refresh).toContainEqual(entry);
            continue;
          }
          expect(days).toContain(weekdayOf(entry.date));
          expect(entry.date <= plan.endDate).toBe(true);
          const placed = finalLoad.get(entry.date) ?? 0;
          expect(placed === 0 || plan.budget - placed >= REFRESH_MIN_ROOM).toBe(true);
        }
        // The Refresh entries before `from` stay as the plan has them.
        expect(out.refresh.filter((entry) => entry.date < from)).toEqual(plan.refresh.filter((entry) => entry.date < from));
      }),
      { numRuns: 400 },
    );
  });

  it('places every item when the learner days have room within two cycles', () => {
    fc.assert(
      fc.property(planArb, (plan) => {
        // The plan's own days again, with room to spare: nothing needs to keep its plan date.
        const all: Weekday[] = [...WEEKDAYS];
        const roomy = { classDays: plan.classDays, budget: 1000, endDate: plan.endDate };
        const out = placePractice(plan.items, plan.refresh, all, roomy);
        expect(out.kept).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});

describe('placePractice: named cases (section 9.4, BL-8)', () => {
  // A Thursday class, 30 minutes; practice 10 minutes on Fri, Sun, Tue (the class's default for P = 3).
  const THU = '2026-11-05';
  const lesson = (id: string, lectureDate: string, targetDate: string, minutes = 5, cellId?: string): Item => ({ id, lectureDate, targetDate, minutes, ...(cellId === undefined ? {} : { cellId }) });

  it('the class default for a Thursday class is Fri, Sun, Tue', () => {
    expect(practiceDaysFor(['thu'], 3)).toEqual(['fri', 'sun', 'tue']);
  });

  it('overlap: a Tuesday learner day never gets that week\'s Thursday lessons; they go to the next Tuesday', () => {
    const items = [lesson('a', THU, '2026-11-06'), lesson('b', THU, '2026-11-08'), lesson('c', THU, '2026-11-10')];
    const out = placePractice(items, [], ['tue'], { classDays: ['thu'], budget: 10, endDate: '2026-11-11' });
    // The Tuesday before the class (2026-11-03) holds none of them; the next Tuesday takes them up to 1.5 x 10 minutes.
    expect(out.items.map((item) => item.targetDate)).toEqual(['2026-11-10', '2026-11-10', '2026-11-10']);
    expect(out.items.some((item) => item.targetDate === '2026-11-03')).toBe(false);
  });

  it('split: a practice-only lesson of a cell the Thursday class opens never lands on the Tuesday before it', () => {
    const items: Item[] = [lesson('open', THU, '2026-11-06', 5, 'cell:x'), { id: 'more', targetDate: '2026-11-08', minutes: 5, cellId: 'cell:x' }];
    const out = placePractice(items, [], ['tue', 'wed'], { classDays: ['thu'], budget: 10, from: '2026-11-02', endDate: '2026-11-11' });
    for (const item of out.items) expect(item.targetDate > THU).toBe(true);
    expect(out.items.map((item) => item.targetDate)).toEqual(['2026-11-10', '2026-11-11']);
  });

  it('only the class day picked: each class\'s lessons go to the next class day, after class, within two cycles', () => {
    const items = [
      lesson('a1', THU, '2026-11-06'),
      lesson('a2', THU, '2026-11-08'),
      lesson('b1', '2026-11-12', '2026-11-13'),
      lesson('b2', '2026-11-12', '2026-11-15'),
    ];
    const out = placePractice(items, [], ['thu'], { classDays: ['thu'], budget: 10, endDate: '2026-11-25' });
    expect(out.items.map((item) => [item.id, item.targetDate])).toEqual([
      ['a1', '2026-11-12'],
      ['a2', '2026-11-12'],
      ['b1', '2026-11-19'],
      ['b2', '2026-11-19'],
    ]);
  });

  it('the excess carries to the next learner day, and an item past two cycles keeps its plan date', () => {
    // Six 6-minute lessons on a 10-minute budget: 15 minutes a day at most, so two a day, in plan-date order
    // (a and d on Friday, b and e on Sunday, c and f on Tuesday).
    const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => lesson(id, THU, ['2026-11-06', '2026-11-08', '2026-11-10'][i % 3] as string, 6));
    const out = placePractice(items, [], ['thu'], { classDays: ['thu'], budget: 10, endDate: '2026-12-02' });
    expect(out.items.map((item) => item.targetDate)).toEqual(['2026-11-12', '2026-11-19', '2026-11-10', '2026-11-12', '2026-11-19', '2026-11-10']);
    expect(out.kept.map((item) => item.id)).toEqual(['c', 'f']);
  });

  it('moves Refresh to the learner days with room or no lesson, with the cells of that cycle', () => {
    const items = [lesson('a', THU, '2026-11-06')];
    const refresh: RefreshEntry[] = [
      { date: '2026-11-06', cellIds: ['cell:x'] },
      { date: '2026-11-08', cellIds: ['cell:x'] },
      { date: '2026-11-10', cellIds: ['cell:x'] },
    ];
    const out = placePractice(items, refresh, ['sat', 'mon'], { classDays: ['thu'], budget: 10, endDate: '2026-11-11' });
    expect(out.items.map((item) => item.targetDate)).toEqual(['2026-11-07']);
    // Saturday holds 5 of 10 minutes (room 5), Monday no lesson: both offer a Refresh.
    expect(out.refresh).toEqual([
      { date: '2026-11-07', cellIds: ['cell:x'] },
      { date: '2026-11-09', cellIds: ['cell:x'] },
    ]);
  });

  it('leaves the past alone: items and Refresh before `from` keep their dates', () => {
    const items = [lesson('past', THU, '2026-11-06'), lesson('next', THU, '2026-11-08')];
    const refresh = [{ date: '2026-11-06', cellIds: ['cell:x'] }];
    const out = placePractice(items, refresh, ['mon'], { classDays: ['thu'], budget: 10, from: '2026-11-07', endDate: '2026-11-11' });
    expect(out.items.map((item) => item.targetDate)).toEqual(['2026-11-06', '2026-11-09']);
    expect(out.refresh[0]).toEqual({ date: '2026-11-06', cellIds: ['cell:x'] });
  });

  it('skips a plan day off, and reads the route end from the plan when it is not given', () => {
    const items = [lesson('a', THU, '2026-11-06'), { id: 'free', targetDate: '2026-11-08', minutes: 5 }, { id: 'loose', targetDate: '2026-11-08', minutes: 5, cellId: 'cell:none' }];
    const out = placePractice(items, [{ date: '2026-11-06', cellIds: ['cell:x'] }], ['fri', 'sat'], { classDays: ['thu'], budget: 10, isDayOff: (date) => date === '2026-11-06' });
    // Friday is a day off; Saturday takes all three (15 minutes), and nothing goes past the plan's last date.
    expect(out.items.map((item) => item.targetDate)).toEqual(['2026-11-07', '2026-11-07', '2026-11-07']);
  });

  it('keeps an undated item as it is', () => {
    const items = [{ id: 'free', minutes: 5 }] as unknown as Item[];
    expect(placePractice(items, [], ['mon'], { classDays: ['thu'], budget: 10 }).items).toEqual(items);
  });

  it('refuses learner days that are not 1 to 7 distinct weekdays, and a budget that is not above 0', () => {
    const ctx = { classDays: ['thu'] as Weekday[], budget: 10 };
    expect(() => placePractice([], [], [], ctx)).toThrow(RangeError);
    expect(() => placePractice([], [], ['mon', 'mon'], ctx)).toThrow(RangeError);
    expect(() => placePractice([], [], ['someday' as Weekday], ctx)).toThrow(RangeError);
    expect(() => placePractice([], [], ['mon'], { ...ctx, budget: 0 })).toThrow(RangeError);
    expect(() => placePractice([], [], ['mon'], { ...ctx, classDays: [] })).toThrow(RangeError);
  });
});
