import { describe, expect, it } from 'vitest';
import type { RosterLearner } from '../api';
import { CAP_WARNING_RATIO, capState, classRollup, codeExpiry, percent, relativeDay } from '../rollup';

const now = new Date('2026-09-21T12:00:00.000Z');
const learner = (id: string, over: Partial<RosterLearner> = {}, summary: Partial<NonNullable<RosterLearner['summary']>> | null = {}): RosterLearner => ({
  id,
  displayName: id,
  ageGroup: '5-7',
  avatar: 'hoya-orange',
  joinedAt: 't',
  lastActiveAt: '2026-09-21T00:00:00.000Z',
  lastSyncedAt: null,
  summary:
    summary === null
      ? null
      : {
          schemaVersion: 1,
          lastActiveAt: '2026-09-21T00:00:00.000Z',
          streakDays: 0,
          stage1: { questsDone: 3, questsTotal: 11, anchorAccuracy: null },
          cardsUnlocked: 2,
          minutesLast7d: 10,
          jamoRecognized: [],
          needsPractice: [],
          planProgress: {},
          ...summary,
        },
  ...over,
});

describe('class roll-up (F-CONSOLE-001 §3.5)', () => {
  it('counts practice, averages anchor accuracy over known values, ranks revisit jamo, flags stale learners', () => {
    const roll = classRollup(
      [
        learner('a', {}, { stage1: { questsDone: 5, questsTotal: 11, anchorAccuracy: 0.8 }, needsPractice: ['ㅂ', 'ㅅ'] }),
        learner('b', {}, { stage1: { questsDone: 2, questsTotal: 11, anchorAccuracy: 0.6 }, needsPractice: ['ㅂ'], minutesLast7d: 0, lastActiveAt: '2026-09-10T00:00:00.000Z' }),
        learner('c', {}, { needsPractice: ['ㅈ', 'ㅂ'] }),
        learner('d', {}, null),
      ],
      now,
    );
    expect(roll).toEqual({ students: 4, practicedThisWeek: 2, anchorAccuracy: 0.7, revisit: ['ㅂ', 'ㅅ', 'ㅈ'], notSynced: 2 });
    expect(classRollup([], now)).toEqual({ students: 0, practicedThisWeek: 0, anchorAccuracy: null, revisit: [], notSynced: 0 });
  });

  it('caps only apply to classes and warn from 80 %', () => {
    expect(capState('family', 30)).toBeNull();
    expect(capState('class', 15)).toEqual({ used: 15, total: 20, warning: false, reached: false });
    expect(capState('class', Math.ceil(20 * CAP_WARNING_RATIO))).toMatchObject({ warning: true, reached: false });
    expect(capState('class', 20)).toMatchObject({ warning: true, reached: true });
  });

  it('formats relative days, code expiry and percentages', () => {
    expect(relativeDay('2026-09-21T03:00:00.000Z', now)).toBe('today');
    expect(relativeDay('2026-09-20T23:00:00.000Z', now)).toBe('yesterday');
    expect(relativeDay('2026-09-17T10:00:00.000Z', now)).toBe('Thu');
    expect(relativeDay('2026-09-03T10:00:00.000Z', now)).toBe('Sep 3');
    expect(relativeDay(null, now)).toBe('not yet');
    expect(relativeDay('garbage', now)).toBe('not yet');
    expect(codeExpiry('2026-10-09T12:00:00.000Z', now)).toBe('expires in 18 days');
    expect(codeExpiry('2026-09-22T11:00:00.000Z', now)).toBe('expires today');
    expect(codeExpiry('2026-09-22T13:00:00.000Z', now)).toBe('expires in 1 day');
    expect(codeExpiry('2026-09-01T00:00:00.000Z', now)).toBe('expired');
    expect(codeExpiry('garbage', now)).toBe('expired');
    expect(codeExpiry(null, now)).toBe('no code yet');
    expect(percent(0.714)).toBe('71%');
    expect(percent(null)).toBe('—');
  });
});
