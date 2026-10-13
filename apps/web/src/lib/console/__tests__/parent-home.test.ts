import { describe, expect, it } from 'vitest';
import type { RosterLearner, SpaceListItem } from '../api';
import { familyActionLinks, isArchivedFamily, joinOrder, learnerCardActions, managesJoinCode, parentHomeView } from '../parent-home';

/**
 * F-APP-001 A-5b, section 3.8 (design/screens/app-shell/parent-home.md): what the family home draws.
 * Families held as owner or caregiver, in creation order; learners in join order, never by activity;
 * card actions by flag; links carry ids and the /parent/space prefix only.
 */
function item(id: string, kind: SpaceListItem['space']['kind'], role: SpaceListItem['role'], createdAt = '2026-10-01T00:00:00Z'): SpaceListItem {
  return {
    space: { id, kind, name: `${id} name`, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt },
    role,
    counts: { learners: 1, accounts: 1, classes: 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
  };
}

function learner(id: string, joinedAt: string, lastActiveAt = '2026-10-10T00:00:00Z', minutes = 0): RosterLearner {
  return {
    id,
    displayName: id,
    ageGroup: '5-7',
    avatar: 'cub',
    joinedAt,
    lastActiveAt,
    lastSyncedAt: null,
    summary: { minutesLast7d: minutes } as RosterLearner['summary'],
  } as RosterLearner;
}

describe('parentHomeView', () => {
  it('lists the family spaces held as owner or caregiver, oldest first, then by id', () => {
    const view = parentHomeView([
      item('sp_b', 'family', 'caregiver', '2026-10-02T00:00:00Z'),
      item('sp_c', 'class', 'owner'),
      item('sp_a', 'family', 'owner', '2026-10-02T00:00:00Z'),
      item('sp_0', 'family', 'owner', '2026-09-01T00:00:00Z'),
      item('sp_s', 'family', 'student'),
    ]);
    expect(view.state).toBe('families');
    if (view.state !== 'families') return;
    expect(view.families.map((f) => f.space.id)).toEqual(['sp_0', 'sp_a', 'sp_b']);
  });

  it('archived families come after the live ones, each group oldest first (review: an archived family is never drawn as live)', () => {
    const archived = (entry: SpaceListItem): SpaceListItem => ({ ...entry, space: { ...entry.space, archivedAt: '2026-10-09T00:00:00Z' } });
    const view = parentHomeView([
      archived(item('sp_old', 'family', 'owner', '2026-08-01T00:00:00Z')),
      item('sp_b', 'family', 'owner', '2026-10-02T00:00:00Z'),
      item('sp_a', 'family', 'caregiver', '2026-09-02T00:00:00Z'),
    ]);
    if (view.state !== 'families') throw new Error('expected families');
    expect(view.families.map((f) => f.space.id)).toEqual(['sp_a', 'sp_b', 'sp_old']);
    expect(view.families.map(isArchivedFamily)).toEqual([false, false, true]);
  });

  it('only the family owner manages the join code (the backend sends it with space.manage alone)', () => {
    expect(managesJoinCode(item('sp_f', 'family', 'owner'))).toBe(true);
    expect(managesJoinCode(item('sp_f', 'family', 'caregiver'))).toBe(false);
  });

  it('cross-links: Also teach a class without the teacher persona; the switch with it', () => {
    expect(parentHomeView([item('sp_f', 'family', 'owner')])).toMatchObject({ state: 'families', cross: 'addClass' });
    expect(parentHomeView([item('sp_f', 'family', 'owner'), item('sp_c', 'class', 'teacher')])).toMatchObject({ state: 'families', cross: 'toTeacher' });
  });

  it('no family persona: the no-family state, with Go to Classes only for a teacher', () => {
    expect(parentHomeView([item('sp_c', 'class', 'owner')])).toEqual({ state: 'noFamily', goTeacher: true });
    expect(parentHomeView([])).toEqual({ state: 'noFamily', goTeacher: false });
  });
});

describe('joinOrder', () => {
  it('orders learners by when they joined, then by id, never by activity or minutes', () => {
    const a = learner('profile:a', '2026-10-03T00:00:00Z', '2026-10-01T00:00:00Z', 1);
    const b = learner('profile:b', '2026-10-01T00:00:00Z', '2026-10-11T00:00:00Z', 90);
    const c = learner('profile:c', '2026-10-01T00:00:00Z', '2026-09-01T00:00:00Z', 0);
    expect(joinOrder([a, b, c]).map((l) => l.id)).toEqual(['profile:b', 'profile:c', 'profile:a']);
    // The same learners after their activity changes: the same order.
    const later = [learner('profile:a', a.joinedAt, '2026-10-12T00:00:00Z', 200), learner('profile:c', c.joinedAt, '2026-10-12T00:00:00Z', 300), learner('profile:b', b.joinedAt, '2026-09-01T00:00:00Z', 0)];
    expect(joinOrder(later).map((l) => l.id)).toEqual(['profile:b', 'profile:c', 'profile:a']);
  });

  it('never changes the list it is given', () => {
    const list = [learner('profile:z', '2026-10-05T00:00:00Z'), learner('profile:y', '2026-10-01T00:00:00Z')];
    joinOrder(list);
    expect(list.map((l) => l.id)).toEqual(['profile:z', 'profile:y']);
  });
});

describe('learnerCardActions', () => {
  const off = { reports: false, notes: false, route: false };
  const on = { reports: true, notes: true, route: true };

  it('flags off (today): Open, the family roster, and nothing else', () => {
    expect(learnerCardActions('sp:f', 'profile:1', off)).toEqual({ primary: { key: 'open', href: '/parent/space?id=sp%3Af' }, secondary: [] });
  });

  it('every flag on: See report, Send a note (composer, learner preselected) and Learning Route, all under /parent', () => {
    const actions = learnerCardActions('sp:f', 'profile:1', on);
    expect(actions.primary).toEqual({ key: 'seeReport', href: '/parent/learner?id=sp%3Af&learner=profile%3A1&period=week&from=home' });
    expect(actions.secondary).toEqual([
      { key: 'sendNote', href: '/parent/space/notes?id=sp%3Af&compose=1&learner=profile%3A1' },
      { key: 'route', href: '/parent/space/route?id=sp%3Af&learner=profile%3A1' },
    ]);
  });

  it('each flag shows only its own action', () => {
    expect(learnerCardActions('f', 'l', { ...off, notes: true }).secondary.map((a) => a.key)).toEqual(['sendNote']);
    expect(learnerCardActions('f', 'l', { ...off, route: true }).secondary.map((a) => a.key)).toEqual(['route']);
    expect(learnerCardActions('f', 'l', { ...off, reports: true }).primary.key).toBe('seeReport');
  });

  it('carries ids only: an id can never add a query parameter', () => {
    const { primary, secondary } = learnerCardActions('sp:a&x=1', 'profile:1#y', on);
    for (const { href } of [primary, ...secondary]) {
      const url = new URL(href, 'https://app.example');
      expect(url.hash).toBe('');
      expect(url.searchParams.get('id')).toBe('sp:a&x=1');
      expect(url.searchParams.has('x')).toBe(false);
    }
  });
});

describe('familyActionLinks', () => {
  it('Plan the week, Plan the term and Family settings under /parent/space', () => {
    expect(familyActionLinks('sp:f')).toEqual({
      planWeek: '/parent/space/plan?id=sp%3Af',
      planTerm: '/parent/space/curriculum?id=sp%3Af',
      settings: '/parent/space/settings?id=sp%3Af',
    });
  });
});
