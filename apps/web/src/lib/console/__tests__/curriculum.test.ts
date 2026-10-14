import {
  CATALOG,
  CurriculumParamsSchema,
  PACES,
  StageKeySchema,
  addDays,
  generateCurriculum,
  proposeRoute,
  questsPlacedOutAtLevel,
  routeCatalogOf,
  themeOrderFor,
  toMeta,
  toPlanItems,
  type Catalog,
  type CurriculumMeta,
  type DurationOption,
  type Entitlement,
  type PlanItem,
  type StageKey,
  type ThemeKey,
  type WeekMeta,
  type Weekday,
} from '@hangul-route/content-schema';
import { CATALOG_2026_10 } from '@hangul-route/content-schema/testing/catalog-2026-10';
import { findBannedWord, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  PACE_CHOICES,
  STARTING_LEVELS,
  STARTING_POINT_IDS,
  followProposal,
  lengthPreviewText,
  paceOf,
  pacePatch,
  planUpdateOffer,
  prefilledState,
  relearnedState,
  reseedSaveBody,
  suggestedPace,
  updateAskText,
  wizardProposal,
  dateRangeText,
  defaultsFor,
  draftPlanBody,
  extraText,
  isStaleCatalog,
  learnerProblem,
  levelFromSummary,
  levelHint,
  ownRouteLine,
  planSwitcherOrder,
  readoutLine,
  repacePlan,
  repaceSaveBody,
  reweek,
  routeEndDate,
  routeShownOrder,
  selectedPlan,
  statsText,
  swapRouteItems,
  thisWeekOf,
  toParams,
  unlockedStagesForSpace,
  warningText,
  weekGroups,
  weekLabel,
  weekOfDate,
  weekdayLabel,
  weeksOf,
  weeksToFit,
  withTargetDate,
  wizardProblem,
  type PlannerLearner,
  type WizardState,
} from '../curriculum';

const TODAY = '2026-10-18'; // a Sunday
const m = getMessages('en').console.curriculum;

