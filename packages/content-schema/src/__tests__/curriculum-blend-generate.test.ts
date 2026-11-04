import { describe, expect, it, vi } from 'vitest';
import {
  CURRICULUM_MAX_ITEMS,
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
} from '..';
import { BLEND_GENERATOR_VERSION, CLASS_DAY_MAX_LESSONS } from '../curriculum/generate-blend';
import { CATALOG_2026_10 } from './fixtures/catalog-2026-10';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND sections 5.3, 6.1 and 6.6 (row BL-2): the blended generator's rules one by one, next
 * to the goldens (`curriculum-golden.test.ts`) and the properties (`curriculum-blend.property.test.ts`).
 */

type Blend = NonNullable<CurriculumParamsInput['blend']>;

const ALL_STAGES: CurriculumParamsInput['unlockedStages'] = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'];

const plan = (blend: Partial<Blend> = {}, extra: Partial<CurriculumParamsInput> = {}): CurriculumParamsInput => ({
  audience: 'class',
  level: { stage: 'stage1', band: 0 },
  startDate: '2026-11-02',
  weeks: 26,
  sessionsPerWeek: 4,
  minutesPerSession: 10,
  goals: { focus: 'balanced', motivation: 'heritage' },
  unlockedStages: ALL_STAGES,
  reviewEvery: 4,
  blend: { mode: 'overlap', lecture: { days: ['tue'], minutes: 30 }, personal: { perWeek: 3, minutes: 10 }, ...blend },
  ...extra,
});

/** One cell per stage, `size` lessons of `minutes` minutes each (big enough for the item cap). */
function bigCatalog(size: number, minutes: number): Catalog {
  const stages = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'] as const;
  const cells: CatalogCell[] = [];
  const quests: CatalogQuest[] = [];
  for (const stage of stages) {
    const episodeId = `episode:${stage}-letters`;
    const ids = Array.from({ length: size }, (_, i) => `quest:${stage}-letters-q${i + 1}`);
    ids.forEach((id) => quests.push({ id, episodeId, stage, theme: 'letters', title: id, minutes, teaches: [], kind: 'lesson' }));
    cells.push({ stage, theme: 'letters', episodeId, title: episodeId, status: 'shipped', minutes, questIds: ids });
  }
  return { version: 1, cells, quests, stories: [], topics: [] };
}

const codes = (draft: CurriculumDraft): string[] => draft.warnings.map((warning) => warning.code);
const datesOf = (draft: CurriculumDraft): string[] => draft.items.map((item) => item.targetDate ?? '');

