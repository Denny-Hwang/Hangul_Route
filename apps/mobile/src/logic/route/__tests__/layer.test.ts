import { describe, expect, it } from 'vitest';
import type { DeriveSource } from '../../homework/plan-derivation';
import { blendedMeta, curriculumMeta, selfRoute } from '../../homework/__tests__/curriculum-fixture';
import {
  blendInForce,
  blendSpanOf,
  curriculumInForce,
  isClassKind,
  layerOf,
  leadingBlended,
  OWN_PLAN_BACK_FRESH_MS,
  ownPlanBackShows,
  ownPlanProposalOffered,
  ownPlanRestStep,
  ownPlanStartAfterClass,
} from '../layer';

// 2026-09-21 is a Monday. A Tuesday class from 2026-09-21 for 4 weeks: first class 09-22, route to 10-19.
const source = (over: Partial<DeriveSource> = {}): DeriveSource => ({ id: 'plan:c', kind: 'class', assignedAt: '2026-09-20T00:00:00.000Z', items: [], meta: blendedMeta(), ...over });

describe('blendSpanOf (AMENDMENTS-ROUTE-CLASS-BLEND section 6.3)', () => {
  it('runs from the first class day on or after the start to the end of the last class cycle', () => {
    expect(blendSpanOf(blendedMeta())).toEqual({ from: '2026-09-22', to: '2026-10-19' });
    // A Wednesday start with a Thursday class starts on Thursday (golden E).
    expect(blendSpanOf(blendedMeta({ startDate: '2026-09-23', lectureDays: ['thu'], weeks: 2 }))).toEqual({ from: '2026-09-24', to: '2026-10-07' });
    // A start on a class day starts that day.
    expect(blendSpanOf(blendedMeta({ startDate: '2026-09-22', weeks: 1 }))).toMatchObject({ from: '2026-09-22' });
  });

  it('reaches the end of the last week when the weeks run longer (a route kept at its average)', () => {
    const meta = blendedMeta({ weeks: 2 });
    const longer = { ...meta, weeks: [...meta.weeks, { ...(meta.weeks[0] as (typeof meta.weeks)[number]), index: 3, startDate: '2026-10-12' }] };
    expect(blendSpanOf(longer)).toEqual({ from: '2026-09-22', to: '2026-10-18' });
    // A meta with no weeks listed keeps the class cycles.
    expect(blendSpanOf({ ...meta, weeks: [] })).toEqual({ from: '2026-09-22', to: '2026-10-05' });
  });

  it('is null for a plan without class days', () => {
    expect(blendSpanOf(curriculumMeta())).toBeNull();
    const meta = blendedMeta();
    const blend = meta.params.blend as NonNullable<typeof meta.params.blend>;
    expect(blendSpanOf({ ...meta, params: { ...meta.params, blend: { ...blend, lecture: { ...blend.lecture, days: [] } } } })).toBeNull();
  });
});

describe('curriculumInForce and blendInForce', () => {
  it('a curriculum is in force inside its weeks; a blended one also through its last class cycle', () => {
    expect(curriculumInForce(curriculumMeta(), '2026-09-21')).toBe(true);
    expect(curriculumInForce(curriculumMeta(), '2026-10-18')).toBe(true);
    expect(curriculumInForce(curriculumMeta(), '2026-10-19')).toBe(false);
    expect(curriculumInForce(curriculumMeta(), '2026-09-20')).toBe(false);
    expect(curriculumInForce(blendedMeta(), '2026-10-19')).toBe(true);
    expect(curriculumInForce(blendedMeta(), '2026-10-20')).toBe(false);
    expect(curriculumInForce(null, '2026-09-21')).toBe(false);
    expect(curriculumInForce(undefined, '2026-09-21')).toBe(false);
  });

  it('only a class plan with practice days whose route holds today is blended in force', () => {
    expect(blendInForce(source(), '2026-09-22')).toBe(true);
    expect(blendInForce(source(), '2026-10-19')).toBe(true);
    // Before the first class day the route has not started.
    expect(blendInForce(source(), '2026-09-21')).toBe(false);
    expect(blendInForce(source(), '2026-10-20')).toBe(false);
    expect(blendInForce(source({ kind: 'family' }), '2026-09-23')).toBe(false);
    expect(blendInForce(source({ meta: curriculumMeta() }), '2026-09-23')).toBe(false);
    expect(blendInForce(source({ meta: null }), '2026-09-23')).toBe(false);
    expect(blendInForce(source({ meta: undefined }), '2026-09-23')).toBe(false);
  });

  it('class and school spaces are the plans others step aside for', () => {
    expect(['class', 'school', 'family', 'self'].map((k) => isClassKind(k as DeriveSource['kind']))).toEqual([true, true, false, false]);
  });
});

