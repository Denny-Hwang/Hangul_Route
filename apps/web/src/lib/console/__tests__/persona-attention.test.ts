import { describe, expect, it } from 'vitest';
import type { SpaceListItem } from '../api';
import {
  ATTENTION_GAP_MS,
  ATTENTION_POLL_MS,
  adminSchoolIds,
  attentionDeployed,
  attentionHref,
  navCountText,
  parentAttention,
  relinkBarView,
  scopeNeeded,
  teacherAttention,
  titleWithCount,
} from '../persona-attention';

/**
 * AMENDMENTS-GROWNUP-UX GX-3 (sections 5.5 and 6): the teacher's waiting counts from GX-W's `spaces[].attention` and a
 * school's `GET /:id/attention`, merged by space id; the nav number; the re-link bar's line; the tab title prefix.
 */
const NOW = new Date('2026-10-31T12:00:00.000Z');
const at = (minutes: number): string => new Date(NOW.getTime() + minutes * 60_000).toISOString();

function item(id: string, kind: SpaceListItem['space']['kind'], role: SpaceListItem['role'], attention?: unknown, over: Partial<SpaceListItem['space']> = {}): SpaceListItem {
  return {
    space: { id, kind, name: `Name ${id}`, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-10-01T00:00:00Z', ...over },
    role,
    counts: { learners: 2, accounts: 1, classes: 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
    ...(attention === undefined ? {} : { attention }),
  };
}
const att = (relinks: number, moves: number, relinkExpiresAt: string | null = null) => ({ relinks, moves, relinkExpiresAt });

describe('the poll constants (section 5.4)', () => {
  it('reads every 30 s while visible, with a shorter gap so a focus right after a read waits', () => {
    expect(ATTENTION_POLL_MS).toBe(30_000);
    expect(ATTENTION_GAP_MS).toBeLessThan(ATTENTION_POLL_MS);
  });
});

describe('adminSchoolIds', () => {
  it('lists the live schools the account owns or administers, never one it only teaches in', () => {
    const spaces = [item('s1', 'school', 'owner'), item('s2', 'school', 'admin'), item('s3', 'school', 'teacher'), item('s4', 'school', 'admin', undefined, { archivedAt: '2026-10-02T00:00:00Z' }), item('c1', 'class', 'owner')];
    expect(adminSchoolIds(spaces)).toEqual(['s1', 's2']);
  });
});

describe('attentionDeployed', () => {
  it('is true once any teacher space carries a readable attention, false for an older Worker', () => {
    expect(attentionDeployed([item('c1', 'class', 'owner', att(0, 0))])).toBe(true);
    expect(attentionDeployed([item('c1', 'class', 'owner')])).toBe(false);
    expect(attentionDeployed([item('c1', 'class', 'owner', { relinks: 'x' })])).toBe(false);
    // A family's attention belongs to the parent persona (GX-5), not to this teacher read.
    expect(attentionDeployed([item('f1', 'family', 'owner', att(1, 0))])).toBe(false);
  });
});

describe('teacherAttention', () => {
  it('is null when no space carries attention (no count, no bar: never a guess)', () => {
    expect(teacherAttention({ spaces: [item('c1', 'class', 'owner')], schools: {}, movesShown: true })).toBeNull();
  });

  it('sums re-links and moves per class and over the persona; a family does not count', () => {
    const view = teacherAttention({
      spaces: [item('c1', 'class', 'owner', att(1, 2, at(8))), item('c2', 'class', 'teacher', att(0, 0)), item('f1', 'family', 'owner', att(4, 4))],
      schools: {},
      movesShown: true,
    });
    expect(view?.bySpace.c1).toEqual({ relinks: 1, moves: 2, all: 3, relinkExpiresAt: at(8) });
    expect(view?.bySpace.c2?.all).toBe(0);
    expect(view?.bySpace.f1).toBeUndefined();
    expect(view?.total).toBe(3);
    expect(view?.relinks).toBe(1);
  });

  it('counts re-links whatever CLASS_TRANSFER says; only the moves follow the flag', () => {
    const view = teacherAttention({ spaces: [item('c1', 'class', 'owner', att(1, 2, at(8)))], schools: {}, movesShown: false });
    expect(view?.bySpace.c1).toEqual({ relinks: 1, moves: 0, all: 1, relinkExpiresAt: at(8) });
    expect(view?.total).toBe(1);
  });

  it('merges a school admin\'s classes by space id: a class both taught and administered counts once', () => {
    const view = teacherAttention({
      spaces: [item('s1', 'school', 'admin', att(0, 0)), item('c1', 'class', 'teacher', att(1, 0, at(5)))],
      schools: {
        s1: [
          { spaceId: 'c1', relinks: 1, moves: 0, relinkExpiresAt: at(5) },
          { spaceId: 'c9', relinks: 0, moves: 2, relinkExpiresAt: null },
        ],
      },
      movesShown: true,
    });
    expect(Object.keys(view?.bySpace ?? {}).sort()).toEqual(['c1', 'c9', 's1']);
    expect(view?.total).toBe(3);
    expect(view?.schools.s1).toEqual(['c1', 'c9']);
  });

  it('reads a school\'s classes even when the list itself carries no attention (null school reads add nothing)', () => {
    const view = teacherAttention({ spaces: [item('s1', 'school', 'owner')], schools: { s1: [{ spaceId: 'c9', relinks: 1, moves: 0, relinkExpiresAt: at(3) }], s2: null }, movesShown: true });
    expect(view?.total).toBe(1);
    expect(view?.schools).toEqual({ s1: ['c9'] });
  });

  it('skips an archived space and names the spaces it knows from the list', () => {
    const view = teacherAttention({ spaces: [item('c1', 'class', 'owner', att(1, 0, at(2)), { archivedAt: '2026-10-02T00:00:00Z' }), item('c2', 'class', 'owner', att(0, 1))], schools: {}, movesShown: true });
    expect(view?.bySpace.c1).toBeUndefined();
    expect(view?.names.c2).toBe('Name c2');
    expect(view?.kinds.c2).toBe('class');
  });

  it('picks the soonest re-link for the bar; a space without an expiry comes last', () => {
    const view = teacherAttention({
      spaces: [item('c1', 'class', 'owner', att(1, 0, null)), item('c2', 'class', 'owner', att(2, 0, at(9))), item('c3', 'class', 'owner', att(1, 0, at(4)))],
      schools: {},
      movesShown: true,
    });
    expect(view?.relinks).toBe(4);
    expect(view?.soonestRelink).toEqual({ spaceId: 'c3', expiresAt: at(4) });
    const none = teacherAttention({ spaces: [item('c1', 'class', 'owner', att(0, 3))], schools: {}, movesShown: true });
    expect(none?.soonestRelink).toBeNull();
  });
});

describe('relinkBarView', () => {
  const base = { names: { c1: 'Sunday Class A' } as Record<string, string>, kinds: {} as Record<string, 'class' | 'school' | 'family'> };
  it('is null while no re-link waits', () => {
    expect(relinkBarView(null, NOW)).toBeNull();
    expect(relinkBarView({ ...base, relinks: 0, soonestRelink: null }, NOW)).toBeNull();
  });
  it('one re-link: the class name and the minutes left, rounded up, at least 1', () => {
    const view = relinkBarView({ ...base, relinks: 1, soonestRelink: { spaceId: 'c1', expiresAt: at(7.2) } }, NOW);
    expect(view).toEqual({ count: 1, spaceId: 'c1', name: 'Sunday Class A', minutes: 8, href: `${attentionHref('c1', 'class')}` });
    const late = relinkBarView({ ...base, relinks: 1, soonestRelink: { spaceId: 'c1', expiresAt: at(-1) } }, NOW);
    expect(late?.minutes).toBe(1);
    const unknown = relinkBarView({ ...base, relinks: 1, soonestRelink: { spaceId: 'c7', expiresAt: null } }, NOW);
    expect(unknown).toMatchObject({ name: null, minutes: null });
  });
  it('two or more: the count, and Review goes to the soonest one', () => {
    const view = relinkBarView({ ...base, relinks: 3, soonestRelink: { spaceId: 'c1', expiresAt: at(2) } }, NOW);
    expect(view).toMatchObject({ count: 3, spaceId: 'c1', minutes: 2 });
  });
});

describe('attentionHref', () => {
  it('opens the class page at its review, with an opaque id and no learner in the address', () => {
    expect(attentionHref('space:a', 'class')).toBe('/teach/space?id=space%3Aa#attention');
  });
});

describe('navCountText', () => {
  it('shows one or two digits and 99+ above', () => {
    expect(navCountText(1)).toBe('1');
    expect(navCountText(99)).toBe('99');
    expect(navCountText(100)).toBe('99+');
  });
});

describe('titleWithCount', () => {
  it('puts "(n) " in front while something waits, once, and takes it off at 0', () => {
    expect(titleWithCount('Classes · Hangul Route', 3)).toBe('(3) Classes · Hangul Route');
    expect(titleWithCount('(3) Classes · Hangul Route', 2)).toBe('(2) Classes · Hangul Route');
    expect(titleWithCount('(99+) Classes', 0)).toBe('Classes');
    expect(titleWithCount('Classes', 120)).toBe('(99+) Classes');
  });
});

/**
 * AMENDMENTS-GROWNUP-UX GX-5 (sections 5.5 and 7.4): the parent's count on the Home tab and the parent re-link bar on every
 * other parent page. The re-links and the family's answerable moves come from GX-W's `attention` of each family space
 * (the Worker counts a learner-side move only when `learnerRoute === 'caregiver'`); the class-scope part from the shipped
 * `classScope(familyId)` read. Counts and family names only.
 */
describe('attentionDeployed for the parent persona', () => {
  it('is true once a live family carries a readable attention; a class does not count for the parent', () => {
    expect(attentionDeployed([item('f1', 'family', 'owner', att(0, 0))], 'parent')).toBe(true);
    expect(attentionDeployed([item('f1', 'family', 'owner')], 'parent')).toBe(false);
    expect(attentionDeployed([item('c1', 'class', 'owner', att(1, 0))], 'parent')).toBe(false);
    expect(attentionDeployed([item('f1', 'family', 'owner', att(1, 0), { archivedAt: '2026-10-02T00:00:00Z' })], 'parent')).toBe(false);
  });
});

describe('scopeNeeded', () => {
  it('counts the learners with a class-scope update to read; an unread or failed read is null (adds nothing)', () => {
    expect(scopeNeeded({ current: 'v', learners: [{ learnerId: 'a', name: 'A', needed: true }, { learnerId: 'b', name: 'B', needed: false }, { learnerId: 'c', name: 'C', needed: true }] })).toBe(2);
    expect(scopeNeeded(null)).toBeNull();
  });
});

describe('parentAttention (section 7.4)', () => {
  it('is null when no family carries attention (an older Worker: no number, no bar)', () => {
    expect(parentAttention({ spaces: [item('f1', 'family', 'owner')], scope: { f1: 2 }, movesShown: true })).toBeNull();
  });

  it('per family: re-links + the moves the family can answer + the children with a class-scope update; classes do not count', () => {
    const view = parentAttention({
      spaces: [item('f1', 'family', 'owner', att(1, 2, at(6))), item('f2', 'family', 'caregiver', att(0, 0)), item('c1', 'class', 'owner', att(5, 5, at(1)))],
      scope: { f1: 1, f2: 1 },
      movesShown: true,
    });
    expect(view?.bySpace.f1).toEqual({ relinks: 1, moves: 2, all: 4, relinkExpiresAt: at(6) });
    expect(view?.bySpace.f2).toEqual({ relinks: 0, moves: 0, all: 1, relinkExpiresAt: null });
    expect(view?.bySpace.c1).toBeUndefined();
    expect(view?.total).toBe(5);
    expect(view?.relinks).toBe(1);
    expect(view?.kinds.f1).toBe('family');
    expect(view?.names.f1).toBe('Name f1');
    expect(view?.soonestRelink).toEqual({ spaceId: 'f1', expiresAt: at(6) });
  });

  it('the moves follow CLASS_TRANSFER; the re-links and the class-scope part do not', () => {
    const view = parentAttention({ spaces: [item('f1', 'family', 'owner', att(1, 2, at(6)))], scope: { f1: 1 }, movesShown: false });
    expect(view?.bySpace.f1).toEqual({ relinks: 1, moves: 0, all: 2, relinkExpiresAt: at(6) });
    expect(view?.total).toBe(2);
  });

  it('a class-scope read not made or failed adds nothing; an archived family asks nothing', () => {
    const view = parentAttention({
      spaces: [item('f1', 'family', 'owner', att(0, 1)), item('f9', 'family', 'owner', att(3, 3, at(2)), { archivedAt: '2026-10-02T00:00:00Z' })],
      scope: { f1: null },
      movesShown: true,
    });
    expect(view?.total).toBe(1);
    expect(view?.bySpace.f9).toBeUndefined();
    expect(view?.relinks).toBe(0);
    expect(view?.soonestRelink).toBeNull();
  });

  it('picks the family whose re-link closes first for the bar', () => {
    const view = parentAttention({ spaces: [item('f1', 'family', 'owner', att(1, 0, at(9))), item('f2', 'family', 'owner', att(1, 0, at(3)))], scope: {}, movesShown: true });
    expect(view?.relinks).toBe(2);
    expect(view?.soonestRelink).toEqual({ spaceId: 'f2', expiresAt: at(3) });
  });
});

describe('relinkBarView for a family (section 5.5)', () => {
  it('Review goes to the family home, where the pop-up and the strip answer it; no id, no name in the address', () => {
    const view = relinkBarView({ names: { f1: 'Kim family' }, kinds: { f1: 'family' }, relinks: 1, soonestRelink: { spaceId: 'f1', expiresAt: at(4) } }, NOW);
    expect(view).toEqual({ count: 1, spaceId: 'f1', name: 'Kim family', minutes: 4, href: '/parent' });
  });
});
