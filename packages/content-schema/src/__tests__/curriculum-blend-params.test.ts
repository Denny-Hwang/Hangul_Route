import { describe, expect, it } from 'vitest';
import {
  BlendSchema,
  CurriculumItemSchema,
  CurriculumMetaSchema,
  CurriculumParamsSchema,
  HomeworkAssignmentSchema,
  PARAMS_ISSUE_CODES,
  PlanItemSchema,
  StoredCurriculumParamsSchema,
  WARNING_CODES,
  type BlendInput,
  type CurriculumParamsInput,
} from '..';

/** AMENDMENTS-ROUTE-CLASS-BLEND section 9.1-9.2 (row BL-W): the data shape of class days with practice days. */

const blend: BlendInput = {
  mode: 'overlap',
  lecture: { days: ['tue'], minutes: 30 },
  personal: { perWeek: 3, minutes: 10 },
};

const base: CurriculumParamsInput = {
  audience: 'class',
  level: { stage: 'stage1', band: 0 },
  startDate: '2026-10-12',
  weeks: 26,
  sessionsPerWeek: 4,
  minutesPerSession: 10,
  unlockedStages: ['stage1'],
  blend,
};

type Patch = Partial<Record<keyof CurriculumParamsInput, unknown>>;
const withBlend = (patch: Record<string, unknown>, rest: Patch = {}): Patch => ({ ...rest, blend: { ...blend, ...patch } });

/** Every issue as `path: code` (custom issues carry their stable code in `params.code`). */
const coded = (patch: Patch): string[] => {
  const result = CurriculumParamsSchema.safeParse({ ...base, ...patch });
  if (result.success) return [];
  return result.error.issues.map((issue) => {
    const code = issue.code === 'custom' ? String((issue.params as { code?: string } | undefined)?.code) : issue.code;
    return `${issue.path.join('.')}: ${code}`;
  });
};

describe('BlendSchema (section 9.1)', () => {
  it('parses the owner example (class on Tuesday 30 min, practice 3 times a week 10 min) and fills the defaults', () => {
    const params = CurriculumParamsSchema.parse(base);
    expect(params.blend).toEqual({ ...blend, classDaysOff: [], keepAverage: false });
    expect(coded({})).toEqual([]);
  });

  it('leaves blend absent on a plan without it (solo and class-only plans are unchanged)', () => {
    const { blend: _omit, ...plain } = base;
    expect(CurriculumParamsSchema.parse(plain).blend).toBeUndefined();
    expect(CurriculumParamsSchema.parse({ ...plain, audience: 'self' }).blend).toBeUndefined();
  });

  it('takes 1 to 7 practice sessions a week, whole numbers only (BL-OD-19)', () => {
    for (const perWeek of [1, 2, 3, 4, 5, 6, 7]) expect(coded(withBlend({ personal: { perWeek, minutes: 10 } }))).toEqual([]);
    for (const perWeek of [0, 8, 2.5]) expect(coded(withBlend({ personal: { perWeek, minutes: 10 } }))).not.toEqual([]);
  });

  it('parses 1 class day with 7 practice days (practice on the class day too, after class)', () => {
    const days = ['wed', 'thu', 'fri', 'sat', 'sun', 'mon', 'tue'];
    expect(coded(withBlend({ personal: { perWeek: 7, days, minutes: 10 } }, { sessionsPerWeek: 7 }))).toEqual([]);
    expect(CurriculumParamsSchema.parse({ ...base, ...withBlend({ personal: { perWeek: 7, days, minutes: 10 } }) }).blend?.personal.days).toEqual(days);
  });

  it('takes 1 to 5 class days', () => {
    expect(coded(withBlend({ lecture: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], minutes: 30 } }, { weeks: 20 }))).toEqual([]);
    expect(coded(withBlend({ lecture: { days: [], minutes: 30 } }))).not.toEqual([]);
    expect(coded(withBlend({ lecture: { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], minutes: 30 } }))).not.toEqual([]);
    expect(coded(withBlend({ lecture: { days: ['xyz'], minutes: 30 } }))).not.toEqual([]);
  });

  it('only takes the five class lengths (BL-OD-13) and the five practice lengths', () => {
    for (const minutes of [15, 20, 30, 45, 60]) expect(coded(withBlend({ lecture: { days: ['tue'], minutes } }))).toEqual([]);
    for (const minutes of [5, 10, 25, 90]) expect(coded(withBlend({ lecture: { days: ['tue'], minutes } }))).not.toEqual([]);
    for (const minutes of [5, 10, 15, 20, 30]) expect(coded(withBlend({ personal: { perWeek: 3, minutes } }))).toEqual([]);
    for (const minutes of [45, 60, 12]) expect(coded(withBlend({ personal: { perWeek: 3, minutes } }))).not.toEqual([]);
  });

  it('takes both modes only', () => {
    expect(coded(withBlend({ mode: 'split' }))).toEqual([]);
    expect(coded(withBlend({ mode: 'mixed' }))).not.toEqual([]);
  });

  it('holds at most 52 class days off, defaulting to none', () => {
    const tuesdays = Array.from({ length: 53 }, (_, i) => new Date(Date.UTC(2026, 9, 13) + i * 7 * 86_400_000).toISOString().slice(0, 10));
    expect(coded(withBlend({ classDaysOff: tuesdays.slice(0, 52) }))).toEqual([]);
    expect(coded(withBlend({ classDaysOff: tuesdays }))).toEqual(['blend.classDaysOff: too_big']);
    expect(BlendSchema.parse(blend).classDaysOff).toEqual([]);
    expect(BlendSchema.parse({ ...blend, keepAverage: true }).keepAverage).toBe(true);
  });
});

