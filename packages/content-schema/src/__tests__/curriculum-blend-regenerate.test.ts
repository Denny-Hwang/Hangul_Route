import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import {
  addDays,
  generateCurriculum,
  regenerateFrom,
  toMeta,
  toPlanItems,
  type CurriculumDraft,
  type CurriculumMeta,
  type CurriculumParamsInput,
  type PlanItem,
} from '..';
import { cyclesOf, practiceDaysFor } from '../curriculum/blend';
// Installs the blended path into generateCurriculum and regenerateFrom (the `blend-generator` subpath, row BL-2).
import { BLEND_GENERATOR_VERSION } from '../curriculum/generate-blend';
import { CATALOG_2026_10 } from './fixtures/catalog-2026-10';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND sections 10.2, 12.1 and 14 (row BL-3; F-PLAN-002 section 3.7 as amended by BL-A3):
 * `regenerateFrom` `shift` with `classDay` (Move this class day) and with a `params` override (Add practice days,
 * Stop practice days), on the plans of goldens C (overlap) and D (split).
 */

type Blend = NonNullable<CurriculumParamsInput['blend']>;
interface StoredPlan {
  meta: CurriculumMeta;
  items: PlanItem[];
}

const BLEND_C: Blend = { mode: 'overlap', lecture: { days: ['tue'], minutes: 30 }, personal: { perWeek: 3, minutes: 10 } };
const BLEND_D: Blend = { ...BLEND_C, mode: 'split' };

/** The class-only plan a teacher upgrades: class on Tuesday plus two homework days, as goldens C and D otherwise. */
const CLASS_ONLY: CurriculumParamsInput = {
  audience: 'class',
  level: { stage: 'stage1', band: 0 },
  startDate: '2026-11-02',
  weeks: 26,
  sessionsPerWeek: 3,
  sessionDays: ['tue', 'thu', 'sat'],
  minutesPerSession: 10,
  goals: { focus: 'balanced', motivation: 'heritage' },
  unlockedStages: ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'],
  reviewEvery: 4,
};
const blended = (blend: Blend): CurriculumParamsInput => ({ ...CLASS_ONLY, sessionsPerWeek: 4, sessionDays: undefined, blend });

const FESTIVAL_STORIES = new Set(CATALOG_2026_10.stories.filter((story) => story.anchor !== null).map((story) => story.questId));

const planOf = (draft: CurriculumDraft): StoredPlan => ({ meta: toMeta(draft), items: toPlanItems(draft) });
const C = generateCurriculum(blended(BLEND_C), CATALOG_2026_10);
const D = generateCurriculum(blended(BLEND_D), CATALOG_2026_10);
const ONLY = generateCurriculum(CLASS_ONLY, CATALOG_2026_10);

const strip = (item: PlanItem & { week?: number }): PlanItem => {
  const { week: _week, ...rest } = item;
  return rest;
};
const before = (items: readonly PlanItem[], date: string): PlanItem[] => items.filter((item) => item.targetDate! < date).map(strip);
const ids = (items: readonly PlanItem[]): string[] => items.map((item) => item.id).sort();
/** Stored params without the device-side fields the generator adds. */
const storedOf = (draft: CurriculumDraft): Omit<CurriculumParamsInput, 'completedQuestIds'> => {
  const { completedQuestIds: _done, ...rest } = draft.params;
  return rest;
};

/** Every lesson taught in class is played after its class (section 9.2). */
const expectLectureBeforeTarget = (draft: CurriculumDraft): void => {
  for (const item of draft.items) if (item.lectureDate !== undefined) expect(item.targetDate! > item.lectureDate).toBe(true);
};

