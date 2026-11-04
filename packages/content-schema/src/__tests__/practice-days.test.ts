import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CLASS_PACE,
  CLASS_REVIEW_MINUTES,
  REFRESH_MIN_ROOM,
  WEEKDAYS,
  addDays,
  classBudget,
  cyclesOf,
  newCellsPerClassDay,
  packClass,
  practiceDaysFor,
  spreadPractice,
  weekdayOf,
  type PackItem,
  type Weekday,
} from '..';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND sections 6.2 and 6.3 (row BL-1): the default practice days, class cycles, class
 * packing and practice spreading. Pure helpers; the generator (BL-2) is not changed here.
 */

describe('practiceDaysFor (section 6.3 table)', () => {
  const table: Array<[Weekday[], number, Weekday[]]> = [
    [['tue'], 1, ['wed']],
    [['tue'], 2, ['wed', 'sat']],
    [['tue'], 3, ['wed', 'fri', 'sun']],
    [['tue'], 6, ['wed', 'thu', 'fri', 'sat', 'sun', 'mon']],
    [['tue'], 7, ['wed', 'thu', 'fri', 'sat', 'sun', 'mon', 'tue']],
    [['thu'], 3, ['fri', 'sun', 'tue']],
    [['mon', 'thu'], 3, ['tue', 'fri', 'sat']],
    [['mon', 'thu'], 1, ['fri']],
    [['mon', 'thu'], 6, ['tue', 'wed', 'fri', 'sat', 'sun', 'mon']],
  ];
  it.each(table)('%j with P = %i gives %j', (lecture, perWeek, expected) => {
    expect(practiceDaysFor(lecture, perWeek)).toEqual(expected);
  });

  it('reads class days in any order and reports segments in week order from Monday', () => {
    expect(practiceDaysFor(['thu', 'mon'], 3)).toEqual(['tue', 'fri', 'sat']);
    // Sunday is the end of the week: the Wednesday segment comes first.
    expect(practiceDaysFor(['sun', 'wed'], 2)).toEqual(['thu', 'mon']);
  });

  it('gives every non-empty segment at least one day while P >= L, even when rounding would not', () => {
    // Segments: Mon -> [Tue] (1 day), Wed -> [Thu .. Sun] (4 days); quotas 0.4 and 1.6.
    expect(practiceDaysFor(['mon', 'wed'], 2)).toEqual(['tue', 'thu']);
    // Three class days, three practice days: one per segment.
    expect(practiceDaysFor(['mon', 'wed', 'fri'], 3)).toEqual(['tue', 'thu', 'sat']);
  });

  it('skips an empty segment (two class days in a row)', () => {
    // Mon -> [] ; Tue -> [Wed .. Sun].
    expect(practiceDaysFor(['mon', 'tue'], 2)).toEqual(['wed', 'fri']);
    expect(practiceDaysFor(['mon', 'tue'], 5)).toEqual(['wed', 'thu', 'fri', 'sat', 'sun']);
    expect(practiceDaysFor(['mon', 'tue'], 7)).toEqual(['wed', 'thu', 'fri', 'sat', 'sun', 'mon', 'tue']);
  });

  it('above 7 - L puts the remaining sessions on class days from Monday (BL-OD-19)', () => {
    expect(practiceDaysFor(['wed', 'sat'], 6)).toEqual(['thu', 'fri', 'sun', 'mon', 'tue', 'wed']);
    expect(practiceDaysFor(['mon', 'tue', 'wed', 'thu', 'fri'], 7)).toEqual(['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri']);
    expect(practiceDaysFor(['sun'], 7)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
  });

  it('with fewer practice days than class days, gives them to the longest segments', () => {
    expect(practiceDaysFor(['mon', 'wed', 'fri'], 1)).toEqual(['sat']);
    expect(practiceDaysFor(['mon', 'tue', 'wed', 'thu', 'fri'], 2)).toEqual(['sat', 'sun']);
  });

  it('rejects input outside the schema', () => {
    expect(() => practiceDaysFor([], 3)).toThrow(RangeError);
    expect(() => practiceDaysFor(['mon', 'mon'], 3)).toThrow(RangeError);
    expect(() => practiceDaysFor(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], 1)).toThrow(RangeError);
    expect(() => practiceDaysFor(['mon'], 0)).toThrow(RangeError);
    expect(() => practiceDaysFor(['mon'], 8)).toThrow(RangeError);
    expect(() => practiceDaysFor(['mon'], 2.5)).toThrow(RangeError);
    expect(() => practiceDaysFor(['someday' as Weekday], 2)).toThrow(RangeError);
  });

  it('property: P distinct days, every non-class day first, each non-empty segment covered while P >= L', () => {
    const lectureArb = fc.uniqueArray(fc.constantFrom(...WEEKDAYS), { minLength: 1, maxLength: 5 });
    fc.assert(
      fc.property(lectureArb, fc.integer({ min: 1, max: 7 }), (lecture, perWeek) => {
        const days = practiceDaysFor(lecture, perWeek);
        expect(days).toHaveLength(perWeek);
        expect(new Set(days).size).toBe(perWeek);
        const n = 7 - lecture.length;
        const nonClass = days.filter((day) => !lecture.includes(day));
        expect(nonClass).toHaveLength(Math.min(perWeek, n));
        if (perWeek >= lecture.length) {
          for (const classDay of lecture) {
            const next = WEEKDAYS[(WEEKDAYS.indexOf(classDay) + 1) % 7] as Weekday;
            // The day after a class is a practice day whenever it is not a class day itself.
            if (!lecture.includes(next)) expect(days).toContain(next);
          }
        }
      }),
    );
  });
});

