import { CATALOG, effectiveRoute, learnerPosition, resolvePreset, routeCatalogOf, type RouteCatalog, type RouteSeed } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesWithVolumes, questsAll } from '../../../content';
import { placementRouteCatalog } from '../catalog';
import { startChoices } from '../report-page';
import { resultView, type ResultViewInput } from '../result-view';
import { appRouteCatalog } from '../route-skip';
import { placementResult } from './fixtures';

/**
 * Every "first grid playable quest" consumer of the route catalogue over the shipped catalogue (F-CURR-002 row CM-40,
 * row CM-41 S4): the route is each cell's first volume, so no consumer returns a later volume's quest, with `volumes`
 * on or off. A later volume is still placed out like its first volume (`volumes-placement.test.ts`), and it is opened
 * from its cell's Vol tab, never as a route start, a "next" card or a grown-up's start choice.
 */
const LATER = new Set(episodesWithVolumes.filter((e) => (e.volume ?? 1) > 1).flatMap((e) => e.questIds));

const CATALOGS: ReadonlyArray<readonly [string, RouteCatalog]> = [
  ['routeCatalogOf (shared catalogue)', routeCatalogOf(CATALOG)],
  ['placementRouteCatalog (the level check and the grown-up report)', placementRouteCatalog(questsAll, episodesWithVolumes)],
  ['appRouteCatalog (the cursor, with later volumes)', appRouteCatalog(questsAll, episodesWithVolumes)],
];

/** Every first volume's grid playable quest: a learner who finished them all. */
const firstVolumeDone = (catalog: RouteCatalog): Set<string> => new Set(catalog.quests.filter((q) => q.grid && q.playable && !LATER.has(q.id)).map((q) => q.id));
const lastFirstVolume = (catalog: RouteCatalog): string => [...firstVolumeDone(catalog)].at(-1) as string;

describe('later volumes stay off the route (row CM-40, shipped Stage 4 Nature Volume 2)', () => {
  it('the shipped catalogue has a later volume, and each route catalogue marks exactly its quests', () => {
    expect(LATER.has('quest:stage4-nature-v2-q1')).toBe(true);
    for (const [name, catalog] of CATALOGS) {
      const marked = catalog.quests.filter((q) => q.laterVolume === true).map((q) => q.id);
      expect(new Set(marked), name).toEqual(LATER);
    }
  });

  it.each(CATALOGS)('%s: the route seed never starts on a later volume', (_, catalog) => {
    const seed = effectiveRoute([placementResult({ placedOutQuestIds: [] })], catalog, { isEntitled: () => true, completedQuestIds: firstVolumeDone(catalog) }) as RouteSeed;
    expect(seed.startQuestId).toBeNull();
    // Without a completion, the start is a first volume's quest.
    const fresh = effectiveRoute([placementResult({ placedOutQuestIds: [] })], catalog, { isEntitled: () => true, completedQuestIds: new Set() }) as RouteSeed;
    expect(LATER.has(fresh.startQuestId as string)).toBe(false);
  });

  it.each(CATALOGS)('%s: the grown-up start choices list no later volume', (_, catalog) => {
    const seed = effectiveRoute([placementResult({ placedOutQuestIds: [] })], catalog, { isEntitled: () => true, completedQuestIds: new Set() }) as RouteSeed;
    const choices = startChoices(seed, catalog, new Set(), () => true).map((c) => c.questId);
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.filter((id) => LATER.has(id))).toEqual([]);
  });

  it.each(CATALOGS)('%s: a start on the last first-volume lesson has no later volume as a next card', (_, catalog) => {
    const start = lastFirstVolume(catalog);
    const after: RouteSeed = {
      level: { stage: 'stage1', band: 0 },
      oralStage: null,
      startQuestId: start,
      startEpisodeId: null,
      placedOutQuestIds: [],
      priorityTokens: [],
      themeOrder: ['letters', 'life', 'rites', 'nature', 'crafts'],
      beyondContent: false,
      needsStage: null,
    };
    const input: ResultViewInput = {
      result: placementResult(),
      before: null,
      after,
      catalog,
      completedQuestIds: new Set(),
      profileType: 'self',
      routeEnabled: true,
      myRouteEnabled: true,
      proposalAvailable: true,
      planPromptDismissed: false,
      hasActivePlan: false,
      planUpdateAvailable: true,
      hasReviewedShelfStory: true,
      gateRequired: false,
    };
    const { cards } = resultView(input);
    expect(cards.startHere).toBe(start);
    expect(cards.next.filter((id) => LATER.has(id))).toEqual([]);
  });

  it('a lecture preset never names a later volume as its next lesson, even with every first volume done', () => {
    const done = [...firstVolumeDone(routeCatalogOf(CATALOG))];
    const position = learnerPosition(null, done, CATALOG);
    expect(LATER.has(position?.questId ?? '')).toBe(false);
    for (const preset of ['next-lesson', 'by-stage'] as const) {
      const { blocks } = resolvePreset(preset, 20, { catalog: CATALOG, position });
      expect(JSON.stringify(blocks), preset).not.toMatch(/-v[0-9]+(-q[0-9]+)?"/);
    }
  });
});
