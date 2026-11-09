import { describe, expect, it } from 'vitest';
import { classReportBodyOf, planCardsOf, reportBodyOf, reportSummaryOf, rosterOf, schoolPageOf, spaceItemsOf } from '../account-data';

/**
 * F-AUTH-004 sections 8.1, 8.2, 8.5 and 8.7 (row NS-5): the native homes read the Worker's answers leniently, item by
 * item, and keep only what a home draws (never a plan's actions, receipts or payer, never an avatar).
 */

const space = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  space: { id: 'space:a', kind: 'family', name: 'Kim family', createdAt: '2026-01-01T00:00:00.000Z', archivedAt: null, settings: {}, parentSpaceId: null, ...over },
  role: 'owner',
  counts: { learners: 2, accounts: 1, classes: 0 },
  joinCode: 'K7MPQ4',
  joinCodeExpiresAt: '2026-12-01T00:00:00.000Z',
});

describe('spaceItemsOf (GET /api/spaces)', () => {
  it('reads the fields a home draws, and nothing else', () => {
    expect(spaceItemsOf({ spaces: [space()] })).toEqual([
      {
        space: { id: 'space:a', kind: 'family', name: 'Kim family', createdAt: '2026-01-01T00:00:00.000Z', archivedAt: null },
        role: 'owner',
        counts: { learners: 2 },
        joinCode: 'K7MPQ4',
        attention: null,
      },
    ]);
  });

  it('row NS-6: attention is one count (re-links and moves), or null when absent or unreadable (never zero)', () => {
    const read = (attention: unknown): number | null | undefined => spaceItemsOf({ spaces: [{ ...space(), attention }] })?.[0]?.attention;
    expect(read({ relinks: 2, moves: 1, relinkExpiresAt: null })).toBe(3);
    expect(read({ relinks: 0, moves: 0, relinkExpiresAt: null })).toBe(0);
    expect(read(undefined)).toBeNull();
    expect(read({ relinks: -1, moves: 0, relinkExpiresAt: null })).toBeNull();
    expect(read('2')).toBeNull();
  });

  it('drops an item it cannot read (unknown kind or role, missing fields), keeps the rest', () => {
    const items = spaceItemsOf({
      spaces: [
        space({ kind: 'guild' }),
        { ...space(), role: 'boss' },
        space({ id: '' }),
        space({ name: 3 }),
        space({ createdAt: null }),
        space({ archivedAt: 5 }),
        { role: 'owner' },
        'nope',
        space({ id: 'space:b' }),
      ],
    });
    expect(items?.map((item) => item.space.id)).toEqual(['space:b']);
  });

  it('a code that is not a join code is no code; counts default to 0', () => {
    const [item] = spaceItemsOf({ spaces: [{ ...space(), joinCode: 'lower1', counts: undefined }] }) ?? [];
    expect(item?.joinCode).toBeNull();
    expect(item?.counts).toEqual({ learners: 0 });
    const [odd] = spaceItemsOf({ spaces: [{ ...space(), counts: { learners: -3 } }] }) ?? [];
    expect(odd?.counts.learners).toBe(0);
  });

  it('an answer of another shape is null', () => {
    expect(spaceItemsOf(null)).toBeNull();
    expect(spaceItemsOf({ spaces: 'x' })).toBeNull();
    expect(spaceItemsOf([])).toBeNull();
  });
});

describe('rosterOf (GET /api/spaces/:id/roster)', () => {
  const learner = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 'profile:mina',
    displayName: 'Mina',
    ageGroup: 'child',
    avatar: 'tiger',
    joinedAt: '2026-02-01T00:00:00.000Z',
    lastActiveAt: '2026-11-08T10:00:00.000Z',
    summary: { minutesLast7d: 34, lastActiveAt: '2026-11-08T10:00:00.000Z' },
    ...over,
  });

  it('reads each learner (no avatar, no age group) and the code', () => {
    expect(rosterOf({ learners: [learner()], joinCode: 'K7MPQ4' })).toEqual({
      space: null,
      learners: [{ id: 'profile:mina', displayName: 'Mina', joinedAt: '2026-02-01T00:00:00.000Z', lastActiveAt: '2026-11-08T10:00:00.000Z', summary: { minutesLast7d: 34, lastActiveAt: '2026-11-08T10:00:00.000Z' } }],
      joinCode: 'K7MPQ4',
    });
  });

  it('drops a learner it cannot read; a missing last-active is empty; a summary that is not an object is none', () => {
    const roster = rosterOf({ learners: [learner({ id: 3 }), learner({ displayName: null }), learner({ joinedAt: undefined }), 'x', learner({ id: 'profile:jun', lastActiveAt: null, summary: 'nope' })], joinCode: null });
    expect(roster?.learners).toEqual([{ id: 'profile:jun', displayName: 'Mina', joinedAt: '2026-02-01T00:00:00.000Z', lastActiveAt: '', summary: null }]);
    expect(roster?.joinCode).toBeNull();
  });

  it('an answer of another shape is null', () => {
    expect(rosterOf({})).toBeNull();
    expect(rosterOf(undefined)).toBeNull();
  });
});

