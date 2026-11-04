import type { ReportSummary } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { isCaregiverSafe } from '../banned-text';
import { describe, expect, it } from 'vitest';
import type { PlanView, TransferList } from '../api';
import {
  classHasPracticeLine,
  classLineWithMeeting,
  familyPlanSave,
  familyPlanStep,
  meetingOf,
  pausedPlanIds,
  practiceWeekView,
  rememberPausedPlans,
  readMeeting,
  weekdayHabit,
  type ClassMeeting,
} from '../family-blend';

// AMENDMENTS-ROUTE-CLASS-BLEND sections 8 and 11 (BL-OD-6, BL-OD-11), row BL-9; wireframe parent/route-class-blend.md.

const meeting: ClassMeeting = { classDays: ['tue'], perWeek: 3, practiceDays: ['wed', 'fri', 'sun'] };
const transfers = (classes: TransferList['options'] extends (infer O)[] | undefined ? O extends { classes: infer C } ? C : never : never): TransferList => ({
  requests: [],
  options: [{ learnerId: 'mina', name: 'Mina', classes, selfManaged: false, blockTeacherRequests: false }],
});

const plan = (over: Partial<PlanView> = {}): PlanView => ({
  id: 'plan:fam',
  spaceId: 'space:fam',
  authorAccountId: 'mom',
  title: 'Our week',
  items: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }],
  targetLearnerIds: null,
  publishedAt: '2026-10-01T00:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

describe('meeting reads', () => {
  it('reads a meeting whole, and nothing else', () => {
    expect(readMeeting(meeting)).toEqual(meeting);
    for (const bad of [null, 'x', {}, { ...meeting, perWeek: 0 }, { ...meeting, perWeek: 8 }, { ...meeting, perWeek: 2.5 }, { ...meeting, classDays: [] }, { ...meeting, classDays: ['tue', 'tue'] }, { ...meeting, practiceDays: ['someday'] }]) {
      expect(readMeeting(bad)).toBeNull();
    }
  });

  it("takes the child's one class only; two classes keep GX-4's line", () => {
    expect(meetingOf('mina', transfers([{ spaceId: 'a', name: 'Evening Class D', meeting }]))).toEqual(meeting);
    expect(meetingOf('mina', transfers([{ spaceId: 'a', name: 'A', meeting }, { spaceId: 'b', name: 'B', meeting }]))).toBeNull();
    expect(meetingOf('mina', transfers([{ spaceId: 'a', name: 'A' }]))).toBeNull();
    expect(meetingOf('jun', transfers([{ spaceId: 'a', name: 'A', meeting }]))).toBeNull();
    expect(meetingOf('mina', null)).toBeNull();
  });
});

describe('the child card class line (P1)', () => {
  it('appends how the class meets on the same line, in every locale', () => {
    expect(classLineWithMeeting({ kind: 'one', name: 'Evening Class D' }, meeting, true, 'en')).toEqual(['In: Evening Class D · class on Tuesday, practice 3 times a week']);
    expect(classLineWithMeeting({ kind: 'one', name: 'Evening Class D' }, { ...meeting, perWeek: 1 }, true, 'en')).toEqual(['In: Evening Class D · class on Tuesday, practice 1 time a week']);
    expect(classLineWithMeeting({ kind: 'one', name: 'Clase D' }, meeting, true, 'es')).toEqual(['En: Clase D · clase los martes, práctica 3 veces por semana']);
    expect(classLineWithMeeting({ kind: 'one', name: '저녁반' }, meeting, true, 'ko')).toEqual(['소속: 저녁반 · 화요일 수업, 주 3회 연습']);
  });

  it("keeps GX-4's words with the flag off, without a meeting, or with two classes", () => {
    const p = getMessages('en').console.parentHome.classLine;
    expect(classLineWithMeeting({ kind: 'one', name: 'A' }, meeting, false, 'en')).toEqual([p.one('A')]);
    expect(classLineWithMeeting({ kind: 'one', name: 'A' }, null, true, 'en')).toEqual([p.one('A')]);
    expect(classLineWithMeeting({ kind: 'many', names: ['A', 'B'] }, meeting, true, 'en')).toEqual([p.many(2), 'A · B']);
    expect(classLineWithMeeting({ kind: 'none' }, meeting, true, 'en')).toEqual([p.none]);
  });

  it('lists weekdays as a habit: week order, es plural names, ko middle dot', () => {
    expect(weekdayHabit(['sun', 'wed', 'fri'], 'en')).toBe('Wednesday, Friday, and Sunday');
    expect(weekdayHabit(['sat', 'sun', 'mon'], 'es')).toBe('lunes, sábados y domingos');
    expect(weekdayHabit(['sun', 'wed', 'fri'], 'ko')).toBe('수요일·금요일·일요일');
    expect(classHasPracticeLine('Mina', meeting, 'en')).toBe("Mina's class has practice days on Wednesday, Friday, and Sunday.");
    expect(classHasPracticeLine('Mina', meeting, 'es')).toBe('La clase de Mina tiene días de práctica los miércoles, viernes y domingos.');
  });
});