/** G4 (section 6.2): a lesson taught on or after `from` is played within two cycles that hold a practice date. */
const expectTwoCycleBound = (draft: CurriculumDraft, from: string): void => {
  const p = draft.params;
  const blend = p.blend!;
  const practiceDays = blend.personal.days ?? practiceDaysFor(blend.lecture.days, blend.personal.perWeek);
  const route = cyclesOf({ startDate: p.startDate, weeks: p.weeks, lectureDays: blend.lecture.days, practiceDays });
  const off = (date: string): boolean => p.daysOff.some((range) => range.from <= date && date <= range.to);
  const cycleOf = (date: string): number => route.cycles.findIndex((cycle) => cycle.classDate <= date && date <= addDays(cycle.endDate, 1)) ;
  for (const item of draft.items) {
    if (item.lectureDate === undefined || item.lectureDate < from) continue;
    const first = route.cycles.findIndex((cycle) => cycle.classDate === item.lectureDate);
    expect(first).toBeGreaterThanOrEqual(0);
    let seen = 0;
    let found = false;
    for (let i = first; i < route.cycles.length && seen < 2 && !found; i += 1) {
      const dates = route.cycles[i]!.practiceDates.filter((date) => !off(date) && date >= from);
      if (dates.length > 0) seen += 1;
      found = dates.includes(item.targetDate!);
    }
    expect(found, `${item.id} taught ${item.lectureDate}, played ${item.targetDate} (cycle ${cycleOf(item.targetDate!)})`).toBe(true);
  }
};

/**
 * BL-OD-4: a practice-only lesson dated on or after `from` has its cell's opener on a class day strictly before the
 * lesson's date (items before `from` may come from a class-only plan, which has no class dates).
 */
const expectOpenerInvariant = (draft: CurriculumDraft, from = ''): void => {
  const cellOf = new Map(CATALOG_2026_10.quests.map((quest) => [quest.id, quest.episodeId]));
  const classDates = new Map<string, string>();
  for (const item of draft.items) {
    const cell = cellOf.get(item.id);
    if (cell === undefined || item.lectureDate === undefined) continue;
    const seen = classDates.get(cell);
    if (seen === undefined || item.lectureDate < seen) classDates.set(cell, item.lectureDate);
  }
  for (const item of draft.items) {
    const cell = cellOf.get(item.id);
    if (cell === undefined || item.lectureDate !== undefined || item.targetDate! < from) continue;
    const opened = classDates.get(cell);
    expect(opened !== undefined && opened < item.targetDate!, `${item.id} on ${item.targetDate}`).toBe(true);
  }
};