type Summary = { placement?: { level: { stage: 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5' | 'stage6' | 'stage7'; band: number } }; stage1: { questsDone: number; questsTotal: number } };
const learner = (id: string, ageGroup: string, summary: Summary | null = null) => ({ id, ageGroup, summary });
const done = (questsDone: number, questsTotal = 8): Summary => ({ stage1: { questsDone, questsTotal } });
const placed = (stage: 'stage1' | 'stage2' | 'stage5', band: number): Summary => ({ placement: { level: { stage, band } }, stage1: { questsDone: 0, questsTotal: 8 } });

/** A class wizard state: brand new, 4 weeks from Sunday 18 October, Sundays and Wednesdays, Stage 1 only. */
const classState = (patch: Partial<WizardState> = {}): WizardState => ({
  ...defaultsFor('class', [], TODAY),
  length: '4-week',
  sessionDays: ['sun', 'wed'],
  ...patch,
});

/** Every story signed off, so culture weeks and story labels appear. Since CATALOG_VERSION 6 the shipped catalogue has all 24 stories ready too, so this equals CATALOG for stories; it stays so these tests do not depend on the shipped review state. */
const READY: Catalog = { ...CATALOG, stories: CATALOG.stories.map((story) => ({ ...story, status: 'ready' as const })) };

function classPlan(patch: Partial<WizardState> = {}, source: Catalog = CATALOG): { id: string; meta: CurriculumMeta; items: PlanItem[] } {
  const params = toParams(classState(patch), ['stage1']);
  if (!params) throw new Error('params');
  const draft = generateCurriculum(params, source);
  return { id: 'plan:route', meta: toMeta(draft), items: toPlanItems(draft) };
}

/**
 * Every grid cell has shipped since F-CURR-001, so the coming-soon cases read a copy of the catalogue
 * with the Stage 7 cells taken back to "Coming later" placeholders.
 */
const SOON: Catalog = {
  ...CATALOG,
  cells: CATALOG.cells.map((cell) => (cell.stage === 'stage7' ? { ...cell, status: 'preview' as const, minutes: 10, questIds: [] } : cell)),
  quests: CATALOG.quests.filter((quest) => quest.stage !== 'stage7'),
};

describe('starting points (section 3.8 step 1)', () => {
  it('has six cards mapped to placement levels, from Brand new to Reads first sentences', () => {
    expect(STARTING_POINT_IDS).toEqual(['brand-new', 'some-letters', 'all-letters', 'reads-words', 'first-words', 'first-sentences']);
    expect(STARTING_LEVELS['brand-new']).toEqual({ stage: 'stage1', band: 0 });
    expect(STARTING_LEVELS['reads-words']).toEqual({ stage: 'stage1', band: 3 });
    expect(STARTING_LEVELS['first-words']).toEqual({ stage: 'stage2', band: 0 });
    expect(STARTING_LEVELS['first-sentences']).toEqual({ stage: 'stage3', band: 0 });
  });
});

describe('levelFromSummary (a coarse hint, assumption 5)', () => {
  it('reads the newest level check first', () => {
    expect(levelFromSummary(placed('stage1', 0))).toBe('brand-new');
    expect(levelFromSummary(placed('stage1', 1))).toBe('some-letters');
    expect(levelFromSummary(placed('stage1', 2))).toBe('all-letters');
    expect(levelFromSummary(placed('stage1', 3))).toBe('reads-words');
    expect(levelFromSummary(placed('stage2', 2))).toBe('first-words');
    expect(levelFromSummary(placed('stage5', 0))).toBe('first-sentences');
  });

  it('falls back to the share of Stage 1 quests done', () => {
    expect(levelFromSummary(done(0))).toBe('brand-new');
    expect(levelFromSummary(done(0, 0))).toBe('brand-new');
    expect(levelFromSummary(done(1))).toBe('some-letters');
    expect(levelFromSummary(done(3))).toBe('all-letters');
    expect(levelFromSummary(done(6))).toBe('reads-words');
    expect(levelFromSummary(done(8))).toBe('first-words');
  });

  it('gives no hint without a summary', () => {
    expect(levelFromSummary(null)).toBeNull();
    expect(levelFromSummary(undefined)).toBeNull();
  });
});

describe('levelHint: one line, never a list or a ranking', () => {
  it('needs three learners with a summary', () => {
    expect(levelHint([learner('a', '8-9', done(1)), learner('b', '8-9', done(1)), learner('c', '8-9')])).toBeNull();
  });

  it('picks the most frequent starting point', () => {
    expect(levelHint([learner('a', '8-9', done(1)), learner('b', '8-9', placed('stage1', 1)), learner('c', '8-9', done(0))])).toBe('some-letters');
  });

  it('breaks a tie towards the earlier starting point', () => {
    expect(levelHint([learner('a', '8-9', done(0)), learner('b', '8-9', done(6)), learner('c', '8-9', done(0)), learner('d', '8-9', done(6))])).toBe('brand-new');
  });
});

describe('defaultsFor (section 3.1 audience table)', () => {
  it('starts a class at two sessions and 15 minutes, no length chosen', () => {
    const state = defaultsFor('class', [learner('a', '8-9'), learner('b', '10-11')], TODAY);
    expect(state).toMatchObject({ audience: 'class', learnerId: null, start: 'brand-new', length: null, sessionsPerWeek: 2, minutesPerSession: 15, startDate: TODAY });
    expect(state).toMatchObject({ sessionDays: [], daysOff: [], focus: 'balanced', themes: [], culturalAnchors: true, includeComingSoon: true });
  });

  it('uses 10 minutes when most of a class reads pictures first, and the level hint', () => {
    const roster = [learner('a', '5-7', done(1)), learner('b', '5-7', done(1)), learner('c', '8-9', done(1))];
    expect(defaultsFor('class', roster, TODAY)).toMatchObject({ minutesPerSession: 10, start: 'some-letters' });
    expect(defaultsFor('class', [learner('a', '5-7'), learner('b', '8-9')], TODAY).minutesPerSession).toBe(15);
  });

  it('picks a family\'s only learner and prefills from that learner', () => {
    expect(defaultsFor('family', [learner('kid', '5-7', placed('stage1', 2))], TODAY)).toMatchObject({ learnerId: 'kid', start: 'all-letters', minutesPerSession: 10, sessionsPerWeek: 3 });
  });

  it('waits for the grown-up to pick when a family has several learners', () => {
    const family = [learner('a', '5-7', done(8)), learner('b', '10-11', done(3))];
    expect(defaultsFor('family', family, TODAY)).toMatchObject({ learnerId: null, start: 'brand-new', minutesPerSession: 15 });
    expect(defaultsFor('family', family, TODAY, 'b')).toMatchObject({ learnerId: 'b', start: 'all-letters', minutesPerSession: 15 });
    expect(defaultsFor('family', family, TODAY, 'gone')).toMatchObject({ learnerId: null, start: 'brand-new' });
  });
});

describe('wizard state to generator params', () => {
  it('needs a length first (no length is pre-selected)', () => {
    const state = defaultsFor('class', [], TODAY);
    expect(weeksOf(state)).toBeNull();
    expect(toParams(state, ['stage1'])).toBeNull();
    expect(wizardProblem(state, TODAY)).toBe('no-length');
  });

  it('maps a preset to weeks and its review rhythm', () => {
    const params = toParams(classState({ length: '12-week', themes: ['nature', 'life'], focus: 'culture' }), ['stage1']);
    expect(params).toMatchObject({ audience: 'class', level: { stage: 'stage1', band: 0 }, weeks: 12, reviewEvery: 4, sessionsPerWeek: 2, sessionDays: ['sun', 'wed'], minutesPerSession: 15 });
    expect(params?.goals).toEqual({ focus: 'culture', themes: ['nature', 'life'] });
    expect(params).toMatchObject({ includeComingSoon: true, culturalAnchors: true, unlockedStages: ['stage1'], startDate: TODAY, daysOff: [] });
    expect(CurriculumParamsSchema.safeParse(params).success).toBe(true);
    expect(toParams(classState({ length: '6-month' }), ['stage1'])).toMatchObject({ weeks: 26, reviewEvery: 4 });
    expect(toParams(classState({ length: '4-week' }), ['stage1'])).toMatchObject({ weeks: 4, reviewEvery: 0 });
  });

  it('keeps weekdays in calendar order, leaves out empty days and themes, and lets days win over the count', () => {
    const params = toParams(classState({ sessionDays: ['fri', 'mon', 'wed'], sessionsPerWeek: 2 }), ['stage1']);
    expect(params).toMatchObject({ sessionDays: ['mon', 'wed', 'fri'], sessionsPerWeek: 3 });
    const spread = toParams(classState({ sessionDays: [], sessionsPerWeek: 3 }), ['stage1']);
    expect(spread).not.toHaveProperty('sessionDays');
    expect(spread?.goals).toEqual({ focus: 'balanced' });
  });

  it('takes a custom number of weeks with the default review rhythm', () => {
    expect(weeksOf(classState({ length: 'custom', customWeeks: 7 }))).toBe(7);
    expect(toParams(classState({ length: 'custom', customWeeks: 7 }), ['stage1'])).toMatchObject({ weeks: 7 });
    expect(toParams(classState({ length: 'custom', customWeeks: 7 }), ['stage1'])).not.toHaveProperty('reviewEvery');
    expect(wizardProblem(classState({ length: 'custom', customWeeks: 0 }), TODAY)).toBe('bad-weeks');
    expect(wizardProblem(classState({ length: 'custom', customWeeks: 53 }), TODAY)).toBe('bad-weeks');
    expect(wizardProblem(classState({ length: 'custom', customWeeks: 2.5 }), TODAY)).toBe('bad-weeks');
  });

  it('reports the step 2 problems in plain order', () => {
    expect(wizardProblem(classState(), TODAY)).toBeNull();
    expect(wizardProblem(classState({ startDate: '2026-10-17' }), TODAY)).toBe('start-past');
    expect(wizardProblem(classState({ startDate: '2026-02-30' }), TODAY)).toBe('start-past');
    expect(wizardProblem(classState({ daysOff: [{ from: '2026-11-28', to: '2026-11-22' }] }), TODAY)).toBe('break-reversed');
    expect(wizardProblem(classState({ daysOff: [{ from: '2026-11-22', to: '' }] }), TODAY)).toBe('break-missing');
    // + Add a break starts with empty dates, so a new break never silently removes a session.
    expect(wizardProblem(classState({ daysOff: [{ from: '', to: '' }] }), TODAY)).toBe('break-missing');
    const thirteen = Array.from({ length: 13 }, () => ({ from: '2026-11-22', to: '2026-11-22' }));
    expect(wizardProblem(classState({ daysOff: thirteen }), TODAY)).toBe('too-many-breaks');
    expect(wizardProblem(classState({ length: 'custom', customWeeks: 52, sessionDays: [], sessionsPerWeek: 6 }), TODAY)).toBe('too-many');
    expect(wizardProblem(classState({ length: 'custom', customWeeks: 52, sessionDays: ['mon', 'tue', 'wed', 'thu', 'fri'] }), TODAY)).toBeNull();
  });
});

describe('learnerProblem: a family space picks the learner first (section 3.8)', () => {
  it('needs a learner in a family that has learners, never in a class', () => {
    expect(learnerProblem({ audience: 'family', learnerId: null }, 2)).toBe('no-learner');
    expect(learnerProblem({ audience: 'family', learnerId: null }, 1)).toBe('no-learner');
    expect(learnerProblem({ audience: 'family', learnerId: 'l:1' }, 2)).toBeNull();
    expect(learnerProblem({ audience: 'family', learnerId: null }, 0)).toBeNull();
    expect(learnerProblem({ audience: 'class', learnerId: null }, 30)).toBeNull();
  });
});

describe('unlockedStagesForSpace (assumption 9a)', () => {
  const ent = (subjectId: string, patch: Partial<Entitlement> = {}): Entitlement => ({
    id: 'ent:a',
    subjectKind: 'space',
    subjectId,
    planKey: 'group_license',
    status: 'active',
    provider: 'stripe',
    providerRef: null,
    customerRef: null,
    seats: null,
    expiresAt: '2027-10-01T00:00:00.000Z',
    promoCode: null,
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...patch,
  });
  const now = new Date('2026-10-18T12:00:00Z');
  const ALL = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'];

  it('is Stage 1 on a free space', () => {
    expect(unlockedStagesForSpace([], { id: 'space:c', parentSpaceId: null }, now)).toEqual(['stage1']);
    expect(unlockedStagesForSpace([ent('space:other')], { id: 'space:c', parentSpaceId: null }, now)).toEqual(['stage1']);
    expect(unlockedStagesForSpace([ent('space:c', { status: 'expired' })], { id: 'space:c', parentSpaceId: null }, now)).toEqual(['stage1']);
  });

  it('opens every stage for an active entitlement of the space or its school', () => {
    expect(unlockedStagesForSpace([ent('space:c')], { id: 'space:c', parentSpaceId: null }, now)).toEqual(ALL);
    expect(unlockedStagesForSpace([ent('space:school')], { id: 'space:c', parentSpaceId: 'space:school' }, now)).toEqual(ALL);
    expect(unlockedStagesForSpace([ent('space:c', { subjectKind: 'account' })], { id: 'space:c', parentSpaceId: null }, now)).toEqual(['stage1']);
  });
});

describe('weekGroups: preview rows and the builder week groups', () => {
  it('puts every generated item under its week, by date, with titles from the catalogue', () => {
    const plan = classPlan();
    const { rows, unscheduled } = weekGroups(plan.meta.weeks, plan.items);
    expect(rows).toHaveLength(4);
    expect(unscheduled).toEqual([]);
    expect(rows[0]?.endDate).toBe('2026-10-24');
    expect(rows[0]?.items.map((i) => [i.date, i.title, i.category, i.index])).toEqual([
      ['2026-10-18', 'Meet a, eo, g, n', 'lesson', 0],
      ['2026-10-21', 'Meet o, u, m and the circle', 'lesson', 1],
    ]);
    expect(rows.flatMap((row) => row.items)).toHaveLength(plan.items.length);
  });

  it('places an item without a week by its date, and keeps the rest apart', () => {
    const plan = classPlan();
    const items: PlanItem[] = [
      { kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-10-27' },
      { kind: 'quest', id: 'quest:stage1-life-q1' },
      { kind: 'episode', id: 'episode:stage7-nature', week: 9, note: 'Coming soon' },
      { kind: 'quest', id: 'quest:stage1-rites-q1', targetDate: '2027-03-01' },
    ];
    const { rows, unscheduled } = weekGroups(plan.meta.weeks, items, SOON);
    expect(rows[1]?.items.map((i) => i.index)).toEqual([0]);
    expect(unscheduled.map((i) => [i.index, i.date, i.category])).toEqual([
      [1, null, 'lesson'],
      [2, null, 'coming-soon'],
      [3, '2027-03-01', 'lesson'],
    ]);
  });
});

describe('route builder: a date change moves the item to its week (section 3.8 step 5)', () => {
  it('finds the week that holds a date, and none outside the route', () => {
    const { meta } = classPlan();
    expect(weekOfDate(meta.weeks, '2026-10-18')).toBe(1);
    expect(weekOfDate(meta.weeks, '2026-10-31')).toBe(2);
    expect(weekOfDate(meta.weeks, '2026-11-14')).toBe(4);
    expect(weekOfDate(meta.weeks, '2026-11-15')).toBeUndefined();
    expect(weekOfDate(meta.weeks, '2026-10-17')).toBeUndefined();
  });

  it('moves an edited item to the new week, drops the week outside the route or without a date', () => {
    const { meta, items } = classPlan();
    const first = items[0] as PlanItem;
    expect(first.week).toBe(1);
    const moved = withTargetDate(meta.weeks, { ...first, note: 'warm up' }, '2026-11-04');
    expect(moved).toEqual({ kind: first.kind, id: first.id, note: 'warm up', targetDate: '2026-11-04', week: 3 });
    const edited = items.map((item, k) => (k === 0 ? moved : item));
    const groups = weekGroups(meta.weeks, edited);
    expect(groups.rows[0]?.items.map((i) => i.index)).not.toContain(0);
    expect(groups.rows[2]?.items.map((i) => i.index)).toContain(0);
    expect(withTargetDate(meta.weeks, first, '2027-03-01')).toEqual({ kind: first.kind, id: first.id, targetDate: '2027-03-01' });
    expect(withTargetDate(meta.weeks, first, undefined)).toEqual({ kind: first.kind, id: first.id });
    expect(weekGroups(meta.weeks, [withTargetDate(meta.weeks, first, undefined)]).unscheduled).toHaveLength(1);
  });

  it('re-weeks dated items after the one-per-day spacing and leaves undated ones alone', () => {
    const { meta, items } = classPlan();
    const stale = [{ ...(items[0] as PlanItem), targetDate: '2026-11-08' }, { kind: 'quest' as const, id: 'quest:x', week: 2 }];
    expect(reweek(meta.weeks, stale).map((i) => i.week)).toEqual([4, 2]);
  });
});

describe('route builder: up and down trade places on the calendar (section 3.8 step 5)', () => {
  it('numbers items in the order shown and swaps two items into each other\'s slot', () => {
    const { meta, items } = classPlan();
    const noted = items.map((item, k) => (k === 1 ? { ...item, note: 'bring cards' } : item));
    const shown = routeShownOrder(weekGroups(meta.weeks, noted));
    expect(shown).toEqual(noted.map((_, k) => k));
    const swapped = swapRouteItems(noted, 1, 0);
    expect(swapped[0]).toMatchObject({ id: noted[1]?.id, note: 'bring cards', targetDate: noted[0]?.targetDate, week: noted[0]?.week });
    expect(swapped[1]).toMatchObject({ id: noted[0]?.id, targetDate: noted[1]?.targetDate, week: noted[1]?.week });
    expect(swapped[1]?.note).toBeUndefined();
    // What the grown-up sees changes: the second title is now first in week 1.
    expect(weekGroups(meta.weeks, swapped).rows[0]?.items.map((i) => i.id)).toEqual([noted[1]?.id, noted[0]?.id]);
    expect(swapped.slice(2)).toEqual(noted.slice(2));
  });

  it('works across weeks and for two items on the same day, and ignores a missing index', () => {
    const { meta, items } = classPlan();
    const swapped = swapRouteItems(items, 1, 2);
    expect(weekGroups(meta.weeks, swapped).rows[1]?.items[0]?.id).toBe(items[1]?.id);
    const sameDay = [{ kind: 'quest' as const, id: 'quest:a', targetDate: '2026-10-18', week: 1 }, { kind: 'quest' as const, id: 'quest:b', targetDate: '2026-10-18', week: 1 }];
    expect(weekGroups(meta.weeks, swapRouteItems(sameDay, 0, 1)).rows[0]?.items.map((i) => i.id)).toEqual(['quest:b', 'quest:a']);
    const undated = [{ kind: 'quest' as const, id: 'quest:a' }, { kind: 'quest' as const, id: 'quest:b', targetDate: '2026-10-18', week: 1 }];
    expect(swapRouteItems(undated, 0, 1)).toEqual([{ kind: 'quest', id: 'quest:b' }, { kind: 'quest', id: 'quest:a', targetDate: '2026-10-18', week: 1 }]);
    expect(swapRouteItems(items, 0, 99)).toEqual(items);
    expect(swapRouteItems(items, 1, 1)).toEqual(items);
  });
});

describe('weekLabel, extras and dates (codes worded at render time)', () => {
  const week = (patch: Partial<WeekMeta>): WeekMeta => ({ index: 1, startDate: TODAY, kind: 'learn', focus: { episodeId: null, storyIds: [], festival: null }, extras: [], ...patch });
  const row = (w: WeekMeta, items: PlanItem[] = [], source: Catalog = CATALOG) => weekGroups([w], items.map((i) => ({ ...i, week: 1 })), source).rows[0]!;

  it('names review, break and culture weeks', () => {
    expect(weekLabel(row(week({ kind: 'review' })), 'en')).toBe('Review and collect');
    expect(weekLabel(row(week({ kind: 'break' })), 'en')).toBe('Days off');
    expect(weekLabel(row(week({ kind: 'culture', focus: { episodeId: null, storyIds: ['story:sejong-new-letters'], festival: null } })), 'en', READY)).toBe("Culture week: King Sejong's New Letters");
    expect(weekLabel(row(week({ kind: 'culture', focus: { episodeId: null, storyIds: ['story:nope'], festival: null } })), 'en')).toBe('Culture week');
  });

  it('names a learn week by its lesson, its stories, its coming-soon items or free practice', () => {
    expect(weekLabel(row(week({ focus: { episodeId: 'episode:stage1-nature', storyIds: [], festival: null } })), 'en')).toBe('Tigers, Mountains, Moon');
    expect(weekLabel(row(week({ focus: { episodeId: null, storyIds: ['story:sun-and-moon'], festival: null } })), 'en')).toBe('Heritage stories');
    expect(weekLabel(row(week({}), [{ kind: 'episode', id: 'episode:stage7-nature' }], SOON), 'en', SOON)).toBe('New episodes are on the way');
    expect(weekLabel(row(week({})), 'en')).toBe('Free practice');
  });

  it('words the extras and the date range', () => {
    expect(extraText({ kind: 'vocab', topicId: 'topic:food' }, 'en')).toBe('Words: Food (optional)');
    expect(extraText({ kind: 'vocab', topicId: 'topic:nope' }, 'en')).toBe('Words: topic:nope (optional)');
    expect(extraText({ kind: 'hangul-check' }, 'en')).toBe('Hangul Check');
    expect(dateRangeText('2026-10-18', '2026-10-24', 'en')).toBe('Oct 18 – Oct 24');
    expect(weekdayLabel('sun', 'en')).toBe('Sun');
    expect(weekdayLabel('sat', 'en')).toBe('Sat');
  });
});

describe('warnings and stats in plain words', () => {
  it('words every warning code, invitationally', () => {
    expect(warningText({ code: 'content-runs-out', week: 15 }, 'en')).toBe(m.preview.warnings.contentRunsOut(15));
    expect(warningText({ code: 'coming-soon-included', week: 13, count: 5 }, 'en')).toBe(m.preview.warnings.comingSoon(5));
    expect(warningText({ code: 'premium-needed', count: 3 }, 'en')).toBe(m.preview.warnings.premium(3));
    expect(warningText({ code: 'fewer-sessions-than-units', count: 2 }, 'en')).toBe(m.preview.warnings.didNotFit(2));
    expect(warningText({ code: 'session-too-short', count: 1 }, 'en')).toBe(m.preview.warnings.tooShort(1));
    expect(warningText({ code: 'already-done-skipped', count: 10 }, 'en')).toBe(m.preview.warnings.alreadyDone(10));
    expect(warningText({ code: 'content-runs-out' }, 'en')).toBe(m.preview.warnings.contentRunsOut(1));
    expect(warningText({ code: 'premium-needed' }, 'en')).toBe(m.preview.warnings.premium(0));
  });

  it('rounds minutes to tens and names the last stage', () => {
    const stats = { readyItems: 18, minutesPlanned: 79, endsAtStage: 'stage2' as const };
    expect(statsText(stats, 'en')).toBe('18 lessons and stories · about 80 minutes · ends in Stage 2');
    expect(statsText({ readyItems: 1, minutesPlanned: 4, endsAtStage: 'stage1' }, 'en')).toBe('1 lesson or story · about 4 minutes · ends in Stage 1');
    expect(statsText({ readyItems: 0, minutesPlanned: 0, endsAtStage: 'stage3' }, 'en')).toBeNull();
  });

  it('keeps every generated text free of banned words for real drafts', () => {
    const params = toParams(classState({ length: '6-month', start: 'reads-words', sessionDays: ['mon', 'wed', 'fri'] }), ['stage1']);
    if (!params) throw new Error('params');
    const draft = generateCurriculum(params, READY);
    const texts = [
      ...weekGroups(draft.weeks, draft.items, READY).rows.flatMap((r) => [weekLabel(r, 'en', READY), ...r.week.extras.map((e) => extraText(e, 'en', READY))]),
      ...draft.warnings.map((w) => warningText(w, 'en')),
    ];
    expect(texts.length).toBeGreaterThan(26);
    for (const text of texts) {
      expect(findBannedWord(text, 'en', 'learner'), text).toBeNull();
      expect(findBannedWord(text, 'en', 'caregiver'), text).toBeNull();
    }
  });
});

describe('readout (section 3.8 step 6)', () => {
  const row = { learnerId: 'a', name: 'Mina', done: 4, total: 6, notReady: 0, synced: true, lastActiveAt: '2026-10-18T00:00:00Z' };

  it('reads "so far" against the planned length', () => {
    expect(readoutLine(row, 36, 'en')).toBe('4 / 6 so far · 36 planned');
    expect(readoutLine({ ...row, notReady: 1 }, 36, 'en')).toBe('4 / 6 so far · 36 planned · 1 not ready yet');
    expect(readoutLine({ ...row, synced: false }, 36, 'en')).toBe('waiting for the next sync');
  });

  it('finds the week that holds today', () => {
    const plan = classPlan();
    expect(thisWeekOf(plan.meta.weeks, '2026-10-17')).toEqual({ status: 'before', startDate: '2026-10-18' });
    expect(thisWeekOf(plan.meta.weeks, '2026-10-26')).toMatchObject({ status: 'in', week: { index: 2 } });
    expect(thisWeekOf(plan.meta.weeks, '2026-11-15')).toEqual({ status: 'after' });
    expect(thisWeekOf([], TODAY)).toEqual({ status: 'after' });
    expect(routeEndDate(plan.meta)).toBe('2026-11-14');
  });
});

describe('plan switcher: the active route first, then other live plans, then drafts', () => {
  const p = (id: string, publishedAt: string | null, updatedAt: string, route: boolean, archivedAt: string | null = null) => ({
    id,
    title: id,
    publishedAt,
    archivedAt,
    updatedAt,
    meta: route ? classPlan().meta : null,
  });

  it('orders and leaves archived plans out', () => {
    const plans = [
      p('classic-old', '2026-09-01', '2026-09-01', false),
      p('draft-old', null, '2026-09-10', false),
      p('route-new', '2026-10-10', '2026-10-10', true),
      p('archived', '2026-10-11', '2026-10-11', true, '2026-10-12'),
      p('draft-new', null, '2026-10-12', true),
      p('route-old', '2026-09-20', '2026-10-15', true),
      p('classic-new', '2026-10-05', '2026-10-05', false),
    ];
    expect(planSwitcherOrder(plans).map((x) => x.id)).toEqual(['route-new', 'classic-new', 'route-old', 'classic-old', 'draft-new', 'draft-old']);
    expect(planSwitcherOrder([p('classic', '2026-09-01', '2026-09-01', false)]).map((x) => x.id)).toEqual(['classic']);
    expect(planSwitcherOrder([{ ...p('legacy', '2026-09-01', '2026-09-01', false), meta: undefined }]).map((x) => x.id)).toEqual(['legacy']);
  });
});

describe('re-pace from today (console mode shift, section 3.7)', () => {
  it('keeps the past and lays the rest onto the remaining sessions, same ids', () => {
    const plan = classPlan();
    const items = plan.items.filter((item) => item.targetDate !== '2026-10-28');
    const result = repacePlan({ ...plan, items }, '2026-10-26', '2026-10-26T09:00:00.000Z');
    expect(result.items.map((i) => i.targetDate)).toEqual(['2026-10-18', '2026-10-21', '2026-10-25', '2026-10-28', '2026-11-01', '2026-11-04', '2026-11-08']);
    // The same items; lessons keep their order. A story may move to the next story slot of its week (section 3.4 cadence).
    expect(result.items.map((i) => i.id).sort()).toEqual(items.map((i) => i.id).sort());
    const lessonsOf = (list: readonly { id: string }[]): string[] => list.map((i) => i.id).filter((id) => !id.startsWith('quest:story-'));
    expect(lessonsOf(result.items)).toEqual(lessonsOf(items));
    // A story stays in its week or moves to the next one, never earlier and never further.
    const weekBefore = new Map(items.map((i) => [i.id, i.targetDate === undefined ? undefined : weekOfDate(plan.meta.weeks, i.targetDate)]));
    const storyItems = result.items.filter((i) => i.id.startsWith('quest:story-'));
    expect(storyItems.length).toBeGreaterThan(0);
    for (const item of storyItems) {
      const before = weekBefore.get(item.id);
      const after = item.targetDate === undefined ? undefined : weekOfDate(result.meta.weeks, item.targetDate);
      if (before === undefined || after === undefined) throw new Error(`${item.id} has no week`);
      expect([before, before + 1], item.id).toContain(after);
    }
    expect(result.planId).toBe('plan:route');
    expect(result.meta).toMatchObject({ kind: 'curriculum', repacedAt: '2026-10-26T09:00:00.000Z', horizonDays: plan.meta.horizonDays });
    expect(result.nextDate).toBe('2026-10-28');
    expect(result.leftOver).toBe(0);
    expect(result.endDate).toBe('2026-11-14');
  });

  it('counts the items that no longer fit and finds the weeks that keep them', () => {
    const plan = classPlan();
    const squeezed = { ...plan, meta: { ...plan.meta, params: { ...plan.meta.params, daysOff: [{ from: '2026-11-01', to: '2026-11-07' }] } } };
    const result = repacePlan(squeezed, '2026-10-26', '2026-10-26T09:00:00.000Z');
    expect(result.leftOver).toBe(2);
    expect(weeksToFit(squeezed, '2026-10-26')).toBe(1);
    const longer = repacePlan(squeezed, '2026-10-26', '2026-10-26T09:00:00.000Z', 1);
    expect(longer.leftOver).toBe(0);
    expect(longer.meta.params.weeks).toBe(5);
    expect(longer.meta.weeks).toHaveLength(5);
    expect(longer.endDate).toBe('2026-11-21');
    expect(longer.items).toHaveLength(plan.items.length);
  });

  it('counts coming-soon episodes that no longer fit, which the generator leaves out of its warning', () => {
    // A catalogue with no story offered and the Stage 7 cells taken back to "Coming later" (every cell has
    // shipped since F-CURR-001), so this route holds coming-soon episodes only.
    const noStories: Catalog = {
      ...CATALOG,
      stories: CATALOG.stories.map((story) => ({ ...story, status: 'draft' as const })),
      cells: CATALOG.cells.map((cell) => (cell.stage === 'stage7' ? { ...cell, status: 'preview' as const, minutes: 10, questIds: [] } : cell)),
      quests: CATALOG.quests.filter((quest) => quest.stage !== 'stage7'),
    };
    const plan = classPlan({ length: '12-week', start: 'first-words' }, noStories);
    expect(plan.items.every((item) => item.kind === 'episode')).toBe(true);
    const squeezed = { ...plan, meta: { ...plan.meta, params: { ...plan.meta.params, daysOff: [{ from: '2026-11-01', to: '2027-01-09' }] } } };
    const result = repacePlan(squeezed, '2026-10-26', '2026-10-26T09:00:00.000Z', 0, noStories);
    expect(result.items).toHaveLength(plan.items.length - 1);
    expect(result.leftOver).toBe(1);
    expect(weeksToFit(squeezed, '2026-10-26', noStories)).toBe(1);
  });

  it('on the shipped catalogue (stories ready), a squeezed Stage 2 route counts what no longer fits and the weeks that keep it', () => {
    const plan = classPlan({ length: '12-week', start: 'first-words' });
    expect(plan.items.some((item) => item.id.startsWith('quest:story-'))).toBe(true);
    const squeezed = { ...plan, meta: { ...plan.meta, params: { ...plan.meta.params, daysOff: [{ from: '2026-11-01', to: '2026-11-21' }] } } };
    const result = repacePlan(squeezed, '2026-10-26', '2026-10-26T09:00:00.000Z');
    expect(result.leftOver).toBeGreaterThan(0);
    const extra = weeksToFit(squeezed, '2026-10-26');
    if (extra === null) throw new Error('expected extra weeks');
    expect(repacePlan(squeezed, '2026-10-26', '', extra).leftOver).toBe(0);
    expect(repacePlan(squeezed, '2026-10-26', '', extra - 1).leftOver).toBeGreaterThan(0);
  });

  it('needs no extra weeks when everything fits, and finds none past 52 weeks', () => {
    const plan = classPlan();
    expect(weeksToFit(plan, '2026-10-26')).toBeNull();
    const full = { ...plan, meta: { ...plan.meta, params: { ...plan.meta.params, weeks: 52 } } };
    const squeezed = { ...full, meta: { ...full.meta, params: { ...full.meta.params, daysOff: [{ from: '2026-10-19', to: '2027-10-16' }] } } };
    expect(repacePlan(squeezed, '2026-10-19', '2026-10-19T09:00:00.000Z').leftOver).toBeGreaterThan(0);
    expect(weeksToFit(squeezed, '2026-10-19')).toBeNull();
  });

  it('has nowhere to move items once the route has ended', () => {
    const plan = classPlan();
    const result = repacePlan(plan, '2026-12-01', '2026-12-01T09:00:00.000Z');
    expect(result.nextDate).toBeNull();
    expect(result.items.map((i) => i.targetDate)).toEqual(plan.items.map((i) => i.targetDate));
  });

  it('flags a route made from an older catalogue', () => {
    const plan = classPlan();
    expect(isStaleCatalog(plan.meta)).toBe(false);
    expect(isStaleCatalog({ ...plan.meta, catalogVersion: 0 })).toBe(true);
    expect(isStaleCatalog(plan.meta, { ...CATALOG, version: CATALOG.version + 1 })).toBe(true);
  });

  /** The catalogue every route saved before F-QUEST-002 Q-6a was made from: version 1, no lesson teaches anything. */
  const V1: Catalog = { ...CATALOG, version: 1, quests: CATALOG.quests.map((quest) => ({ ...quest, teaches: [] })) };
  const LETTERS = ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3'];
  function v1Plan(start: WizardState['start']): { id: string; meta: CurriculumMeta; items: PlanItem[] } {
    const params = toParams(classState({ start }), ['stage1']);
    if (!params) throw new Error('params');
    const draft = generateCurriculum(params, V1);
    return { id: 'plan:route', meta: toMeta(draft), items: toPlanItems(draft) };
  }

  it('offers Refresh route on every route saved from catalogue version 1 to 30 (F-QUEST-002 Q-6a bumps it to 2, Q-6b to 3, Q-7b to 4, Q-8 to 5, F-STORY-001 PR 1.9 to 6, F-STORY-005 PR 5.6 to 7 for the rites book and to 8 for the other four books, F-CURR-001 S4-1 to 9 for Read Along, S3-1 to 10 for First Sentences, S2-3 to 11 for Playground Words, S3-3 to 12 for Festival Sentences, S3-5 to 13 for Game Sentences, S3-2 to 14 for Daily Mini-Sentences, T-2 to 15 for Greeting Dialogues, S2-1 to 16 for Word Builder, S2-2 to 17 for Holiday Words, S4-2 to 18 for Kitchen Talk, S4-3 to 19 for Park Conversations, S4-4 to 20 for Playdate Talk, S6-1 to 21 for Read the Menu, S6-2 to 22 for Order Food, S6-3 to 23 for Travel for Chuseok, S6-4 to 24 for Hike & Ask, S6-5 to 25 for Buy at Market, S3-4 to 26 for Animal Sentences, T-1 to 27 for Lunch Box Words and Outdoor Words, S7-1 to 28 for Write Your Name, S7-2 to 29 for My Day in Korean, S7-3 to 30 for My Holiday Memory, S7-4 to 31 for My Favorite Animal)', () => {
    expect(CATALOG.version).toBe(31);
    expect(v1Plan('brand-new').meta.catalogVersion).toBe(1);
    expect(isStaleCatalog(v1Plan('brand-new').meta)).toBe(true);
    expect(isStaleCatalog(v1Plan('some-letters').meta)).toBe(true);
    // A route saved between Q-6a and Q-6b (version 2, before life q3 joined) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 2 })).toBe(true);
    // A route saved between Q-6b and Q-7b (version 3, before rites q2-q3 joined) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 3 })).toBe(true);
    // A route saved between Q-7b and Q-8 (version 4, before nature and crafts q2-q3 joined) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 4 })).toBe(true);
    // A route saved before the 24 stories turned ready (version 5) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 5 })).toBe(true);
    // A route saved before the Stage 5 rites book shipped (version 6) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 6 })).toBe(true);
    // A route saved with only the rites book (version 7) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 7 })).toBe(true);
    // A route saved before Read Along shipped (version 8) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 8 })).toBe(true);
    // A route saved before First Sentences shipped (version 9) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 9 })).toBe(true);
    // A route saved before Playground Words shipped (version 10) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 10 })).toBe(true);
    // A route saved before Festival Sentences shipped (version 11) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 11 })).toBe(true);
    // A route saved before Game Sentences shipped (version 12) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 12 })).toBe(true);
    // A route saved before Daily Mini-Sentences shipped (version 13) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 13 })).toBe(true);
    // A route saved before Greeting Dialogues shipped (version 14) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 14 })).toBe(true);
    // A route saved before Word Builder shipped (version 15) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 15 })).toBe(true);
    // A route saved before Holiday Words shipped (version 16) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 16 })).toBe(true);
    // A route saved before Kitchen Talk shipped (version 17) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 17 })).toBe(true);
    // A route saved before Park Conversations shipped (version 18) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 18 })).toBe(true);
    // A route saved before Playdate Talk shipped (version 19) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 19 })).toBe(true);
    // A route saved before Read the Menu shipped (version 20) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 20 })).toBe(true);
    // A route saved before Order Food shipped (version 21) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 21 })).toBe(true);
    // A route saved before Travel for Chuseok shipped (version 22) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 22 })).toBe(true);
    // A route saved before Hike & Ask shipped (version 23) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 23 })).toBe(true);
    // A route saved before Buy at Market shipped (version 24) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 24 })).toBe(true);
    // A route saved before Animal Sentences shipped (version 25) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 25 })).toBe(true);
    // A route saved before Lunch Box Words and Outdoor Words grew (version 26) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 26 })).toBe(true);
    // A route saved before Write Your Name shipped (version 27) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 27 })).toBe(true);
    // A route saved before My Day in Korean shipped (version 28) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 28 })).toBe(true);
    // A route saved before My Holiday Memory shipped (version 29) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 29 })).toBe(true);
    // A route saved before My Favorite Animal shipped (version 30) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 30 })).toBe(true);
  });

  it('a new route on the shipped catalogue can schedule the new nature and crafts quests after their q1 (F-QUEST-002 Q-8)', () => {
    const ids = classPlan({ start: 'brand-new', length: '6-month' }).items.map((item) => item.id);
    expect(ids.filter((id) => id.startsWith('quest:stage1-nature-'))).toEqual(['quest:stage1-nature-q1', 'quest:stage1-nature-q2', 'quest:stage1-nature-q3']);
    expect(ids.filter((id) => id.startsWith('quest:stage1-crafts-'))).toEqual(['quest:stage1-crafts-q1', 'quest:stage1-crafts-q2', 'quest:stage1-crafts-q3']);
  });

  it('a new route on the shipped catalogue can schedule the new Chuseok and Hanbok quests after rites q1', () => {
    const ids = classPlan({ start: 'brand-new', length: '12-week' }).items.map((item) => item.id);
    const rites = ids.filter((id) => id.startsWith('quest:stage1-rites-'));
    expect(rites).toEqual(['quest:stage1-rites-q1', 'quest:stage1-rites-q2', 'quest:stage1-rites-q3']);
  });

  it('a new route on the shipped catalogue can schedule the new Picnic Snacks quest after life q1-q2', () => {
    const ids = classPlan({ start: 'brand-new' }).items.map((item) => item.id);
    const life = ids.filter((id) => id.startsWith('quest:stage1-life-'));
    expect(life).toEqual(['quest:stage1-life-q1', 'quest:stage1-life-q2', 'quest:stage1-life-q3']);
  });

  it('a refresh of a version-1 route keeps its past items and every letters quest it assigned, even where the level now places them out', () => {
    for (const start of ['brand-new', 'some-letters'] as const) {
      const plan = v1Plan(start);
      expect(plan.items.filter((item) => LETTERS.includes(item.id)).map((item) => item.id)).toEqual(LETTERS);
      const today = '2026-10-21';
      const result = repacePlan(plan, today, '2026-10-21T09:00:00.000Z');
      const past = plan.items.filter((item) => item.targetDate !== undefined && item.targetDate < today);
      expect(past.length).toBeGreaterThan(0);
      for (const item of past) expect(result.items).toContainEqual(expect.objectContaining({ id: item.id, targetDate: item.targetDate }));
      expect(result.items.filter((item) => LETTERS.includes(item.id)).map((item) => item.id)).toEqual(LETTERS);
      expect(result.meta.catalogVersion).toBe(CATALOG.version);
      expect(isStaleCatalog(result.meta)).toBe(false);
    }
  });

  it('a new route on the shipped catalogue places letters q1-q3 out from "Knows some letters" and keeps them for "Brand new"', () => {
    const ids = (start: WizardState['start']): string[] => classPlan({ start }).items.map((item) => item.id);
    expect(ids('brand-new').slice(0, 3)).toEqual(LETTERS);
    expect(ids('some-letters').filter((id) => LETTERS.includes(id))).toEqual([]);
  });

  it('a new route from "Knows all letters" places life q1-q3 out (they teach ㅈ ㅊ ㅂ ㅅ ㅋ ㅌ) and still schedules rites q1; "Knows some letters" keeps them', () => {
    const LIFE = ['quest:stage1-life-q1', 'quest:stage1-life-q2', 'quest:stage1-life-q3'];
    const ids = (start: WizardState['start']): string[] => classPlan({ start, length: '12-week' }).items.map((item) => item.id);
    expect(ids('all-letters').filter((id) => LIFE.includes(id))).toEqual([]);
    expect(ids('all-letters')).toContain('quest:stage1-rites-q1');
    expect(ids('some-letters').filter((id) => LIFE.includes(id))).toEqual(LIFE);
  });
});

describe('saving a re-pace (section 3.7): the same plan, still published', () => {
  const view = { id: 'plan:route', title: 'Route · 4 weeks', targetLearnerIds: ['l:1'] };

  it('keeps the id, the title and the learners, with the new items and meta', () => {
    const repaced = repacePlan(classPlan(), '2026-10-26', '2026-10-26T09:00:00.000Z');
    expect(repaceSaveBody(view, repaced)).toEqual({ id: 'plan:route', title: 'Route · 4 weeks', items: repaced.items, targetLearnerIds: ['l:1'], publish: true, meta: repaced.meta });
    expect(repaceSaveBody(view, repaced)?.meta.repacedAt).toBe('2026-10-26T09:00:00.000Z');
  });

  it('refuses a result computed for another plan (a switch while the confirm was open)', () => {
    const repaced = repacePlan(classPlan(), '2026-10-26', '2026-10-26T09:00:00.000Z');
    expect(repaceSaveBody({ ...view, id: 'plan:other' }, repaced)).toBeNull();
  });
});

describe('selectedPlan: ?plan= and the switcher', () => {
  const p = (id: string, updatedAt: string, archived = false) => ({ id, title: id, publishedAt: null, archivedAt: archived ? updatedAt : null, updatedAt });
  const plans = [p('older', '2026-10-01'), p('newest', '2026-10-10'), p('gone', '2026-10-12', true)];

  it('opens the chosen plan, else the newest live plan', () => {
    expect(selectedPlan(plans, 'older')?.id).toBe('older');
    expect(selectedPlan(plans, null)?.id).toBe('newest');
    expect(selectedPlan(plans, 'gone')?.id).toBe('newest');
    expect(selectedPlan(plans, 'plan:another-space')?.id).toBe('newest');
    expect(selectedPlan([], 'older')).toBeNull();
  });
});

describe('roster lines (section 3.10)', () => {
  it('shows a learner\'s own route in a family only', () => {
    const route = { done: 7, total: 9, weeks: 12 };
    expect(ownRouteLine('family', route, 'en')).toBe(m.entries.ownRoute(7, 9, 12));
    expect(ownRouteLine('class', route, 'en')).toBeNull();
    expect(ownRouteLine('school', route, 'en')).toBeNull();
    expect(ownRouteLine('family', null, 'en')).toBeNull();
    expect(ownRouteLine('family', undefined)).toBe(null);
  });
});

describe('Use this route: the draft body', () => {
  it('saves a class route as an unpublished plan for everyone, with its meta', () => {
    const params = toParams(classState(), ['stage1']);
    if (!params) throw new Error('params');
    const draft = generateCurriculum(params, CATALOG);
    const body = draftPlanBody(draft, classState(), 'en');
    expect(body).toMatchObject({ title: 'Route · 4 weeks', publish: false, targetLearnerIds: null });
    expect(body.meta.kind).toBe('curriculum');
    expect(body.meta.params).not.toHaveProperty('completedQuestIds');
    expect(body.items).toEqual(toPlanItems(draft));
    expect(body.items.every((item) => item.week !== undefined && item.week <= body.meta.weeks.length)).toBe(true);
  });

  it('targets the chosen learner of a family', () => {
    const state: WizardState = { ...defaultsFor('family', [learner('kid', '8-9')], TODAY), length: 'custom', customWeeks: 1 };
    const params = toParams(state, ['stage1']);
    if (!params) throw new Error('params');
    const body = draftPlanBody(generateCurriculum(params, CATALOG), state, 'en');
    expect(body).toMatchObject({ title: 'Route · 1 week', targetLearnerIds: ['kid'] });
    expect(draftPlanBody(generateCurriculum(params, CATALOG), { ...state, learnerId: null }, 'en').targetLearnerIds).toBeNull();
  });

  it('dates every item inside the plan window, one per day', () => {
    const params = toParams(classState({ length: '12-week' }), ['stage1']);
    if (!params) throw new Error('params');
    const body = draftPlanBody(generateCurriculum(params, CATALOG), classState({ length: '12-week' }), 'en');
    const dates = body.items.map((i) => i.targetDate ?? '');
    expect(new Set(dates).size).toBe(dates.length);
    for (const date of dates) {
      expect(date >= TODAY).toBe(true);
      expect(date <= addDays(TODAY, 12 * 7 - 1)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// PR P2-6b (FP-B5, FP-B11; OD-12 / OD-13 decided 2026-10-12): the wizard pre-selects
// `proposeRoute`'s pace and length, tags them Suggested, words a preview line per length,
// prefills start, focus, themes and motivation, and a family learner card offers
// **Update the plan** (`reseed`) after a newer level check.
// ---------------------------------------------------------------------------

/** The frozen October 2026 catalogue of the 1.2 goldens (15 Stage 1 lessons, 24 stories ready). */
const FROZEN = CATALOG_2026_10;
/** The Monday of the 1.2 table. */
const MONDAY = '2026-10-12';
const ALL_STAGES = [...StageKeySchema.options];

type Oral = 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5' | 'stage6' | 'stage7';
const placedWith = (stage: 'stage1' | 'stage2' | 'stage3', band: number, oralStage: Oral | null = null) => ({
  placement: { level: { stage, band }, oralStage },
  stage1: { questsDone: 0, questsTotal: 15 },
});
const ctx = (learners: readonly PlannerLearner[], unlockedStages: readonly StageKey[] = ['stage1'], today = MONDAY) => ({ learners, unlockedStages, today, source: FROZEN });

describe('paceOf and the pace chips (OD-13: Gentle 2, Steady 3, Brisk 4)', () => {
  it('names the chip of the rhythm; chosen weekdays win; off the chips is null', () => {
    const base = defaultsFor('family', [], MONDAY);
    expect(PACE_CHOICES).toEqual(['gentle', 'steady', 'brisk']);
    expect(paceOf({ ...base, sessionsPerWeek: 2 })).toBe('gentle');
    expect(paceOf({ ...base, sessionsPerWeek: 3 })).toBe('steady');
    expect(paceOf({ ...base, sessionsPerWeek: 4 })).toBe('brisk');
    expect(paceOf({ ...base, sessionsPerWeek: 5 })).toBeNull();
    expect(paceOf({ ...base, sessionsPerWeek: 2, sessionDays: ['mon', 'wed', 'fri'] })).toBe('steady');
    expect(paceOf({ ...base, sessionsPerWeek: 3, sessionDays: ['mon'] })).toBeNull();
  });

  it('a pace chip sets the sessions and clears chosen weekdays (their count would win)', () => {
    expect(pacePatch('brisk')).toEqual({ sessionsPerWeek: 4, sessionDays: [] });
    expect(pacePatch('gentle')).toEqual({ sessionsPerWeek: 2, sessionDays: [] });
  });

  it('suggests Gentle for a class and a Pictures-first learner, Steady otherwise', () => {
    const kid = learner('kid', '5-7');
    const reader = learner('reader', '10-11');
    expect(suggestedPace(defaultsFor('class', [reader], MONDAY), [reader])).toBe('gentle');
    expect(suggestedPace(defaultsFor('family', [kid], MONDAY), [kid])).toBe('gentle');
    expect(suggestedPace(defaultsFor('family', [reader], MONDAY), [reader])).toBe('steady');
    expect(suggestedPace(defaultsFor('family', [kid, reader], MONDAY), [kid, reader])).toBe('steady');
  });
});

describe('prefilledState: the wizard starts from proposeRoute (section 3.8 steps 1 and 2)', () => {
  it('a new class at Brand new, free tier: Gentle and 12 weeks pre-selected (1.2 column A), 10 minutes for a Pictures-first roster', () => {
    const roster = [learner('a', '5-7'), learner('b', '5-7'), learner('c', '8-9')];
    const state = prefilledState('class', ctx(roster));
    expect(state).toMatchObject({ audience: 'class', start: 'brand-new', sessionsPerWeek: 2, sessionDays: [], length: '12-week', lengthPicked: false, minutesPerSession: 10, startDate: MONDAY, focus: 'balanced', themes: [] });
    expect(paceOf(state)).toBe('gentle');
    expect(wizardProblem(state, MONDAY)).toBeNull();
  });

  it('a family learner who reads words (stage1 band 3): Steady and 4 weeks', () => {
    const family = [learner('sam', '10-11', placedWith('stage1', 3))];
    const state = prefilledState('family', ctx(family));
    expect(state).toMatchObject({ learnerId: 'sam', start: 'reads-words', sessionsPerWeek: 3, length: '4-week', minutesPerSession: 15 });
  });

  it('a Pictures-first family learner gets Gentle and 10 minutes', () => {
    const family = [learner('kid', '5-7')];
    expect(prefilledState('family', ctx(family))).toMatchObject({ learnerId: 'kid', sessionsPerWeek: 2, minutesPerSession: 10, length: '12-week' });
  });

  it('prefills a reading focus when the learner hears far more than they read (F-PLC-001 AM-4)', () => {
    const family = [learner('ana', '10-11', placedWith('stage1', 1, 'stage3'))];
    expect(prefilledState('family', ctx(family)).focus).toBe('reading');
    const near = [learner('ana', '10-11', placedWith('stage1', 1, 'stage2'))];
    expect(prefilledState('family', ctx(near)).focus).toBe('balanced');
  });

  it('waits for the learner in a family of several (no proposal for nobody), then prefills for the pick', () => {
    const family = [learner('a', '5-7'), learner('b', '10-11', placedWith('stage1', 2))];
    const waiting = prefilledState('family', ctx(family));
    expect(waiting.learnerId).toBeNull();
    const picked = prefilledState('family', ctx(family), 'b');
    expect(picked).toMatchObject({ learnerId: 'b', start: 'all-letters', sessionsPerWeek: 3, length: '4-week' });
  });

  it('leaves the length to the grown-up when nothing is ready to plan (proposeRoute is null)', () => {
    const empty = { ...FROZEN, stories: FROZEN.stories.map((story) => ({ ...story, status: 'draft' as const })) };
    const family = [learner('lee', '10-11', placedWith('stage2', 0))];
    const state = prefilledState('family', { ...ctx(family), source: empty });
    expect(state).toMatchObject({ start: 'first-words', length: null, lengthPicked: false });
    expect(wizardProblem(state, MONDAY)).toBe('no-length');
  });

  it('starts a class on a licence with every stage open: 12 weeks at Gentle', () => {
    const state = prefilledState('class', ctx([], ALL_STAGES));
    expect(state).toMatchObject({ sessionsPerWeek: 2, length: '12-week' });
  });
});

describe('followProposal: the suggested length follows the start and the pace until a length is picked', () => {
  const family = [learner('kim', '10-11')];
  const c = ctx(family);

  it('moves the length with the pace (band 2: Gentle 12 weeks, Steady 4 weeks)', () => {
    const start = followProposal({ ...prefilledState('family', c), start: 'all-letters' }, c);
    expect(start).toMatchObject({ sessionsPerWeek: 3, length: '4-week' });
    const gentle = followProposal({ ...start, ...pacePatch('gentle') }, c);
    expect(gentle.length).toBe('12-week');
  });

  it('moves the length with the starting point', () => {
    const base = prefilledState('family', c);
    expect(base.length).toBe('12-week');
    expect(followProposal({ ...base, start: 'reads-words' }, c).length).toBe('4-week');
  });

  it('keeps a length the grown-up picked, and a custom length', () => {
    const picked = { ...prefilledState('family', c), length: '6-month' as const, lengthPicked: true };
    expect(followProposal({ ...picked, start: 'reads-words' }, c).length).toBe('6-month');
    const custom = { ...picked, length: 'custom' as const, customWeeks: 9 };
    expect(followProposal({ ...custom, ...pacePatch('brisk') }, c)).toMatchObject({ length: 'custom', customWeeks: 9 });
  });

  it('keeps the length as it is when the rhythm is off the chips (no proposal)', () => {
    const base = prefilledState('family', c);
    const offChips = followProposal({ ...base, sessionDays: ['mon', 'tue', 'wed', 'thu', 'fri'] }, c);
    expect(offChips.length).toBe(base.length);
    expect(offChips.lengthPicked).toBe(false);
    expect(wizardProposal(offChips, c)).toBeNull();
  });

  it('follows the reading focus with the start until the grown-up picks a focus (F-PLC-001 AM-4)', () => {
    const hearsMore = ctx([learner('ana', '10-11', placedWith('stage1', 1, 'stage3'))]);
    const base = prefilledState('family', hearsMore);
    expect(base.focus).toBe('reading');
    // A much later start: the oral stage is no longer two stages ahead, so the reading focus ends.
    const later = followProposal({ ...base, start: 'first-sentences' }, hearsMore);
    expect(later.focus).toBe('balanced');
    expect(followProposal({ ...later, start: 'some-letters' }, hearsMore).focus).toBe('reading');
    const picked = { ...base, focus: 'culture' as const, focusPicked: true };
    expect(followProposal({ ...picked, start: 'first-sentences' }, hearsMore).focus).toBe('culture');
  });
});

describe('relearnedState: another learner picked in a family keeps what the grown-up chose', () => {
  const family = [learner('kid', '5-7'), learner('sam', '10-11', placedWith('stage1', 3))];
  const c = ctx(family);
  const LATER_DAY = '2026-10-19';

  it('the first pick (nothing touched) is the proposal for that learner', () => {
    expect(relearnedState(prefilledState('family', c), c, 'sam')).toMatchObject({ learnerId: 'sam', start: 'reads-words', sessionsPerWeek: 3, length: '4-week' });
  });

  it('keeps the weekdays, minutes, start day, themes, focus and a picked length on a re-pick', () => {
    const edited = {
      ...relearnedState(prefilledState('family', c), c, 'kid'),
      sessionDays: ['mon', 'wed', 'fri'] as Weekday[],
      minutesPerSession: 20 as const,
      rhythmPicked: true,
      startDate: LATER_DAY,
      themes: ['crafts'] as ThemeKey[],
      goalsPicked: true,
      focus: 'culture' as const,
      focusPicked: true,
      length: '6-month' as const,
      lengthPicked: true,
    };
    expect(relearnedState(edited, c, 'sam')).toMatchObject({
      learnerId: 'sam',
      start: 'reads-words',
      sessionDays: ['mon', 'wed', 'fri'],
      minutesPerSession: 20,
      startDate: LATER_DAY,
      themes: ['crafts'],
      focus: 'culture',
      length: '6-month',
    });
  });

  it('an untouched rhythm follows the new learner (Pictures-first Gentle to Steady), and the length with it', () => {
    const kid = relearnedState(prefilledState('family', c), c, 'kid');
    expect(kid).toMatchObject({ sessionsPerWeek: 2, minutesPerSession: 10 });
    expect(relearnedState(kid, c, 'sam')).toMatchObject({ sessionsPerWeek: 3, minutesPerSession: 15, length: '4-week' });
  });
});

describe('the same input as the app gives the same defaultId and options (section 3.12)', () => {
  it('matches proposeRoute for a self learner at every starting point, pace and tier', () => {
    const routeCatalog = routeCatalogOf(FROZEN);
    for (const start of STARTING_POINT_IDS) {
      for (const pace of PACE_CHOICES) {
        for (const unlocked of [['stage1'] as StageKey[], ALL_STAGES]) {
          const family = [learner('sam', '10-11')];
          const state: WizardState = { ...prefilledState('family', ctx(family, unlocked)), start, ...pacePatch(pace) };
          const level = STARTING_LEVELS[start];
          const app = proposeRoute({
            audience: 'self',
            seed: { level, oralStage: null, placedOutQuestIds: questsPlacedOutAtLevel(level, routeCatalog), themeOrder: themeOrderFor(undefined), startQuestId: null },
            completedQuestIds: [],
            levelOrder: 2,
            pace,
            unlockedStages: unlocked,
            catalog: FROZEN,
            today: MONDAY,
          });
          const wizard = wizardProposal(state, ctx(family, unlocked));
          expect(wizard?.defaultId).toBe(app?.defaultId);
          expect(wizard?.options).toEqual(app?.options);
        }
      }
    }
  });

  it('a level check of band 0 equals no level check at all', () => {
    const family = [learner('sam', '10-11')];
    const state = prefilledState('family', ctx(family));
    const app = proposeRoute({ audience: 'self', seed: null, completedQuestIds: [], levelOrder: 2, unlockedStages: ['stage1'], catalog: FROZEN, today: MONDAY });
    const wizard = wizardProposal(state, ctx(family));
    expect(wizard?.defaultId).toBe(app?.defaultId);
    expect(wizard?.options).toEqual(app?.options);
  });

  it('carries a motivation into the proposal and the params, and reads a cleared start day as today', () => {
    const family = [learner('sam', '10-11')];
    const state: WizardState = { ...prefilledState('family', ctx(family)), motivation: 'kculture' };
    expect(wizardProposal(state, ctx(family))?.params.goals.motivation).toBe('kculture');
    expect(toParams(state, ['stage1'])?.goals).toEqual({ focus: 'balanced', motivation: 'kculture' });
    expect(wizardProposal({ ...state, startDate: '' }, ctx(family))?.params.startDate).toBe(MONDAY);
  });

  it('uses the chosen start day (a class: its next class day)', () => {
    const later = followProposal({ ...prefilledState('class', ctx([])), startDate: '2026-10-18' }, ctx([]));
    expect(wizardProposal(later, ctx([]))?.params.startDate).toBe('2026-10-18');
  });
});

describe('one honest preview line per length (AMENDMENTS 1.3)', () => {
  const words = m.proposal;
  const option = (patch: Partial<DurationOption>): DurationOption => ({
    id: '12-week',
    weeks: 12,
    stats: { lessons: 15, stories: 4, comingSoonItems: 0, openSessions: 0, endsAtStage: 'stage1' },
    lastLessonWeek: 7,
    lastContentWeek: 12,
    preview: 'lessons-and-stories',
    warnings: [],
    ...patch,
  });

  it('words each preview code', () => {
    expect(lengthPreviewText(option({}), 'en')).toBe(words.lessonsAndStories(1, 7));
    expect(lengthPreviewText(option({ preview: 'lessons-and-stories', stats: { lessons: 16, stories: 2, comingSoonItems: 0, openSessions: 0, endsAtStage: 'stage2' }, lastLessonWeek: 12 }), 'en')).toBe(words.lessonsAndStories(2, 12));
    expect(lengthPreviewText(option({ id: '4-week', weeks: 4, preview: 'lessons-cut-short', lastLessonWeek: 7 }), 'en')).toBe(words.lessonsCutShort(4));
    expect(lengthPreviewText(option({ preview: 'lessons-then-free-practice', lastContentWeek: 3 }), 'en')).toBe(words.lessonsThenFree(3));
    expect(lengthPreviewText(option({ id: '4-week', weeks: 4, preview: 'lessons-then-free-practice', lastContentWeek: 4 }), 'en')).toBe(words.lessonsFill(4));
    expect(lengthPreviewText(option({ preview: 'stories-and-words', stats: { lessons: 0, stories: 9, comingSoonItems: 0, openSessions: 3, endsAtStage: 'stage1' } }), 'en')).toBe(words.storiesAndWords(9));
  });

  it('claims Stage 1 is done only when it is, and never claims a finish for a cut-short card', () => {
    expect(words.lessonsAndStories(1, 7)).toContain('Stage 1');
    expect(words.lessonsAndStories(2, 12)).not.toMatch(/Stage \d is done/);
    expect(words.lessonsCutShort(4)).not.toMatch(/done|finish(ed|es)? in/i);
  });

  it('words every real card of the frozen catalogue without a banned word, a price or Premium', () => {
    for (const start of STARTING_POINT_IDS) {
      for (const pace of PACE_CHOICES) {
        const family = [learner('sam', '10-11')];
        const proposal = wizardProposal({ ...prefilledState('family', ctx(family)), start, ...pacePatch(pace) }, ctx(family));
        for (const card of proposal?.options ?? []) {
          const text = lengthPreviewText(card, 'en');
          expect(text.length).toBeGreaterThan(0);
          expect(findBannedWord(text, 'en', 'learner'), text).toBeNull();
          expect(findBannedWord(text, 'en', 'caregiver'), text).toBeNull();
          expect(text).not.toMatch(/premium|\$|price|\b(behind|late|missed|overdue)\b/i);
          if (card.preview === 'lessons-cut-short') expect(card.lastLessonWeek).toBeGreaterThan(card.weeks);
        }
      }
    }
  });

  it('keeps the new pace, suggested and update words free of banned words', () => {
    const texts = [
      m.rhythm.pace,
      m.rhythm.suggested,
      ...PACE_CHOICES.map((pace) => m.rhythm.paceOption(m.rhythm.paces[pace], PACES[pace])),
      m.rhythm.offChips,
      m.update.line('Sam'),
      m.update.cta,
      m.update.label('Sam'),
      m.update.ask(3, 1, 'Meet the Letters'),
      m.update.ask(1, 0, null),
      m.update.done,
      m.update.failed,
    ];
    for (const text of texts) {
      expect(findBannedWord(text, 'en', 'learner'), text).toBeNull();
          expect(findBannedWord(text, 'en', 'caregiver'), text).toBeNull();
      expect(text).not.toMatch(/\b(behind|late|missed|overdue)\b|should have|compared to|premium/i);
    }
  });
});

describe('Update the plan: a family learner card after a newer level check (reseed, console mode)', () => {
  const START = '2026-10-12';
  const LATER = '2026-10-26';
  const familyRoute = (patch: Partial<{ targetLearnerIds: string[] | null; publishedAt: string | null; archivedAt: string | null; start: 'brand-new' | 'reads-words' }> = {}) => {
    const family = [learner('sam', '10-11')];
    const state: WizardState = { ...prefilledState('family', ctx(family, ['stage1'], START)), start: patch.start ?? 'brand-new', length: '12-week', lengthPicked: true };
    const params = toParams(state, ['stage1']);
    if (!params) throw new Error('params');
    const draft = generateCurriculum(params, FROZEN);
    return {
      id: 'plan:route-sam',
      title: 'Route · 12 weeks',
      items: toPlanItems(draft),
      meta: { ...toMeta(draft), horizonDays: 7 },
      targetLearnerIds: patch.targetLearnerIds === undefined ? ['sam'] : patch.targetLearnerIds,
      publishedAt: patch.publishedAt === undefined ? '2026-10-11T09:00:00.000Z' : patch.publishedAt,
      archivedAt: patch.archivedAt ?? null,
      updatedAt: '2026-10-11T09:00:00.000Z',
    };
  };
  const sam = (summary: ReturnType<typeof placedWith> | null) => ({ id: 'sam', summary });

  it('offers an update when the newest check found a later start than the plan\'s', () => {
    const plan = familyRoute();
    const offer = planUpdateOffer('family', sam(placedWith('stage1', 3)), [plan], LATER, FROZEN);
    expect(offer).not.toBeNull();
    expect(offer?.plan.id).toBe('plan:route-sam');
    expect(offer?.level).toEqual({ stage: 'stage1', band: 3 });
    expect(offer?.diff.itemsRemoved).toBeGreaterThan(0);
    expect(offer?.diff.newStartQuestId).toBe('quest:stage1-nature-q2');
  });

  it('saves the same plan, still published, with past items kept, the placed-out lessons gone and the end date unchanged', () => {
    const plan = familyRoute();
    const offer = planUpdateOffer('family', sam(placedWith('stage1', 3)), [plan], LATER, FROZEN);
    if (!offer) throw new Error('offer');
    const body = reseedSaveBody(offer, LATER, '2026-10-26T10:00:00.000Z', FROZEN);
    expect(body).toMatchObject({ id: plan.id, title: plan.title, targetLearnerIds: ['sam'], publish: true });
    expect(body.meta.params.level).toEqual({ stage: 'stage1', band: 3 });
    expect(body.meta.repacedAt).toBe('2026-10-26T10:00:00.000Z');
    expect(body.meta.horizonDays).toBe(7);
    expect(routeEndDate(body.meta)).toBe(routeEndDate(plan.meta));
    const past = (items: readonly PlanItem[]) => items.filter((item) => item.targetDate !== undefined && item.targetDate < LATER);
    expect(past(body.items)).toEqual(past(plan.items));
    const placedOut = new Set(questsPlacedOutAtLevel({ stage: 'stage1', band: 3 }, routeCatalogOf(FROZEN)));
    expect(body.items.filter((item) => item.targetDate !== undefined && item.targetDate >= LATER).some((item) => placedOut.has(item.id))).toBe(false);
    expect(body.items.every((item) => item.week !== undefined && item.week <= body.meta.weeks.length)).toBe(true);
  });

  it('offers nothing for the same or an earlier start, without a check, or for a class or a school', () => {
    const plan = familyRoute({ start: 'reads-words' });
    expect(planUpdateOffer('family', sam(placedWith('stage1', 3)), [plan], LATER, FROZEN)).toBeNull();
    expect(planUpdateOffer('family', sam(placedWith('stage1', 1)), [plan], LATER, FROZEN)).toBeNull();
    expect(planUpdateOffer('family', sam(null), [familyRoute()], LATER, FROZEN)).toBeNull();
    expect(planUpdateOffer('family', { id: 'sam', summary: {} }, [familyRoute()], LATER, FROZEN)).toBeNull();
    expect(planUpdateOffer('class', sam(placedWith('stage1', 3)), [familyRoute()], LATER, FROZEN)).toBeNull();
    expect(planUpdateOffer('school', sam(placedWith('stage1', 3)), [familyRoute()], LATER, FROZEN)).toBeNull();
  });

  it('only updates a live route made for this one learner', () => {
    const check = sam(placedWith('stage1', 3));
    expect(planUpdateOffer('family', check, [familyRoute({ targetLearnerIds: null })], LATER, FROZEN)).toBeNull();
    expect(planUpdateOffer('family', check, [familyRoute({ targetLearnerIds: ['sam', 'ana'] })], LATER, FROZEN)).toBeNull();
    expect(planUpdateOffer('family', check, [familyRoute({ targetLearnerIds: ['ana'] })], LATER, FROZEN)).toBeNull();
    expect(planUpdateOffer('family', check, [familyRoute({ publishedAt: null })], LATER, FROZEN)).toBeNull();
    expect(planUpdateOffer('family', check, [familyRoute({ archivedAt: '2026-10-20T00:00:00.000Z' })], LATER, FROZEN)).toBeNull();
    const { meta: _meta, ...classic } = familyRoute();
    expect(planUpdateOffer('family', check, [{ ...classic, meta: null }], LATER, FROZEN)).toBeNull();
  });

  it('picks the newest live route of the learner', () => {
    const older = { ...familyRoute(), id: 'plan:older', publishedAt: '2026-10-01T00:00:00.000Z' };
    const newer = familyRoute();
    expect(planUpdateOffer('family', sam(placedWith('stage1', 3)), [older, newer], LATER, FROZEN)?.plan.id).toBe('plan:route-sam');
  });

  it('skips a stored meta this build cannot read (a newer Worker\'s shape) and never throws in render', () => {
    const check = sam(placedWith('stage1', 3));
    const plan = familyRoute();
    const newer = { ...plan, meta: { ...plan.meta, params: { ...plan.meta.params, goals: { focus: 'speaking' } } } } as unknown as typeof plan;
    expect(() => planUpdateOffer('family', check, [newer], LATER, FROZEN)).not.toThrow();
    expect(planUpdateOffer('family', check, [newer], LATER, FROZEN)).toBeNull();
    const badDate = { ...plan, meta: { ...plan.meta, params: { ...plan.meta.params, startDate: 'soon' } } };
    expect(planUpdateOffer('family', check, [badDate], LATER, FROZEN)).toBeNull();
    // An older readable route still gets its offer when the newest one is unreadable.
    const older = { ...plan, id: 'plan:older', publishedAt: '2026-10-01T00:00:00.000Z' };
    expect(planUpdateOffer('family', check, [newer, older], LATER, FROZEN)?.plan.id).toBe('plan:older');
  });

  it('every placement level places out no more lessons than the params hold (120 since F-CURR-001 S2-3 made it 41), so the seed never throws', () => {
    for (const stage of StageKeySchema.options) {
      for (const band of [0, 1, 2, 3]) {
        expect(questsPlacedOutAtLevel({ stage, band }, routeCatalogOf(CATALOG)).length).toBeLessThanOrEqual(120);
      }
    }
  });

  it('offers nothing once the route has ended (nothing ahead to move)', () => {
    expect(planUpdateOffer('family', sam(placedWith('stage1', 3)), [familyRoute()], '2027-02-01', FROZEN)).toBeNull();
  });

  it('words the card line and the confirm', () => {
    expect(m.update.line('Sam')).toBe("Sam's newest check found a later place to start.");
    expect(m.update.cta).toBe('Update the plan');
    expect(updateAskText({ itemsRemoved: 3, itemsAdded: 1, newStartQuestId: 'quest:stage1-nature-q2' }, 'en', FROZEN)).toBe(
      m.update.ask(3, 1, FROZEN.quests.find((quest) => quest.id === 'quest:stage1-nature-q2')?.title ?? ''),
    );
    expect(updateAskText({ itemsRemoved: 2, itemsAdded: 0, newStartQuestId: null }, 'en', FROZEN)).toBe(m.update.ask(2, 0, null));
  });

  it('words only the joins when nothing leaves, and no count when nothing changes in number', () => {
    expect(m.update.ask(0, 2, null)).toBe('Update the plan? It moves ahead from today and keeps the same end date. 2 items join the plan. What is done stays done.');
    expect(m.update.ask(0, 0, null)).toBe('Update the plan? It moves ahead from today and keeps the same end date. What is done stays done.');
    expect(m.update.ask(1, 1, null)).toBe('Update the plan? It moves ahead from today and keeps the same end date. 1 item leaves the plan, 1 joins it. What is done stays done.');
    expect(m.update.ask(0, 2, null)).not.toMatch(/\b0\b/);
  });

  it('the Spanish console words the pace chips, the preview lines and Update the plan (no English fallback)', () => {
    const es = getMessages('es').console.curriculum;
    expect(es.rhythm.paceOption(es.rhythm.paces.gentle, 2)).toBe('Suave · 2 días por semana');
    expect(es.rhythm.suggested).toBe('Sugerido');
    expect(es.update.cta).toBe('Actualizar el plan');
    expect(es.update.ask(0, 1, null)).not.toMatch(/\b0\b/);
    expect(lengthPreviewText({ preview: 'lessons-cut-short', weeks: 4 } as Parameters<typeof lengthPreviewText>[0], 'es')).toBe(es.proposal.lessonsCutShort(4));
    expect(es.proposal.lessonsCutShort(4)).not.toBe(m.proposal.lessonsCutShort(4));
  });
});
