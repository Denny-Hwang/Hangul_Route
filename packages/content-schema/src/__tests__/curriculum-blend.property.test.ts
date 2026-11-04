import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CURRICULUM_MAX_ITEMS,
  WEEKDAYS,
  addDays,
  generateCurriculum,
  regenerateFrom,
  toMeta,
  toPlanItems,
  weekdayOf,
  type Catalog,
  type CatalogCell,
  type CatalogQuest,
  type CurriculumDraft,
  type CurriculumParamsInput,
  type StageKey,
  type ThemeKey,
  type Weekday,
} from '..';
import { CLASS_PACE, cyclesOf, practiceDaysFor } from '../curriculum/blend';
import { CLASS_DAY_MAX_LESSONS } from '../curriculum/generate-blend';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND section 20, `curriculum-blend.property.test.ts` (row BL-2): the seven properties of the
 * blended generator over random class days (1-5), practice sessions (1-7), lengths, lesson minutes, modes, start
 * weekdays and days off. The calendar is rebuilt here from `cyclesOf`, independently of the generator's walk.
 */

const STAGES: StageKey[] = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'];
const THEMES: ThemeKey[] = ['letters', 'life', 'rites', 'nature', 'crafts'];

/** A catalogue big enough for the 260-item cap: 35 shipped cells of `size(i)` lessons of `minutes(i, j)` minutes. */
function syntheticCatalog(size: (cell: number) => number, minutes: (cell: number, lesson: number) => number): Catalog {
  const cells: CatalogCell[] = [];
  const quests: CatalogQuest[] = [];
  let index = 0;
  for (const stage of STAGES) {
    for (const theme of THEMES) {
      const episodeId = `episode:${stage}-${theme}`;
      const ids = Array.from({ length: size(index) }, (_, j) => `quest:${stage}-${theme}-q${j + 1}`);
      ids.forEach((id, j) => {
        quests.push({ id, episodeId, stage, theme, title: id, minutes: minutes(index, j), teaches: [], kind: 'lesson' });
      });
      cells.push({ stage, theme, episodeId, title: episodeId, status: 'shipped', minutes: 10, questIds: ids });
      index += 1;
    }
  }
  return { version: 1, cells, quests, stories: [], topics: [] };
}

/** Varied: cells of 1 to 9 lessons of 2 to 8 minutes (the 260-item cap and C_max both bind somewhere). */
const VARIED = syntheticCatalog(
  (cell) => 1 + ((cell * 5) % 9),
  (cell, lesson) => 2 + ((cell * 3 + lesson * 5) % 7),
);
/** Section 6.5's assumptions: 5-minute lessons in cells of 3. */
const EVEN = syntheticCatalog(() => 3, () => 5);

const cellOf = new Map(VARIED.quests.map((quest) => [quest.id, quest.episodeId]));
const firstOfCell = new Map(VARIED.cells.map((cell) => [cell.episodeId, cell.questIds[0]]));
const lessonsIn = (catalog: Catalog): number => catalog.quests.length;

interface Case {
  lecture: Weekday[];
  perWeek: number;
  classMinutes: 15 | 20 | 30 | 45 | 60;
  practiceMinutes: 5 | 10 | 15 | 20 | 30;
  mode: 'overlap' | 'split';
  startOffset: number;
  weeks: number;
  reviewEvery: 0 | 3 | 4 | 6;
  /** Days off as offsets from the start (none, or one range), and class days off by cycle index. */
  daysOff: Array<[number, number]>;
  classOff: number[];
}

const caseArb: fc.Arbitrary<Case> = fc.record({
  lecture: fc.uniqueArray(fc.constantFrom(...WEEKDAYS), { minLength: 1, maxLength: 5 }),
  perWeek: fc.integer({ min: 1, max: 7 }),
  classMinutes: fc.constantFrom(15 as const, 20 as const, 30 as const, 45 as const, 60 as const),
  practiceMinutes: fc.constantFrom(5 as const, 10 as const, 15 as const, 20 as const, 30 as const),
  mode: fc.constantFrom('overlap' as const, 'split' as const),
  startOffset: fc.integer({ min: 0, max: 6 }),
  weeks: fc.integer({ min: 1, max: 20 }),
  reviewEvery: fc.constantFrom(0 as const, 3 as const, 4 as const, 6 as const),
  daysOff: fc.oneof(
    { weight: 3, arbitrary: fc.constant([] as Array<[number, number]>) },
    { weight: 1, arbitrary: fc.tuple(fc.integer({ min: 0, max: 60 }), fc.integer({ min: 0, max: 13 })).map(([from, length]) => [[from, from + length] as [number, number]]) },
  ),
  classOff: fc.oneof({ weight: 3, arbitrary: fc.constant([] as number[]) }, { weight: 1, arbitrary: fc.uniqueArray(fc.integer({ min: 0, max: 30 }), { maxLength: 3 }) }),
});