describe('Move this class day (section 10.2, BL-OD-8)', () => {
  const today = '2026-11-30';
  const classDay = '2026-12-08';

  for (const [name, draft] of [['C (overlap)', C], ['D (split)', D]] as const) {
    describe(`golden ${name}`, () => {
      const moved = regenerateFrom(planOf(draft), today, CATALOG_2026_10, { mode: 'shift', classDay });

      it('nothing done is moved or lost: every item before the class day stays, and every item is still in the plan', () => {
        expect(before(moved.items, classDay)).toEqual(before(draft.items, classDay));
        expect(ids(moved.items)).toEqual(ids(draft.items));
        expect(moved.generatorVersion).toBe(BLEND_GENERATOR_VERSION);
      });

      it('past items are untouched', () => {
        expect(before(moved.items, today)).toEqual(before(draft.items, today));
        expect(moved.weeks.slice(0, 4)).toEqual(draft.weeks.slice(0, 4));
        const pastRefresh = (d: CurriculumDraft) => d.refresh!.filter((entry) => entry.date < classDay);
        expect(pastRefresh(moved)).toEqual(pastRefresh(draft));
        expect(pastRefresh(moved).length).toBeGreaterThan(0);
      });

      it('records the class day as a class day off, and teaches nothing on it', () => {
        expect(moved.params.blend?.classDaysOff).toEqual([classDay]);
        expect(moved.items.some((item) => item.lectureDate === classDay)).toBe(false);
      });

      it("moves that class day's lessons to the next class day, and every later class day's after them", () => {
        const wasThatDay = draft.items.filter((item) => item.lectureDate === classDay).map((item) => item.id);
        expect(wasThatDay.length).toBeGreaterThan(0);
        const now = new Map(moved.items.map((item) => [item.id, item]));
        expect(now.get(wasThatDay[0]!)?.lectureDate).toBe(addDays(classDay, 7));
        let anchored = 0;
        for (const item of draft.items) {
          if (item.lectureDate === undefined || item.lectureDate < classDay) continue;
          const lectureDate = now.get(item.id)!.lectureDate!;
          // A festival's story stays in its festival's cycle (F-PLAN-002 section 3.3 step 5); everything else moves on.
          if (FESTIVAL_STORIES.has(item.id)) {
            anchored += 1;
            expect(lectureDate >= item.lectureDate).toBe(true);
          } else expect(lectureDate > item.lectureDate, item.id).toBe(true);
        }
        expect(anchored).toBeGreaterThan(0);
      });

      it('keeps the lessons of earlier class days on their class day', () => {
        const now = new Map(moved.items.map((item) => [item.id, item]));
        for (const item of draft.items) {
          if (item.lectureDate !== undefined && item.lectureDate < classDay) expect(now.get(item.id)?.lectureDate).toBe(item.lectureDate);
        }
      });

      it('keeps lectureDate before targetDate, and the two-cycle bound', () => {
        expectLectureBeforeTarget(moved);
        expectTwoCycleBound(moved, classDay);
      });
    });
  }

  it('split: practice-only lessons move after their opener, and the opener invariant holds', () => {
    const moved = regenerateFrom(planOf(D), today, CATALOG_2026_10, { mode: 'shift', classDay });
    expectOpenerInvariant(D);
    expectOpenerInvariant(moved);
  });

  it('a class day that has already gone by: its lessons not yet played move, its past items stay', () => {
    const missed = '2026-12-01';
    const later = '2026-12-03';
    const moved = regenerateFrom(planOf(C), later, CATALOG_2026_10, { mode: 'shift', classDay: missed });
    expect(before(moved.items, later)).toEqual(before(C.items, later));
    expect(ids(moved.items)).toEqual(ids(C.items));
    for (const item of moved.items) {
      if (item.targetDate! >= later) expect(item.lectureDate === undefined || item.lectureDate !== missed).toBe(true);
    }
    expectLectureBeforeTarget(moved);
    expectTwoCycleBound(moved, later);
  });

  it('moving the same class day twice changes nothing more', () => {
    const once = regenerateFrom(planOf(C), today, CATALOG_2026_10, { mode: 'shift', classDay });
    const twice = regenerateFrom(planOf(once), today, CATALOG_2026_10, { mode: 'shift', classDay });
    expect(toPlanItems(twice)).toEqual(toPlanItems(once));
    expect(twice.params.blend?.classDaysOff).toEqual([classDay]);
  });

  it('refuses a plan without class days and practice days, a day that is not a class day, and a day outside the route', () => {
    expect(() => regenerateFrom(planOf(ONLY), today, CATALOG_2026_10, { mode: 'shift', classDay })).toThrow(/class days and practice days/);
    expect(() => regenerateFrom(planOf(C), today, CATALOG_2026_10, { mode: 'shift', classDay: '2026-12-09' })).toThrow(/not a class day/);
    expect(() => regenerateFrom(planOf(C), today, CATALOG_2026_10, { mode: 'shift', classDay: '2028-01-04' })).toThrow(/outside the route/);
    expect(() => regenerateFrom(planOf(C), today, CATALOG_2026_10, { mode: 'shift', classDay: '2026-12-32' })).toThrow();
    expect(() => regenerateFrom(planOf(C), today, CATALOG_2026_10, { mode: 'requeue', classDay })).toThrow(/shift/);
  });
});

