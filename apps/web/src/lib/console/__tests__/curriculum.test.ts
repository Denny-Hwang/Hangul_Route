import {
  CATALOG,
  CurriculumParamsSchema,
  addDays,
  generateCurriculum,
  toMeta,
  toPlanItems,
  type Catalog,
  type CurriculumMeta,
  type Entitlement,
  type PlanItem,
  type WeekMeta,
} from '@hangul-route/content-schema';
import { findBannedWord, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  STARTING_LEVELS,
  STARTING_POINT_IDS,
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

/** Every story signed off, so culture weeks and story labels appear (the shipped catalogue still has them as drafts). */
const READY: Catalog = { ...CATALOG, stories: CATALOG.stories.map((story) => ({ ...story, status: 'ready' as const })) };

function classPlan(patch: Partial<WizardState> = {}): { id: string; meta: CurriculumMeta; items: PlanItem[] } {
  const params = toParams(classState(patch), ['stage1']);
  if (!params) throw new Error('params');
  const draft = generateCurriculum(params, CATALOG);
  return { id: 'plan:route', meta: toMeta(draft), items: toPlanItems(draft) };
}

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
      { kind: 'episode', id: 'episode:stage2-letters', week: 9, note: 'Coming soon' },
      { kind: 'quest', id: 'quest:stage1-rites-q1', targetDate: '2027-03-01' },
    ];
    const { rows, unscheduled } = weekGroups(plan.meta.weeks, items);
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
  const row = (w: WeekMeta, items: PlanItem[] = []) => weekGroups([w], items.map((i) => ({ ...i, week: 1 }))).rows[0]!;

  it('names review, break and culture weeks', () => {
    expect(weekLabel(row(week({ kind: 'review' })), 'en')).toBe('Review and collect');
    expect(weekLabel(row(week({ kind: 'break' })), 'en')).toBe('Days off');
    expect(weekLabel(row(week({ kind: 'culture', focus: { episodeId: null, storyIds: ['story:sejong-new-letters'], festival: null } })), 'en', READY)).toBe("Culture week: King Sejong's New Letters");
    expect(weekLabel(row(week({ kind: 'culture', focus: { episodeId: null, storyIds: ['story:nope'], festival: null } })), 'en')).toBe('Culture week');
  });

  it('names a learn week by its lesson, its stories, its coming-soon items or free practice', () => {
    expect(weekLabel(row(week({ focus: { episodeId: 'episode:stage1-nature', storyIds: [], festival: null } })), 'en')).toBe('Tigers, Mountains, Moon');
    expect(weekLabel(row(week({ focus: { episodeId: null, storyIds: ['story:sun-and-moon'], festival: null } })), 'en')).toBe('Heritage stories');
    expect(weekLabel(row(week({}), [{ kind: 'episode', id: 'episode:stage2-letters' }]), 'en')).toBe('New episodes are on the way');
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
    expect(result.items.map((i) => i.id)).toEqual(items.map((i) => i.id));
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
    const plan = classPlan({ length: '12-week', start: 'first-words' });
    expect(plan.items.every((item) => item.kind === 'episode')).toBe(true);
    const squeezed = { ...plan, meta: { ...plan.meta, params: { ...plan.meta.params, daysOff: [{ from: '2026-11-01', to: '2027-01-09' }] } } };
    const result = repacePlan(squeezed, '2026-10-26', '2026-10-26T09:00:00.000Z');
    expect(result.items).toHaveLength(plan.items.length - 1);
    expect(result.leftOver).toBe(1);
    expect(weeksToFit(squeezed, '2026-10-26')).toBe(1);
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

  it('offers Refresh route on every route saved from catalogue version 1, 2 or 3 (F-QUEST-002 Q-6a bumps it to 2, Q-6b to 3, Q-7b to 4)', () => {
    expect(CATALOG.version).toBe(4);
    expect(v1Plan('brand-new').meta.catalogVersion).toBe(1);
    expect(isStaleCatalog(v1Plan('brand-new').meta)).toBe(true);
    expect(isStaleCatalog(v1Plan('some-letters').meta)).toBe(true);
    // A route saved between Q-6a and Q-6b (version 2, before life q3 joined) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 2 })).toBe(true);
    // A route saved between Q-6b and Q-7b (version 3, before rites q2-q3 joined) asks once too.
    expect(isStaleCatalog({ ...v1Plan('brand-new').meta, catalogVersion: 3 })).toBe(true);
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
