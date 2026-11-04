import type { CatalogCell, CatalogStory, CatalogTopic, FestivalAnchor } from '../catalog/schema';
import { placementStageNumber } from '../placement/level-map';
import { StageKeySchema, type StageKey } from '../schemas/heritage-card';
import type { PlanItem } from '../schemas/plan-item';
import {
  CLASS_PACE,
  classBudget,
  cyclesOf,
  newCellsPerClassDay,
  packClass,
  practiceDaysFor,
  spreadPractice,
  type PackItem,
} from './blend';
import { WEEKDAYS, addDays, daysBetween, isDateKey, weekdayOf } from './dates';
import {
  WARNING_CODES,
  type CurriculumDraft,
  type CurriculumItem,
  type CurriculumStats,
  type CurriculumWarning,
  type WeekExtra,
  type WeekKind,
  type WeekMeta,
} from './draft';
import { installBlendedPath, installBlendedShift, type BlendedShift } from './generate';
import type { Blend, CurriculumParams, CurriculumParamsInput, DateKey } from './params';
import {
  CULTURE_EVERY,
  CURRICULUM_MAX_ITEMS,
  DEFAULT_REVIEW_EVERY,
  DEFAULT_REVIEW_MIN_WEEKS,
  SESSION_TOO_SHORT_FACTOR,
  VOCAB_EVERY,
} from './presets';

/**
 * The blended path of `generateCurriculum` (AMENDMENTS-ROUTE-CLASS-BLEND sections 5 and 6, row BL-2; F-PLAN-002
 * section 3.3 as amended by BL-A2). Only a plan whose params carry `blend` takes it; every other plan keeps the
 * single-cadence path and `GENERATOR_VERSION` 1, byte for byte (BL-OD-9).
 *
 * The route is a run of class cycles (`cyclesOf`). Each cycle's class day takes new lessons from the queue head by its
 * class budget at the class pace, opening at most `C_max` new cells; each lesson becomes one ordinary item with
 * `lectureDate` (the class day) and `targetDate` (a practice date after it). The cycle's practice days take the carried
 * lessons, then the class's, round robin (`spreadPractice`). Overlap fills the rest with a Refresh (BL-OD-3); split
 * adds practice-only lessons of cells the class has opened (BL-OD-4) and replays the class's own once (BL-OD-4b).
 *
 * Served from the `@hangul-route/content-schema/blend-generator` subpath, never the package index: importing it once
 * installs this path into `generateCurriculum` and `regenerateFrom`, so the learner app's start bundle does not carry
 * it (the console, which plans these, imports it).
 */

/** Generator version of a blended plan (section 9.2). A single-cadence plan stays at 1. */
export const BLEND_GENERATOR_VERSION = 2;

/**
 * At most this many lessons on one class day: a lecture deck holds `LECTURE_MAX_BLOCKS` (30) blocks, and the review
 * quiz and the activity take two of them (`fillToLength`, AMENDMENTS-LECTURE-V2 section 4.2).
 */
export const CLASS_DAY_MAX_LESSONS = 28;

/** How far ahead the two-cycle bound reserves the later class days' floor loads (two weeks of classes). */
const LOOKAHEAD_DAYS = 14;
/** Cells listed by one Refresh entry (`CurriculumMeta.refresh`, section 9.2). */
const REFRESH_MAX_CELLS = 6;

type QueueItem = Pick<PlanItem, 'kind' | 'id' | 'note'>;

/** What the blended path reads of the generator's catalogue lookup (`Lookup` in `generate.ts`). */
export interface BlendLookup {
  readonly storiesByQuest: ReadonlyMap<string, CatalogStory>;
  category(item: QueueItem): 'lesson' | 'story' | 'coming-soon';
  lessonCell(item: QueueItem): CatalogCell | undefined;
  minutes(item: QueueItem): number;
  teachesSymbols(item: QueueItem): boolean;
}

export interface BlendStoryEntry {
  item: QueueItem;
  story: CatalogStory;
}

/** Everything `generate.ts` has already worked out for the plan (steps 1 to 5 of section 3.3). */
export interface BlendBuildInput {
  params: CurriculumParams & { blend: Blend };
  catalogVersion: number;
  lookup: BlendLookup;
  /** The queue being laid: lessons in route order, the story pool, the coming-soon cells. */
  lessons: readonly QueueItem[];
  stories: readonly BlendStoryEntry[];
  comingSoon: readonly QueueItem[];
  /** The catalogue's lesson queue (in `shift` the queue above is the plan's own items). */
  catalogLessons: readonly QueueItem[];
  locked: readonly string[];
  alreadyDone: number;
  /** `regenerateFrom` `shift`: leftovers count ready lessons and stories. */
  shift: boolean;
  /** Items dated before `from`, kept as they are. */
  history: readonly PlanItem[];
  /**
   * `regenerateFrom` `shift` (row BL-3): lessons a class day before `from` has taught that no practice date has
   * played yet. They keep their `lectureDate` and take the first practice dates, before any new class lesson.
   */
  carriedIn?: readonly PlanItem[] | undefined;
  /** `regenerateFrom` (row BL-3): the plan's stored Refresh dates; those before `from` stay as they are. */
  historyRefresh?: ReadonlyArray<{ date: DateKey; cellIds: readonly string[] }> | undefined;
  historyWeeks?: readonly WeekMeta[] | undefined;
  /** The first day the generator may place on (`freezeBefore`, or the start). */
  from: DateKey;
  topics: readonly CatalogTopic[];
  festivalDay: (anchor: FestivalAnchor, year: number) => DateKey | undefined;
}

