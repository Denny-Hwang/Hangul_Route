import { describe, expect, it } from 'vitest';
import {
  AUDIENCE_DEFAULTS,
  COMING_SOON_MAX,
  COMING_SOON_NOTE,
  CULTURE_EVERY,
  CURRICULUM_MAX_ITEMS,
  CurriculumParamsSchema,
  DEFAULT_REVIEW_EVERY,
  DEFAULT_REVIEW_MIN_WEEKS,
  DEFAULT_SHORT_MAX,
  DEFAULT_TERM_MAX,
  DateKeySchema,
  HORIZON_DAYS,
  LENGTH_PRESETS,
  PACES,
  PICTURES_FIRST_MINUTES,
  SESSION_TOO_SHORT_FACTOR,
  STORIES_PER_CULTURE_WEEK_MAX,
  VOCAB_EVERY,
  WeekdaySchema,
  sessionsPerWeekOf,
  type CurriculumParamsInput,
} from '..';

const base: CurriculumParamsInput = {
  audience: 'self',
  level: { stage: 'stage1', band: 0 },
  startDate: '2026-10-12',
  weeks: 4,
  sessionsPerWeek: 3,
  minutesPerSession: 15,
  unlockedStages: ['stage1'],
};

const issues = (patch: Partial<Record<keyof CurriculumParamsInput, unknown>>): string[] => {
  const result = CurriculumParamsSchema.safeParse({ ...base, ...patch });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('CurriculumParamsSchema (F-PLAN-002 section 3.1)', () => {
  it('fills the defaults', () => {
    const params = CurriculumParamsSchema.parse(base);
    expect(params.completedQuestIds).toEqual([]);
    expect(params.daysOff).toEqual([]);
    expect(params.goals).toEqual({ focus: 'balanced' });
    expect(params.includeComingSoon).toBe(true);
    expect(params.culturalAnchors).toBe(true);
    expect(params.reviewEvery).toBeUndefined();
    expect(params.endStage).toBeUndefined();
    expect(CurriculumParamsSchema.parse({ ...base, goals: {} }).goals.focus).toBe('balanced');
  });

  it('accepts the bounds of weeks (1 and 52) and sessions (1 and 7)', () => {
    expect(issues({ weeks: 1 })).toEqual([]);
    expect(issues({ weeks: 52, sessionsPerWeek: 5 })).toEqual([]);
    expect(issues({ sessionsPerWeek: 1 })).toEqual([]);
    expect(issues({ sessionsPerWeek: 7 })).toEqual([]);
    expect(issues({ weeks: 0 })).not.toEqual([]);
    expect(issues({ weeks: 53 })).not.toEqual([]);
    expect(issues({ sessionsPerWeek: 0 })).not.toEqual([]);
    expect(issues({ sessionsPerWeek: 8 })).not.toEqual([]);
    expect(issues({ weeks: 2.5 })).not.toEqual([]);
  });

  it('only takes the five session lengths', () => {
    for (const minutes of [5, 10, 15, 20, 30]) expect(issues({ minutesPerSession: minutes })).toEqual([]);
    expect(issues({ minutesPerSession: 12 })).not.toEqual([]);
  });

  it('only takes the four review cadences', () => {
    for (const every of [0, 3, 4, 6]) expect(issues({ reviewEvery: every })).toEqual([]);
    expect(issues({ reviewEvery: 2 })).not.toEqual([]);
  });

  it('caps a plan at 260 sessions, with sessionDays winning over sessionsPerWeek', () => {
    expect(issues({ weeks: 52, sessionsPerWeek: 5 })).toEqual([]);
    expect(issues({ weeks: 52, sessionsPerWeek: 6 })).toEqual(['That is more than a plan can hold (260 sessions)']);
    expect(issues({ weeks: 52, sessionsPerWeek: 1, sessionDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] })).toEqual([
      'That is more than a plan can hold (260 sessions)',
    ]);
    expect(issues({ weeks: 52, sessionsPerWeek: 7, sessionDays: ['mon', 'wed'] })).toEqual([]);
  });

  it('says sessionDays wins over sessionsPerWeek', () => {
    expect(sessionsPerWeekOf(CurriculumParamsSchema.parse(base))).toBe(3);
    expect(sessionsPerWeekOf(CurriculumParamsSchema.parse({ ...base, sessionDays: ['sun', 'wed'] }))).toBe(2);
  });

  it('rejects repeated session days and keeps 1 to 7 of them', () => {
    expect(issues({ sessionDays: ['mon', 'mon'] })).toEqual(['Session day mon is listed twice']);
    expect(issues({ sessionDays: [] })).not.toEqual([]);
    expect(issues({ sessionDays: ['mon', 'xyz'] })).not.toEqual([]);
  });

  it('validates the start date and the days off', () => {
    expect(issues({ startDate: '2026-02-30' })).toEqual(['Start date 2026-02-30 is not a real day']);
    expect(issues({ startDate: '12-10-2026' })).not.toEqual([]);
    expect(issues({ daysOff: [{ from: '2026-11-22', to: '2026-11-28' }] })).toEqual([]);
    expect(issues({ daysOff: [{ from: '2026-11-22', to: '2026-11-22' }] })).toEqual([]);
    expect(issues({ daysOff: [{ from: '2026-11-28', to: '2026-11-22' }] })).toEqual([
      'Days off 2026-11-28 to 2026-11-22 end before they start',
    ]);
    const thirteen = Array.from({ length: 13 }, () => ({ from: '2026-11-22', to: '2026-11-22' }));
    expect(issues({ daysOff: thirteen })).not.toEqual([]);
  });

  it('bounds the goals, the quest lists and the stages', () => {
    expect(issues({ goals: { focus: 'words', themes: ['life', 'rites'], motivation: 'kculture' } })).toEqual([]);
    expect(issues({ goals: { focus: 'speaking' } })).not.toEqual([]);
    expect(issues({ goals: { focus: 'balanced', themes: ['life', 'rites', 'nature', 'crafts', 'letters', 'life'] } })).not.toEqual([]);
    expect(issues({ placedOutQuestIds: Array.from({ length: 41 }, (_, i) => `q${i}`) })).not.toEqual([]);
    expect(issues({ completedQuestIds: Array.from({ length: 401 }, (_, i) => `q${i}`) })).not.toEqual([]);
    expect(issues({ unlockedStages: [] })).not.toEqual([]);
    expect(issues({ endStage: 'stage3' })).toEqual([]);
    expect(issues({ audience: 'school' })).not.toEqual([]);
  });

  it('exports the date key and weekday schemas', () => {
    expect(DateKeySchema.safeParse('2026-10-18').success).toBe(true);
    expect(DateKeySchema.safeParse('2026-10-18T00:00').success).toBe(false);
    expect(WeekdaySchema.options).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
  });
});