describe('sessions and averages (section 6.1)', () => {
  it('26 weeks of 1 + 3 with two holiday weeks off: 96 sessions, 4.0 a teaching week, 3.7 over the calendar', () => {
    const daysOff = [
      { from: '2026-12-22', to: '2026-12-28' },
      { from: '2027-03-30', to: '2027-04-05' },
    ];
    const draft = generateCurriculum(plan({}, { daysOff }), CATALOG_2026_10);
    expect(draft.stats.sessions).toBe(96);
    expect(draft.stats.sessionsPerTeachingWeek).toBe(4);
    expect(draft.stats.sessionsPerCalendarWeek).toBe(3.7);
    expect(draft.stats.breakWeeks).toBe(2);
    expect(draft.weeks).toHaveLength(26);
    expect(draft.items.some((item) => item.targetDate! >= '2026-12-22' && item.targetDate! <= '2026-12-28')).toBe(false);
  });

  it('keep the average extends the route by the full weeks lost (BL-OD-18), never past 52 weeks', () => {
    const daysOff = [
      { from: '2026-12-22', to: '2026-12-28' },
      { from: '2027-03-30', to: '2027-04-05' },
    ];
    const draft = generateCurriculum(plan({ keepAverage: true }, { daysOff }), CATALOG_2026_10);
    expect(draft.weeks).toHaveLength(28);
    expect(draft.stats.sessions).toBe(104);
    // The average over the planned 26 weeks is met exactly (section 6.1).
    expect(draft.stats.sessionsPerCalendarWeek).toBe(4);
    expect(draft.weeks.at(-1)?.startDate).toBe('2027-05-11');
    // The params keep the planned weeks: the extension is worked out again on every regeneration.
    expect(draft.params.weeks).toBe(26);
    // A partial week off loses sessions but adds no week; nothing off adds nothing.
    expect(generateCurriculum(plan({ keepAverage: true }, { daysOff: [{ from: '2026-11-04', to: '2026-11-04' }] }), CATALOG_2026_10).weeks).toHaveLength(26);
    // A week added that is itself off is made up too.
    const chained = generateCurriculum(
      plan({ keepAverage: true }, { weeks: 2, reviewEvery: 0, daysOff: [{ from: '2026-11-10', to: '2026-11-23' }] }),
      CATALOG_2026_10,
    );
    expect(chained.weeks).toHaveLength(4);
    const long = generateCurriculum(plan({ keepAverage: true }, { weeks: 52, daysOff: [{ from: '2027-01-05', to: '2027-01-11' }] }), CATALOG_2026_10);
    expect(long.weeks).toHaveLength(52);
  });

  it('writes sessionsPerWeek = D distinct days and their union, and 7 for 1 class + 7 practice (BL-OD-19)', () => {
    const every = generateCurriculum(plan({ personal: { perWeek: 7, minutes: 10 } }, { weeks: 4, reviewEvery: 0 }), CATALOG_2026_10);
    expect(every.params.sessionsPerWeek).toBe(7);
    expect(every.params.sessionDays).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
    // 4 weeks x (1 + 7), less the first class day's practice session.
    expect(every.stats.sessions).toBe(31);
    // A practice session on a class day never holds that day's own lessons: here it is a Refresh day.
    for (const item of every.items) expect(item.targetDate! > item.lectureDate!).toBe(true);
    const tuesdays = (every.refresh ?? []).filter((entry) => weekdayOf(entry.date) === 'tue').map((entry) => entry.date);
    expect(tuesdays).toEqual(['2026-11-10', '2026-11-17', '2026-11-24']);
  });

  it('starts on the first class day on or after the start date and counts its weeks from there', () => {
    const draft = generateCurriculum(plan({ lecture: { days: ['thu'], minutes: 45 } }, { startDate: '2026-11-04', weeks: 2, reviewEvery: 0 }), CATALOG_2026_10);
    expect(draft.weeks.map((week) => week.startDate)).toEqual(['2026-11-05', '2026-11-12']);
    expect(draft.items[0]?.lectureDate).toBe('2026-11-05');
    expect(datesOf(draft).at(-1)! <= '2026-11-18').toBe(true);
  });
});

describe('defaults and edges', () => {
  it('reviews every 4th class cycle by default from 12 weeks, and never below', () => {
    const { reviewEvery: _twelve, ...twelve } = plan({}, { weeks: 12 });
    expect(generateCurriculum(twelve, CATALOG_2026_10).stats.reviewWeeks).toBeGreaterThan(0);
    const { reviewEvery: _four, ...four } = plan({}, { weeks: 4 });
    expect(generateCurriculum(four, CATALOG_2026_10).stats.reviewWeeks).toBe(0);
  });

  it('gives no Hangul Check to a plan that starts above Stage 1', () => {
    const draft = generateCurriculum(plan({}, { weeks: 4, level: { stage: 'stage3', band: 0 } }), CATALOG_2026_10);
    expect(draft.weeks.flatMap((week) => week.extras).some((extra) => extra.kind === 'hangul-check')).toBe(false);
  });

  it('a route with every session off has no sessions and averages 0', () => {
    const draft = generateCurriculum(plan({}, { weeks: 1, reviewEvery: 0, daysOff: [{ from: '2026-11-01', to: '2026-11-10' }] }), CATALOG_2026_10);
    expect(draft.stats.sessions).toBe(0);
    expect(draft.stats.sessionsPerTeachingWeek).toBe(0);
    expect(draft.stats.sessionsPerCalendarWeek).toBe(0);
    expect(draft.items).toEqual([]);
  });
});