/** One queue entry as the packers see it. */
interface Entry extends PackItem {
  item: QueueItem;
  story?: CatalogStory | undefined;
  /** Set once a class day takes it. */
  lectureDate?: DateKey | undefined;
}

type CycleKind = WeekKind;

interface Cycle {
  index: number;
  classDate: DateKey;
  /** The class takes place (not a plan day off, not a class day off). */
  held: boolean;
  /** Practice dates after days off. */
  practice: DateKey[];
  kind: CycleKind;
  /** Lessons the class day taught, in class order. */
  taught: Entry[];
  festival: FestivalAnchor | null;
}

const compareKeys = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);
const round1 = (value: number): number => Math.round(value * 10) / 10;
const stageIndex = (stage: StageKey): number => StageKeySchema.options.indexOf(stage);

/** The weeks of the route: `params.weeks`, extended by the full weeks lost to days off when `keepAverage` (BL-OD-18). */
const routeWeeks = (
  p: CurriculumParams & { blend: Blend },
  practiceDays: readonly (typeof WEEKDAYS)[number][],
  isOff: (date: DateKey) => boolean,
): { weeks: number; route: ReturnType<typeof cyclesOf> } => {
  const blend = p.blend;
  const classOff = new Set(blend.classDaysOff);
  const routeOf = (weeks: number) => cyclesOf({ startDate: p.startDate, weeks, lectureDays: blend.lecture.days, practiceDays });
  let weeks = p.weeks;
  let route = routeOf(weeks);
  if (!blend.keepAverage) return { weeks, route };
  for (;;) {
    const sessions = new Map<number, number>();
    const add = (date: DateKey): void => {
      const week = Math.floor(daysBetween(route.firstClassDate, date) / 7) + 1;
      sessions.set(week, (sessions.get(week) ?? 0) + 1);
    };
    for (const cycle of route.cycles) {
      if (!isOff(cycle.classDate) && !classOff.has(cycle.classDate)) add(cycle.classDate);
      cycle.practiceDates.filter((date) => !isOff(date)).forEach(add);
    }
    let lost = 0;
    for (let week = 1; week <= weeks; week += 1) if ((sessions.get(week) ?? 0) === 0) lost += 1;
    const next = Math.min(52, p.weeks + lost);
    if (next <= weeks) return { weeks, route };
    weeks = next;
    route = routeOf(weeks);
  }
};

