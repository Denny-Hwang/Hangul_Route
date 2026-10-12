import type { Episode, HomeworkAssignment, InboxPlan, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import type { CursorContext } from '../cursor-context';
import { assignmentsForToday } from '../homework/assignment-merger';
import type { DeriveSource } from '../homework/plan-derivation';
import {
  inAPlan,
  isOffPlan,
  nextStartedEvent,
  offplanFinishedEvent,
  planBeforeOf,
  planView,
  qualifiesForNext,
  routeNext,
  routeNextInputOf,
  type PlanBefore,
  type PlanView,
  type RouteNextInput,
} from '../route-next';
import { episodeOf, plainQuest, snapshotWith } from '../stage1/__tests__/fixtures';
import { selfRoute } from '../homework/__tests__/curriculum-fixture';

const P = 'profile:p1';
const TODAY = '2026-10-12'; // a Monday
const QUESTS: Quest[] = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'].map((k) => plainQuest(`quest:${k}`));
const EPISODES: Episode[] = [
  episodeOf('episode:s1-letters', ['quest:q1', 'quest:q2', 'quest:q3']),
  episodeOf('episode:s1-life', ['quest:q4', 'quest:q5'], { theme: 'life', status: 'ready' }),
  episodeOf('episode:s2-life', ['quest:q6'], { stage: 'stage2', theme: 'life' }),
  episodeOf('episode:soon', ['quest:q7'], { theme: 'rites', status: 'preview' }),
  episodeOf('episode:s4-rites', ['quest:q8'], { stage: 'stage4', theme: 'rites' }),
];

const episodeIdOf = (questId: string): string => EPISODES.find((e) => e.questIds.includes(questId))?.id ?? 'episode:unknown';

function snap(done: string[] = [], homework: HomeworkAssignment[] = []): ProgressSnapshot {
  return { ...snapshotWith(done.map((k) => ({ questId: `quest:${k}`, episodeId: episodeIdOf(`quest:${k}`) }))), homework };
}

function hw(sourceId: string | null, k: string, targetDate: string, extra: Partial<HomeworkAssignment> = {}): HomeworkAssignment {
  const questId = `quest:${k}`;
  return {
    id: sourceId === null ? `hw:${k}` : `${sourceId}#${questId}`,
    profileId: P,
    questId,
    episodeId: episodeIdOf(questId),
    assignedBy: 'teacher',
    assignedAt: '2026-10-01T00:00:00.000Z',
    targetDate,
    ...extra,
  };
}

function source(id: string, kind: DeriveSource['kind'], keys: string[], assignedAt = '2026-10-01T00:00:00.000Z'): DeriveSource {
  return { id, kind, assignedAt, items: keys.map((k) => (k.startsWith('episode:') ? { kind: 'episode' as const, id: k } : { kind: 'quest' as const, id: `quest:${k}` })), meta: null };
}

const OPEN_CURSOR: CursorContext = { isEntitled: () => true, skipQuestIds: undefined };
const allOpen = (): boolean => true;
const closed =
  (...keys: string[]) =>
  (questId: string): boolean =>
    !keys.map((k) => `quest:${k}`).includes(questId);

function input(over: Partial<RouteNextInput> = {}): RouteNextInput {
  return {
    snapshot: snap(),
    profileId: P,
    today: TODAY,
    sources: [],
    quests: QUESTS,
    episodes: EPISODES,
    cursor: OPEN_CURSOR,
    isQuestOpen: allOpen,
    gating: { active: false, tier: 'premium' },
    ...over,
  };
}

describe('routeNext: no plan (step 3, the default route)', () => {
  it('is the cursor: the first unfinished playable quest, source cursor, no source id', () => {
    expect(routeNext(input())).toEqual({
      kind: 'quest',
      questId: 'quest:q1',
      episodeId: 'episode:s1-letters',
      stage: 'stage1',
      source: 'cursor',
      sourceId: null,
    });
  });

  it('counts justCompleted as done', () => {
    expect(routeNext(input({ snapshot: snap(['q1']), justCompleted: 'quest:q2' }))).toMatchObject({ questId: 'quest:q3' });
  });

  it('skips closed quests on the cursor', () => {
    expect(routeNext(input({ snapshot: snap(['q1', 'q2', 'q3', 'q4', 'q5']), isQuestOpen: closed('q6') }))).toMatchObject({
      questId: 'quest:q8',
      stage: 'stage4',
    });
  });

  it('follows the cursor stage predicate', () => {
    const cursor: CursorContext = { isEntitled: (s) => s === 'stage1', skipQuestIds: undefined };
    expect(routeNext(input({ snapshot: snap(['q1', 'q2', 'q3', 'q4', 'q5']), cursor }))).toEqual({ kind: 'rest' });
  });
});

describe('routeNext: step 1, due now (the same function as Home card 2)', () => {
  it('is the first item of assignmentsForToday, with the plan source kind and the assignment id', () => {
    const s = snap([], [hw('plan:fam', 'q4', TODAY, { assignedBy: 'parent' }), hw('plan:cls', 'q5', '2026-10-15')]);
    const sources = [source('plan:cls', 'class', ['q5']), source('plan:fam', 'family', ['q4'])];
    const due = assignmentsForToday(s.homework, P, TODAY);
    const next = routeNext(input({ snapshot: s, sources }));
    expect(next).toEqual({
      kind: 'quest',
      questId: due[0]!.questId,
      episodeId: 'episode:s1-life',
      stage: 'stage1',
      source: 'family',
      sourceId: 'plan:fam',
      assignmentId: 'plan:fam#quest:q4',
    });
  });

  it('the Thursday class item and the today family item: Next is the family item, In your plan marks the class plan', () => {
    const s = snap([], [hw('plan:cls', 'q5', '2026-10-15'), hw('plan:fam', 'q2', TODAY, { assignedBy: 'parent' })]);
    const i = input({ snapshot: s, sources: [source('plan:cls', 'class', ['q5']), source('plan:fam', 'family', ['q2'])] });
    expect(routeNext(i)).toMatchObject({ questId: 'quest:q2', source: 'family' });
    const view = planView(i);
    expect(view.leadingSourceId).toBe('plan:cls');
    expect(view.leadingKind).toBe('class');
    expect([...view.inPlanQuestIds]).toEqual(['quest:q5']);
    expect([...view.inPlanEpisodeIds]).toEqual(['episode:s1-life']);
  });

  it('an item dated last week is still next today, and never late', () => {
    const s = snap([], [hw('plan:cls', 'q3', '2026-10-05')]);
    expect(routeNext(input({ snapshot: s, sources: [source('plan:cls', 'class', ['q3'])] }))).toMatchObject({ questId: 'quest:q3', source: 'class' });
  });

  it('maps an explicit assignment by who assigned it: teacher -> class, parent -> family, system -> self', () => {
    for (const [assignedBy, kind] of [
      ['teacher', 'class'],
      ['parent', 'family'],
      ['system', 'self'],
    ] as const) {
      const s = snap([], [hw(null, 'q4', TODAY, { assignedBy })]);
      expect(routeNext(input({ snapshot: s }))).toMatchObject({ questId: 'quest:q4', source: kind, sourceId: null, assignmentId: 'hw:q4' });
    }
  });

  it('a plan item whose source left the list maps by who assigned it and keeps its source id', () => {
    const s = snap([], [hw('plan:gone', 'q4', TODAY, { assignedBy: 'parent' })]);
    expect(routeNext(input({ snapshot: s }))).toMatchObject({ source: 'family', sourceId: 'plan:gone' });
  });

  it('skips items that do not qualify: done, just completed, closed, unknown, unplayable, another profile, finished', () => {
    const s = snap(
      ['q1'],
      [
        hw('plan:cls', 'q1', TODAY),
        hw('plan:cls', 'q2', TODAY),
        hw('plan:cls', 'q6', TODAY),
        hw('plan:cls', 'nope', TODAY),
        hw('plan:cls', 'q7', TODAY),
        hw('plan:cls', 'q4', TODAY, { profileId: 'profile:other' }),
        hw('plan:cls', 'q5', TODAY, { completedAt: '2026-10-11T10:00:00.000Z' }),
        hw('plan:cls', 'q8', TODAY),
      ],
    );
    const i = input({ snapshot: s, sources: [source('plan:cls', 'class', ['q1', 'q2', 'q6', 'nope', 'q7', 'q4', 'q5', 'q8'])] });
    expect(routeNext({ ...i, justCompleted: 'quest:q2', isQuestOpen: closed('q6') })).toMatchObject({ questId: 'quest:q8', source: 'class' });
  });
});

describe('routeNext: step 2, the leading source', () => {
  it('dates never filter: an item dated next month is the next step today', () => {
    const s = snap([], [hw('route:mine', 'q5', '2026-11-20', { assignedBy: 'system' })]);
    expect(routeNext(input({ snapshot: s, sources: [source('route:mine', 'self', ['q5'])] }))).toEqual({
      kind: 'quest',
      questId: 'quest:q5',
      episodeId: 'episode:s1-life',
      stage: 'stage1',
      source: 'self',
      sourceId: 'route:mine',
      assignmentId: 'route:mine#quest:q5',
    });
  });

  it('ranks class first, then family and school, then self', () => {
    const s = snap(
      [],
      [
        hw('route:mine', 'q2', '2026-10-13', { assignedBy: 'system' }),
        hw('plan:fam', 'q3', '2026-10-14', { assignedBy: 'parent' }),
        hw('plan:cls', 'q4', '2026-10-16'),
      ],
    );
    const self = source('route:mine', 'self', ['q2']);
    const fam = source('plan:fam', 'family', ['q3']);
    const cls = source('plan:cls', 'class', ['q4']);
    expect(routeNext(input({ snapshot: s, sources: [self, fam, cls] }))).toMatchObject({ questId: 'quest:q4', source: 'class' });
    expect(routeNext(input({ snapshot: s, sources: [self, fam] }))).toMatchObject({ questId: 'quest:q3', source: 'family' });
    expect(routeNext(input({ snapshot: s, sources: [self] }))).toMatchObject({ questId: 'quest:q2', source: 'self' });
  });

  it('school ranks with family; inside one rank the newest assignedAt leads', () => {
    const s = snap([], [hw('plan:school', 'q3', '2026-10-14', { assignedBy: 'parent' }), hw('plan:fam', 'q4', '2026-10-13', { assignedBy: 'parent' })]);
    const older = source('plan:fam', 'family', ['q4'], '2026-09-01T00:00:00.000Z');
    const newer = source('plan:school', 'school', ['q3'], '2026-10-01T00:00:00.000Z');
    expect(routeNext(input({ snapshot: s, sources: [older, newer] }))).toMatchObject({ questId: 'quest:q3', source: 'school', sourceId: 'plan:school' });
  });

  it('a curriculum and a classic plan in the same rank: the newest leads, and classic plans count', () => {
    const s = snap([], [hw('plan:curr', 'q3', '2026-10-14'), hw('plan:classic', 'q5', '2026-10-13')]);
    const curriculum: DeriveSource = { ...source('plan:curr', 'class', ['q3'], '2026-09-01T00:00:00.000Z'), meta: selfRoute().meta };
    const classic = source('plan:classic', 'class', ['q5'], '2026-10-02T00:00:00.000Z');
    expect(routeNext(input({ snapshot: s, sources: [curriculum, classic] }))).toMatchObject({ questId: 'quest:q5', sourceId: 'plan:classic' });
  });

  it('inside the source: the earliest targetDate, then the source list order (episode items expand in quest order)', () => {
    const s = snap(
      [],
      [hw('plan:cls', 'q5', '2026-10-14'), hw('plan:cls', 'q4', '2026-10-14'), hw('plan:cls', 'q8', '2026-10-13'), hw('plan:cls', 'q1', '2026-10-14')],
    );
    const sources = [source('plan:cls', 'class', ['episode:s1-life', 'q1', 'q8'])];
    expect(routeNext(input({ snapshot: s, sources }))).toMatchObject({ questId: 'quest:q8' });
    const later = snap([], s.homework.filter((h) => h.questId !== 'quest:q8'));
    expect(routeNext(input({ snapshot: later, sources }))).toMatchObject({ questId: 'quest:q4' });
  });

  it('an item missing from the source list comes after the listed ones on the same date', () => {
    const s = snap([], [hw('plan:cls', 'q2', '2026-10-14'), hw('plan:cls', 'q3', '2026-10-14')]);
    expect(routeNext(input({ snapshot: s, sources: [source('plan:cls', 'class', ['q3', 'episode:missing'])] }))).toMatchObject({ questId: 'quest:q3' });
    expect(routeNext(input({ snapshot: s, sources: [source('plan:cls', 'class', ['episode:missing'])] }))).toMatchObject({ questId: 'quest:q2' });
  });

  it('the next source leads when the higher one has nothing that qualifies (closed or done)', () => {
    const s = snap(['q2'], [hw('plan:cls', 'q6', '2026-10-14'), hw('plan:cls', 'q2', '2026-10-14'), hw('plan:fam', 'q4', '2026-10-15', { assignedBy: 'parent' })]);
    const sources = [source('plan:cls', 'class', ['q6', 'q2']), source('plan:fam', 'family', ['q4'])];
    const i = input({ snapshot: s, sources, isQuestOpen: closed('q6') });
    expect(routeNext(i)).toMatchObject({ questId: 'quest:q4', source: 'family' });
    expect(planView(i).leadingSourceId).toBe('plan:fam');
  });

  it('falls back to the cursor once every plan item is done or closed', () => {
    const s = snap(['q1'], [hw('plan:cls', 'q1', '2026-10-14', { completedAt: '2026-10-10T08:05:00.000Z' }), hw('plan:cls', 'q6', '2026-10-14')]);
    expect(routeNext(input({ snapshot: s, sources: [source('plan:cls', 'class', ['q1', 'q6'])], isQuestOpen: closed('q6') }))).toMatchObject({
      questId: 'quest:q2',
      source: 'cursor',
      sourceId: null,
    });
  });
});

describe('routeNext: placed-out quests, free-end and rest (steps 3 and 4)', () => {
  const skipAll: CursorContext = { isEntitled: () => true, skipQuestIds: new Set(['quest:q1', 'quest:q2', 'quest:q3', 'quest:q4', 'quest:q5']) };
  const freeOn = { active: true, tier: 'free' as const };

  it('a placed-out quest is skipped while a new one is open', () => {
    expect(routeNext(input({ cursor: skipAll }))).toMatchObject({ questId: 'quest:q6', source: 'cursor' });
  });

  it('placed-out free learner with the switch on: free-end with placedOut, never a replay of letters they know', () => {
    expect(routeNext(input({ cursor: skipAll, gating: freeOn, isQuestOpen: closed('q6', 'q8') }))).toEqual({ kind: 'free-end', placedOut: true });
  });

  it('placed-out premium learner: today\'s fallback quest from the cursor', () => {
    expect(routeNext(input({ cursor: skipAll, snapshot: snap(['q6', 'q8']) }))).toMatchObject({ questId: 'quest:q1', source: 'cursor' });
  });

  it('placed-out free learner with nothing closed: rest', () => {
    expect(routeNext(input({ cursor: skipAll, gating: freeOn, snapshot: snap(['q6', 'q8']) }))).toEqual({ kind: 'rest' });
  });

  it('placed out of everything left with no fallback either: rest', () => {
    const skipEvery: CursorContext = { isEntitled: () => true, skipQuestIds: new Set(QUESTS.map((q) => q.id)) };
    expect(routeNext(input({ cursor: skipEvery, snapshot: snap(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q8']) }))).toEqual({ kind: 'rest' });
  });

  it('free-end: switch on, free, every open quest done and a playable grid lesson closed', () => {
    const all = snap(['q1', 'q2', 'q3', 'q4', 'q5']);
    expect(routeNext(input({ snapshot: all, gating: freeOn, isQuestOpen: closed('q6', 'q8') }))).toEqual({ kind: 'free-end', placedOut: false });
  });

  it('justCompleted can end the free lessons', () => {
    const almost = snap(['q1', 'q2', 'q3', 'q4']);
    expect(routeNext(input({ snapshot: almost, gating: freeOn, isQuestOpen: closed('q6', 'q8'), justCompleted: 'quest:q5' }))).toEqual({
      kind: 'free-end',
      placedOut: false,
    });
  });

  it('rest: premium, the switch off, or nothing closed', () => {
    const every = snap(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q8']);
    expect(routeNext(input({ snapshot: every }))).toEqual({ kind: 'rest' });
    expect(routeNext(input({ snapshot: every, gating: { active: false, tier: 'free' } }))).toEqual({ kind: 'rest' });
    expect(routeNext(input({ snapshot: every, gating: freeOn }))).toEqual({ kind: 'rest' });
    const s1 = snap(['q1', 'q2', 'q3', 'q4', 'q5']);
    expect(routeNext(input({ snapshot: s1, gating: { active: true, tier: 'premium' }, isQuestOpen: closed('q6', 'q8') }))).toEqual({ kind: 'rest' });
  });
});

describe('planView', () => {
  it('is empty with no plan source holding a qualifying item', () => {
    const view = planView(input());
    expect(view).toEqual({ leadingSourceId: null, leadingKind: null, inPlanQuestIds: new Set(), inPlanEpisodeIds: new Set() });
  });

  it('holds the leading source\'s pending qualifying items inside the horizon (today plus seven days)', () => {
    const s = snap(
      ['q1'],
      [
        hw('route:mine', 'q2', TODAY, { assignedBy: 'system' }),
        hw('route:mine', 'q4', '2026-10-19', { assignedBy: 'system' }),
        hw('route:mine', 'q5', '2026-10-20', { assignedBy: 'system' }),
        hw('route:mine', 'q1', TODAY, { assignedBy: 'system', completedAt: '2026-10-10T08:05:00.000Z' }),
        hw('route:mine', 'q6', TODAY, { assignedBy: 'system' }),
      ],
    );
    const i = input({ snapshot: s, sources: [source('route:mine', 'self', ['q1', 'q2', 'q4', 'q5', 'q6'])], isQuestOpen: closed('q6') });
    const view = planView(i);
    expect(view.leadingKind).toBe('self');
    expect([...view.inPlanQuestIds].sort()).toEqual(['quest:q2', 'quest:q4']);
    expect([...view.inPlanEpisodeIds].sort()).toEqual(['episode:s1-letters', 'episode:s1-life']);
    expect(planView({ ...i, justCompleted: 'quest:q2' }).inPlanQuestIds.has('quest:q2')).toBe(false);
  });

  it('keeps the leading source when every item sits past the horizon (no marks)', () => {
    const s = snap([], [hw('plan:cls', 'q5', '2026-11-30')]);
    const view = planView(input({ snapshot: s, sources: [source('plan:cls', 'class', ['q5'])] }));
    expect(view.leadingSourceId).toBe('plan:cls');
    expect(view.inPlanQuestIds.size).toBe(0);
  });
});

describe('planView: the derivation horizon of the leading source', () => {
  const items = [hw('plan:cls', 'q4', '2026-10-19'), hw('plan:cls', 'q5', '2026-10-26')];

  it('a curriculum uses its own horizonDays (14 days marks an item 14 days out)', () => {
    const curriculum: DeriveSource = { ...source('plan:cls', 'class', ['q4', 'q5']), meta: { ...selfRoute().meta, horizonDays: 14 } };
    const view = planView(input({ snapshot: snap([], items), sources: [curriculum] }));
    expect([...view.inPlanQuestIds].sort()).toEqual(['quest:q4', 'quest:q5']);
  });

  it('a seven-day curriculum and a classic plan stop at today plus seven days', () => {
    const plain: DeriveSource = { ...source('plan:cls', 'class', ['q4', 'q5']), meta: { ...selfRoute().meta, horizonDays: 7 } };
    expect([...planView(input({ snapshot: snap([], items), sources: [plain] })).inPlanQuestIds]).toEqual(['quest:q4']);
    expect([...planView(input({ snapshot: snap([], items), sources: [source('plan:cls', 'class', ['q4', 'q5'])] })).inPlanQuestIds]).toEqual(['quest:q4']);
  });
});

describe('qualifiesForNext and inAPlan', () => {
  it('qualifiesForNext is step 1\'s test: known, playable, open and not done', () => {
    const q = qualifiesForNext(input({ snapshot: snap(['q1']), isQuestOpen: closed('q6'), justCompleted: 'quest:q2' }));
    expect(q('quest:q3')).toBe(true);
    expect(q('quest:q1')).toBe(false);
    expect(q('quest:q2')).toBe(false);
    expect(q('quest:q6')).toBe(false);
    expect(q('quest:q7')).toBe(false);
    expect(q('quest:nope')).toBe(false);
  });

  it('inAPlan holds while a listed plan source still has the quest, pending or done', () => {
    const s = snap([], [hw('plan:cls', 'q4', TODAY, { completedAt: '2026-10-12T08:00:00.000Z' }), hw(null, 'q5', TODAY), hw('plan:cls', 'q6', TODAY, { profileId: 'profile:other' })]);
    const i = input({ snapshot: s, sources: [source('plan:cls', 'class', ['q4', 'q6'])] });
    expect(inAPlan(i, 'quest:q4')).toBe(true);
    expect(inAPlan(i, 'quest:q5')).toBe(false);
    expect(inAPlan(i, 'quest:q6')).toBe(false);
    expect(inAPlan({ ...i, sources: [] }, 'quest:q4')).toBe(false);
  });
});

describe('routeNextInputOf', () => {
  it('builds the sources from the plans and the self-route, and the cursor from the placements', () => {
    const plan: InboxPlan = {
      id: 'plan:cls',
      spaceId: 'space:1',
      spaceKind: 'class',
      spaceName: 'Class',
      title: 'Week 1',
      items: [{ kind: 'quest', id: 'quest:q4' }],
      publishedAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };
    const s = { ...snap(), selfRoute: selfRoute({ items: [{ kind: 'quest', id: 'quest:q5' }] }) };
    const built = routeNextInputOf({
      snapshot: s,
      profileId: P,
      today: TODAY,
      plans: [plan],
      quests: QUESTS,
      episodes: EPISODES,
      tier: 'free',
      gatingActive: true,
      isQuestOpen: closed('q6'),
      justCompleted: 'quest:q1',
    });
    expect(built.sources.map((x) => [x.id, x.kind])).toEqual([
      ['plan:cls', 'class'],
      ['route:mine', 'self'],
    ]);
    expect(built.gating).toEqual({ active: true, tier: 'free' });
    expect(built.justCompleted).toBe('quest:q1');
    expect(built.cursor.isQuestOpen?.('quest:q6')).toBe(false);
    expect(built.cursor.skipQuestIds).toBeUndefined();
    expect(routeNext(built)).toMatchObject({ questId: 'quest:q2', source: 'cursor' });
  });

  it('treats missing plans as none and leaves justCompleted out when not given', () => {
    const built = routeNextInputOf({
      snapshot: snap(),
      profileId: P,
      today: TODAY,
      plans: undefined,
      quests: QUESTS,
      episodes: EPISODES,
      tier: 'premium',
      gatingActive: false,
      isQuestOpen: allOpen,
    });
    expect(built.sources).toEqual([]);
    expect('justCompleted' in built).toBe(false);
  });
});

describe('off-plan and telemetry', () => {
  const view: PlanView = {
    leadingSourceId: 'route:mine',
    leadingKind: 'self',
    inPlanQuestIds: new Set(['quest:q4']),
    inPlanEpisodeIds: new Set(['episode:s1-life']),
  };
  const none: PlanView = { leadingSourceId: null, leadingKind: null, inPlanQuestIds: new Set(), inPlanEpisodeIds: new Set() };
  const before = (over: Partial<PlanBefore> = {}): PlanBefore => ({
    view,
    nextQuestId: 'quest:q4',
    pendingQuestIds: new Set(['quest:q4']),
    doneQuestIds: new Set(),
    ...over,
  });

  it('isOffPlan: a leading source exists and the quest is not in its set, not the next and not pending', () => {
    expect(isOffPlan(before(), 'quest:q6')).toBe(true);
    expect(isOffPlan(before(), 'quest:q4')).toBe(false);
    expect(isOffPlan(before({ view: none }), 'quest:q6')).toBe(false);
    expect(isOffPlan(before({ nextQuestId: 'quest:q6' }), 'quest:q6')).toBe(false);
    expect(isOffPlan(before({ pendingQuestIds: new Set(['quest:q6']) }), 'quest:q6')).toBe(false);
  });

  it('route.offplan_finished carries the leading kind and the stage of the quest played', () => {
    expect(offplanFinishedEvent(P, before(), 'quest:q6', EPISODES)).toEqual({
      name: 'route.offplan_finished',
      profileId: P,
      payload: { source: 'self', stage: 'stage2' },
    });
    expect(offplanFinishedEvent(P, before(), 'quest:q4', EPISODES)).toBeNull();
    expect(offplanFinishedEvent(P, before({ view: none }), 'quest:q6', EPISODES)).toBeNull();
    expect(offplanFinishedEvent(P, before(), 'quest:nope', EPISODES)).toBeNull();
    expect(offplanFinishedEvent(P, before({ nextQuestId: 'quest:q6' }), 'quest:q6', EPISODES)).toBeNull();
  });

  it('a replay of a quest already done is not sent (review, not a detour)', () => {
    expect(offplanFinishedEvent(P, before({ doneQuestIds: new Set(['quest:q6']) }), 'quest:q6', EPISODES)).toBeNull();
  });

  it('planBeforeOf: the Thursday class / today family case; playing the family item (the next) is not off-plan', () => {
    const s = snap(['q1'], [hw('plan:cls', 'q5', '2026-10-15'), hw('plan:fam', 'q2', TODAY, { assignedBy: 'parent' })]);
    const b = planBeforeOf(input({ snapshot: s, sources: [source('plan:cls', 'class', ['q5']), source('plan:fam', 'family', ['q2'])] }));
    expect(b.nextQuestId).toBe('quest:q2');
    expect([...b.view.inPlanQuestIds]).toEqual(['quest:q5']);
    expect([...b.pendingQuestIds].sort()).toEqual(['quest:q2', 'quest:q5']);
    expect([...b.doneQuestIds]).toEqual(['quest:q1']);
    expect(isOffPlan(b, 'quest:q2')).toBe(false);
    expect(offplanFinishedEvent(P, b, 'quest:q2', EPISODES)).toBeNull();
    expect(isOffPlan(b, 'quest:q6')).toBe(true);
  });

  it('planBeforeOf: a classic plan item past the horizon is the next and not off-plan; rest has no next', () => {
    const s = snap([], [hw('plan:cls', 'q5', '2026-10-22')]);
    const b = planBeforeOf(input({ snapshot: s, sources: [source('plan:cls', 'class', ['q5'])] }));
    expect(b.view.inPlanQuestIds.size).toBe(0);
    expect(b.nextQuestId).toBe('quest:q5');
    expect(isOffPlan(b, 'quest:q5')).toBe(false);
    expect(offplanFinishedEvent(P, b, 'quest:q5', EPISODES)).toBeNull();
    expect(planBeforeOf(input({ snapshot: snap(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q8']) })).nextQuestId).toBeNull();
  });

  it('route.next_started carries the source and the surface', () => {
    expect(nextStartedEvent(P, 'family', 'home')).toEqual({ name: 'route.next_started', profileId: P, payload: { source: 'family', surface: 'home' } });
    expect(nextStartedEvent(undefined, 'cursor', 'placement')).toEqual({ name: 'route.next_started', payload: { source: 'cursor', surface: 'placement' } });
  });
});
