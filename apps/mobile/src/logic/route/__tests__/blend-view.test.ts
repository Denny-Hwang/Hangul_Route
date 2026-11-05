import { formatDate, getMessages } from '@hangul-route/i18n';
import type { Weekday } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import type { DeriveSource } from '../../homework/plan-derivation';
import { blendedMeta, curriculumMeta } from '../../homework/__tests__/curriculum-fixture';
import {
  WEEKDAY_DATE,
  blendHomeOf,
  blendWeekOf,
  cellCheckOpener,
  fromClassPillOf,
  refreshRouteOf,
  classTodayOf,
  planRowBlendOf,
  plannedPracticeDays,
  practicePartOf,
  refreshShows,
  refreshStartedEvent,
  weeklyPlanLine,
  type BlendWeek,
} from '../blend-view';

// AMENDMENTS-ROUTE-CLASS-BLEND sections 7 and 8 (row BL-7). A Tuesday class from 2026-09-22 (route 2026-09-22 to 2026-10-19).
const src = (id: string, assignedAt: string, meta: DeriveSource['meta'], kind: DeriveSource['kind'] = 'class'): DeriveSource => ({ id, kind, assignedAt, items: [], meta });
const IN = '2026-09-24';
const week = (classDays: Weekday[], practiceDays: Weekday[]): BlendWeek => ({ classDays, practiceDays });
const lineIn = (locale: 'en' | 'es' | 'ko', w: BlendWeek): string =>
  weeklyPlanLine(w, getMessages(locale).learner.route.blend, (day) => formatDate(locale, `${WEEKDAY_DATE[day]}T00:00:00.000Z`, 'weekdayLong', { utc: true }));

describe('WEEKDAY_DATE', () => {
  it('names each weekday on its own date', () => {
    for (const [day, date] of Object.entries(WEEKDAY_DATE)) {
      expect(formatDate('en', `${date}T00:00:00.000Z`, 'weekday', { utc: true }).toLowerCase().slice(0, 3)).toBe(day);
    }
  });
});

describe('practicePartOf: the collapse rules of section 7', () => {
  it('1 to 3 practice days are named, in week order from Monday', () => {
    expect(practicePartOf(week(['tue'], ['wed']))).toEqual({ kind: 'on', days: ['wed'] });
    expect(practicePartOf(week(['tue'], ['sun', 'wed', 'fri']))).toEqual({ kind: 'on', days: ['wed', 'fri', 'sun'] });
  });

  it('5 practice days that leave a free weekday read "most days"; 4 too', () => {
    expect(practicePartOf(week(['tue'], ['wed', 'thu', 'fri', 'sat', 'sun']))).toEqual({ kind: 'most' });
    expect(practicePartOf(week(['tue'], ['wed', 'fri', 'sat', 'sun']))).toEqual({ kind: 'most' });
  });

  it('5 practice days on every non-class day read "every day" (two class days fill the rest)', () => {
    expect(practicePartOf(week(['mon', 'thu'], ['tue', 'wed', 'fri', 'sat', 'sun']))).toEqual({ kind: 'every' });
  });

  it('6 practice days: "every day except" names the one weekday with neither class nor practice', () => {
    expect(practicePartOf(week(['tue'], ['tue', 'wed', 'thu', 'fri', 'sat', 'sun']))).toEqual({ kind: 'all-but', day: 'mon' });
  });

  it('6 practice days on every non-class day read "every day" (README finding 1)', () => {
    expect(practicePartOf(week(['tue'], ['wed', 'thu', 'fri', 'sat', 'sun', 'mon']))).toEqual({ kind: 'every' });
  });

  it('7 practice days read "every day"', () => {
    expect(practicePartOf(week(['tue'], ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))).toEqual({ kind: 'every' });
  });
});

