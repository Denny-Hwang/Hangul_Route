import { describe, expect, it } from 'vitest';
import { CATALOG, generateCurriculum, toMeta, toPlanItems, type InboxPlan } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { episodesAll, heritageCardsAll, questsAll, stages, themes } from '../../../content';
import { journeyContent } from '../../../content/sync-context';
import { localizeEpisode, localizeStage, localizeTheme } from '../../content-locale';
import { cursorContext } from '../../cursor-context';
import { buildMyRoute } from '../model';
import { planView, routeNext, routeNextInputOf } from '../../route-next';
import { goalSourcesOf, localizedRouteContent, routeLetterWall, routeModelInput, routeWeekOf } from '../route-input';
import { homeStripView } from '../home-strip';
import { archivedRoute, selfRouteOf } from '../../route/self-route';
import { myRouteView } from '../view';
import { startRouteOf } from '../start-marker';
import type { SeenRecord } from '../types';
import { emptySnapshot } from '../view';

/**
 * One input for the Learning Route page and the Home strip (F-ROUTE-001 R-4b):
 * both screens build `buildMyRoute` from here, so the strip and the page always
 * name the same stage and pips, with the same localized titles.
 */

const NOW = new Date('2026-10-11T00:00:00.000Z');

describe('localizedRouteContent', () => {
  it('localizes the stages, themes and episodes for the locale', () => {
    for (const locale of ['en', 'ko', 'es'] as const) {
      const c = localizedRouteContent(locale);
      expect(c.stages).toEqual(stages.map((s) => localizeStage(s, locale)));
      expect(c.themes).toEqual(themes.map((t) => localizeTheme(t, locale)));
      expect(c.episodes).toEqual(episodesAll.map((e) => localizeEpisode(e, locale)));
    }
  });
});

describe('routeModelInput', () => {
  const snapshot = emptySnapshot('p1');
  const localized = localizedRouteContent('ko');

  it('passes the shared catalog, quests, cards, cursor and start route with the localized content', () => {
    const input = routeModelInput({ snapshot, tier: 'free', localized, now: NOW });
    const cursor = cursorContext({ tier: 'free', placements: snapshot.placements, quests: questsAll, episodes: episodesAll });
    expect(input.snapshot).toBe(snapshot);
    expect(input.catalog).toBe(journeyContent.catalog);
    expect(input.quests).toBe(questsAll);
    expect(input.cards).toBe(heritageCardsAll);
    expect(input.episodes).toBe(localized.episodes);
    expect(input.stages).toBe(localized.stages);
    expect(input.themes).toBe(localized.themes);
    expect(input.skipQuestIds).toEqual(cursor.skipQuestIds);
    expect(input.route).toEqual(startRouteOf(snapshot.placements, journeyContent.catalog, cursor.isEntitled));
    expect(input.seen).toBeUndefined();
    expect(input.now).toBe(NOW);
    for (const s of stages) expect(input.isEntitled(s.key)).toBe(cursor.isEntitled(s.key));
  });

  it('carries the seen record when the page has one', () => {
    const seen: SeenRecord = { totals: {}, doneKeys: [], at: '2026-10-10T00:00:00.000Z' };
    expect(routeModelInput({ snapshot, tier: 'free', localized, seen, now: NOW }).seen).toBe(seen);
  });

  it('builds a model with exactly one here stage', () => {
    const model = buildMyRoute(routeModelInput({ snapshot, tier: 'free', localized, now: NOW }));
    expect(model.stages).toHaveLength(7);
    expect(model.stages.filter((s) => s.here)).toHaveLength(1);
  });
});