/** Sections 5, 6.1 to 6.6: one blended curriculum draft. */
export function buildBlended(input: BlendBuildInput): CurriculumDraft {
  const { params: p, lookup, from } = input;
  const blend = p.blend;
  const L = blend.lecture.days.length;
  const P = blend.personal.perWeek;
  const practiceDays = blend.personal.days ?? practiceDaysFor(blend.lecture.days, P);
  const isOff = (date: DateKey): boolean => p.daysOff.some((range) => range.from <= date && date <= range.to);
  const classOff = new Set(blend.classDaysOff);
  const { weeks: weekCount, route } = routeWeeks(p, practiceDays, isOff);
  const firstDay = route.firstClassDate;
  const weekOf = (date: DateKey): number => Math.min(weekCount, Math.max(1, Math.floor(daysBetween(firstDay, date) / 7) + 1));

  const budgetL = classBudget(blend.lecture.minutes);
  const budgetP = blend.personal.minutes;
  const reviewEvery = p.reviewEvery ?? (p.weeks >= DEFAULT_REVIEW_MIN_WEEKS ? DEFAULT_REVIEW_EVERY : 0);
  const cultureEvery = CULTURE_EVERY[p.goals.focus];
  const vocabEvery = VOCAB_EVERY[p.goals.focus];
  const endIndex = route.cycles.length - 1;

  const entryOf = (item: QueueItem, story?: CatalogStory): Entry => {
    // Only a ready lesson opens a cell (C_max, the split opener rule); a story or a coming-soon cell opens none.
    return { item, minutes: lookup.minutes(item), cellId: lookup.lessonCell(item)?.episodeId, story };
  };
  /** One queue: lessons, then the story pool, then the coming-soon cells (section 5; F-PLAN-002 section 3.3 steps 3-5). */
  let queue: Entry[] = [
    ...input.lessons.map((item) => entryOf(item)),
    ...input.stories.map((entry) => entryOf(entry.item, entry.story)),
    ...input.comingSoon.map((item) => entryOf(item)),
  ];

  const cycles: Cycle[] = route.cycles.map((cycle) => ({
    index: cycle.index,
    classDate: cycle.classDate,
    held: !isOff(cycle.classDate) && !classOff.has(cycle.classDate),
    practice: cycle.practiceDates.filter((date) => !isOff(date)),
    kind: 'learn',
    taught: [],
    festival: null,
  }));
  const placeable = (date: DateKey): boolean => date >= from;
  const practiceOf = (index: number): DateKey[] => (cycles[index] as Cycle).practice.filter(placeable);
  const canTeach = (cycle: Cycle | undefined): boolean => cycle !== undefined && cycle.held && cycle.classDate >= from;
  const isReviewSlot = (cycle: Cycle): boolean => reviewEvery > 0 && (cycle.index + 1) % reviewEvery === 0 && cycle.index !== endIndex;

  // Section 3.3 step 5 anchors, per class cycle: the story of a festival inside the route is taught in the cycle
  // that holds the festival day, or the nearest earlier cycle whose class can teach.
  const reserved = new Map<number, Array<{ entry: Entry; festival: FestivalAnchor; date: DateKey }>>();
  if (p.culturalAnchors) {
    for (const entry of [...queue]) {
      const anchor = entry.story?.anchor ?? null;
      if (anchor === null) continue;
      let date: DateKey | undefined;
      for (let year = Number(from.slice(0, 4)); year <= Number(route.endDate.slice(0, 4)) && date === undefined; year += 1) {
        const day = input.festivalDay(anchor, year);
        if (day !== undefined && from <= day && day <= route.endDate && day >= firstDay) date = day;
      }
      if (date === undefined) continue;
      let index = route.cycles.findIndex((cycle) => cycle.classDate <= (date as DateKey) && (date as DateKey) <= cycle.endDate);
      while (index >= 0 && !canTeach(cycles[index])) index -= 1;
      if (index < 0) continue;
      const list = reserved.get(index) ?? [];
      list.push({ entry, festival: anchor, date });
      list.sort((a, b) => compareKeys(a.date, b.date));
      reserved.set(index, list);
      queue = queue.filter((other) => other !== entry);
    }
  }

  let reached = placementStageNumber(p.level.stage);
  let sinceCulture = 0;
  let newSinceReview = 0;
  let assigned = 0;
  const carriedIn = input.carriedIn ?? [];
  let carried: Entry[] = carriedIn
    .filter((item): item is PlanItem & { lectureDate: DateKey } => item.lectureDate !== undefined)
    .map((item) => ({ ...entryOf(item.note === undefined ? { kind: item.kind, id: item.id } : { kind: item.kind, id: item.id, note: item.note }), lectureDate: item.lectureDate }));
  assigned += carried.length;
  // Cells a class day has already opened (the split opener rule holds across a re-pace, row BL-3).
  const opened = new Set<string>(
    [...input.history, ...carriedIn].flatMap((item) => {
      const cell = item.lectureDate === undefined ? undefined : lookup.lessonCell(item);
      return cell === undefined ? [] : [cell.episodeId];
    }),
  );
  const placed: CurriculumItem[] = [];
  const refresh: Array<{ date: DateKey; cellIds: string[] }> = (input.historyRefresh ?? [])
    .filter((entry) => entry.date < from)
    .map((entry) => ({ date: entry.date, cellIds: [...entry.cellIds] }));
  let runsOut: number | undefined;
  let itemCap: number | undefined;
  const paced: number[] = [];
  let classMinutes = 0;

  const split = blend.mode === 'split';
  const fits = (entry: Entry): boolean => entry.story !== undefined && entry.story.recommendedStage <= reached + 1;
  const ready = (entry: Entry): boolean => lookup.category(entry.item) !== 'coming-soon';
  const stageForCap = (): StageKey => queue.map((entry) => lookup.lessonCell(entry.item)?.stage).find((stage) => stage !== undefined) ?? p.level.stage;
  /**
   * The floor of the two-cycle bound (section 6.2): what one practice day holds, `floor(B_P / m)` lessons at least 1,
   * counted on the class day's own lessons the way a practice day takes them (while under `B_P`), while `P >= L`.
   */
  const floorOf = (entries: readonly Entry[]): number => {
    if (P < L) return 0;
    let minutes = 0;
    let count = 0;
    for (const entry of entries) {
      if (minutes >= budgetP) break;
      minutes += entry.minutes;
      count += 1;
    }
    return Math.max(1, count);
  };

  /**
   * Class packing for one class day (section 6.2): split takes the packet's cell openers first (section 5.2). With
   * `forceFirst` off (the room left after a culture story), an item that alone overruns the budget is not taken.
   */
  const pack = (source: readonly Entry[], budget: number, forceFirst = true): Entry[] => {
    if (budget <= 0 || source.length === 0) return [];
    const cMax = newCellsPerClassDay(stageForCap());
    let window: readonly Entry[] = source;
    let isOpener: ((entry: Entry) => boolean) | undefined;
    if (split) {
      const fresh: string[] = [];
      const end = source.findIndex((entry) => {
        if (entry.cellId === undefined || opened.has(entry.cellId) || fresh.includes(entry.cellId)) return false;
        if (fresh.length === cMax) return true;
        fresh.push(entry.cellId);
        return false;
      });
      window = end < 0 ? source : source.slice(0, end);
      const firsts = new Set(fresh.map((cell) => window.find((entry) => entry.cellId === cell)));
      isOpener = (entry) => firsts.has(entry);
    }
    const result = packClass(window, budget, CLASS_PACE, cMax, { openedBefore: opened, ...(isOpener ? { isOpener } : {}) });
    return !forceFirst && result.classMinutes > budget ? [] : result.taken;
  };

  /**
   * The cycle by whose end a lesson taught in cycle `index` must be played (G4, section 6.2): the second cycle, from
   * `index` on, that holds a practice date. A cycle with no practice date (a class between two class days, or every
   * practice date off) carries its lessons into the next one that has, so it does not count. Past the last such cycle,
   * the route's last cycle.
   */
  const deadlineOf = (index: number): number => {
    let seen = 0;
    for (let i = index; i < cycles.length; i += 1) {
      if (practiceOf(i).length > 0) seen += 1;
      if (seen === 2) return i;
    }
    return cycles.length - 1;
  };

  /**
   * A later class day's floor load, as the bound reserves it: the queue head the class budget takes at the class pace
   * (`C_max` aside, so the reservation is never too small), cut to what one practice day holds.
   */
  const floorLoadOf = (source: readonly Entry[]): Entry[] => {
    let minutes = 0;
    let count = 0;
    for (const entry of source) {
      if (count > 0 && (minutes + CLASS_PACE * entry.minutes > budgetL || count === CLASS_DAY_MAX_LESSONS)) break;
      minutes += CLASS_PACE * entry.minutes;
      count += 1;
    }
    const load = source.slice(0, count);
    return load.slice(0, Math.min(load.length, floorOf(load)));
  };

  /**
   * The two-cycle bound (G4), simulated to the end of the route: whether a lesson taught in cycle `index` would miss
   * `deadlineOf(index)` (`own`), and how many later class days could not play their floor load by their own deadline
   * (`later`). A class day takes a load only when `own` is false and `later` is no worse than with its smallest load,
   * so it never pushes a later class day past the bound or below its floor; a later shortfall it does not cause (days
   * off, the route's end) does not hold it back.
   */
  const boundOf = (index: number, taught: readonly Entry[], rest: readonly Entry[]): { own: boolean; later: number } => {
    const loads = new Map<number, { entries: Entry[]; deadline: number }>([[index, { entries: [...taught], deadline: deadlineOf(index) }]]);
    let left = rest;
    for (let j = index + 1; j < cycles.length && left.length > 0; j += 1) {
      const cycle = cycles[j] as Cycle;
      if (!canTeach(cycle) || isReviewSlot(cycle)) continue;
      const entries = floorLoadOf(left);
      left = left.slice(entries.length);
      loads.set(j, { entries, deadline: deadlineOf(j) });
    }
    let own = false;
    let later = 0;
    let carry: readonly Entry[] = carried;
    for (let i = index; i < cycles.length; i += 1) {
      carry = spreadPractice({ carried: carry, taught: loads.get(i)?.entries ?? [] }, practiceOf(i), budgetP).carry;
      for (const [j, load] of loads) {
        if (load.deadline !== i) continue;
        if (!carry.some((entry) => load.entries.includes(entry))) continue;
        if (j === index) own = true;
        else later += 1;
        // A late load is played as soon as it can be; it no longer blocks the ones after it.
        carry = carry.filter((entry) => !load.entries.includes(entry));
      }
    }
    return { own, later };
  };

  /** Cells taught by the class in the latest one or two teaching cycles up to `index`, earliest first (section 6.4). */
  const refreshCells = (index: number): string[] => {
    const lists: string[][] = [];
    for (let i = index; i >= 0 && lists.length < 2; i -= 1) {
      const cells = (cycles[i] as Cycle).taught.flatMap((entry) => (entry.cellId === undefined ? [] : [entry.cellId]));
      if (cells.length > 0) lists.unshift(cells);
    }
    return [...new Set(lists.flat())].slice(0, REFRESH_MAX_CELLS);
  };

  // A re-pace (row BL-3): the class days before `from` are rebuilt from what they taught, so the review and culture
  // counters, the opened cells, the stage reached and the Refresh lists go on from where the plan was.
  const taughtBefore = [...input.history, ...carriedIn].filter((item) => item.lectureDate !== undefined && item.lectureDate < from);
  for (const cycle of cycles) {
    if (cycle.classDate >= from) break;
    const taught = taughtBefore
      .filter((item) => item.lectureDate === cycle.classDate)
      .map((item): Entry => ({ ...entryOf({ kind: item.kind, id: item.id }), lectureDate: cycle.classDate }));
    cycle.taught = taught;
    if (!cycle.held) {
      if (cycle.practice.length === 0) cycle.kind = 'break';
      continue;
    }
    const story = taught.some((entry) => entry.item.kind === 'quest' && lookup.storiesByQuest.has(entry.item.id));
    cycle.kind = story ? 'culture' : taught.length === 0 && isReviewSlot(cycle) ? 'review' : 'learn';
    for (const entry of taught) {
      if (ready(entry)) newSinceReview += 1;
      const cell = lookup.lessonCell(entry.item);
      if (cell !== undefined) reached = Math.max(reached, placementStageNumber(cell.stage));
    }
    if (cycle.kind === 'learn') sinceCulture += 1;
    else if (cycle.kind === 'culture') sinceCulture = 0;
    else newSinceReview = 0;
  }

  for (const cycle of cycles) {
    const reservations = reserved.get(cycle.index) ?? [];
    // A class day before `from` keeps what it was (rebuilt above); its practice dates from `from` on still take lessons.
    const past = cycle.classDate < from;
    // Step 6, per class cycle (section 5.3).
    if (past) {
      // kind and lessons rebuilt above
    } else if (!cycle.held && cycle.practice.length === 0) cycle.kind = 'break';
    else if (!canTeach(cycle)) cycle.kind = 'learn';
    else if (reservations.length > 0) cycle.kind = 'culture';
    else if (isReviewSlot(cycle) && newSinceReview > 0) cycle.kind = 'review';
    else if (cultureEvery > 0 && sinceCulture >= cultureEvery && queue.some(fits)) cycle.kind = 'culture';
    else cycle.kind = 'learn';

    // A past class day's lessons are history or carried in already: they are not dealt again.
    let taught: Entry[] = [];
    if (canTeach(cycle) && (cycle.kind === 'learn' || cycle.kind === 'culture')) {
      // The culture cycle's story is a class lesson (section 5.3): read together, then alone.
      const anchor = reservations[0];
      let story: Entry | undefined = anchor?.entry;
      if (anchor !== undefined) cycle.festival = anchor.festival;
      else if (cycle.kind === 'culture') story = queue.find(fits);
      const later = reservations.slice(1).map((reservation) => reservation.entry);
      if (story !== undefined) queue = [story, ...queue.filter((entry) => entry !== story)];
      const room = Math.min(CLASS_DAY_MAX_LESSONS, CURRICULUM_MAX_ITEMS - assigned);
      let packed: Entry[];
      if (story !== undefined) {
        const rest = queue.slice(1);
        packed = [story, ...pack(rest, budgetL - CLASS_PACE * story.minutes, false)];
      } else packed = pack(queue, budgetL);
      if (packed.length > room) {
        packed = packed.slice(0, room);
        itemCap ??= weekOf(cycle.classDate);
      }
      if (packed.length === 0 && queue.length === 0) runsOut ??= weekOf(cycle.classDate);
      // G4 wins (section 6.2): the class day takes the most lessons that keep the bound. Every later class day's
      // floor is reserved by the check, so with `P >= L` a class day carries less than its floor only when the
      // minutes mix leaves no other way (`class-paced`); with `P < L` it may carry none (`practice-short`).
      const restAfter = (count: number): Entry[] => queue.filter((entry) => !packed.slice(0, count).includes(entry));
      const stamp = (count: number): Entry[] => packed.slice(0, count).map((entry) => ({ ...entry, lectureDate: cycle.classDate }));
      const base = boundOf(cycle.index, [], queue);
      const keeps = (count: number): boolean => {
        const bound = boundOf(cycle.index, stamp(count), restAfter(count));
        return !bound.own && bound.later <= base.later;
      };
      // The largest load that keeps the bound, by bisection (none always does): the full load first, as it usually fits.
      let n = 0;
      if (packed.length > 0 && keeps(packed.length)) n = packed.length;
      else {
        let high = packed.length - 1;
        while (n < high) {
          const mid = Math.ceil((n + high) / 2);
          if (keeps(mid)) n = mid;
          else high = mid - 1;
        }
      }
      if (n < packed.length) paced.push(weekOf(cycle.classDate));
      taught = stamp(n);
      // A second reservation of the same cycle waits at the queue head for the next class day.
      queue = [...later, ...restAfter(n)];
      for (const entry of taught) {
        if (entry.cellId !== undefined) opened.add(entry.cellId);
        if (ready(entry)) newSinceReview += 1;
        const cell = lookup.lessonCell(entry.item);
        if (cell !== undefined) reached = Math.max(reached, placementStageNumber(cell.stage));
        classMinutes += CLASS_PACE * entry.minutes;
      }
      assigned += taught.length;
    }
    if (!past) cycle.taught = taught;
    if (past) {
      // counted above
    } else if (cycle.kind === 'learn' && canTeach(cycle)) sinceCulture += 1;
    else if (cycle.kind === 'culture') sinceCulture = 0;
    else if (cycle.kind === 'review') newSinceReview = 0;

    // Split: practice-only lessons of cells the class has opened, while they fit this cycle (section 5.2).
    const practiceOnly: Entry[] = [];
    if (split && canTeach(cycle) && (cycle.kind === 'learn' || cycle.kind === 'culture')) {
      const dates = practiceOf(cycle.index);
      while (queue.length > 0 && assigned < CURRICULUM_MAX_ITEMS) {
        const head = queue[0] as Entry;
        if (lookup.category(head.item) !== 'lesson' || head.cellId === undefined || !opened.has(head.cellId)) break;
        const trial = spreadPractice({ carried, taught, practiceOnly: [...practiceOnly, head] }, dates, budgetP);
        if (trial.carry.includes(head)) break;
        practiceOnly.push(head);
        queue = queue.slice(1);
        assigned += 1;
      }
      if (assigned >= CURRICULUM_MAX_ITEMS && queue.length > 0) itemCap ??= weekOf(cycle.classDate);
    }

    const spread = spreadPractice({ carried, taught, practiceOnly }, practiceOf(cycle.index), budgetP);
    for (const day of spread.days) {
      for (const entry of day.items) {
        const base: CurriculumItem = entry.item.note === undefined
          ? { kind: entry.item.kind, id: entry.item.id, targetDate: day.date, week: weekOf(day.date) }
          : { kind: entry.item.kind, id: entry.item.id, note: entry.item.note, targetDate: day.date, week: weekOf(day.date) };
        placed.push(entry.lectureDate === undefined ? base : { ...base, lectureDate: entry.lectureDate });
      }
      const cells = day.refresh ? refreshCells(cycle.index) : [];
      // At most one entry per practice date, and a route of at most 52 weeks has at most 364 (the schema's cap).
      if (cells.length > 0) refresh.push({ date: day.date, cellIds: cells });
    }
    carried = spread.carry;
  }

  // Lessons taught on the last class days that found no practice date are not placed: they go back to the queue.
  const dropped = carried;
  queue = [...dropped.map((entry) => ({ item: entry.item, minutes: entry.minutes, cellId: entry.cellId, story: entry.story })), ...queue];
  const scheduled = new Set([...input.history.map((item) => item.id), ...placed.map((item) => item.id)]);
  const history: CurriculumItem[] = input.history
    .filter((item): item is PlanItem & { targetDate: DateKey } => item.targetDate !== undefined)
    .map((item) => ({ ...item, week: weekOf(item.targetDate) }));
  const items = [...history, ...placed].sort((a, b) => compareKeys(a.targetDate as DateKey, b.targetDate as DateKey));

  const weeks = weekMetaOf({
    input,
    weekCount,
    firstDay,
    cycles,
    items,
    scheduled,
    queue,
    vocabEvery,
    weekOf,
  });

  // Section 9.1: a reader that ignores `blend` sees a valid single-cadence plan with the right weekly count.
  const days = WEEKDAYS.filter((day) => blend.lecture.days.includes(day) || practiceDays.includes(day));
  const params: CurriculumParams = { ...p, sessionsPerWeek: days.length, sessionDays: [...days], minutesPerSession: blend.personal.minutes };

  const leftovers = input.shift
    ? queue.filter((entry) => lookup.category(entry.item) !== 'coming-soon').length
    : queue.filter((entry) => lookup.category(entry.item) === 'lesson').length;
  const { stats, warnings } = summariseBlended({
    p,
    lookup,
    cycles,
    weeks,
    items,
    weekOf,
    weekCount,
    refreshDays: refresh.length,
    classMinutes,
    budgets: { classMinutes: blend.lecture.minutes, practiceMinutes: budgetP, classBudget: budgetL },
    facts: {
      runsOut,
      itemCap,
      paced,
      practiceShort: P < L,
      locked: input.locked.length,
      leftovers,
      alreadyDone: input.shift ? 0 : input.alreadyDone,
    },
  });
  return {
    params,
    generatorVersion: BLEND_GENERATOR_VERSION,
    catalogVersion: input.catalogVersion,
    weeks,
    items,
    locked: [...input.locked],
    stats,
    warnings,
    refresh,
  };
}