describe('days off (section 5.3)', () => {
  it('a class day off: the class carries nothing, its practice days take carried lessons, then a Refresh', () => {
    const draft = generateCurriculum(plan({ classDaysOff: ['2026-11-10'] }, { weeks: 3, reviewEvery: 0 }), CATALOG_2026_10);
    expect(draft.items.some((item) => item.lectureDate === '2026-11-10')).toBe(false);
    expect(draft.stats.byTrack?.lecture.sessions).toBe(2);
    expect(draft.stats.byTrack?.personal.sessions).toBe(9);
    const practice = ['2026-11-11', '2026-11-13', '2026-11-15'];
    const refresh = new Set(draft.refresh?.map((entry) => entry.date));
    for (const date of practice) expect(refresh.has(date)).toBe(true);
    expect(draft.weeks[1]?.kind).toBe('learn');
    expect(draft.stats.openSessions).toBe(0);
  });

  it('a plan day off removes both sessions of a date; a practice day off moves its lessons to the next practice day', () => {
    const classDay = generateCurriculum(plan({}, { weeks: 2, reviewEvery: 0, daysOff: [{ from: '2026-11-10', to: '2026-11-10' }] }), CATALOG_2026_10);
    expect(classDay.stats.byTrack?.lecture.sessions).toBe(1);
    expect(classDay.items.some((item) => item.lectureDate === '2026-11-10')).toBe(false);
    const practiceDay = generateCurriculum(plan({}, { weeks: 2, reviewEvery: 0, daysOff: [{ from: '2026-11-04', to: '2026-11-04' }] }), CATALOG_2026_10);
    expect(datesOf(practiceDay)).not.toContain('2026-11-04');
    expect(practiceDay.items.filter((item) => item.lectureDate === '2026-11-03').map((item) => item.targetDate)).toEqual(['2026-11-06', '2026-11-06', '2026-11-08']);
  });

  it('a week with every session off is a break week: nothing is placed and the queue waits', () => {
    const draft = generateCurriculum(plan({}, { weeks: 3, reviewEvery: 0, daysOff: [{ from: '2026-11-10', to: '2026-11-16' }] }), CATALOG_2026_10);
    expect(draft.weeks.map((week) => week.kind)).toEqual(['learn', 'break', 'learn']);
    expect(draft.items.filter((item) => item.week === 2)).toEqual([]);
    expect(draft.items.find((item) => item.week === 3)?.id).toBe('quest:stage1-life-q1');
  });
});

describe('review and culture cycles (section 5.3)', () => {
  it('a review cycle teaches nothing and its practice days are Refresh days', () => {
    const draft = generateCurriculum(plan({}, { weeks: 6 }), CATALOG_2026_10);
    expect(draft.weeks[3]?.kind).toBe('review');
    expect(draft.items.some((item) => item.lectureDate === '2026-11-24')).toBe(false);
    const refresh = new Set(draft.refresh?.map((entry) => entry.date));
    for (const date of ['2026-11-25', '2026-11-27', '2026-11-29']) expect(refresh.has(date)).toBe(true);
    expect(draft.refresh?.find((entry) => entry.date === '2026-11-25')?.cellIds).toEqual(['episode:stage1-life', 'episode:stage1-rites', 'episode:stage1-nature']);
  });

  it('counts review cycles in class cycles: two class days a week with reviewEvery 4 review every second week', () => {
    const draft = generateCurriculum(plan({ lecture: { days: ['mon', 'thu'], minutes: 30 } }, { weeks: 5 }), CATALOG_2026_10);
    expect(draft.items.some((item) => item.lectureDate === '2026-11-12')).toBe(false);
    expect(draft.items.some((item) => item.lectureDate === '2026-11-26')).toBe(false);
  });

  it('teaches a festival story in the class of its cycle, and a second one waits for the next class day', () => {
    // 2028: Chuseok on 3 October and Hangeul Day on 9 October fall in one Tuesday cycle.
    const draft = generateCurriculum(
      plan({ lecture: { days: ['tue'], minutes: 15 } }, { startDate: '2028-09-26', weeks: 3, reviewEvery: 0, level: { stage: 'stage1', band: 3 }, unlockedStages: ['stage1'] }),
      CATALOG_2026_10,
    );
    const chuseok = draft.items.find((item) => item.id === 'quest:story-chuseok-ganggangsullae-listen');
    const hangeulDay = draft.items.find((item) => item.id === 'quest:story-hangeul-day-listen');
    expect(chuseok?.lectureDate).toBe('2028-10-03');
    expect(hangeulDay?.lectureDate).toBe('2028-10-10');
    expect(draft.weeks[1]?.kind).toBe('culture');
    expect(draft.weeks[1]?.focus.festival).toBe('chuseok');
  });

  it('a culture cycle reads its story in class first, with lessons after it while the class budget allows', () => {
    const draft = generateCurriculum(plan({}, { weeks: 6 }), CATALOG_2026_10);
    expect(draft.weeks[4]?.kind).toBe('culture');
    const taught = draft.items.filter((item) => item.lectureDate === '2026-12-01').map((item) => item.id);
    expect(taught[0]).toBe('quest:story-kim-hongdo-genre-paintings-listen');
    expect(taught.length).toBeGreaterThan(1);
  });

  it('skips a festival before the route or with no class day that can teach it', () => {
    // Seollal 2027 (7 February) falls in a week whose class day is off and the class days before it are off too.
    const draft = generateCurriculum(
      plan({ classDaysOff: ['2027-02-02'] }, { startDate: '2027-02-02', weeks: 2, reviewEvery: 0, level: { stage: 'stage1', band: 3 }, unlockedStages: ['stage1'] }),
      CATALOG_2026_10,
    );
    expect(draft.weeks.every((week) => week.focus.festival === null)).toBe(true);
    const noAnchors = generateCurriculum(plan({}, { weeks: 26, culturalAnchors: false }), CATALOG_2026_10);
    expect(noAnchors.weeks.every((week) => week.focus.festival === null)).toBe(true);
  });
});

