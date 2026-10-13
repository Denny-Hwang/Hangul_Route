import type { Episode, HomeworkAssignment, ProgressSnapshot } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../content';
import { questOpenPredicate } from '../content-access';
import type { CursorContext } from '../cursor-context';
import { mergeAssignments } from '../homework/assignment-merger';
import { buildTodaysMission } from '../homework/mission-builder';
import type { DeriveSource } from '../homework/plan-derivation';
import { gridEpisodes } from '../../content/episodes';
import { placementStart } from '../placement/session';
import { resultsTeaser } from '../quest-flow/results-teaser';
import { offplanFinishedEvent, planBeforeOf, planView, qualifiesForNext, routeNext, type RouteNext, type RouteNextInput } from '../route-next';
import { selfRoute } from '../homework/__tests__/curriculum-fixture';
import { journeyContent } from '../../content/sync-context';
import { buildMyRoute } from '../my-route/model';
import { localizedRouteContent, routeModelInput } from '../my-route/route-input';

/**
 * F-ENT-003 section 3.5, the cross-spec golden (PR E3-4): on each snapshot below, Home card (2)
 * (`buildTodaysMission` with today's assignment merged), the Results teaser target and the placement
 * result's primary action name the quest `routeNext` names, on the shipped bundle. The Journey mark
 * model and the episode tag model join this file with E3-5 and E3-6. The Learning Route's
 * `buildMyRoute().next` and `.inPlanEpisodeIds` (LR-3b) are asserted below.
 */

const P = 'profile:p1';
const TODAY = '2026-10-12'; // Monday
const STAGE1 = gridEpisodes(episodesAll)
  .filter((e) => e.stage === 'stage1' && (e.status === 'shipped' || e.status === 'ready'))
  .flatMap((e) => e.questIds);
const episodeOf = (questId: string): string => episodesAll.find((e) => e.questIds.includes(questId))!.id;

function snapshot(doneIds: readonly string[], homework: HomeworkAssignment[] = [], over: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    profileId: P,
    updatedAt: `${TODAY}T08:00:00.000Z`,
    episodes: [],
    quests: doneIds.map((questId) => ({
      questId,
      episodeId: episodeOf(questId),
      startedAt: '2026-10-01T08:00:00.000Z',
      completedAt: '2026-10-01T08:05:00.000Z',
      stars: 3,
      attempts: 1,
      accuracy: 1,
    })),
    cards: [],
    sessions: [],
    homework,
    reviews: [],
    streakDays: 1,
    ...over,
  };
}

function item(sourceId: string, questId: string, targetDate: string, assignedBy: HomeworkAssignment['assignedBy']): HomeworkAssignment {
  return { id: `${sourceId}#${questId}`, profileId: P, questId, episodeId: episodeOf(questId), assignedBy, assignedAt: '2026-10-01T00:00:00.000Z', targetDate };
}

function source(id: string, kind: DeriveSource['kind'], questIds: readonly string[], assignedAt: string, meta: DeriveSource['meta'] = null): DeriveSource {
  return { id, kind, assignedAt, items: questIds.map((q) => ({ kind: 'quest' as const, id: q })), meta };
}

interface Case {
  name: string;
  snapshot: ProgressSnapshot;
  sources: DeriveSource[];
  free?: boolean;
  cursor?: CursorContext;
  /** Defaults to the shipped bundle's episodes. */
  episodes?: Episode[];
}

const LIFE_Q2 = 'quest:stage1-life-q2';
const S2_NATURE = 'quest:stage2-nature-q1';