describe('Add practice days and Stop practice days (section 14)', () => {
  const today = '2026-11-30';

  for (const [name, blend] of [['C (overlap)', BLEND_C], ['D (split)', BLEND_D]] as const) {
    describe(`to and from golden ${name}`, () => {
      const added = regenerateFrom(planOf(ONLY), today, CATALOG_2026_10, { mode: 'shift', params: { ...storedOf(ONLY), blend } });

      it('Add: past items stay, the future is laid again as a blended plan with every item', () => {
        expect(added.generatorVersion).toBe(BLEND_GENERATOR_VERSION);
        expect(added.params.blend?.mode).toBe(blend.mode);
        expect(before(added.items, today)).toEqual(before(ONLY.items, today));
        expect(ids(added.items)).toEqual(ids(ONLY.items));
        const future = added.items.filter((item) => item.targetDate! >= today);
        expect(future.length).toBeGreaterThan(0);
        expect(future.filter((item) => item.lectureDate !== undefined).length).toBeGreaterThan(0);
        if (blend.mode === 'overlap') expect(future.every((item) => item.lectureDate !== undefined)).toBe(true);
        expect(added.refresh?.length).toBeGreaterThan(0);
        expectLectureBeforeTarget(added);
        expectTwoCycleBound(added, today);
        if (blend.mode === 'split') expectOpenerInvariant(added, today);
      });

      it('Stop: the future is laid again without class days, past items stay, nothing is lost', () => {
        const later = '2026-12-14';
        const stopped = regenerateFrom(planOf(added), later, CATALOG_2026_10, { mode: 'shift', params: storedOf(ONLY) });
        expect(stopped.generatorVersion).toBe(1);
        expect(stopped.params.blend).toBeUndefined();
        expect(stopped.refresh).toBeUndefined();
        expect(before(stopped.items, later)).toEqual(before(added.items, later));
        expect(ids(stopped.items)).toEqual(ids(ONLY.items));
        expect(stopped.items.filter((item) => item.targetDate! >= later).every((item) => item.lectureDate === undefined)).toBe(true);
      });

      it('round trip on the same day: Add then Stop gives the class-only plan back', () => {
        const stopped = regenerateFrom(planOf(added), today, CATALOG_2026_10, { mode: 'shift', params: storedOf(ONLY) });
        expect(toPlanItems(stopped)).toEqual(toPlanItems(ONLY));
      });

      it('the other way: Stop then Add on golden ' + name + ' keeps every item and the past', () => {
        const golden = blend.mode === 'overlap' ? C : D;
        const stopped = regenerateFrom(planOf(golden), today, CATALOG_2026_10, { mode: 'shift', params: storedOf(ONLY) });
        const back = regenerateFrom(planOf(stopped), today, CATALOG_2026_10, { mode: 'shift', params: storedOf(golden) });
        expect(before(back.items, today)).toEqual(before(golden.items, today));
        expect(ids(stopped.items)).toEqual(ids(golden.items));
        expect(ids(back.items)).toEqual(ids(golden.items));
        expectLectureBeforeTarget(back);
        expectTwoCycleBound(back, today);
        if (blend.mode === 'split') expectOpenerInvariant(back, today);
      });
    });
  }

  it('a params override with a class day moves that class day on the new plan', () => {
    const classDay = '2026-12-08';
    const added = regenerateFrom(planOf(ONLY), today, CATALOG_2026_10, { mode: 'shift', params: { ...storedOf(ONLY), blend: BLEND_C }, classDay });
    expect(added.params.blend?.classDaysOff).toEqual([classDay]);
    expect(added.items.some((item) => item.lectureDate === classDay)).toBe(false);
  });
});

describe('plain shift of a blended plan (BL-3 keeps what class has taught)', () => {
  it('a lesson taught before today and not yet played keeps its class day', () => {
    const today = '2026-12-02';
    const shifted = regenerateFrom(planOf(C), today, CATALOG_2026_10, { mode: 'shift' });
    const taught = C.items.filter((item) => item.lectureDate !== undefined && item.lectureDate < today && item.targetDate! >= today);
    expect(taught.length).toBeGreaterThan(0);
    const now = new Map(shifted.items.map((item) => [item.id, item]));
    for (const item of taught) expect(now.get(item.id)?.lectureDate).toBe(item.lectureDate);
    expect(toPlanItems(shifted)).toEqual(toPlanItems(C));
  });
});