describe('caps and warnings (section 6.6)', () => {
  it('stops at 260 items with item-cap, and never puts more than 28 lessons on a class day', () => {
    const catalog = bigCatalog(60, 1);
    for (const mode of ['overlap', 'split'] as const) {
      const draft = generateCurriculum(
        plan({ mode, lecture: { days: ['mon', 'thu'], minutes: 60 }, personal: { perWeek: 3, minutes: 30 } }, { weeks: 52, reviewEvery: 0 }),
        catalog,
      );
      expect(draft.items.length).toBeLessThanOrEqual(CURRICULUM_MAX_ITEMS);
      expect(codes(draft)).toContain('item-cap');
      const perClass = new Map<string, number>();
      for (const item of draft.items) if (item.lectureDate) perClass.set(item.lectureDate, (perClass.get(item.lectureDate) ?? 0) + 1);
      expect(Math.max(...perClass.values())).toBeLessThanOrEqual(CLASS_DAY_MAX_LESSONS);
      expect(toPlanItems(draft)).toHaveLength(draft.items.length);
    }
    const one = generateCurriculum(plan({ lecture: { days: ['mon'], minutes: 60 }, personal: { perWeek: 6, minutes: 30 } }, { weeks: 1, reviewEvery: 0 }), catalog);
    expect(one.items.filter((item) => item.lectureDate === '2026-11-02')).toHaveLength(CLASS_DAY_MAX_LESSONS);
  });

  it('warns practice-short when P < L, and class-paced when the two-cycle bound holds a class day back', () => {
    const short = generateCurriculum(plan({ lecture: { days: ['mon', 'thu'], minutes: 30 }, personal: { perWeek: 1, minutes: 10 } }, { weeks: 4 }), CATALOG_2026_10);
    expect(codes(short)).toContain('practice-short');
    expect(codes(short)).not.toContain('class-paced');
    const paced = generateCurriculum(plan({ personal: { perWeek: 1, minutes: 10 } }, { weeks: 4, reviewEvery: 0 }), CATALOG_2026_10);
    expect(paced.warnings.find((warning) => warning.code === 'class-paced')).toMatchObject({ week: 1 });
    expect(codes(paced)).not.toContain('practice-short');
  });

  it('counts session-too-short, premium-needed, already-done and the lessons left over', () => {
    const draft = generateCurriculum(
      plan({ personal: { perWeek: 1, minutes: 5 } }, { weeks: 2, reviewEvery: 0, unlockedStages: ['stage1'], completedQuestIds: ['quest:stage1-letters-q1'] }),
      bigCatalog(3, 8),
    );
    expect(codes(draft)).toEqual(expect.arrayContaining(['premium-needed', 'session-too-short', 'already-done-skipped']));
    const left = generateCurriculum(plan({}, { weeks: 1, reviewEvery: 0, unlockedStages: ['stage1'] }), bigCatalog(10, 5));
    expect(left.warnings).toContainEqual({ code: 'fewer-sessions-than-units', count: 7 });
    const tooLongInClass = generateCurriculum(plan({ lecture: { days: ['tue'], minutes: 15 }, personal: { perWeek: 3, minutes: 30 } }, { weeks: 1, reviewEvery: 0 }), bigCatalog(3, 12));
    expect(codes(tooLongInClass)).toContain('session-too-short');
  });

  it('warns content-runs-out from the first class day with nothing left to teach', () => {
    const draft = generateCurriculum(plan({}, { weeks: 8, reviewEvery: 0, includeComingSoon: false }), bigCatalog(2, 5));
    expect(draft.warnings.find((warning) => warning.code === 'content-runs-out')?.week).toBeGreaterThan(1);
  });
});

