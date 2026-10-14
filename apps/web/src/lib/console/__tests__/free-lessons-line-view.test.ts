import { CATALOG, type CurriculumMeta, type PlanItem } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { PlanView, RosterLearner } from '../api';
import { horizonAnchor, rosterFreeLessonsLine, type RosterFreeLineInput } from '../free-lessons-line-view';
import { livePublished } from '../plans';
import { ROUTES } from '../routing';

/**
 * F-ENT-003 section 3.9.2 (E3-12; wireframe console/free-lessons-line A): the roster card of a
 * family or a class shows `plan-waiting` only to the space owner who can see the space is
 * uncovered, with the console's free-plan switch on, when a live plan of this space that reaches
 * the learner has every derived item done (`done === total > 0`, `notReady > 0`), holds lessons
 * that open with a paid plan, and has no open item ahead of its horizon. Anything else shows
 * nothing: the console never guesses.
 */
const words = getMessages('en').console.access;
const TODAY = '2026-10-18';

const quest = (id: string, targetDate?: string): PlanItem => ({ kind: 'quest', id, ...(targetDate ? { targetDate } : {}) });
/** A Stage 1 plan with three lessons that open with a paid plan (Stage 2 life and nature, Stage 4 rites). */
const ITEMS = [quest('quest:stage1-letters-q1'), quest('quest:stage1-letters-q2'), quest('quest:stage2-life-q1'), quest('quest:stage2-nature-q1'), quest('quest:stage4-rites-q1')];

const plan = (id: string, over: Partial<PlanView> = {}): PlanView => ({
  id,
  spaceId: 'space:c1',
  authorAccountId: 'teacher-kim',
  title: 'Week three',
  items: ITEMS,
  targetLearnerIds: null,
  publishedAt: '2026-10-10T09:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-10-09T09:00:00.000Z',
  updatedAt: '2026-10-10T09:00:00.000Z',
  ...over,
});

type Progress = Record<string, { done: number; total: number; notReady: number }>;
/** A learner whose device last derived and synced on `day` (the summary's `lastActiveAt` and the row's `lastSyncedAt`). */
const learner = (planProgress: Progress | null, day: string | null = TODAY, synced: string | null = day): Pick<RosterLearner, 'id' | 'displayName' | 'summary' | 'lastSyncedAt'> => ({
  id: 'l:1',
  displayName: 'Mina',
  summary: planProgress === null ? null : ({ planProgress, ...(day ? { lastActiveAt: `${day}T10:00:00.000Z` } : {}) } as unknown as RosterLearner['summary']),
  lastSyncedAt: synced ? `${synced}T10:05:00.000Z` : null,
});

const input = (over: Partial<RosterFreeLineInput> = {}): RosterFreeLineInput => ({
  gating: true,
  role: 'owner',
  coverage: 'uncovered',
  spaceKind: 'class',
  learner: learner({ 'plan:1': { done: 2, total: 2, notReady: 3 } }),
  plans: [plan('plan:1')],
  today: TODAY,
  ...over,
});

