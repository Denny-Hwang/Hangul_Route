import {
  JourneySummarySchema,
  pickGoal,
  ProgressSnapshotSchema,
  RouteGoalSummarySchema,
  type CurriculumMeta,
  type InboxPlan,
  type PlanItem,
  type SelfRoute,
  type StageKey,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { stageAvailability } from '../../journey';
import { buildMyRoute } from '../model';
import { gridEpisodesOf } from '../order';
import { journeySummaryOf, routeGoalSummaryOf, summarizeJourney, type JourneyContent } from '../summary';
import { BUNDLE_15, BUNDLE_8, STAGE1_8, STAGE_DEFS, THEME_DEFS, catalogOf, snapshotWith, type Bundle } from './fixtures/bundle-2026-10';
import { seed } from './fixtures/route';

const model = (done: string[], bundle: Bundle = BUNDLE_8, extra = {}, route = null as ReturnType<typeof seed> | null) =>
  buildMyRoute({
    snapshot: snapshotWith(done, extra),
    catalog: catalogOf(bundle),
    episodes: bundle.episodes,
    quests: bundle.quests,
    cards: [],
    stages: STAGE_DEFS,
    themes: THEME_DEFS,
    isEntitled: () => true,
    route,
    now: new Date('2026-10-11T00:00:00.000Z'),
  });

describe('summarizeJourney (F-ROUTE-001 section 3.12)', () => {
  it('Appendix C', () => {
    const summary = summarizeJourney(model(['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3', 'quest:stage1-life-q1']));
    expect(summary.v).toBe(1);
    expect(summary.here).toBe('stage1');
    expect(summary.stages.slice(0, 4)).toEqual([
      { stage: 'stage1', state: 'open', done: 4, known: 0, total: 8 },
      { stage: 'stage2', state: 'open', done: 0, known: 0, total: 2 },
      { stage: 'stage3', state: 'later', done: 0, known: 0, total: 0 },
      { stage: 'stage4', state: 'open', done: 0, known: 0, total: 1 },
    ]);
  });

  it('equals the rows, with at most seven entries', () => {
    const m = model([], BUNDLE_8, {}, seed(STAGE1_8));
    const summary = summarizeJourney(m);
    expect(summary.stages).toHaveLength(7);
    expect(summary.stages.length).toBeLessThanOrEqual(7);
    summary.stages.forEach((s, i) => {
      const r = m.stages[i];
      expect(s).toEqual({ stage: r?.stage, state: r?.state, done: r?.done, known: r?.known, total: (r?.pips.filter((p) => p.kind === 'quest').length ?? 0) + (r?.newPips.length ?? 0) });
    });
    expect(summary.stages[0]).toMatchObject({ state: 'known', known: 8, done: 0 });
  });

  it('counts new quests of a latched stage in the total', () => {
    const summary = summarizeJourney(model(STAGE1_8, BUNDLE_15, { stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z' } }));
    expect(summary.stages[0]).toEqual({ stage: 'stage1', state: 'complete', done: 8, known: 0, total: 15 });
  });

  it('has a null here only for a model without a here row', () => {
    const m = model([]);
    expect(summarizeJourney({ ...m, stages: m.stages.map((s) => ({ ...s, here: false })) }).here).toBeNull();
  });

  it('is small: stage-level counts only', () => {
    const summary = summarizeJourney(model(STAGE1_8));
    expect(JSON.stringify(summary).length).toBeLessThan(600);
    expect(Object.keys(summary).sort()).toEqual(['here', 'stages', 'v']);
  });
});

describe('the wire shape (F-ROUTE-001 R-8)', () => {
  it('parses with JourneySummarySchema unchanged, at most seven entries', () => {
    for (const m of [model([]), model(STAGE1_8), model([], BUNDLE_8, {}, seed(STAGE1_8)), model(STAGE1_8, BUNDLE_15, { stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z' } })]) {
      const summary = summarizeJourney(m);
      expect(JourneySummarySchema.parse(summary)).toEqual(summary);
      expect(summary.stages.length).toBeLessThanOrEqual(7);
    }
  });
});

describe('journeySummaryOf: the sync-store input (F-ROUTE-001 R-8)', () => {
  const content = (bundle: Bundle = BUNDLE_8): JourneyContent => ({
    catalog: catalogOf(bundle),
    episodes: bundle.episodes,
    quests: bundle.quests,
    cards: [],
    stages: STAGE_DEFS,
    themes: THEME_DEFS,
    isEntitled: () => true,
  });
  const now = new Date('2026-10-11T00:00:00.000Z');

  it('equals summarizeJourney(buildMyRoute(...)) with no route when no level check is stored', () => {
    const snapshot = snapshotWith(['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3', 'quest:stage1-life-q1']);
    const summary = journeySummaryOf(snapshot, content(), now);
    expect(summary).toEqual({ ...summarizeJourney(buildMyRoute({ snapshot, ...content(), route: null, now })), seeded: true });
    expect(summary?.stages[0]).toEqual({ stage: 'stage1', state: 'open', done: 4, known: 0, total: 8 });
  });

  it('a fresh learner sends seven stages, here on Stage 1, nothing done', () => {
    const summary = journeySummaryOf(ProgressSnapshotSchema.parse(snapshotWith([])), content(), now);
    expect(summary?.here).toBe('stage1');
    expect(summary?.stages).toHaveLength(7);
    expect(summary?.stages.every((s) => s.done === 0 && s.known === 0)).toBe(true);
  });

  it('marks every journey it builds as seeded from the placement route, so the console can tell it from an older build', () => {
    expect(journeySummaryOf(snapshotWith([]), content(), now)?.seeded).toBe(true);
    expect(summarizeJourney(buildMyRoute({ snapshot: snapshotWith([]), ...content(), route: null, now }))).not.toHaveProperty('seeded');
  });

  it('never throws: a snapshot it cannot read gives no journey, so the upload goes on without it', () => {
    const broken = { ...snapshotWith([]), quests: null } as unknown as Parameters<typeof journeySummaryOf>[0];
    expect(journeySummaryOf(broken, content(), now)).toBeUndefined();
  });
});

describe('routeGoalSummaryOf: summary.routeGoal for the family space (Learning Route section 9, LR-6)', () => {
  const content = { catalog: catalogOf(BUNDLE_8), episodes: BUNDLE_8.episodes };
  const now = new Date('2026-10-11T08:00:00.000Z');
  const journeyOf = (done: string[] = []) => journeySummaryOf(snapshotWith(done), { ...content, quests: BUNDLE_8.quests, cards: [], stages: STAGE_DEFS, themes: THEME_DEFS, isEntitled: () => true }, now);

  /** A four-week curriculum meta starting on `start` (the shape `CurriculumMetaSchema` stores). */
  const meta = (start = '2026-10-05', weeks = 4): CurriculumMeta => ({
    kind: 'curriculum',
    generatorVersion: 1,
    catalogVersion: 4,
    params: {
      audience: 'class',
      level: { stage: 'stage1', band: 0 },
      startDate: start,
      weeks,
      sessionsPerWeek: 2,
      minutesPerSession: 10,
      daysOff: [],
      goals: { focus: 'balanced' },
      includeComingSoon: true,
      culturalAnchors: true,
      unlockedStages: ['stage1'],
    },
    weeks: Array.from({ length: weeks }, (_, i) => ({
      index: i + 1,
      startDate: new Date(Date.parse(`${start}T00:00:00.000Z`) + 7 * i * 86_400_000).toISOString().slice(0, 10),
      kind: 'learn' as const,
      focus: { episodeId: null, storyIds: [], festival: null },
      extras: [],
    })),
    horizonDays: 7,
    repacedAt: null,
  });
  const quest = (id: string): PlanItem => ({ kind: 'quest', id });
  const plan = (o: Partial<InboxPlan> & Pick<InboxPlan, 'id' | 'spaceKind'>): InboxPlan => ({
    spaceId: `space:${o.spaceKind}`,
    spaceName: 'Space',
    title: 'Weekly plan',
    items: [quest('quest:stage2-life-q1')],
    publishedAt: '2026-10-05T09:00:00.000Z',
    updatedAt: '2026-10-05T09:00:00.000Z',
    meta: meta(),
    ...o,
  });
  const selfRoute = (o: Partial<SelfRoute> = {}): SelfRoute => ({
    id: 'route:own',
    createdAt: '2026-10-06T09:00:00.000Z',
    updatedAt: '2026-10-06T09:00:00.000Z',
    archivedAt: null,
    meta: meta(),
    items: [quest('quest:stage4-rites-q1')],
    ...o,
  });
  const goalOf = (o: { plans?: InboxPlan[]; self?: SelfRoute; done?: string[]; journey?: ReturnType<typeof journeyOf> | null } = {}) =>
    routeGoalSummaryOf({
      snapshot: snapshotWith(o.done ?? [], o.self ? { selfRoute: o.self } : {}),
      plans: o.plans ?? [],
      journey: o.journey === null ? undefined : (o.journey ?? journeyOf(o.done)),
      content,
      now,
    });

  it("with no plan sends Hoya's default: the first open stage", () => {
    expect(goalOf()).toEqual({ stage: 'stage1', from: 'default' });
  });

  it('a live class curriculum plan sets the goal to its highest lesson stage', () => {
    expect(goalOf({ plans: [plan({ id: 'plan:c', spaceKind: 'class' })] })).toEqual({ stage: 'stage2', from: 'class' });
  });

  it('ranks class over family and school, and both over the own weekly plan (LR-OD-4)', () => {
    const family = plan({ id: 'plan:f', spaceKind: 'family', items: [quest('quest:stage4-rites-q1')], publishedAt: '2026-10-09T09:00:00.000Z' });
    const school = plan({ id: 'plan:s', spaceKind: 'school', items: [quest('quest:stage1-life-q1')], publishedAt: '2026-10-08T09:00:00.000Z' });
    const klass = plan({ id: 'plan:c', spaceKind: 'class', items: [quest('quest:stage1-letters-q1')], publishedAt: '2026-10-01T09:00:00.000Z' });
    expect(goalOf({ plans: [family, klass], self: selfRoute() })).toEqual({ stage: 'stage1', from: 'class' });
    // Family and school share a rank: the newest publishedAt wins.
    expect(goalOf({ plans: [school, family], self: selfRoute() })).toEqual({ stage: 'stage4', from: 'family' });
    expect(goalOf({ plans: [], self: selfRoute() })).toEqual({ stage: 'stage4', from: 'self' });
  });

  it('ignores a classic plan, a finished plan and an archived own plan', () => {
    const classic = plan({ id: 'plan:old', spaceKind: 'class', meta: null });
    const stored = plan({ id: 'plan:stored', spaceKind: 'class' });
    delete stored.meta;
    // Four weeks from Sep 7: the last day is Oct 4, before today (Oct 11).
    const finished = plan({ id: 'plan:done', spaceKind: 'family', meta: meta('2026-09-07') });
    expect(goalOf({ plans: [classic, stored, finished], self: selfRoute({ archivedAt: '2026-10-07T00:00:00.000Z' }) })).toEqual({ stage: 'stage1', from: 'default' });
  });

  it('keeps a plan on its last day (inclusive) and drops it the day after', () => {
    // Four weeks from Sep 14: the last day is Oct 11, today.
    expect(goalOf({ plans: [plan({ id: 'plan:c', spaceKind: 'class', meta: meta('2026-09-14') })] })).toEqual({ stage: 'stage2', from: 'class' });
    expect(goalOf({ plans: [plan({ id: 'plan:c', spaceKind: 'class', meta: meta('2026-09-13') })] })).toEqual({ stage: 'stage1', from: 'default' });
  });

  it('is the goal pickGoal gives the page over the same sources, stage rows and bundle, reduced to stage and source', () => {
    const plans = [plan({ id: 'plan:c', spaceKind: 'class' }), plan({ id: 'plan:f', spaceKind: 'family', items: [quest('quest:stage4-rites-q1')] })];
    const journey = journeyOf(STAGE1_8);
    const grid = gridEpisodesOf(BUNDLE_8.episodes);
    const full = pickGoal({
      sources: plans.map((p) => ({ id: p.id, kind: p.spaceKind, assignedAt: p.publishedAt, items: p.items, meta: p.meta ?? null })),
      catalog: content.catalog,
      stages: journey?.stages ?? [],
      availability: (stage: StageKey) => stageAvailability(stage, grid),
      today: '2026-10-11',
    });
    expect(full).not.toBeNull();
    expect(goalOf({ plans, done: STAGE1_8, journey })).toEqual({ stage: full?.stage, from: full?.from });
  });

  it('sends only the stage and the source code, which parse with RouteGoalSummarySchema', () => {
    const goal = goalOf({ plans: [plan({ id: 'plan:c', spaceKind: 'class' })] });
    expect(Object.keys(goal ?? {}).sort()).toEqual(['from', 'stage']);
    expect(RouteGoalSummarySchema.parse(goal)).toEqual(goal);
  });

  it('moves the default goal on as stages finish, and sends nothing at the end of the open road', () => {
    const journey = journeyOf();
    const at = (states: Partial<Record<StageKey, 'complete' | 'explored' | 'known'>>) =>
      goalOf({ journey: journey ? { ...journey, stages: journey.stages.map((s) => ({ ...s, state: states[s.stage] ?? s.state })) } : undefined });
    expect(at({ stage1: 'complete' })).toEqual({ stage: 'stage2', from: 'default' });
    expect(at({ stage1: 'complete', stage2: 'explored' })).toEqual({ stage: 'stage4', from: 'default' });
    expect(at({ stage1: 'known', stage2: 'explored', stage4: 'explored' })).toBeUndefined();
  });

  it('without stage rows still sends a plan goal, and no default goal', () => {
    expect(goalOf({ journey: null })).toBeUndefined();
    expect(goalOf({ journey: null, plans: [plan({ id: 'plan:c', spaceKind: 'class' })] })).toEqual({ stage: 'stage2', from: 'class' });
  });

  it('never throws: a stored plan it cannot read gives no goal, so the upload goes on without it', () => {
    const broken = plan({ id: 'plan:c', spaceKind: 'class', meta: { ...meta(), weeks: null } as unknown as CurriculumMeta });
    expect(goalOf({ plans: [broken] })).toBeUndefined();
  });
});