describe('Refresh entries (section 6.4)', () => {
  it('lists the cells of the latest one or two teaching cycles, earliest first, at most 6', () => {
    const catalog: Catalog = {
      ...bigCatalog(1, 1),
    };
    const draft = generateCurriculum(
      plan({ lecture: { days: ['tue'], minutes: 60 }, personal: { perWeek: 3, minutes: 30 } }, { weeks: 2, reviewEvery: 0 }),
      { ...catalog, cells: catalog.cells.map((cell) => ({ ...cell })) },
    );
    for (const entry of draft.refresh ?? []) expect(entry.cellIds.length).toBeLessThanOrEqual(6);
    expect(draft.refresh?.[0]?.cellIds).toEqual(['episode:stage1-letters', 'episode:stage2-letters']);
  });

  it('stores them in the plan meta; a single-cadence meta has none', () => {
    const draft = generateCurriculum(plan({}, { weeks: 2, reviewEvery: 0 }), CATALOG_2026_10);
    expect(toMeta(draft).refresh).toEqual(draft.refresh);
    expect(toMeta(draft).generatorVersion).toBe(BLEND_GENERATOR_VERSION);
  });
});

describe('split (section 5.2)', () => {
  it('gives practice days practice-only lessons of opened cells, and a Refresh when the next cell is not opened yet', () => {
    const draft = generateCurriculum(plan({ mode: 'split' }, { weeks: 3, reviewEvery: 0 }), CATALOG_2026_10);
    const practiceOnly = draft.items.filter((item) => item.lectureDate === undefined);
    expect(practiceOnly.length).toBeGreaterThan(0);
    // Week 3: the class opens crafts and the first Stage 2 cell; the next lesson's cell is not open, so a Refresh.
    expect(draft.refresh?.some((entry) => entry.date >= '2026-11-18')).toBe(true);
  });
});