describe('blend refinements (section 9.1)', () => {
  it('belongs to a class plan only (blend-not-class)', () => {
    expect(coded({ audience: 'family' })).toEqual(['blend: blend-not-class']);
    expect(coded({ audience: 'self' })).toEqual(['blend: blend-not-class']);
  });

  it('wants personal.days without a repeat and exactly perWeek long; a class day may be a practice day', () => {
    expect(coded(withBlend({ personal: { perWeek: 3, days: ['wed', 'fri', 'sun'], minutes: 10 } }))).toEqual([]);
    expect(coded(withBlend({ personal: { perWeek: 3, days: ['tue', 'fri', 'sun'], minutes: 10 } }))).toEqual([]);
    expect(coded(withBlend({ personal: { perWeek: 3, days: ['wed', 'wed', 'sun'], minutes: 10 } }))).toEqual(['blend.personal.days.1: practice-day-repeated']);
    expect(coded(withBlend({ personal: { perWeek: 3, days: ['wed', 'fri'], minutes: 10 } }))).toEqual(['blend.personal.days: practice-days-count']);
    expect(coded(withBlend({ personal: { perWeek: 1, days: ['wed', 'fri'], minutes: 10 } }))).toEqual(['blend.personal.days: practice-days-count']);
  });

  it('refuses a repeated class day', () => {
    expect(coded(withBlend({ lecture: { days: ['tue', 'tue'], minutes: 30 } }))).toEqual(['blend.lecture.days.1: class-day-repeated']);
  });

  it('wants every class day off to be a real day on a class weekday', () => {
    // 2026-10-13 is a Tuesday, 2026-10-14 a Wednesday.
    expect(coded(withBlend({ classDaysOff: ['2026-10-13'] }))).toEqual([]);
    expect(coded(withBlend({ classDaysOff: ['2026-10-13', '2026-10-14'] }))).toEqual(['blend.classDaysOff.1: class-day-off-not-class-day']);
    expect(coded(withBlend({ classDaysOff: ['2026-02-30'] }))).toEqual(['blend.classDaysOff.0: not-a-real-day']);
    expect(coded(withBlend({ classDaysOff: ['13-10-2026'] }))).not.toEqual([]);
  });

  it('keeps weeks x (L + P) <= 260 (section 6.6), whatever sessionsPerWeek says', () => {
    // 52 weeks x (1 + 4) = 260.
    expect(coded(withBlend({ personal: { perWeek: 4, minutes: 10 } }, { weeks: 52, sessionsPerWeek: 5 }))).toEqual([]);
    // 52 x (1 + 5) = 312, although the distinct days (sessionsPerWeek) are 5 when a class day holds practice.
    expect(coded(withBlend({ personal: { perWeek: 5, minutes: 10 } }, { weeks: 52, sessionsPerWeek: 5 }))).toEqual(['weeks: too-many-sessions']);
    // 1 + 7 for 32 weeks = 256; 33 weeks = 264.
    expect(coded(withBlend({ personal: { perWeek: 7, minutes: 10 } }, { weeks: 32, sessionsPerWeek: 7 }))).toEqual([]);
    expect(coded(withBlend({ personal: { perWeek: 7, minutes: 10 } }, { weeks: 33, sessionsPerWeek: 7 }))).toEqual(['weeks: too-many-sessions']);
  });

  it('applies the same rules to the stored params (plans.meta_json)', () => {
    const { completedQuestIds: _omit, ...stored } = CurriculumParamsSchema.parse(base);
    expect(StoredCurriculumParamsSchema.safeParse(stored).success).toBe(true);
    expect(StoredCurriculumParamsSchema.safeParse({ ...stored, audience: 'family' }).success).toBe(false);
  });

  it('lists the new issue codes after the existing ones (additive)', () => {
    expect(PARAMS_ISSUE_CODES.slice(0, 4)).toEqual(['session-day-repeated', 'too-many-sessions', 'days-off-reversed', 'not-a-real-day']);
    expect(PARAMS_ISSUE_CODES.slice(4)).toEqual(['blend-not-class', 'class-day-repeated', 'practice-day-repeated', 'practice-days-count', 'class-day-off-not-class-day']);
  });
});