describe('reportSummaryOf (the console reader)', () => {
  it('keeps the keys it can read, drops the rest, and filters plan rows one by one', () => {
    const summary = reportSummaryOf({
      minutesLast7d: 12,
      streakDays: 'many',
      cardsUnlocked: 3,
      unknownKey: true,
      planProgress: { 'plan:a': { done: 1, total: 2, notReady: 0 }, 'plan:b': { done: 'x' } },
    });
    expect(summary).toEqual({ minutesLast7d: 12, cardsUnlocked: 3, planProgress: { 'plan:a': { done: 1, total: 2, notReady: 0 } } });
  });

  it('a plan progress that is not an object goes through its own check (dropped)', () => {
    expect(reportSummaryOf({ planProgress: 'x' })).toEqual({});
  });

  it('a value that is not an object is null', () => {
    expect(reportSummaryOf(null)).toBeNull();
    expect(reportSummaryOf([1])).toBeNull();
  });
});

describe('planCardsOf (GET /api/billing/summary?view=status)', () => {
  const card = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    spaceId: 'space:a',
    kind: 'family',
    name: 'Kim family',
    role: 'owner',
    archived: false,
    payer: true,
    readOnlyReason: null,
    coverage: { state: 'own', planKey: 'family_lifetime', status: 'active', expiresAt: null, statusSince: '2026-01-01T00:00:00.000Z', endsAtPeriodEnd: false },
    usage: { learners: 2, learnerCap: 6, teachers: null, teacherCap: null },
    actions: { buy: 'family_lifetime', manage: true, contact: true },
    receipts: [],
    hasReceipts: false,
    legacyNoHistory: false,
    ...over,
  });

  it('keeps kind, coverage and usage only, by space id', () => {
    const cards = planCardsOf({ mode: 'none', purchasesOpen: false, cards: [card()], account: [] });
    expect([...cards.entries()]).toEqual([
      [
        'space:a',
        {
          kind: 'family',
          coverage: { state: 'own', planKey: 'family_lifetime', status: 'active', expiresAt: null, statusSince: '2026-01-01T00:00:00.000Z', endsAtPeriodEnd: false },
          usage: { learners: 2, learnerCap: 6, teachers: null, teacherCap: null },
        },
      ],
    ]);
    expect(Object.keys(cards.get('space:a') ?? {}).sort()).toEqual(['coverage', 'kind', 'usage']);
  });

  it('no usage is null; a card it cannot read is dropped', () => {
    const cards = planCardsOf({
      cards: [card({ spaceId: 'space:b', usage: null }), card({ spaceId: 'space:c', usage: undefined }), card({ spaceId: 'space:d', coverage: { state: 'gold' } }), card({ spaceId: 'space:e', kind: 'guild' }), card({ spaceId: 'space:f', usage: { learners: 'x' } }), card({ spaceId: 4 }), 'x'],
    });
    expect([...cards.keys()]).toEqual(['space:b', 'space:c']);
    expect(cards.get('space:b')?.usage).toBeNull();
  });

  it('an answer of another shape is an empty map', () => {
    expect(planCardsOf(null).size).toBe(0);
    expect(planCardsOf({ cards: 'x' }).size).toBe(0);
  });
});