const START = '2026-11-02';

function paramsOf(c: Case): CurriculumParamsInput | undefined {
  const startDate = addDays(START, c.startOffset);
  if (c.weeks * (c.lecture.length + c.perWeek) > CURRICULUM_MAX_ITEMS) return undefined;
  const route = cyclesOf({ startDate, weeks: c.weeks, lectureDays: c.lecture, perWeek: c.perWeek });
  const classDaysOff = c.classOff.flatMap((i) => (route.cycles[i] === undefined ? [] : [route.cycles[i].classDate]));
  return {
    audience: 'class',
    level: { stage: 'stage1', band: 0 },
    startDate,
    weeks: c.weeks,
    sessionsPerWeek: 1,
    minutesPerSession: 10,
    goals: { focus: 'reading' },
    daysOff: c.daysOff.map(([from, to]) => ({ from: addDays(startDate, from), to: addDays(startDate, to) })),
    unlockedStages: [...STAGES],
    reviewEvery: c.reviewEvery,
    includeComingSoon: false,
    blend: {
      mode: c.mode,
      lecture: { days: c.lecture, minutes: c.classMinutes },
      personal: { perWeek: c.perWeek, minutes: c.practiceMinutes },
      classDaysOff,
    },
  };
}

/** The route's calendar as section 6.3 defines it, days off applied. */
function calendarOf(params: CurriculumParamsInput) {
  const blend = params.blend;
  if (blend === undefined) throw new Error('not blended');
  const practiceDays = blend.personal.days ?? practiceDaysFor(blend.lecture.days, blend.personal.perWeek);
  const route = cyclesOf({ startDate: params.startDate, weeks: params.weeks, lectureDays: blend.lecture.days, practiceDays });
  const off = (date: string): boolean => (params.daysOff ?? []).some((range) => range.from <= date && date <= range.to);
  const classOff = new Set(blend.classDaysOff ?? []);
  const cycles = route.cycles.map((cycle) => ({
    ...cycle,
    held: !off(cycle.classDate) && !classOff.has(cycle.classDate),
    practice: cycle.practiceDates.filter((date) => !off(date)),
  }));
  return { route, cycles, practiceDays };
}

const byDate = (draft: CurriculumDraft): Map<string, CurriculumDraft['items']> => {
  const out = new Map<string, CurriculumDraft['items']>();
  for (const item of draft.items) out.set(item.targetDate ?? '', [...(out.get(item.targetDate ?? '') ?? []), item]);
  return out;
};

const minutesOf = (catalog: Catalog): Map<string, number> => new Map(catalog.quests.map((quest) => [quest.id, quest.minutes]));

