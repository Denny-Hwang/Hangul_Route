import { CATALOG, addDays, generateCurriculum, toMeta, toPlanItems, type CurriculumMeta, type PlanItem } from '@hangul-route/content-schema';
import { LOCALES, getMessages, type UiLocale } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { isCaregiverSafe } from '../banned-text';
import {
  CLASS_LENGTH_CHOICES,
  PRACTICE_COUNT_CHOICES,
  PRACTICE_MINUTES_PICTURES_FIRST,
  defaultsFor,
  meetingShown,
  toParams,
  warningText,
  wizardProblem,
  type WizardState,
} from '../curriculum';
import {
  addPracticeParams,
  addPracticePrefill,
  blendPreviewText,
  changePractice,
  classDaysSoFar,
  cycleRows,
  moveClassDay,
  nextClassDay,
  planPracticeDays,
  practiceDaysOfState,
  practiceFits,
  practiceLine,
  stopPracticeParams,
  thisWeekClasses,
} from '../curriculum-blend';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND sections 10.1, 10.2 and 14 (row BL-4; F-PLAN-002 sections 3.8 and 3.10 as amended by
 * BL-A3): the wizard's meeting block (defaults, `toParams`, the suggested practice days, its problems), the preview's
 * header and cycle table, the readout's class lines, and Move this class day / Add / Stop practice days, on the
 * shipped catalogue. The owner's example: class on Tuesday for 30 minutes, practice 3 times a week for 10 minutes.
 */
const TODAY = '2026-11-02'; // a Monday
const STAGES = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'] as const;

const classState = (over: Partial<WizardState> = {}): WizardState => ({ ...defaultsFor('class', [], TODAY), length: '12-week', ...over });
const owner = (over: Partial<WizardState> = {}): WizardState => classState({ lectureDays: ['tue'], practicePerWeek: 3, ...over });

function published(state: WizardState): { id: string; meta: CurriculumMeta; items: PlanItem[] } {
  const params = toParams(state, [...STAGES], true);
  if (!params) throw new Error('params');
  const draft = generateCurriculum(params, CATALOG);
  return { id: 'plan:blend', meta: toMeta(draft), items: toPlanItems(draft) };
}

