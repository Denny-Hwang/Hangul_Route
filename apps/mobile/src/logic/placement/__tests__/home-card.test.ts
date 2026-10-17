import { describe, expect, it } from 'vitest';
import {
  HOME_CARD_MAX_QUESTS,
  homeNextLesson,
  homeQuietCard,
  homeTip,
  homeworkCardTitle,
  isSameAsHero,
  levelCheckCard,
  recentStarsOf,
  showStreakPill,
  type LevelCheckCardInput,
} from '../home-card';
import type { RouteNext } from '../../route-next';

const eligible: LevelCheckCardInput = {
  enabled: true,
  bankReady: true,
  hasResult: false,
  questsDone: 0,
  dismissedAt: undefined,
  resumable: false,
};

describe('the Home level-check card (F-PLC-001 section 3.10)', () => {
  it('shows "Take the level check" while eligible', () => {
    expect(levelCheckCard(eligible)).toBe('take');
    expect(levelCheckCard({ ...eligible, questsDone: HOME_CARD_MAX_QUESTS - 1 })).toBe('take');
    expect(HOME_CARD_MAX_QUESTS).toBe(3);
  });

  it('reads "Continue the level check" while a run can be resumed', () => {
    expect(levelCheckCard({ ...eligible, resumable: true })).toBe('continue');
  });

  it('hidden with the flag off, a bank that failed to parse, a result, three quests done or Not now', () => {
    expect(levelCheckCard({ ...eligible, enabled: false })).toBeNull();
    expect(levelCheckCard({ ...eligible, bankReady: false })).toBeNull();
    expect(levelCheckCard({ ...eligible, hasResult: true })).toBeNull();
    expect(levelCheckCard({ ...eligible, questsDone: 3 })).toBeNull();
    expect(levelCheckCard({ ...eligible, dismissedAt: '2026-10-01T00:00:00Z' })).toBeNull();
    expect(levelCheckCard({ ...eligible, dismissedAt: '' })).toBe('take');
  });

  it('at most one quiet card: the level check wins while eligible, then the plan prompt', () => {
    expect(homeQuietCard('take', true)).toBe('level-check');
    expect(homeQuietCard('continue', false)).toBe('level-check');
    expect(homeQuietCard(null, true)).toBe('plan-prompt');
    expect(homeQuietCard(null, false)).toBeNull();
  });
});

describe('the level-check card after "I am new to Korean" (owner request 2026-10-16, item 8)', () => {
  const declined = { ...eligible, declinedAt: '2026-10-16T09:00:00Z' };
  it('stays hidden until three quests are done, then is offered until Not now or a result', () => {
    for (let done = 0; done < HOME_CARD_MAX_QUESTS; done += 1) expect(levelCheckCard({ ...declined, questsDone: done }), `${done}`).toBeNull();
    expect(levelCheckCard({ ...declined, resumable: true })).toBeNull();
    expect(levelCheckCard({ ...declined, questsDone: HOME_CARD_MAX_QUESTS })).toBe('take');
    expect(levelCheckCard({ ...declined, questsDone: 10, resumable: true })).toBe('continue');
    expect(levelCheckCard({ ...declined, questsDone: 5, dismissedAt: '2026-10-17T00:00:00Z' })).toBeNull();
    expect(levelCheckCard({ ...declined, questsDone: 5, hasResult: true })).toBeNull();
    expect(levelCheckCard({ ...declined, questsDone: 5, enabled: false })).toBeNull();
  });
  it('an empty or absent decline changes nothing', () => {
    expect(levelCheckCard({ ...eligible, declinedAt: '' })).toBe('take');
    expect(levelCheckCard({ ...eligible, declinedAt: undefined })).toBe('take');
  });
});

describe('the Next lesson hero', () => {
  const quest: RouteNext = { kind: 'quest', questId: 'quest:q1', episodeId: 'episode:e1', stage: 'stage1', source: 'cursor', sourceId: null };
  const questOf = (id: string) => (id === 'quest:q1' ? { estimatedMinutes: 4 } : id === 'quest:short' ? { estimatedMinutes: 0.4 } : undefined);

  it("names routeNext's quest with its minutes: Start before the first quest is done, Continue after", () => {
    expect(homeNextLesson({ next: quest, questOf, questsDone: 0 })).toEqual({ questId: 'quest:q1', episodeId: 'episode:e1', minutes: 4, cta: 'start' });
    expect(homeNextLesson({ next: quest, questOf, questsDone: 2 })?.cta).toBe('continue');
  });

  it('never says less than one minute', () => {
    expect(homeNextLesson({ next: { ...quest, questId: 'quest:short' }, questOf, questsDone: 0 })?.minutes).toBe(1);
  });

  it('nothing when the one next is not a quest or the quest is not in this build', () => {
    expect(homeNextLesson({ next: null, questOf, questsDone: 0 })).toBeNull();
    expect(homeNextLesson({ next: { kind: 'rest' }, questOf, questsDone: 5 })).toBeNull();
    expect(homeNextLesson({ next: { kind: 'free-end', placedOut: false }, questOf, questsDone: 5 })).toBeNull();
    expect(homeNextLesson({ next: { ...quest, questId: 'quest:gone' }, questOf, questsDone: 0 })).toBeNull();
  });
});