describe('weeklyPlanLine', () => {
  it('en: class and practice days with the locale list', () => {
    expect(lineIn('en', week(['tue'], ['wed', 'fri', 'sun']))).toBe("Your class's weekly plan: class on Tuesday, practice on Wednesday, Friday, and Sunday.");
    expect(lineIn('en', week(['mon', 'thu'], ['wed']))).toBe("Your class's weekly plan: class on Monday and Thursday, practice on Wednesday.");
    expect(lineIn('en', week(['tue'], ['wed', 'thu', 'fri', 'sat', 'sun']))).toBe("Your class's weekly plan: class on Tuesday, practice on most days.");
    expect(lineIn('en', week(['tue'], ['tue', 'wed', 'thu', 'fri', 'sat', 'sun']))).toBe("Your class's weekly plan: class on Tuesday, practice every day except Monday.");
    expect(lineIn('en', week(['tue'], ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))).toBe("Your class's weekly plan: class on Tuesday, practice every day.");
  });

  it('es: plural article and plural names for a weekly habit', () => {
    expect(lineIn('es', week(['tue'], ['wed', 'fri', 'sun']))).toBe('Plan semanal de tu clase: clase los martes, práctica los miércoles, viernes y domingos.');
    expect(lineIn('es', week(['sat'], ['tue', 'wed', 'thu', 'fri', 'sat', 'sun']))).toBe('Plan semanal de tu clase: clase los sábados, práctica todos los días menos los lunes.');
  });

  it('ko: weekday names joined by a middle dot', () => {
    expect(lineIn('ko', week(['tue'], ['wed', 'fri', 'sun']))).toBe('반의 주간 계획: 화요일 수업, 수요일·금요일·일요일 연습.');
    expect(lineIn('ko', week(['tue'], ['wed', 'thu', 'fri', 'sat', 'sun']))).toBe('반의 주간 계획: 화요일 수업, 거의 매일 연습.');
  });

  it('never names a count above 3 or a date, in any locale and any day count', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      for (let n = 1; n <= 7; n += 1) {
        const practice = (['mon', 'wed', 'fri', 'sun', 'sat', 'thu', 'tue'] as Weekday[]).slice(0, n);
        const text = lineIn(locale, week(['tue'], practice));
        expect(text, text).not.toMatch(/\d/);
      }
    }
  });
});

describe('blendWeekOf', () => {
  it("reads the plan's practice days, else the default ones; null outside the layer", () => {
    expect(blendWeekOf([src('plan:a', 't', blendedMeta({ practiceDays: ['sun', 'wed', 'fri'] }))], IN)).toEqual({ classDays: ['tue'], practiceDays: ['wed', 'fri', 'sun'] });
    // Without the plan's list, the days the generator wrote (`sessionDays`, the union with the class days).
    expect(blendWeekOf([src('plan:a', 't', blendedMeta({ perWeek: 3, sessionDays: ['tue', 'wed', 'fri', 'sun'] }))], IN)).toEqual({ classDays: ['tue'], practiceDays: ['wed', 'fri', 'sun'] });
    // Neither: no line rather than a guess.
    expect(blendWeekOf([src('plan:a', 't', blendedMeta({ perWeek: 3 }))], IN)).toBeNull();
    expect(blendWeekOf([src('plan:a', 't', curriculumMeta())], IN)).toBeNull();
    expect(blendWeekOf([src('plan:a', 't', blendedMeta(), 'family')], IN)).toBeNull();
    expect(blendWeekOf([src('plan:a', 't', blendedMeta())], '2026-12-01')).toBeNull();
  });

  it("uses the learner's own practice days when they moved them (BL-OD-7)", () => {
    const own = [{ planId: 'plan:a', days: ['sat', 'mon'] as Weekday[], updatedAt: '2026-09-23T00:00:00.000Z' }];
    expect(blendWeekOf([src('plan:a', 't', blendedMeta({ practiceDays: ['wed'] , perWeek: 1 }))], IN, own)).toEqual({ classDays: ['tue'], practiceDays: ['mon', 'sat'] });
    const other = [{ ...own[0]!, planId: 'plan:other' }];
    expect(blendWeekOf([src('plan:a', 't', blendedMeta({ practiceDays: ['wed'], perWeek: 1 }))], IN, other)?.practiceDays).toEqual(['wed']);
  });

  it('the newest blended plan leads', () => {
    const older = src('plan:a', '2026-09-01T00:00:00.000Z', blendedMeta({ practiceDays: ['wed'], perWeek: 1 }));
    const newer = src('plan:b', '2026-09-02T00:00:00.000Z', blendedMeta({ lectureDays: ['thu'], practiceDays: ['sat'], perWeek: 1 }));
    expect(blendWeekOf([older, newer], IN)).toEqual({ classDays: ['thu'], practiceDays: ['sat'] });
  });
});