interface WeekMetaInput {
  input: BlendBuildInput;
  weekCount: number;
  firstDay: DateKey;
  cycles: readonly Cycle[];
  items: readonly CurriculumItem[];
  scheduled: ReadonlySet<string>;
  queue: readonly Entry[];
  vocabEvery: number;
  weekOf: (date: DateKey) => number;
}

/** Step 8, per calendar week of the route: kind, focus and extras (word topics and the Hangul Check). */
function weekMetaOf(w: WeekMetaInput): WeekMeta[] {
  const { input, cycles, items, scheduled } = w;
  const { lookup, params: p } = input;
  const topics = [...input.topics].sort((a, b) => Number(b.free) - Number(a.free) || a.order - b.order);
  const currentWeek = Math.min(w.weekCount + 1, Math.max(1, Math.floor(daysBetween(w.firstDay, input.from) / 7) + 1));
  const unscheduled = (test: (item: QueueItem) => boolean): boolean =>
    w.queue.some((entry) => test(entry.item)) || input.catalogLessons.some((item) => test(item) && !scheduled.has(item.id));
  const symbolsLeft = unscheduled((item) => lookup.teachesSymbols(item));
  const lastSymbolWeek = items.reduce((top, item) => (lookup.teachesSymbols(item) ? Math.max(top, item.week) : top), 0);
  let sinceVocab = 0;
  const weeks: WeekMeta[] = [];
  for (let index = 1; index <= w.weekCount; index += 1) {
    const startDate = addDays(w.firstDay, 7 * (index - 1));
    const stored = index < currentWeek ? input.historyWeeks?.find((meta) => meta.index === index) : undefined;
    if (stored !== undefined) {
      const copy: WeekMeta = {
        index: stored.index,
        startDate: stored.startDate,
        kind: stored.kind,
        focus: { episodeId: stored.focus.episodeId, storyIds: [...stored.focus.storyIds], festival: stored.focus.festival },
        extras: stored.extras.map((extra) => ({ ...extra })),
      };
      // The word-topic cadence goes on from the stored weeks, as the generator counted them (row BL-3).
      if (copy.kind === 'learn' && !symbolsLeft && index >= lastSymbolWeek) sinceVocab += 1;
      for (const extra of copy.extras) {
        if (extra.kind !== 'vocab') continue;
        sinceVocab = 0;
        const at = topics.findIndex((topic) => topic.id === extra.topicId);
        if (at >= 0) topics.splice(at, 1);
      }
      weeks.push(copy);
      continue;
    }
    const inWeek = cycles.filter((cycle) => w.weekOf(cycle.classDate) === index);
    const kinds = new Set(inWeek.map((cycle) => cycle.kind));
    const kind: WeekKind = kinds.has('culture') ? 'culture' : kinds.has('learn') ? 'learn' : kinds.has('review') ? 'review' : 'break';
    const weekItems = items.filter((item) => item.week === index);
    const festival = inWeek.find((cycle) => cycle.festival !== null)?.festival ?? null;
    const extras: WeekExtra[] = [];
    if (kind === 'learn') {
      const allowed = !symbolsLeft && index >= lastSymbolWeek;
      if (allowed) sinceVocab += 1;
      const cadenceReached = w.vocabEvery > 0 && allowed && sinceVocab >= w.vocabEvery;
      const freePractice = weekItems.length === 0 && p.goals.focus !== 'reading';
      if (cadenceReached || freePractice) {
        const topic = topics.shift();
        if (topic !== undefined) {
          extras.push({ kind: 'vocab', topicId: topic.id });
          sinceVocab = 0;
        }
      }
    }
    weeks.push({
      index,
      startDate,
      kind,
      focus: {
        episodeId: weekItems.map((item) => lookup.lessonCell(item)).find((cell) => cell !== undefined)?.episodeId ?? null,
        storyIds: weekItems
          .flatMap((item) => {
            const story = lookup.storiesByQuest.get(item.id);
            return item.kind === 'quest' && story !== undefined ? [story.id] : [];
          })
          .slice(0, 3),
        festival,
      },
      extras,
    });
  }
  // The Hangul Check closes Stage 1 in the week of its last lesson, once every Stage 1 lesson is scheduled.
  const isStage1Lesson = (item: QueueItem): boolean => lookup.lessonCell(item)?.stage === 'stage1';
  const lastStage1 = [...items].reverse().find(isStage1Lesson);
  const checkWeek = lastStage1 === undefined ? undefined : weeks[lastStage1.week - 1];
  if (p.level.stage === 'stage1' && !unscheduled(isStage1Lesson) && checkWeek !== undefined && checkWeek.index >= currentWeek) {
    checkWeek.extras.push({ kind: 'hangul-check' });
  }
  return weeks;
}