describe('routeLetterWall (R-7c)', () => {
  const localized = localizedRouteContent('en');
  const build = (snapshot: ReturnType<typeof emptySnapshot>) => buildMyRoute(routeModelInput({ snapshot, tier: 'free', localized, now: NOW }));

  it('draws the 30 Stage 1 letters of the shipped bundle, none lit for a new learner', () => {
    const tiles = routeLetterWall(build(emptySnapshot('p1')));
    expect(tiles).toHaveLength(30);
    expect(tiles.every((t) => t.state === 'ahead')).toBe(true);
  });

  it('lights the letters of a finished quest from the page model', () => {
    const snapshot = emptySnapshot('p1');
    const done = {
      ...snapshot,
      quests: [
        {
          questId: 'quest:stage1-letters-q1',
          episodeId: 'episode:stage1-letters',
          startedAt: '2026-10-10T00:00:00.000Z',
          completedAt: '2026-10-10T00:05:00.000Z',
          stars: 3 as const,
          attempts: 1,
          accuracy: 1,
        },
      ],
    };
    const lit = routeLetterWall(build(done)).filter((t) => t.state === 'met').map((t) => t.key);
    expect(lit).toEqual(['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ']);
  });

  it('draws nothing for a model without a Stage 1 row', () => {
    const model = build(emptySnapshot('p1'));
    expect(routeLetterWall({ ...model, stages: model.stages.filter((s) => s.stage !== 'stage1') })).toEqual([]);
  });
});

describe('routeModelInput with F-ENT-003\'s input (LR-5a)', () => {
  const snapshot = emptySnapshot('p1');
  const localized = localizedRouteContent('en');
  const next = routeNextInputOf({
    snapshot,
    profileId: 'p1',
    today: '2026-10-12',
    plans: undefined,
    quests: questsAll,
    episodes: episodesAll,
    tier: 'premium',
    gatingActive: false,
    isQuestOpen: () => true,
  });

  it('without it: no sources, no next and no access, so the model uses the catalogue cursor and the default goal', () => {
    const input = routeModelInput({ snapshot, tier: 'free', localized, now: NOW });
    for (const key of ['sources', 'today', 'routeNext', 'planView', 'isQuestOpen'] as const) expect(input).not.toHaveProperty(key);
  });

  it('with it: the goal sources, the plan day, routeNext, planView and the access predicate of that input', () => {
    const input = routeModelInput({ snapshot, tier: 'free', localized, now: NOW, next });
    expect(input.sources).toEqual(goalSourcesOf(next));
    expect(input.today).toBe('2026-10-12');
    expect(input.routeNext).toEqual(routeNext(next));
    expect(input.planView).toEqual(planView(next));
    expect(input.isQuestOpen).toBe(next.isQuestOpen);
    expect(buildMyRoute(input).next?.questId).toBe(routeNext(next).kind === 'quest' ? (routeNext(next) as { questId: string }).questId : undefined);
  });

  it('goalSourcesOf: a classic plan without meta reads as meta null', () => {
    expect(goalSourcesOf({ sources: [{ id: 'plan:a', kind: 'class', assignedAt: 't', items: [] }] })).toEqual([{ id: 'plan:a', kind: 'class', assignedAt: 't', items: [], meta: null }]);
  });
});