describe('plannedPracticeDays', () => {
  it('reads the non-class days of sessionDays, then class days in week order when practice outnumbers them', () => {
    expect(plannedPracticeDays(['tue'], 3, ['tue', 'wed', 'fri', 'sun'])).toEqual(['wed', 'fri', 'sun']);
    expect(plannedPracticeDays(['tue'], 7, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).toEqual(['mon', 'wed', 'thu', 'fri', 'sat', 'sun', 'tue']);
    expect(plannedPracticeDays(['mon', 'thu'], 6, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).toEqual(['tue', 'wed', 'fri', 'sat', 'sun', 'mon']);
    expect(plannedPracticeDays(['tue'], 3, undefined)).toBeNull();
    expect(plannedPracticeDays(['tue'], 3, [])).toBeNull();
  });

  it('matches the shared practiceDaysFor whenever the generator wrote its days as sessionDays', async () => {
    const { practiceDaysFor } = await import('@hangul-route/content-schema/blend');
    const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
    for (const classDays of [['tue'], ['mon', 'thu'], ['wed', 'sat'], ['mon', 'wed', 'fri']] as Weekday[][]) {
      for (let perWeek = 1; perWeek <= 7; perWeek += 1) {
        const shared = practiceDaysFor(classDays, perWeek);
        const union = DAYS.filter((d) => classDays.includes(d) || shared.includes(d));
        expect(new Set(plannedPracticeDays(classDays, perWeek, union)), `${classDays.join()} ${perWeek}`).toEqual(new Set(shared));
      }
    }
  });
});

describe('classTodayOf', () => {
  const plan = src('plan:a', 't', blendedMeta());
  it('is true on a class weekday of the route only', () => {
    expect(classTodayOf([plan], '2026-09-22')).toBe(true);
    expect(classTodayOf([plan], '2026-09-23')).toBe(false);
    expect(classTodayOf([plan], '2026-12-01')).toBe(false);
    expect(classTodayOf([], '2026-09-22')).toBe(false);
  });

  it('is false on a class day off', () => {
    const meta = blendedMeta();
    const off = { ...meta, params: { ...meta.params, blend: { ...meta.params.blend!, classDaysOff: ['2026-09-29'] } } };
    expect(classTodayOf([src('plan:a', 't', off)], '2026-09-29')).toBe(false);
    expect(classTodayOf([src('plan:a', 't', off)], '2026-09-22')).toBe(true);
  });

  it('is false inside the plan\'s days off (both sessions of the date are off, section 6.1)', () => {
    const meta = blendedMeta();
    const off = { ...meta, params: { ...meta.params, daysOff: [{ from: '2026-09-28', to: '2026-10-04' }] } };
    expect(classTodayOf([src('plan:a', 't', off)], '2026-09-29')).toBe(false);
    expect(classTodayOf([src('plan:a', 't', off)], '2026-09-22')).toBe(true);
    expect(classTodayOf([src('plan:a', 't', off)], '2026-10-06')).toBe(true);
  });
});

describe('refreshShows and refreshStartedEvent', () => {
  it('shows after the day lessons are done, or when there are none; never without a step', () => {
    expect(refreshShows({ kind: 'daily-review' }, 0)).toBe(true);
    expect(refreshShows({ kind: 'cell-check', cellId: 'c' }, 0)).toBe(true);
    expect(refreshShows({ kind: 'daily-review' }, 1)).toBe(false);
    expect(refreshShows(null, 0)).toBe(false);
  });

  it('sends the via code only: no profile, cell or date', () => {
    expect(refreshStartedEvent({ kind: 'cell-check', cellId: 'episode:x' })).toEqual({ name: 'route.refresh_started', payload: { via: 'cell-check' } });
    expect(refreshStartedEvent({ kind: 'daily-review' })).toEqual({ name: 'route.refresh_started', payload: { via: 'daily-review' } });
  });
});

describe('planRowBlendOf', () => {
  it('resting with an own plan, the proposal line without one, nothing outside the layer', () => {
    expect(planRowBlendOf({ layerWithPractice: true, hasOwnPlan: true })).toBe('resting');
    expect(planRowBlendOf({ layerWithPractice: true, hasOwnPlan: false })).toBe('instead');
    expect(planRowBlendOf({ layerWithPractice: false, hasOwnPlan: true })).toBeNull();
  });
});

describe('refreshRouteOf, cellCheckOpener, blendHomeOf and fromClassPillOf', () => {
  it('Refresh opens the Cell Check of its cell, else Daily Review', () => {
    expect(refreshRouteOf({ kind: 'cell-check', cellId: 'episode:s1' })).toEqual({ name: 'CellCheck', params: { cellId: 'episode:s1', mode: 'check' } });
    expect(refreshRouteOf({ kind: 'daily-review' })).toEqual({ name: 'DailyReview' });
  });

  it('a Cell Check is open when the switch is on, every quest is open, and the first volume is done or tested out', () => {
    const episodes = [{ id: 'cell:a', questIds: ['q1', 'q2', 'q3'], optionalQuestIds: ['q3'] }];
    const base = { checkOn: true, episodes, doneQuestIds: new Set(['q1', 'q2']), testedOut: undefined, isQuestOpen: () => true };
    expect(cellCheckOpener(base)('cell:a')).toBe(true);
    expect(cellCheckOpener({ ...base, checkOn: false })('cell:a')).toBe(false);
    expect(cellCheckOpener({ ...base, doneQuestIds: new Set(['q1']) })('cell:a')).toBe(false);
    expect(cellCheckOpener({ ...base, doneQuestIds: new Set(), testedOut: { 'cell:a': '2026-09-01' } })('cell:a')).toBe(true);
    expect(cellCheckOpener({ ...base, isQuestOpen: (q) => q !== 'q2' })('cell:a')).toBe(false);
    expect(cellCheckOpener(base)('cell:unknown')).toBe(false);
  });

  it('Home gets nothing new while the switch is off', () => {
    const sources = [src('plan:a', 't', blendedMeta({ refresh: [{ date: '2026-09-22', cellIds: ['cell:a'] }] }))];
    expect(blendHomeOf({ enabled: false, sources, today: '2026-09-22', isCellCheckOpen: () => true })).toEqual({ classToday: false, refresh: null });
    expect(blendHomeOf({ enabled: true, sources, today: '2026-09-22', isCellCheckOpen: () => true })).toEqual({ classToday: true, refresh: { kind: 'cell-check', cellId: 'cell:a' } });
  });

  it('the From class pill keeps its words; only a lesson met in class gains the glyph and the longer name, with the switch on', () => {
    const base = { label: 'From class', metLabel: 'From class. You met this in class.' };
    expect(fromClassPillOf({ ...base, enabled: true, fromClass: true })).toEqual({ label: 'From class', icon: 'class', accessibilityLabel: base.metLabel });
    expect(fromClassPillOf({ ...base, enabled: true, fromClass: undefined })).toEqual({ label: 'From class' });
    expect(fromClassPillOf({ ...base, enabled: false, fromClass: true })).toEqual({ label: 'From class' });
  });
});