interface SummaryInput {
  p: CurriculumParams;
  lookup: BlendLookup;
  cycles: readonly Cycle[];
  weeks: readonly WeekMeta[];
  items: readonly CurriculumItem[];
  weekOf: (date: DateKey) => number;
  weekCount: number;
  refreshDays: number;
  classMinutes: number;
  budgets: { classMinutes: number; practiceMinutes: number; classBudget: number };
  facts: {
    runsOut: number | undefined;
    itemCap: number | undefined;
    paced: readonly number[];
    practiceShort: boolean;
    locked: number;
    leftovers: number;
    alreadyDone: number;
  };
}

/** Step 9 for a blended plan: stats with `byTrack` and the session averages (section 6.1), and the warnings (6.6). */
function summariseBlended(s: SummaryInput): { stats: CurriculumStats; warnings: CurriculumWarning[] } {
  const { lookup, items, cycles, budgets, facts } = s;
  const lessons = items.filter((item) => lookup.category(item) === 'lesson');
  const stories = items.filter((item) => lookup.category(item) === 'story');
  const comingSoon = items.filter((item) => lookup.category(item) === 'coming-soon');
  const readyItems = [...lessons, ...stories];
  const classSessions = cycles.filter((cycle) => cycle.held);
  const practiceSessions = cycles.flatMap((cycle) => cycle.practice);
  const sessions = classSessions.length + practiceSessions.length;
  const perWeek = new Map<number, number>();
  for (const date of [...classSessions.map((cycle) => cycle.classDate), ...practiceSessions]) {
    perWeek.set(s.weekOf(date), (perWeek.get(s.weekOf(date)) ?? 0) + 1);
  }
  const teachingWeeks = [...perWeek.values()].filter((count) => count > 0);
  const taught = items.filter((item) => item.lectureDate !== undefined);
  const openSessions = cycles.filter(
    (cycle) => cycle.held && (cycle.kind === 'learn' || cycle.kind === 'culture') && cycle.taught.length === 0,
  ).length;
  const highest = lessons
    .map((item) => lookup.lessonCell(item)?.stage)
    .filter((stage): stage is StageKey => stage !== undefined)
    .reduce((top, stage) => (stageIndex(stage) > stageIndex(top) ? stage : top), s.p.level.stage);
  const tooLong = readyItems.filter(
    (item) =>
      lookup.minutes(item) > SESSION_TOO_SHORT_FACTOR * budgets.practiceMinutes ||
      (item.lectureDate !== undefined && CLASS_PACE * lookup.minutes(item) > SESSION_TOO_SHORT_FACTOR * budgets.classBudget),
  ).length;
  const minutesOf = (list: readonly CurriculumItem[]): number => list.reduce((sum, item) => sum + lookup.minutes(item), 0);

  const stats: CurriculumStats = {
    sessions,
    readyItems: readyItems.length,
    lessons: lessons.length,
    stories: stories.length,
    comingSoonItems: comingSoon.length,
    openSessions,
    minutesPlanned: minutesOf(readyItems),
    minutesAvailable: classSessions.length * budgets.classMinutes + practiceSessions.length * budgets.practiceMinutes,
    reviewWeeks: s.weeks.filter((week) => week.kind === 'review').length,
    breakWeeks: s.weeks.filter((week) => week.kind === 'break').length,
    cultureWeeks: s.weeks.filter((week) => week.kind === 'culture').length,
    vocabWeeks: s.weeks.filter((week) => week.extras.some((extra) => extra.kind === 'vocab')).length,
    endsAtStage: highest,
    byTrack: {
      lecture: { sessions: classSessions.length, items: taught.length, minutesPlanned: Math.round(s.classMinutes) },
      personal: { sessions: practiceSessions.length, items: items.length, refreshDays: s.refreshDays, minutesPlanned: minutesOf(items) },
    },
    sessionsPerTeachingWeek: teachingWeeks.length === 0 ? 0 : round1(sessions / teachingWeeks.length),
    sessionsPerCalendarWeek: round1(sessions / s.weekCount),
  };

  const warnings: CurriculumWarning[] = [];
  if (facts.runsOut !== undefined) warnings.push({ code: 'content-runs-out', week: facts.runsOut });
  const firstSoon = comingSoon[0];
  if (firstSoon !== undefined) warnings.push({ code: 'coming-soon-included', week: firstSoon.week, count: comingSoon.length });
  if (facts.itemCap !== undefined) warnings.push({ code: 'item-cap', week: facts.itemCap });
  const firstPaced = facts.paced[0];
  if (!facts.practiceShort && firstPaced !== undefined) warnings.push({ code: 'class-paced', week: firstPaced, count: facts.paced.length });
  if (facts.locked > 0) warnings.push({ code: 'premium-needed', count: facts.locked });
  if (facts.leftovers > 0) warnings.push({ code: 'fewer-sessions-than-units', count: facts.leftovers });
  if (tooLong > 0) warnings.push({ code: 'session-too-short', count: tooLong });
  if (facts.alreadyDone > 0) warnings.push({ code: 'already-done-skipped', count: facts.alreadyDone });
  if (facts.practiceShort) warnings.push({ code: 'practice-short' });
  const rank = (warning: CurriculumWarning): number => (warning.week ?? 53) * 10 + WARNING_CODES.indexOf(warning.code);
  warnings.sort((a, b) => rank(a) - rank(b));
  return { stats, warnings };
}