describe('cyclesOf (section 6.3 first and last cycle)', () => {
  it('starts with the first class on or after the start date and ends the day before the next class', () => {
    // Golden E: start on a Wednesday, class on Thursday, practice Fri, Sun, Tue.
    const start = '2026-11-04';
    expect(weekdayOf(start)).toBe('wed');
    const route = cyclesOf({ startDate: start, weeks: 2, lectureDays: ['thu'], practiceDays: ['fri', 'sun', 'tue'] });
    expect(route.firstClassDate).toBe('2026-11-05');
    expect(route.endDate).toBe('2026-11-18');
    expect(weekdayOf(route.endDate)).toBe('wed');
    expect(route.cycles).toEqual([
      { index: 0, classDate: '2026-11-05', endDate: '2026-11-11', practiceDates: ['2026-11-06', '2026-11-08', '2026-11-10'] },
      { index: 1, classDate: '2026-11-12', endDate: '2026-11-18', practiceDates: ['2026-11-13', '2026-11-15', '2026-11-17'] },
    ]);
  });

  it('starts on the start date when it is a class day', () => {
    const route = cyclesOf({ startDate: '2026-11-03', weeks: 1, lectureDays: ['tue'], practiceDays: ['wed', 'fri', 'sun'] });
    expect(route.firstClassDate).toBe('2026-11-03');
    expect(route.endDate).toBe('2026-11-09');
    expect(route.cycles).toHaveLength(1);
  });

  it('counts weeks as cycles of the first class weekday, with L cycles a week', () => {
    // Start on a Wednesday with Mon + Thu classes: Thursday comes first.
    const route = cyclesOf({ startDate: '2026-11-04', weeks: 3, lectureDays: ['mon', 'thu'], practiceDays: ['tue', 'fri', 'sat'] });
    expect(route.cycles).toHaveLength(6);
    expect(route.cycles.map((cycle) => weekdayOf(cycle.classDate))).toEqual(['thu', 'mon', 'thu', 'mon', 'thu', 'mon']);
    expect(route.cycles.filter((cycle) => weekdayOf(cycle.classDate) === 'thu')).toHaveLength(3);
    expect(route.endDate).toBe(addDays(route.firstClassDate, 20));
    expect(route.cycles.at(-1)?.endDate).toBe(route.endDate);
    expect(route.cycles[0]?.practiceDates).toEqual(['2026-11-06', '2026-11-07']);
    expect(route.cycles[1]?.practiceDates).toEqual(['2026-11-10']);
  });

  it('defaults the practice days to practiceDaysFor', () => {
    const route = cyclesOf({ startDate: '2026-11-02', weeks: 1, lectureDays: ['tue'], perWeek: 3 });
    expect(route.cycles[0]?.practiceDates.map(weekdayOf)).toEqual(['wed', 'fri', 'sun']);
  });

  it('puts a session on a class day in the cycle that ends there; the first class day has none, nor the day after the end', () => {
    // 1 class (Tue) + 7 practice: Tuesday also holds practice, after class.
    const route = cyclesOf({ startDate: '2026-11-03', weeks: 2, lectureDays: ['tue'], perWeek: 7 });
    const [first, second] = route.cycles;
    expect(first?.practiceDates).toEqual(['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10']);
    expect(first?.practiceDates).not.toContain(first?.classDate);
    expect(second?.practiceDates).toEqual(['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16']);
    expect(route.endDate).toBe('2026-11-16');
  });

  it('gives a cycle with no practice day an empty list (Mon + Thu, P = 1)', () => {
    const route = cyclesOf({ startDate: '2026-11-02', weeks: 1, lectureDays: ['mon', 'thu'], perWeek: 1 });
    expect(route.cycles.map((cycle) => cycle.practiceDates)).toEqual([[], ['2026-11-06']]);
  });

  it('keeps an empty class segment (Mon + Tue) and a class-day session of the next class', () => {
    const route = cyclesOf({ startDate: '2026-11-02', weeks: 2, lectureDays: ['mon', 'tue'], practiceDays: ['tue', 'thu'] });
    expect(route.cycles.map((cycle) => [cycle.classDate, cycle.endDate, cycle.practiceDates])).toEqual([
      ['2026-11-02', '2026-11-02', ['2026-11-03']],
      ['2026-11-03', '2026-11-08', ['2026-11-05']],
      ['2026-11-09', '2026-11-09', ['2026-11-10']],
      ['2026-11-10', '2026-11-15', ['2026-11-12']],
    ]);
  });

  it('rejects a start that is not a real day, weeks below 1 and practice days that are repeated', () => {
    expect(() => cyclesOf({ startDate: '2026-02-30', weeks: 1, lectureDays: ['tue'], perWeek: 1 })).toThrow(RangeError);
    expect(() => cyclesOf({ startDate: '2026-11-03', weeks: 0, lectureDays: ['tue'], perWeek: 1 })).toThrow(RangeError);
    expect(() => cyclesOf({ startDate: '2026-11-03', weeks: 1.5, lectureDays: ['tue'], perWeek: 1 })).toThrow(RangeError);
    expect(() => cyclesOf({ startDate: '2026-11-03', weeks: 1, lectureDays: ['tue'], practiceDays: ['wed', 'wed'] })).toThrow(RangeError);
    expect(() => cyclesOf({ startDate: '2026-11-03', weeks: 1, lectureDays: ['tue'], practiceDays: [] })).toThrow(RangeError);
    expect(() => cyclesOf({ startDate: '2026-11-03', weeks: 1, lectureDays: ['tue', 'tue'], perWeek: 1 })).toThrow(RangeError);
    expect(() => cyclesOf({ startDate: '2026-11-03', weeks: 1, lectureDays: ['tue'] })).toThrow(RangeError);
  });
});