function checkAll(c: Case, params: CurriculumParamsInput, draft: CurriculumDraft): void {
  const { route, cycles, practiceDays } = calendarOf(params);
  const L = c.lecture.length;
  const P = c.perWeek;
  const noDaysOff = c.daysOff.length === 0 && (params.blend?.classDaysOff ?? []).length === 0;
  const items = byDate(draft);
  const refresh = new Set((draft.refresh ?? []).map((entry) => entry.date));
  const minutes = minutesOf(VARIED);

  // (1) Sessions: L + P a week minus days off (the first class day holds no practice), each practice session with a
  // lesson or a Refresh, and no lesson on the class day that taught it.
  const held = cycles.filter((cycle) => cycle.held).length;
  const practice = cycles.flatMap((cycle) => cycle.practice);
  expect(draft.stats.sessions).toBe(held + practice.length);
  expect(draft.stats.byTrack?.lecture.sessions).toBe(held);
  expect(draft.stats.byTrack?.personal.sessions).toBe(practice.length);
  if (noDaysOff) {
    const firstHoldsPractice = practiceDays.includes(weekdayOf(route.firstClassDate));
    for (let week = 1; week <= c.weeks; week += 1) {
      const from = addDays(route.firstClassDate, 7 * (week - 1));
      const to = addDays(from, 6);
      const count = cycles.filter((cycle) => cycle.classDate >= from && cycle.classDate <= to).length + practice.filter((date) => date >= from && date <= to).length;
      expect(count).toBe(L + P - (week === 1 && firstHoldsPractice ? 1 : 0));
    }
  }
  // Named exception (sections 5.3 and 6.2): a practice date before any class has taught a lesson has no cell to
  // refresh, so it holds neither; the device offers Daily Review there.
  const firstTaught = draft.items.map((item) => item.lectureDate).filter((date): date is string => date !== undefined).sort()[0];
  const nothingTaughtYet = (date: string): boolean => firstTaught === undefined || date <= firstTaught;
  for (const date of practice) {
    if (nothingTaughtYet(date)) continue;
    expect((items.get(date)?.length ?? 0) > 0 || refresh.has(date)).toBe(true);
  }
  for (const item of draft.items) if (item.lectureDate !== undefined) expect(item.targetDate! > item.lectureDate).toBe(true);
  // Every dated item sits on a practice session.
  const sessionSet = new Set(practice);
  for (const item of draft.items) expect(sessionSet.has(item.targetDate!)).toBe(true);

  // (3) G4: every class lesson is played within two class cycles of its class day; P < L carries `practice-short`.
  // "Two cycles" counts the cycles that hold a practice date (section 6.2: a cycle with none carries into the next).
  if (noDaysOff) {
    for (const item of draft.items) {
      if (item.lectureDate === undefined) continue;
      const at = cycles.findIndex((cycle) => cycle.classDate === item.lectureDate);
      const holding = cycles.slice(at).filter((cycle) => cycle.practice.length > 0);
      const deadline = holding[1] ?? holding[0];
      expect(deadline).toBeDefined();
      expect(item.targetDate! <= (deadline?.practice.at(-1) ?? '')).toBe(true);
    }
  }
  expect(draft.warnings.some((warning) => warning.code === 'practice-short')).toBe(P < L);

  // (2) G3 for every P >= L, as built (section 6.2): a learn class day held back below its floor is flagged. A held
  // class day that teaches nothing while a later one teaches carries `class-paced` (review slots excepted).
  if (P >= L) {
    const taughtOn = new Set(draft.items.flatMap((item) => (item.lectureDate === undefined ? [] : [item.lectureDate])));
    const lastTaught = [...taughtOn].sort().at(-1) ?? '';
    const reviewSlot = (index: number): boolean => c.reviewEvery > 0 && (index + 1) % c.reviewEvery === 0;
    const heldBack = cycles.some((cycle, index) => cycle.held && !reviewSlot(index) && !taughtOn.has(cycle.classDate) && cycle.classDate < lastTaught);
    if (heldBack && !draft.warnings.some((warning) => warning.code === 'item-cap')) {
      expect(draft.warnings.map((warning) => warning.code)).toContain('class-paced');
    }
  }

  // (4) Round robin: within a cycle, a practice day two or more items behind another is full.
  for (const cycle of cycles) {
    const days = cycle.practice.map((date) => items.get(date) ?? []);
    const most = Math.max(0, ...days.map((day) => day.length));
    for (const day of days) {
      if (day.length >= most - 1) continue;
      expect(day.reduce((sum, item) => sum + (minutes.get(item.id) ?? 0), 0)).toBeGreaterThanOrEqual(c.practiceMinutes);
    }
  }

  // (5) No item lost or duplicated: every lesson is placed once or reported as not placed.
  const ids = draft.items.map((item) => item.id);
  expect(new Set(ids).size).toBe(ids.length);
  const leftover = draft.warnings.find((warning) => warning.code === 'fewer-sessions-than-units')?.count ?? 0;
  expect(ids.length + leftover).toBe(lessonsIn(VARIED));
  expect(ids.length).toBeLessThanOrEqual(CURRICULUM_MAX_ITEMS);

  // (6) Split: a practice-only item's cell has its opener on a class day strictly before the item's date.
  const lectureOf = new Map(draft.items.map((item) => [item.id, item.lectureDate]));
  for (const item of draft.items) {
    if (item.lectureDate !== undefined) continue;
    expect(c.mode).toBe('split');
    const opener = firstOfCell.get(cellOf.get(item.id) ?? '') ?? '';
    const openedOn = lectureOf.get(opener);
    expect(openedOn).toBeDefined();
    expect(openedOn! < item.targetDate!).toBe(true);
  }
  // (7) Overlap: every item came from a class day.
  if (c.mode === 'overlap') expect(draft.items.every((item) => item.lectureDate !== undefined)).toBe(true);

  // Never more than 28 lessons on one class day.
  const perClass = new Map<string, number>();
  for (const item of draft.items) if (item.lectureDate) perClass.set(item.lectureDate, (perClass.get(item.lectureDate) ?? 0) + 1);
  for (const count of perClass.values()) expect(count).toBeLessThanOrEqual(CLASS_DAY_MAX_LESSONS);
  expect(draft.generatorVersion).toBe(2);
}