const CASES: Case[] = [
  { name: 'no plan', snapshot: snapshot(['quest:stage1-letters-q1']), sources: [] },
  {
    name: 'self plan with an item dated Wednesday',
    snapshot: snapshot([], [item('route:mine', LIFE_Q2, '2026-10-14', 'system')]),
    sources: [source('route:mine', 'self', [LIFE_Q2], '2026-10-01T00:00:00.000Z')],
  },
  {
    name: 'family curriculum item today and a classic class plan item on Thursday',
    snapshot: snapshot([], [item('plan:fam', 'quest:stage1-rites-q1', TODAY, 'parent'), item('plan:cls', LIFE_Q2, '2026-10-15', 'teacher')]),
    sources: [
      source('plan:cls', 'class', [LIFE_Q2], '2026-10-01T00:00:00.000Z'),
      source('plan:fam', 'family', ['quest:stage1-rites-q1'], '2026-10-02T00:00:00.000Z', selfRoute().meta),
    ],
  },
  {
    name: 'a curriculum and a classic plan in the same rank',
    snapshot: snapshot([], [item('plan:a', 'quest:stage1-nature-q1', '2026-10-16', 'teacher'), item('plan:b', LIFE_Q2, '2026-10-17', 'teacher')]),
    sources: [
      source('plan:a', 'class', ['quest:stage1-nature-q1'], '2026-09-01T00:00:00.000Z', selfRoute().meta),
      source('plan:b', 'class', [LIFE_Q2], '2026-10-05T00:00:00.000Z'),
    ],
  },
  { name: 'free learner, switch on, at the end of the free lessons', snapshot: snapshot(STAGE1), sources: [], free: true },
  {
    name: 'placed-out free learner, switch on',
    snapshot: snapshot([]),
    sources: [],
    free: true,
    cursor: { isEntitled: () => true, skipQuestIds: new Set(STAGE1) },
  },
  {
    name: 'free learner, switch on, plan item past Stage 1 (closed) and an open one',
    snapshot: snapshot(['quest:stage1-letters-q1'], [item('route:mine', S2_NATURE, TODAY, 'system'), item('route:mine', LIFE_Q2, '2026-10-14', 'system')]),
    sources: [source('route:mine', 'self', [S2_NATURE, LIFE_Q2], '2026-10-01T00:00:00.000Z')],
    free: true,
  },
  {
    name: 'a due assignment in an episode that is not playable (draft), and a self plan item',
    snapshot: snapshot([], [item('plan:cls', 'quest:stage1-nature-q1', TODAY, 'teacher'), item('route:mine', LIFE_Q2, '2026-10-14', 'system')]),
    sources: [source('plan:cls', 'class', ['quest:stage1-nature-q1'], '2026-10-01T00:00:00.000Z'), source('route:mine', 'self', [LIFE_Q2], '2026-10-01T00:00:00.000Z')],
    episodes: episodesAll.map((e) => (e.questIds.includes('quest:stage1-nature-q1') ? { ...e, status: 'draft' as const } : e)),
  },
  {
    name: 'a due assignment whose quest is already done, and a self plan item',
    snapshot: snapshot(['quest:stage1-nature-q1'], [item('plan:cls', 'quest:stage1-nature-q1', TODAY, 'teacher'), item('route:mine', LIFE_Q2, '2026-10-14', 'system')]),
    sources: [source('plan:cls', 'class', ['quest:stage1-nature-q1'], '2026-10-01T00:00:00.000Z'), source('route:mine', 'self', [LIFE_Q2], '2026-10-01T00:00:00.000Z')],
  },
];

function inputOf(c: Case): RouteNextInput {
  const completed = new Set(c.snapshot.quests.filter((q) => q.completedAt).map((q) => q.questId));
  const isQuestOpen = c.free
    ? questOpenPredicate({ tier: 'free', gatingEnabled: true, completedQuestIds: completed })
    : questOpenPredicate({ tier: 'premium', gatingEnabled: false, completedQuestIds: completed });
  const cursor = c.cursor ?? { isEntitled: () => true, skipQuestIds: undefined };
  return {
    snapshot: c.snapshot,
    profileId: P,
    today: TODAY,
    sources: c.sources,
    quests: questsAll,
    episodes: c.episodes ?? episodesAll,
    cursor: { ...cursor, isQuestOpen },
    isQuestOpen,
    gating: c.free ? { active: true, tier: 'free' } : { active: false, tier: 'premium' },
  };
}

function homeCard2(input: RouteNextInput): string | undefined {
  const built = buildTodaysMission({
    profileId: P,
    snapshot: input.snapshot,
    quests: questsAll,
    episodes: input.episodes,
    today: TODAY,
    isEntitled: input.cursor.isEntitled,
    skipQuestIds: input.cursor.skipQuestIds,
    isQuestOpen: input.isQuestOpen,
    route: input,
  });
  const merged = mergeAssignments({
    plan: built,
    assignments: input.snapshot.homework,
    today: TODAY,
    enabled: true,
    titleOf: (id) => questsAll.find((q) => q.id === id)?.titleEn,
    isQuestOpen: qualifiesForNext(input),
  }).plan;
  return merged.cards.find((c) => c.slot === 2)?.questId;
}

const questOf = (next: RouteNext): string | undefined => (next.kind === 'quest' ? next.questId : undefined);