describe('constants (BL-OD-2, BL-OD-15, BL-OD-16)', () => {
  it('class budget is the class length less the 4-minute review quiz', () => {
    expect(CLASS_REVIEW_MINUTES).toBe(4);
    expect([15, 20, 30, 45, 60].map(classBudget)).toEqual([11, 16, 26, 41, 56]);
  });

  it('class pace is 1.5 and Refresh needs 3 minutes of room', () => {
    expect(CLASS_PACE).toBe(1.5);
    expect(REFRESH_MIN_ROOM).toBe(3);
  });

  it('a class day opens at most 2 new cells in Stages 1-2 and 3 above', () => {
    expect(newCellsPerClassDay('stage1')).toBe(2);
    expect(newCellsPerClassDay('stage2')).toBe(2);
    expect(newCellsPerClassDay('stage3')).toBe(3);
    expect(newCellsPerClassDay('stage7')).toBe(3);
  });
});

const lesson = (id: string, cellId?: string, minutes = 5): PackItem & { id: string } =>
  cellId === undefined ? { id, minutes } : { id, minutes, cellId };

describe('packClass (section 6.2)', () => {
  const cellsOf3 = Array.from({ length: 12 }, (_, i) => lesson(`q${i + 1}`, `c${Math.floor(i / 3) + 1}`));

  it('golden C: a 30-minute class takes 3 five-minute lessons (22.5 of 26 class minutes)', () => {
    const { taken, rest, classMinutes } = packClass(cellsOf3, classBudget(30), CLASS_PACE, 2);
    expect(taken.map((item) => item.id)).toEqual(['q1', 'q2', 'q3']);
    expect(classMinutes).toBe(22.5);
    expect(rest.map((item) => item.id)).toEqual(cellsOf3.slice(3).map((item) => item.id));
  });

  it('golden E: a 45-minute class takes 5 lessons over 2 cells', () => {
    const { taken, openedCells } = packClass(cellsOf3, classBudget(45), CLASS_PACE, 2);
    expect(taken.map((item) => item.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5']);
    expect(openedCells).toEqual(['c1', 'c2']);
  });

  it('stops at C_max new cells even with minutes left', () => {
    const oneLessonCells = Array.from({ length: 6 }, (_, i) => lesson(`q${i}`, `c${i}`, 2));
    expect(packClass(oneLessonCells, classBudget(60), CLASS_PACE, 2).taken).toHaveLength(2);
    expect(packClass(oneLessonCells, classBudget(60), CLASS_PACE, 3).taken).toHaveLength(3);
  });

  it('counts only cells not opened before, and items with no cell open none', () => {
    const queue = [lesson('q1', 'c1'), lesson('story'), lesson('q2', 'c2'), lesson('q3', 'c3')];
    const result = packClass(queue, classBudget(60), CLASS_PACE, 1, { openedBefore: ['c1'] });
    expect(result.taken.map((item) => item.id)).toEqual(['q1', 'story', 'q2']);
    expect(result.openedCells).toEqual(['c2']);
  });

  it('is a take-while: the first item that does not fit ends the class day', () => {
    const queue = [lesson('a', 'c1', 5), lesson('b', 'c1', 20), lesson('c', 'c1', 1)];
    expect(packClass(queue, classBudget(30), CLASS_PACE, 2).taken.map((item) => item.id)).toEqual(['a']);
  });

  it('always takes the first item, even one longer than the budget', () => {
    const long = [lesson('long', 'c1', 30), lesson('next', 'c1', 5)];
    const result = packClass(long, classBudget(15), CLASS_PACE, 2);
    expect(result.taken.map((item) => item.id)).toEqual(['long']);
    expect(result.classMinutes).toBe(45);
    // C_max 0 still lets the first item through, and no further cell opens.
    const twoCells = [lesson('long', 'c1', 30), lesson('same', 'c1', 5), lesson('other', 'c2', 1)];
    expect(packClass(twoCells, classBudget(60), CLASS_PACE, 0).taken.map((item) => item.id)).toEqual(['long', 'same']);
  });

  it('returns nothing for an empty queue', () => {
    expect(packClass([], classBudget(30), CLASS_PACE, 2)).toEqual({ taken: [], rest: [], classMinutes: 0, openedCells: [] });
  });

  it('split hook: openers first, then the rest in queue order', () => {
    const packet = [lesson('a1', 'a'), lesson('a2', 'a'), lesson('b1', 'b'), lesson('b2', 'b'), lesson('a3', 'a')];
    const openers = new Set(['a1', 'b1']);
    const result = packClass(packet, classBudget(30), CLASS_PACE, 2, { isOpener: (item) => openers.has(item.id) });
    expect(result.taken.map((item) => item.id)).toEqual(['a1', 'b1', 'a2']);
    expect(result.rest.map((item) => item.id)).toEqual(['b2', 'a3']);
  });

  it('never mutates its input', () => {
    const queue = [lesson('a', 'c1'), lesson('b', 'c2')];
    const copy = structuredClone(queue);
    packClass(queue, 10, CLASS_PACE, 2, { isOpener: (item) => item.id === 'b' });
    expect(queue).toEqual(copy);
  });
});

describe('spreadPractice (section 6.2)', () => {
  const dates = ['2026-11-04', '2026-11-06', '2026-11-08'];
  const ids = (xs: ReadonlyArray<{ id: string }>): string[] => xs.map((item) => item.id);

  it('golden C: one class lesson a day, each with a Refresh', () => {
    const result = spreadPractice({ taught: [lesson('q1'), lesson('q2'), lesson('q3')] }, dates, 10);
    expect(result.days.map((day) => [day.date, ids(day.items), day.minutes, day.refresh])).toEqual([
      ['2026-11-04', ['q1'], 5, true],
      ['2026-11-06', ['q2'], 5, true],
      ['2026-11-08', ['q3'], 5, true],
    ]);
    expect(result.carry).toEqual([]);
  });

  it('golden E: 5 lessons over 3 days are 2, 2, 1, interleaved', () => {
    const taught = ['q1', 'q2', 'q3', 'q4', 'q5'].map((id) => lesson(id));
    const result = spreadPractice({ taught }, dates, 10);
    expect(result.days.map((day) => ids(day.items))).toEqual([['q1', 'q4'], ['q2', 'q5'], ['q3']]);
    expect(result.days.map((day) => day.refresh)).toEqual([false, false, true]);
  });

  it('orders carried-over lessons first, then the class lessons, then practice-only lessons', () => {
    const result = spreadPractice(
      { carried: [lesson('old')], taught: [lesson('t1'), lesson('t2')], practiceOnly: [lesson('p1'), lesson('p2'), lesson('p3')] },
      dates,
      10,
    );
    expect(result.days.map((day) => ids(day.items))).toEqual([['old', 'p1'], ['t1', 'p2'], ['t2', 'p3']]);
  });

  it('never goes over the budget by more than one item and carries the rest forward in order', () => {
    const taught = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => lesson(id, undefined, 4));
    const result = spreadPractice({ taught }, dates.slice(0, 2), 10);
    expect(result.days.map((day) => [ids(day.items), day.minutes])).toEqual([
      [['a', 'c', 'e'], 12],
      [['b', 'd', 'f'], 12],
    ]);
    expect(ids(result.carry)).toEqual(['g', 'h']);
  });

  it('flags Refresh on a day with no lesson or at least 3 minutes of room', () => {
    const result = spreadPractice({ taught: [lesson('a', undefined, 8)] }, dates, 10);
    expect(result.days.map((day) => [ids(day.items), day.refresh])).toEqual([
      [['a'], false],
      [[], true],
      [[], true],
    ]);
    expect(spreadPractice({ taught: [lesson('a', undefined, 7)] }, dates.slice(0, 1), 10).days[0]?.refresh).toBe(true);
  });

  it('a cycle with no practice day carries everything', () => {
    const result = spreadPractice({ carried: [lesson('a')], taught: [lesson('b')] }, [], 10);
    expect(result.days).toEqual([]);
    expect(ids(result.carry)).toEqual(['a', 'b']);
  });

  it('takes any of the three lists on its own, and nothing gives Refresh days', () => {
    expect(ids(spreadPractice({ practiceOnly: [lesson('p')] }, dates.slice(0, 1), 10).days[0]?.items ?? [])).toEqual(['p']);
    expect(spreadPractice({}, dates.slice(0, 2), 10).days.map((day) => day.refresh)).toEqual([true, true]);
  });

  it('places a day in date order whatever order the dates come in', () => {
    const result = spreadPractice({ taught: [lesson('a'), lesson('b')] }, ['2026-11-08', '2026-11-04'], 10);
    expect(result.days.map((day) => [day.date, ids(day.items)])).toEqual([
      ['2026-11-04', ['a']],
      ['2026-11-08', ['b']],
    ]);
  });
});

/**
 * Property tests (section 20): over random class days, practice counts, lengths and minutes, a whole route of class
 * days and practice days packed with these helpers keeps (1) every practice date after its class day, (2) round robin
 * within one item, and (3) no item lost or duplicated.
 */
describe('class and practice packing, properties', () => {
  interface Lesson extends PackItem {
    id: string;
    classDate?: string;
  }

  const routeArb = fc.record({
    lecture: fc.uniqueArray(fc.constantFrom(...WEEKDAYS), { minLength: 1, maxLength: 5 }),
    perWeek: fc.integer({ min: 1, max: 7 }),
    weeks: fc.integer({ min: 1, max: 6 }),
    startOffset: fc.integer({ min: 0, max: 6 }),
    classMinutes: fc.constantFrom(15, 20, 30, 45, 60),
    practiceMinutes: fc.constantFrom(5, 10, 15, 20, 30),
    lessonMinutes: fc.array(fc.integer({ min: 1, max: 12 }), { minLength: 0, maxLength: 80 }),
    cellSize: fc.integer({ min: 1, max: 4 }),
  });

  it('places every practice item after its class day, round robin within one item, nothing lost or duplicated', () => {
    fc.assert(
      fc.property(routeArb, (r) => {
        const queue: Lesson[] = r.lessonMinutes.map((minutes, i) => ({ id: `q${i}`, minutes, cellId: `c${Math.floor(i / r.cellSize)}` }));
        const route = cyclesOf({ startDate: addDays('2026-11-02', r.startOffset), weeks: r.weeks, lectureDays: r.lecture, perWeek: r.perWeek });
        let rest: Lesson[] = queue;
        let carry: Lesson[] = [];
        const opened: string[] = [];
        const taughtIds: string[] = [];
        const placed: Array<{ id: string; date: string; classDate: string }> = [];
        for (const cycle of route.cycles) {
          const pack = packClass(rest, classBudget(r.classMinutes), CLASS_PACE, 2, { openedBefore: opened });
          opened.push(...pack.openedCells);
          rest = pack.rest;
          const taught = pack.taken.map((item) => ({ ...item, classDate: cycle.classDate }));
          taughtIds.push(...taught.map((item) => item.id));
          const spread = spreadPractice({ carried: carry, taught }, cycle.practiceDates, r.practiceMinutes);
          for (const day of spread.days) {
            for (const item of day.items) placed.push({ id: item.id, date: day.date, classDate: item.classDate ?? '' });
            // Never over the budget by more than one item.
            const last = day.items.at(-1);
            if (last) expect(day.minutes - last.minutes).toBeLessThan(r.practiceMinutes);
            expect(day.refresh).toBe(day.items.length === 0 || r.practiceMinutes - day.minutes >= REFRESH_MIN_ROOM);
          }
          // Round robin: a day with two or more items fewer than another is full.
          const counts = spread.days.map((day) => day.items.length);
          const most = Math.max(0, ...counts);
          for (const day of spread.days) if (day.items.length < most - 1) expect(day.minutes).toBeGreaterThanOrEqual(r.practiceMinutes);
          carry = spread.carry;
        }
        // (1) Practice after its class day.
        for (const item of placed) expect(item.date > item.classDate).toBe(true);
        // (3) No item lost or duplicated: taught = placed + carried, each once; taught + untaught = queue.
        const placedIds = placed.map((item) => item.id);
        expect(new Set(placedIds).size).toBe(placedIds.length);
        expect([...placedIds, ...carry.map((item) => item.id)].sort()).toEqual([...taughtIds].sort());
        expect([...taughtIds, ...rest.map((item) => item.id)]).toEqual(queue.map((item) => item.id));
      }),
    );
  });

  it('round robin is exact when every lesson has the same minutes', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30 }), fc.integer({ min: 1, max: 7 }), fc.integer({ min: 1, max: 10 }), (count, days, minutes) => {
        const taught = Array.from({ length: count }, (_, i) => lesson(`q${i}`, undefined, minutes));
        const dates = Array.from({ length: days }, (_, i) => addDays('2026-11-04', i));
        const result = spreadPractice({ taught }, dates, 30);
        const counts = result.days.map((day) => day.items.length);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
        // Earlier days never hold fewer items than later ones.
        for (let i = 1; i < counts.length; i += 1) expect(counts[i - 1]).toBeGreaterThanOrEqual(counts[i] ?? 0);
      }),
    );
  });
});