describe('the class days before today are rebuilt from what they taught', () => {
  it('a past class day off and a past week off: the plan shifted on a later day is the same plan', () => {
    const draft = generateCurriculum(
      { ...blended({ ...BLEND_C, classDaysOff: ['2026-11-17'] }), daysOff: [{ from: '2026-11-23', to: '2026-11-29' }] },
      CATALOG_2026_10,
    );
    const shifted = regenerateFrom(planOf(draft), '2026-12-09', CATALOG_2026_10, { mode: 'shift' });
    expect(toPlanItems(shifted)).toEqual(toPlanItems(draft));
    expect(shifted.weeks).toEqual(draft.weeks);
    expect(shifted.refresh).toEqual(draft.refresh);
  });

  it('a coming-soon cell taught in class and not played yet keeps its note and its class day', () => {
    const draft = generateCurriculum(blended(BLEND_C), CATALOG_2026_10);
    const soon = toPlanItems(draft).find((item) => item.kind === 'episode')!;
    const today = addDays(soon.lectureDate!, 1);
    const shifted = regenerateFrom(planOf(draft), today, CATALOG_2026_10, { mode: 'shift' });
    const now = shifted.items.find((item) => item.id === soon.id)!;
    expect(now.lectureDate).toBe(soon.lectureDate);
    expect(toPlanItems(shifted).find((item) => item.id === soon.id)?.note).toBe('Coming soon');
  });
});

describe('property: Move this class day on any class day, from any day before it', () => {
  it('nothing done is moved or lost, lectureDate stays before targetDate, the opener invariant and the two-cycle bound hold', () => {
    const classDates = C.items.flatMap((item) => (item.lectureDate === undefined ? [] : [item.lectureDate]));
    const days = [...new Set(classDates)].sort();
    fc.assert(
      fc.property(fc.constantFrom(C, D), fc.constantFrom(...days), fc.integer({ min: -3, max: 13 }), (draft, classDay, back) => {
        const today = addDays(classDay, -back);
        const moved = regenerateFrom(planOf(draft), today, CATALOG_2026_10, { mode: 'shift', classDay });
        const frozen = classDay > today ? classDay : today;
        // The stored plan's items: a coming-soon cell carries its `Coming soon` note there (`toPlanItems`).
        expect(before(moved.items, frozen)).toEqual(before(toPlanItems(draft), frozen));
        expect(new Set(moved.items.map((item) => item.id)).size).toBe(moved.items.length);
        // The frozen catalogue runs out before the route ends (section 6.5), so there is room for every item.
        expect(ids(moved.items)).toEqual(ids(draft.items));
        expect(moved.items.some((item) => item.lectureDate === classDay && item.targetDate! >= frozen)).toBe(false);
        expectLectureBeforeTarget(moved);
        expectTwoCycleBound(moved, frozen);
        expectOpenerInvariant(moved);
      }),
      { numRuns: 40, seed: 42 },
    );
  });
});

describe('the blend-generator subpath (start bundle)', () => {
  it('serves the blended shift: without it, a blended plan, a class day or a params override throws', async () => {
    vi.resetModules();
    const fresh = await import('../curriculum/generate');
    const stored = planOf(C);
    expect(() => fresh.regenerateFrom(stored, '2026-11-30', CATALOG_2026_10, { mode: 'shift' })).toThrow(/blend-generator/);
    expect(() => fresh.regenerateFrom(planOf(ONLY), '2026-11-30', CATALOG_2026_10, { mode: 'shift', params: storedOf(ONLY) })).toThrow(/blend-generator/);
    // A single-cadence plan still shifts without it.
    expect(fresh.regenerateFrom(planOf(ONLY), '2026-11-30', CATALOG_2026_10, { mode: 'shift' }).generatorVersion).toBe(1);
    await import('../curriculum/generate-blend');
    expect(fresh.regenerateFrom(stored, '2026-11-30', CATALOG_2026_10, { mode: 'shift', classDay: '2026-12-08' }).generatorVersion).toBe(2);
  });

  it('keeps it out of the package index', async () => {
    const index = await import('..');
    expect('shiftBlended' in index).toBe(false);
  });
});