/**
 * `regenerateFrom` `shift` of a blended plan (AMENDMENTS-ROUTE-CLASS-BLEND sections 10.2, 12.1 and 14, row BL-3;
 * F-PLAN-002 section 3.7 as amended by BL-A3). Items dated before the freeze stay as they are. A lesson a class day
 * before the cutoff has taught and no practice date has played yet keeps its `lectureDate` and takes the next practice
 * dates; every other future item is laid again in route order. `classDay` (**Move this class day**) adds that class
 * date to `blend.classDaysOff` and freezes what is dated before it (or before today, when it has gone by). `params`
 * (**Add practice days** / **Stop practice days**) lays the future again under new params, with or without `blend`.
 */
export const shiftBlended: BlendedShift = (plan, today, opts, kit) => {
  let params: CurriculumParamsInput = { ...(opts.params ?? plan.meta.params), completedQuestIds: opts.completedQuestIds ?? [] };
  let from = today;
  const classDay = opts.classDay;
  if (classDay !== undefined) {
    params = withClassDayOff(params, classDay);
    if (classDay > today) from = classDay;
  }
  const isBefore = (item: PlanItem): boolean => item.targetDate !== undefined && item.targetDate < from;
  const history = plan.items.filter(isBefore);
  let future = plan.items.filter((item) => !isBefore(item));
  // Taught before the moved class day (or before today) and not played yet: it keeps its class day.
  const cutoff = classDay ?? from;
  let carriedIn = params.blend === undefined ? [] : future.filter((item) => item.lectureDate !== undefined && item.lectureDate < cutoff);
  future = future.filter((item) => !carriedIn.includes(item));
  if (plan.meta.params.blend !== undefined) {
    const rank = kit.routeRank(plan.meta.params);
    future = byRank(future, rank, () => 0);
    // In class order: by class day, a culture class's story first, then the route order.
    carriedIn = byRank(carriedIn, rank, (a, b) => compareKeys(a.lectureDate ?? '', b.lectureDate ?? '') || Number(kit.isStory(b)) - Number(kit.isStory(a)));
  }
  return kit.build(params, { ...kit.base, freezeBefore: from, history, queue: kit.queueOf(future), carriedIn });
};