describe('plan items, meta and homework (section 9.2)', () => {
  const item = { kind: 'quest' as const, id: 'quest:stage1-letters-q1', targetDate: '2026-10-14', week: 1 };

  it('takes a lectureDate before the targetDate', () => {
    expect(PlanItemSchema.parse({ ...item, lectureDate: '2026-10-13' }).lectureDate).toBe('2026-10-13');
    expect(PlanItemSchema.parse(item).lectureDate).toBeUndefined();
  });

  it('refuses a lectureDate without a targetDate, on the same day or after it', () => {
    const { targetDate: _omit, ...undated } = item;
    expect(PlanItemSchema.safeParse({ ...undated, lectureDate: '2026-10-13' }).success).toBe(false);
    expect(PlanItemSchema.safeParse({ ...item, lectureDate: '2026-10-14' }).success).toBe(false);
    expect(PlanItemSchema.safeParse({ ...item, lectureDate: '2026-10-15' }).success).toBe(false);
    expect(PlanItemSchema.safeParse({ ...item, lectureDate: '13-10-2026' }).success).toBe(false);
  });

  it('applies the same rule to a draft item', () => {
    expect(CurriculumItemSchema.safeParse({ ...item, lectureDate: '2026-10-13' }).success).toBe(true);
    expect(CurriculumItemSchema.safeParse({ ...item, lectureDate: '2026-10-14' }).success).toBe(false);
  });

  it('gives the meta an optional refresh list: 1 to 6 cells a date, at most 364 dates', () => {
    const { completedQuestIds: _omit, ...params } = CurriculumParamsSchema.parse(base);
    const meta = { kind: 'curriculum', generatorVersion: 2, catalogVersion: 1, params, weeks: [], repacedAt: null };
    expect(CurriculumMetaSchema.parse(meta).refresh).toBeUndefined();
    const refresh = [{ date: '2026-10-16', cellIds: ['cell:stage1-a'] }];
    expect(CurriculumMetaSchema.parse({ ...meta, refresh }).refresh).toEqual(refresh);
    expect(CurriculumMetaSchema.safeParse({ ...meta, refresh: [{ date: '2026-10-16', cellIds: [] }] }).success).toBe(false);
    expect(CurriculumMetaSchema.safeParse({ ...meta, refresh: [{ date: '2026-10-16', cellIds: Array.from({ length: 7 }, (_, i) => `c${i}`) }] }).success).toBe(false);
    const many = (n: number) => Array.from({ length: n }, () => ({ date: '2026-10-16', cellIds: ['c'] }));
    expect(CurriculumMetaSchema.safeParse({ ...meta, refresh: many(364) }).success).toBe(true);
    expect(CurriculumMetaSchema.safeParse({ ...meta, refresh: many(365) }).success).toBe(false);
  });

  it('gives a homework assignment an optional fromClass flag', () => {
    const hw = { id: 'plan:a#q', profileId: 'profile:a', questId: 'q', episodeId: 'e', assignedBy: 'teacher', assignedAt: '2026-10-13T00:00:00.000Z', targetDate: '2026-10-14' };
    expect(HomeworkAssignmentSchema.parse(hw).fromClass).toBeUndefined();
    expect(HomeworkAssignmentSchema.parse({ ...hw, fromClass: true }).fromClass).toBe(true);
    expect(HomeworkAssignmentSchema.safeParse({ ...hw, fromClass: 'yes' }).success).toBe(false);
  });

  it('adds three warning codes after the existing ones (additive, section 6.6)', () => {
    expect(WARNING_CODES.slice(-3)).toEqual(['item-cap', 'practice-short', 'class-paced']);
    expect(WARNING_CODES.slice(0, 6)).toEqual(['content-runs-out', 'coming-soon-included', 'premium-needed', 'fewer-sessions-than-units', 'session-too-short', 'already-done-skipped']);
  });
});