describe('re-pacing a blended plan keeps its history', () => {
  const draft = generateCurriculum(plan({}, { weeks: 12 }), CATALOG_2026_10);
  const stored = { meta: toMeta(draft), items: toPlanItems(draft) };
  const today = '2026-12-01';

  it('shift: past items stay, the future is laid again from the plan, version 2', () => {
    const next = regenerateFrom(stored, today, CATALOG_2026_10, { mode: 'shift' });
    expect(next.generatorVersion).toBe(BLEND_GENERATOR_VERSION);
    expect(next.items.filter((item) => item.targetDate! < today)).toEqual(draft.items.filter((item) => item.targetDate! < today));
    expect(next.weeks.slice(0, 4)).toEqual(draft.weeks.slice(0, 4));
    expect(new Set(next.items.map((item) => item.id)).size).toBe(next.items.length);
  });

  it('requeue: a past item not done returns to the queue', () => {
    const done = draft.items.filter((item) => item.targetDate! < today).map((item) => item.id).slice(1);
    const next = regenerateFrom(stored, today, CATALOG_2026_10, { mode: 'requeue', completedQuestIds: done });
    const missed = draft.items[0]?.id;
    expect(next.items.find((item) => item.id === missed)?.targetDate! >= today).toBe(true);
  });

  it('keeps a stored week with a word topic, and a stored coming-soon note', () => {
    const extras = [{ kind: 'hangul-check' as const }, { kind: 'vocab' as const, topicId: 'topic:food' }];
    const weeks = stored.meta.weeks.map((week, index) => (index === 0 ? { ...week, extras } : week));
    const next = regenerateFrom({ meta: { ...stored.meta, weeks }, items: stored.items }, today, CATALOG_2026_10, { mode: 'shift' });
    expect(next.weeks[0]?.extras).toEqual(extras);
    expect(next.weeks.flatMap((week) => week.extras).filter((extra) => extra.kind === 'vocab' && extra.topicId === 'topic:food')).toHaveLength(1);
    const long = generateCurriculum(plan(), CATALOG_2026_10);
    const shifted = regenerateFrom({ meta: toMeta(long), items: toPlanItems(long) }, today, CATALOG_2026_10, { mode: 'shift' });
    const soon = shifted.items.filter((item) => item.kind === 'episode');
    expect(soon.length).toBeGreaterThan(0);
    expect(soon.every((item) => item.note === 'Coming soon')).toBe(true);
  });

  it('a start date in the past keeps the first weeks as they were', () => {
    const later = addDays(today, 7);
    const next = regenerateFrom(stored, later, CATALOG_2026_10, { mode: 'shift' });
    expect(next.weeks[0]).toEqual(draft.weeks[0]);
  });
});

/**
 * What a class day taught and how many items each practice date holds. `shift` lays the plan's own future items in
 * date order, so lessons inside one class day may come back in another order; the class days and the load stay.
 */
const layout = (d: CurriculumDraft): { taught: string[]; perDate: Record<string, number> } => ({
  taught: d.items.map((item) => `${item.lectureDate ?? '-'} ${item.id}`).sort(),
  perDate: d.items.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.targetDate!]: (acc[item.targetDate!] ?? 0) + 1 }), {}),
});