describe('defaultsFor and the meeting block (section 10.1)', () => {
  it('a class starts with class days to pick, 30 minutes, 3 practice days (BL-OD-12, since BL-10), 10 minutes, overlap, no average kept', () => {
    const state = defaultsFor('class', [], TODAY);
    expect(state).toMatchObject({ blendMode: 'overlap', lectureDays: [], lectureMinutes: 30, practicePerWeek: 3, practiceMinutes: 10, practiceDays: null, keepAverage: false });
    expect(CLASS_LENGTH_CHOICES).toEqual([15, 20, 30, 45, 60]);
    expect(PRACTICE_COUNT_CHOICES).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('a Pictures-first class (most learners at the first level) practices 5 minutes', () => {
    const learners = [
      { id: 'a', ageGroup: '5-7', summary: null },
      { id: 'b', ageGroup: '5-7', summary: null },
      { id: 'c', ageGroup: '8-9', summary: null },
    ];
    expect(defaultsFor('class', learners, TODAY)).toMatchObject({ practiceMinutes: 5, lectureMinutes: 30, practicePerWeek: 3 });
    expect(PRACTICE_MINUTES_PICTURES_FIRST).toBe(5);
    expect(defaultsFor('class', learners.slice(1), TODAY).practiceMinutes).toBe(10);
  });

  it('a family has no meeting block', () => {
    const state = defaultsFor('family', [], TODAY);
    expect(state.lectureDays).toBeUndefined();
    expect(meetingShown(state, true)).toBe(false);
  });

  it('shows for a class only with the flag on (flag off: the old class-day and homework-day chips)', () => {
    expect(meetingShown(classState(), true)).toBe(true);
    expect(meetingShown(classState(), false)).toBe(false);
  });
});

describe('toParams with the meeting block', () => {
  it('0 practice days writes no blend: the class days are the session days (Class only, unchanged generation)', () => {
    const params = toParams(classState({ lectureDays: ['thu', 'tue'], lectureMinutes: 45, practicePerWeek: 0 }), ['stage1'], true);
    expect(params?.blend).toBeUndefined();
    expect(params).toMatchObject({ sessionsPerWeek: 2, sessionDays: ['tue', 'thu'], minutesPerSession: 30 });
  });

  it('1 or more practice days write blend (section 9.1)', () => {
    const params = toParams(owner(), ['stage1'], true);
    expect(params?.blend).toEqual({
      mode: 'overlap',
      lecture: { days: ['tue'], minutes: 30 },
      personal: { perWeek: 3, minutes: 10 },
      classDaysOff: [],
      keepAverage: false,
    });
    expect(params).toMatchObject({ audience: 'class', sessionsPerWeek: 4, minutesPerSession: 10 });
    expect(params?.sessionDays).toBeUndefined();
  });

  it('carries the teacher days, the split mode, Keep the average and the class-only breaks', () => {
    const params = toParams(
      owner({
        practiceDays: ['sat', 'wed', 'fri'],
        blendMode: 'split',
        keepAverage: true,
        daysOff: [
          { from: '2026-12-21', to: '2027-01-03' },
          { from: '2026-11-15', to: '2026-11-18', classOnly: true },
        ],
      }),
      ['stage1'],
      true,
    );
    expect(params?.blend).toMatchObject({ mode: 'split', personal: { perWeek: 3, days: ['sat', 'wed', 'fri'], minutes: 10 }, classDaysOff: ['2026-11-17'], keepAverage: true });
    expect(params?.daysOff).toEqual([{ from: '2026-12-21', to: '2027-01-03' }]);
  });

  it('with the flag off the meeting fields are not read', () => {
    const state = owner({ sessionDays: ['sun', 'wed'] });
    const params = toParams(state, ['stage1']);
    expect(params?.blend).toBeUndefined();
    expect(params).toMatchObject({ sessionsPerWeek: 2, sessionDays: ['sun', 'wed'] });
  });

  it('names what is missing: a class day, the practice days of Change days, room in the plan', () => {
    expect(wizardProblem(classState(), TODAY, true)).toBe('no-class-day');
    expect(wizardProblem(classState(), TODAY)).toBeNull();
    expect(wizardProblem(owner({ practiceDays: ['wed'] }), TODAY, true)).toBe('practice-days');
    expect(wizardProblem(owner({ practiceDays: ['wed', 'fri', 'sun'] }), TODAY, true)).toBeNull();
    expect(wizardProblem(owner({ lectureDays: ['mon', 'tue', 'wed', 'thu', 'fri'], practicePerWeek: 7, length: 'custom', customWeeks: 26 }), TODAY, true)).toBe('too-many');
  });
});

describe('the suggested practice days (section 6.3 via practiceDaysFor)', () => {
  it('reads "Practice on Wed, Fri, Sun" for class on Tuesday and 3 practice days', () => {
    expect(practiceDaysOfState(owner())).toEqual(['wed', 'fri', 'sun']);
    expect(practiceLine(['tue'], practiceDaysOfState(owner()), 'en')).toBe('Practice on Wed, Fri, Sun');
  });

  it('collapses to every day, and names the class day that also holds practice (BL-OD-19)', () => {
    expect(practiceLine(['tue'], practiceDaysOfState(owner({ practicePerWeek: 6 })), 'en')).toBe('Practice every day');
    expect(practiceLine(['tue'], practiceDaysOfState(owner({ practicePerWeek: 7 })), 'en')).toBe('Practice every day, also after class on Tuesday');
    expect(practiceLine(['tue'], [], 'en')).toBeNull();
  });

  it('keeps the teacher days from Change days, in week order from Monday', () => {
    expect(practiceDaysOfState(owner({ practiceDays: ['sun', 'mon', 'thu'] }))).toEqual(['mon', 'thu', 'sun']);
    expect(practiceDaysOfState(classState({ practicePerWeek: 3 }))).toEqual([]);
  });

  it('words the line in Spanish and Korean with the glossary', () => {
    expect(practiceLine(['tue'], ['wed', 'fri', 'sun'], 'es')).toMatch(/^Práctica: /);
    expect(practiceLine(['sat'], ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], 'es')).toBe('Práctica todos los días, también después de la clase de los sábados');
    expect(practiceLine(['tue'], ['wed', 'fri', 'sun'], 'ko')).toMatch(/^연습: /);
  });
});

describe('the preview (section 10.2)', () => {
  const plan = published(owner({ length: '6-month' }));
  const params = toParams(owner({ length: '6-month' }), [...STAGES], true);
  const draft = generateCurriculum(params ?? (undefined as never), CATALOG);

  it('heads it with the sessions a week, each kind of day, and the totals from the draft stats', () => {
    const text = blendPreviewText(draft, 'en');
    expect(text?.header).toBe('About 4 sessions a week: 1 class day (30 min) and 3 practice days (10 min each, plus about 2-3 minutes of Daily Review).');
    expect(text?.perDay).toMatch(/^Class days teach about \d+ lessons?; practice days play about \d+\.$/);
    expect(text?.average).toBe(`${draft.stats.sessions} sessions in all, 4 a teaching week.`);
    expect(text?.start).toBe('Starts with the first class on Tue, Nov 3.');
    expect(text?.endsOn).toBeNull();
    expect(draft.stats.sessions).toBe(104);
  });

  it('says "on all 7 days" when class days also hold practice', () => {
    const every = generateCurriculum(toParams(owner({ practicePerWeek: 7 }), [...STAGES], true) ?? (undefined as never), CATALOG);
    expect(blendPreviewText(every, 'en')?.header).toMatch(/^About 8 sessions a week on all 7 days: 1 class day \(30 min\) and 7 practice days/);
  });

  it('has nothing to say about a Class only plan (0 practice days)', () => {
    expect(blendPreviewText(generateCurriculum(toParams(classState({ lectureDays: ['tue'], practicePerWeek: 0 }), ['stage1'], true) ?? (undefined as never), CATALOG))).toBeNull();
  });

  it('lays one row per class cycle: the class cell with its lessons, the practice cell with lessons and Refresh', () => {
    const rows = cycleRows({ ...plan.meta, items: plan.items }, 'en');
    expect(rows).toHaveLength(26);
    const first = rows[0];
    expect(first).toMatchObject({ week: 1, classDate: '2026-11-03', classHeld: true });
    expect(first?.classItems.length).toBeGreaterThan(0);
    expect(first?.practice.map((cell) => cell.date)).toEqual(['2026-11-04', '2026-11-06', '2026-11-08']);
    // Overlap: every practice lesson came from class, and every practice date has something to do.
    for (const row of rows) for (const cell of row.practice) {
      expect(cell.items.every((item) => !item.practiceOnly)).toBe(true);
      expect(cell.items.length > 0 || cell.refresh).toBe(true);
    }
  });

  it('keeps a class day off as a row with no class (Only the class is off)', () => {
    const off = published(owner({ length: '6-month', daysOff: [{ from: '2026-11-10', to: '2026-11-10', classOnly: true }] }));
    const row = cycleRows({ ...off.meta, items: off.items }, 'en')[1];
    expect(row).toMatchObject({ classDate: '2026-11-10', classHeld: false, classItems: [] });
    expect(row?.practice).toHaveLength(3);
  });

  it('words the three blended warnings (section 6.6)', () => {
    expect(warningText({ code: 'item-cap', week: 24 }, 'en')).toBe('This plan is full at week 24. Choose fewer weeks, or practice what class taught.');
    expect(warningText({ code: 'practice-short' }, 'en')).toMatch(/^Practice days can't keep up/);
    expect(warningText({ code: 'class-paced', week: 2, count: 1 }, 'en')).toBe('Some class days carry fewer lessons so learners can practice each one soon after.');
  });
});

describe('the readout (section 10.2)', () => {
  const plan = published(owner({ daysOff: [{ from: '2026-11-24', to: '2026-11-24', classOnly: true }] }));

  it('counts scheduled class days so far, class days off left out (never attendance)', () => {
    expect(classDaysSoFar(plan.meta, '2026-11-02')).toEqual({ n: 0, total: 11 });
    expect(classDaysSoFar(plan.meta, '2026-11-17')).toEqual({ n: 3, total: 11 });
    expect(classDaysSoFar(plan.meta, '2026-11-25')).toEqual({ n: 3, total: 11 });
  });

  it('names the next class day and this week\'s class lessons', () => {
    expect(nextClassDay(plan.meta, '2026-11-04')).toBe('2026-11-10');
    expect(nextClassDay(plan.meta, '2026-11-24')).toBe('2026-12-01');
    const week = thisWeekClasses(plan.meta, plan.items, '2026-11-05', 'en');
    expect(week.map((entry) => entry.date)).toEqual(['2026-11-03']);
    expect(week[0]?.items.length).toBeGreaterThan(0);
  });

  it('shows the class default practice days', () => {
    expect(planPracticeDays(plan.meta)).toEqual(['wed', 'fri', 'sun']);
  });

  it('Move this class day keeps the plan id, adds the class day off and keeps what is before it', () => {
    const moved = moveClassDay(plan, '2026-11-10', '2026-11-05', '2026-11-05T09:00:00.000Z');
    expect(moved.planId).toBe(plan.id);
    expect(moved.meta.params.blend?.classDaysOff).toEqual(['2026-11-10', '2026-11-24']);
    expect(moved.meta.repacedAt).toBe('2026-11-05T09:00:00.000Z');
    const before = (items: readonly PlanItem[]) => items.filter((item) => (item.targetDate ?? '') < '2026-11-10');
    expect(before(moved.items)).toEqual(before(plan.items));
    expect(moved.items.some((item) => item.lectureDate === '2026-11-10')).toBe(false);
  });

  it('Stop practice days lays the future out as a Class only plan; Add practice days lays it out again with blend', () => {
    const stop = stopPracticeParams(plan.meta.params, '2026-11-05');
    if (stop === null || typeof stop === 'string') throw new Error('stop');
    expect(stop).toMatchObject({ sessionsPerWeek: 1, sessionDays: ['tue'], minutesPerSession: 30 });
    expect(stop.blend).toBeUndefined();
    // Only the class is off on 24 November: the Class only plan keeps that class off (a one-day plan day off).
    expect(stop.daysOff).toEqual([{ from: '2026-11-24', to: '2026-11-24' }]);
    const stopped = changePractice(plan, stop, '2026-11-05', '2026-11-05T09:00:00.000Z');
    expect(stopped.meta.params.blend).toBeUndefined();
    expect(stopped.items.some((item) => item.targetDate === '2026-11-24')).toBe(false);
    expect(stopped.items.some((item) => item.targetDate === '2026-12-01')).toBe(true);
    expect(stopped.items.filter((item) => (item.targetDate ?? '') >= '2026-11-05').every((item) => item.lectureDate === undefined)).toBe(true);

    const classOnly = { ...plan, meta: stopped.meta, items: stopped.items };
    const prefill = { ...owner(), ...addPracticePrefill(classOnly.meta.params) };
    expect(prefill).toMatchObject({ lectureDays: ['tue'], practicePerWeek: 1, blendMode: 'overlap' });
    const add = addPracticeParams(classOnly.meta.params, prefill);
    expect(add?.blend).toMatchObject({ lecture: { days: ['tue'], minutes: 30 }, personal: { perWeek: 1, minutes: 10 } });
    expect(practiceFits(classOnly.meta.params, prefill)).toBe(true);
    const added = changePractice(classOnly, add ?? (undefined as never), '2026-11-05', '2026-11-05T09:00:00.000Z');
    expect(added.planId).toBe(plan.id);
    expect(added.meta.params.blend?.personal.perWeek).toBe(1);
    expect(added.items.some((item) => item.lectureDate !== undefined && item.lectureDate >= '2026-11-05')).toBe(true);
  });

  it('Stop practice days keeps only class days off from today on, joins touching ones, and holds to 12 ranges', () => {
    expect(stopPracticeParams(plan.meta.params, '2026-11-25')).toMatchObject({ daysOff: [] });
    const params = { ...plan.meta.params, daysOff: [{ from: '2026-11-25', to: '2026-11-30' }] };
    expect(stopPracticeParams(params, TODAY)).toMatchObject({ daysOff: [{ from: '2026-11-24', to: '2026-11-30' }] });
    const full = {
      ...plan.meta.params,
      daysOff: Array.from({ length: 12 }, (_, k) => ({ from: `2027-0${1 + Math.floor(k / 4)}-0${1 + 2 * (k % 4)}`, to: `2027-0${1 + Math.floor(k / 4)}-0${1 + 2 * (k % 4)}` })),
    };
    expect(stopPracticeParams(full, TODAY)).toBe('too-many-breaks');
  });

  it('Move this class day reaches a class day in the weeks Keep the average added', () => {
    const kept = published(owner({ keepAverage: true, daysOff: [{ from: '2026-11-09', to: '2026-11-22' }] }));
    expect(kept.meta.weeks.length).toBeGreaterThan(kept.meta.params.weeks);
    const last = nextClassDay(kept.meta, addDays(kept.meta.params.startDate, 7 * kept.meta.params.weeks));
    expect(last).not.toBeNull();
    const moved = moveClassDay(kept, last ?? '', last ?? '', '2026-11-05T09:00:00.000Z');
    expect(moved.meta.params.blend?.classDaysOff).toContain(last);
  });

  it('counts a lesson that no longer fits once, however many practice rows it had', () => {
    const stop = stopPracticeParams(plan.meta.params, '2026-11-05');
    if (stop === null || typeof stop === 'string') throw new Error('stop');
    const stopped = changePractice(plan, stop, '2026-11-05', '2026-11-05T09:00:00.000Z');
    const key = (item: PlanItem): string => `${item.kind}:${item.id}`;
    const ahead = (items: readonly PlanItem[]) => new Set(items.filter((item) => (item.targetDate ?? '9999') >= '2026-11-05').map(key));
    const after = ahead(stopped.items);
    expect(stopped.leftOver).toBeGreaterThanOrEqual([...ahead(plan.items)].filter((k) => !after.has(k)).length);
    expect(stopped.leftOver).toBeLessThanOrEqual(ahead(plan.items).size);
  });

  it('Add practice days starts with no class day when the homework day cannot be told apart', () => {
    expect(addPracticePrefill({ sessionDays: ['tue', 'thu'] }).lectureDays).toEqual([]);
    expect(addPracticePrefill({}).lectureDays).toEqual([]);
    expect(addPracticeParams(plan.meta.params, { ...owner(), lectureDays: [] })).toBeNull();
    expect(stopPracticeParams(stopPracticeParams(plan.meta.params) as never)).toBeNull();
  });
});

describe('every console.curriculum.blend word stays calm (section 13)', () => {
  const samples = (locale: UiLocale): string[] => {
    const b = getMessages(locale).console.curriculum.blend;
    return [
      b.meeting.title,
      b.meeting.pickClassDay,
      b.meeting.maxClassDays,
      b.classDays,
      b.classLength,
      b.practice.row,
      b.practice.days,
      b.practice.minutes,
      b.practice.inline('3', '10'),
      b.practice.suggested('Wed'),
      b.practice.change.cta,
      b.practice.everyDay,
      b.practice.afterClass('Tuesday'),
      b.practice.daysLabel,
      b.practice.pickDays(3),
      ...Object.values(b.mode),
      b.keepAverage,
      b.classDayOff,
      b.preview.everyDay,
      b.preview.header(4, 1, 30, 3, 10, null),
      b.preview.header(8, 1, 30, 7, 10, b.preview.everyDay),
      b.preview.perDay(3, 1),
      b.preview.average(95, '4', '3.7'),
      b.preview.start('Tue, Nov 10'),
      b.preview.endsOn('Tue, May 11'),
      b.preview.refresh,
      b.preview.classCol,
      b.preview.practiceCol,
      b.preview.practiceOnlyTag,
      b.preview.classReview,
      b.preview.noClass,
      b.preview.tableLabel,
      b.readout.classDay('Tue, Nov 17'),
      b.readout.classDays(2, 23),
      b.readout.move.cta,
      b.readout.moveAsk('Tue, Nov 17'),
      b.readout.moveConfirm.cta,
      b.readout.moved,
      b.readout.addPractice.cta,
      b.readout.stopPractice.cta,
      b.readout.stopAsk,
      b.readout.stopConfirm.cta,
      b.readout.save.cta,
      b.readout.changed,
      b.readout.failed,
      b.warn.itemCap(24),
      b.warn.practiceShort,
      b.warn.classPaced,
    ];
  };

  for (const locale of LOCALES) {
    it(`${locale}: caregiver-safe, no "lecture", no attendance, no ranking, no emoji`, () => {
      for (const text of samples(locale)) {
        expect(isCaregiverSafe(text, locale), text).toBe(true);
        expect(text, text).not.toMatch(/lecture|attend|absent|behind|missed|rank|best|worst|asist|falt|강의|출석|결석|등수/i);
        expect(text, text).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    });
  }

  it('Korean uses 수업 and 연습, Spanish clase and práctica', () => {
    const ko = getMessages('ko').console.curriculum.blend;
    const es = getMessages('es').console.curriculum.blend;
    expect(ko.preview.classCol).toBe('수업');
    expect(ko.preview.practiceCol).toBe('연습');
    expect(es.preview.classCol).toBe('Clase');
    expect(es.preview.practiceCol).toBe('Práctica');
  });
});