describe('rosterFreeLessonsLine: the plan-waiting line on a roster card', () => {
  it('shows for the owner of an uncovered class with the switch on, with Open billing', () => {
    expect(rosterFreeLessonsLine(input(), 'en')).toEqual({
      text: 'Mina finished everything open in this plan. 3 more lessons open with a Group License.',
      billing: { label: words.openBilling.cta, href: ROUTES.billing },
    });
    expect(ROUTES.billing).toBe('/account/billing');
  });

  it('names the Family Plan on a family card', () => {
    expect(rosterFreeLessonsLine(input({ spaceKind: 'family' }), 'en')?.text).toBe(words.planWaiting('Mina', 3, words.product.family));
  });

  it('never shows to a teacher or a co-caregiver who does not own the space, or while the role is unknown', () => {
    for (const role of ['teacher', 'caregiver', 'admin', 'student', null] as const) expect(rosterFreeLessonsLine(input({ role }), 'en'), String(role)).toBeNull();
  });

  it('never shows with the switch off, for a covered space, or while coverage is unknown to this viewer', () => {
    expect(rosterFreeLessonsLine(input({ gating: false }), 'en')).toBeNull();
    expect(rosterFreeLessonsLine(input({ coverage: 'covered' }), 'en')).toBeNull();
    expect(rosterFreeLessonsLine(input({ coverage: 'unknown' }), 'en')).toBeNull();
  });

  it('needs done === total > 0 and notReady > 0', () => {
    expect(rosterFreeLessonsLine(input({ learner: learner({ 'plan:1': { done: 2, total: 2, notReady: 0 } }) }), 'en')).toBeNull();
    expect(rosterFreeLessonsLine(input({ learner: learner({ 'plan:1': { done: 1, total: 2, notReady: 3 } }) }), 'en')).toBeNull();
    expect(rosterFreeLessonsLine(input({ learner: learner({ 'plan:1': { done: 0, total: 0, notReady: 3 } }) }), 'en')).toBeNull();
  });

  it('counts the plan\'s closed lessons, never unreleased items, and shows nothing when only those were skipped', () => {
    const withSoon = plan('plan:1', { items: [...ITEMS, { kind: 'episode', id: 'episode:stage7-crafts' }, { kind: 'episode', id: 'episode:stage7-nature' }] });
    expect(rosterFreeLessonsLine(input({ plans: [withSoon], learner: learner({ 'plan:1': { done: 2, total: 2, notReady: 5 } }) }), 'en')?.text).toBe(words.planWaiting('Mina', 3, words.product.class));
    const onlySoon = plan('plan:1', { items: [quest('quest:stage1-letters-q1'), { kind: 'episode', id: 'episode:stage7-crafts' }] });
    expect(rosterFreeLessonsLine(input({ plans: [onlySoon], learner: learner({ 'plan:1': { done: 1, total: 1, notReady: 1 } }) }), 'en')).toBeNull();
  });

  it('waits while a curriculum still holds open lessons past its horizon', () => {
    const meta = { horizonDays: 7 } as unknown as CurriculumMeta;
    const ahead = plan('plan:1', { meta, items: [quest('quest:stage1-letters-q1', '2026-10-20'), quest('quest:stage2-life-q1', '2026-10-22'), quest('quest:stage1-life-q1', '2026-11-20')] });
    expect(rosterFreeLessonsLine(input({ plans: [ahead], learner: learner({ 'plan:1': { done: 1, total: 1, notReady: 1 } }) }), 'en')).toBeNull();
    // The same plan once the last open lesson is inside the horizon (the device's day - 1 + 7 days).
    expect(rosterFreeLessonsLine(input({ plans: [ahead], today: '2026-11-14', learner: learner({ 'plan:1': { done: 2, total: 2, notReady: 1 } }, '2026-11-14') }), 'en')?.text).toBe(
      words.planWaiting('Mina', 1, words.product.class),
    );
  });

  it('measures a curriculum\'s horizon from the device\'s last derivation, not the console\'s today (a stale summary never shows the line)', () => {
    const meta = { horizonDays: 7 } as unknown as CurriculumMeta;
    // Synced on Oct 10 with everything derived done; an open Stage 1 lesson dated Oct 19 was past that device's horizon.
    const stale = plan('plan:1', { meta, items: [quest('quest:stage1-letters-q1', '2026-10-08'), quest('quest:stage2-life-q1', '2026-10-09'), quest('quest:stage1-life-q1', '2026-10-19')] });
    const row = { 'plan:1': { done: 1, total: 1, notReady: 1 } };
    expect(rosterFreeLessonsLine(input({ plans: [stale], today: '2026-10-15', learner: learner(row, '2026-10-10') }), 'en')).toBeNull();
    // Three weeks stale, an open lesson dated today + 3: still nothing.
    expect(rosterFreeLessonsLine(input({ plans: [stale], today: '2026-10-31', learner: learner(row, '2026-10-10') }), 'en')).toBeNull();
    // A fresh sync on Oct 15 derived through Oct 21 (one day of slack): the Oct 19 lesson was derived, so the counts say it is done.
    expect(rosterFreeLessonsLine(input({ plans: [stale], today: '2026-10-15', learner: learner({ 'plan:1': { done: 2, total: 2, notReady: 1 } }, '2026-10-15') }), 'en')?.text).toBe(
      words.planWaiting('Mina', 1, words.product.class),
    );
    // A sync later than the last activity: the earlier date wins.
    expect(rosterFreeLessonsLine(input({ plans: [stale], today: '2026-10-15', learner: learner(row, '2026-10-10', '2026-10-15') }), 'en')).toBeNull();
  });

  it('shows no curriculum line without a known derivation day; a classic plan needs none', () => {
    const meta = { horizonDays: 7 } as unknown as CurriculumMeta;
    const row = { 'plan:1': { done: 2, total: 2, notReady: 3 } };
    expect(rosterFreeLessonsLine(input({ plans: [plan('plan:1', { meta })], learner: learner(row, null) }), 'en')).toBeNull();
    expect(rosterFreeLessonsLine(input({ plans: [plan('plan:1')], learner: learner(row, null) }), 'en')).not.toBeNull();
  });

  it('never shows when the device skipped fewer items than the closed lessons it derived (they were open for this learner)', () => {
    // Premium through another space: the three closed lessons were open and done; one unreleased episode was skipped.
    const withSoon = plan('plan:1', { items: [...ITEMS, { kind: 'episode', id: 'episode:stage7-crafts' }] });
    expect(rosterFreeLessonsLine(input({ plans: [withSoon], learner: learner({ 'plan:1': { done: 5, total: 5, notReady: 1 } }) }), 'en')).toBeNull();
    expect(rosterFreeLessonsLine(input({ plans: [withSoon], learner: learner({ 'plan:1': { done: 2, total: 2, notReady: 4 } }) }), 'en')?.text).toBe(words.planWaiting('Mina', 3, words.product.class));
  });

  it('shows nothing for a learner who has not synced, or a plan the device has not reported yet', () => {
    expect(rosterFreeLessonsLine(input({ learner: learner(null) }), 'en')).toBeNull();
    expect(rosterFreeLessonsLine(input({ learner: learner({}) }), 'en')).toBeNull();
    // Progress of a plan the space no longer lists is never read.
    expect(rosterFreeLessonsLine(input({ plans: [plan('plan:9')] }), 'en')).toBeNull();
  });

  it('reads only plans that reach the learner', () => {
    expect(rosterFreeLessonsLine(input({ plans: [plan('plan:1', { targetLearnerIds: ['l:2'] })] }), 'en')).toBeNull();
    expect(rosterFreeLessonsLine(input({ plans: [plan('plan:1', { targetLearnerIds: ['l:1'] })] }), 'en')).not.toBeNull();
  });

  it('takes the first live plan that qualifies, newest published first', () => {
    const progress = learner({
      'plan:old': { done: 4, total: 4, notReady: 1 },
      'plan:new': { done: 2, total: 2, notReady: 5 },
      'plan:open': { done: 1, total: 6, notReady: 2 },
    });
    const plans = livePublished([
      plan('plan:old', { publishedAt: '2026-09-01T09:00:00.000Z', items: [quest('quest:stage2-life-q1')] }),
      plan('plan:open', { publishedAt: '2026-10-11T09:00:00.000Z' }),
      plan('plan:new', { publishedAt: '2026-10-05T09:00:00.000Z' }),
      plan('plan:draft', { publishedAt: null }),
      plan('plan:gone', { archivedAt: '2026-10-11T09:00:00.000Z' }),
    ]);
    expect(plans.map((p) => p.id)).toEqual(['plan:open', 'plan:new', 'plan:old']);
    expect(rosterFreeLessonsLine(input({ learner: progress, plans }), 'en')?.text).toBe(words.planWaiting('Mina', 3, words.product.class));
  });

  it('horizonAnchor: the earliest of today, the last activity and the last sync, one day earlier; null without either date', () => {
    expect(horizonAnchor({ today: '2026-10-18', learner: learner({}, '2026-10-10', '2026-10-12') })).toBe('2026-10-09');
    expect(horizonAnchor({ today: '2026-10-18', learner: learner({}, '2026-10-12', '2026-10-10') })).toBe('2026-10-09');
    expect(horizonAnchor({ today: '2026-10-18', learner: learner({}, null, '2026-10-12') })).toBe('2026-10-11');
    // A clock ahead on the device never moves the start past the console's today.
    expect(horizonAnchor({ today: '2026-10-18', learner: learner({}, '2026-10-25') })).toBe('2026-10-17');
    expect(horizonAnchor({ today: '2026-10-18', learner: learner(null, null) })).toBeNull();
    expect(horizonAnchor({ today: '2026-10-18', learner: { ...learner({}, null), summary: { lastActiveAt: 'not a date' } as unknown as RosterLearner['summary'] } })).toBeNull();
  });

  it('reads the catalogue it is given', () => {
    const allFree = { ...CATALOG, cells: CATALOG.cells.map((c) => ({ ...c, stage: 'stage1' as const })) };
    expect(rosterFreeLessonsLine(input(), 'en', allFree)).toBeNull();
  });
});