describe('Pause and Resume the family weekly plan (BL-OD-6)', () => {
  const two = ['mina', 'jun'];
  const three = ['mina', 'jun', 'sora'];

  it('offers Pause for the live whole-family plans only, with a class with practice days, the right to write and the roster read', () => {
    const everyone = plan();
    const named = plan({ id: 'plan:named', targetLearnerIds: ['mina', 'jun'], publishedAt: '2026-10-02T00:00:00.000Z' });
    const draft = plan({ id: 'plan:draft', publishedAt: null });
    const archived = plan({ id: 'plan:old', archivedAt: '2026-10-03T00:00:00.000Z' });
    expect(familyPlanStep('mina', meeting, [everyone, named, draft, archived], true, two)).toEqual({ kind: 'pause', plans: [named, everyone] });
    expect(familyPlanStep('mina', null, [everyone], true, two)).toBeNull();
    expect(familyPlanStep('mina', meeting, undefined, true, two)).toBeNull();
    expect(familyPlanStep('mina', meeting, [everyone], false, two)).toBeNull();
    expect(familyPlanStep('mina', meeting, [everyone], true, [])).toBeNull();
    expect(familyPlanStep('mina', meeting, [draft, archived], true, two)).toBeNull();
  });

  it("never pauses a plan made for this child alone or for some of the children", () => {
    const minaOnly = plan({ id: 'plan:mina', targetLearnerIds: ['mina'] });
    const some = plan({ id: 'plan:some', targetLearnerIds: ['mina', 'jun'] });
    expect(familyPlanStep('mina', meeting, [minaOnly], true, two)).toBeNull();
    expect(familyPlanStep('mina', meeting, [some], true, three)).toBeNull();
    // A family of one: the plan for everyone pauses, the plan naming the child alone does not.
    expect(familyPlanStep('mina', meeting, [minaOnly], true, ['mina'])).toBeNull();
    expect(familyPlanStep('mina', meeting, [plan()], true, ['mina'])?.kind).toBe('pause');
  });

  it('offers Resume only for the shape Pause leaves; in a family of two only for the plans paused here', () => {
    const paused3 = plan({ targetLearnerIds: ['sora', 'jun'] });
    expect(familyPlanStep('mina', meeting, [paused3], true, three)).toEqual({ kind: 'resume', plans: [paused3] });
    // A plan for one sibling of three is not a paused family plan.
    expect(familyPlanStep('mina', meeting, [plan({ targetLearnerIds: ['jun'] })], true, three)).toBeNull();
    // A learner who left the family since does not block the match.
    expect(familyPlanStep('mina', meeting, [plan({ targetLearnerIds: ['jun', 'sora', 'gone'] })], true, three)?.kind).toBe('resume');
    // Family of two: [jun] is also "Jun's own plan", so only the plans paused here resume.
    const junShape = plan({ targetLearnerIds: ['jun'] });
    expect(familyPlanStep('mina', meeting, [junShape], true, two)).toBeNull();
    expect(familyPlanStep('mina', meeting, [junShape], true, two, ['plan:fam'])).toEqual({ kind: 'resume', plans: [junShape] });
    // Family of one: the empty list is what Pause left.
    expect(familyPlanStep('mina', meeting, [plan({ targetLearnerIds: [] })], true, ['mina'])?.kind).toBe('resume');
  });

  it("Pause then Resume changes the family plan only and never sends a sibling's own plan to the child", () => {
    const family = plan();
    const junOwn = plan({ id: 'plan:jun', targetLearnerIds: ['jun'], publishedAt: '2026-10-02T00:00:00.000Z' });
    // Family of two: Pause takes the family plan only (Jun's own plan does not reach Mina).
    const pause = familyPlanStep('mina', meeting, [family, junOwn], true, two);
    expect(pause).toEqual({ kind: 'pause', plans: [family] });
    const pausedFamily = { ...family, targetLearnerIds: familyPlanSave(family, 'mina', two, 'pause').targetLearnerIds };
    expect(pausedFamily.targetLearnerIds).toEqual(['jun']);
    // Resume takes the plan paused here only: Jun's own plan keeps its targets.
    const resume = familyPlanStep('mina', meeting, [pausedFamily, junOwn], true, two, ['plan:fam']);
    expect(resume).toEqual({ kind: 'resume', plans: [pausedFamily] });
    expect(familyPlanSave(pausedFamily, 'mina', two, 'resume').targetLearnerIds).toBeNull();
    // With nothing paused here, a sibling-only plan never offers Resume.
    expect(familyPlanStep('mina', meeting, [junOwn], true, two)).toBeNull();
    // Family of three with Jun's own plan: the same, by shape alone.
    const pause3 = familyPlanStep('mina', meeting, [family, junOwn], true, three);
    expect(pause3).toEqual({ kind: 'pause', plans: [family] });
    const paused3 = { ...family, targetLearnerIds: familyPlanSave(family, 'mina', three, 'pause').targetLearnerIds };
    expect(familyPlanStep('mina', meeting, [paused3, junOwn], true, three)).toEqual({ kind: 'resume', plans: [paused3] });
  });

  it('saves the same plan with the child left out, and back in; the whole family back targets everyone again', () => {
    const everyone = plan();
    const pause = familyPlanSave(everyone, 'mina', two, 'pause');
    expect(pause).toEqual({ id: 'plan:fam', title: 'Our week', items: everyone.items, targetLearnerIds: ['jun'], publish: true });
    expect(pause).not.toHaveProperty('meta');
    expect(familyPlanSave(plan({ targetLearnerIds: ['jun'] }), 'mina', two, 'resume').targetLearnerIds).toBeNull();
    expect(familyPlanSave(plan(), 'mina', ['mina'], 'pause').targetLearnerIds).toEqual([]);
    expect(familyPlanSave(plan({ targetLearnerIds: [] }), 'mina', ['mina'], 'resume').targetLearnerIds).toBeNull();
  });

  it('remembers the plans paused here per child, plan ids only, and reads broken storage as none', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    expect(pausedPlanIds(storage, 'space:fam', 'mina')).toEqual([]);
    expect(rememberPausedPlans(storage, 'space:fam', 'mina', ['plan:fam'], 'pause')).toBe(true);
    expect(pausedPlanIds(storage, 'space:fam', 'mina')).toEqual(['plan:fam']);
    expect(pausedPlanIds(storage, 'space:fam', 'jun')).toEqual([]);
    rememberPausedPlans(storage, 'space:fam', 'mina', ['plan:fam'], 'resume');
    expect(pausedPlanIds(storage, 'space:fam', 'mina')).toEqual([]);
    store.set('hr.console.familyPlanPaused', '{not json');
    expect(pausedPlanIds(storage, 'space:fam', 'mina')).toEqual([]);
    expect(pausedPlanIds(null, 'space:fam', 'mina')).toEqual([]);
    expect(rememberPausedPlans(null, 'space:fam', 'mina', ['plan:fam'], 'pause')).toBe(false);
  });
});