describe('card (2) in its compact form under the hero (AMENDMENTS-DISPLAY-NAV section 9.1)', () => {
  const hero = { questId: 'quest:q1' };
  it('is compact only while it names the hero\'s own lesson and is not collected', () => {
    expect(isSameAsHero({ kind: 'new', questId: 'quest:q1', collected: false }, hero)).toBe(true);
    expect(isSameAsHero({ kind: 'new', questId: 'quest:q2', collected: false }, hero)).toBe(false);
    expect(isSameAsHero({ kind: 'new', questId: 'quest:q1', collected: true }, hero)).toBe(false);
  });

  it('never for a replay card, a card with no quest, or a Home with no hero', () => {
    expect(isSameAsHero({ kind: 'replay', questId: 'quest:q1', collected: false }, hero)).toBe(false);
    expect(isSameAsHero({ kind: 'daily-test', collected: false }, hero)).toBe(false);
    expect(isSameAsHero({ kind: 'new', questId: 'quest:q1', collected: false }, null)).toBe(false);
  });
});

describe('the streak pill, the tip, Recent stars and the Homework card', () => {
  it('the streak pill waits for the first day', () => {
    expect(showStreakPill(0)).toBe(false);
    expect(showStreakPill(1)).toBe(true);
    expect(showStreakPill(12)).toBe(true);
  });

  it('the tip follows the state: first lesson, done today, any other day', () => {
    expect(homeTip({ questsDone: 0, playedToday: false })).toBe('first');
    expect(homeTip({ questsDone: 0, playedToday: true })).toBe('first');
    expect(homeTip({ questsDone: 3, playedToday: true })).toBe('doneToday');
    expect(homeTip({ questsDone: 3, playedToday: false })).toBe('daily');
  });

  it('Recent stars hides until a quest earned a star, then shows the newest that did', () => {
    expect(recentStarsOf([])).toBeNull();
    expect(recentStarsOf([{ stars: 0 }])).toBeNull();
    expect(recentStarsOf([{ stars: 2 }, { stars: 0 }])).toBe(2);
    expect(recentStarsOf([{ stars: 1 }, { stars: 3 }])).toBe(3);
  });

  it('the Homework card says Review when nothing is assigned, Homework while a grown-up or class assignment is open', () => {
    const me = 'profile:mina';
    expect(homeworkCardTitle(undefined, me)).toBe('review');
    expect(homeworkCardTitle([], me)).toBe('review');
    expect(homeworkCardTitle([{ profileId: me, assignedBy: 'teacher', completedAt: '2026-10-15T00:00:00Z' }], me)).toBe('review');
    expect(homeworkCardTitle([{ profileId: me, assignedBy: 'teacher', completedAt: '2026-10-15T00:00:00Z' }, { profileId: me, assignedBy: 'teacher' }], me)).toBe('homework');
    expect(homeworkCardTitle([{ profileId: me, assignedBy: 'parent' }], me)).toBe('homework');
  });

  it("the learner's own weekly plan is not homework, and another profile's rows never count", () => {
    const me = 'profile:mina';
    // ASSIGNED_BY.self: the learner's own plan items.
    expect(homeworkCardTitle([{ profileId: me, assignedBy: 'system' }, { profileId: me, assignedBy: 'system' }], me)).toBe('review');
    expect(homeworkCardTitle([{ profileId: 'profile:jun', assignedBy: 'teacher' }], me)).toBe('review');
    expect(homeworkCardTitle([{ profileId: me, assignedBy: 'system' }, { profileId: me, assignedBy: 'teacher' }], me)).toBe('homework');
    expect(homeworkCardTitle([{ profileId: me, assignedBy: 'teacher' }], undefined)).toBe('review');
  });
});