describe('routeWeekOf: the live weekly plan week for the page line and the Home strip (R-7b)', () => {
  const localized = localizedRouteContent('en');
  const EN = getMessages('en');
  const draftOf = (audience: 'self' | 'class', startDate: string) =>
    generateCurriculum(
      {
        audience,
        level: { stage: 'stage1', band: 0 },
        completedQuestIds: [],
        startDate,
        weeks: 4,
        sessionsPerWeek: 3,
        minutesPerSession: 15,
        unlockedStages: ['stage1'],
      },
      CATALOG,
    );
  // The learner's own plan, as P2-7a's route-store stores it in the snapshot (`setSelfRoute`).
  const selfPlan = selfRouteOf(draftOf('self', '2026-10-12'), 'route:self-0001', '2026-10-12T09:00:00.000Z');
  const classDraft = draftOf('class', '2026-10-05');
  const classPlan: InboxPlan = {
    id: 'plan:class-1',
    spaceId: 'space:c',
    spaceKind: 'class',
    spaceName: 'Room 3',
    title: 'Hangul',
    items: toPlanItems(classDraft),
    publishedAt: '2026-10-04T00:00:00.000Z',
    updatedAt: '2026-10-04T00:00:00.000Z',
    meta: toMeta(classDraft),
  };
  const build = (opts: { selfRoute?: typeof selfPlan | null; plans?: InboxPlan[]; today: string }) => {
    const snapshot = { ...emptySnapshot('p1'), selfRoute: opts.selfRoute ?? null };
    const next = routeNextInputOf({
      snapshot,
      profileId: 'p1',
      today: opts.today,
      plans: opts.plans,
      quests: questsAll,
      episodes: episodesAll,
      tier: 'premium',
      gatingActive: false,
      isQuestOpen: () => true,
    });
    const model = buildMyRoute(routeModelInput({ snapshot, tier: 'premium', localized, now: NOW, next }));
    return { model, next };
  };

  it("reads the learner's own weekly plan from the snapshot: the week holding today", () => {
    const first = build({ selfRoute: selfPlan, today: '2026-10-12' });
    expect(first.model.goal?.from).toBe('self');
    expect(routeWeekOf(first.model, first.next)).toBe(1);
    const third = build({ selfRoute: selfPlan, today: '2026-10-28' });
    expect(routeWeekOf(third.model, third.next)).toBe(3);
  });

  it("reads the class's weekly plan, which leads the learner's own (the goal's plan)", () => {
    const both = build({ selfRoute: selfPlan, plans: [classPlan], today: '2026-10-13' });
    expect(both.model.goal?.from).toBe('class');
    expect(routeWeekOf(both.model, both.next)).toBe(2);
    const classOnly = build({ plans: [classPlan], today: '2026-10-05' });
    expect(routeWeekOf(classOnly.model, classOnly.next)).toBe(1);
  });

  it("a class plan that has not started yet leads the learner's running plan, so no week shows until it starts (amendment 4.1, 4.3)", () => {
    // Intended: the week is the goal plan's week, and pickGoal counts an assigned class plan as live
    // from assignment, so the goal moves to the class plan and the self plan's week 3 is not shown.
    const laterDraft = draftOf('class', '2026-11-02');
    const laterClass: InboxPlan = { ...classPlan, id: 'plan:class-2', items: toPlanItems(laterDraft), meta: toMeta(laterDraft) };
    const mixed = build({ selfRoute: selfPlan, plans: [laterClass], today: '2026-10-28' });
    expect(mixed.model.goal?.from).toBe('class');
    expect(routeWeekOf(mixed.model, mixed.next)).toBeNull();
    const selfOnly = build({ selfRoute: selfPlan, today: '2026-10-28' });
    expect(routeWeekOf(selfOnly.model, selfOnly.next)).toBe(3);
  });

  it('is null with no plan, an archived plan, a classic plan, before the plan starts, after it ends, or without the input', () => {
    const none = build({ today: '2026-10-12' });
    expect(routeWeekOf(none.model, none.next)).toBeNull();
    const archived = build({ selfRoute: archivedRoute(selfPlan, '2026-10-13T00:00:00.000Z'), today: '2026-10-13' });
    expect(routeWeekOf(archived.model, archived.next)).toBeNull();
    const classic = build({ plans: [{ ...classPlan, meta: null }], today: '2026-10-13' });
    expect(routeWeekOf(classic.model, classic.next)).toBeNull();
    const early = build({ selfRoute: selfPlan, today: '2026-10-11' });
    expect(routeWeekOf(early.model, early.next)).toBeNull();
    const after = build({ selfRoute: selfPlan, today: '2026-11-09' });
    expect(routeWeekOf(after.model, after.next)).toBeNull();
    expect(routeWeekOf(none.model, undefined)).toBeNull();
  });

  it('the page line and the Home strip show the same week, and neither carries a Next title', () => {
    const { model, next } = build({ selfRoute: selfPlan, today: '2026-10-20' });
    const week = routeWeekOf(model, next);
    expect(week).toBe(2);
    const strip = homeStripView({ model, messages: EN, goalStage: model.goal?.stage ?? null, week });
    const page = myRouteView({
      model,
      messages: EN,
      viewer: 'self',
      name: '',
      themeTitles: Object.fromEntries(localized.themes.map((t) => [t.key, t.titleEn])) as Parameters<typeof myRouteView>[0]['themeTitles'],
      nextTitle: 'Family at the Table',
      hasStories: false,
      seen: undefined,
      week,
    });
    expect(strip.week).toBe('Week 2 of your weekly plan');
    expect(page.planLine).toBe(strip.week);
    for (const line of [strip.week, page.planLine]) {
      expect(line).not.toMatch(/Next|Family at the Table/);
      expect(line).not.toMatch(/\d+\s*(of|\/)\s*\d+/);
    }
    // The strip's screen-reader label names the same week.
    expect(strip.a11yLabel).toContain('Week 2 of your weekly plan');
  });
});
