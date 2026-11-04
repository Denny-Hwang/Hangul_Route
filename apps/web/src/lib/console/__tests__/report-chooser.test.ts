import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { RosterLearner, SpaceListItem } from '../api';
import { parentChooserFamilies, parentChooserRows } from '../report-chooser';

/**
 * F-REPORT-001 RP-7c, section 3.1 (design `learner-report.md`, States: parent chooser): `/parent/learner` without a
 * learner lists the learners of the account's family spaces, the family home's order (families as the home shows them,
 * learners in join order), never by a figure; one row opens that learner's report (week, `from=nav`).
 */
function item(id: string, kind: SpaceListItem['space']['kind'], role: SpaceListItem['role'], over: Partial<SpaceListItem['space']> = {}): SpaceListItem {
  return {
    space: { id, kind, name: `${id} name`, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-10-01T00:00:00Z', ...over },
    role,
    counts: { learners: 1, accounts: 1, classes: 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
  };
}

function learner(id: string, joinedAt: string, minutes = 0): RosterLearner {
  return {
    id,
    displayName: `Name ${id}`,
    ageGroup: '5-7',
    avatar: `avatar-${id}`,
    joinedAt,
    lastActiveAt: '2026-10-10T00:00:00Z',
    lastSyncedAt: null,
    summary: { lastActiveAt: '2026-10-10T00:00:00Z', minutesLast7d: minutes } as RosterLearner['summary'],
  } as RosterLearner;
}

const NOW = new Date('2026-10-31T12:00:00Z');

describe('parentChooserFamilies', () => {
  it('reads the family spaces held as owner or caregiver, live first, each oldest first; never a class or a student role', () => {
    const spaces = [
      item('sp_c', 'class', 'owner'),
      item('sp_b', 'family', 'caregiver', { createdAt: '2026-10-02T00:00:00Z' }),
      item('sp_old', 'family', 'owner', { createdAt: '2026-09-01T00:00:00Z', archivedAt: '2026-10-05T00:00:00Z' }),
      item('sp_a', 'family', 'owner', { createdAt: '2026-09-15T00:00:00Z' }),
      item('sp_s', 'family', 'student'),
    ];
    expect(parentChooserFamilies(spaces).map((s) => s.space.id)).toEqual(['sp_a', 'sp_b', 'sp_old']);
    expect(parentChooserFamilies([item('sp_c', 'class', 'teacher')])).toEqual([]);
  });
});

describe('parentChooserRows', () => {
  it('one row per learner, families in home order, learners in join order whatever their minutes; ids only in the link', () => {
    const families = parentChooserFamilies([item('sp:b', 'family', 'owner', { createdAt: '2026-10-02T00:00:00Z' }), item('sp:a', 'family', 'owner')]);
    const rosters = new Map<string, readonly RosterLearner[]>([
      ['sp:a', [learner('profile:2', '2026-10-03T00:00:00Z', 90), learner('profile:1', '2026-10-01T00:00:00Z', 0)]],
      ['sp:b', [learner('profile:3', '2026-10-02T00:00:00Z', 5)]],
    ]);
    const minutes = (n: number) => getMessages('en').console.parentHome.minutes7d(n);
    expect(parentChooserRows(families, rosters, NOW)).toEqual([
      { key: 'sp:a/profile:1', href: '/parent/learner?id=sp%3Aa&learner=profile%3A1&period=week&from=nav', name: 'Name profile:1', avatar: 'avatar-profile:1', line: minutes(0) },
      { key: 'sp:a/profile:2', href: '/parent/learner?id=sp%3Aa&learner=profile%3A2&period=week&from=nav', name: 'Name profile:2', avatar: 'avatar-profile:2', line: minutes(90) },
      { key: 'sp:b/profile:3', href: '/parent/learner?id=sp%3Ab&learner=profile%3A3&period=week&from=nav', name: 'Name profile:3', avatar: 'avatar-profile:3', line: minutes(5) },
    ]);
  });

  it('a family whose roster did not load draws no rows; no family draws none', () => {
    const families = parentChooserFamilies([item('sp:a', 'family', 'owner'), item('sp:b', 'family', 'caregiver')]);
    expect(parentChooserRows(families, new Map([['sp:b', [learner('profile:3', '2026-10-02T00:00:00Z')]]]), NOW).map((r) => r.key)).toEqual(['sp:b/profile:3']);
    expect(parentChooserRows([], new Map(), NOW)).toEqual([]);
  });
});

describe("parentChooserRows: the child card's first line under each name (AMENDMENTS-GROWNUP-UX GX-11, P10)", () => {
  const families = parentChooserFamilies([item('sp:a', 'family', 'owner')]);
  const activity = {
    v: 1,
    tz: 0,
    asOf: '2026-10-31',
    days: [
      { d: '2026-10-29', min: 20, q: 1, c: 0, w: 0, j: [] },
      { d: '2026-10-30', min: 16, q: 0, c: 0, w: 0, j: [] },
    ],
    months: [],
    total: { since: '2026-10-01', min: 90, q: 3, c: 1, w: 0, days: 6 },
    milestones: [],
  };
  const practiced = { ...learner('profile:1', '2026-10-01T00:00:00Z'), summary: { lastActiveAt: '2026-10-30T08:00:00Z', minutesLast7d: 36, activity } as unknown as RosterLearner['summary'] };
  const never = { ...learner('profile:2', '2026-10-02T00:00:00Z'), summary: null };

  it('the week line for a child who practiced and "Not started yet" for one who never did, in join order, in each locale', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const p = getMessages(locale).console.parentHome;
      const rows = parentChooserRows(families, new Map([['sp:a', [never, practiced]]]), NOW, locale);
      expect(rows.map((row) => [row.key, row.line])).toEqual([
        ['sp:a/profile:1', p.week(2, 36)],
        ['sp:a/profile:2', p.lastActive.notStarted],
      ]);
    }
  });
});
