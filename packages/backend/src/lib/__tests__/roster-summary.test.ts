import { TEACHER_VISIBLE_SUMMARY_KEYS, type ProgressSummary } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { rosterSummary, teacherVisibleSummary } from '../roster-summary';

const placement = {
  takenAt: '2026-10-10T10:05:00.000Z',
  level: { stage: 'stage1', band: 2 },
  oralStage: null,
  strands: { 'hangul-recognition': 'secure', 'sound-letter': 'secure', 'syllable-reading': 'getting-there', vocabulary: 'not-tested', sentences: 'not-tested' },
  beyondContent: false,
  overridden: false,
} as unknown as NonNullable<ProgressSummary['placement']>;

const journey: NonNullable<ProgressSummary['journey']> = {
  v: 1,
  here: 'stage1',
  stages: [
    { stage: 'stage1', state: 'open', done: 4, known: 2, total: 8 },
    { stage: 'stage3', state: 'later', done: 0, known: 0, total: 0 },
  ],
};

const full: ProgressSummary = {
  schemaVersion: 1,
  lastActiveAt: '2026-10-10T00:00:00.000Z',
  streakDays: 4,
  stage1: { questsDone: 5, questsTotal: 11, anchorAccuracy: 0.75 },
  cardsUnlocked: 7,
  minutesLast7d: 42,
  jamoRecognized: ['ㄱ', 'ㄴ'],
  needsPractice: ['ㅂ'],
  stage1Anchor: { met: false, checkedAt: '2026-10-09T00:00:00.000Z', tricky: ['ㅂ', 'ㅍ'] },
  placement,
  planProgress: {
    'plan:own-1': { done: 1, total: 3, notReady: 0 },
    'plan:own-2': { done: 2, total: 2, notReady: 1 },
    'plan:other-class': { done: 4, total: 9, notReady: 0 },
  },
  journey,
};

const own = new Set(['plan:own-1', 'plan:own-2', 'plan:own-unstarted']);

describe('teacherVisibleSummary (F-SPACE-002 T-1a, section 4.11)', () => {
  it('keeps exactly the allow-listed keys, with their values, and drops stage1Anchor and schemaVersion', () => {
    const out = teacherVisibleSummary(full, own);
    expect(Object.keys(out ?? {}).sort()).toEqual([...TEACHER_VISIBLE_SUMMARY_KEYS].sort());
    expect(out).toEqual({
      lastActiveAt: full.lastActiveAt,
      streakDays: 4,
      stage1: { questsDone: 5, questsTotal: 11, anchorAccuracy: 0.75 },
      cardsUnlocked: 7,
      minutesLast7d: 42,
      jamoRecognized: ['ㄱ', 'ㄴ'],
      needsPractice: ['ㅂ'],
      placement,
      planProgress: { 'plan:own-1': { done: 1, total: 3, notReady: 0 }, 'plan:own-2': { done: 2, total: 2, notReady: 1 } },
      journey,
    });
    expect(JSON.stringify(out)).not.toContain('tricky');
    expect(JSON.stringify(out)).not.toContain('plan:other-class');
  });

  it("filters planProgress to the viewing space's plan ids (none of its plans: empty)", () => {
    expect(teacherVisibleSummary(full, new Set())?.planProgress).toEqual({});
    expect(teacherVisibleSummary(full, new Set(['plan:other-class']))?.planProgress).toEqual({ 'plan:other-class': { done: 4, total: 9, notReady: 0 } });
  });

  it('drops keys a stored summary carries that are on no list (older or newer writers)', () => {
    const stored = { ...full, futureKey: 'secret-future', stage1: { ...full.stage1, perQuestAnswers: ['secret-answer'] } };
    const out = teacherVisibleSummary(stored, own);
    expect(out && 'futureKey' in out).toBe(false);
    expect(out?.stage1).toEqual({ questsDone: 5, questsTotal: 11, anchorAccuracy: 0.75 });
    expect(JSON.stringify(out)).not.toContain('secret');
  });

  it('copies only what a legacy summary has, and reads a missing or malformed planProgress as empty', () => {
    const legacy = { schemaVersion: 1, lastActiveAt: 't', stage1: 'not-an-object', planProgress: ['bad'] };
    expect(teacherVisibleSummary(legacy, own)).toEqual({ lastActiveAt: 't', planProgress: {} });
    expect(teacherVisibleSummary({ lastActiveAt: 't' }, own)).toEqual({ lastActiveAt: 't', planProgress: {} });
  });

  it('copies only the known journey keys, never what a newer writer left under it (F-ROUTE-001 R-8)', () => {
    const stored = {
      ...full,
      journey: { ...journey, learnerName: 'secret-name', stages: [{ ...journey.stages[0], questIds: ['secret-quest'] }, 'secret-junk'] },
    };
    const out = teacherVisibleSummary(stored, own);
    expect(out?.journey).toEqual({ v: 1, here: 'stage1', stages: [journey.stages[0]] });
    expect(JSON.stringify(out)).not.toContain('secret');
  });

  it('leaves out a journey that is not an object, and reads malformed stages as none', () => {
    const missing = teacherVisibleSummary({ ...full, journey: 'oops' }, own);
    expect(missing && 'journey' in missing).toBe(false);
    expect(teacherVisibleSummary({ ...full, journey: { v: 1, here: null, stages: 'oops' } }, own)?.journey).toEqual({ v: 1, here: null, stages: [] });
    const legacy = teacherVisibleSummary({ lastActiveAt: 't' }, own);
    expect(legacy && 'journey' in legacy).toBe(false);
  });

  it('answers null when there is no summary object', () => {
    expect(teacherVisibleSummary(null, own)).toBeNull();
    expect(teacherVisibleSummary(undefined, own)).toBeNull();
    expect(teacherVisibleSummary('summary', own)).toBeNull();
    expect(teacherVisibleSummary([full], own)).toBeNull();
  });
});

describe('rosterSummary (F-PLAN-002 section 3.10: the self-route reaches the family space only)', () => {
  const selfRoute = { done: 7, total: 9, notReady: 0, weeks: 12, endsOn: '2027-01-09' };
  const withRoute = { ...full, selfRoute };

  it('adds selfRoute to the projection for a family space', () => {
    expect(rosterSummary(withRoute, own, 'family')).toEqual({ ...teacherVisibleSummary(withRoute, own), selfRoute });
  });

  it('removes it for a class and a school, which see exactly the teacher projection', () => {
    for (const kind of ['class', 'school'] as const) {
      const out = rosterSummary(withRoute, own, kind);
      expect(out).toEqual(teacherVisibleSummary(withRoute, own));
      expect(out && 'selfRoute' in out).toBe(false);
    }
  });

  it('gives the journey to a class, a school and a family alike (F-ROUTE-001 OD-11)', () => {
    for (const kind of ['class', 'school', 'family'] as const) expect(rosterSummary(full, own, kind)?.journey).toEqual(journey);
  });

  it('copies only the known self-route keys, never what a newer writer left under it', () => {
    const out = rosterSummary({ ...full, selfRoute: { ...selfRoute, items: ['quest:a'], learnerName: 'Suni' } }, own, 'family');
    expect(out?.selfRoute).toEqual(selfRoute);
  });

  it('adds nothing when the summary has no route or a malformed one, and answers null without a summary', () => {
    expect(rosterSummary(full, own, 'family')).toEqual(teacherVisibleSummary(full, own));
    expect(rosterSummary({ ...full, selfRoute: 'oops' }, own, 'family')).toEqual(teacherVisibleSummary(full, own));
    expect(rosterSummary(null, own, 'family')).toBeNull();
  });
});
