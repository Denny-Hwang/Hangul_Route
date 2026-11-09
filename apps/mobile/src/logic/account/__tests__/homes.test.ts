import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { AccountRoster, AccountRosterLearner, AccountSpaceItem } from '../account-data';
import {
  AccountLoadError,
  CODE_ADVANCE_EM,
  codeFontSize,
  codeGroups,
  codePanelOf,
  failureOf,
  familiesOf,
  learnerCards,
  loadFailureOf,
  managesCode,
  notStarted,
  routesAfterEndedSession,
  signOutLanding,
  spacesBucket,
  spelledCode,
  worstFailure,
} from '../homes';

/**
 * F-AUTH-004 sections 6.6, 8.2, 8.8 and 15 (row NS-5; D10, D11; anti-shame): the Family home's rules, pure: which
 * families show and in what order, learners in join order whatever the server sent (never by activity), the code
 * panel's role rules, the learner card's words, the states, the event's bucket and where Sign out lands.
 */

const en = getMessages('en');

const item = (id: string, over: Partial<AccountSpaceItem> & { kind?: AccountSpaceItem['space']['kind']; createdAt?: string; archivedAt?: string | null } = {}): AccountSpaceItem => ({
  space: { id, kind: over.kind ?? 'family', name: id, createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z', archivedAt: over.archivedAt ?? null },
  role: over.role ?? 'owner',
  counts: { learners: 0 },
  joinCode: over.joinCode ?? null,
  attention: null,
});

const learner = (id: string, joinedAt: string, over: Partial<AccountRosterLearner> = {}): AccountRosterLearner => ({
  id,
  displayName: id,
  joinedAt,
  lastActiveAt: '2026-11-08T10:00:00.000Z',
  summary: { minutesLast7d: 10, lastActiveAt: '2026-11-08T10:00:00.000Z', activity: undefined },
  ...over,
});

describe('familiesOf: owner and caregiver families, live then archived, each oldest first', () => {
  it('whatever the server order (newest first) and other spaces', () => {
    const items = [
      item('space:new', { createdAt: '2026-05-01T00:00:00.000Z' }),
      item('space:class', { kind: 'class', role: 'owner' }),
      item('space:old-archived', { createdAt: '2025-01-01T00:00:00.000Z', archivedAt: '2026-02-01T00:00:00.000Z' }),
      item('space:grandma', { role: 'caregiver', createdAt: '2026-03-01T00:00:00.000Z' }),
      item('space:student', { role: 'student' }),
      item('space:old', { createdAt: '2025-06-01T00:00:00.000Z' }),
    ];
    expect(familiesOf(items).map((f) => f.space.id)).toEqual(['space:old', 'space:grandma', 'space:new', 'space:old-archived']);
  });
});

describe('the code panel (section 8.2: only the owner manages a family code)', () => {
  it('owner with a code: the code (the spaces item first, else the roster)', () => {
    expect(codePanelOf(item('a', { joinCode: 'K7MPQ4' }), null)).toEqual({ kind: 'code', code: 'K7MPQ4' });
    expect(codePanelOf(item('a'), { space: null, learners: [], joinCode: 'H3TRW9' })).toEqual({ kind: 'code', code: 'H3TRW9' });
  });

  it('owner with no live code: Make a code', () => {
    expect(codePanelOf(item('a'), { space: null, learners: [], joinCode: null })).toEqual({ kind: 'make' });
    expect(codePanelOf(item('a'), null)).toEqual({ kind: 'make' });
  });

  it('a caregiver: ask the owner, even if a code came along', () => {
    expect(codePanelOf(item('a', { role: 'caregiver', joinCode: 'K7MPQ4' }), null)).toEqual({ kind: 'ask' });
    expect(managesCode(item('a', { role: 'caregiver' }))).toBe(false);
  });

  it('an archived family: no panel at all', () => {
    expect(codePanelOf(item('a', { archivedAt: '2026-01-02T00:00:00.000Z', joinCode: 'K7MPQ4' }), null)).toEqual({ kind: 'none' });
    expect(codePanelOf(item('a', { archivedAt: '2026-01-02T00:00:00.000Z', role: 'caregiver' }), null)).toEqual({ kind: 'none' });
  });
});

describe('D11: the code drawn and spoken', () => {
  it('two groups of three, and the characters spaced for a screen reader', () => {
    expect(codeGroups('K7MPQ4')).toEqual(['K7M', 'PQ4']);
    expect(spelledCode('K7MPQ4')).toBe('K 7 M P Q 4');
    expect(en.a11y.account.joinCode(spelledCode('K7MPQ4'))).toBe('Code K 7 M P Q 4. Copy it to share.');
  });

  it('steps down to fit a group of three on one line, never below the body size; display before it is measured', () => {
    expect(codeFontSize(0, 36, 18, 0.4)).toBe(36);
    expect(codeFontSize(Number.NaN, 36, 18, 0.4)).toBe(36);
    expect(codeFontSize(1000, 36, 18, 0.4)).toBe(36);
    const narrow = 3 * CODE_ADVANCE_EM * 24 + 3 * 0.4;
    expect(codeFontSize(narrow, 36, 18, 0.4)).toBe(24);
    expect(codeFontSize(20, 36, 18, 0.4)).toBe(18);
  });
});

describe('learner cards (D10): join order, never activity; the console words', () => {
  const NOW = new Date('2026-11-08T12:00:00.000Z');
  it('sorted by joinedAt then id, whatever the server (last activity) sent', () => {
    const roster: AccountRoster = {
      space: null,
      joinCode: null,
      learners: [
        learner('profile:jun', '2026-03-01T00:00:00.000Z', { summary: { minutesLast7d: 90, lastActiveAt: '2026-11-08T11:00:00.000Z' } }),
        learner('profile:b', '2026-02-01T00:00:00.000Z'),
        learner('profile:a', '2026-02-01T00:00:00.000Z'),
      ],
    };
    expect(learnerCards(roster, NOW, 'en', en).map((c) => c.id)).toEqual(['profile:a', 'profile:b', 'profile:jun']);
  });

  it('a learner who practised: last active (relative day) and minutes, last 7 days', () => {
    const [card] = learnerCards({ space: null, joinCode: null, learners: [learner('profile:mina', '2026-02-01T00:00:00.000Z', { summary: { minutesLast7d: 34, lastActiveAt: '2026-11-08T10:00:00.000Z' } })] }, NOW, 'en', en);
    expect(card).toEqual({ id: 'profile:mina', name: 'profile:mina', lastActive: en.console.space.learner.lastActive(en.common.time.today), minutes: en.console.parentHome.minutes7d(34) });
  });

  it('falls back to the roster last-active and 0 minutes when the summary has none', () => {
    const [card] = learnerCards({ space: null, joinCode: null, learners: [learner('p', '2026-02-01T00:00:00.000Z', { lastActiveAt: '2026-11-07T10:00:00.000Z', summary: { cardsUnlocked: 1 } })] }, NOW, 'en', en);
    expect(card?.lastActive).toBe(en.console.space.learner.lastActive(en.common.time.yesterday));
    expect(card?.minutes).toBe(en.console.parentHome.minutes7d(0));
  });

  it('a learner who never practised: Not started yet, no minutes line', () => {
    const [card] = learnerCards({ space: null, joinCode: null, learners: [learner('p', '2026-02-01T00:00:00.000Z', { summary: null })] }, NOW, 'en', en);
    expect(card).toEqual({ id: 'p', name: 'p', lastActive: en.console.parentHome.lastActive.notStarted, minutes: null });
  });
});

describe('notStarted (the console card rule)', () => {
  const at = '2026-02-01T00:00:00.000Z';
  const activity = (days: number): NonNullable<AccountRosterLearner['summary']>['activity'] => ({
    v: 1,
    tz: 0,
    asOf: '2026-11-08',
    days: [],
    months: [],
    total: { since: null, min: 0, q: 0, c: 0, w: 0, days },
    milestones: [],
  });
  it('no summary, or an activity with no practice day', () => {
    expect(notStarted(learner('p', at, { summary: null }))).toBe(true);
    expect(notStarted(learner('p', at, { summary: { activity: activity(0), minutesLast7d: 5 } }))).toBe(true);
    expect(notStarted(learner('p', at, { summary: { activity: activity(2) } }))).toBe(false);
  });

  it('an older summary: empty unless a quest, a card, a stage, a last-active time or minutes', () => {
    expect(notStarted(learner('p', at, { summary: {} }))).toBe(true);
    expect(notStarted(learner('p', at, { summary: { minutesLast7d: 3 } }))).toBe(false);
    expect(notStarted(learner('p', at, { summary: { cardsUnlocked: 1 } }))).toBe(false);
    expect(notStarted(learner('p', at, { summary: { stage1: { questsDone: 1, questsTotal: 20, anchorAccuracy: null } } }))).toBe(false);
    expect(notStarted(learner('p', at, { summary: { lastActiveAt: '2026-11-01T00:00:00.000Z' } }))).toBe(false);
    expect(notStarted(learner('p', at, { summary: { journey: { v: 1, here: 'stage1', stages: [{ stage: 'stage1', done: 2, total: 20 }] } } as never }))).toBe(false);
  });
});

describe('section 8.8: states', () => {
  it('each client error to what the screen draws', () => {
    expect(loadFailureOf('offline')).toBe('offline');
    expect(loadFailureOf('unauthorized')).toBe('unauthorized');
    expect(loadFailureOf('native_off')).toBe('unavailable');
    for (const error of ['refused', 'forbidden', 'not_found', 'error'] as const) expect(loadFailureOf(error)).toBe('cant_load');
  });

  it('a thrown AccountLoadError says why; anything else cannot load', () => {
    const error = new AccountLoadError('native_off');
    expect(error.name).toBe('AccountLoadError');
    expect(error.message).toBe('native_off');
    expect(failureOf(error)).toBe('unavailable');
    expect(failureOf(new Error('parse'))).toBe('cant_load');
    expect(failureOf(undefined)).toBe('cant_load');
  });

  it('the one failure drawn: 401 first, then the switch, then offline, then any other', () => {
    expect(worstFailure([])).toBeNull();
    expect(worstFailure(['cant_load', 'offline'])).toBe('offline');
    expect(worstFailure(['cant_load', 'unavailable', 'offline'])).toBe('unavailable');
    expect(worstFailure(['unavailable', 'unauthorized'])).toBe('unauthorized');
    expect(worstFailure(['cant_load'])).toBe('cant_load');
  });
});

describe('section 6.6: where a home Sign out lands', () => {
  it('the Grown-up area under the home; Welcome on a device with no learner; else the area in its place', () => {
    expect(signOutLanding([{ name: 'ParentDashboard' }, { name: 'AccountHome' }], true)).toBe('area_below');
    expect(signOutLanding([{ name: 'ParentDashboard' }, { name: 'AccountHome' }], false)).toBe('area_below');
    expect(signOutLanding([{ name: 'AccountHome' }], false)).toBe('welcome');
    expect(signOutLanding([{ name: 'AccountHome' }], true)).toBe('area_here');
  });
});

describe('sections 6.6 and 8.8: the stack after a 401 on a page above a home', () => {
  const r = (key: string, name: string): { key: string; name: string } => ({ key, name });
  it('the run of account routes the page sits in goes; the Grown-up area below stays', () => {
    expect(routesAfterEndedSession([r('d', 'ParentDashboard'), r('h', 'AccountHome'), r('me', 'AccountLearnerReport')], 'me')).toEqual([r('d', 'ParentDashboard')]);
    expect(routesAfterEndedSession([r('h', 'AccountHome'), r('me', 'AccountLearnerReport')], 'me')).toEqual([]);
    expect(routesAfterEndedSession([r('d', 'ParentDashboard'), r('me', 'AccountLearnerReport')], 'me')).toEqual([r('d', 'ParentDashboard')]);
  });

  it('a page not found keeps the stack', () => {
    expect(routesAfterEndedSession([r('d', 'ParentDashboard')], 'me')).toEqual([r('d', 'ParentDashboard')]);
  });
});

describe('section 15: the spaces bucket, never the count', () => {
  it.each([
    [0, '0'],
    [-1, '0'],
    [1, '1'],
    [2, '2-4'],
    [4, '2-4'],
    [5, '5+'],
    [40, '5+'],
  ] as const)('%i -> %s', (count, bucket) => {
    expect(spacesBucket(count)).toBe(bucket);
  });
});