describe('curriculum presets and defaults (F-PLAN-002 section 3.1, FP-B2)', () => {
  it('has three length presets; only the short one has no review weeks', () => {
    expect(LENGTH_PRESETS).toEqual({
      '4-week': { weeks: 4, reviewEvery: 0 },
      '12-week': { weeks: 12, reviewEvery: 4 },
      '6-month': { weeks: 26, reviewEvery: 4 },
    });
  });

  it('has three pace presets in sessions a week', () => {
    expect(PACES).toEqual({ gentle: 2, steady: 3, brisk: 4 });
  });

  it('recommends lengths by the last lesson week (used by proposeRoute)', () => {
    expect(DEFAULT_SHORT_MAX).toBe(4);
    expect(DEFAULT_TERM_MAX).toBe(16);
  });

  it('has the audience rhythm defaults (self is steady 3)', () => {
    expect(AUDIENCE_DEFAULTS).toEqual({
      class: { sessionsPerWeek: 2, minutesPerSession: 15 },
      family: { sessionsPerWeek: 3, minutesPerSession: 15 },
      self: { sessionsPerWeek: PACES.steady, minutesPerSession: 15 },
    });
    expect(PICTURES_FIRST_MINUTES).toBe(10);
  });

  it('has the culture-week cadence by focus', () => {
    expect(CULTURE_EVERY).toEqual({ reading: 0, words: 0, culture: 2, balanced: 3 });
  });

  it('has the word-topic cadence by focus', () => {
    expect(VOCAB_EVERY).toEqual({ reading: 0, words: 3, culture: 0, balanced: 4 });
  });

  it('has review every 4th week from 12 weeks on', () => {
    expect(DEFAULT_REVIEW_EVERY).toBe(4);
    expect(DEFAULT_REVIEW_MIN_WEEKS).toBe(12);
  });

  it('caps coming-soon items at five', () => {
    expect(COMING_SOON_MAX).toBe(5);
  });

  it('gives a culture week at most two stories', () => {
    expect(STORIES_PER_CULTURE_WEEK_MAX).toBe(2);
  });

  it('flags items longer than one and a half sessions', () => {
    expect(SESSION_TOO_SHORT_FACTOR).toBe(1.5);
  });

  it('caps a curriculum at 260 items and derives a week ahead', () => {
    expect(CURRICULUM_MAX_ITEMS).toBe(260);
    expect(HORIZON_DAYS).toBe(7);
  });

  it('notes a coming-soon item the way older apps show it', () => {
    expect(COMING_SOON_NOTE).toBe('Coming soon');
  });
});
