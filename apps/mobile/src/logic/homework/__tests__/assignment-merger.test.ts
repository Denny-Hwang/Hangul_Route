import type { HomeworkAssignment } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { assignmentsForToday, mergeAssignments } from '../assignment-merger';
import type { MissionPlan } from '../mission-builder';

const TODAY = '2026-05-20';
const TOMORROW = '2026-05-21';
const PROFILE = 'profile:kid1';

const plan: MissionPlan = {
  date: TODAY,
  profileId: PROFILE,
  cards: [
    { slot: 1, kind: 'replay', titleEn: 'Replay me', subtitleEn: 'One more go with Hoya', questId: 'quest:a', episodeId: 'episode:one', collected: false },
    { slot: 2, kind: 'new', titleEn: 'Next up', subtitleEn: 'Something new today', questId: 'quest:b', episodeId: 'episode:one', collected: false },
    { slot: 3, kind: 'story', titleEn: 'A story', subtitleEn: 'Story time', episodeId: 'episode:two', collected: false },
  ],
};

function assignment(overrides: Partial<HomeworkAssignment> = {}): HomeworkAssignment {
  return {
    id: 'hw:1',
    profileId: PROFILE,
    questId: 'quest:z',
    episodeId: 'episode:three',
    assignedBy: 'parent',
    assignedAt: `${TODAY}T08:00:00.000Z`,
    targetDate: TODAY,
    ...overrides,
  };
}

const titleOf = (questId: string): string | undefined =>
  ({ 'quest:z': 'Grown-up pick', 'quest:y': 'Second pick' })[questId];

const merge = (assignments: HomeworkAssignment[], enabled = true) =>
  mergeAssignments({ plan, assignments, today: TODAY, enabled, titleOf });

describe('assignmentsForToday', () => {
  it('keeps only this learner, this day, still outstanding', () => {
    const list = [
      assignment({ id: 'hw:mine' }),
      assignment({ id: 'hw:other-kid', profileId: 'profile:kid2' }),
      assignment({ id: 'hw:tomorrow', targetDate: TOMORROW }),
      assignment({ id: 'hw:done', completedAt: `${TODAY}T10:00:00.000Z` }),
    ];
    expect(assignmentsForToday(list, PROFILE, TODAY).map((a) => a.id)).toEqual(['hw:mine']);
  });

  it('orders by assignedAt, earliest first (§3.4)', () => {
    const list = [
      assignment({ id: 'hw:late', assignedAt: `${TODAY}T09:00:00.000Z` }),
      assignment({ id: 'hw:early', assignedAt: `${TODAY}T07:00:00.000Z` }),
    ];
    expect(assignmentsForToday(list, PROFILE, TODAY).map((a) => a.id)).toEqual([
      'hw:early',
      'hw:late',
    ]);
  });
});

describe('mergeAssignments', () => {
  it('is a no-op while the explicitAssignment flag is off (MVP default)', () => {
    const result = merge([assignment()], false);
    expect(result.plan).toBe(plan);
    expect(result.deferred).toEqual([]);
  });

  it('is a no-op when nothing is assigned for today', () => {
    expect(merge([assignment({ targetDate: TOMORROW })]).plan).toBe(plan);
  });

  it('replaces slot ② and leaves slots ① and ③ untouched (§3.4)', () => {
    const result = merge([assignment()]);
    expect(result.plan.cards[1]).toMatchObject({
      slot: 2,
      questId: 'quest:z',
      titleEn: 'Grown-up pick',
      episodeId: 'episode:three',
    });
    expect(result.plan.cards[0]).toEqual(plan.cards[0]);
    expect(result.plan.cards[2]).toEqual(plan.cards[2]);
  });

  it('still shows exactly three cards after a merge', () => {
    expect(merge([assignment()]).plan.cards).toHaveLength(3);
  });

  it('caps at one explicit assignment per day and defers the rest', () => {
    const result = merge([
      assignment({ id: 'hw:late', questId: 'quest:y', assignedAt: `${TODAY}T09:00:00.000Z` }),
      assignment({ id: 'hw:early', questId: 'quest:z', assignedAt: `${TODAY}T07:00:00.000Z` }),
    ]);
    expect(result.plan.cards[1]?.questId).toBe('quest:z');
    expect(result.deferred.map((a) => a.id)).toEqual(['hw:late']);
  });

  it('does not render an assignment whose quest this build does not know', () => {
    const result = merge([assignment({ questId: 'quest:unknown' })]);
    expect(result.plan).toBe(plan);
    expect(result.deferred).toHaveLength(1);
  });

  it('an assigned card carries no reward advantage — only its copy changes', () => {
    // §4: caregiver assignments must not buy extra rewards.
    const result = merge([assignment()]);
    expect(result.plan.cards[1]?.kind).toBe('new');
    expect(result.plan.cards[1]?.collected).toBe(false);
  });
});
