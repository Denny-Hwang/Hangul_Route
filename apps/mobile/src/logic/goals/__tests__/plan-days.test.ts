import type { PracticeDaysEntry, Weekday } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import type { DeriveSource } from '../../homework/plan-derivation';
import { blendedMeta, curriculumMeta, selfRoute, type BlendFixture } from '../../homework/__tests__/curriculum-fixture';
import { planDaysInForce } from '../plan-days';

// 2026-09-21 is a Monday; `curriculumMeta` is 3 days a week for 4 weeks from it.
const TODAY = '2026-09-23';
const src = (over: Partial<DeriveSource>): DeriveSource => ({ id: 'plan:c', kind: 'class', assignedAt: '2026-09-20T00:00:00.000Z', items: [], meta: curriculumMeta(), ...over });
const blendSrc = (id: string, o: BlendFixture = {}, assignedAt = '2026-09-20T00:00:00.000Z'): DeriveSource => src({ id, assignedAt, meta: blendedMeta(o) });
const learner = (planId: string, days: Weekday[]): PracticeDaysEntry => ({ planId, days, updatedAt: '2026-09-22T00:00:00.000Z' });
const route = selfRoute();
const self: DeriveSource = { id: route.id, kind: 'self', assignedAt: route.createdAt, items: [], meta: route.meta };

describe('planDaysInForce (F-PLAN-002; the weekly goal)', () => {
  it('null without a plan in force', () => {
    expect(planDaysInForce([], TODAY)).toBeNull();
    expect(planDaysInForce([src({ meta: null })], TODAY)).toBeNull();
    expect(planDaysInForce([src({})], '2026-10-30')).toBeNull();
  });

  it('the plan first in rank sets the days: class, then family, then the own plan; the newest first in a rank', () => {
    const fam = src({ id: 'plan:f', kind: 'family', meta: { ...curriculumMeta(), params: { ...curriculumMeta().params, sessionsPerWeek: 5 } } });
    expect(planDaysInForce([self], TODAY)).toBe(3);
    expect(planDaysInForce([self, fam], TODAY)).toBe(5);
    const newer = src({ id: 'plan:new', assignedAt: '2026-09-21T00:00:00.000Z', meta: { ...curriculumMeta(), params: { ...curriculumMeta().params, sessionsPerWeek: 2 } } });
    expect(planDaysInForce([self, fam, src({}), newer], TODAY)).toBe(2);
  });

  it('a plan with a broken count is passed over', () => {
    const broken = src({ meta: { ...curriculumMeta(), params: { ...curriculumMeta().params, sessionsPerWeek: 0 } } });
    expect(planDaysInForce([broken, self], TODAY)).toBe(3);
  });
});

describe('class days and practice days (AMENDMENTS-ROUTE-CLASS-BLEND section 6.1, BL-6)', () => {
  it('counts the distinct days D: 4 for 1 class day and 3 practice days, 7 for 1 and 7', () => {
    expect(planDaysInForce([blendSrc('plan:b')], TODAY)).toBe(4);
    expect(planDaysInForce([blendSrc('plan:b', { perWeek: 7 })], TODAY)).toBe(7);
    expect(planDaysInForce([blendSrc('plan:b', { lectureDays: ['mon', 'thu'], perWeek: 3 })], TODAY)).toBe(5);
    expect(planDaysInForce([blendSrc('plan:b', { lectureDays: ['mon', 'thu'], perWeek: 6 })], TODAY)).toBe(7);
  });

  it('a practice day on a class day counts once', () => {
    expect(planDaysInForce([blendSrc('plan:b', { practiceDays: ['tue', 'thu', 'sat'] })], TODAY)).toBe(3);
    expect(planDaysInForce([blendSrc('plan:b', { practiceDays: ['wed', 'fri', 'sun'] })], TODAY)).toBe(4);
  });

  it('reads the generator union (sessionDays) when the plan does not list its practice days', () => {
    expect(planDaysInForce([blendSrc('plan:b', { sessionDays: ['tue', 'wed', 'fri', 'sun'] })], TODAY)).toBe(4);
  });

  it("counts the learner's own practice days when they moved them, for that plan only", () => {
    const plan = blendSrc('plan:b');
    expect(planDaysInForce([plan], TODAY, [learner('plan:b', ['mon', 'wed'])])).toBe(3);
    expect(planDaysInForce([plan], TODAY, [learner('plan:b', ['tue'])])).toBe(1);
    // An entry for another plan (an old class's) changes nothing.
    expect(planDaysInForce([plan], TODAY, [learner('plan:old', ['mon'])])).toBe(4);
  });

  it('two blended class plans count the union of their days, at most 7', () => {
    const tue = blendSrc('plan:tue', { practiceDays: ['wed', 'fri', 'sun'] });
    const thu = blendSrc('plan:thu', { lectureDays: ['thu'], practiceDays: ['fri', 'sat', 'sun'] }, '2026-09-21T00:00:00.000Z');
    expect(planDaysInForce([tue, thu], '2026-09-25')).toBe(6);
    const full = blendSrc('plan:full', { lectureDays: ['mon'], practiceDays: ['tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }, '2026-09-21T00:00:00.000Z');
    expect(planDaysInForce([tue, full], '2026-09-25')).toBe(7);
    // A plan with default days (weekdays not listed) adds its class days and its practice days as days of their own.
    const unknown = blendSrc('plan:u', { lectureDays: ['mon', 'thu'], perWeek: 4 }, '2026-09-21T00:00:00.000Z');
    expect(planDaysInForce([blendSrc('plan:small', { practiceDays: ['wed'] }), unknown], '2026-09-25')).toBe(7);
  });

  it('two plans without listed weekdays count their days together, not the larger alone', () => {
    const tue = blendSrc('plan:tue', { perWeek: 1 });
    const thu = blendSrc('plan:thu', { lectureDays: ['thu'], perWeek: 1 }, '2026-09-21T00:00:00.000Z');
    expect(planDaysInForce([tue], '2026-09-25')).toBe(2);
    expect(planDaysInForce([tue, thu], '2026-09-25')).toBe(4);
  });

  it('a blended class plan leads before a newer class plan without practice days (section 12.2)', () => {
    const newerClass = src({ id: 'plan:newer', assignedAt: '2026-09-22T00:00:00.000Z', meta: { ...curriculumMeta(), params: { ...curriculumMeta().params, sessionsPerWeek: 2 } } });
    expect(planDaysInForce([blendSrc('plan:b'), newerClass], TODAY)).toBe(4);
    expect(planDaysInForce([newerClass, blendSrc('plan:b')], TODAY)).toBe(4);
    // Once the blended plan ended, the other class plan sets the days.
    expect(planDaysInForce([blendSrc('plan:b', { weeks: 1 }), newerClass], '2026-10-05')).toBe(2);
  });

  it('a blended plan outranks a family plan and the own plan; an ended one leaves the days to them', () => {
    const fam = src({ id: 'plan:f', kind: 'family' });
    expect(planDaysInForce([self, fam, blendSrc('plan:b')], TODAY)).toBe(4);
    expect(planDaysInForce([self, blendSrc('plan:b', { weeks: 1 })], '2026-10-05')).toBe(3);
  });

  it('a blended plan counts through its last class cycle, past its last week', () => {
    // Weeks end on 2026-10-18; the last Tuesday cycle ends on 2026-10-19.
    expect(planDaysInForce([blendSrc('plan:b')], '2026-10-19')).toBe(4);
  });
});