describe('layerOf (section 3.2)', () => {
  const route = selfRoute();
  const self: DeriveSource = { id: route.id, kind: 'self', assignedAt: route.createdAt, items: [], meta: route.meta };

  it('solo with no class or school curriculum in force', () => {
    expect(layerOf([], '2026-09-23')).toBe('solo');
    expect(layerOf([self], '2026-09-23')).toBe('solo');
    expect(layerOf([source({ kind: 'family', meta: curriculumMeta() })], '2026-09-23')).toBe('solo');
    // A classic class plan (no curriculum) is not a curriculum in force.
    expect(layerOf([source({ meta: null })], '2026-09-23')).toBe('solo');
    // An ended class curriculum.
    expect(layerOf([source({ meta: curriculumMeta() })], '2026-10-30')).toBe('solo');
  });

  it('class-only with a class or school curriculum without practice days', () => {
    expect(layerOf([source({ meta: curriculumMeta() }), self], '2026-09-23')).toBe('class-only');
    expect(layerOf([source({ kind: 'school', meta: curriculumMeta() })], '2026-09-23')).toBe('class-only');
    // A blended plan on its start day before the first class: its weeks are in force, its route is not yet.
    expect(layerOf([source()], '2026-09-21')).toBe('class-only');
  });

  it('class-with-practice while a blended class plan route holds today', () => {
    expect(layerOf([source(), self], '2026-09-23')).toBe('class-with-practice');
    expect(layerOf([source({ meta: curriculumMeta(), id: 'plan:other' }), source()], '2026-10-19')).toBe('class-with-practice');
    expect(layerOf([source()], '2026-10-20')).toBe('solo');
  });

  it('the proposal for a new own plan is offered in every layer but class-with-practice', () => {
    expect(ownPlanProposalOffered('solo')).toBe(true);
    expect(ownPlanProposalOffered('class-only')).toBe(true);
    expect(ownPlanProposalOffered('class-with-practice')).toBe(false);
  });
});

describe('leadingBlended (section 12.2)', () => {
  const older = source({ id: 'plan:old', assignedAt: '2026-09-01T00:00:00.000Z' });
  const newer = source({ id: 'plan:new', assignedAt: '2026-09-10T00:00:00.000Z', meta: blendedMeta({ weeks: 6 }) });

  it('the newest blended class plan in force leads', () => {
    expect(leadingBlended([older, newer], '2026-09-23')?.id).toBe('plan:new');
    expect(leadingBlended([newer, older], '2026-09-23')?.id).toBe('plan:new');
    // The newer one alone is left after the older one's route ends.
    expect(leadingBlended([older, newer], '2026-10-25')?.id).toBe('plan:new');
    expect(leadingBlended([source({ meta: curriculumMeta() })], '2026-09-23')).toBeNull();
  });
});

describe('ownPlanRestStep and ownPlanBackShows (section 8, BL-OD-5)', () => {
  const route = selfRoute();

  it('rests while resting, resumes the plan it saw resting once it is back, else nothing', () => {
    expect(ownPlanRestStep({ route, resting: true, restingFor: undefined })).toBe('rest');
    expect(ownPlanRestStep({ route, resting: true, restingFor: route.id })).toBe('rest');
    expect(ownPlanRestStep({ route, resting: false, restingFor: route.id })).toBe('resume');
    expect(ownPlanRestStep({ route, resting: false, restingFor: undefined })).toBe('none');
    // Another plan was resting (this one replaced it): nothing to resume.
    expect(ownPlanRestStep({ route, resting: false, restingFor: 'route:older' })).toBe('none');
    expect(ownPlanRestStep({ route: null, resting: false, restingFor: route.id })).toBe('none');
    expect(ownPlanRestStep({ route: { ...route, archivedAt: '2026-10-01T00:00:00.000Z' }, resting: false, restingFor: route.id })).toBe('none');
  });

  it('the back line shows once after a resume until it is seen', () => {
    expect(ownPlanBackShows({})).toBe(false);
    expect(ownPlanBackShows({ backAt: '2026-10-20T08:00:00.000Z' })).toBe(true);
    expect(ownPlanBackShows({ backAt: '2026-10-20T08:00:00.000Z', backSeenAt: '2026-10-20T09:00:00.000Z' })).toBe(false);
    expect(ownPlanBackShows({ backAt: '2026-12-01T08:00:00.000Z', backSeenAt: '2026-10-20T09:00:00.000Z' })).toBe(true);
  });

  it('with a clock, the back line shows only while the resume is at most 7 days old', () => {
    const at = '2026-10-20T08:00:00.000Z';
    const ms = Date.parse(at);
    expect(ownPlanBackShows({ backAt: at }, ms)).toBe(true);
    expect(ownPlanBackShows({ backAt: at }, ms + OWN_PLAN_BACK_FRESH_MS)).toBe(true);
    // A resume written long ago (for example while the switch was off) is not news any more.
    expect(ownPlanBackShows({ backAt: at }, ms + OWN_PLAN_BACK_FRESH_MS + 1)).toBe(false);
    expect(ownPlanBackShows({ backAt: at, backSeenAt: '2026-10-20T09:00:00.000Z' }, ms)).toBe(false);
    expect(ownPlanBackShows({ backAt: 'not a time' }, ms)).toBe(false);
  });
});

describe('ownPlanStartAfterClass (section 8: a plan made while the class has practice days starts after it)', () => {
  it('is the day after the latest route end of the class plans with practice days in force', () => {
    expect(ownPlanStartAfterClass([source()], '2026-09-23')).toBe('2026-10-20');
    const longer = source({ id: 'plan:d', meta: blendedMeta({ weeks: 6 }) });
    expect(ownPlanStartAfterClass([source(), longer], '2026-09-23')).toBe('2026-11-03');
  });

  it('is undefined in the other layers', () => {
    expect(ownPlanStartAfterClass([], '2026-09-23')).toBeUndefined();
    expect(ownPlanStartAfterClass([source({ meta: curriculumMeta() })], '2026-09-23')).toBeUndefined();
    expect(ownPlanStartAfterClass([source({ kind: 'family' })], '2026-09-23')).toBeUndefined();
    expect(ownPlanStartAfterClass([source()], '2026-10-20')).toBeUndefined();
  });
});