describe('blended generator, properties (section 20)', () => {
  it('holds the sessions, G4, round robin, no loss, the opener invariant and overlap for random plans', () => {
    fc.assert(
      fc.property(caseArb, (c) => {
        const params = paramsOf(c);
        fc.pre(params !== undefined);
        checkAll(c, params as CurriculumParamsInput, generateCurriculum(params as CurriculumParamsInput, VARIED));
      }),
      // Seeded, so a counterexample reproduces; change the seed locally to explore.
      { numRuns: 200, seed: 42 },
    );
  });

  it('re-pacing keeps what earlier class days taught: same class date, no duplicate, at most 260 items', () => {
    fc.assert(
      fc.property(caseArb, fc.integer({ min: 1, max: 140 }), fc.constantFrom('shift' as const, 'requeue' as const), (c, offset, mode) => {
        const params = paramsOf(c);
        fc.pre(params !== undefined);
        const draft = generateCurriculum(params as CurriculumParamsInput, VARIED);
        const stored = { meta: toMeta(draft), items: toPlanItems(draft) };
        const today = addDays((params as CurriculumParamsInput).startDate, offset);
        const done = stored.items.filter((item) => item.targetDate! < today).map((item) => item.id);
        const next = regenerateFrom(stored, today, VARIED, { mode, completedQuestIds: done });
        const ids = next.items.map((item) => item.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.length).toBeLessThanOrEqual(CURRICULUM_MAX_ITEMS);
        for (const item of stored.items) {
          if (item.lectureDate === undefined || item.lectureDate >= today) continue;
          const now = next.items.find((entry) => entry.id === item.id);
          // Placed again with its class date, or left over when no practice date is left on the route.
          if (now !== undefined) expect(now.lectureDate).toBe(item.lectureDate);
        }
        expect((next.refresh ?? []).filter((entry) => entry.date < today)).toEqual((draft.refresh ?? []).filter((entry) => entry.date < today));
      }),
      { numRuns: 60, seed: 42 },
    );
  });

  // (2) G3 by name: with P >= L at 30 / 10 minutes, a learn class day carries at least one practice day's load, and
  // its class minutes are at least a practice day's minutes.
  it.each([
    [['tue'], 1],
    [['tue'], 3],
    [['mon', 'thu'], 3],
    [['mon', 'wed', 'fri'], 4],
  ] as Array<[Weekday[], number]>)('G3: %j with %i practice days', (lecture, perWeek) => {
    for (const mode of ['overlap', 'split'] as const) {
      const params: CurriculumParamsInput = {
        ...(paramsOf({ lecture, perWeek, classMinutes: 30, practiceMinutes: 10, mode, startOffset: 0, weeks: 8, reviewEvery: 0, daysOff: [], classOff: [] }) as CurriculumParamsInput),
      };
      const draft = generateCurriculum(params, EVEN);
      const perClass = new Map<string, number>();
      for (const item of draft.items) if (item.lectureDate) perClass.set(item.lectureDate, (perClass.get(item.lectureDate) ?? 0) + 1);
      const perDay = new Map<string, number>();
      for (const item of draft.items) perDay.set(item.targetDate!, (perDay.get(item.targetDate!) ?? 0) + 5);
      const practiceMost = Math.max(...perDay.values());
      expect(perClass.size).toBe(8 * lecture.length);
      for (const count of perClass.values()) {
        expect(count).toBeGreaterThanOrEqual(Math.floor(10 / 5));
        expect(CLASS_PACE * 5 * count).toBeGreaterThanOrEqual(practiceMost);
      }
      expect(draft.warnings.map((warning) => warning.code)).not.toContain('practice-short');
    }
  });

  // (3) G4 by name with fewer practice days than class days.
  it.each([
    [['mon', 'thu'], 1],
    [['mon', 'tue', 'wed', 'thu', 'fri'], 2],
  ] as Array<[Weekday[], number]>)('G4 and practice-short: %j with %i practice days', (lecture, perWeek) => {
    for (const mode of ['overlap', 'split'] as const) {
      const c: Case = { lecture, perWeek, classMinutes: 30, practiceMinutes: 10, mode, startOffset: 0, weeks: 8, reviewEvery: 0, daysOff: [], classOff: [] };
      const params = paramsOf(c) as CurriculumParamsInput;
      const draft = generateCurriculum(params, VARIED);
      checkAll(c, params, draft);
      expect(draft.warnings.map((warning) => warning.code)).toContain('practice-short');
      expect(draft.items.length).toBeGreaterThan(0);
    }
  });
});