describe('reportBodyOf (GET /api/spaces/:id/learners/:learnerId/report)', () => {
  const body = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    space: { id: 'space:a', kind: 'family', name: 'Kim family', archivedAt: null, settings: {}, parentSpaceId: null, createdAt: '2026-01-01T00:00:00.000Z' },
    learner: { id: 'profile:mina', displayName: 'Mina', avatar: 'tiger', joinedAt: '2026-02-01T00:00:00.000Z', lastActiveAt: '' },
    summary: { minutesLast7d: 5 },
    lastSyncedAt: '2026-11-08T10:00:00.000Z',
    serverTime: '2026-11-08T12:00:00.000Z',
    ...over,
  });

  it('reads the envelope and the summary as the console does', () => {
    expect(reportBodyOf(body())).toEqual({
      space: { id: 'space:a', kind: 'family', name: 'Kim family', archivedAt: null },
      learner: { id: 'profile:mina', displayName: 'Mina' },
      summary: { minutesLast7d: 5 },
      lastSyncedAt: '2026-11-08T10:00:00.000Z',
    });
  });

  it('no summary on the server is null (the no-data state); no last sync is null', () => {
    expect(reportBodyOf(body({ summary: null, lastSyncedAt: undefined }))).toMatchObject({ summary: null, lastSyncedAt: null });
    expect(reportBodyOf(body({ summary: undefined }))?.summary).toBeNull();
  });

  it('a body it cannot read is null', () => {
    expect(reportBodyOf(null)).toBeNull();
    expect(reportBodyOf(body({ space: null }))).toBeNull();
    expect(reportBodyOf(body({ space: { id: 'space:a', kind: 'guild', name: 'x', archivedAt: null } }))).toBeNull();
    expect(reportBodyOf(body({ space: { id: 1, kind: 'family', name: 'x', archivedAt: null } }))).toBeNull();
    expect(reportBodyOf(body({ space: { id: 'a', kind: 'family', name: 2, archivedAt: null } }))).toBeNull();
    expect(reportBodyOf(body({ space: { id: 'a', kind: 'family', name: 'x', archivedAt: 3 } }))).toBeNull();
    expect(reportBodyOf(body({ learner: { id: 'p', displayName: 3 } }))).toBeNull();
    expect(reportBodyOf(body({ learner: { id: 4, displayName: 'x' } }))).toBeNull();
    expect(reportBodyOf(body({ lastSyncedAt: 5 }))).toBeNull();
    expect(reportBodyOf(body({ summary: 'x' }))).toBeNull();
  });
});

describe('row NS-6: the roster names its space', () => {
  it('its id, kind, name and archived time; nothing else; null when unreadable', () => {
    const space = { id: 'space:c', kind: 'class', name: 'Saturday class 3B', archivedAt: null, settings: { x: 1 }, parentSpaceId: 'space:s', createdAt: '2026-01-01T00:00:00.000Z' };
    expect(rosterOf({ space, learners: [], joinCode: null })?.space).toEqual({ id: 'space:c', kind: 'class', name: 'Saturday class 3B', archivedAt: null });
    expect(rosterOf({ space: { ...space, archivedAt: undefined }, learners: [] })?.space?.archivedAt).toBeNull();
    for (const bad of [{ ...space, kind: 'guild' }, { ...space, id: '' }, { ...space, name: 1 }, { ...space, archivedAt: 3 }, 'x', null]) expect(rosterOf({ space: bad, learners: [] })?.space).toBeNull();
  });
});