describe('re-pacing between a class day and its practice days (review fixes)', () => {
  const draft = generateCurriculum(plan({}, { weeks: 12 }), CATALOG_2026_10);
  const stored = { meta: toMeta(draft), items: toPlanItems(draft) };
  // Thursday: Tuesday's class has taught its lessons; their practice dates are today and later.
  const today = '2026-11-12';
  const taughtBefore = stored.items.filter((item) => item.lectureDate! < today && item.targetDate! >= today);

  it.each(['shift', 'requeue', 'reseed'] as const)('%s keeps the class date of a lesson already taught and plays it within two cycles', (mode) => {
    expect(taughtBefore.length).toBeGreaterThan(0);
    const done = stored.items.filter((item) => item.targetDate! < today).map((item) => item.id);
    const next = regenerateFrom(stored, today, CATALOG_2026_10, {
      mode,
      completedQuestIds: done,
      ...(mode === 'reseed' ? { paramsPatch: { goals: { focus: 'balanced' as const } } } : {}),
    });
    for (const item of stored.items.filter((entry) => entry.lectureDate! < today && !done.includes(entry.id))) {
      const now = next.items.find((entry) => entry.id === item.id);
      expect(now?.lectureDate).toBe(item.lectureDate);
      // Tue class, practice Wed / Fri / Sun: two cycles end on the second Sunday after the class.
      expect(now!.targetDate! >= today).toBe(true);
      expect(now!.targetDate! <= addDays(item.lectureDate!, 12)).toBe(true);
    }
    // No later class day teaches them again.
    expect(next.items.filter((entry) => entry.lectureDate! >= today).some((entry) => taughtBefore.some((t) => t.id === entry.id))).toBe(false);
    expect(new Set(next.items.map((item) => item.id)).size).toBe(next.items.length);
  });

  it('shift with nothing changed lays the same plan again', () => {
    const next = regenerateFrom(stored, today, CATALOG_2026_10, { mode: 'shift' });
    expect(layout(next)).toEqual(layout(draft));
    expect(next.weeks.map((week) => week.kind)).toEqual(draft.weeks.map((week) => week.kind));
  });

  it('shift at weeks 2, 4, 6 and 8 keeps the review and culture cycles where they were', () => {
    const long = generateCurriculum(plan(), CATALOG_2026_10);
    const kept = { meta: toMeta(long), items: toPlanItems(long) };
    for (const week of [2, 4, 6, 8]) {
      const at = addDays('2026-11-03', 7 * (week - 1) + 2);
      const next = regenerateFrom(kept, at, CATALOG_2026_10, { mode: 'shift' });
      expect(next.weeks.map((meta) => meta.kind)).toEqual(long.weeks.map((meta) => meta.kind));
      expect(layout(next)).toEqual(layout(long));
    }
  });

  it('split: cells opened by past classes stay opened, so practice-only lessons do not wait for a class', () => {
    const split = generateCurriculum(plan({ mode: 'split' }, { weeks: 12 }), CATALOG_2026_10);
    const next = regenerateFrom({ meta: toMeta(split), items: toPlanItems(split) }, today, CATALOG_2026_10, { mode: 'shift' });
    expect(layout(next)).toEqual(layout(split));
  });

  it('keeps the Refresh entries dated before today', () => {
    const later = '2026-12-01';
    const before = (draft.refresh ?? []).filter((entry) => entry.date < later);
    expect(before.length).toBeGreaterThan(0);
    const next = regenerateFrom(stored, later, CATALOG_2026_10, { mode: 'shift' });
    expect((next.refresh ?? []).filter((entry) => entry.date < later)).toEqual(before);
    expect(next.refresh?.map((entry) => entry.date)).toEqual(draft.refresh?.map((entry) => entry.date));
  });

  it('counts the plan history towards the 260-item cap', () => {
    const big = bigCatalog(60, 1);
    const full = generateCurriculum(plan({ lecture: { days: ['mon', 'thu'], minutes: 30 } }, { weeks: 52, reviewEvery: 0 }), big);
    expect(full.items).toHaveLength(CURRICULUM_MAX_ITEMS);
    const store = { meta: toMeta(full), items: toPlanItems(full) };
    const at = '2027-06-01';
    const done = store.items.filter((item) => item.targetDate! < at).map((item) => item.id);
    for (const mode of ['requeue', 'reseed', 'shift'] as const) {
      const next = regenerateFrom(store, at, big, {
        mode,
        completedQuestIds: done,
        ...(mode === 'reseed' ? { paramsPatch: { goals: { focus: 'balanced' as const } } } : {}),
      });
      expect(next.items.length).toBeLessThanOrEqual(CURRICULUM_MAX_ITEMS);
      expect(toPlanItems(next)).toHaveLength(next.items.length);
      if (mode !== 'shift') expect(codes(next)).toContain('item-cap');
    }
  });

  it('requeue counts the weeks Keep the average added as sessions left', () => {
    const kept = generateCurriculum(plan({ keepAverage: true }, { weeks: 4, reviewEvery: 0, daysOff: [{ from: '2026-11-10', to: '2026-11-16' }] }), CATALOG_2026_10);
    expect(kept.weeks).toHaveLength(5);
    const store = { meta: toMeta(kept), items: toPlanItems(kept) };
    // Past the planned 4 weeks, inside the added one: a missed item still has somewhere to go.
    const at = '2026-12-02';
    const missed = store.items.filter((item) => item.targetDate! < at);
    const next = regenerateFrom(store, at, CATALOG_2026_10, { mode: 'requeue', completedQuestIds: missed.slice(1).map((item) => item.id) });
    expect(next.items.find((item) => item.id === missed[0]!.id)!.targetDate! >= at).toBe(true);
  });
});

describe('the blend-generator subpath (start bundle)', () => {
  it('is what makes generateCurriculum take a blended plan; without it a blended plan throws', async () => {
    vi.resetModules();
    const fresh = await import('../curriculum/generate');
    expect(() => fresh.generateCurriculum(plan({}, { weeks: 1 }), CATALOG_2026_10)).toThrow(/blend-generator/);
    await import('../curriculum/generate-blend');
    expect(fresh.generateCurriculum(plan({}, { weeks: 1 }), CATALOG_2026_10).generatorVersion).toBe(2);
  });

  it('stays out of the package index', async () => {
    const index = await import('..');
    expect('buildBlended' in index).toBe(false);
    expect('BLEND_GENERATOR_VERSION' in index).toBe(false);
  });
});