describe('the report practice-week line (P2)', () => {
  // Saturday 7 November 2026, 12:00 UTC; the learner's week runs Monday 2 to Sunday 8 November.
  const now = new Date('2026-11-07T12:00:00.000Z');
  const summary = (practicedDays: number | undefined, asOf = '2026-11-06', tz = 0): ReportSummary =>
    ({ ...(practicedDays === undefined ? {} : { practiceWeek: { practicedDays } }), activity: { v: 1, tz, asOf, days: [] } }) as unknown as ReportSummary;
  const view = (s: ReportSummary | null, over: Partial<{ viewer: 'family' | 'class'; period: string; at: string | null }> = {}, locale: 'en' | 'es' | 'ko' = 'en') =>
    practiceWeekView({ summary: s, viewer: 'family', period: 'week', at: null, now, ...over }, locale);

  it('says the count and fills that many marks, in every locale', () => {
    expect(view(summary(3))).toEqual({ line: 'Practiced on 3 days this week', filled: 3 });
    expect(view(summary(1))?.line).toBe('Practiced on 1 day this week');
    expect(view(summary(3), {}, 'es')?.line).toBe('Practicó 3 días esta semana');
    expect(view(summary(3), {}, 'ko')?.line).toBe('이번 주 3일 연습했어요');
    for (const locale of ['en', 'es', 'ko'] as const) for (const n of [1, 4, 7]) expect(isCaregiverSafe(view(summary(n), {}, locale)?.line ?? '', locale)).toBe(true);
  });

  it('is never drawn at 0, without the field, for a class, off the week tab, on an earlier week, or from an earlier week', () => {
    expect(view(summary(0))).toBeNull();
    expect(view(summary(undefined))).toBeNull();
    expect(view(null)).toBeNull();
    expect(view(summary(3), { viewer: 'class' })).toBeNull();
    expect(view(summary(3), { period: 'month' })).toBeNull();
    expect(view(summary(3), { at: '2026-10-31' })).toBeNull();
    // Saved last Sunday: last week's count.
    expect(view(summary(3, '2026-11-01'))).toBeNull();
    expect(view(summary(3, '2026-11-02'))).not.toBeNull();
    // A learner 13 hours ahead is already on Sunday 8 November: still this week. 14 hours on Monday 9 is not reached.
    expect(view(summary(3, '2026-11-08', 13 * 60))).not.toBeNull();
    expect(view({ practiceWeek: { practicedDays: 3 } } as unknown as ReportSummary)).toBeNull();
  });
});