describe('row NS-6: schoolPageOf (GET /api/spaces/:id/school)', () => {
  const cls = (id: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
    space: { id, kind: 'class', name: id, parentSpaceId: 'space:s', settings: {}, archivedAt: null, createdAt: '2026-01-01T00:00:00.000Z', ...over },
    teacher: { accountId: 'acct:1', name: 'Ms Lee' },
    students: 24,
    practiced: 18,
    lastActiveAt: '2026-11-08T10:00:00.000Z',
    hasPublishedPlan: true,
    canRename: true,
    openMoves: false,
  });
  const answer = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    school: { id: 'space:s', kind: 'school', name: 'Maple Heritage School', parentSpaceId: null, settings: {}, archivedAt: null, createdAt: '2025-01-01T00:00:00.000Z' },
    invite: { joinCode: 'K7MPQ4', joinCodeExpiresAt: '2026-12-01T00:00:00.000Z' },
    license: { planKey: 'school_seat', status: 'active', seats: 20, expiresAt: '2027-01-31T00:00:00.000Z', updatedAt: 'x', active: true, subjectName: 'Maple' },
    limits: { licensed: true, students: 500, teachers: 20 },
    canRename: true,
    usage: { students: 42, teachers: 6 },
    thisWeek: { students: 42, practiced: 30, classes: 2, classesWithPlan: 1 },
    classes: [cls('space:c1'), cls('space:c2', { archivedAt: '2026-01-01T00:00:00.000Z' })],
    ...over,
  });

  it('keeps the name, the classes (name and learner count) and the teacher count: never a teacher name, the licence or the invite', () => {
    const page = schoolPageOf(answer());
    expect(page).toEqual({
      school: { id: 'space:s', kind: 'school', name: 'Maple Heritage School', archivedAt: null },
      classes: [
        { space: { id: 'space:c1', name: 'space:c1', createdAt: '2026-01-01T00:00:00.000Z', archivedAt: null }, students: 24 },
        { space: { id: 'space:c2', name: 'space:c2', createdAt: '2026-01-01T00:00:00.000Z', archivedAt: '2026-01-01T00:00:00.000Z' }, students: 24 },
      ],
      teachers: 6,
    });
    expect(JSON.stringify(page)).not.toMatch(/Ms Lee|K7MPQ4|school_seat|2027|seats/);
  });

  it('drops a class it cannot read; an unreadable teacher count is none; a count below 0 reads 0', () => {
    const page = schoolPageOf(answer({ usage: { teachers: -1 }, classes: [cls('', {}), cls('space:x', { kind: 'family' }), { space: 'x' }, 'x', { ...cls('space:ok'), students: -2 }, cls('space:noarch', { archivedAt: undefined })] }));
    expect(page?.classes.map((row) => [row.space.id, row.students, row.space.archivedAt])).toEqual([
      ['space:ok', 0, null],
      ['space:noarch', 24, null],
    ]);
    expect(page?.teachers).toBeNull();
    expect(schoolPageOf(answer({ usage: null }))?.teachers).toBeNull();
    expect(schoolPageOf(answer({ usage: { teachers: 1.5 } }))?.teachers).toBeNull();
  });

  it('an answer of another shape, or not a school, is null', () => {
    expect(schoolPageOf(null)).toBeNull();
    expect(schoolPageOf(answer({ classes: 'x' }))).toBeNull();
    expect(schoolPageOf(answer({ school: { id: 'space:c', kind: 'class', name: 'c', archivedAt: null } }))).toBeNull();
    expect(schoolPageOf(answer({ school: null }))).toBeNull();
  });
});

describe('row NS-6: classReportBodyOf (GET /api/spaces/:id/class-report)', () => {
  const report = {
    v: 1,
    period: 'week',
    headline: { code: 'class_practiced', practiced: 2, learners: 3 },
    class: { learners: 3, withActivity: 3, olderApp: 0, notSaved7d: 0 },
    wentWell: { lettersNew: [], questsNew: { count: 1 }, cardsNew: 0, milestones: [] },
    revisit: [],
    practice: { dayBands: [{ band: '0', learners: 1 }, { band: '1-2', learners: 2 }, { band: '3-4', learners: 0 }, { band: '5-7', learners: 0 }], notSaved: 0 },
    time: { minutesTotal: { count: 40 }, minutesMedian: null },
    levelCheck: [],
    plans: [],
  };
  const body = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    space: { id: 'space:c', kind: 'class', name: 'Saturday class 3B', archivedAt: null, settings: {}, parentSpaceId: null, createdAt: 'x' },
    period: 'week',
    at: '2026-11-01',
    serverTime: '2026-11-08T12:00:00.000Z',
    report,
    ...over,
  });

  it('reads the envelope and the whole class report (aggregates only)', () => {
    expect(classReportBodyOf(body())).toEqual({ space: { id: 'space:c', kind: 'class', name: 'Saturday class 3B', archivedAt: null }, period: 'week', at: '2026-11-01', report });
  });

  it('a window that is not a day key is the current one', () => {
    expect(classReportBodyOf(body({ at: 'soon' }))?.at).toBeNull();
    expect(classReportBodyOf(body({ at: undefined }))?.at).toBeNull();
  });

  it('a body it cannot read is null (space, period or report)', () => {
    expect(classReportBodyOf('x')).toBeNull();
    expect(classReportBodyOf(body({ space: null }))).toBeNull();
    expect(classReportBodyOf(body({ period: 'year' }))).toBeNull();
    expect(classReportBodyOf(body({ report: { ...report, v: 2 } }))).toBeNull();
  });
});