describe('routeNext agreement across surfaces (F-ENT-003 section 3.5)', () => {
  for (const c of CASES) {
    describe(c.name, () => {
      const input = inputOf(c);
      const next = routeNext(input);

      it('Home card (2) names routeNext\'s quest (at free-end and rest: the replay fallback, an open quest)', () => {
        const card = homeCard2(input);
        if (next.kind === 'quest') expect(card).toBe(next.questId);
        else expect(card !== undefined && input.isQuestOpen(card)).toBe(true);
      });

      it('the Results teaser names routeNext with the quest just played counted as done', () => {
        const played = 'quest:stage1-letters-q1';
        const after = routeNext({ ...input, justCompleted: played });
        const teaser = resultsTeaser({ snapshot: input.snapshot, quests: questsAll, episodes: input.episodes, questId: played, total: 5, route: input, planBefore: planBeforeOf(input) });
        expect(teaser?.questId).toBe(questOf(after));
      });

      it('playing routeNext\'s own quest is never off-plan: no "Back to your plan", no route.offplan_finished', () => {
        if (next.kind !== 'quest') return;
        const before = planBeforeOf(input);
        const teaser = resultsTeaser({ snapshot: input.snapshot, quests: questsAll, episodes: input.episodes, questId: next.questId, total: 5, route: input, planBefore: before });
        expect(teaser?.caption).not.toBe('backToPlan');
        expect(offplanFinishedEvent(P, before, next.questId, input.episodes)).toBeNull();
      });

      it('the Learning Route names routeNext and marks planView\'s episodes (LR-3b)', () => {
        const model = buildMyRoute({
          ...journeyContent,
          episodes: input.episodes,
          snapshot: input.snapshot,
          route: null,
          skipQuestIds: input.cursor.skipQuestIds,
          now: new Date(`${TODAY}T08:00:00.000Z`),
          sources: input.sources.map((s) => ({ ...s, meta: s.meta ?? null })),
          today: TODAY,
          routeNext: next,
          planView: planView(input),
          isQuestOpen: input.isQuestOpen,
        });
        expect(model.next?.questId).toBe(questOf(next));
        expect(model.nextKind).toBe(next.kind);
        if (next.kind === 'quest') expect(model.next?.source).toBe(next.source);
        expect(new Set(model.inPlanEpisodeIds)).toEqual(new Set(planView(input).inPlanEpisodeIds));
        const markers = model.stages.flatMap((s) => [...s.pips, ...s.newPips]).filter((p) => p.isCursor);
        expect(markers.map((p) => p.questId)).toEqual(next.kind === 'quest' ? [next.questId] : []);
      });

      it('the screen\'s own path (routeModelInput with this input) names routeNext and marks planView\'s episodes (LR-5a)', () => {
        const localized = { ...localizedRouteContent('en'), episodes: [...input.episodes] };
        const model = buildMyRoute(routeModelInput({ snapshot: input.snapshot, tier: c.free ? 'free' : 'premium', localized, now: new Date(`${TODAY}T08:00:00.000Z`), next: input }));
        expect(model.next?.questId).toBe(questOf(next));
        expect(model.nextKind).toBe(next.kind);
        expect(new Set(model.inPlanEpisodeIds)).toEqual(new Set(planView(input).inPlanEpisodeIds));
        const markers = model.stages.flatMap((s) => [...s.pips, ...s.newPips]).filter((p) => p.isCursor);
        expect(markers.map((p) => p.questId)).toEqual(next.kind === 'quest' ? [next.questId] : []);
      });

      it('the placement result with a closed start quest starts routeNext', () => {
        const start = placementStart({
          start: { questId: S2_NATURE, episodeId: episodeOf(S2_NATURE) },
          isQuestOpen: (id) => id !== S2_NATURE && input.isQuestOpen(id),
          next,
          freeTopicKey: 'food',
        });
        if (next.kind === 'quest') expect(start).toMatchObject({ kind: 'quest', questId: next.questId });
        else if (next.kind === 'free-end' && next.placedOut) expect(start).toEqual({ kind: 'topic', topicKey: 'food' });
        else expect(start).toEqual({ kind: 'journey' });
      });
    });
  }

  it('the worked examples hold on the shipped bundle', () => {
    const [noPlan, self, famCls, sameRank, freeEnd, placedOut, closedItem, draftDue, doneDue] = CASES.map((c) => routeNext(inputOf(c)));
    expect(draftDue).toMatchObject({ questId: LIFE_Q2, source: 'self' });
    expect(doneDue).toMatchObject({ questId: LIFE_Q2, source: 'self' });
    expect(noPlan).toMatchObject({ questId: 'quest:stage1-letters-q2', source: 'cursor' });
    expect(self).toMatchObject({ questId: LIFE_Q2, source: 'self' });
    expect(famCls).toMatchObject({ questId: 'quest:stage1-rites-q1', source: 'family' });
    expect(planView(inputOf(CASES[2]!)).leadingKind).toBe('class');
    expect(sameRank).toMatchObject({ questId: LIFE_Q2, sourceId: 'plan:b' });
    expect(freeEnd).toEqual({ kind: 'free-end', placedOut: false });
    expect(placedOut).toEqual({ kind: 'free-end', placedOut: true });
    expect(closedItem).toMatchObject({ questId: LIFE_Q2, source: 'self' });
  });
});