/** Move this class day: a class date of the route joins `blend.classDaysOff` (once). */
function withClassDayOff(params: CurriculumParamsInput, classDay: DateKey): CurriculumParamsInput {
  const blend = params.blend;
  if (blend === undefined) throw new Error('Move this class day needs a plan with class days and practice days (blend)');
  if (!isDateKey(classDay)) throw new RangeError(`classDay: ${classDay} is not a real day`);
  if (!blend.lecture.days.includes(weekdayOf(classDay))) throw new RangeError(`classDay: ${classDay} is not a class day of this plan`);
  const last = addDays(params.startDate, 7 * params.weeks + 6);
  if (classDay < params.startDate || classDay > last) throw new RangeError(`classDay: ${classDay} is outside the route`);
  const off = blend.classDaysOff ?? [];
  return off.includes(classDay) ? params : { ...params, blend: { ...blend, classDaysOff: [...off, classDay].sort(compareKeys) } };
}

/** Stable: `first`, then the route rank (unranked last), then the given order. */
function byRank(items: readonly PlanItem[], rank: ReadonlyMap<string, number>, first: (a: PlanItem, b: PlanItem) => number): PlanItem[] {
  return items
    .map((item, index) => ({ item, index, rank: rank.get(item.id) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => first(a.item, b.item) || a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item);
}

installBlendedPath(buildBlended);
installBlendedShift(shiftBlended);
